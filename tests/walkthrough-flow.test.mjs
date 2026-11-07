import test from 'node:test';
import assert from 'node:assert/strict';
import {walkthroughFlow,walkthroughDestination,walkthroughRootURL,walkthroughViewerURL} from '../src/walkthrough/flow.js';

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

test('independent introduction describes supported selection while commercial gates remain shared',()=>{
  const independent=walkthroughFlow(null,{viewer:'independent'});
  assert.equal(independent.chapter,1);assert.equal(independent.state,'explore');
  assert.match(independent.title,/existing viewer/);assert.match(independent.note,/model version/);
  assert.doesNotMatch(independent.note,/cycle|motion|animate/);
  assert.deepEqual(walkthroughFlow(base,{viewer:'independent'}),walkthroughFlow(base));
  assert.equal(walkthroughFlow(null,{viewer:'independent',hasDraft:true}).state,'inquiry');
});

test('root resolution preserves deployment subpaths from nested and direct entry points',()=>{
  for (const suffix of ['walkthrough/','studio/','product-room/','integrations/existing-viewer/','integrations/existing-viewer/index.html','index.html','']) {
    const root=walkthroughRootURL(`https://example.com/custom/demo/${suffix}?project=P1#project`);
    assert.equal(root.href,'https://example.com/custom/demo/',suffix);
  }
  assert.equal(walkthroughRootURL('https://example.com/studio/').href,'https://example.com/');
  assert.equal(walkthroughRootURL('https://example.com/my-studio/').href,'https://example.com/my-studio/');
});

test('independent session returns to its own viewer and hands one saved case between buyer and seller',()=>{
  const session='WTI-independent-0001', origin='https://example.com/custom/demo/integrations/existing-viewer/?walkthrough=old&project=old';
  for (const hasDraft of [false,true]) {
    const url=walkthroughDestination(walkthroughFlow(null,{viewer:'independent',hasDraft}),null,origin,session);
    assert.equal(url.pathname,'/custom/demo/integrations/existing-viewer/');
    assert.equal(url.searchParams.get('walkthrough'),session);
    assert.equal(url.searchParams.has('project'),false);assert.equal(url.hash,'');
  }
  const seller=walkthroughDestination(walkthroughFlow(base),base,origin,session);
  assert.equal(seller.pathname,'/custom/demo/studio/');assert.equal(seller.searchParams.get('walkthrough'),session);
  assert.equal(new URLSearchParams(seller.hash.split('?')[1]).get('id'),base.id);
  const project={...base,quotes:[{id:'Q1',version:1}]};
  const buyer=walkthroughDestination(walkthroughFlow(project),project,seller,session);
  assert.equal(buyer.pathname,'/custom/demo/product-room/');assert.equal(buyer.searchParams.get('walkthrough'),session);
  assert.equal(new URLSearchParams(buyer.hash.split('&').slice(1).join('&')).get('project'),base.id);
  const back=walkthroughViewerURL(buyer,session);
  assert.equal(back.pathname,'/custom/demo/integrations/existing-viewer/');
  assert.equal(back.searchParams.get('walkthrough'),session);
  const native=walkthroughViewerURL(origin,'WT-native0001');
  assert.equal(native.pathname,'/custom/demo/product-room/');assert.equal(native.hash,'#explore');
  assert.equal(native.searchParams.get('model'),'kinetic-01');
  assert.throws(()=>walkthroughViewerURL(origin,'bad'),{code:'WALKTHROUGH_SESSION_INVALID'});
});
