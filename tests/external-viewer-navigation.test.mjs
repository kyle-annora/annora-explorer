import test from 'node:test';
import assert from 'node:assert/strict';
import { externalViewerReferenceURL, externalViewerReturnURL, readExternalViewerReference } from '../src/product-room/external-viewer-navigation.js';

const sessionId = 'WTI-abcdefgh';
const base = 'https://example.test/annora-explorer/product-room/';
function context(position = [1,2,3]) {
  return {productId:'kinetic-01',productTitle:'Crank-slider mechanism',productRevision:'independent-viewer-product-v1',modelId:'kinetic-01',modelRevision:'geometry-a',
    part:{id:'connecting-rod',title:'Connecting rod'},viewerReference:{version:'1',adapter:{id:'annora-example-three-viewer',version:'1',coordinateFrame:'source-meters-y-up-v1'},
      product:{id:'kinetic-01',revision:'independent-viewer-product-v1'},model:{id:'kinetic-01',revision:'geometry-a'},snapshot:{camera:{position,target:[0,0,0]}}}};
}
function project() {
  const original = context(), revised = context([3,2,1]);
  return {id:'PRJ-1',context:original,inquiry:{context:original,requestItems:[{id:'ITEM-1',context:context([2,3,4])}]},
    quotes:[{id:'Q1',version:1,context:original},{id:'Q2',version:2,context:revised}]};
}

test('buyer and seller references reopen the original independent viewer at the deployment root', () => {
  for (const path of ['product-room/','studio/','integrations/existing-viewer/']) {
    const item = project();
    const url = externalViewerReferenceURL({base:`https://example.test/annora-explorer/${path}`,sessionId,project:item,context:item.context,quoteId:'Q1',role:'buyer',returnView:'#project&project=PRJ-1&tab=quotation&quote=Q1'});
    assert.equal(url.pathname,'/annora-explorer/integrations/existing-viewer/');
    assert.equal(url.searchParams.get('walkthrough'),sessionId);
    assert.equal(url.searchParams.get('referenceQuote'),'Q1');
    assert.equal(url.searchParams.get('returnView'),'#project&project=PRJ-1&tab=quotation&quote=Q1');
    assert.equal(url.searchParams.has('inspection'),false);
    assert.equal(url.href.includes('camera'),false);
  }
});

test('quotation versions reopen their own exact snapshots without changing project evidence', () => {
  const item = project(), before = structuredClone(item);
  for (const quote of item.quotes) {
    const url = externalViewerReferenceURL({base,sessionId,project:item,context:quote.context,quoteId:quote.id});
    assert.equal(url.searchParams.get('referenceQuote'),quote.id);
    const saved = readExternalViewerReference(item,url.searchParams);
    assert.deepEqual(saved,quote.context);
    assert.equal(saved.inspection,undefined);
    saved.viewerReference.snapshot.camera.position[0] = 99;
    assert.deepEqual(item,before);
  }
});

test('requested component views retain their own exact evidence', () => {
  const item = project(), detail = item.inquiry.requestItems[0];
  const url = externalViewerReferenceURL({base,sessionId,project:item,context:detail.context});
  assert.equal(url.searchParams.get('requestItem'),'ITEM-1');
  assert.deepEqual(readExternalViewerReference(item,url.searchParams),detail.context);
});

test('an explicit quotation identity never falls back to another quotation or inquiry', () => {
  const item = project();
  for (const quoteId of ['missing','Q2',''])
    assert.throws(() => externalViewerReferenceURL({base,sessionId,project:item,context:item.context,quoteId}),{code:'EXTERNAL_REFERENCE_UNAVAILABLE'});
  assert.throws(() => externalViewerReferenceURL({base,sessionId,project:item,context:item.inquiry.requestItems[0].context,quoteId:'Q1'}),{code:'EXTERNAL_REFERENCE_UNAVAILABLE'});
  const detail = item.inquiry.requestItems[0];
  item.quotes[0].scopeSelection = {entries:[{id:'SCOPE-1',context:detail.context}]};
  const url = externalViewerReferenceURL({base,sessionId,project:item,context:detail.context,quoteId:'Q1'});
  assert.equal(url.searchParams.get('referenceQuote'),'Q1');
  assert.equal(url.searchParams.get('referenceEntry'),'SCOPE-1');
  assert.equal(url.searchParams.has('requestItem'),false);
  assert.deepEqual(readExternalViewerReference(item,url.searchParams),detail.context);
});

test('missing or ambiguous record identities fail rather than substituting the project view', () => {
  const item = project();
  for (const search of ['project=OTHER','project=PRJ-1&project=PRJ-1','project=PRJ-1&referenceQuote=missing',
    'project=PRJ-1&referenceQuote=Q1&requestItem=ITEM-1','project=PRJ-1&referenceEntry=entry',
    'project=PRJ-1&referenceQuote=Q1&referenceQuote=Q2','project=PRJ-1&referenceReview=review'])
    assert.throws(() => readExternalViewerReference(item,new URLSearchParams(search)),{code:'EXTERNAL_REFERENCE_UNAVAILABLE'});
});

test('unsupported adapters and another session type cannot silently open native Explorer', () => {
  const item = project();
  assert.throws(() => externalViewerReferenceURL({base,sessionId:'WT-abcdefgh',project:item}),{code:'EXTERNAL_REFERENCE_UNAVAILABLE'});
  const unsupported = structuredClone(item); unsupported.context.viewerReference.adapter.id = 'other-viewer'; unsupported.inquiry.context = unsupported.context;
  assert.throws(() => readExternalViewerReference(unsupported,new URLSearchParams('project=PRJ-1')),{code:'EXTERNAL_REFERENCE_UNAVAILABLE'});
  assert.throws(() => externalViewerReferenceURL({base,sessionId,project:item,context:context([8,8,8])}),{code:'EXTERNAL_REFERENCE_UNAVAILABLE'});
});

test('return stays in the same session and exact buyer quotation or seller review', () => {
  const source = 'https://example.test/annora-explorer/integrations/existing-viewer/?walkthrough=ignored';
  const buyer = externalViewerReturnURL({base:source,sessionId,projectId:'PRJ-1',returnView:'#project&project=PRJ-1&tab=quotation&quote=Q1&compare=all'});
  assert.equal(buyer.pathname,'/annora-explorer/product-room/');
  assert.equal(buyer.hash,'#project&project=PRJ-1&tab=quotation&quote=Q1&compare=all');
  assert.equal(buyer.searchParams.get('walkthrough'),sessionId);
  const seller = externalViewerReturnURL({base:source,sessionId,projectId:'PRJ-1',role:'seller',returnView:'#project?id=PRJ-1&tab=quotation&mode=quote-review&quote=Q2&draft=D2'});
  assert.equal(seller.pathname,'/annora-explorer/studio/');
  assert.equal(seller.hash,'#project?id=PRJ-1&tab=quotation&mode=quote-review&quote=Q2&draft=D2');
  assert.equal(seller.searchParams.get('walkthrough'),sessionId);
});

test('return rejects foreign destinations and conflicting project IDs by falling back to the same project', () => {
  for (const role of ['seller','buyer']) for (const returnView of ['https://foreign.test/','#project? id=PRJ-1','#project?id=OTHER','#project&project=OTHER']) {
    const url = externalViewerReturnURL({base,sessionId,projectId:'PRJ-1',role,returnView});
    assert.equal(url.origin,'https://example.test');
    assert.equal(url.hash,role === 'seller' ? '#project?id=PRJ-1' : '#project&project=PRJ-1');
  }
});
