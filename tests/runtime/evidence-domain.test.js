import test from 'node:test';
import assert from 'node:assert/strict';
import { projectEvidence, safeEvidenceSource, normalizeEvidenceObservation } from '../../src/product-room/evidence-domain.js';
import { buildChangeImpactDemo, CHANGE_IMPACT_DEMO_KEY, CHANGE_IMPACT_RELEASES, changeImpactContext } from '../../src/product-room/change-impact-demo.js';
import { createDemoProjectRepository } from '../../src/product-room/project-repository.js';
import { reviewQuestion } from '../../src/product-room/question-domain.js';
import { reviewQuote } from '../../src/product-room/seller-domain.js';
const copy = value => structuredClone(value);
const context = {productId:'test-product', modelId:'test-model', modelRevision:'sha256:1234', roomReleaseId:'ROOM-1',part:{id:'bearing',title:'SECRET PART'},
  drawing:{id:'DRAW-1',revision:'A',assetId:'PDF-1',assetRevision:'hash-1',sheetId:'sheet-1',regionId:'bore-1',mappingRevision:'MAP-1',presentationRevision:'OVERVIEW-1',title:'SECRET DRAWING',sourceURL:'https://secret.test/file.pdf'},
  document:{id:'DOC-1',revision:'1',title:'SECRET DOC'},inspection:{camera:'SECRET CAMERA'},roomSnapshot:{contact:'SECRET SNAPSHOT'}};
const when='2026-11-06T22:00:00.000Z';
async function setup() {
  const fixture=await buildChangeImpactDemo(),data=new Map([[CHANGE_IMPACT_DEMO_KEY,JSON.stringify(fixture.store)]]);let blocked=false,serial=0;
  const storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>{if(blocked)throw Error('Quota');data.set(key,value);}};
  const repo=createDemoProjectRepository({key:CHANGE_IMPACT_DEMO_KEY,storage,locks:null,drawingWorkflow:true,requireDrawingImpact:true,getDrawingRelease:async id=>copy(CHANGE_IMPACT_RELEASES.find(item=>item.id===id)),now:()=>when,makeId:prefix=>`${prefix}-EVIDENCE-${++serial}`});
  return {repo,storage,projectId:fixture.projectId,block:value=>{blocked=value;}};
}
const makeObservation = () => ({type:'reference.opened',projectId:'PRJ-1',sessionId:'SESSION-1',operationId:'OP-1',role:'buyer',mode:'demo',occurredAt:when,projectRevision:3,source:safeEvidenceSource(context),record:{kind:'reference',id:'bore-1'}});

test('allowlisted evidence excludes source titles, URLs, typed fields, prices and serialized review tokens',async()=>{
  const env=await setup(),project=await env.repo.getProject(env.projectId);
  const before=JSON.stringify(project);project.context={...project.context,...context};
  project.inquiry.values={name:'SECRET NAME',email:'private@example.test',notes:'SECRET NOTE'};
  project.inquiry.reviewToken='SECRET FULL PAYLOAD';project.quotes[0].unitPrice=987654.32;
  const report=projectEvidence(project,{mode:'demo'}),encoded=JSON.stringify(report);
  for(const prohibited of ['SECRET','private@example.test','987654.32','reviewToken','sourceURL','unitPrice','roomSnapshot','camera'])assert.equal(encoded.includes(prohibited),false,prohibited);
  assert.equal(report.coverage.history,'available');assert.equal(report.counts.total,11);
  assert.deepEqual(safeEvidenceSource(context),{productId:'test-product',modelId:'test-model',modelRevision:'sha256:1234',roomReleaseId:'ROOM-1',partId:'bearing',documentId:'DOC-1',documentRevision:'1',drawingId:'DRAW-1',drawingRevision:'A',drawingAssetId:'PDF-1',drawingAssetRevision:'hash-1',mappingRevision:'MAP-1',overviewRevision:'OVERVIEW-1',sheetId:'sheet-1',regionId:'bore-1'});
  assert.equal(env.storage.getItem(CHANGE_IMPACT_DEMO_KEY).includes('SECRET FULL PAYLOAD'),false);
  assert.notEqual(JSON.stringify(project),before); // test changes are input-only, not written into the repository.
});

test('reads and repeated confirmed operations never double-count; reviews and failed saves are absent',async()=>{
  const env=await setup(),project=await env.repo.getProject(env.projectId),before=projectEvidence(project,{mode:'demo'});
  const review=reviewQuestion(project,{requestItemId:'handoff-request',body:'Another saved question',blocking:false});
  assert.deepEqual(projectEvidence(await env.repo.getProject(env.projectId),{mode:'demo'}),before);
  env.block(true);await assert.rejects(env.repo.confirmQuestion(review,{confirmed:true}));
  assert.deepEqual(projectEvidence(await env.repo.getProject(env.projectId),{mode:'demo'}),before);
  env.block(false);await env.repo.confirmQuestion(review,{confirmed:true});
  const after=projectEvidence(await env.repo.getProject(env.projectId),{mode:'demo'});
  await env.repo.confirmQuestion(review,{confirmed:true});
  assert.deepEqual(projectEvidence(await env.repo.getProject(env.projectId),{mode:'demo'}),after);
  assert.equal(after.counts.available,before.counts.available+1);assert.equal(after.counts.byType['question.opened'],4);
  assert.equal(after.summary.pendingBlockingQuestions,0);
});

test('mode is explicit origin provenance, never inferred from buyer role or fixture names',async()=>{
  const env=await setup(),project=await env.repo.getProject(env.projectId);
  for(const mode of ['demo','presenter','ordinary','unknown'])assert.ok(projectEvidence(project,{mode}).events.every(event=>event.mode===mode));
  assert.ok(projectEvidence(project).events.every(event=>event.mode==='unknown'));
  assert.equal(projectEvidence(project,{mode:'buyer'}).mode,'unknown');
  assert.ok(projectEvidence(project,{mode:'presenter'}).events.some(event=>event.role==='buyer'));
});

test('impact is one operation; original inquiry/questions/quote keep A while reviewed v2 uses B',async()=>{
  const env=await setup(),b=CHANGE_IMPACT_RELEASES[1],p=await env.repo.proposeDrawingImpact(env.projectId,{releaseId:b.id,context:changeImpactContext(b)});
  const decisions=p.findings.map(finding=>({id:finding.id,decision:'confirmed',context:finding.candidateContext,reason:'Inspect and adopt B explicitly.',lineIds:finding.kind==='scope'?[finding.recordId==='shaft-bore-request'?'bore-review':'cross-bore-review']:[]}));
  const review=await env.repo.reviewDrawingImpact(env.projectId,{...p,releaseId:b.id,decisions,note:'Review the new source.'});
  let project=await env.repo.confirmDrawingImpact(review,{confirmed:true});project=await env.repo.issueQuote(reviewQuote(project,project.quoteDraft));
  const report=projectEvidence(project,{mode:'demo'});
  assert.equal(report.counts.byType['drawing-impact.confirmed'],1);assert.equal(report.counts.byType['drawing-reference.adopted'],undefined);
  assert.equal(report.counts.byType['quotation.issued'],2);assert.equal(report.summary.latestQuoteVersion,2);
  assert.equal(report.events.find(event=>event.type==='quotation.issued'&&event.record.quoteVersion===2).source.drawingRevision,b.sourceRevision);
  assert.equal(report.events.find(event=>event.type==='quotation.issued'&&event.record.quoteVersion===1).source.drawingRevision,CHANGE_IMPACT_RELEASES[0].sourceRevision);
  assert.ok(report.events.filter(event=>event.type.startsWith('question.')&&event.source.drawingRevision).every(event=>event.source.drawingRevision===CHANGE_IMPACT_RELEASES[0].sourceRevision));
  assert.equal(report.summary.lastAction.type,'quotation.issued');
});

test('sample quotes stay distinct from reviewed issued quotes and historical source never uses active context',async()=>{
  const env=await setup(),p=await env.repo.getProject(env.projectId);
  p.quotes=[{id:'SAMPLE-Q',version:1,source:'sample',createdAt:'2026-11-06T23:00:00.000Z'}];
  p.activeDrawingContext={...p.context,drawing:{...p.context.drawing,revision:'B'}};
  const report=projectEvidence(p,{mode:'demo'});
  assert.equal(report.counts.byType['quotation.issued'],undefined);assert.equal(report.counts.byType['quotation.sample-created'],1);
  assert.equal(report.summary.availableDenominators.issuedQuotations,0);
  assert.equal(report.summary.lastAction.type,'quotation.sample-created');
  assert.equal(report.summary.lastAction.source.drawingRevision,p.context.drawing.revision);
});

test('missing or incomplete history is unknown, not a zero denominator or a fabricated rate',async()=>{
  const empty=projectEvidence(null);assert.equal(empty.coverage.history,'unavailable');assert.equal(empty.counts.total,null);assert.equal(empty.summary.availableDenominators.savedProjects,null);
  const env=await setup(),p=await env.repo.getProject(env.projectId);delete p.questions;delete p.questionPolicy;
  const legacy=projectEvidence(p,{mode:'ordinary'});assert.equal(legacy.summary.questionCount,null);assert.equal(legacy.summary.availableDenominators.viewingSessions,null);
  delete p.quotes;const missing=projectEvidence(p,{mode:'ordinary'});assert.equal(missing.coverage.history,'partial');assert.equal(missing.counts.total,null);assert.equal(missing.summary.availableDenominators.issuedQuotations,null);
  assert.ok(missing.coverage.missing.includes('quotes-unavailable'));assert.equal(JSON.stringify(missing).includes('conversion'),false);
});

test('bounded output preserves available record counts and stable identity; conflicting IDs are withheld',async()=>{
  const env=await setup(),p=await env.repo.getProject(env.projectId),report=projectEvidence(p,{mode:'demo',limit:3});
  assert.equal(report.events.length,3);assert.equal(report.counts.total,11);assert.equal(report.coverage.omittedCount,8);
  const event=p.questions[0].events[0];p.questions[0].events.push(copy(event));
  const dedup=projectEvidence(p);assert.equal(dedup.counts.available,11);
  p.questions[0].events.push({...copy(event),createdAt:'2026-11-06T23:00:00.000Z'});p.questions[0].events.push(copy(event));
  const conflict=projectEvidence(p);assert.equal(conflict.counts.total,null);assert.ok(conflict.coverage.missing.includes('conflicting-operation'));assert.ok(!conflict.events.some(item=>item.id===`question.opened:${event.id}`));
});

test('optional observations are bounded safe envelopes, not confirmed operations or implied interest',()=>{
  const input={...makeObservation(),notes:'SECRET NOTES',email:'private@example.test',reviewToken:'SECRET REVIEW',source:{...safeEvidenceSource(context),sourceURL:'https://private.test/secret'}};
  const one=normalizeEvidenceObservation(input),two=normalizeEvidenceObservation(input);
  assert.deepEqual(one,two);assert.notEqual(normalizeEvidenceObservation({...makeObservation(),sessionId:'a:b',operationId:'c'}).id,normalizeEvidenceObservation({...makeObservation(),sessionId:'a',operationId:'b:c'}).id);assert.equal(one.stream,'observation');assert.equal(one.id,'observation:9:SESSION-1:4:OP-1');assert.equal(JSON.stringify(one).includes('SECRET'),false);assert.equal(JSON.stringify(one).includes('private'),false);
  for(const override of [{type:'hover'},{type:'quotation.issued'},{mode:'customer'},{role:'admin'},{schemaVersion:2},{stream:'confirmed'},{projectId:'private@example.test'},{occurredAt:'not-a-date'},{operationId:'x'.repeat(321)},{projectRevision:0},{source:{}},{record:{kind:'raw',id:'x'}}])assert.equal(normalizeEvidenceObservation({...makeObservation(),...override}),null);
});
