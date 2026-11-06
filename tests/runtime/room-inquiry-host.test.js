import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoomInquiryHost } from '../../src/product-room/inquiry-host.js';
import { createWalkthroughActions } from '../../src/walkthrough/actions.js';
import { inquiryWalkthroughAction } from '../../src/walkthrough/inquiry-action.js';
import { createWalkthroughRepository } from '../../src/walkthrough/session.js';
import { createInquirySession } from '../../src/product-room/inquiry-session.js';
import { prepareSampleInquiry } from '../../src/product-room/inquiry-sample.js';
import { DEFAULT_INQUIRY_PROFILE } from '../../src/product-room/inquiry-profile.js';
import { PROJECT_STORAGE_KEY } from '../../src/product-room/project-repository.js';

const context = { productId:'kinetic-01',productTitle:'Crank-slider mechanism',modelId:'kinetic-01',modelRevision:'kinetic-r1',part:{id:'rod',title:'Connecting rod'} };
const summary = {open:true,expanded:true,busy:false,hasDraft:true,stage:'details'};

test('Room lazily injects the exact namespace, retires actions on suspension, and resumes one panel', async () => {
  const actions = createWalkthroughActions(), calls = [], repository = {mode:'walkthrough'};
  let options, loads = 0, saved = true;
  const panel = {
    open: async value => { calls.push(value); options.onState({...summary}); },
    beforeLeave: async () => saved,
    suspend: () => options.onState({...summary,open:false,expanded:false}),
    getContext: () => context,
    dispose: async () => saved,
  };
  const host = createRoomInquiryHost({element:{},repository,register:(...args)=>actions.register(...args),
    loadPanel: async () => { loads++; return {mountEmbeddedInquiry:async (_,value)=>{options=value;return panel;}}; },
  });
  assert.equal(loads,0);
  await host.open({context,stage:'details'});
  assert.equal(options.repository,repository); assert.equal(options.allowAnother,false);
  assert.equal(actions.get('buyer-workspace').id,'inquiry-review');
  saved=false;
  assert.equal(await host.beforeLeave(),false);
  assert.equal(actions.get('buyer-workspace').id,'inquiry-review');
  assert.equal(await host.dispose(),false);
  saved=true; assert.equal(await host.beforeLeave(),true); host.suspend();
  assert.equal(actions.get('buyer-workspace'),null);
  await host.open({context,stage:'review'});
  assert.equal(loads,1); assert.equal(calls.length,2); assert.deepEqual(host.getContext(),context);
  await host.dispose(); assert.equal(actions.get('buyer-workspace'),null);
});

test('leaving during a lazy mount waits for that panel and its save verdict', async () => {
  let resolveMount, saveCalls=0;
  const host=createRoomInquiryHost({element:{},repository:{mode:'preview'},loadPanel:()=>new Promise(resolve=>{resolveMount=resolve;})});
  const opened=host.open({context}), leaving=host.beforeLeave();
  resolveMount({mountEmbeddedInquiry:async()=>({open:async()=>{},beforeLeave:async()=>{saveCalls++;return false;}})});
  await opened; assert.equal(await leaving,false); assert.equal(saveCalls,1);
});

test('a collapsed review resumes only; busy and conflict states never provide a confirmation', async () => {
  const calls=[],panel={resume:()=>calls.push('resume'),confirm:()=>calls.push('confirm')};
  const action=inquiryWalkthroughAction({state:{...summary,stage:'review',expanded:false},panel});
  assert.equal(action.id,'inquiry-resume'); assert.equal(action.confirmation,undefined);
  await action.run(); assert.deepEqual(calls,['resume']);
  for (const state of [{...summary,busy:true},{...summary,stage:'review',errorCode:'STALE_REVIEW'}]) {
    const blocked=inquiryWalkthroughAction({state,panel});
    assert.equal(blocked.disabled,true); assert.equal(blocked.confirmation,undefined);
    await blocked.run(); assert.deepEqual(calls,['resume']);
  }
});

test('demo review and explicit confirmation share one session and never touch ordinary project storage', async () => {
  const data=new Map([[PROJECT_STORAGE_KEY,'ordinary records stay unchanged']]);
  const storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};
  let serial=0;
  const repository=createWalkthroughRepository('WT-room-inquiry-001',{storage,locks:null,makeId:prefix=>`${prefix}-${++serial}`});
  const session=createInquirySession({repository,schedule:()=>0,cancel:()=>{}});
  await session.open({context});
  const panel={
    review:async({fillSample})=>{assert.equal(fillSample,true);const draft=prepareSampleInquiry(session.getState().draft);session.updateValues(draft.values);session.updateRequirements(draft.requirements);await session.review();},
    confirm:()=>session.confirm(),
  };
  const prepare=inquiryWalkthroughAction({state:summary,panel});
  assert.equal(prepare.confirmation,undefined); await prepare.run();
  assert.equal(session.getState().stage,'review'); assert.equal((await repository.listProjects()).length,0);
  const confirm=inquiryWalkthroughAction({state:{...summary,stage:'review'},panel});
  assert.equal(confirm.confirmation,true); await confirm.run();
  const projects=await repository.listProjects(); assert.equal(projects.length,1);
  assert.equal(projects[0].context.part.id,'rod'); assert.equal((await repository.listDrafts()).length,0);
  assert.equal(data.get(PROJECT_STORAGE_KEY),'ordinary records stay unchanged');
  await confirm.run(); assert.equal((await repository.listProjects()).length,1);
  session.dispose();
});

test('fictional preparation preserves entered intent and requirements and honors disabled fields', () => {
  const profile={...DEFAULT_INQUIRY_PROFILE,fields:DEFAULT_INQUIRY_PROFILE.fields.map(field=>({...field,enabled:field.id==='load'?false:field.enabled}))};
  const draft={context:{...context,inquiryProfile:profile},values:{intent:'application-review',quoteScope:'part',application:'My entered need',stroke:'90',load:''},requirements:[]};
  const prepared=prepareSampleInquiry(draft);
  assert.equal(prepared.values.intent,'application-review'); assert.equal(prepared.values.application,'My entered need');
  assert.equal(prepared.values.stroke,'90'); assert.equal(prepared.values.load,''); assert.deepEqual(prepared.requirements,[]);
  assert.deepEqual(draft.requirements,[]); assert.equal(draft.values.quantity,undefined);
});
