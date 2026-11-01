import test from 'node:test';
import assert from 'node:assert/strict';
import {readBuyerRoute,buyerRouteHash,projectReturnURL} from '../src/product-room/navigation.js';

test('buyer links preserve project tab, quotation and review identity without form contents',()=>{
 const route={view:'project',projectId:'PRJ-1',tab:'activity',quoteId:'QUOTE-2',mode:'revision',stage:'review',compare:'all',secret:'not serialized'};
 const hash=buyerRouteHash(route);
 assert.equal(hash,'#project&project=PRJ-1&tab=activity&quote=QUOTE-2&mode=revision&compare=all&stage=review');
 const parsed=readBuyerRoute(hash);
 assert.deepEqual(parsed,{view:'project',projectId:'PRJ-1',tab:'activity',quoteId:'QUOTE-2',mode:'revision',stage:'review',compare:'all'});
});
test('invalid view state does not enable a submission or an unknown tab',()=>{
 const route=readBuyerRoute('#project&project=PRJ-1&tab=admin&mode=issue&stage=send');
 assert.equal(route.tab,undefined);assert.equal(route.mode,undefined);assert.equal(route.stage,undefined);
 assert.equal(buyerRouteHash({view:'inquiry',stage:'review'}),'#inquiry&stage=review');
});
test('project 3D return defaults to buyer and preserves only a matching project route',()=>{
 const base='https://example.test/annora-explorer/product-room/?model=kinetic-01';
 const buyer=projectReturnURL({base,projectId:'PRJ-1',returnView:'#project&project=PRJ-1&tab=quotation&quote=Q1'});
 assert.equal(buyer.href,'https://example.test/annora-explorer/product-room/#project&project=PRJ-1&tab=quotation&quote=Q1');
 const mismatched=projectReturnURL({base,projectId:'PRJ-1',returnView:'#project&project=OTHER'});
 assert.equal(mismatched.hash,'#project&project=PRJ-1');
});
test('seller return stays in seller role and preserves walkthrough isolation',()=>{
 const url=projectReturnURL({base:'https://example.test/annora-explorer/product-room/',projectId:'PRJ-1',role:'seller',returnView:'#project?id=PRJ-1&tab=quotation&quote=Q1',session:'WT-abcdefgh'});
 assert.equal(url.pathname,'/annora-explorer/studio/');assert.equal(url.hash,'#project?id=PRJ-1&tab=quotation&quote=Q1');assert.equal(url.searchParams.get('walkthrough'),'WT-abcdefgh');
 const external=projectReturnURL({base:url.href,projectId:'PRJ-1',role:'seller',returnView:'https://other.test/'});
 assert.equal(external.origin,'https://example.test');assert.equal(external.hash,'#project?id=PRJ-1');
});
