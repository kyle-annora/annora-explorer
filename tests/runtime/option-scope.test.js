import test from 'node:test';
import assert from 'node:assert/strict';
import {createDemoProjectRepository,parseProjectStore,PROJECT_STORAGE_KEY} from '../../src/product-room/project-repository.js';
import {reviewInquiry,compareQuotes} from '../../src/product-room/project-domain.js';
import {reviewQuote} from '../../src/product-room/seller-domain.js';
import {reviewOptionSet,reviewOptionPreference,adoptCurrentOptionPreference,quoteScopeErrors} from '../../src/product-room/option-scope-domain.js';
import {assertOptionScopeRepository,assertOptionScopeRoundTrip,assertOptionPreferenceRoundTrip} from '../../src/product-room/option-scope-repository.js';
import {sampleInquiryValues} from '../../src/product-room/project-fixtures.js';
const clone=value=>structuredClone(value);
const context={productId:'kinetic-01',modelId:'kinetic-01',modelRevision:'test-revision',productTitle:'Crank-slider mechanism'};
function setup(){let seq=0,blocked=false;const data=new Map();const storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>{if(blocked)throw Error('Quota');data.set(key,value);}};return {storage,data,block:value=>{blocked=value;},repo:createDemoProjectRepository({storage,locks:null,now:()=> '2026-11-06T12:00:00.000Z',makeId:prefix=>`${prefix}-${++seq}`})};}
async function fixture(repo){let draft=await repo.getDraft(context);draft.values={...draft.values,...sampleInquiryValues(context)};draft.requestItems=[{id:'motion',purpose:'review',notes:'Review connecting rod clearance.',context:{...context,part:{id:'rod',title:'Connecting rod'}}},{id:'mounting',purpose:'question',notes:'Review the guide interface.',context:{...context,part:{id:'guide',title:'Linear guide'}}}];draft=await repo.saveDraft(draft);let project=await repo.submitInquiry(reviewInquiry(draft));const set={id:'prepared-packages',version:1,kind:'scope-packages',title:'Two fictional review packages',disclaimer:'Fictional service packages. Geometry, suitability, price and availability are not confirmed.',context:clone(project.context),options:[{id:'focused',title:'Focused review',description:'Review the linkage.',status:'available',requestItemIds:['motion'],facts:[{label:'Scope',value:'Connecting rod discussion'}]},{id:'combined',title:'Combined review',description:'Review linkage and mounting.',status:'available',requestItemIds:['motion','mounting'],facts:[{label:'Scope',value:'Linkage and guide discussion'}]}]};return repo.approveOptionSet(reviewOptionSet(project,set),{confirmed:true});}
async function choose(repo,project,optionId='focused'){return repo.confirmOptionPreference(reviewOptionPreference(project,{choice:optionId?'option':'help-me-decide',optionId,notes:'Please review this preference.'}),{confirmed:true});}
function resolved(draft){return {...draft,scopeSelection:{...draft.scopeSelection,entries:draft.scopeSelection.entries.map(entry=>({...entry,disposition:'included',lineIds:entry.id==='request:motion'?draft.values.lineItems.slice(0,2).map(line=>line.id):[draft.values.lineItems[0].id],rationale:'Prepared demonstration review scope.'}))}};}
async function issue(repo,project){let draft=resolved(await repo.getQuoteDraft(project.id));draft=await repo.saveQuoteDraft(draft);return repo.issueQuote(reviewQuote(project,draft));}

test('comparison reads and review do not change inquiry; explicit preference confirmation appends and repeats idempotently',async()=>{const {repo,storage}=setup();let project=await fixture(repo);const before=clone(project),raw=storage.getItem(PROJECT_STORAGE_KEY),review=reviewOptionPreference(project,{choice:'option',optionId:'focused',notes:''});assert.equal(storage.getItem(PROJECT_STORAGE_KEY),raw);assert.deepEqual(await repo.getProject(project.id),before);await assert.rejects(repo.confirmOptionPreference(review),{code:'CONFIRMATION_REQUIRED'});const changed=clone(review);changed.optionId='combined';await assert.rejects(repo.confirmOptionPreference(changed,{confirmed:true}),{code:'STALE_REVIEW'});project=await repo.confirmOptionPreference(review,{confirmed:true});assert.equal(project.optionPreferences.length,1);assert.deepEqual(project.inquiry,before.inquiry);assert.deepEqual(project.context,before.context);assert.deepEqual(await repo.confirmOptionPreference(review,{confirmed:true}),project);assert.deepEqual((await repo.getProject(project.id)).optionPreferences,project.optionPreferences);});

test('help me decide, missing and withdrawn options, stale confirmation and storage failure are explicit',async()=>{const {repo,storage,block}=setup();let project=await fixture(repo);assert.throws(()=>reviewOptionPreference(project,{choice:'option',optionId:'missing'}),{code:'VALIDATION'});const withdrawn=clone(project);withdrawn.approvedOptionSet.options[0].status='withdrawn';assert.throws(()=>reviewOptionPreference(withdrawn,{choice:'option',optionId:'focused'}),{code:'VALIDATION'});const stale=reviewOptionPreference(project,{choice:'option',optionId:'focused'});const raw=storage.getItem(PROJECT_STORAGE_KEY);block(true);await assert.rejects(repo.confirmOptionPreference(stale,{confirmed:true}),{code:'STORAGE_UNAVAILABLE'});assert.equal(storage.getItem(PROJECT_STORAGE_KEY),raw);block(false);project=await choose(repo,project,null);assert.equal(project.optionPreferences.at(-1).choice,'help-me-decide');assert.equal(project.optionPreferences.at(-1).optionId,null);await assert.rejects(repo.confirmOptionPreference(stale,{confirmed:true}),{code:'STALE_REVIEW'});});

test('one request maps to multiple stable lines; unresolved scope and removed linked lines block reviewed issuance',async()=>{const {repo}=setup();let project=await choose(repo,await fixture(repo));let draft=resolved(await repo.getQuoteDraft(project.id));const mounting=draft.scopeSelection.entries.find(entry=>entry.requestItemId==='mounting');mounting.disposition='needs-clarification';mounting.lineIds=[];draft=await repo.saveQuoteDraft(draft);assert.throws(()=>reviewQuote(project,draft),error=>!!error.fields['scopeSelection.entries.request:mounting']);assert.equal((await repo.getProject(project.id)).quotes.length,0);mounting.rationale='Specific mounting design is outside this review.';mounting.disposition='excluded';draft.scopeSelection.entries.find(entry=>entry.requestItemId==='mounting').rationale=mounting.rationale;draft.scopeSelection.entries.find(entry=>entry.requestItemId==='mounting').disposition='excluded';draft=await repo.saveQuoteDraft(draft);const review=reviewQuote(project,draft);assert.equal(review.draft.scopeSelection.entries[0].lineIds.length,2);const removed={...draft,values:{...draft.values,lineItems:draft.values.lineItems.slice(1)}};const saved=await repo.saveQuoteDraft(removed);assert.throws(()=>reviewQuote(project,saved),error=>!!error.fields['scopeSelection.entries.request:motion']);await assert.rejects(repo.issueQuote(review),{code:'STALE_REVIEW'});});

test('v2 retains v1 source until explicit adoption; issued preference, part references, prices and history survive copies',async()=>{const {repo,storage}=setup();let project=await choose(repo,await fixture(repo));const inquiry=clone(project.inquiry),firstPreference=clone(project.optionPreferences[0]);project=await issue(repo,project);const first=clone(project.quotes[0]);assert.equal(first.scopeSelection.preference.id,firstPreference.id);assert.equal(first.lineItems[0].unitPrice,null);assert.equal(first.total,null);project=await choose(repo,project,'combined');let draft=await repo.getQuoteDraft(project.id);assert.deepEqual(draft.scopeSelection,first.scopeSelection);assert.ok(quoteScopeErrors(project,draft).scopeSelection);await assert.rejects(repo.saveQuoteDraft(draft),{code:'SCOPE_REVIEW_REQUIRED'});draft=adoptCurrentOptionPreference(project,draft);assert.equal(draft.scopeSelection.entries.find(entry=>entry.id==='preference').disposition,'needs-clarification');assert.deepEqual(draft.scopeSelection.entries.find(entry=>entry.requestItemId==='motion'),first.scopeSelection.entries.find(entry=>entry.requestItemId==='motion'));draft=await repo.saveQuoteDraft(resolved(draft));project=await repo.issueQuote(reviewQuote(project,draft));assert.equal(project.quotes.length,2);assert.deepEqual(project.quotes[0],first);assert.deepEqual(project.optionPreferences[0],firstPreference);assert.deepEqual(project.inquiry,inquiry);assert.equal(project.quotes[1].scopeSelection.preference.optionId,'combined');assert.deepEqual(project.quotes[1].scopeSelection.entries[0].context,project.inquiry.requestItems[0].context);assert.ok(compareQuotes(first,project.quotes[1],project).find(row=>row.key==='option-preference').changed);assert.deepEqual(parseProjectStore(storage.getItem(PROJECT_STORAGE_KEY)).projects[0].quotes,project.quotes);});

test('missing adapter metadata and changed pinned history fail rather than silently normalizing away',async()=>{const {repo,storage}=setup();let project=await choose(repo,await fixture(repo));const draft=await repo.getQuoteDraft(project.id);const missing=clone(draft);delete missing.scopeSelection;await assert.rejects(repo.saveQuoteDraft(missing),{code:'SCOPE_REVIEW_REQUIRED'});assert.throws(()=>assertOptionScopeRepository({...repo,supportsOptionScope:false}),{code:'UNSUPPORTED_OPTIONS'});assert.throws(()=>assertOptionScopeRoundTrip(draft,missing),{code:'SCOPE_DATA_LOSS'});project=await issue(repo,project);for(const corrupt of [store=>{store.projects[0].optionPreferences[0].notes='Changed history';},store=>{store.projects[0].quotes[0].scopeSelection.entries[0].context.part.id='guide';},store=>{delete store.projects[0].quotes[0].scopeSelection;},store=>{store.projects[0].approvedOptionSet.options[0].title='Changed package';}]){const store=JSON.parse(storage.getItem(PROJECT_STORAGE_KEY));corrupt(store);assert.throws(()=>parseProjectStore(JSON.stringify(store)),{code:'STORAGE_CORRUPT'});}});

test('legacy stores remain unchanged on read and scope-less projects retain the ordinary quotation flow',async()=>{const {repo,storage}=setup();const project=await repo.createSampleInquiry(context),before=storage.getItem(PROJECT_STORAGE_KEY);const {quoteDraft,...savedProject}=project;assert.deepEqual(await repo.getProject(project.id),savedProject);assert.equal(storage.getItem(PROJECT_STORAGE_KEY),before);assert.equal((await repo.getQuoteDraft(project.id)).scopeSelection,undefined);});

test('a new preference in another tab invalidates an already saved quotation review without losing v1 or the seller draft',async()=>{
  const {repo,storage}=setup();let project=await choose(repo,await fixture(repo));
  project=await issue(repo,project);const v1=clone(project.quotes[0]);
  let draft=await repo.getQuoteDraft(project.id);draft=await repo.saveQuoteDraft(draft);
  const oldReview=reviewQuote(project,draft);
  const second=createDemoProjectRepository({storage,locks:null});
  project=await choose(second,await second.getProject(project.id),'combined');
  await assert.rejects(repo.issueQuote(oldReview),{code:'STALE_REVIEW'});
  const loaded=await repo.getProject(project.id);
  assert.deepEqual(loaded.quotes,[v1]);assert.equal(loaded.optionPreferences.length,2);
  const saved=await repo.getQuoteDraft(project.id);
  assert.deepEqual(saved.scopeSelection,v1.scopeSelection);
  assert.equal(saved.revision,draft.revision);
  assert.deepEqual(saved.values,draft.values);
});

test('duplicate option identities, duplicate request sources and a changed original context never become approved',async()=>{
  const {repo}=setup();const project=await fixture(repo);
  for(const mutate of [set=>{set.options[1].id=set.options[0].id;},set=>{set.options[0].requestItemIds=['motion','motion'];},set=>{set.options[0].requestItemIds=['outside-project'];},set=>{set.context.modelRevision='different-model';}]){
    const set=clone(project.approvedOptionSet);mutate(set);
    assert.throws(()=>reviewOptionSet({...project,approvedOptionSet:undefined},set),{code:'VALIDATION'});
  }
  await assert.rejects(repo.approveOptionSet({...reviewOptionSet({...project,approvedOptionSet:undefined},project.approvedOptionSet)}),{code:'CONFIRMATION_REQUIRED'});
  assert.deepEqual((await repo.getProject(project.id)).approvedOptionSet,project.approvedOptionSet);
});

test('scope disposition is explicit and optional work is never inferred from pricing or labels',async()=>{
  const {repo}=setup();const project=await choose(repo,await fixture(repo));
  const draft=await repo.getQuoteDraft(project.id);
  assert.ok(draft.scopeSelection.entries.every(entry=>entry.disposition==='needs-clarification'));
  const selection=clone(draft);selection.scopeSelection.entries[0].disposition='optional';
  assert.ok(quoteScopeErrors(project,selection)['scopeSelection.entries.request:motion']);
  selection.scopeSelection.entries[0].lineIds=[selection.values.lineItems[0].id];
  assert.equal(quoteScopeErrors(project,selection)['scopeSelection.entries.request:motion'],undefined);
  selection.scopeSelection.entries[1].disposition='excluded';
  assert.ok(quoteScopeErrors(project,selection)['scopeSelection.entries.request:mounting']);
  selection.scopeSelection.entries[1].rationale='Outside this prepared service scope.';
  assert.equal(quoteScopeErrors(project,selection)['scopeSelection.entries.request:mounting'],undefined);
  assert.deepEqual(selection.values.lineItems,draft.values.lineItems);
  await assert.rejects(repo.createSampleQuote(project.id),{code:'SCOPE_REVIEW_REQUIRED'});
});


test('a lossy preference adapter cannot report success when a confirmed event or its source is missing',async()=>{
  const {repo}=setup();const project=await fixture(repo),review=reviewOptionPreference(project,{choice:'option',optionId:'focused',notes:'Keep this note.'});
  const confirmed=await repo.confirmOptionPreference(review,{confirmed:true});
  assert.deepEqual(assertOptionPreferenceRoundTrip(review,confirmed),confirmed);
  for(const mutate of [value=>{value.optionPreferences=[];},value=>{value.optionPreferences[0].context.modelRevision='other';},value=>{value.optionPreferences[0].notes='Dropped note';}]){
    const lossy=clone(confirmed);mutate(lossy);assert.throws(()=>assertOptionPreferenceRoundTrip(review,lossy),{code:'SCOPE_DATA_LOSS'});
  }
});
