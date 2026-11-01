import test from 'node:test';
import assert from 'node:assert/strict';
import { createDrawingRepository } from '../../src/studio/drawing-repository.js';
import { confirmDrawingPairing } from '../../src/studio/drawing-domain.js';
import { createDrawingProjectRepository, DRAWING_PROJECT_STORAGE_KEY } from '../../src/product-room/drawing-inquiry.js';
import { createDrawingContext } from '../../src/drawing-preview/context.js';
import { reviewInquiry, reviewRevision, reviewNextStep, compareQuotes } from '../../src/product-room/project-domain.js';
import { reviewQuote, reviewReply, reviewCustomerReply, reviewAcknowledgement } from '../../src/product-room/seller-domain.js';
import { parseProjectStore } from '../../src/product-room/project-repository.js';
import { projectDrawingContext, recordContext } from '../../src/product-room/drawing-revision.js';
import { sampleInquiryValues } from '../../src/product-room/project-fixtures.js';

const copy=structuredClone;
function source(revision='A',hash='a'){
 return {id:'bearing',model:{id:'bearing',title:'Bearing housing fixture',revision:'model-1',parts:[{id:'body',title:'Housing body'}]},package:{
  schemaVersion:2,id:'bearing-drawing',modelId:'bearing',modelRevision:'model-1',title:'Housing reference fixture',revision,mappingRevision:'source-map-'+revision,
  sourceURL:'https://example.org/test-fixtures/bearing/'+revision,units:'mm',status:'unreviewed-reference',pairing:{status:'source-derived',evidence:'Test source pairing; no manufacturer engineering claim.'},
  assets:[{id:'pdf',kind:'pdf',file:'drawing.pdf',sha256:hash.repeat(64)},{id:'step',kind:'step',file:'body.step',sha256:'b'.repeat(64)}],
  sheets:[{id:'sheet-1',title:'Housing detail',assetId:'pdf',format:'pdf',pdfPage:1,viewBox:[0,0,400,300],coordinateFrame:'page-top-left',rotation:0,
   regions:[{id:'bore',label:'Bore detail '+revision,partId:'body',bounds:[20,20,100,100],mappingStatus:'confirmed'}]}]
 }};
}
async function fixture(){
 const data=new Map();let serial=0;
 const options={storage:{getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)},locks:null,now:()=> '2026-11-01T12:00:00Z',makeId:prefix=>`${prefix}-${++serial}`};
 const publish=async(entry,human=true)=>{const repo=createDrawingRepository({...options,packages:[entry]});let draft=await repo.getDraft();if(human)draft=confirmDrawingPairing(draft,entry,'A reviewer checked this exact test model and PDF source version.');draft=await repo.saveDraft(draft);return repo.publishReviewed(await repo.reviewDraft(draft),{confirmed:true});};
 const a=source(),b=source('B','c'),releaseA=await publish(a),releaseB=await publish(b);
 const drawingRepo=createDrawingRepository({...options,packages:[b]});
 const context=release=>createDrawingContext({drawing:release.packageSnapshot,sheetId:'sheet-1',regionId:'bore',modelRevision:release.modelRevision,model:b.model});
 const contextA=context(releaseA),contextB=context(releaseB),repo=createDrawingProjectRepository({...options,getDrawingRelease:id=>drawingRepo.getRelease(id)});
 let draft=await repo.getDraft(contextA);draft.values=sampleInquiryValues(contextA);draft=await repo.saveDraft(draft);
 let project=await repo.submitInquiry(reviewInquiry(draft));
 return {data,options,repo,drawingRepo,publish,context,contextA,contextB,releaseA,releaseB,project};
}
async function issue(repo,project){let draft=await repo.getQuoteDraft(project.id);draft.values.lineItems[0].unitPrice='120';draft=await repo.saveQuoteDraft(draft);return repo.issueQuote(reviewQuote(await repo.getSellerProject(project.id),draft));}
const input=f=>({context:f.contextB,releaseId:f.releaseB.id,note:'Use the explicitly reviewed B source for the next quotation.'});

test('same drawing project adopts reviewed B, quotation v2 pins B, prior quote and conversations retain A',async()=>{
 const f=await fixture();let project=await issue(f.repo,f.project),first=copy(project.quotes[0]);
 project=await f.repo.sendReply(reviewReply(project,{kind:'reply',body:'Discussed the bore on A.'}));
 const firstMessage=copy(project.messages[0]);
 project=await f.repo.requestRevision(reviewRevision(project,first.id,{quantity:'5',targetWeeks:'10',notes:'Please review the B drawing source.'}));
 const change=copy(project.changes[0]),before=f.data.get(DRAWING_PROJECT_STORAGE_KEY);
 const proposal=await f.repo.proposeDrawingRevision(project.id,input(f));assert.equal(proposal.status,'proposed');
 const review=await f.repo.reviewDrawingRevision(project.id,input(f));assert.equal(review.status,'reviewed');assert.equal(f.data.get(DRAWING_PROJECT_STORAGE_KEY),before,'proposal and review do not adopt');
 await assert.rejects(f.repo.confirmDrawingRevision(review),{code:'CONFIRMATION_REQUIRED'});
 project=await f.repo.confirmDrawingRevision(review,{confirmed:true});assert.deepEqual(project.context,f.contextA);assert.deepEqual(projectDrawingContext(project),f.contextB);assert.equal(project.drawingRevisions.length,1);
 assert.deepEqual(await f.repo.confirmDrawingRevision(review,{confirmed:true}),project,'repeat confirmation is idempotent');
 project=await f.repo.sendReply(reviewReply(project,{kind:'change-response',changeId:change.id,body:'The requested change has been reviewed.',resolutions:['quantity','timing','notes'].map(topic=>({topic,status:'accepted',response:'Reviewed for the next quotation.'}))}));
 assert.deepEqual(recordContext(project,project.messages.at(-1)),f.contextA,'reply stays attached to the A request');
 project=await issue(f.repo,project);assert.equal(project.quotes[1].version,2);assert.deepEqual(project.quotes[1].context,f.contextB);
 assert.deepEqual(project.quotes[0],first);assert.deepEqual(project.messages[0],firstMessage);assert.deepEqual(project.changes[0],change);assert.deepEqual(project.context,f.contextA);
 assert.equal(compareQuotes(first,project.quotes[1]).find(row=>row.key==='drawingReference').changed,true);
 project=await f.repo.confirmNextStep(reviewNextStep(project,project.quotes[1].id,{intent:'engineering-review',message:'Discuss the updated B reference.'}));
 assert.deepEqual(project.nextSteps[0].context,f.contextB);
 project=await f.repo.acknowledgeNextStep(reviewAcknowledgement(project,{nextStepId:project.nextSteps[0].id,body:'The B drawing review is the next step.'}));
 assert.deepEqual(project.messages.at(-1).context,f.contextB);
 assert.deepEqual(parseProjectStore(f.data.get(DRAWING_PROJECT_STORAGE_KEY)).projects[0],await f.repo.getProject(project.id));
});

test('retained A quotation draft cannot silently follow B; same-B replacement needs a separate explicit review',async()=>{
 const f=await fixture();let project=await issue(f.repo,f.project),draft=await f.repo.getQuoteDraft(project.id);draft.values.scope='Unissued custom A scope';draft=await f.repo.saveQuoteDraft(draft);
 project=await f.repo.confirmDrawingRevision(await f.repo.reviewDrawingRevision(project.id,{...input(f),quoteDraftAction:'keep'}),{confirmed:true});
 const retained=await f.repo.getQuoteDraft(project.id);assert.equal(retained.id,draft.id);assert.deepEqual(retained.context,f.contextA);assert.equal(retained.drawingReferenceStale,true);
 await assert.rejects(f.repo.saveQuoteDraft(retained),{code:'DRAWING_REVIEW_REQUIRED'});assert.throws(()=>reviewQuote(project,retained),{code:'DRAWING_REVIEW_REQUIRED'});
 const forged=copy(retained);forged.context=f.contextB;await assert.rejects(f.repo.saveQuoteDraft(forged),{code:'DRAWING_REVIEW_REQUIRED'});
 const review=await f.repo.reviewDrawingRevision(project.id,{...input(f),quoteDraftAction:'replace'});assert.equal(review.referenceChanged,false);
 project=await f.repo.confirmDrawingRevision(review,{confirmed:true});assert.equal(project.drawingRevisions.length,1);assert.notEqual(project.quoteDraft.id,draft.id);assert.deepEqual(project.quoteDraft.context,f.contextB);assert.notEqual(project.quoteDraft.values.scope,draft.values.scope);
 assert.deepEqual(await f.repo.confirmDrawingRevision(review,{confirmed:true}),project,'replacement confirmation retry does not discard again');
 const final=await issue(f.repo,project);assert.deepEqual(final.quotes[0].context,f.contextA);assert.deepEqual(final.quotes[1].context,f.contextB);
});

test('project edits, draft edits, altered review and missing publication invalidate adoption',async()=>{
 const f=await fixture();let review=await f.repo.reviewDrawingRevision(f.project.id,input(f));
 const altered=copy(review);altered.context.drawing.regionLabel='Unreviewed label';await assert.rejects(f.repo.confirmDrawingRevision(altered,{confirmed:true}),{code:'STALE_REVIEW'});
 await f.repo.sendReply(reviewReply(f.project,{kind:'reply',body:'New activity invalidates review.'}));await assert.rejects(f.repo.confirmDrawingRevision(review,{confirmed:true}),{code:'STALE_REVIEW'});
 review=await f.repo.reviewDrawingRevision(f.project.id,input(f));let draft=await f.repo.getQuoteDraft(f.project.id);draft=await f.repo.saveQuoteDraft(draft);await assert.rejects(f.repo.confirmDrawingRevision(review,{confirmed:true}),{code:'STALE_REVIEW'});
 const before=f.data.get(DRAWING_PROJECT_STORAGE_KEY),unbound=createDrawingProjectRepository(f.options);await assert.rejects(unbound.reviewDrawingRevision(f.project.id,{...input(f),release:f.releaseB}),{code:'DRAWING_RELEASE_UNAVAILABLE'});assert.equal(f.data.get(DRAWING_PROJECT_STORAGE_KEY),before);
});

test('only an exact human-confirmed published part/region/source can replace a project reference',async()=>{
 const f=await fixture();
 const unconfirmed=await f.publish(source('C','d'),false);
 await assert.rejects(f.repo.reviewDrawingRevision(f.project.id,{context:f.context(unconfirmed),releaseId:unconfirmed.id,note:'Source-derived is not human confirmation.'}),{code:'DRAWING_REFERENCE_INVALID'});
 for(const mutate of [c=>{c.drawing.assetRevision='e'.repeat(64);},c=>{c.drawing.mappingRevision='invented';},c=>{c.drawing.regionId='missing';},c=>{c.drawing.regionLabel='Unreviewed text';}]){
  const context=copy(f.contextB);mutate(context);await assert.rejects(f.repo.reviewDrawingRevision(f.project.id,{...input(f),context}),{code:'DRAWING_REFERENCE_INVALID'});
 }
 const forged=copy(f.releaseB);forged.packageSnapshot.sheets[0].regions[0].mappingStatus='needs-review';await assert.rejects(f.repo.reviewDrawingRevision(f.project.id,{...input(f),release:forged}),{code:'STALE_REVIEW'});
 const broken=createDrawingProjectRepository({...f.options,getDrawingRelease:async()=>forged});await assert.rejects(broken.reviewDrawingRevision(f.project.id,input(f)),{code:'DRAWING_REFERENCE_INVALID'});
 const preview=copy(f.releaseB);preview.source='preview';const previews=createDrawingProjectRepository({...f.options,getDrawingRelease:async()=>preview});await assert.rejects(previews.reviewDrawingRevision(f.project.id,input(f)),{code:'DRAWING_REFERENCE_INVALID'});
});

test('legacy records fall back to original A; later clarification replies remain pinned to the question',async()=>{
 const f=await fixture();let project=await issue(f.repo,f.project);project=await f.repo.sendReply(reviewReply(project,{kind:'clarification',body:'Confirm the A bore.'}));
 const stored=JSON.parse(f.data.get(DRAWING_PROJECT_STORAGE_KEY));delete stored.projects[0].quotes[0].context;delete stored.projects[0].messages[0].context;f.data.set(DRAWING_PROJECT_STORAGE_KEY,JSON.stringify(stored));
 project=await f.repo.getProject(project.id);const legacy=copy(project.quotes[0]);
 project=await f.repo.confirmDrawingRevision(await f.repo.reviewDrawingRevision(project.id,input(f)),{confirmed:true});
 project=await f.repo.sendCustomerReply(reviewCustomerReply(project,{replyTo:project.messages[0].id,body:'Answer to the A question.'}));
 assert.deepEqual(recordContext(project,project.messages.at(-1)),f.contextA);assert.deepEqual(project.quotes[0],legacy);assert.deepEqual(recordContext(project,legacy),f.contextA);
 const corrupted=JSON.parse(f.data.get(DRAWING_PROJECT_STORAGE_KEY));corrupted.projects[0].messages.at(-1).context=f.contextB;const raw=JSON.stringify(corrupted);f.data.set(DRAWING_PROJECT_STORAGE_KEY,raw);
 await assert.rejects(f.repo.getProject(project.id),{code:'STORAGE_CORRUPT'});assert.equal(f.data.get(DRAWING_PROJECT_STORAGE_KEY),raw);
});


test('a mapping-only release can be adopted without claiming that source geometry changed',async()=>{
 const f=await fixture(),entry=source('A','a');entry.package.mappingRevision='mapping-correction';entry.package.sheets[0].regions[0].label='Bore detail with reviewed location';entry.package.sheets[0].regions[0].bounds=[25,20,100,100];
 const release=await f.publish(entry),context=f.context(release);
 const next=await f.repo.confirmDrawingRevision(await f.repo.reviewDrawingRevision(f.project.id,{context,releaseId:release.id,note:'Correct the association only. Source files are unchanged.'}),{confirmed:true});
 assert.equal(next.activeDrawingContext.drawing.assetRevision,f.contextA.drawing.assetRevision);assert.equal(next.activeDrawingContext.modelRevision,f.contextA.modelRevision);
 assert.notEqual(next.activeDrawingContext.drawing.mappingRevision,f.contextA.drawing.mappingRevision);assert.equal(next.context.drawing.revision,'A');
});

test('a changed publication snapshot invalidates review and active context/history corruption is rejected without writes',async()=>{
 const f=await fixture();let current=copy(f.releaseB);
 const repo=createDrawingProjectRepository({...f.options,getDrawingRelease:async()=>current}),review=await repo.reviewDrawingRevision(f.project.id,input(f));
 current.packageSnapshot.sheets[0].regions[0].label='Changed after review';await assert.rejects(repo.confirmDrawingRevision(review,{confirmed:true}),{code:'STALE_REVIEW'});
 await f.repo.confirmDrawingRevision(await f.repo.reviewDrawingRevision(f.project.id,input(f)),{confirmed:true});
 const stored=f.data.get(DRAWING_PROJECT_STORAGE_KEY);
 for(const mutate of [p=>{p.activeDrawingContext=f.contextA;},p=>{p.drawingRevisions[0].release.packageSnapshot.pairing.status='source-derived';},p=>{p.context.drawing.regionLabel='Rewritten original';}]){
  const corrupted=JSON.parse(stored);mutate(corrupted.projects[0]);const raw=JSON.stringify(corrupted);f.data.set(DRAWING_PROJECT_STORAGE_KEY,raw);
  await assert.rejects(f.repo.getProject(f.project.id),{code:'STORAGE_CORRUPT'});assert.equal(f.data.get(DRAWING_PROJECT_STORAGE_KEY),raw);
 }
});


test('an installed immutable bundled publication is eligible without a browser review token',async()=>{
 const f=await fixture(),release=copy(f.releaseB);release.source='bundled';delete release.reviewToken;
 const repo=createDrawingProjectRepository({...f.options,getDrawingRelease:async()=>release});
 const review=await repo.reviewDrawingRevision(f.project.id,input(f));const next=await repo.confirmDrawingRevision(review,{confirmed:true});
 assert.deepEqual(next.activeDrawingContext,f.contextB);assert.equal(next.drawingRevisions[0].release.source,'bundled');
});

test('human revision labels improve review without replacing canonical source identities',async()=>{
 const f=await fixture(),entry=source('pdf-'+ 'c'.repeat(64),'c');entry.package.revisionLabel='Demo B';
 const release=await f.publish(entry),context=f.context(release);context.drawing.revisionLabel='Demo B';
 const review=await f.repo.reviewDrawingRevision(f.project.id,{context,releaseId:release.id,note:'Review the labelled source using its immutable identity.'});
 const project=await f.repo.confirmDrawingRevision(review,{confirmed:true});assert.equal(project.activeDrawingContext.drawing.revisionLabel,'Demo B');assert.equal(project.activeDrawingContext.drawing.revision,entry.package.revision);
 const forged=copy(context);forged.drawing.revisionLabel='Manufacturing approved';await assert.rejects(f.repo.reviewDrawingRevision(project.id,{context:forged,releaseId:release.id,note:'Do not trust an invented visible label.'}),{code:'DRAWING_REFERENCE_INVALID'});
});

test('failed adoption persistence leaves the original inquiry, quotation and source unchanged',async()=>{
 const f=await fixture();const original=await issue(f.repo,f.project),bytes=f.data.get(DRAWING_PROJECT_STORAGE_KEY);
 const repository=createDrawingProjectRepository({...f.options,storage:{getItem:f.options.storage.getItem,setItem:()=>{throw new Error('No space');}},getDrawingRelease:id=>f.drawingRepo.getRelease(id)});
 const review=await repository.reviewDrawingRevision(original.id,input(f));await assert.rejects(repository.confirmDrawingRevision(review,{confirmed:true}),{code:'STORAGE_UNAVAILABLE'});
 assert.equal(f.data.get(DRAWING_PROJECT_STORAGE_KEY),bytes);assert.deepEqual(await f.repo.getSellerProject(original.id),original);
});
