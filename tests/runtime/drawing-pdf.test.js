import test from 'node:test';
import assert from 'node:assert/strict';
import { createPdfDrawingView } from '../../src/drawings/pdf-reader.js';

const tick = () => new Promise(resolve => setTimeout(resolve, 5));
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const sheet = { id: 'sheet-2', title: 'Original PDF page', pdfPage: 2, viewBox: [0, 0, 800, 600], rotation: 0,
  regions: [{ id: 'bore', label: 'Bore', partId: 'body', bounds: [100, 150, 60, 40] }] };

function fixture({ autoRender = true, documentPending = false, runtimePending = false, pageCount = 2, pageWidth = 800, initialRotation = 0, onRegionDraw = () => {} } = {}) {
  const renders = [], canvases = [], views = [], selections = [], errors = [], stateChanges = [], urls = new Map(), revoked = [], requestedPages = [], runtimeWait = deferred(), documentWait = deferred();
  let loads = 0, destroyed = 0, nextURL = 0;
  const page = {
    getViewport({ scale, rotation }) { return { width: (rotation % 180 ? 600 : pageWidth) * scale, height: (rotation % 180 ? pageWidth : 600) * scale, scale, rotation }; },
    render({ canvasContext, viewport }) {
      const wait = deferred();
      const task = { promise: wait.promise, cancelled: false, viewport, canvas: canvasContext.canvas,
        resolve: wait.resolve, cancel() { task.cancelled = true; wait.reject(Object.assign(new Error('Cancelled'), { name: 'RenderingCancelledException' })); } };
      renders.push(task); if (autoRender) wait.resolve(); return task;
    },
  };
  const pdf = { numPages: pageCount, async getPage(number) { requestedPages.push(number); return page; } };
  const runtime = { loadPDFDocument(url) { loads++; return { promise: documentPending ? documentWait.promise : Promise.resolve(pdf), destroy() { destroyed++; } }; } };
  const mount = { getBoundingClientRect: () => ({ width: 800, height: 600 }) };
  const doc = { baseURI: 'https://example.test/preview/', createElement(tag) {
    assert.equal(tag, 'canvas');
    const canvas = { width: 0, height: 0, getContext() { return { canvas }; }, toBlob(callback) { callback(new Blob(['page'], { type: 'image/png' })); } };
    canvases.push(canvas); return canvas;
  } };
  function createView(options) {
    const image = { href: options.assetURL, setAttribute(key, value) { this[key] = value; } };
    const view = { options, image, element: { querySelector: () => image }, zoom: 1, selectedId: null,
      select(id, { focus } = {}) { view.selectedId = id; if (focus) view.zoomBy(2); return true; },
      setDraftBounds(value) { view.draftBounds = value; }, setInteractionMode(value) { view.mode = value; }, cancelRegionDraw() { view.drawCancelled = true; },
      focusRegion() { view.zoomBy(2); return true; },
      zoomBy(factor) { view.zoom *= factor; options.onViewChange({ zoom: view.zoom, canZoomIn: true, canZoomOut: view.zoom > 1 }); },
      fit() { view.zoom = 1; options.onViewChange({ zoom: 1 }); }, resize() { options.onViewChange({ zoom: view.zoom }); },
      dispose() { view.disposed = true; },
    };
    views.push(view); options.onViewChange({ zoom: 1, canZoomIn: true, canZoomOut: false }); return view;
  }
  const reader = createPdfDrawingView({ mount, assetURL: './source.pdf', sheet: { ...sheet, rotation: initialRotation }, document: doc,
    window: { devicePixelRatio: 2 }, loadPDF: async () => runtimePending ? runtimeWait.promise : runtime, createView, renderDelay: 0,
    URL: { createObjectURL(blob) { const url = `blob:page-${++nextURL}`; urls.set(url, blob); return url; }, revokeObjectURL(url) { revoked.push(url); urls.delete(url); } },
    onRegionDraw, onSelect: (...args) => selections.push(args), onError: error => errors.push(error), onViewChange: state => stateChanges.push(state),
  });
  return { reader, renders, canvases, views, selections, errors, stateChanges, urls, revoked, requestedPages, runtimeWait, documentWait, runtime, pdf,
    get loads() { return loads; }, get destroyed() { return destroyed; } };
}

test('PDF reader loads only its requested page and shares canonical selection with the SVG layer', async () => {
  const f = fixture();
  assert.equal(f.loads, 0, 'The runtime is lazy, not synchronously initialized at module import.');
  f.reader.select('bore'); await f.reader.ready;
  assert.deepEqual(f.requestedPages, [2]); assert.equal(f.reader.pageCount, 2);
  assert.equal(f.views[0].selectedId, 'bore'); assert.equal(f.selections.length, 0);
  f.views[0].options.onSelect('bore', { bounds: ['transformed'] });
  assert.deepEqual(f.selections[0][1].bounds, [100, 150, 60, 40]);
  assert.equal(f.canvases[0].width, 0, 'Transient canvas memory is released after encoding.');
  assert.equal(f.reader.select('unknown'), false); f.reader.dispose();
});

test('rotation keeps the authored detail ID, transforms overlay bounds, and returns canonical metadata', async () => {
  const f = fixture(); await f.reader.ready; f.reader.select('bore');
  f.reader.rotateBy(90); await tick(); await tick();
  assert.equal(f.reader.rotation, 90); assert.equal(f.views[0].disposed, true);
  assert.deepEqual(f.views.at(-1).options.sheet.viewBox, [0, 0, 600, 800]);
  assert.deepEqual(f.views.at(-1).options.sheet.regions[0].bounds, [410, 100, 40, 60]);
  assert.equal(f.renders.at(-1).viewport.rotation, 90); assert.equal(f.views.at(-1).selectedId, 'bore');
  f.views.at(-1).options.onSelect('bore');
  assert.deepEqual(f.selections.at(-1)[1].bounds, sheet.regions[0].bounds);
  assert.equal(f.urls.size, 1); f.reader.dispose();
});

test('zoom refresh replaces only drawing pixels without resetting the current pan/zoom layer', async () => {
  const f = fixture(); await f.reader.ready;
  const first = f.views[0], href = first.image.href;
  f.reader.zoomBy(2); await tick(); await tick();
  assert.equal(f.views.length, 1); assert.equal(f.reader.zoom, 2); assert.notEqual(first.image.href, href);
  assert.ok(f.revoked.includes(href)); assert.equal(f.urls.size, 1);
  assert.ok(f.renders.every(task => task.viewport.width * task.viewport.height <= 8_000_001));
  f.reader.dispose();
});

test('stale page renders are cancelled and cannot overwrite a newer rotation', async () => {
  const f = fixture({ autoRender: false }); await tick();
  assert.equal(f.renders.length, 1); f.reader.rotateBy(90); await tick();
  assert.equal(f.renders[0].cancelled, true); assert.equal(f.renders.length, 2);
  f.renders[1].resolve(); await tick();
  assert.equal(f.views.length, 1); assert.equal(f.views[0].options.sheet.rotation, 90);
  assert.equal(f.errors.length, 0); assert.equal(f.urls.size, 1);
  assert.equal(f.canvases[0].width, 0); f.reader.dispose();
});

test('dispose during runtime or document loading prevents rendering and destroys the worker transport', async () => {
  const beforeRuntime = fixture({ runtimePending: true }); beforeRuntime.reader.dispose(); beforeRuntime.runtimeWait.resolve(beforeRuntime.runtime);
  assert.equal(await beforeRuntime.reader.ready, null); assert.equal(beforeRuntime.loads, 0);
  const duringDocument = fixture({ documentPending: true }); await tick(); duringDocument.reader.dispose(); duringDocument.documentWait.resolve(duringDocument.pdf);
  assert.equal(await duringDocument.reader.ready, null); assert.equal(duringDocument.destroyed, 1); assert.equal(duringDocument.renders.length, 0);
  assert.equal(duringDocument.errors.length, 0);
});

test('dispose during raster work cancels it, releases its canvas, and never attaches artwork', async () => {
  const f = fixture({ autoRender: false }); await tick(); f.reader.dispose(); f.reader.dispose();
  assert.equal(await f.reader.ready, null); assert.equal(f.renders[0].cancelled, true);
  assert.equal(f.canvases[0].width, 0); assert.equal(f.views.length, 0); assert.equal(f.destroyed, 1);
  assert.equal(f.urls.size, 0); assert.equal(f.reader.select('bore'), false);
});

test('hidden reader work pauses, resumes and releases one current image on final disposal', async () => {
  const f = fixture(); await f.reader.ready; f.reader.pause(); f.reader.zoomBy(2); await tick();
  assert.equal(f.renders.length, 1); f.reader.resume(); await tick(); await tick();
  assert.equal(f.renders.length, 2); assert.equal(f.urls.size, 1);
  f.reader.dispose(); assert.equal(f.urls.size, 0); assert.equal(f.views[0].disposed, true);
});

test('the reader rejects mismatched source page coordinates or nonexistent pages before attaching a view', async () => {
  for (const options of [{ pageWidth: 820 }, { pageCount: 1 }]) {
    const f = fixture(options); await assert.rejects(f.reader.ready);
    assert.equal(f.views.length, 0); assert.equal(f.renders.length, 0); assert.equal(f.errors.length, 1);
    f.reader.dispose();
  }
});


test('PDF authoring returns canonical bounds and restores pending rectangles across display rotation', async () => {
  const drawn = [], f = fixture({ initialRotation: 90, onRegionDraw: rect => drawn.push(rect) });
  f.reader.setInteractionMode('draw-region'); f.reader.setDraftBounds([100, 150, 60, 40]);
  await f.reader.ready;
  assert.equal(f.views[0].options.interactionMode, 'draw-region');
  assert.deepEqual(f.views[0].draftBounds, [410, 100, 40, 60]);
  f.views[0].options.onRegionDraw([350, 200, 80, 100]);
  assert.deepEqual(drawn[0], [200, 170, 100, 80]);
  f.reader.setInteractionMode('inspect'); f.reader.rotateBy(90); await tick(); await tick();
  assert.equal(f.views[0].drawCancelled, true);
  assert.equal(f.views.at(-1).options.interactionMode, 'inspect');
  assert.deepEqual(f.views.at(-1).draftBounds, [500, 350, 100, 80]);
  f.reader.dispose();
});
