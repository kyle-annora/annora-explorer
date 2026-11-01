import test from 'node:test';
import assert from 'node:assert/strict';
import {walkthroughFlow,walkthroughDestination} from '../src/walkthrough/flow.js';

const base={id:'PRJ-test',quotes:[],changes:[],messages:[],nextSteps:[]};
test('presentation follows real reviewed state without inventing the next record',()=>{
  assert.equal(walkthroughFlow(null).chapter,1);
  assert.equal(walkthroughFlow(null,{hasDraft:true}).state,'inquiry');
  const saved=JSON.stringify(base);
  assert.deepEqual([walkthroughFlow(base).chapter,walkthroughFlow(base).role],[2,'seller']);
  assert.equal(JSON.stringify(base),saved);
  const v1={...base,quotes:[{id:'Q1',version:1}]};
  assert.equal(walkthroughFlow(v1).state,'change');
  const change={id:'C1',quoteId:'Q1',values:{quantity:'30',targetWeeks:'5',notes:''}};
  const requested={...v1,changes:[change]};
  assert.equal(walkthroughFlow(requested).role,'seller');
  const revised={...requested,quotes:[...v1.quotes,{id:'Q2',version:2}],messages:[{kind:'change-response',authorRole:'seller',changeId:'C1',resolutions:[{topic:'quantity',status:'accepted'},{topic:'timing',status:'alternative'}]}]};
  assert.equal(walkthroughFlow(revised).state,'compare');
  const next={...revised,nextSteps:[{id:'N1',quoteId:'Q2'}]};
  assert.equal(walkthroughFlow(next).state,'acknowledge');
  const complete={...next,messages:[...next.messages,{kind:'next-step-confirmation',nextStepId:'N1'}]};
  assert.equal(walkthroughFlow(complete).state,'complete');
});
test('a clarification remains a buyer action until answered',()=>{
  const p={...base,messages:[{id:'M1',kind:'clarification',authorRole:'seller'}]};
  assert.equal(walkthroughFlow(p).state,'question');
  assert.equal(walkthroughFlow({...p,messages:[...p.messages,{authorRole:'buyer',replyTo:'M1'}]}).state,'quotation');
});
test('handoff URLs keep session and case under the deployed repository subpath',()=>{
  const origin='https://kyle-annora.github.io/annora-explorer/walkthrough/';
  const seller=walkthroughDestination(walkthroughFlow(base),base,origin,'WT-example123');
  assert.equal(seller.pathname,'/annora-explorer/studio/');
  assert.equal(seller.searchParams.get('walkthrough'),'WT-example123');
  assert.equal(new URLSearchParams(seller.hash.split('?')[1]).get('id'),base.id);
  const p={...base,quotes:[{id:'Q1',version:1}]};
  const buyer=walkthroughDestination(walkthroughFlow(p),p,origin,'WT-example123');
  assert.equal(buyer.pathname,'/annora-explorer/product-room/');
  const hash=new URLSearchParams(buyer.hash.split('&').slice(1).join('&'));
  assert.equal(hash.get('project'),base.id);assert.equal(hash.get('quote'),'Q1');
  assert.equal(hash.get('tab'),'quotation');
});
