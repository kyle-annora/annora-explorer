import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesTechnicalBinding } from '../../src/drawing-preview/technical-policy.js';

const prepared = {
  id: 'source-drawing', revision: 'source-A', modelId: 'paired-part', modelRevision: 'sha256:model-A', mappingRevision: 'map-1',
  assets: [{ id: 'pdf', kind: 'pdf', sha256: 'pdf-A' }, { id: 'step', kind: 'step', sha256: 'step-A' }],
  sheets: [{ id: 'sheet-1', assetId: 'pdf', pdfPage: 1, rotation: 0, viewBox: [0, 0, 800, 600], regions: [
    { id: 'large-bore', partId: 'part-body', mappingStatus: 'confirmed', bounds: [100, 180, 50, 50], focusPoint: [.1, .2, .3],
      camera: { target: [.1, .2, .3], direction: [0, 1, 2], halfSize: [.01, .02, .03] } },
    { id: 'small-bore', partId: 'part-body', mappingStatus: 'confirmed', bounds: [220, 190, 30, 30], focusPoint: [.4, .5, .6],
      camera: { target: [.4, .5, .6], direction: [0, 2, 1], halfSize: [.02, .03, .04] } },
  ] }],
};
const later = () => ({ ...structuredClone(prepared), mappingRevision: 'map-2' });
const eligible = (value, region = 'large-bore', unavailable = false) => matchesTechnicalBinding(value, prepared, 'sheet-1', region, unavailable);

test('a new association edition can reuse unchanged geometry without replacing its identity or mutating snapshots', () => {
  const drawing = later(), before = structuredClone(drawing), sourceBefore = structuredClone(prepared);
  assert.equal(eligible(drawing), true);
  assert.equal(eligible(drawing, 'small-bore'), true);
  assert.equal(drawing.mappingRevision, 'map-2', 'eligibility must never substitute the prepared map-1 identity');
  assert.deepEqual(drawing, before); assert.deepEqual(prepared, sourceBefore);
  assert.equal(eligible({ ...drawing, mappingRevision: '' }), false);
  assert.equal(eligible(drawing, 'large-bore', true), false, 'unresolved source identity remains ineligible');
});

test('any selected-feature engineering change invalidates the prepared highlight and camera', () => {
  const mutations = [
    ['bounds', region => { region.bounds[0] += 1; }],
    ['part', region => { region.partId = 'another-part'; }],
    ['focus', region => { region.focusPoint[2] += .001; }],
    ['missing focus', region => { delete region.focusPoint; }],
    ['camera target', region => { region.camera.target[0] += .001; }],
    ['camera direction', region => { region.camera.direction[1] += .1; }],
    ['camera extent', region => { region.camera.halfSize[2] *= 2; }],
    ['missing camera', region => { delete region.camera; }],
    ['ambiguous mapping', region => { region.mappingStatus = 'ambiguous'; }],
    ['unconfirmed mapping', region => { region.mappingStatus = 'needs-review'; }],
  ];
  for (const [reason, mutate] of mutations) {
    const drawing = later(); mutate(drawing.sheets[0].regions[0]);
    assert.equal(eligible(drawing), false, reason);
    assert.equal(eligible(drawing, 'small-bore'), true, `${reason} must not disable an unchanged sibling feature`);
  }
});

test('source assets, model versions and page coordinates cannot be inherited across changed source documents', () => {
  const mutations = [
    ['drawing ID', drawing => { drawing.id = 'another-drawing'; }],
    ['source revision', drawing => { drawing.revision = 'source-B'; }],
    ['model ID', drawing => { drawing.modelId = 'another-model'; }],
    ['model revision', drawing => { drawing.modelRevision = 'sha256:model-B'; }],
    ['PDF hash', drawing => { drawing.assets[0].sha256 = 'pdf-B'; }],
    ['STEP hash', drawing => { drawing.assets[1].sha256 = 'step-B'; }],
    ['asset kind', drawing => { drawing.assets[0].kind = 'svg'; }],
    ['missing source asset', drawing => { drawing.assets.pop(); }],
    ['sheet source', drawing => { drawing.sheets[0].assetId = 'another-pdf'; }],
    ['source page', drawing => { drawing.sheets[0].pdfPage = 2; }],
    ['page rotation', drawing => { drawing.sheets[0].rotation = 90; }],
    ['page frame', drawing => { drawing.sheets[0].viewBox[0] = 20; }],
  ];
  for (const [reason, mutate] of mutations) {
    const drawing = later(); mutate(drawing);
    for (const region of ['large-bore', 'small-bore']) assert.equal(eligible(drawing, region), false, `${reason}: ${region}`);
  }
});

test('per-feature eligibility does not require unrelated regions or display copy to remain unchanged', () => {
  const drawing = later();
  drawing.sheets[0].regions[0].label = 'Reviewed bore name';
  drawing.sheets[0].regions[0].note = 'Additional discussion context, without changed engineering coordinates.';
  drawing.sheets[0].regions.splice(1, 1);
  delete drawing.sheets[0].rotation;
  assert.equal(eligible(drawing), true);
  assert.equal(eligible(drawing, 'small-bore'), false);
  assert.equal(eligible(drawing, 'unknown-region'), false);
  assert.equal(matchesTechnicalBinding(drawing, prepared, 'unknown-sheet', 'large-bore'), false);
  assert.equal(matchesTechnicalBinding(null, prepared, 'sheet-1', 'large-bore'), false);
  assert.equal(matchesTechnicalBinding(drawing, null, 'sheet-1', 'large-bore'), false);
});
