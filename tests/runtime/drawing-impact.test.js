import test from 'node:test';
import assert from 'node:assert/strict';
import { buildChangeImpactDemo,CHANGE_IMPACT_RELEASES,changeImpactContext,CHANGE_IMPACT_DEMO_KEY } from '../../src/product-room/change-impact-demo.js';
import { createDemoProjectRepository,parseProjectStore } from '../../src/product-room/project-repository.js';
import { reviewQuote } from '../../src/product-room/seller-domain.js';
import { compareQuotes,reviewInquiry } from '../../src/product-room/project-domain.js';
import { reviewQuestion,adoptCurrentQuestions } from '../../src/product-room/question-domain.js';
import { createImpactScope,workingImpactReference,quoteImpactErrors,proposeDrawingImpact,reviewDrawingImpact } from '../../src/product-room/impact-domain.js';
import { assertDrawingImpactRoundTrip,assertImpactScopeRoundTrip,assertDrawingImpactRepository } from '../../src/product-room/impact-repository.js';
const copy=value=>structuredClone(value),a=CHANGE_IMPACT_RELEASES[0],b=CHANGE_IMPACT_RELEASES[1];
async function setup() {
  const fixture=await buildChangeImpactDemo(),data=new Map([[CHANGE_IMPACT_DEMO_KEY,JSON.stringify(fixture.store)]]);let blocked=false,serial=0,releases=copy(CHANGE_IMPACT_RELEASES);
  const storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>{if(blocked)throw Error('Quota');data.set(key,value);}};
  const repo=createDemoProjectRepository({key:CHANGE_IMPACT_DEMO_KEY,storage,locks:null,drawingWorkflow:true,requireDrawingImpact:true,getDrawingRelease:async id=>copy(releases.find(item=>item.id===id)),now:()=> '2026-11-06T22:00:00.000Z',makeId:prefix=>`${prefix}-TEST-${++serial}`});
  return {repo,storage,projectId:fixture.projectId,block:value=>{blocked=value;},releases:value=>{releases=value;}};
}
async function proposal(env) {return env.repo.proposeDrawingImpact(env.projectId,{releaseId:b.id,context:changeImpactContext(b)});}
function decisions(proposal,{retain=true,omit=false}={}) {
  return proposal.findings.map(finding=>({id:finding.id,decision:omit&&finding.kind==='scope'&&finding.recordId==='cross-bore-request'?'omitted':retain&&finding.kind==='question'&&finding.originalContext.drawing.regionId==='cross-bore-detail'?'retained':'confirmed',
    context:finding.candidateContext || finding.candidates[0],reason:'Seller inspected the exact document and retained the declared review scope.',
    lineIds:finding.kind==='scope' && !(omit&&finding.recordId==='cross-bore-request') ? [finding.recordId==='shaft-bore-request'?'bore-review':'cross-bore-review']:[]}));
}
async function reviewed(env,options) {const proposed=await proposal(env);return env.repo.reviewDrawingImpact(env.projectId,{releaseId:b.id,context:proposed.context,projectRevision:proposed.projectRevision,quoteDraft:proposed.quoteDraft,decisions:decisions(proposed,options),note:'Adopt the rearranged B document for the next quotation after checking each dependent reference.'});}

test('real SK08 A→B projects only four dependent references, preserving unrelated handoff and all original sources',async()=>{
  const env=await setup(),before=await env.repo.getProject(env.projectId),raw=env.storage.getItem(CHANGE_IMPACT_DEMO_KEY),p=await proposal(env);
  assert.equal(p.findings.length,4);assert.deepEqual(p.findings.map(item=>item.kind),['scope','scope','question','question']);
  assert.ok(p.findings.every(item=>item.classification==='changed' && item.fromContext.drawing.revision===a.sourceRevision && item.candidateContext.drawing.revision===b.sourceRevision));
  assert.ok(!p.findings.some(item=>item.recordId==='handoff-request'));assert.equal(env.storage.getItem(CHANGE_IMPACT_DEMO_KEY),raw);
  assert.deepEqual(await env.repo.getProject(env.projectId),before);
});

test('reviewing one project cannot mutate another project or its original A references',async()=>{
  const env=await setup(),first=await env.repo.getProject(env.projectId);
  let draft=await env.repo.getDraft(first.context);draft.values={...draft.values,...first.inquiry.values,company:'Another Fictional Buyer'};draft.requestItems=copy(first.inquiry.requestItems);
  draft=await env.repo.saveDraft(draft);const unrelated=await env.repo.submitInquiry(reviewInquiry(draft));
  await env.repo.confirmDrawingImpact(await reviewed(env),{confirmed:true});
  assert.deepEqual(await env.repo.getProject(unrelated.id),unrelated);
});

test('the opted-in impact demo cannot bypass per-record review using legacy project-wide adoption',async()=>{
  const env=await setup();await assert.rejects(env.repo.proposeDrawingRevision(env.projectId,{releaseId:b.id,context:changeImpactContext(b),note:'Try to skip individual impact checks.'}),{code:'IMPACT_REVIEW_REQUIRED'});
  const legacy=createDemoProjectRepository({key:CHANGE_IMPACT_DEMO_KEY,storage:env.storage,locks:null,drawingWorkflow:true,getDrawingRelease:async id=>copy(CHANGE_IMPACT_RELEASES.find(item=>item.id===id))});
  const oldReview=await legacy.reviewDrawingRevision(env.projectId,{releaseId:b.id,context:changeImpactContext(b),note:'Legacy proposal from another host.',quoteDraftAction:'keep'});
  await assert.rejects(env.repo.confirmDrawingRevision(oldReview,{confirmed:true}),{code:'IMPACT_REVIEW_REQUIRED'});
});

test('manual review is required for each mapping and actual quotation line; no write occurs at review',async()=>{
  const env=await setup(),p=await proposal(env),raw=env.storage.getItem(CHANGE_IMPACT_DEMO_KEY);
  for(const change of [d=>d.pop(),d=>{d[0].lineIds=[];},d=>{d[0].reason='';},d=>{d[0].lineIds=['missing'];},d=>{d[2].decision='omitted';},d=>{d[0].context={...d[0].context,modelRevision:'other'};}]) {
    const values=decisions(p);change(values);
    await assert.rejects(env.repo.reviewDrawingImpact(env.projectId,{...p,releaseId:b.id,decisions:values,note:'Review the new source.'}));
  }
  const r=await reviewed(env);assert.equal(env.storage.getItem(CHANGE_IMPACT_DEMO_KEY),raw);
  await assert.rejects(env.repo.confirmDrawingImpact(r),{code:'CONFIRMATION_REQUIRED'});
});

test('confirmed B working refs can retain one question on A, freeze v2 references, and never mutate A inquiry/discussion/v1',async()=>{
  const env=await setup(),before=await env.repo.getProject(env.projectId),r=await reviewed(env);let project=await env.repo.confirmDrawingImpact(r,{confirmed:true});
  assertDrawingImpactRoundTrip(r,project);assert.equal(project.activeDrawingContext.drawing.revision,b.sourceRevision);
  assert.equal(project.quoteDraft.impactScope.entries.length,4);assert.deepEqual(project.quoteDraft.values,r.quoteDraft.values);
  const retained=project.questions.find(question=>question.requestItemId==='cross-bore-request');
  assert.equal(workingImpactReference(project,'question',retained.id).context.drawing.revision,a.sourceRevision);
  assert.equal(workingImpactReference(project,'scope','cross-bore-request').context.drawing.revision,b.sourceRevision);
  assert.deepEqual(project.inquiry,before.inquiry);assert.deepEqual(project.questions,before.questions);assert.deepEqual(project.quotes,before.quotes);
  project=await env.repo.issueQuote(reviewQuote(project,project.quoteDraft));
  assert.equal(project.quotes.length,2);assert.equal(project.quotes[1].context.drawing.revision,b.sourceRevision);
  assert.deepEqual(project.quotes[1].questionScope,project.quotes[0].questionScope);
  assert.deepEqual(project.quotes[1].impactScope,createImpactScope(project));assert.deepEqual(project.quotes[0],before.quotes[0]);
  assert.ok(compareQuotes(project.quotes[0],project.quotes[1],project).filter(row=>row.key.startsWith('impact-')).every(row=>row.changed));
  assert.deepEqual((await env.repo.getProject(env.projectId)).quotes,project.quotes);
});

test('stale project or quotation draft invalidates review and confirmation; same confirm is idempotent',async()=>{
  const env=await setup(),p=await proposal(env),draft=await env.repo.getQuoteDraft(env.projectId);draft.values.scope+=' New draft note.';await env.repo.saveQuoteDraft(draft);
  await assert.rejects(env.repo.reviewDrawingImpact(env.projectId,{...p,releaseId:b.id,decisions:decisions(p),note:'Stale draft.'}),{code:'STALE_REVIEW'});
  const r=await reviewed(env),d2=await env.repo.getQuoteDraft(env.projectId);d2.values.validity='Modified in another tab';await env.repo.saveQuoteDraft(d2);
  await assert.rejects(env.repo.confirmDrawingImpact(r,{confirmed:true}),{code:'STALE_REVIEW'});
  const fresh=await reviewed(env),current=await env.repo.getProject(env.projectId);
  await env.repo.confirmQuestion(reviewQuestion(current,{requestItemId:'handoff-request',blocking:false,body:'A new unrelated question.'}),{confirmed:true});
  await assert.rejects(env.repo.confirmDrawingImpact(fresh,{confirmed:true}),{code:'STALE_REVIEW'});
  const final=await reviewed(env),saved=await env.repo.confirmDrawingImpact(final,{confirmed:true}),raw=env.storage.getItem(CHANGE_IMPACT_DEMO_KEY);
  assert.deepEqual(await env.repo.confirmDrawingImpact(final,{confirmed:true}),saved);assert.equal(env.storage.getItem(CHANGE_IMPACT_DEMO_KEY),raw);
});

test('ambiguous changed region IDs require an explicit inspected target rather than automatic approval',async()=>{
  const env=await setup(),project=await env.repo.getProject(env.projectId),draft=await env.repo.getQuoteDraft(env.projectId),ambiguous=copy(b);
  ambiguous.packageSnapshot.sheets.find(sheet=>sheet.id==='sheet-2').regions[0].id='new-bore-region';
  const p=proposeDrawingImpact(project,{},ambiguous,draft),finding=p.findings.find(item=>item.recordId==='shaft-bore-request');
  assert.equal(finding.classification,'ambiguous');assert.equal(finding.candidateContext,null);
  const d=decisions(p);delete d[0].context;assert.throws(()=>reviewDrawingImpact(p,{decisions:d,note:'Check manual match.'},'2026-11-06T22:00:00Z'));
  const good=decisions(p);assert.ok(reviewDrawingImpact(p,{decisions:good,note:'Human selected the exact new region.'},'2026-11-06T22:00:00Z').token);
});

test('a removed part association cannot be invented; missing candidates can only retain the exact previous source or exclude scoped work',async()=>{
  const env=await setup(),project=await env.repo.getProject(env.projectId),draft=await env.repo.getQuoteDraft(env.projectId),removed=copy(b);
  removed.partIds.push('other-published-body');
  for(const sheet of removed.packageSnapshot.sheets)for(const region of sheet.regions)region.partId='other-published-body';
  const p=proposeDrawingImpact(project,{},removed,draft);
  assert.equal(p.findings.length,4);assert.ok(p.findings.every(item=>item.classification==='missing' && !item.candidates.length && item.candidateContext===null));
  const d=decisions(p).map(item=>({...item,decision:'retained',context:null}));
  const r=reviewDrawingImpact(p,{decisions:d,note:'Retain the exact previous detail until a replacement is available.'},'2026-11-06T22:00:00Z');
  assert.ok(r.decisions.every(item=>item.context.drawing.revision===a.sourceRevision));
  d[0].decision='confirmed';d[0].context=p.context;
  assert.throws(()=>reviewDrawingImpact(p,{decisions:d,note:'Try to relabel another part.'},'2026-11-06T22:00:00Z'),{code:'IMPACT_REVIEW_REQUIRED'});
});

test('source changes between review and confirm fail closed; failure and retry preserve data and the reviewed decisions',async()=>{
  const env=await setup(),r=await reviewed(env),raw=env.storage.getItem(CHANGE_IMPACT_DEMO_KEY);
  env.releases([a,{...copy(b),version:b.version+1}]);await assert.rejects(env.repo.confirmDrawingImpact(r,{confirmed:true}),{code:'STALE_REVIEW'});assert.equal(env.storage.getItem(CHANGE_IMPACT_DEMO_KEY),raw);
  env.releases(copy(CHANGE_IMPACT_RELEASES));env.block(true);await assert.rejects(env.repo.confirmDrawingImpact(r,{confirmed:true}),{code:'STORAGE_UNAVAILABLE'});assert.equal(env.storage.getItem(CHANGE_IMPACT_DEMO_KEY),raw);
  env.block(false);const p=await env.repo.confirmDrawingImpact(r,{confirmed:true});assertDrawingImpactRoundTrip(r,p);
});

test('removed quoted lines remain editable but block issue until same-B scope mapping is reviewed and rebound',async()=>{
  const env=await setup();let project=await env.repo.confirmDrawingImpact(await reviewed(env,{retain:false}),{confirmed:true}),draft=project.quoteDraft;
  draft.values.lineItems=draft.values.lineItems.filter(line=>line.id!=='bore-review');draft=await env.repo.saveQuoteDraft(draft);
  assert.throws(()=>reviewQuote(project,draft),error=>Boolean(error.fields['impactScope.scope:request:shaft-bore-request']));
  const p=await proposal(env);assert.equal(p.findings.length,1);assert.equal(p.findings[0].id,'scope:request:shaft-bore-request');
  const r=await env.repo.reviewDrawingImpact(env.projectId,{...p,releaseId:b.id,decisions:[{id:p.findings[0].id,decision:'confirmed',context:p.findings[0].candidateContext,reason:'Reviewed combined reference work in the remaining review line.',lineIds:['cross-bore-review']}],note:'Rebind the scope to the retained quotation line.'});
  project=await env.repo.confirmDrawingImpact(r,{confirmed:true});assert.equal(project.drawingRevisions.length,1);assert.equal(project.impactReviews.length,2);
  project=await env.repo.issueQuote(reviewQuote(project,project.quoteDraft));assert.equal(project.quotes[1].impactScope.entries.find(item=>item.id==='scope:request:shaft-bore-request').lineIds[0],'cross-bore-review');
});

test('a new question about original A after B requires its own source decision; retained A decisions do not reappear for unchanged B',async()=>{
  const env=await setup();let project=await env.repo.confirmDrawingImpact(await reviewed(env),{confirmed:true});
  project=await env.repo.confirmQuestion(reviewQuestion(project,{requestItemId:'shaft-bore-request',blocking:false,body:'A new detail question on the original inquiry source.'}),{confirmed:true});
  const question=project.questions.at(-1);
  let draft=await env.repo.saveQuoteDraft(adoptCurrentQuestions(project,await env.repo.getQuoteDraft(project.id)));
  assert.throws(()=>reviewQuote(project,draft),error=>Boolean(error.fields[`impactScope.question:${question.id}`]));
  const p=await proposal(env);assert.equal(p.findings.length,1);assert.equal(p.findings[0].id,`question:${question.id}`);
  const r=await env.repo.reviewDrawingImpact(project.id,{...p,releaseId:b.id,decisions:[{id:p.findings[0].id,decision:'confirmed',context:p.findings[0].candidateContext,reason:'The new question was inspected against the current B detail.',lineIds:[]}],note:'Review only the newly added drawing-dependent question.'});
  project=await env.repo.confirmDrawingImpact(r,{confirmed:true});
  assert.equal(project.impactReviews.length,2);assert.equal(project.quoteDraft.impactScope.entries.length,5);
  assert.equal(project.questions.at(-1).context.drawing.revision,a.sourceRevision);
  assert.equal(workingImpactReference(project,'question',question.id).context.drawing.revision,b.sourceRevision);
  project=await env.repo.issueQuote(reviewQuote(project,project.quoteDraft));
  assert.equal(project.quotes[1].impactScope.entries.find(entry=>entry.kind==='question'&&entry.decision==='retained').context.drawing.revision,a.sourceRevision);
});

test('explicit scope exclusion retains a recorded reason and never removes question blockers',async()=>{
  const env=await setup();let project=await env.repo.confirmDrawingImpact(await reviewed(env,{omit:true}),{confirmed:true});
  assert.equal(project.quoteDraft.impactScope.entries.find(item=>item.id==='scope:request:cross-bore-request').context,null);
  assert.ok(project.quoteDraft.impactScope.entries.find(item=>item.id==='scope:request:cross-bore-request').reason);
  project=await env.repo.confirmQuestion(reviewQuestion(project,{requestItemId:'cross-bore-request',blocking:true,body:'A new scope-affecting question.'}),{confirmed:true});
  const draft=await env.repo.getQuoteDraft(env.projectId);assert.throws(()=>reviewQuote(project,draft));
});

test('load rejects mutated decisions, source, scope or quotation evidence and lossy adapters fail before UI installs them',async()=>{
  const env=await setup(),r=await reviewed(env),project=await env.repo.confirmDrawingImpact(r,{confirmed:true});
  const original=JSON.parse(env.storage.getItem(CHANGE_IMPACT_DEMO_KEY));
  for(const mutate of [s=>delete s.projects[0].impactPolicy,s=>s.projects[0].impactReviews=[],s=>delete s.projects[0].impactReviewIndex,s=>{s.projects[0].impactReviews[0].review.decisions[0].reason='Changed';},s=>{s.quoteDrafts[0].impactScope.entries[0].context.drawing.assetRevision='bad';},s=>delete s.quoteDrafts[0].impactScope]){
    const store=copy(original);mutate(store);assert.throws(()=>parseProjectStore(JSON.stringify(store)),{code:'STORAGE_CORRUPT'});
  }
  assertDrawingImpactRepository(env.repo);assert.throws(()=>assertDrawingImpactRepository({}),{code:'UNSUPPORTED_IMPACT'});
  assert.throws(()=>assertDrawingImpactRoundTrip(r,{...project,impactReviews:[]}),{code:'IMPACT_DATA_LOSS'});
  assert.throws(()=>assertImpactScopeRoundTrip(project.quoteDraft,{...project.quoteDraft,impactScope:undefined}),{code:'IMPACT_DATA_LOSS'});
  await assert.rejects(env.repo.proposeDrawingRevision(env.projectId,{releaseId:a.id,context:changeImpactContext(a),note:'Bypass per-record review.'}),{code:'IMPACT_REVIEW_REQUIRED'});
});
