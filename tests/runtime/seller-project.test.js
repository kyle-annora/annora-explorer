import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoProjectRepository, PROJECT_STORAGE_KEY, parseProjectStore } from '../../src/product-room/project-repository.js';
import { reviewRevision, reviewNextStep, compareQuotes } from '../../src/product-room/project-domain.js';
import { reviewQuote, reviewReply, reviewCustomerReply, reviewAcknowledgement, quoteDraftPreview, quoteDraftErrors, pendingProjectChange, pendingClarification, sellerProjectStatus } from '../../src/product-room/seller-domain.js';

const context = {productId:'kinetic-01',productTitle:'Crank-slider mechanism',modelId:'kinetic-01',modelRevision:'kinetic-r1',part:{id:'rod',title:'Connecting rod'}};
function setup() {
  let serial=0;
  const data = new Map(), storage = {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};
  const options={storage,locks:null,makeId:prefix=>`${prefix}-${++serial}`,now:()=> '2026-11-01T12:00:00.000Z'};
  return {data,storage,options,repo:createDemoProjectRepository(options)};
}
async function pricedDraft(repo,projectId) {
  const draft=await repo.getQuoteDraft(projectId);
  draft.values.lineItems[0].unitPrice='185';draft.values.lineItems[1].unitPrice='250';
  draft.values.proposedLeadTime='6–8 weeks after technical review';
  return repo.saveQuoteDraft(draft);
}
async function issued(repo) {
  const project=await repo.createSampleInquiry(context),draft=await pricedDraft(repo,project.id);
  await repo.issueQuote(reviewQuote(project,draft)); return repo.getProject(project.id);
}
const changeValues={quantity:'30',targetWeeks:'5',notes:'Can the mounting interface be adapted?'};
const answer=changeId=>({kind:'change-response',changeId,body:'Quantity revised; technical review is still required.',resolutions:[
  {topic:'quantity',status:'accepted',response:'30 assemblies are included.'},
  {topic:'timing',status:'alternative',response:'We propose 6–8 weeks following technical review.'},
  {topic:'notes',status:'alternative',response:'Mounting adaptation will be scoped separately after drawing review.'}
]});

test('seller drafts persist independently and buyer reads never expose draft prices or values',async()=>{
  const {repo,options}=setup(),project=await repo.createSampleInquiry(context);
  const draft=await pricedDraft(repo,project.id);
  const buyer=await repo.getProject(project.id),seller=await repo.getSellerProject(project.id);
  assert.equal(buyer.revision,project.revision);assert.equal(buyer.quotes.length,0);
  assert.equal(Object.hasOwn(buyer,'quoteDraft'),false);assert.equal(Object.hasOwn((await repo.listProjects())[0],'quoteDraft'),false);
  assert.equal(seller.quoteDraft.values.lineItems[0].unitPrice,'185');
  assert.deepEqual(await createDemoProjectRepository(options).getQuoteDraft(project.id),draft);
  assert.equal(sellerProjectStatus(seller).label,'Quotation draft');
});

test('review and explicit issue are required, idempotent and immutable',async()=>{
  const {repo}=setup(),project=await repo.createSampleInquiry(context),draft=await pricedDraft(repo,project.id);
  await assert.rejects(repo.issueQuote(draft),{code:'STALE_REVIEW'});
  const review=reviewQuote(project,draft),tampered=structuredClone(review);tampered.draft.values.quantity='900';
  await assert.rejects(repo.issueQuote(tampered),{code:'STALE_REVIEW'});
  const sent=await repo.issueQuote(review);assert.deepEqual(await repo.issueQuote(review),sent);
  assert.equal(sent.quoteDraft,null);assert.equal(sent.quotes[0].source,'seller-demo');assert.equal(sent.quotes[0].subtotal,3950);assert.equal(sent.quotes[0].total,null);
  assert.equal(sent.quotes[0].lineItems[2].amount,null);
  const first=structuredClone(sent.quotes[0]),newDraft=await repo.getQuoteDraft(project.id);newDraft.values.scope='Changed scope';await repo.saveQuoteDraft(newDraft);
  assert.deepEqual((await repo.getProject(project.id)).quotes[0],first);
});

test('full buyer/seller loop clarifies without v2, issues resolved v2, compares and acknowledges',async()=>{
  const {repo}=setup();let project=await issued(repo);const original=structuredClone(project),quote=project.quotes[0];
  project=await repo.requestRevision(reviewRevision(project,quote.id,changeValues));const change=project.changes[0];
  const clarificationReview=reviewReply(project,{kind:'clarification',changeId:change.id,body:'Can you confirm the mounting envelope?'});
  project=await repo.sendReply(clarificationReview);assert.deepEqual(await repo.sendReply(clarificationReview),project);
  assert.equal(project.quotes.length,1);assert.equal(pendingClarification(project).body,'Can you confirm the mounting envelope?');assert.equal(sellerProjectStatus(project).owner,'Customer');
  const customerReview=reviewCustomerReply(project,{body:'The mounting envelope is 120 × 80 mm.',replyTo:project.messages[0].id});
  project=await repo.sendCustomerReply(customerReview);assert.deepEqual(await repo.sendCustomerReply(customerReview),project);
  assert.equal(pendingClarification(project),null);assert.equal(sellerProjectStatus(project).owner,'Seller');
  let draft=await repo.getQuoteDraft(project.id);draft.values.quantity='30';draft.values.lineItems[0].quantity='30';draft.values.lineItems[0].unitPrice='175';draft=await repo.saveQuoteDraft(draft);
  assert.throws(()=>reviewQuote(project,draft),{code:'VALIDATION'});
  project=await repo.issueQuote(reviewQuote(project,draft,answer(change.id)));
  assert.equal(project.quotes.length,2);assert.equal(project.quotes[1].subtotal,5500);assert.equal(pendingProjectChange(project),null);assert.equal(sellerProjectStatus(project).owner,'Customer');
  assert.deepEqual(project.quotes[0],original.quotes[0]);assert.deepEqual(project.inquiry,original.inquiry);
  const comparison=compareQuotes(project.quotes[0],project.quotes[1]);assert.equal(comparison.find(row=>row.key==='quantity').changed,true);assert.equal(comparison.find(row=>row.key==='proposedLeadTime').changed,false);assert.ok(comparison.some(row=>row.key.startsWith('line-')&&row.changed));
  project=await repo.confirmNextStep(reviewNextStep(project,project.quotes[1].id,{intent:'engineering-review',message:'Please review the mounting drawing.'}));
  const ack=reviewAcknowledgement(project,{nextStepId:project.nextSteps[0].id,body:'We will review the drawing and agree the mounting scope next.'});
  project=await repo.acknowledgeNextStep(ack);assert.deepEqual(await repo.acknowledgeNextStep(ack),project);assert.equal(sellerProjectStatus(project).label,'Next step confirmed');
  assert.equal(project.quotes[1].total,null);assert.equal(project.messages.at(-1).delivery,'demo-only');
  await assert.rejects(repo.confirmNextStep(reviewNextStep(project,project.quotes[1].id,{intent:'engineering-review',message:'Please review the mounting drawing.'})),{code:'CONFLICT'});
});

test('needs-info response stays open, accepts buyer clarification and cannot be issued as resolved',async()=>{
  const {repo}=setup();let project=await issued(repo);project=await repo.requestRevision(reviewRevision(project,project.quotes[0].id,changeValues));
  const values=answer(project.changes[0].id);values.resolutions[2].status='needs-info';
  project=await repo.sendReply(reviewReply(project,values));assert.ok(pendingProjectChange(project));assert.ok(pendingClarification(project));
  const draft=await pricedDraft(repo,project.id);assert.throws(()=>reviewQuote(project,draft,values),{code:'CONFLICT'});
  project=await repo.sendCustomerReply(reviewCustomerReply(project,{body:'Please use the existing mounting holes.',replyTo:pendingClarification(project).id}));
  assert.equal(pendingClarification(project),null);assert.ok(pendingProjectChange(project));
  const refreshed=await repo.saveQuoteDraft(await repo.getQuoteDraft(project.id));assert.throws(()=>reviewQuote(project,refreshed,values),{code:'VALIDATION'});
  await assert.rejects(repo.confirmNextStep(reviewNextStep(project,project.quotes[0].id,{intent:'discussion',message:'Discuss next steps.'})),{code:'CONFLICT'});
});

test('quote issue after a buyer clarification changes ownership even with identical timestamps',async()=>{
  const {repo}=setup();let project=await repo.createSampleInquiry(context);
  project=await repo.sendReply(reviewReply(project,{kind:'clarification',body:'What is the operating load?'}));
  project=await repo.sendCustomerReply(reviewCustomerReply(project,{body:'We will provide a load diagram.',replyTo:project.messages[0].id}));
  assert.equal(sellerProjectStatus(project).owner,'Seller');
  const draft=await pricedDraft(repo,project.id);project=await repo.issueQuote(reviewQuote(project,draft));
  assert.equal(sellerProjectStatus(project).owner,'Customer');assert.equal(sellerProjectStatus(project).label,'Quotation ready');
});

test('customer activity rebases restored draft context without losing fields and invalidates reviewed sends',async()=>{
  const {repo}=setup();let project=await repo.createSampleInquiry(context);const draft=await pricedDraft(repo,project.id),review=reviewQuote(project,draft);
  project=await repo.sendReply(reviewReply(project,{kind:'clarification',body:'What is the cycle rate?'}));
  await assert.rejects(repo.issueQuote(review),{code:'STALE_REVIEW'});
  await assert.rejects(repo.saveQuoteDraft({...draft,values:{...draft.values,scope:'Unsaved input'}}),{code:'CONFLICT'});
  project=await repo.sendCustomerReply(reviewCustomerReply(project,{body:'Six cycles per minute.',replyTo:project.messages[0].id}));
  const reopened=await repo.getQuoteDraft(project.id);assert.equal(reopened.rebasedFromRevision,draft.projectRevision);assert.deepEqual(reopened.values,draft.values);assert.equal(reopened.projectRevision,project.revision);
  const saved=await repo.saveQuoteDraft(reopened);assert.equal(Object.hasOwn(saved,'rebasedFromRevision'),false);
  project=await repo.issueQuote(reviewQuote(project,saved));assert.equal(project.quotes.length,1);
});

test('parallel seller drafts cannot overwrite each other and save failure cannot issue or discard draft',async()=>{
  const {repo,options,storage}=setup(),other=createDemoProjectRepository(options),project=await repo.createSampleInquiry(context),draft=await pricedDraft(repo,project.id);
  const copy=await other.getQuoteDraft(project.id);await repo.saveQuoteDraft({...draft,values:{...draft.values,scope:'New scope'}});
  await assert.rejects(other.saveQuoteDraft({...copy,values:{...copy.values,scope:'Other edit'}}),{code:'CONFLICT'});
  const saved=await repo.getQuoteDraft(project.id),review=reviewQuote(project,saved),before=storage.getItem(PROJECT_STORAGE_KEY);
  storage.setItem=()=>{throw new Error('Quota exceeded');};await assert.rejects(repo.issueQuote(review),{code:'STORAGE_UNAVAILABLE'});
  assert.equal(storage.getItem(PROJECT_STORAGE_KEY),before);assert.equal((await repo.getProject(project.id)).quotes.length,0);assert.equal((await repo.getQuoteDraft(project.id)).values.scope,'New scope');
});

test('schema v1 migrates without writes and preserves every legacy quotation value',async()=>{
  const {repo,storage}=setup(),project=await repo.createSampleInquiry(context);await repo.createSampleQuote(project.id);
  const legacy=JSON.parse(storage.getItem(PROJECT_STORAGE_KEY));legacy.schemaVersion=1;delete legacy.quoteDrafts;for(const item of legacy.projects)delete item.messages;
  const raw=JSON.stringify(legacy);storage.setItem(PROJECT_STORAGE_KEY,raw);
  const restored=await repo.getProject(project.id);assert.equal(storage.getItem(PROJECT_STORAGE_KEY),raw);assert.deepEqual(restored.quotes,legacy.projects[0].quotes);assert.deepEqual(restored.inquiry,legacy.projects[0].inquiry);
  assert.equal(parseProjectStore(raw).schemaVersion,2);assert.deepEqual(restored.messages,[]);
  await repo.saveQuoteDraft(await repo.getQuoteDraft(project.id));assert.equal(JSON.parse(storage.getItem(PROJECT_STORAGE_KEY)).schemaVersion,2);
  assert.deepEqual((await repo.getProject(project.id)).quotes,legacy.projects[0].quotes);
});

test('draft monetary validation, rounding, unknown values and comparison preserve meaningful changes',async()=>{
  const {repo}=setup(),project=await repo.createSampleInquiry(context);let draft=await repo.getQuoteDraft(project.id);
  assert.equal(quoteDraftPreview(draft,project).lineItems[0].amount,null);
  draft.values.lineItems=[{id:'fraction',label:'Setup time',quantity:'1.25',unitPrice:'19.99'}];assert.deepEqual(quoteDraftErrors(draft),{});assert.equal(quoteDraftPreview(draft,project).subtotal,24.99);
  draft.values.lineItems[0].unitPrice='-1';assert.ok(quoteDraftErrors(draft)['lineItems.0.unitPrice']);
  draft.values.lineItems[0].unitPrice='19.99';draft=await repo.saveQuoteDraft(draft);const sent=await repo.issueQuote(reviewQuote(project,draft));assert.equal((await repo.getProject(project.id)).quotes[0].subtotal,24.99);
  const changed=structuredClone(sent.quotes[0]);changed.exclusions=['New exclusion'];changed.assumptions=['Changed assumption'];changed.validity='30 days';
  const rows=compareQuotes(sent.quotes[0],changed);for(const key of ['exclusions','assumptions','validity'])assert.equal(rows.find(item=>item.key===key).changed,true);
});

test('corrupt messages, quote arithmetic and seller lineage fail without resetting storage',async()=>{
  const {repo,storage}=setup(),project=await issued(repo),raw=storage.getItem(PROJECT_STORAGE_KEY);
  for(const mutate of [
    store=>{store.projects[0].quotes[0].lineItems[0].amount=1;},
    store=>{store.projects[0].quotes[0].previousQuoteId='wrong';},
    store=>{store.projects[0].messages.push({id:'bad',kind:'customer-reply',authorRole:'buyer',body:'x',createdAt:project.createdAt,reviewToken:'x',delivery:'demo-only',resolutions:[],changeId:null,nextStepId:null,replyTo:'missing'});}
  ]) { const store=JSON.parse(raw);mutate(store);const corrupt=JSON.stringify(store);storage.setItem(PROJECT_STORAGE_KEY,corrupt);await assert.rejects(repo.getProject(project.id),{code:'STORAGE_CORRUPT'});assert.equal(storage.getItem(PROJECT_STORAGE_KEY),corrupt); }
});

test('loading the example is explicit, idempotent and does not consume a buyer draft',async()=>{
  const {repo,storage}=setup();const draft=await repo.saveDraft(await repo.getDraft(context)),before=await repo.listDrafts();
  assert.equal((await repo.listProjects()).length,0);const project=await repo.createSampleInquiry(context);assert.deepEqual(await repo.createSampleInquiry(context),project);
  assert.equal((await repo.listSellerProjects()).length,1);assert.deepEqual(await repo.listDrafts(),before);assert.equal((await repo.getDraft(context)).id,draft.id);assert.equal(project.inquiry.values.email,'alex@example.com');
});

test('incomplete per-change explanations survive save/reload and final issue validates them',async()=>{
  const {repo,options}=setup();let project=await issued(repo);project=await repo.requestRevision(reviewRevision(project,project.quotes[0].id,changeValues));
  let draft=await repo.getQuoteDraft(project.id);assert.equal(draft.replyDraft.resolutions.length,3);
  draft.replyDraft.body='Working response';draft.replyDraft.resolutions[0].response='Partial quantity explanation';draft=await repo.saveQuoteDraft(draft);
  const reopened=await createDemoProjectRepository(options).getQuoteDraft(project.id);assert.deepEqual(reopened.replyDraft,draft.replyDraft);
  assert.throws(()=>reviewQuote(project,reopened),{code:'VALIDATION'});
  reopened.replyDraft=answer(project.changes[0].id);draft=await repo.saveQuoteDraft(reopened);
  const issuedProject=await repo.issueQuote(reviewQuote(project,draft));assert.equal(issuedProject.quotes.length,2);assert.equal(issuedProject.messages.at(-1).body,draft.replyDraft.body);
});

test('legacy amount-only quote lines copy into editable drafts with stable comparison identities',async()=>{
  const {repo,storage}=setup(),project=await repo.createSampleInquiry(context);await repo.createSampleQuote(project.id);
  const store=JSON.parse(storage.getItem(PROJECT_STORAGE_KEY));for(const item of store.projects[0].quotes[0].lineItems){delete item.quantity;delete item.unitPrice;}
  storage.setItem(PROJECT_STORAGE_KEY,JSON.stringify(store));const draft=await repo.getQuoteDraft(project.id);
  assert.equal(draft.values.lineItems[0].quantity,'1');assert.equal(draft.values.lineItems[0].unitPrice,'3700');assert.equal(draft.values.lineItems[2].unitPrice,'');
  assert.deepEqual(quoteDraftErrors(draft),{});
});

test('a new buyer change safely retargets a restored quote draft without overwriting input',async()=>{
  const {repo,storage}=setup();let project=await issued(repo);let draft=await repo.getQuoteDraft(project.id);draft.values.scope='Carefully authored new scope';draft=await repo.saveQuoteDraft(draft);
  project=await repo.requestRevision(reviewRevision(project,project.quotes[0].id,changeValues));const before=storage.getItem(PROJECT_STORAGE_KEY);
  const reopened=await repo.getQuoteDraft(project.id);assert.equal(reopened.changeId,project.changes[0].id);assert.equal(reopened.replyDraft.changeId,reopened.changeId);assert.equal(reopened.values.scope,draft.values.scope);assert.equal(storage.getItem(PROJECT_STORAGE_KEY),before);
  reopened.replyDraft=answer(project.changes[0].id);draft=await repo.saveQuoteDraft(reopened);project=await repo.issueQuote(reviewQuote(project,draft));assert.equal(project.quotes.length,2);assert.equal(project.quotes[1].requestedWeeks,5);
});

test('reply-only resolution followed by a quote uses the latest requested timing without inventing another reply',async()=>{
  const {repo}=setup();let project=await issued(repo);project=await repo.requestRevision(reviewRevision(project,project.quotes[0].id,changeValues));
  project=await repo.sendReply(reviewReply(project,answer(project.changes[0].id)));assert.equal(pendingProjectChange(project),null);assert.equal(project.quotes.length,1);
  const draft=await repo.saveQuoteDraft(await repo.getQuoteDraft(project.id));assert.equal(draft.replyDraft,null);assert.equal(draft.changeId,project.changes[0].id);
  project=await repo.issueQuote(reviewQuote(project,draft));assert.equal(project.quotes[1].requestedWeeks,5);assert.equal(project.messages.length,1);
});

test('general replies cannot carry resolutions and an unanswered question cannot be overwritten with resolved outcomes',async()=>{
  const {repo}=setup();let project=await issued(repo);project=await repo.requestRevision(reviewRevision(project,project.quotes[0].id,changeValues));
  assert.throws(()=>reviewReply(project,{...answer(project.changes[0].id),kind:'reply'}),{code:'VALIDATION'});
  project=await repo.sendReply(reviewReply(project,{kind:'clarification',body:'Please provide the mounting envelope.',changeId:project.changes[0].id}));
  assert.throws(()=>reviewReply(project,answer(project.changes[0].id)),{code:'CONFLICT'});
});

test('customer reply after an older acknowledgement returns attention to seller',async()=>{
  const {repo}=setup();let project=await issued(repo);project=await repo.confirmNextStep(reviewNextStep(project,project.quotes[0].id,{intent:'discussion',message:'Discuss the mounting scope.'}));
  project=await repo.acknowledgeNextStep(reviewAcknowledgement(project,{nextStepId:project.nextSteps[0].id,body:'We will review the mounting scope.'}));assert.equal(sellerProjectStatus(project).label,'Next step confirmed');
  project=await repo.sendReply(reviewReply(project,{kind:'clarification',body:'Who will join the review?'}));project=await repo.sendCustomerReply(reviewCustomerReply(project,{body:'Our fixture engineer.',replyTo:pendingClarification(project).id}));assert.equal(sellerProjectStatus(project).label,'Customer replied');assert.equal(sellerProjectStatus(project).owner,'Seller');
});

test('schema migration refuses newer fields mislabeled as v1 and rejects forged message ordering',async()=>{
  const {repo,storage}=setup();let project=await issued(repo);project=await repo.sendReply(reviewReply(project,{kind:'clarification',body:'Which mounting envelope?'}));project=await repo.sendCustomerReply(reviewCustomerReply(project,{body:'120 × 80 mm.',replyTo:pendingClarification(project).id}));const raw=storage.getItem(PROJECT_STORAGE_KEY);
  for(const mutate of [
    store=>{store.schemaVersion=1;},
    store=>{store.projects[0].messages[1].projectRevision=store.projects[0].messages[0].projectRevision;},
    store=>{store.projects[0].messages.reverse();},
    store=>{store.projects[0].messages[0].nextStepId='unrelated';},
    store=>{store.projects[0].quotes[0].issuedProjectRevision=99999;}
  ]) {const store=JSON.parse(raw);mutate(store);const corrupt=JSON.stringify(store);storage.setItem(PROJECT_STORAGE_KEY,corrupt);await assert.rejects(repo.getProject(project.id),{code:'STORAGE_CORRUPT'});assert.equal(storage.getItem(PROJECT_STORAGE_KEY),corrupt);}
});
