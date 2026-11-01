import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createDrawingRegionView, focusDrawingRegion, normalizeDrawingPoint } from '../src/drawing-preview/model-views.js';

const drawing = JSON.parse(await readFile(new URL('../content/drawings/linkrods/drawing.json', import.meta.url)));
const regions = Object.fromEntries(drawing.sheets[0].regions.map(region => [region.id, region]));
const bookmark = (width = 1200, height = 700) => ({
  viewVersion: '0.1', coordinateFrame: 'normalized-assembly-v1', model: { id: 'linkrods', revision: 'test-source-revision' },
  selectedId: 'linkrods', scopeId: 'linkrods', isolated: false, mode: 'explore', separation: 0, operation: null,
  renderStyle: 'linework', displayOptions: { edges: true },
  camera: { position: [5, 8, 12], target: [0, 0, 0], up: [0, 1, 0], projection: { kind: 'perspective', verticalFovDegrees: 15, zoom: 1, offsetX: 0, offsetY: 0 }, viewport: { width, height }, layoutKey: `${width}:${height}` },
});
const distance = camera => Math.hypot(...camera.position.map((value, axis) => value - camera.target[axis]));

test('source bounds map to the exact 4.4-unit assembly frame; bores stay on opposite ends', () => {
  const low = normalizeDrawingPoint([0.0031250000465661287, 0, -0.004000000189989805]);
  const high = normalizeDrawingPoint([0.008145284838974476, 0.0020000000949949026, -0.0024999999441206455]);
  assert.ok(Math.abs(low[0] + 2.2) < 1e-12);
  assert.ok(Math.abs(high[0] - 2.2) < 1e-12);
  assert.ok(normalizeDrawingPoint(regions['large-bore'].focusPoint)[0] < 0);
  assert.ok(normalizeDrawingPoint(regions['small-bore'].focusPoint)[0] > 0);
});

test('detail views preserve appearance and projection, remain on the real solid and do not compound zoom', () => {
  const original = bookmark(), before = structuredClone(original);
  const large = createDrawingRegionView(original, regions['large-bore']);
  const repeated = createDrawingRegionView(large, regions['large-bore']);
  assert.deepEqual(original, before);
  assert.deepEqual(large, repeated);
  assert.equal(large.selectedId, 'linkrod-body');
  assert.equal(large.renderStyle, original.renderStyle);
  assert.deepEqual(large.displayOptions, original.displayOptions);
  assert.deepEqual(large.camera.projection, original.camera.projection);
  assert.equal(large.camera.layoutKey, original.camera.layoutKey);
  assert.ok(distance(large.camera) < distance(createDrawingRegionView(original, regions.overview).camera));
});

test('portrait framing increases distance enough to retain the same detail window', () => {
  const wide = createDrawingRegionView(bookmark(1200, 700), regions['large-bore']);
  const narrow = createDrawingRegionView(bookmark(360, 640), regions['large-bore']);
  assert.ok(distance(narrow.camera) > distance(wide.camera));
  assert.deepEqual(narrow.camera.target, wide.camera.target);
  assert.throws(() => createDrawingRegionView({ ...bookmark(), model: { id: 'apollo' } }, regions['large-bore']), { code: 'INCOMPATIBLE_VIEW' });
});

test('rapid explicit choices skip stale queued selections; only the last region restores', async () => {
  const calls = [];
  const viewer = { request: async (method, params) => { calls.push([method, params]); return method === 'captureView' ? bookmark() : { restored: true }; } };
  const first = focusDrawingRegion(viewer, regions['large-bore']);
  const second = focusDrawingRegion(viewer, regions['small-bore']);
  assert.equal((await first).superseded, true);
  assert.equal((await second).regionId, 'small-bore');
  assert.deepEqual(calls.map(call => call[0]), ['captureView', 'restoreView', 'captureView']);
  assert.deepEqual(calls[1][1].bookmark.camera.target, normalizeDrawingPoint(regions['small-bore'].focusPoint));
});

test('a briefly unsettled camera retries capture, without changing render mode or selection first', async () => {
  let captures = 0; const methods = [];
  const viewer = { request: async method => { methods.push(method); if (method === 'captureView' && ++captures === 1) throw Object.assign(new Error('settling'), { code: 'BUSY_STATE' }); return method === 'captureView' ? bookmark() : { restored: true }; } };
  assert.equal((await focusDrawingRegion(viewer, regions['connecting-web'])).focused, true);
  assert.deepEqual(methods, ['captureView', 'captureView', 'restoreView', 'captureView']);
});


test('one fresh restore handles action controls changing the public layout during initial restore', async () => {
  let current = bookmark(), restores = 0; const methods = [];
  const viewer = { request: async (method, params) => {
    methods.push(method);
    if (method === 'captureView') return structuredClone(current);
    current = structuredClone(params.bookmark);
    if (++restores === 1) {
      // The actual runtime fits the whole model instead of a stale-layout view.
      current.camera.layoutKey = '1200:640:action-controls';
      current.camera.viewport.height = 640;
      current.camera.target = [0, 0, 0];
    }
    return { restored: true };
  } };
  assert.equal((await focusDrawingRegion(viewer, regions['large-bore'])).focused, true);
  assert.equal(restores, 2);
  assert.deepEqual(methods, ['captureView', 'restoreView', 'captureView', 'restoreView']);
  assert.deepEqual(current.camera.target, normalizeDrawingPoint(regions['large-bore'].focusPoint));
  assert.equal(current.camera.layoutKey, '1200:640:action-controls');
  assert.equal(current.renderStyle, 'linework');
});

test('a second prepared model uses data-authored cameras and remains stable along the camera-up axis', async () => {
  const pkg=JSON.parse(await readFile(new URL('../content/drawings/sk08/package.json',import.meta.url)));
  const metadata=JSON.parse(await readFile(new URL('../content/models/sk08/metadata.json',import.meta.url)));
  const manifest=JSON.parse(await readFile(new URL('../content/models/sk08/manifest.json',import.meta.url)));
  const model={id:manifest.id,rootId:manifest.rootId,normalizeWidth:manifest.view.normalizedWidth,bounds:metadata.bounds,parts:metadata.parts};
  const region=structuredClone(pkg.sheets[1].regions[0]);region.camera.direction=[0,1,0];
  const original={...bookmark(),model:{id:manifest.id,revision:pkg.modelRevision}};
  const result=createDrawingRegionView(original,region,model);
  assert.equal(result.selectedId,'sk08-body');assert.equal(result.scopeId,'sk08');
  assert.ok(result.camera.position.every(Number.isFinite));assert.ok(result.camera.up.every(Number.isFinite));
  assert.deepEqual(result.camera.target,normalizeDrawingPoint(region.camera.target,model));
  assert.equal(result.renderStyle,original.renderStyle);
  assert.ok(Math.abs(result.camera.up[1])<1e-9,'framing avoids a singular up/direction pair');
});
