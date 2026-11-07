import test from 'node:test';
import assert from 'node:assert/strict';
import { describeViewerAdapter } from '../../src/integration-kit/contract.js';
import { normalizeViewerReference, copyViewerJSON } from '../../src/integration-kit/viewer-reference.js';
import { createIntegrationController } from '../../src/integration-kit/controller.js';
import { normalizeProjectContext, createInquiryDraft, normalizeInquiryDraft, projectContextKey } from '../../src/product-room/project-domain.js';
import { requestDraftKey } from '../../src/product-room/request-state.js';
import { normalizeRequestItems } from '../../src/product-room/request-items.js';

const context = { productId: 'host-product', productTitle: 'Host assembly', productRevision: 'release-a', modelId: 'host-geometry', modelRevision: 'geometry-1' };
const part = { id: 'mount', title: 'Mounting plate' };
const snapshot = { selectedPartId: part.id, camera: { position: [1, 2, 3], target: [0, 0, 0], up: [0, 1, 0], projection: { kind: 'perspective', fov: 45 } } };
const reference = () => ({ version: '1', adapter: { id: 'independent-viewer', version: '1', coordinateFrame: 'source-metres-v1' }, product: { id: context.productId, revision: context.productRevision }, model: { id: context.modelId, revision: context.modelRevision }, snapshot: structuredClone(snapshot) });
const adapter = (changes = {}) => ({ version: '1', id: 'independent-viewer', adapterVersion: '1', coordinateFrame: 'source-metres-v1',
  capabilities: { inquiry: true, selectedPart: true, capturedView: true, drawingDetail: false, story: false },
  capture: async () => ({ part: structuredClone(part), snapshot: structuredClone(snapshot) }), restore: async () => {}, ...changes });
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }

test('independent capture uses host coordinates and exact identities without fabricating inspection', async () => {
  let restored;
  const controller = createIntegrationController({ adapter: adapter({ restore: async value => { restored = value; } }), context });
  const captured = await controller.captureContext();
  assert.equal(captured.inspection, undefined);
  assert.deepEqual(captured.viewerReference, reference());
  assert.deepEqual(captured.part, part);
  assert.deepEqual(await controller.restoreContext(captured), captured);
  assert.deepEqual(restored, snapshot);
  restored.camera.position[0] = 999;
  assert.equal(captured.viewerReference.snapshot.camera.position[0], 1);
  controller.dispose();
});

test('inquiry-only adapters do not fabricate a camera or call a renderer', async () => {
  const only = adapter({ capabilities: { story: false, inquiry: true, drawingDetail: false, capturedView: false, selectedPart: false }, capture: undefined, restore: undefined });
  const controller = createIntegrationController({ adapter: only, context: { ...context, part } });
  assert.deepEqual(await controller.captureContext(), context);
  await assert.rejects(controller.restoreContext(context), { code: 'UNSUPPORTED_CAPABILITY' });
  assert.equal(controller.capabilities().inquiry, true);
  controller.dispose();
});

test('part-only capability attaches selection without claiming to restore a camera', async () => {
  const controller = createIntegrationController({ adapter: adapter({ capabilities: { inquiry: true, selectedPart: true, capturedView: false, drawingDetail: false, story: false }, capture: async () => ({ part }) }), context });
  assert.deepEqual(await controller.captureContext(), { ...context, part });
  await assert.rejects(controller.restoreContext(context), { code: 'UNSUPPORTED_CAPABILITY' });
});

test('supported drawing and story metadata use existing versioned inquiry contracts', async () => {
  const drawing = { id: 'drawing', title: 'Host assembly drawing', revision: 'drawing-a', assetId: 'drawing-source', assetRevision: 'source-sha256',
    partId: part.id, sheetId: 'sheet-1', sheetTitle: 'Mounting view', regionId: 'bore', regionLabel: 'Mounting bore',
    sourceURL: 'https://example.com/drawing-a.pdf', mappingRevision: 'mapping-1' };
  const chapter = { id: 'mounting', title: 'Mounting arrangement', tourId: 'host-story-a' };
  const controller = createIntegrationController({ adapter: adapter({ capabilities: { inquiry: true, selectedPart: true, capturedView: true, drawingDetail: true, story: true },
    capture: async () => ({ snapshot, part, drawing, chapter, document: { id: drawing.id, title: drawing.title, revision: drawing.revision } }) }), context });
  const saved = await controller.captureContext();
  assert.deepEqual(saved.drawing, drawing); assert.deepEqual(saved.chapter, chapter);
  assert.equal(saved.document.revision, 'drawing-a');
  assert.deepEqual(await controller.restoreContext(saved), saved);
  controller.dispose();
});

test('descriptor requires known version, explicit booleans and implemented capabilities', () => {
  assert.throws(() => describeViewerAdapter(adapter({ version: '2' })), { code: 'UNSUPPORTED_ADAPTER_VERSION' });
  assert.throws(() => describeViewerAdapter(adapter({ capture: undefined })), { code: 'INVALID_ADAPTER' });
  assert.throws(() => describeViewerAdapter(adapter({ restore: undefined })), { code: 'INVALID_ADAPTER' });
  assert.throws(() => describeViewerAdapter(adapter({ capabilities: { inquiry: true } })), { code: 'INVALID_ADAPTER' });
  const descriptor = describeViewerAdapter(adapter());
  assert.equal(Object.isFrozen(descriptor.capabilities), true);
});

for (const field of ['chapter', 'drawing', 'document']) test(`unsupported ${field} capture rejects rather than removing metadata`, async () => {
  const controller = createIntegrationController({ adapter: adapter({ capture: async () => ({ snapshot, [field]: { id: 'unsupported' } }) }), context });
  await assert.rejects(controller.captureContext(), { code: 'UNSUPPORTED_CAPABILITY' });
});

test('missing snapshot, null snapshot and unexpected adapter output fail explicitly', async () => {
  for (const result of [{ part }, { snapshot: null }, { snapshot, inspection: {} }]) {
    const controller = createIntegrationController({ adapter: adapter({ capture: async () => result }), context });
    await assert.rejects(controller.captureContext(), { code: 'INVALID_REFERENCE' });
  }
});

test('unknown reference versions and unknown schema fields are rejected without mutation', () => {
  const input = reference(); input.version = '2';
  const before = structuredClone(input);
  assert.throws(() => normalizeViewerReference(input, context), { code: 'UNSUPPORTED_REFERENCE_VERSION' });
  assert.deepEqual(input, before);
  assert.throws(() => normalizeViewerReference({ ...reference(), futureField: 'x' }, context), { code: 'INVALID_REFERENCE' });
  assert.throws(() => normalizeProjectContext({ ...context, viewerReference: input }), /unsupported reference version/);
});

test('JSON boundary rejects cycles, huge state, foreign objects, getters and prototype keys', () => {
  const cyclic = {}; cyclic.self = cyclic;
  let invoked = false;
  const accessor = {}; Object.defineProperty(accessor, 'value', { enumerable: true, get() { invoked = true; return 1; } });
  for (const value of [cyclic, accessor, new Date(), { value: Infinity }, { value: undefined }, { value: 1n }, { value: () => {} },
    new Array(2), Array(257).fill(1), { value: 'a'.repeat(8193) }, JSON.parse('{"__proto__":{"x":1}}'), Object.fromEntries(Array.from({length: 129}, (_, i) => [`k${i}`, i]))])
    assert.throws(() => copyViewerJSON(value), { code: 'INVALID_REFERENCE' });
  assert.equal(invoked, false);
  assert.throws(() => copyViewerJSON({ values: Array(20).fill('🌏'.repeat(2048)) }), /64 KiB/);
  assert.deepEqual(copyViewerJSON({ values: [0, false, null, ''] }), { values: [0, false, null, ''] });
});

test('a product, model, adapter or coordinate revision mismatch never restores', async () => {
  let calls = 0;
  const controller = createIntegrationController({ adapter: adapter({ restore: async () => calls++ }), context });
  const captured = await controller.captureContext();
  for (const key of ['productRevision', 'modelRevision']) {
    const changed = structuredClone(captured); changed[key] = 'new';
    changed.viewerReference[key === 'productRevision' ? 'product' : 'model'].revision = 'new';
    await assert.rejects(controller.restoreContext(changed), { code: 'IDENTITY_MISMATCH' });
  }
  for (const key of ['id', 'version', 'coordinateFrame']) {
    const changed = structuredClone(captured); changed.viewerReference.adapter[key] = 'different';
    await assert.rejects(controller.restoreContext(changed), { code: 'INCOMPATIBLE_ADAPTER' });
  }
  assert.equal(calls, 0);
});

test('capture result becomes stale when a newer capture starts, even if adapter ignores abort', async () => {
  const first = deferred(); let calls = 0, oldSignal;
  const controller = createIntegrationController({ adapter: adapter({ capture: async ({ signal }) => { if (++calls === 1) { oldSignal = signal; return first.promise; } return { snapshot }; } }), context });
  const old = controller.captureContext(); const rejection = assert.rejects(old, { code: 'STALE_OPERATION' });
  await tick(); const current = await controller.captureContext(); await rejection;
  assert.equal(oldSignal.aborted, true);
  first.resolve({ snapshot: { stale: true } }); await tick();
  assert.deepEqual(current.viewerReference.snapshot, snapshot);
});

test('timeouts abort capture, preserve the caller reference and allow explicit retry', async () => {
  let calls = 0, timedSignal;
  const controller = createIntegrationController({ adapter: adapter({ capture: async ({ signal }) => { timedSignal = signal; if (++calls === 1) return new Promise(() => {}); return { snapshot }; } }), context, timeoutMs: 5 });
  await assert.rejects(controller.captureContext(), { code: 'VIEWER_TIMEOUT' });
  assert.equal(timedSignal.aborted, true);
  assert.deepEqual((await controller.captureContext()).viewerReference.snapshot, snapshot);
});

test('cancel and dispose reject pending restore and never dispose the host viewer', async () => {
  let signal, disposed = 0;
  const controller = createIntegrationController({ adapter: adapter({ restore: async (_, options) => { signal = options.signal; return new Promise(() => {}); }, dispose: () => disposed++ }), context });
  const saved = await controller.captureContext();
  const restoring = controller.restoreContext(saved); const rejected = assert.rejects(restoring, { code: 'CANCELLED' });
  await tick(); controller.cancel(); await rejected; assert.equal(signal.aborted, true);
  const pending = controller.restoreContext(saved); const closed = assert.rejects(pending, { code: 'DISPOSED' });
  await tick(); controller.dispose(); controller.dispose(); await closed;
  await assert.rejects(controller.captureContext(), { code: 'DISPOSED' });
  assert.equal(disposed, 0);
});

test('external AbortSignal cancels work and its listener is cleaned up', async () => {
  const outer = new AbortController(), listeners = new Set();
  const signal = { get aborted() { return outer.signal.aborted; }, addEventListener: (type, fn) => { listeners.add(fn); outer.signal.addEventListener(type, fn); }, removeEventListener: (type, fn) => { listeners.delete(fn); outer.signal.removeEventListener(type, fn); } };
  const controller = createIntegrationController({ adapter: adapter({ capture: async () => new Promise(() => {}) }), context });
  const pending = controller.captureContext({ signal }); const rejected = assert.rejects(pending, { code: 'CANCELLED' });
  await tick(); outer.abort(); await rejected;
  assert.equal(listeners.size, 0);
  await assert.rejects(controller.captureContext({ signal }), { code: 'CANCELLED' });
});

test('existing context and draft keys retain exact shape while external revisions stay distinct', () => {
  const legacy = { ...context }; delete legacy.productRevision;
  assert.deepEqual(normalizeProjectContext(legacy), legacy);
  assert.equal(projectContextKey(legacy), JSON.stringify([legacy.productId, legacy.modelId, legacy.modelRevision, null, null]));
  const saved = { ...context, part, viewerReference: reference() };
  assert.deepEqual(normalizeInquiryDraft(createInquiryDraft(saved, 'draft')).context, saved);
  const newRevision = { ...context, productRevision: 'release-b' };
  assert.notEqual(projectContextKey(saved), projectContextKey(newRevision));
  assert.notEqual(requestDraftKey(saved), requestDraftKey(newRevision));
  assert.throws(() => normalizeRequestItems([{ id: 'q1', purpose: 'question', notes: 'Question', context: newRevision }], saved), { code: 'INCOMPATIBLE_CONTEXT' });
  assert.throws(() => normalizeProjectContext({ ...saved, productRevision: 'release-b' }), /another product or model/);
});
