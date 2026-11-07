import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOptionScopeDemo,loadOptionScopeDemo,OPTION_SCOPE_DEMO_ID,OPTION_SCOPE_DEMO_KEY } from '../../src/product-room/option-scope-demo.js';
import { PROJECT_STORAGE_KEY } from '../../src/product-room/project-repository.js';
import { reviewOptionPreference } from '../../src/product-room/option-scope-domain.js';
import { projectReturnURL } from '../../src/product-room/navigation.js';
import { sellerProjectStatus } from '../../src/product-room/project-state.js';
const params = extra => new URLSearchParams({optionDemo:OPTION_SCOPE_DEMO_ID,...extra});
const memory=()=>{const data=new Map();return {data,storage:{getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)}};};

test('public comparison fixture is deterministic, isolated and preserves confirmed preferences on return',async()=>{
  const local=memory();local.data.set(PROJECT_STORAGE_KEY,'unchanged ordinary projects');
  const fixture=await buildOptionScopeDemo(),entry=await loadOptionScopeDemo(params(),{storage:local.storage,locks:null});
  assert.equal(entry.projectId,fixture.projectId);assert.equal(entry.repository.mode,'options-demo');
  const original=await entry.repository.getProject(entry.projectId);
  assert.equal(sellerProjectStatus(original).owner,'Customer');
  assert.equal(sellerProjectStatus(original).label,'Preference needed');
  assert.equal(original.inquiry.requestItems.length,2);assert.equal(original.approvedOptionSet.options.length,2);assert.equal(original.quotes.length,0);
  const selected=await entry.repository.confirmOptionPreference(reviewOptionPreference(original,{choice:'option',optionId:'guided-handoff',notes:'Keep the original mounting questions.'}),{confirmed:true});
  assert.equal(sellerProjectStatus(selected).owner,'Seller');
  assert.equal(sellerProjectStatus(selected).label,'Preference confirmed');
  const reopened=await loadOptionScopeDemo(params(),{storage:local.storage,locks:null});
  assert.deepEqual(await reopened.repository.getProject(entry.projectId),selected);
  assert.deepEqual(selected.inquiry,original.inquiry);assert.equal(local.data.get(PROJECT_STORAGE_KEY),'unchanged ordinary projects');
  await assert.rejects(entry.repository.createSampleInquiry(original.context),{code:'OPTION_DEMO_UNAVAILABLE'});
  await assert.rejects(entry.repository.getDraft(original.context),{code:'OPTION_DEMO_UNAVAILABLE'});
  assert.deepEqual(await reopened.repository.getProject(entry.projectId),selected);
  assert.deepEqual(await buildOptionScopeDemo(),fixture);
});

test('invalid comparison link identities refuse to initialize or fall through to ordinary projects',async()=>{
  for(const query of ['optionDemo=unknown',`${params()}&optionDemo=${OPTION_SCOPE_DEMO_ID}`,`${params()}&project=other`,`${params()}&model=apollo`,`${params()}&release=other`,`${params()}&walkthrough=test`,`${params()}&followUpDemo=crank-review-v1`,`${params()}&followUp=old`,`${params()}&studioPreview=old`]){
    const local=memory();await assert.rejects(loadOptionScopeDemo(new URLSearchParams(query),{storage:local.storage,locks:null}),{code:'OPTION_DEMO_UNAVAILABLE'});assert.equal(local.data.size,0);
  }
  const local=memory();assert.equal(await loadOptionScopeDemo(new URLSearchParams(),{storage:local.storage}),null);assert.equal(local.data.size,0);
});

test('unreadable, unwritable and mismatched fixture state is preserved and reported',async()=>{
  await assert.rejects(loadOptionScopeDemo(params(),{storage:{getItem:()=>null,setItem:()=>{throw new Error('full');}},locks:null}),{code:'OPTION_DEMO_UNAVAILABLE'});
  const local=memory(),fixture=await buildOptionScopeDemo();fixture.store.projects[0].inquiry.values.company='Changed company';const encoded=JSON.stringify(fixture.store);local.data.set(OPTION_SCOPE_DEMO_KEY,encoded);
  await assert.rejects(loadOptionScopeDemo(params(),{storage:local.storage,locks:null}),{code:'OPTION_DEMO_UNAVAILABLE'});assert.equal(local.data.get(OPTION_SCOPE_DEMO_KEY),encoded);
});

test('part reference return keeps comparison namespace and role without leaking arbitrary query data',()=>{
  for(const role of ['buyer','seller']){
    const url=projectReturnURL({base:`https://example.org/explorer/product-room/?optionDemo=${OPTION_SCOPE_DEMO_ID}&requestItem=motion-detail&email=private`,projectId:'PRJ-OPTIONS-EXAMPLE-002',role});
    assert.equal(url.searchParams.get('optionDemo'),OPTION_SCOPE_DEMO_ID);assert.equal(url.searchParams.has('email'),false);assert.equal(url.searchParams.has('requestItem'),false);
    assert.match(url.pathname,role==='seller'?/studio\/$/:/product-room\/$/);
  }
});
