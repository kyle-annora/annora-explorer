import test from 'node:test';
import assert from 'node:assert/strict';
import { impactReferenceRows } from '../src/product-room/impact-scope-presentation.js';

const reference = label => ({ drawing: { revision: `hash-${label}`, revisionLabel: label, regionLabel: 'Shaft bore' } });
test('reviewed evidence permits a B scope and A question without replacing the original source', () => {
  const snapshot = { reviewId:'review-1', entries:[
    {id:'scope:request:bore',kind:'scope',recordId:'bore',originalContext:reference('A'),context:reference('B'),decision:'confirmed',lineIds:['inspection'],reason:'Reviewed relocated view.'},
    {id:'question:question-1',kind:'question',recordId:'question-1',originalContext:reference('A'),context:reference('A'),decision:'retained',lineIds:[],reason:'Keep the initial question on A.'},
  ] };
  const before = JSON.stringify(snapshot);
  const rows = impactReferenceRows(snapshot,[{id:'inspection',label:'Bore inspection review'}]);
  assert.match(rows[0].versionLabel,/^B/);
  assert.match(rows[1].versionLabel,/^A/);
  assert.equal(rows[0].originalContext.drawing.revisionLabel,'A');
  assert.equal(rows[0].lines[0].label,'Bore inspection review');
  assert.equal(rows[1].decisionLabel,'Earlier reference retained');
  assert.equal(JSON.stringify(snapshot),before);
});
test('old quotations without impact evidence have no invented review; missing lines and omitted source remain explicit', () => {
  assert.deepEqual(impactReferenceRows(undefined),[]);
  const rows=impactReferenceRows({entries:[{kind:'scope',decision:'omitted',context:null,lineIds:[]},{kind:'scope',decision:'confirmed',context:reference('B'),lineIds:['deleted']}]});
  assert.equal(rows[0].versionLabel,'No replacement reference');
  assert.equal(rows[0].decisionLabel,'Excluded from new scope');
  assert.deepEqual(rows[1].lines,[{id:'deleted',label:'Unavailable quotation line'}]);
});
