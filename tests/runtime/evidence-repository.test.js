import test from 'node:test';
import assert from 'node:assert/strict';
import {createEvidenceRepository,EVIDENCE_OBSERVATION_LIMIT,EVIDENCE_STORE_BYTE_LIMIT} from '../../src/product-room/evidence-repository.js';

const namespace='annora.test.project.v1',projectId='PRJ-TEST-001';
const source={productId:'crank-product',modelId:'crank',modelRevision:'rev-1',partId:'guide-1'};
const input=(operationId='open-1',extra={})=>({type:'reference.opened',projectId,projectRevision:1,operationId,role:'buyer',source,...extra});
function setup({mode='demo',storage,sessionStorage,...rest}={}) {
  const records=new Map([[namespace,'unchanged-business-store']]),sessions=new Map();let serial=0,time=0;
  storage ||= {getItem:key=>records.get(key)??null,setItem:(key,value)=>records.set(key,value)};
  sessionStorage ||= {getItem:key=>sessions.get(key)??null,setItem:(key,value)=>sessions.set(key,value)};
  const settings={key:namespace,mode,storage,sessionStorage,makeId:prefix=>`${prefix}-${++serial}`,now:()=>new Date(Date.UTC(2026,10,7,0,0,time++)).toISOString(),...rest};
  return {repo:createEvidenceRepository(settings),settings,records,sessions,storage,sessionStorage};
}

test('new history is unknown; first observation starts only an isolated local stream',async()=>{
  const env=setup(),empty=await env.repo.readProject(projectId);
  assert.equal(empty.status,'not-started');assert.equal(empty.coverage,'unknown');assert.equal(empty.sessionDenominator,null);assert.equal(empty.retainedCount,null);
  const first=await env.repo.recordObservation(input());assert.equal(first.recorded,true);assert.equal(first.status,'available');assert.equal(first.events.length,1);assert.equal(first.coverage,'partial');
  assert.equal(first.events[0].mode,'demo');assert.equal(first.sessionDenominator,null);assert.ok(first.collectionStartedAt);assert.equal(env.records.get(namespace),'unchanged-business-store');
  assert.notEqual(env.repo.storageKey,namespace);
});

test('same operation retries, parallel calls, reads and a same-tab reload do not duplicate observations',async()=>{
  const env=setup();const [first,second]=await Promise.all([env.repo.recordObservation(input()),env.repo.recordObservation(input())]);
  assert.equal(first.recorded,true);assert.equal(second.duplicate,true);assert.equal(second.recorded,false);
  const previous=env.records.get(env.repo.storageKey),reloaded=createEvidenceRepository(env.settings);
  assert.equal((await reloaded.recordObservation(input())).duplicate,true);assert.equal(env.records.get(env.repo.storageKey),previous);
  assert.equal((await reloaded.readProject(projectId)).events.length,1);
});

test('same operation identity with different content is rejected without replacing history',async()=>{
  const env=setup();await env.repo.recordObservation(input());const before=env.records.get(env.repo.storageKey);
  const result=await env.repo.recordObservation(input('open-1',{source:{...source,partId:'different-part'}}));
  assert.equal(result.reason,'operation-conflict');assert.equal(result.recorded,false);assert.equal(env.records.get(env.repo.storageKey),before);
});

test('sensitive input fields are dropped, exact source IDs survive, and caller cannot change provenance/session',async()=>{
  const env=setup();const result=await env.repo.recordObservation(input('privacy',{mode:'ordinary',sessionId:'caller-session',notes:'SECRET-NOTE',email:'secret@example.com',reviewToken:'SECRET-REVIEW',url:'https://secret.invalid',context:{modelId:'sk08',modelRevision:'model-A',productTitle:'SECRET-TITLE',part:{id:'bore',title:'SECRET-PART'},drawing:{id:'drawing',revision:'B',assetId:'asset-B',assetRevision:'sha-B',mappingRevision:'mapping-B',sheetId:'sheet-2',regionId:'bore-detail',url:'SECRET-URL'},inspection:{camera:'SECRET-CAMERA'}}}));
  assert.equal(result.recorded,true);assert.equal(result.events[0].mode,'demo');assert.notEqual(result.events[0].sessionId,'caller-session');
  assert.equal(result.events[0].source.drawingRevision,'B');assert.equal(result.events[0].source.regionId,'bore-detail');
  assert.doesNotMatch(env.records.get(env.repo.storageKey),/SECRET|secret@example|secret.invalid/);
});

test('unknown or malformed stored history is retained, never cleared or sanitized',async()=>{
  for(const raw of ['not-json',JSON.stringify({schemaVersion:99,events:[]}),JSON.stringify({schemaVersion:1,mode:'demo',startedAt:'2026-11-07T00:00:00Z',omittedCount:0,events:[],seen:[],notes:'do not erase'})]){
    const env=setup();env.records.set(env.repo.storageKey,raw);
    assert.equal((await env.repo.readProject(projectId)).status,'unavailable');assert.equal((await env.repo.recordObservation(input())).recorded,false);
    assert.equal(env.records.get(env.repo.storageKey),raw);assert.equal(env.records.get(namespace),'unchanged-business-store');
  }
});

test('denied or failed optional storage and session storage resolve status without touching business records',async()=>{
  for(const operation of ['getItem','setItem']){
    const env=setup();env.storage[operation]=()=>{throw Error('Denied');};
    await assert.doesNotReject(env.repo.recordObservation(input()));assert.equal((await env.repo.recordObservation(input())).status,'unavailable');
    assert.equal(env.records.get(namespace),'unchanged-business-store');
  }
  const env=setup({sessionStorage:{getItem(){throw Error('Denied');},setItem(){throw Error('Denied');}}});
  assert.equal((await env.repo.recordObservation(input())).status,'unavailable');assert.equal(env.records.get(env.repo.storageKey),undefined);
});

test('failed observation persistence recovers on retry and records the operation once',async()=>{
  const env=setup(),set=env.storage.setItem;let blocked=true;
  env.storage.setItem=(key,value)=>{if(blocked&&key===env.repo.storageKey)throw Error('Quota');return set(key,value);};
  assert.equal((await env.repo.recordObservation(input())).recorded,false);assert.equal((await env.repo.readProject(projectId)).status,'not-started');
  blocked=false;assert.equal((await env.repo.recordObservation(input())).recorded,true);assert.equal((await env.repo.recordObservation(input())).duplicate,true);
  assert.equal((await env.repo.readProject(projectId)).events.length,1);
});

test('bounded retention keeps recent observations, reports omitted global records, and deduplicates evicted retries',async()=>{
  const env=setup();
  for(let index=0;index<EVIDENCE_OBSERVATION_LIMIT+2;index++)assert.equal((await env.repo.recordObservation(input(`open-${index}`))).recorded,true);
  const result=await env.repo.readProject(projectId);assert.equal(result.events.length,EVIDENCE_OBSERVATION_LIMIT);assert.equal(result.omittedCount,2);assert.equal(result.retainedCount,200);
  assert.equal(result.events[0].operationId,'open-201');assert.equal(result.events.at(-1).operationId,'open-2');
  assert.equal((await env.repo.recordObservation(input('open-0'))).duplicate,true);assert.equal((await env.repo.readProject(projectId)).omittedCount,2);
  assert.ok(new TextEncoder().encode(env.records.get(env.repo.storageKey)).length<=EVIDENCE_STORE_BYTE_LIMIT);
});

test('same stream filters project records and cannot be reinterpreted under another mode',async()=>{
  const env=setup();await env.repo.recordObservation(input('one'));await env.repo.recordObservation(input('two',{projectId:'PRJ-OTHER'}));
  assert.equal((await env.repo.readProject(projectId)).events.length,1);assert.equal((await env.repo.readProject('PRJ-OTHER')).events.length,1);
  const different=createEvidenceRepository({...env.settings,mode:'presenter'}),before=env.records.get(env.repo.storageKey);
  assert.equal((await different.readProject(projectId)).status,'unavailable');assert.equal((await different.recordObservation(input('three'))).recorded,false);assert.equal(env.records.get(env.repo.storageKey),before);
});

test('invalid types, identifiers and hostile getters never escape the optional collection boundary',async()=>{
  const env=setup();
  for(const value of [input('hover',{type:'hover'}),input('rotation',{type:'camera.rotated'}),input('private',{projectId:'person@example.com'}),input('missing',{source:{modelId:'only'}}),new Proxy({},{get(){throw Error('hostile');}})]){
    await assert.doesNotReject(env.repo.recordObservation(value));assert.equal((await env.repo.recordObservation(value)).recorded,false);
  }
  assert.equal(env.records.get(env.repo.storageKey),undefined);
});

test('a competing optional write is not overwritten and is reported as incomplete evidence',async()=>{
  const env=setup();let reads=0;const get=env.storage.getItem;
  env.storage.getItem=key=>{if(key===env.repo.storageKey&&++reads===2){env.records.set(key,'other-tab-history');return'other-tab-history';}return get(key);};
  const result=await env.repo.recordObservation(input());assert.equal(result.recorded,false);assert.equal(result.reason,'concurrent-observation');assert.equal(env.records.get(env.repo.storageKey),'other-tab-history');assert.equal(env.records.get(namespace),'unchanged-business-store');
});

test('a valid empty collection has an explicit start and an unknown session denominator',async()=>{
  const env=setup();env.records.set(env.repo.storageKey,JSON.stringify({schemaVersion:1,mode:'demo',startedAt:'2026-11-07T00:00:00.000Z',omittedCount:0,events:[],seen:[]}));
  const result=await env.repo.readProject(projectId);assert.equal(result.status,'available');assert.equal(result.collectionStartedAt,'2026-11-07T00:00:00.000Z');assert.equal(result.sessionDenominator,null);assert.equal(result.coverage,'partial');
});

test('another tab keeps a separate observation identity without claiming another customer',async()=>{
  const env=setup();await env.repo.recordObservation(input());
  const data=new Map(),other=createEvidenceRepository({...env.settings,sessionStorage:{getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)}});
  const result=await other.recordObservation(input());assert.equal(result.recorded,true);assert.equal(result.events.length,2);assert.notEqual(result.events[0].sessionId,result.events[1].sessionId);assert.equal(result.sessionDenominator,null);
});
