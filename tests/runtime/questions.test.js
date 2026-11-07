import test from 'node:test';
import assert from 'node:assert/strict';
import {createDemoProjectRepository,parseProjectStore,PROJECT_STORAGE_KEY} from '../../src/product-room/project-repository.js';
import {reviewInquiry,reviewNextStep,compareQuotes} from '../../src/product-room/project-domain.js';
import {reviewQuote,reviewAcknowledgement,reviewReply} from '../../src/product-room/seller-domain.js';
import {reviewOptionSet,reviewOptionPreference} from '../../src/product-room/option-scope-domain.js';
import {reviewQuestion,reviewQuestionReply,reviewQuestionResolution,reviewQuestionReopen,questionState,pendingBlockingQuestions,adoptCurrentQuestions,quoteQuestionErrors} from '../../src/product-room/question-domain.js';
import {assertQuestionsRepository,assertQuestionRoundTrip,assertQuestionScopeRoundTrip} from '../../src/product-room/question-repository.js';
import {sampleInquiryValues} from '../../src/product-room/project-fixtures.js';

const clone=value=>structuredClone(value);
const context={productId:'kinetic-01',modelId:'kinetic-01',modelRevision:'question-test',productTitle:'Crank-slider mechanism'};
function setup(){let serial=0,blocked=false;const data=new Map();const storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>{if(blocked)throw Error('Quota');data.set(key,value);}};return {storage,data,block:value=>{blocked=value;},repo:createDemoProjectRepository({storage,locks:null,now:()=> '2026-11-06T20:00:00.000Z',makeId:prefix=>`${prefix}-${++serial}`})};}
async function fixture(repo,{options=true}={}){
  let draft=await repo.getDraft(context);draft.values={...draft.values,...sampleInquiryValues(context)};
  draft.requestItems=[{id:'motion',purpose:'question',notes:'Explain the connecting rod motion.',context:{...context,part:{id:'rod',title:'Connecting rod'}}},
    {id:'mounting',purpose:'question',notes:'Review the guide interface.',context:{...context,part:{id:'guide',title:'Linear guide'}}}];
  draft=await repo.saveDraft(draft);let project=await repo.submitInquiry(reviewInquiry(draft));
  if(!options)return project;
  project=await repo.approveOptionSet(reviewOptionSet(project,{id:'question-options',version:1,kind:'scope-packages',title:'Prepared review packages',disclaimer:'Fictional demonstration, pricing unknown.',context:clone(project.context),options:[
    {id:'guided',title:'Guided handoff',description:'Motion review.',status:'available',requestItemIds:['motion'],facts:[]},
    {id:'engineering',title:'Engineering support',description:'Motion and mounting review.',status:'available',requestItemIds:['motion','mounting'],facts:[]},
  ]}),{confirmed:true});
  return repo.confirmOptionPreference(reviewOptionPreference(project,{choice:'option',optionId:'engineering',notes:''}),{confirmed:true});
}
async function add(repo,project,requestItemId='motion',blocking=true,body='Please explain this exact component.'){
  return repo.confirmQuestion(reviewQuestion(project,{requestItemId,blocking,body}),{confirmed:true});
}
async function reply(repo,project,questionId,kind='answer',authorRole='seller',body='This prepared handoff covers the saved component reference.'){
  return repo.confirmQuestionReply(reviewQuestionReply(project,{questionId,kind,authorRole,body}),{confirmed:true});
}
async function resolve(repo,project,questionId,authorRole='seller'){
  return repo.confirmQuestionResolution(reviewQuestionResolution(project,{questionId,authorRole,body:authorRole==='seller'?'Seller confirms the answer is sufficient for this quoted scope.':'I acknowledge this answer for the stated scope.'}),{confirmed:true});
}
async function reopen(repo,project,questionId){return repo.confirmQuestionReopen(reviewQuestionReopen(project,{questionId,authorRole:'buyer',body:'Please revisit the mounting assumptions.'}),{confirmed:true});}
function mapped(draft){return draft.scopeSelection?{...draft,scopeSelection:{...draft.scopeSelection,entries:draft.scopeSelection.entries.map(entry=>({...entry,disposition:'included',lineIds:[draft.values.lineItems[0].id],rationale:'Prepared review scope.'}))}}:draft;}
async function issue(repo,project,{adopt=false}={}){
  let draft=await repo.getQuoteDraft(project.id);if(adopt)draft=adoptCurrentQuestions(project,draft);
  draft=await repo.saveQuoteDraft(mapped(draft));return repo.issueQuote(reviewQuote(project,draft));
}

test('two reviewed questions retain independent source, ownership and exact inquiry; review and repeated confirm do not duplicate',async()=>{
  const {repo,storage}=setup();let project=await fixture(repo);const inquiry=clone(project.inquiry),before=storage.getItem(PROJECT_STORAGE_KEY);
  const reviewed=reviewQuestion(project,{requestItemId:'motion',blocking:true,body:'Explain the rod clearance.'});
  assert.equal(storage.getItem(PROJECT_STORAGE_KEY),before);
  await assert.rejects(repo.confirmQuestion(reviewed),{code:'CONFIRMATION_REQUIRED'});
  project=await repo.confirmQuestion(reviewed,{confirmed:true});assertQuestionRoundTrip(reviewed,project);
  const once=storage.getItem(PROJECT_STORAGE_KEY);assert.deepEqual(await repo.confirmQuestion(reviewed,{confirmed:true}),project);assert.equal(storage.getItem(PROJECT_STORAGE_KEY),once);
  project=await add(repo,project,'mounting',false,'Which mounting details remain unknown?');
  const firstId=project.questions[0].id,second=clone(project.questions[1]);
  project=await reply(repo,project,firstId,'clarification');
  assert.deepEqual(questionState(project.questions[0]),{status:'waiting-on-buyer',ownerRole:'buyer'});
  assert.deepEqual(questionState(project.questions[1]),{status:'open',ownerRole:'seller'});assert.deepEqual(project.questions[1],second);
  project=await reply(repo,project,firstId,'buyer-reply','buyer','We need a guided demonstration only.');
  assert.deepEqual(questionState(project.questions[0]),{status:'waiting-on-seller',ownerRole:'seller'});
  project=await reply(repo,project,firstId);assert.equal(questionState(project.questions[0]).status,'answered');assert.equal(pendingBlockingQuestions(project).length,1);
  assert.deepEqual(project.questions[0].requestItem,inquiry.requestItems[0]);assert.deepEqual(project.questions[1].context,inquiry.requestItems[1].context);
  assert.deepEqual(project.inquiry,inquiry);assert.equal(project.messages.length,0);
  assert.deepEqual((await repo.getProject(project.id)).questions,project.questions);
});

test('answers require a separate reviewed role-attributed resolution; reopen appends without erasing previous evidence',async()=>{
  const {repo}=setup();let project=await add(repo,await fixture(repo));const id=project.questions[0].id;
  assert.throws(()=>reviewQuestionResolution(project,{questionId:id,authorRole:'seller',body:'Cannot silently resolve open.'}),{code:'CONFLICT'});
  project=await reply(repo,project,id);const answered=clone(project.questions[0]);
  const reviewed=reviewQuestionResolution(project,{questionId:id,authorRole:'seller',body:'Seller confirms this answer for the scope.'});
  await assert.rejects(repo.confirmQuestionResolution(reviewed),{code:'CONFIRMATION_REQUIRED'});
  project=await repo.confirmQuestionResolution(reviewed,{confirmed:true});assertQuestionRoundTrip(reviewed,project);
  assert.equal(questionState(project.questions[0]).status,'resolved');assert.equal(project.questions[0].events.at(-1).authorRole,'seller');
  assert.deepEqual(project.questions[0].events.slice(0,2),answered.events);
  assert.throws(()=>reviewQuestionReply(project,{questionId:id,authorRole:'seller',kind:'answer',body:'Another answer.'}),{code:'CONFLICT'});
  assert.throws(()=>reviewQuestionReopen(project,{questionId:id,authorRole:'buyer',body:' '}),{code:'VALIDATION'});
  const resolved=clone(project.questions[0]);project=await reopen(repo,project,id);assert.equal(questionState(project.questions[0]).status,'open');assert.deepEqual(project.questions[0].events.slice(0,-1),resolved.events);
  project=await reply(repo,project,id);project=await resolve(repo,project,id,'buyer');
  assert.equal(project.questions[0].events.at(-1).authorRole,'buyer');assert.equal(project.questions[0].events.length,6);
});

test('roles and targets are explicit; changing a reviewed packet or answering the wrong thread cannot save',async()=>{
  const {repo}=setup();let project=await add(repo,await fixture(repo));const id=project.questions[0].id;
  for(const input of [{questionId:id,kind:'answer',authorRole:'buyer',body:'Wrong role.'},{questionId:id,kind:'buyer-reply',authorRole:'buyer',body:'No clarification.'},{questionId:'missing',kind:'answer',authorRole:'seller',body:'Missing target.'}])assert.throws(()=>reviewQuestionReply(project,input),{code:'VALIDATION'});
  assert.throws(()=>reviewQuestion(project,{requestItemId:'missing',blocking:true,body:'Invalid source.'}),{code:'VALIDATION'});
  assert.throws(()=>reviewQuestion(project,{requestItemId:'motion',blocking:true,body:'Seller opened.',authorRole:'seller'}),{code:'VALIDATION'});
  const reviewed=reviewQuestionReply(project,{questionId:id,kind:'answer',authorRole:'seller',body:'Reviewed answer.'});
  const changed=clone(reviewed);changed.body='Different answer.';
  await assert.rejects(repo.confirmQuestionReply(changed,{confirmed:true}),{code:'STALE_REVIEW'});
  assert.equal((await repo.getProject(project.id)).questions[0].events.length,1);
});

test('scope-affecting unanswered and answered questions block issue; informational open questions remain visible in the issued snapshot',async()=>{
  const {repo}=setup();let project=await add(repo,await fixture(repo));const id=project.questions[0].id;
  project=await add(repo,project,'mounting',false,'What materials are typical?');
  let draft=await repo.saveQuoteDraft(mapped(await repo.getQuoteDraft(project.id)));
  assert.throws(()=>reviewQuote(project,draft),error=>!!error.fields[`questionScope.${id}`]);
  project=await reply(repo,project,id);draft=await repo.saveQuoteDraft(adoptCurrentQuestions(project,await repo.getQuoteDraft(project.id)));
  assert.throws(()=>reviewQuote(project,draft),error=>!!error.fields[`questionScope.${id}`]);
  project=await resolve(repo,project,id);project=await issue(repo,project,{adopt:true});
  assert.equal(project.quotes[0].questionScope.questions.length,2);assert.equal(questionState(project.quotes[0].questionScope.questions[1]).status,'open');
  assert.equal(project.quotes[0].questionScope.questions[0].scopeEntryId,'request:motion');assert.equal(project.quotes[0].total,null);
  assert.equal(project.quotes[0].questionScope.questions[0].events.at(-1).authorRole,'seller');
});

test('v1 remains frozen after reopen; v2 requires explicit latest-evidence adoption and preserves original quote scope',async()=>{
  const {repo,storage}=setup();let project=await add(repo,await fixture(repo));const id=project.questions[0].id;
  project=await resolve(repo,await reply(repo,project,id),id);project=await issue(repo,project);const first=clone(project.quotes[0]),inquiry=clone(project.inquiry);
  project=await reopen(repo,project,id);let draft=await repo.getQuoteDraft(project.id);
  assert.deepEqual(draft.questionScope,first.questionScope);assert.ok(quoteQuestionErrors(project,draft).questionScope);
  await assert.rejects(repo.saveQuoteDraft(draft),{code:'QUESTION_REVIEW_REQUIRED'});
  project=await resolve(repo,await reply(repo,project,id),id,'buyer');
  draft=adoptCurrentQuestions(project,await repo.getQuoteDraft(project.id));assert.deepEqual(draft.scopeSelection,first.scopeSelection);
  draft=await repo.saveQuoteDraft(draft);project=await repo.issueQuote(reviewQuote(project,draft));
  assert.deepEqual(project.quotes[0],first);assert.deepEqual(project.inquiry,inquiry);
  assert.equal(project.quotes[1].questionScope.questions[0].events.length,6);
  assert.ok(compareQuotes(first,project.quotes[1],project).find(row=>row.key===`question-${id}`).changed);
  assert.deepEqual(parseProjectStore(storage.getItem(PROJECT_STORAGE_KEY)).projects[0].quotes,project.quotes);
});

test('a first question after v1 preserves the empty v1 snapshot until seller explicitly adopts it',async()=>{
  const {repo}=setup();let project=await fixture(repo);project=await issue(repo,project);const first=clone(project.quotes[0]);
  project=await add(repo,project,'mounting',false);const draft=await repo.getQuoteDraft(project.id);
  assert.equal(first.questionScope,undefined);assert.deepEqual(draft.questionScope.questions,[]);
  await assert.rejects(repo.saveQuoteDraft(draft),{code:'QUESTION_REVIEW_REQUIRED'});
  project=await issue(repo,project,{adopt:true});assert.deepEqual(project.quotes[0],first);assert.equal(project.quotes[1].questionScope.questions.length,1);
});

test('a pre-question draft stays recoverable; two tabs invalidate old reviews without losing the saved draft or typed input',async()=>{
  const {repo,storage}=setup();let project=await fixture(repo);const oldDraft=await repo.saveQuoteDraft(mapped(await repo.getQuoteDraft(project.id)));const oldQuoteReview=reviewQuote(project,oldDraft);
  const second=createDemoProjectRepository({storage,locks:null});project=await add(second,project);
  await assert.rejects(repo.issueQuote(oldQuoteReview),{code:'STALE_REVIEW'});
  const saved=await repo.getQuoteDraft(project.id);assert.deepEqual(saved.values,oldDraft.values);assert.equal(saved.questionScope,undefined);
  const replyReview=reviewQuestionReply(project,{questionId:project.questions[0].id,authorRole:'seller',kind:'answer',body:'Keep this typed answer.'});
  project=await add(second,project,'mounting',false);
  await assert.rejects(repo.confirmQuestionReply(replyReview,{confirmed:true}),{code:'STALE_REVIEW'});assert.equal(replyReview.body,'Keep this typed answer.');
  assert.equal((await repo.getProject(project.id)).questions[0].events.length,1);
  assert.equal((await repo.getQuoteDraft(project.id)).revision,oldDraft.revision);
});

test('storage errors retain the previous exact store; retry and repeated confirms write once',async()=>{
  const {repo,storage,block}=setup();let project=await add(repo,await fixture(repo));const reviewed=reviewQuestionReply(project,{questionId:project.questions[0].id,authorRole:'seller',kind:'answer',body:'Recoverable answer.'});
  const before=storage.getItem(PROJECT_STORAGE_KEY);block(true);
  await assert.rejects(repo.confirmQuestionReply(reviewed,{confirmed:true}),{code:'STORAGE_UNAVAILABLE'});assert.equal(storage.getItem(PROJECT_STORAGE_KEY),before);
  block(false);project=await repo.confirmQuestionReply(reviewed,{confirmed:true});const after=storage.getItem(PROJECT_STORAGE_KEY);
  assert.deepEqual(await repo.confirmQuestionReply(reviewed,{confirmed:true}),project);assert.equal(storage.getItem(PROJECT_STORAGE_KEY),after);
});

test('resolution and reopening confirm once; simultaneous tabs cannot overwrite a different reviewed thread action',async()=>{
  const {repo,storage}=setup();let project=await add(repo,await fixture(repo));const id=project.questions[0].id;
  project=await reply(repo,project,id);
  const resolution=reviewQuestionResolution(project,{questionId:id,authorRole:'seller',body:'Seller-reviewed scope answer.'});
  project=await repo.confirmQuestionResolution(resolution,{confirmed:true});const resolved=storage.getItem(PROJECT_STORAGE_KEY);
  assert.deepEqual(await repo.confirmQuestionResolution(resolution,{confirmed:true}),project);assert.equal(storage.getItem(PROJECT_STORAGE_KEY),resolved);
  const reopening=reviewQuestionReopen(project,{questionId:id,authorRole:'buyer',body:'A new application detail needs review.'});
  project=await repo.confirmQuestionReopen(reopening,{confirmed:true});const reopened=storage.getItem(PROJECT_STORAGE_KEY);
  assert.deepEqual(await repo.confirmQuestionReopen(reopening,{confirmed:true}),project);assert.equal(storage.getItem(PROJECT_STORAGE_KEY),reopened);
  const second=createDemoProjectRepository({storage,locks:null});
  const answer=reviewQuestionReply(project,{questionId:id,authorRole:'seller',kind:'answer',body:'Latest answer.'});
  const addition=reviewQuestion(project,{requestItemId:'mounting',blocking:false,body:'An independent request.'});
  const results=await Promise.allSettled([repo.confirmQuestionReply(answer,{confirmed:true}),second.confirmQuestion(addition,{confirmed:true})]);
  assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
  assert.equal(results.find(result=>result.status==='rejected').reason.code,'STALE_REVIEW');
  project=await repo.getProject(project.id);assert.equal(project.questions.length,1);assert.equal(project.questions[0].events.length,5);assert.equal(project.questionEventIndex.length,5);
});

test('the independent event index rejects a wholly dropped unquoted thread or truncated history',async()=>{
  const {repo,storage}=setup();let project=await add(repo,await fixture(repo));project=await add(repo,project,'mounting',false);
  for(const mutate of [p=>{p.questions.pop();},p=>{delete p.questionEventIndex;},p=>{p.questionEventIndex.pop();}]){
    const store=JSON.parse(storage.getItem(PROJECT_STORAGE_KEY));mutate(store.projects[0]);assert.throws(()=>parseProjectStore(JSON.stringify(store)),{code:'STORAGE_CORRUPT'});
  }
});

test('next-step requests and acknowledgements are blocked by reopened scope questions while old quote stays intact',async()=>{
  const {repo}=setup();let project=await add(repo,await fixture(repo));const id=project.questions[0].id;
  project=await resolve(repo,await reply(repo,project,id),id);project=await issue(repo,project);
  project=await repo.confirmNextStep(reviewNextStep(project,project.quotes[0].id,{intent:'discussion',message:'Discuss the reviewed quotation.'}));
  const nextStepId=project.nextSteps[0].id;project=await reopen(repo,project,id);
  assert.throws(()=>reviewNextStep(project,project.quotes[0].id,{intent:'engineering-review',message:'Review this.'}),{code:'CONFLICT'});
  assert.throws(()=>reviewAcknowledgement(project,{nextStepId,body:'Confirmed next step.'}),{code:'CONFLICT'});
  assert.equal(project.quotes.length,1);assert.equal(questionState(project.quotes[0].questionScope.questions[0]).status,'resolved');
});

test('legacy projects retain singular clarification, old shape, and unchanged storage on read',async()=>{
  const {repo,storage}=setup();let project=await fixture(repo,{options:false});const original=storage.getItem(PROJECT_STORAGE_KEY);
  assert.equal((await repo.getProject(project.id)).questions,undefined);assert.equal(storage.getItem(PROJECT_STORAGE_KEY),original);
  assert.equal((await repo.getQuoteDraft(project.id)).questionScope,undefined);
  project=await repo.sendReply(reviewReply(project,{kind:'clarification',body:'What quantity is required?'}));
  assert.throws(()=>reviewReply(project,{kind:'clarification',body:'Another clarification?'}),{code:'CONFLICT'});
  assert.equal(project.questionPolicy,undefined);assert.equal(project.questions,undefined);assert.equal(project.messages.length,1);
});

test('load rejects missing or patched question, event, policy, source, scope-link and issued evidence without replacing storage',async()=>{
  const {repo,storage}=setup();let project=await add(repo,await fixture(repo));const id=project.questions[0].id;
  project=await resolve(repo,await reply(repo,project,id),id);project=await issue(repo,project);const original=storage.getItem(PROJECT_STORAGE_KEY);
  const mutations=[
    p=>{delete p.questions;},p=>{delete p.questionPolicy;},p=>{p.questions=[];},p=>{p.questions[0].body='Patched opening';},
    p=>{p.questions[0].requestItem.notes='Changed original question';},p=>{p.questions[0].context.part.id='guide';},
    p=>{p.questions[0].scopeEntryId='request:mounting';},p=>{p.questions[0].events[1].body='Patched answer';},
    p=>{p.questions[0].events[1].authorRole='buyer';},p=>{p.questions[0].events.splice(1,1);},
    p=>{p.questions[0].events[1].projectRevision=p.questions[0].events[0].projectRevision;},
    p=>{delete p.quotes[0].questionScope;},p=>{p.quotes[0].questionScope.questions=[];},
    p=>{p.quotes[0].questionScope.questions[0].scopeEntryId='request:mounting';},
    p=>{p.quotes[0].questionScope.questions[0].events.pop();},
  ];
  for(const mutate of mutations){const store=JSON.parse(original);mutate(store.projects[0]);assert.throws(()=>parseProjectStore(JSON.stringify(store)),{code:'STORAGE_CORRUPT'});}
  assert.equal(storage.getItem(PROJECT_STORAGE_KEY),original);
});

test('adapter guards reject missing capability and any dropped action/source/quote evidence',async()=>{
  const {repo}=setup();let project=await fixture(repo);const review=reviewQuestion(project,{requestItemId:'motion',blocking:false,body:'A precise question.'});
  project=await repo.confirmQuestion(review,{confirmed:true});assert.equal(assertQuestionsRepository(repo),repo);assert.equal(assertQuestionRoundTrip(review,project),project);
  assert.throws(()=>assertQuestionsRepository({...repo,supportsQuestions:false}),{code:'UNSUPPORTED_QUESTIONS'});
  for(const mutate of [p=>{p.questions=[];},p=>{p.questions[0].body='Dropped text';},p=>{p.questions[0].context.part.id='guide';},p=>{p.questions[0].events=[];}]){
    const lossy=clone(project);mutate(lossy);assert.throws(()=>assertQuestionRoundTrip(review,lossy),{code:'QUESTION_DATA_LOSS'});
  }
  const draft=await repo.getQuoteDraft(project.id),saved=await repo.saveQuoteDraft(mapped(draft));assertQuestionScopeRoundTrip(draft,saved);
  const dropped=clone(saved);delete dropped.questionScope;assert.throws(()=>assertQuestionScopeRoundTrip(saved,dropped),{code:'QUESTION_DATA_LOSS'});
  await assert.rejects(repo.saveQuoteDraft(dropped),{code:'QUESTION_REVIEW_REQUIRED'});
  const wrong=clone(saved);wrong.questionScope.questions[0].scopeEntryId='request:mounting';
  await assert.rejects(repo.saveQuoteDraft(wrong),{code:'VALIDATION'});
});

test('new threads cannot bypass reviewed quotation evidence through the legacy sample quote shortcuts',async()=>{
  const {repo}=setup();const project=await add(repo,await fixture(repo,{options:false}),'motion',false);
  await assert.rejects(repo.createSampleQuote(project.id),{code:'QUESTION_REVIEW_REQUIRED'});
  await assert.rejects(repo.simulateReply(project.id,'missing'),{code:'QUESTION_REVIEW_REQUIRED'});
});

test('question roundtrip rejects a lossy project envelope before the workspace can install it',async()=>{
  const {repo}=setup();let project=await fixture(repo);
  const review=reviewQuestion(project,{requestItemId:'motion',blocking:true,body:'Keep the confirmed project intact.'});
  project=await repo.confirmQuestion(review,{confirmed:true});
  const mutations=[
    value=>{delete value.revision;},value=>{value.revision=100.5;},value=>{value.revision=Number.MAX_SAFE_INTEGER+1;},
    value=>{value.revision=review.projectRevision;},value=>{delete value.context;},value=>{value.context.modelRevision='other-source';},
    value=>{delete value.inquiry.id;},value=>{delete value.inquiry.reviewToken;},value=>{value.inquiry.reviewToken='{}';},
    value=>{value.inquiry.createdAt='not a date';},value=>{value.inquiry.values.application='A different confirmed application.';},
    value=>{delete value.createdAt;},value=>{delete value.updatedAt;},value=>{value.updatedAt='not a date';},
    ...['quotes','changes','replies','nextSteps','messages'].map(key=>value=>{delete value[key];}),
    value=>{value.messages=[{id:'duplicate'},{id:'duplicate'}];},value=>{value.quotes={};},
  ];
  for(const mutate of mutations){const corrupt=clone(project);mutate(corrupt);assert.throws(()=>assertQuestionRoundTrip(review,corrupt),{code:'QUESTION_DATA_LOSS'});}
  assert.equal(assertQuestionRoundTrip(review,project),project);
  project=await reply(repo,project,project.questions[0].id);
  // Retrying an older confirmed action may return a valid later revision; it must stay idempotent.
  const returned=await repo.confirmQuestion(review,{confirmed:true});
  assert.equal(assertQuestionRoundTrip(review,returned),returned);assert.equal(returned.questions[0].events.length,2);
});
