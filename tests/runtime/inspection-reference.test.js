import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeInspectionReference } from '../../src/explorer/inspection-reference.js';
import { DISPLAY_DEFAULTS } from '../../src/explorer/display-profiles.js';

const reference = () => {
  const model = { id: 'kinetic', revision: 'sha256:revision' };
  return { version: '1', model, view: { viewVersion: '0.1', model, coordinateFrame: 'normalized-assembly-v1', selectedId: 'part', scopeId: 'root', isolated: false, mode: 'explore', renderStyle: 'engineering', displayOptions: { ...DISPLAY_DEFAULTS }, separation: 0, operation: null,
    camera: { position: [2, 3, 8], target: [0, 0, 0], up: [0, 1, 0], projection: { kind: 'perspective', verticalFovDegrees: 42, zoom: 1, offsetX: 0, offsetY: 0 }, viewport: { width: 1200, height: 800 } } },
    preview: { dataUrl: 'data:image/png;base64,iVBORw0KGgo=', width: 480, height: 320 } };
};

test('inspection references are independent JSON pinned to the complete model revision', () => {
  const source = reference(), normalized = normalizeInspectionReference(source, { model: source.model });
  assert.deepEqual(normalized, source);
  normalized.view.camera.position[0] = 9; assert.equal(source.view.camera.position[0], 2);
  for (const model of [{ ...source.model, id: 'other' }, { ...source.model, revision: 'other' }]) assert.throws(() => normalizeInspectionReference(source, { model }), { code: 'INCOMPATIBLE_VIEW' });
});

test('unsafe JSON, ambiguous sources, malformed cameras and unbounded previews are rejected', () => {
  for (const edit of [
    value => { value.tour = {}; },
    value => { value.view.camera.position[0] = Infinity; },
    value => { value.view.camera.position = [0, 0, 0]; },
    value => { value.view.camera.up = [0, 0, 0]; },
    value => { value.view.operation = { progress: .5 }; },
    value => { value.preview.dataUrl = 'data:image/svg+xml;base64,PHN2Zz4='; },
    value => { value.preview.dataUrl = 'https://example.test/image.png'; },
    value => { value.preview.dataUrl = 'data:image/jpeg;base64,' + 'a'.repeat(120000); },
    value => { value.preview.width = 641; },
    value => { value.extra = true; },
    value => { value.view = new Date(); },
    value => { Object.defineProperty(value, 'danger', { enumerable: true, get() { throw new Error('must not read'); } }); },
    value => { value.view.camera = JSON.parse('{"__proto__":{}}'); },
  ]) {
    const source = reference(); edit(source);
    assert.throws(() => normalizeInspectionReference(source), error => ['INVALID_ARGUMENT', 'INCOMPATIBLE_VIEW'].includes(error.code));
  }
});

test('paused tours keep independent source time, camera, selected part and authored emphasis', () => {
  const source = reference(), { viewVersion, coordinateFrame, model, ...presentation } = source.view;
  delete source.view;
  source.tour = { ...presentation, tourId: 'tour', chapterId: 'drive', time: 14.2, sourceOwned: true, highlightIds: ['part'] };
  assert.deepEqual(normalizeInspectionReference(source).tour, source.tour);
  source.tour.time = -1; assert.throws(() => normalizeInspectionReference(source), { code: 'INVALID_ARGUMENT' });
});
