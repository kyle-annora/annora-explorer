import test from 'node:test';
import assert from 'node:assert/strict';
import {createWalkthroughActions, createAdvanceGuard, isWalkthroughActionCurrent, walkthroughHostOwnsStep} from '../src/walkthrough/actions.js';
import {createWalkthroughViewerAction} from '../src/walkthrough/viewer-action.js';
import {getWalkthroughAction} from '../src/walkthrough/actions.js';

test('a departed host cannot clear the current view action, and discovery never executes it', () => {
  const actions=createWalkthroughActions(); let calls=0, changes=0;
  const unsubscribe=actions.subscribe(()=>changes++);
  const old=actions.register('buyer',{id:'review',run:()=>calls++});
  const current=actions.register('buyer',{id:'confirm',confirmation:true,run:()=>calls++});
  old();
  assert.equal(actions.get('buyer').id,'confirm');
  assert.equal(calls,0);assert.equal(changes,2);
  current();assert.equal(actions.get('buyer'),null);
  unsubscribe();actions.register('seller',{id:'review',run:()=>{}});
  assert.equal(changes,3);
});

test('a quick repeat cannot cross review into confirmation; a later explicit activation can', async () => {
  let now=0, confirmed=0;
  const guard=createAdvanceGuard({now:()=>now});
  await guard.run(()=>{});
  assert.equal(await guard.run(()=>confirmed++),false);
  now=801;
  assert.equal(await guard.run(()=>confirmed++),true);assert.equal(confirmed,1);
});

test('Back to editing and retired review actions cannot use a cached confirmation', () => {
  const actions=createWalkthroughActions();
  actions.register('buyer',{id:'confirm',run:()=>{}});
  const review=actions.get('buyer'), lookup=owner=>actions.get(owner);
  assert.equal(isWalkthroughActionCurrent(review,'#inquiry&stage=review','#inquiry',lookup),false);
  assert.equal(isWalkthroughActionCurrent(review,'#inquiry&stage=review','#inquiry&stage=review',lookup),true);
  actions.register('buyer',{id:'confirm',run:()=>{}});
  assert.equal(isWalkthroughActionCurrent(review,'#inquiry&stage=review','#inquiry&stage=review',lookup),false);
});

test('pending and failed advances release safely without a queued next action', async () => {
  let now=0, finish, calls=0;
  const guard=createAdvanceGuard({now:()=>now});
  const first=guard.run(()=>new Promise(resolve=>{finish=resolve;}));
  now=2000;assert.equal(await guard.run(()=>calls++),false);
  finish();await first;assert.equal(guard.blocked,true);
  now=2300;await assert.rejects(guard.run(()=>{throw new Error('Review is stale');}),/stale/);
  assert.equal(calls,0);now=3200;assert.equal(guard.blocked,false);
});

test('reduced-motion presentation selects a real part before opening an inquiry, with no business write', async () => {
  const calls=[], memory=new Map(); let opened=0;
  const viewer={state:{lifecycle:'ready',operation:{status:'paused'}},pause:async()=>{},request:async(method,params)=>calls.push([method,params])};
  const host=createWalkthroughViewerAction({viewer,sessionId:'test',isActive:()=>true,openInquiry:async()=>opened++,window:{sessionStorage:{getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)},matchMedia:()=>({matches:true})}});
  host.sync();await getWalkthroughAction('buyer-viewer').run();
  assert.equal(opened,0);assert.deepEqual(calls.map(c=>c[0]),['seekOperation','select']);
  assert.equal(getWalkthroughAction('buyer-viewer').id,'inquiry-open');
  await getWalkthroughAction('buyer-viewer').run();assert.equal(opened,1);
  assert.equal(calls.at(-1)[1].nodeId,'rod');host.dispose();
  assert.equal(getWalkthroughAction('buyer-viewer'),null);
});

test('an active review, inquiry receipt, or collapsed inquiry precedes a suggested role change', () => {
  for (const host of [{id:'inquiry-confirm',confirmation:true},{id:'inquiry-project'},{id:'inquiry-resume'},
    {id:'inquiry-recovery',disabled:true},{id:'seller-review-current-reply'},{id:'seller-confirm-response',confirmation:true}]) {
    assert.equal(walkthroughHostOwnsStep(host),true,host.id);
  }
  assert.equal(walkthroughHostOwnsStep({id:'seller-review-sample-quotation'}),false);
  assert.equal(walkthroughHostOwnsStep(null),false);
});
