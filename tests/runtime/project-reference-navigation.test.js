import test from 'node:test';
import assert from 'node:assert/strict';
import { setProjectReferenceIdentity, readProjectReferenceContext } from '../../src/product-room/project-reference-navigation.js';

const a={modelId:'sk08',drawing:{revision:'A',regionId:'shaft-bore',assetSha256:'a'}};
const b={modelId:'sk08',drawing:{revision:'B',regionId:'shaft-bore',assetSha256:'b'}};
const c={modelId:'sk08',drawing:{revision:'C',regionId:'shaft-bore',assetSha256:'c'}};
const project=()=>({id:'p',context:a,impactPolicy:{version:1},inquiry:{context:a,requestItems:[{id:'request-a',context:a}]},
  quotes:[{id:'v1',context:a},{id:'v2',context:b,impactScope:{entries:[{id:'scope:request:a',context:b}]}}],
  impactReviews:[{id:'review-b',review:{context:b,decisions:[{id:'scope:request:a',context:b}]}},{id:'review-c',review:{context:c,decisions:[{id:'scope:request:a',context:c},{id:'omitted',context:null}]}}]});
const url=()=>new URL('https://example.com/product-room/?impactDemo=sk08-a-b-v1');

test('reviewed detail links resolve exact frozen quote evidence instead of the current or original context',()=>{
  const saved=project(),target=setProjectReferenceIdentity(url(),saved,b);
  assert.equal(target.searchParams.get('referenceQuote'),'v2');assert.equal(target.searchParams.get('referenceEntry'),'scope:request:a');
  assert.deepEqual(readProjectReferenceContext(saved,target.searchParams),b);
  saved.context=c;assert.deepEqual(readProjectReferenceContext(saved,target.searchParams),b);
  assert.equal(target.searchParams.has('requestItem'),false);
});

test('working details pin the reviewed decision and original requests keep their own source',()=>{
  const saved=project(),target=setProjectReferenceIdentity(url(),saved,c);
  assert.equal(target.searchParams.get('referenceReview'),'review-c');assert.deepEqual(readProjectReferenceContext(saved,target.searchParams),c);
  const original=setProjectReferenceIdentity(target,saved,a);assert.equal(original.searchParams.get('requestItem'),'request-a');assert.equal(original.searchParams.has('referenceReview'),false);
  assert.equal(readProjectReferenceContext(saved,original.searchParams),null);
});

test('unknown, omitted, duplicate and conflicting reference identities fail closed',()=>{
  for(const query of ['referenceQuote=missing','referenceReview=missing','referenceEntry=orphan','referenceQuote=v2&referenceEntry=missing','referenceReview=review-c&referenceEntry=omitted','referenceQuote=v2&referenceEntry=','referenceQuote=v2&referenceQuote=v1','referenceQuote=v2&referenceReview=review-c','referenceQuote=v2&requestItem=request-a','referenceQuote=v2&followUp=other'])
    assert.throws(()=>readProjectReferenceContext(project(),new URLSearchParams(query)),/exact reviewed reference/);
  assert.throws(()=>setProjectReferenceIdentity(url(),project(),{...b,drawing:{...b.drawing,assetSha256:'changed'}}),/exact reviewed reference/);
});

test('ordinary project URLs keep existing original-detail navigation',()=>{
  const saved=project();delete saved.impactPolicy;const target=url();target.searchParams.set('requestItem','old-detail');
  assert.equal(setProjectReferenceIdentity(target,saved,b).searchParams.get('requestItem'),'old-detail');
  assert.throws(()=>readProjectReferenceContext(saved,new URLSearchParams('referenceQuote=v2')),/exact reviewed reference/);
});
