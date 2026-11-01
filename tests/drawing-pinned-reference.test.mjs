import test from 'node:test';
import assert from 'node:assert/strict';
import { requestedDrawingIssues } from '../src/drawings/pinned-reference.js';

const pkg = {revision:'B',mappingRevision:'map-B',assets:[{id:'pdf-B',sha256:'hash-B'}],sheets:[{id:'page-2',assetId:'pdf-B',regions:[{id:'bore-B'}]}]};
test('a pinned release cannot substitute a missing sheet/detail or ignore a mismatched mapping/hash', () => {
  for (const query of ['sheet=deleted', 'detail=removed', 'drawing=A', 'mapping=map-A', 'asset=hash-A'])
    assert.ok(requestedDrawingIssues(pkg,new URLSearchParams(query)).length,query);
  assert.deepEqual(requestedDrawingIssues(pkg,new URLSearchParams('sheet=page-2&detail=bore-B&drawing=B&mapping=map-B&asset=hash-B')),[]);
});
test('only omitted query fields use the current default; explicit empty values remain invalid', () => {
  assert.deepEqual(requestedDrawingIssues(pkg,new URLSearchParams()),[]);
  for (const key of ['sheet','detail','drawing','mapping','asset']) assert.ok(requestedDrawingIssues(pkg,new URLSearchParams(`${key}=`)).length,key);
});
