import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WALKTHROUGH_SESSION_KEY, INDEPENDENT_WALKTHROUGH_SESSION_KEY, WALKTHROUGH_PRODUCT_ID, hasWalkthroughRequest,
  readWalkthroughSession, walkthroughStorageKey, withWalkthroughSession,
  createWalkthroughSession, getWalkthroughSession, resumeWalkthroughSession,
  restartWalkthroughSession, createWalkthroughRepository, walkthroughViewer,
} from '../src/walkthrough/session.js';
import { PROJECT_STORAGE_KEY } from '../src/product-room/project-repository.js';
import { reviewInquiry } from '../src/product-room/project-domain.js';
import { sampleInquiryValues } from '../src/product-room/project-fixtures.js';
import { reviewQuote } from '../src/product-room/seller-domain.js';

const context = {productId:'kinetic-01',productTitle:'Crank-slider mechanism',modelId:'kinetic-01',modelRevision:'kinetic-r1',part:{id:'rod',title:'Connecting rod'}};
const externalContext = {...context,productRevision:'independent-viewer-product-v1',viewerReference:{version:'1',
  adapter:{id:'annora-example-three-viewer',version:'1',coordinateFrame:'source-meters-y-up-v1'},
  product:{id:context.productId,revision:'independent-viewer-product-v1'},model:{id:context.modelId,revision:context.modelRevision},
  snapshot:{selectedPartId:'rod',camera:{position:[2,3,8],target:[0,0,0]}}}};
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

test('independent viewer sessions resume separately and never replace the existing walkthrough pointer',async()=>{
  const {data,writes,options}=setup([[PROJECT_STORAGE_KEY,'ordinary customer records']]);
  const native=resumeWalkthroughSession(options), nativePointer=data.get(WALKTHROUGH_SESSION_KEY);
  const independentOptions={...options,viewer:'independent',makeSessionId:()=> 'WTI-independent-0001'};
  assert.equal(getWalkthroughSession(independentOptions),null);
  const independent=resumeWalkthroughSession(independentOptions);
  assert.equal(independent.viewer,'independent');assert.equal(walkthroughViewer(independent.id),'independent');
  assert.equal(walkthroughViewer(native.id),'explorer');assert.equal(readWalkthroughSession(`?walkthrough=${independent.id}`),independent.id);
  assert.equal(walkthroughStorageKey(independent.id),'annora.walkthrough.independent.projects.v1.WTI-independent-0001');
  assert.deepEqual(writes,[WALKTHROUGH_SESSION_KEY,INDEPENDENT_WALKTHROUGH_SESSION_KEY]);
  assert.deepEqual(resumeWalkthroughSession(options),native);
  assert.deepEqual(resumeWalkthroughSession(independentOptions),independent);
  assert.equal(data.get(WALKTHROUGH_SESSION_KEY),nativePointer);
  const repository=createWalkthroughRepository(independent.id,{...options,key:PROJECT_STORAGE_KEY});
  assert.equal(repository.storageKey,walkthroughStorageKey(independent.id));
  const project=await repository.createSampleInquiry(externalContext), prior=data.get(repository.storageKey);
  const next=restartWalkthroughSession({...independentOptions,makeSessionId:()=> 'WTI-independent-0002'});
  assert.equal(next.viewer,'independent');assert.equal(data.get(repository.storageKey),prior);
  assert.equal((await createWalkthroughRepository(independent.id,options).getProject(project.id)).id,project.id);
  assert.deepEqual(await createWalkthroughRepository(next.id,options).listProjects(),[]);
  assert.deepEqual(await createWalkthroughRepository(native.id,options).listProjects(),[]);
  assert.equal(data.get(WALKTHROUGH_SESSION_KEY),nativePointer);
  assert.equal(data.get(PROJECT_STORAGE_KEY),'ordinary customer records');
});

test('session modes reject wrong prefixes and mismatched saved metadata without storage writes',()=>{
  const {data,writes,options}=setup();
  assert.throws(()=>createWalkthroughSession({...options,viewer:'unknown'}),{code:'WALKTHROUGH_SESSION_INVALID'});
  assert.throws(()=>createWalkthroughSession({...options,viewer:'independent'}),{code:'WALKTHROUGH_SESSION_INVALID'});
  assert.throws(()=>createWalkthroughSession({...options,makeSessionId:()=> 'WTI-independent-0001'}),{code:'WALKTHROUGH_SESSION_INVALID'});
  assert.throws(()=>walkthroughViewer('not-a-session'),{code:'WALKTHROUGH_SESSION_INVALID'});
  assert.equal(writes.length,0);
  const native=createWalkthroughSession(options);
  data.set(INDEPENDENT_WALKTHROUGH_SESSION_KEY,JSON.stringify(native));
  assert.throws(()=>getWalkthroughSession({...options,viewer:'independent'}),{code:'WALKTHROUGH_SESSION_CORRUPT'});
  data.set(INDEPENDENT_WALKTHROUGH_SESSION_KEY,JSON.stringify({...native,id:'WTI-independent-0001'}));
  assert.throws(()=>getWalkthroughSession({...options,viewer:'independent'}),{code:'WALKTHROUGH_SESSION_CORRUPT'});
  assert.deepEqual(getWalkthroughSession(options),native);assert.equal(writes.length,1);
});

test('independent buyer and seller preserve external references and require the same review gates',async()=>{
  const {data,options}=setup([[PROJECT_STORAGE_KEY,'existing projects'],['annora.integration-example.projects.v1','existing independent example']]);
  const id='WTI-independent-0001', buyer=createWalkthroughRepository(id,options), seller=createWalkthroughRepository(id,options);
  const external=externalContext;
  const draft=await buyer.saveDraft({...await buyer.getDraft(external),values:sampleInquiryValues()});
  await assert.rejects(buyer.submitInquiry(draft),{code:'STALE_REVIEW'});
  assert.deepEqual(await seller.listSellerProjects(),[]);
  let project=await buyer.submitInquiry(reviewInquiry(draft));
  const originalInquiry=structuredClone(project.inquiry);
  for (let version=1;version<=2;version++) {
    let quote=await seller.getQuoteDraft(project.id);
    quote.values.scope=`Reviewed mounting scope, version ${version}.`;
    quote=await seller.saveQuoteDraft(quote);
    await assert.rejects(seller.issueQuote(quote),{code:'STALE_REVIEW'});
    assert.equal((await buyer.getProject(project.id)).quotes.length,version-1);
    project=await seller.issueQuote(reviewQuote(await seller.getSellerProject(project.id),quote));
    assert.equal(project.quotes.length,version);
    assert.deepEqual(project.quotes.at(-1).context,external);
  }
  const reloaded=await createWalkthroughRepository(id,options).getProject(project.id);
  assert.deepEqual(reloaded.inquiry,originalInquiry);
  assert.deepEqual(reloaded.quotes.map(quote=>quote.context.viewerReference),[external.viewerReference,external.viewerReference]);
  assert.equal(data.get(PROJECT_STORAGE_KEY),'existing projects');
  assert.equal(data.get('annora.integration-example.projects.v1'),'existing independent example');
});

test('independent inquiry contexts fail closed before writing a native or unreferenced case',async()=>{
  const {writes,options}=setup(), repository=createWalkthroughRepository('WTI-independent-0001',options);
  await assert.rejects(repository.getDraft(context),{code:'WALKTHROUGH_REFERENCE_REQUIRED'});
  await assert.rejects(repository.createSampleInquiry(context),{code:'WALKTHROUGH_REFERENCE_REQUIRED'});
  const nativeDraft=await createWalkthroughRepository(firstId,options).getDraft(context);
  nativeDraft.values=sampleInquiryValues();
  await assert.rejects(repository.saveDraft(nativeDraft),{code:'WALKTHROUGH_REFERENCE_REQUIRED'});
  await assert.rejects(repository.submitInquiry(reviewInquiry({...nativeDraft,revision:1})),{code:'WALKTHROUGH_REFERENCE_REQUIRED'});
  const externalDraft=await repository.getDraft(externalContext);
  externalDraft.requestItems=[{id:'ITEM-1',context,notes:'Native reference must not enter the independent demonstration.'}];
  await assert.rejects(repository.saveDraft(externalDraft),{code:'WALKTHROUGH_REFERENCE_REQUIRED'});
  assert.deepEqual(writes,[]);assert.deepEqual(await repository.listProjects(),[]);
  assert.deepEqual((await createWalkthroughRepository(firstId,options).getDraft(context)).context,context);
});
