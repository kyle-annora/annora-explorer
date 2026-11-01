import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WALKTHROUGH_SESSION_KEY, WALKTHROUGH_PRODUCT_ID, hasWalkthroughRequest,
  readWalkthroughSession, walkthroughStorageKey, withWalkthroughSession,
  createWalkthroughSession, getWalkthroughSession, resumeWalkthroughSession,
  restartWalkthroughSession, createWalkthroughRepository,
} from '../src/walkthrough/session.js';
import { PROJECT_STORAGE_KEY } from '../src/product-room/project-repository.js';
import { reviewInquiry } from '../src/product-room/project-domain.js';
import { sampleInquiryValues } from '../src/product-room/project-fixtures.js';
import { reviewQuote } from '../src/product-room/seller-domain.js';

const context = {productId:'kinetic-01',productTitle:'Crank-slider mechanism',modelId:'kinetic-01',modelRevision:'kinetic-r1',part:{id:'rod',title:'Connecting rod'}};
const firstId = 'WT-session-0001', secondId = 'WT-session-0002';
function setup(initial = []) {
  const data = new Map(initial), writes = [];
  const storage = {getItem:key=>data.get(key)??null,setItem:(key,value)=>{data.set(key,value);writes.push(key);}};
  let serial=0;
  const options = {storage,locks:null,now:()=> '2026-11-01T12:00:00.000Z',makeSessionId:()=>firstId,makeId:prefix=>`${prefix}-${++serial}`};
  return {data,storage,writes,options};
}

test('session links validate presence separately from malformed or duplicate identifiers',()=>{
  assert.equal(readWalkthroughSession(''),null);assert.equal(hasWalkthroughRequest(''),false);
  assert.equal(hasWalkthroughRequest('?walkthrough='),true);assert.equal(readWalkthroughSession('?walkthrough='),null);
  assert.equal(readWalkthroughSession('?walkthrough=../../projects'),null);
  assert.equal(readWalkthroughSession(`?walkthrough=${firstId}&walkthrough=${secondId}`),null);
  assert.equal(readWalkthroughSession(`?model=kinetic-01&walkthrough=${firstId}`),firstId);
  const link=withWalkthroughSession(new URL('https://example.com/explorer/product-room/?model=kinetic-01#project&project=PRJ-1'),firstId);
  assert.equal(link.searchParams.get('model'),'kinetic-01');assert.equal(link.hash,'#project&project=PRJ-1');
  assert.equal(readWalkthroughSession(link),firstId);
  assert.throws(()=>withWalkthroughSession(link,'bad'),{code:'WALKTHROUGH_SESSION_INVALID'});
  assert.throws(()=>createWalkthroughRepository(null),{code:'WALKTHROUGH_SESSION_INVALID'});
});

test('creating, resuming and restarting never write project records or delete earlier sessions',async()=>{
  const ordinary='untouched ordinary customer records', studio='untouched studio authoring';
  const {data,writes,options}=setup([[PROJECT_STORAGE_KEY,ordinary],['annora.studio.content.v1',studio]]);
  assert.equal(getWalkthroughSession(options),null);assert.equal(writes.length,0);
  const first=resumeWalkthroughSession(options);
  assert.equal(first.productId,WALKTHROUGH_PRODUCT_ID);assert.equal(first.id,firstId);
  assert.deepEqual(writes,[WALKTHROUGH_SESSION_KEY]);
  assert.deepEqual(resumeWalkthroughSession(options),first);assert.equal(writes.length,1);
  const repo=createWalkthroughRepository(first.id,options);const project=await repo.createSampleInquiry(context);
  const prior=data.get(repo.storageKey);
  const second=restartWalkthroughSession({...options,makeSessionId:()=>secondId});
  assert.equal(second.id,secondId);assert.equal(data.get(repo.storageKey),prior);
  assert.equal(data.get(PROJECT_STORAGE_KEY),ordinary);assert.equal(data.get('annora.studio.content.v1'),studio);
  assert.deepEqual(await createWalkthroughRepository(second.id,options).listProjects(),[]);
  assert.equal((await repo.getProject(project.id)).quotes.length,0);
  assert.throws(()=>createWalkthroughSession(options),{code:'WALKTHROUGH_SESSION_EXISTS'});
});

test('isolated buyer and seller share reviewed records without touching normal stores',async()=>{
  const {data,options}=setup([[PROJECT_STORAGE_KEY,'normal data must remain byte-identical']]);
  const buyer=createWalkthroughRepository(firstId,{...options,key:PROJECT_STORAGE_KEY});
  const seller=createWalkthroughRepository(firstId,options), other=createWalkthroughRepository(secondId,options);
  assert.equal(buyer.storageKey,walkthroughStorageKey(firstId));assert.ok(Object.isFrozen(buyer));
  let draft=await buyer.getDraft(context);draft.values=sampleInquiryValues();
  draft=await buyer.saveDraft(draft);
  assert.deepEqual(await buyer.listProjects(),[]);assert.deepEqual(await seller.listSellerProjects(),[]);
  const packet=reviewInquiry(draft);const project=await buyer.submitInquiry(packet);
  assert.equal((await seller.getSellerProject(project.id)).inquiry.reviewToken,packet.token);
  let pricing=await seller.getQuoteDraft(project.id);pricing.values.lineItems[0].unitPrice='185';pricing.values.lineItems[1].unitPrice='250';
  pricing=await seller.saveQuoteDraft(pricing);
  assert.equal((await buyer.getProject(project.id)).quotes.length,0);
  await assert.rejects(seller.issueQuote(pricing),{code:'STALE_REVIEW'});
  await seller.issueQuote(reviewQuote(await seller.getSellerProject(project.id),pricing));
  assert.equal((await buyer.getProject(project.id)).quotes.length,1);
  assert.deepEqual(await other.listProjects(),[]);
  assert.equal(data.get(PROJECT_STORAGE_KEY),'normal data must remain byte-identical');
});

test('invalid session data has explicit recovery without silent resets or real-store fallback',async()=>{
  const {data,writes,options}=setup([[WALKTHROUGH_SESSION_KEY,'{broken'],[PROJECT_STORAGE_KEY,'ordinary'],[walkthroughStorageKey(firstId),'{broken project']]);
  assert.throws(()=>getWalkthroughSession(options),{code:'WALKTHROUGH_SESSION_CORRUPT'});
  assert.throws(()=>resumeWalkthroughSession(options),{code:'WALKTHROUGH_SESSION_CORRUPT'});
  assert.equal(writes.length,0);
  await assert.rejects(createWalkthroughRepository(firstId,options).listProjects(),{code:'STORAGE_CORRUPT'});
  const session=restartWalkthroughSession({...options,makeSessionId:()=>secondId});
  assert.equal(session.id,secondId);assert.equal(data.get(walkthroughStorageKey(firstId)),'{broken project');
  assert.equal(data.get(PROJECT_STORAGE_KEY),'ordinary');
});

test('storage failure does not report a created session and read-only methods never seed a case',async()=>{
  const {writes,options}=setup();
  const repository=createWalkthroughRepository(firstId,options);
  await repository.listProjects();await repository.listDrafts();await repository.getDraft(context);
  assert.deepEqual(writes,[]);
  const unavailable={getItem:()=>null,setItem:()=>{throw new Error('quota exceeded');}};
  assert.throws(()=>createWalkthroughSession({...options,storage:unavailable}),{code:'WALKTHROUGH_STORAGE_UNAVAILABLE'});
  await assert.rejects(repository.getDraft({...context,productId:'apollo',modelId:'apollo'}),{code:'WALKTHROUGH_PRODUCT_INVALID'});
  assert.deepEqual(writes,[]);
});

test('presentation notifications happen only after successful mutations',async()=>{
  const {options}=setup(), events=[];
  const previous=Object.getOwnPropertyDescriptor(globalThis,'window');
  Object.defineProperty(globalThis,'window',{configurable:true,value:{dispatchEvent:event=>events.push(event)}});
  try {
    const repo=createWalkthroughRepository(firstId,options);
    await repo.listProjects();await repo.getDraft(context);assert.equal(events.length,0);
    const project=await repo.createSampleInquiry(context);
    assert.equal(events.length,1);assert.equal(events[0].type,'annora:walkthrough-change');
    assert.deepEqual(events[0].detail,{sessionId:firstId,method:'createSampleInquiry'});
    await assert.rejects(repo.issueQuote({}),{code:'STALE_REVIEW'});assert.equal(events.length,1);
    assert.equal((await repo.getProject(project.id)).quotes.length,0);
  } finally {
    if(previous)Object.defineProperty(globalThis,'window',previous);else delete globalThis.window;
  }
});
