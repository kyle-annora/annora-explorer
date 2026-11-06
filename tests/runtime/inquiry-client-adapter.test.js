import test from 'node:test';
import assert from 'node:assert/strict';
import { createInquirySession } from '../../src/product-room/inquiry-session.js';
import { createDemoProjectRepository } from '../../src/product-room/project-repository.js';
import { normalizeInquiryPresentation, inquiryPresentationError, inquiryFieldVisible } from '../../src/product-room/inquiry-presentation.js';

const context={productId:'client-study',productTitle:'Illustrative client application',modelId:'client-model',modelRevision:'client-model-r1'};
function setup(prepare) {
  const data=new Map(),calls=[];
  const base=createDemoProjectRepository({storage:{getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)},locks:null});
  let serial=0, currentReview;
  const repository={...base,
    async prepareInquiryReview(draft) {calls.push('prepare');currentReview=prepare ? await prepare(draft) : {token:`client-review-${++serial}`,draft,payload:{objective:draft.values.application,unknowns:['Receiving interface']},sourceReview:{token:`brief-${serial}`,draftVersion:draft.revision}};return currentReview;},
    async submitInquiry(packet) {calls.push('confirm');assert.deepEqual(packet,currentReview);return {id:'client-project',context:packet.draft.context,inquiry:{values:packet.draft.values},sourceReview:packet.sourceReview};},
  };
  return {calls,base,session:createInquirySession({repository,schedule:()=>0,cancel:()=>{}})};
}

test('client preparation precedes visible review and exact token/payload reach confirmation without another preparation',async()=>{
  const {session,calls}=setup();
  await session.open({context,suggestedIntent:'application-review'});
  session.updateValues({application:'Review the tube receiving interface.'});
  assert.deepEqual(calls,[]);
  const packet=await session.review();
  assert.deepEqual(calls,['prepare']);assert.equal(session.getState().stage,'review');
  assert.deepEqual(session.getState().review,packet);assert.equal(packet.sourceReview.token,'brief-1');
  const project=await session.confirm();assert.equal(project.sourceReview.token,'brief-1');
  assert.deepEqual(calls,['prepare','confirm']);
  await session.confirm();assert.deepEqual(calls,['prepare','confirm']);session.dispose();
});

test('editing an adapter review requires a new token and never confirms the previous review',async()=>{
  const {session,calls}=setup();await session.open({context,suggestedIntent:'application-review'});
  session.updateValues({application:'Initial objective'});const first=await session.review();
  session.edit();session.updateValues({application:'Updated objective'});
  await assert.rejects(session.confirm(),{code:'STALE_REVIEW'});
  const second=await session.review();assert.notEqual(second.token,first.token);
  assert.equal(second.payload.objective,'Updated objective');await session.confirm();
  assert.deepEqual(calls,['prepare','prepare','confirm']);session.dispose();
});

test('failed or mismatched client preparation retains input without reaching confirmation',async()=>{
  for(const prepare of [async()=>{throw new Error('Brief review unavailable');},async draft=>({token:'wrong',draft:{...draft,values:{...draft.values,application:'Different hidden value'}}}),async draft=>({draft})]) {
    const {session,calls}=setup(prepare);await session.open({context,suggestedIntent:'application-review'});session.updateValues({application:'Keep these customer details'});
    await assert.rejects(session.review());assert.equal(session.getState().stage,'details');assert.equal(session.getState().draft.values.application,'Keep these customer details');
    await assert.rejects(session.confirm(),{code:'STALE_REVIEW'});assert.deepEqual(calls,['prepare']);session.dispose();
  }
});

test('client presentation can narrow fields and wording without changing standard rules or old intent',()=>{
  const standard=normalizeInquiryPresentation();assert.equal(standard.labels.confirmButton,'Confirm demo inquiry');assert.equal(standard.fixedIntent,null);assert.equal(inquiryFieldVisible(standard,'quantity'),true);
  const brief=normalizeInquiryPresentation({fixedIntent:'application-review',fields:['application','notes','name','email'],fieldLabels:{application:'Handling objective'},showScope:false,labels:{confirmButton:'Confirm application brief'},renderReview:()=>null});
  assert.equal(brief.labels.confirmButton,'Confirm application brief');assert.equal(brief.fieldLabels.application,'Handling objective');assert.equal(inquiryFieldVisible(brief,'quantity'),false);
  const saved={values:{intent:'quotation',quantity:'12'}};
  assert.match(inquiryPresentationError(brief,saved),/different request purpose/);assert.equal(saved.values.intent,'quotation');
  assert.throws(()=>normalizeInquiryPresentation({fields:['application']}),/fixed application-review/);
  assert.throws(()=>normalizeInquiryPresentation({fixedIntent:'application-review',fields:['notes']}),/include application/);
  assert.throws(()=>normalizeInquiryPresentation({labels:{unknown:'value'}}),/Invalid inquiry label/);
});
