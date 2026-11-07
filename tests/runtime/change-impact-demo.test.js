import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {buildChangeImpactDemo,loadChangeImpactDemo,changeImpactContext,CHANGE_IMPACT_DEMO_ID,CHANGE_IMPACT_DEMO_KEY,CHANGE_IMPACT_RELEASES} from '../../src/product-room/change-impact-demo.js';
import {PROJECT_STORAGE_KEY} from '../../src/product-room/project-repository.js';
import {reviewQuestionReopen} from '../../src/product-room/question-domain.js';
import {validatePublishedDrawingContext} from '../../src/product-room/drawing-revision.js';
import {projectReturnURL} from '../../src/product-room/navigation.js';
const params=extra=>new URLSearchParams({impactDemo:CHANGE_IMPACT_DEMO_ID,...extra});
const memory=()=>{const data=new Map();return {data,storage:{getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)}};};

test('prepared impact example has an A quotation, independent question sources, untouched ordinary data, and a working draft',async()=>{
 const local=memory();local.data.set(PROJECT_STORAGE_KEY,'ordinary-data');
 const fixture=await buildChangeImpactDemo(),entry=await loadChangeImpactDemo(params(),{storage:local.storage,locks:null});
 const project=await entry.repository.getSellerProject(entry.projectId);
 assert.equal(entry.repository.mode,'impact-demo');assert.equal(project.quotes.length,1);assert.equal(project.quoteDraft.previousQuoteId,project.quotes[0].id);
 assert.equal(project.inquiry.requestItems.length,3);assert.equal(project.questions.length,3);
 assert.deepEqual(project.questions.map(q=>q.events.at(-1).kind),['resolved','resolved','resolved']);
 assert.equal(project.questions[2].context.drawing,undefined);assert.equal(project.inquiry.requestItems[2].context.drawing,undefined);
 assert.equal(project.questions[0].context.drawing.regionId,'shaft-bore-detail');assert.equal(project.questions[1].context.drawing.regionId,'cross-bore-detail');
 assert.deepEqual(project.quoteDraft.context,project.context);assert.deepEqual(project.quotes[0].context,project.context);
 assert.equal(local.data.get(PROJECT_STORAGE_KEY),'ordinary-data');
 assert.deepEqual(await buildChangeImpactDemo(),fixture);
 await assert.rejects(entry.repository.createSampleInquiry(project.context),{code:'IMPACT_DEMO_UNAVAILABLE'});
 await assert.rejects(entry.repository.getDraft(project.context),{code:'IMPACT_DEMO_UNAVAILABLE'});
});

test('returning to the impact fixture preserves later activity without re-seeding original history',async()=>{
 const local=memory(),entry=await loadChangeImpactDemo(params(),{storage:local.storage,locks:null});let project=await entry.repository.getProject(entry.projectId);
 const originalQuote=structuredClone(project.quotes[0]);
 project=await entry.repository.confirmQuestionReopen(reviewQuestionReopen(project,{questionId:project.questions[0].id,authorRole:'buyer',body:'Review the source layout before the next quotation.'}),{confirmed:true});
 const reopened=await loadChangeImpactDemo(params(),{storage:local.storage,locks:null});
 assert.deepEqual(await reopened.repository.getProject(entry.projectId),project);assert.deepEqual(project.quotes[0],originalQuote);
});

test('example rejects mixed identities and storage failures without overwriting data',async()=>{
 for(const query of ['impactDemo=wrong',`${params()}&impactDemo=${CHANGE_IMPACT_DEMO_ID}`,`${params()}&project=wrong`,`${params()}&model=kinetic-01`,`${params()}&release=wrong`,`${params()}&walkthrough=old`,`${params()}&optionDemo=crank-options-v1`,`${params()}&followUpDemo=crank-review-v1`,`${params()}&studioPreview=other`]){
  const local=memory();await assert.rejects(loadChangeImpactDemo(new URLSearchParams(query),{storage:local.storage,locks:null}),{code:'IMPACT_DEMO_UNAVAILABLE'});assert.equal(local.data.size,0);
 }
 await assert.rejects(loadChangeImpactDemo(params(),{storage:{getItem:()=>null,setItem:()=>{throw Error('quota');}},locks:null}),{code:'IMPACT_DEMO_UNAVAILABLE'});
 const local=memory(),fixture=await buildChangeImpactDemo();fixture.store.projects[0].inquiry.values.company='Other';const raw=JSON.stringify(fixture.store);local.data.set(CHANGE_IMPACT_DEMO_KEY,raw);
 await assert.rejects(loadChangeImpactDemo(params(),{storage:local.storage,locks:null}),{code:'IMPACT_DEMO_UNAVAILABLE'});assert.equal(local.data.get(CHANGE_IMPACT_DEMO_KEY),raw);
});

test('A and B use actual retained PDFs and the same CAD source, with explicit different reference regions',async()=>{
 const [a,b]=CHANGE_IMPACT_RELEASES;
 assert.equal(a.modelRevision,b.modelRevision);assert.equal(a.packageSnapshot.assets.find(x=>x.kind==='step').sha256,b.packageSnapshot.assets.find(x=>x.kind==='step').sha256);
 assert.notEqual(a.sourceRevision,b.sourceRevision);
 for(const release of CHANGE_IMPACT_RELEASES){
  for(const asset of release.packageSnapshot.assets){const bytes=await readFile(new URL(`../../content/drawings/sk08/${asset.file}`,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);}
  for(const regionId of ['shaft-bore-detail','cross-bore-detail'])assert.deepEqual(validatePublishedDrawingContext(changeImpactContext(release,regionId),release),changeImpactContext(release,regionId));
 }
 assert.notDeepEqual(a.packageSnapshot.sheets[1].regions[0].bounds,b.packageSnapshot.sheets[1].regions[0].bounds);
 assert.match(b.packageSnapshot.statusNote,/Fictional document edition B/);assert.match(b.packageSnapshot.statusNote,/Geometry, fit, tolerances/);
});

test('part-reference return retains the impact namespace but not arbitrary private URL values',()=>{
 for(const role of ['buyer','seller']){const url=projectReturnURL({base:`https://example.org/annora/product-room/?impactDemo=${CHANGE_IMPACT_DEMO_ID}&email=private`,projectId:'PRJ-IMPACT-EXAMPLE-002',role});assert.equal(url.searchParams.get('impactDemo'),CHANGE_IMPACT_DEMO_ID);assert.equal(url.searchParams.has('email'),false);}
});
