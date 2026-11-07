import test from 'node:test';
import assert from 'node:assert/strict';
import {createProjectEvidenceController,evidenceModeForRepository} from '../../src/product-room/evidence-host.js';
import {createDemoProjectRepository} from '../../src/product-room/project-repository.js';
import {buildChangeImpactDemo,CHANGE_IMPACT_DEMO_KEY} from '../../src/product-room/change-impact-demo.js';
import {reviewQuestion} from '../../src/product-room/question-domain.js';
const memory=()=>{const data=new Map();return {data,getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};};
async function fixture(mode='impact-demo') {
 const f=await buildChangeImpactDemo(),storage=memory();storage.setItem(CHANGE_IMPACT_DEMO_KEY,JSON.stringify(f.store));
 const base=createDemoProjectRepository({key:CHANGE_IMPACT_DEMO_KEY,storage,locks:null});
 return {storage,projectId:f.projectId,repo:{...base,mode}};
}
test('origin scope is explicit and independent from viewing role; built-in scopes are isolated',()=>{
 const ordinary=createDemoProjectRepository({key:'ordinary-scope',locks:null});
 assert.deepEqual(ordinary.evidenceScope,{schemaVersion:1,namespace:'ordinary-scope',storage:'browser-local'});
 assert.equal(evidenceModeForRepository(ordinary),'ordinary');
 assert.equal(evidenceModeForRepository({...ordinary,mode:'impact-demo'}),'demo');
 assert.equal(evidenceModeForRepository({...ordinary,mode:'walkthrough'}),'presenter');
 assert.equal(evidenceModeForRepository({mode:'walkthrough'}),'unknown');
 assert.equal(evidenceModeForRepository({...ordinary,mode:'preview'}),'unknown');
 assert.ok(Object.isFrozen(ordinary.evidenceScope));
});
test('optional collection failure cannot block a reviewed question or invent confirmed evidence',async()=>{
 const {repo,projectId}=await fixture();
 const controller=createProjectEvidenceController({repository:repo,observations:{readProject:()=>{throw Error('unavailable');},recordObservation:()=>Promise.reject(Error('quota'))}});
 let p=await repo.getProject(projectId),before=await controller.read(projectId);
 assert.equal(before.status,'available');assert.equal(before.observations.status,'unavailable');
 const observed=await controller.observe(p,{type:'quotation.opened',role:'buyer',record:{kind:'quotation',id:p.quotes[0].id}});
 assert.equal(observed.recorded,false);
 const review=reviewQuestion(p,{requestItemId:'handoff-request',body:'Can the handoff be reviewed?',blocking:false});
 assert.equal((await controller.read(projectId)).report.counts.available,before.report.counts.available);
 p=await repo.confirmQuestion(review,{confirmed:true});
 const after=await controller.read(projectId);assert.equal(after.report.counts.available,before.report.counts.available+1);
 assert.equal(after.report.counts.byType['question.opened'],4);
 await repo.confirmQuestion(review,{confirmed:true});assert.deepEqual((await controller.read(projectId)).report,after.report);
});
test('explicit observations use safe pinned sources, survive reload and leave commercial storage untouched',async()=>{
 const {repo,projectId,storage}=await fixture(),p=await repo.getProject(projectId),sessions=memory();
 const raw=storage.getItem(CHANGE_IMPACT_DEMO_KEY);
 const first=createProjectEvidenceController({repository:repo,storage,sessionStorage:sessions});
 const event={type:'quotation.opened',role:'buyer',operationId:'OP-one',context:p.quotes[0].context,record:{kind:'quotation',id:p.quotes[0].id,quoteVersion:1}};
 assert.equal((await first.observe(p,event)).recorded,true);
 const second=createProjectEvidenceController({repository:repo,storage,sessionStorage:sessions});
 assert.equal((await second.observe(p,event)).duplicate,true);
 const result=await second.read(projectId);assert.equal(result.observations.events.length,1);assert.equal(result.observations.events[0].mode,'demo');
 assert.equal(result.observations.events[0].source.drawingRevision,p.quotes[0].context.drawing.revision);
 assert.equal(storage.getItem(CHANGE_IMPACT_DEMO_KEY),raw);
 for(const forbidden of ['Alex','Example Motion','email','reviewToken','notes','scopeSelection','camera'])assert.ok(!JSON.stringify(result).includes(forbidden),forbidden);
});
test('unknown external capabilities and inaccessible history remain explicit without invented records',async()=>{
 const {repo,projectId}=await fixture();
 const external=createProjectEvidenceController({repository:{getProject:id=>repo.getProject(id)}});
 const result=await external.read(projectId);assert.equal(result.report.mode,'unknown');assert.equal(result.observations.status,'unsupported');
 const bad=createProjectEvidenceController({repository:{getProject:()=>{throw Error('offline');}}});
 assert.deepEqual((await bad.read(projectId)).report,null);
 assert.equal((await external.observe(null,{})).recorded,false);
});
