import { createDrawingView } from '../drawing-preview/drawing-view.js';
import { normalizeRotation, pdfRasterSize, rotateSheet } from './coordinates.js';

const lazyPDF = () => import('./pdf-runtime.js');
const cancelled = error => error?.name === 'RenderingCancelledException' || error?.name === 'AbortException' || error?.name === 'AbortError';
const releaseCanvas = canvas => { if (canvas) { canvas.width = 0; canvas.height = 0; } };
const blobFromCanvas = canvas => new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('The drawing page could not be prepared.')), 'image/png'));

/** Original-PDF reader with the same DOM pan/zoom and selectable region layer
 * as the prepared-SVG viewer. The host owns page selection and navigation.
 * ready settles after the first visible page, or null when disposed early. */
export function createPdfDrawingView({ mount, assetURL, sheet, showOverview = false, onSelect = () => {}, onViewChange = () => {}, onError = () => {},
  document: doc = globalThis.document, window: win = globalThis.window, ResizeObserver = globalThis.ResizeObserver,
  maxPixels = 8_000_000, maxDimension = 4096, loadPDF = lazyPDF, createView = createDrawingView,
  URL: objectURLs = globalThis.URL, renderDelay = 100 } = {}) {
  if (!mount?.getBoundingClientRect || !doc?.createElement) throw new TypeError('A drawing mount and browser document are required.');
  if (!Number.isInteger(sheet?.pdfPage) || sheet.pdfPage < 1) throw new TypeError('A one-based PDF page is required.');
  const source = new URL(assetURL, doc.baseURI || win?.location?.href || 'http://localhost/');
  if (!['http:', 'https:', 'blob:'].includes(source.protocol)) throw new TypeError('A PDF must use a local or HTTP source URL.');
  let disposed = false, suspended = false, generation = 0, rotation = normalizeRotation(sheet.rotation || 0);
  let loadingTask = null, pdfDocument = null, page = null, view = null, activeRender = null, currentURL = null;
  let renderTimer = null, selectedId = null, pendingFocus = false, lastRaster = '', renderedRotation = null, lastError = null;
  let resolveReady, rejectReady;
  let lastView = { zoom: 1, canZoomIn: true, canZoomOut: false };
  const clearTimer = () => { if (renderTimer !== null) { clearTimeout(renderTimer); renderTimer = null; } };
  const notify = () => { if (!disposed) onViewChange({ ...lastView, rotation, loading: !!activeRender || !view, error: lastError }); };
  const reportError = error => { if (!disposed && !cancelled(error)) { lastError = error; if (!view) rejectReady?.(error); notify(); onError(error); } };

  function rasterRequest() {
    const displaySheet = rotateSheet(sheet, rotation), rect = mount.getBoundingClientRect();
    const [, , width, height] = displaySheet.viewBox;
    const fit = Math.min(Math.max(1, rect.width - 40) / width, Math.max(1, rect.height - 40) / height);
    const zoom = renderedRotation === rotation ? (view?.zoom || 1) : 1;
    const size = pdfRasterSize({ width, height, scale: fit * zoom, pixelRatio: win?.devicePixelRatio || 1, maxPixels, maxDimension });
    return { displaySheet, size, key: `${rotation}:${size.width}:${size.height}` };
  }

  function scheduleRender() {
    if (disposed || suspended || !page) return;
    const next = rasterRequest();
    if (next.key === lastRaster || (next.key === activeRender?.key && !activeRender.cancelled)) return;
    clearTimer();
    // Invalidate immediately; a slower previous render cannot replace the page
    // during the debounce window after a newer zoom or rotation request.
    generation += 1;
    if (activeRender) { activeRender.cancelled = true; activeRender.task.cancel(); }
    renderTimer = setTimeout(() => { renderTimer = null; renderPage().catch(reportError); }, renderDelay);
  }

  function makeView(displaySheet, url) {
    const keepSelection = selectedId;
    view?.dispose(); view = null;
    view = createView({ mount, assetURL: url, sheet: displaySheet, showOverview, document: doc, window: win, ResizeObserver,
      onSelect(id) {
        selectedId = id;
        const canonicalRegion = sheet.regions.find(region => region.id === id);
        if (canonicalRegion) onSelect(id, canonicalRegion);
      },
      onViewChange(state) { lastView = state; notify(); scheduleRender(); }, onError: reportError,
    });
    if (keepSelection !== null) view.select(keepSelection, { focus: pendingFocus });
    pendingFocus = false;
  }

  async function renderPage() {
    if (disposed || suspended || !page) return null;
    const token = ++generation, request = rasterRequest();
    if (request.key === lastRaster) return view;
    const previous = activeRender;
    previous?.task.cancel();
    if (previous) await previous.task.promise.catch(() => {});
    if (disposed || suspended || token !== generation) return null;
    const canvas = doc.createElement('canvas');
    canvas.width = request.size.width; canvas.height = request.size.height;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) { releaseCanvas(canvas); throw new Error('This browser could not create a drawing canvas.'); }
    let task;
    try {
      const viewport = page.getViewport({ scale: request.size.scale, rotation });
      task = page.render({ canvasContext: context, viewport, background: '#ffffff' });
    } catch (error) { releaseCanvas(canvas); throw error; }
    const job = { task, canvas, key: request.key };
    activeRender = job; lastError = null; notify();
    try {
      await task.promise;
      if (disposed || suspended || token !== generation) return null;
      const blob = await blobFromCanvas(canvas);
      if (disposed || suspended || token !== generation) return null;
      const nextURL = objectURLs.createObjectURL(blob), previousURL = currentURL;
      currentURL = nextURL; lastRaster = request.key;
      if (!view || renderedRotation !== rotation) {
        renderedRotation = rotation;
        makeView(request.displaySheet, nextURL);
      } else {
        // Preserve the user's exact pan and zoom when replacing only pixels.
        view.element.querySelector('image').setAttribute('href', nextURL);
      }
      if (previousURL) objectURLs.revokeObjectURL(previousURL);
      resolveReady(controller);
      return view;
    } catch (error) {
      if (!cancelled(error) && token === generation && !disposed && !suspended) throw error;
      return null;
    } finally {
      releaseCanvas(canvas);
      if (activeRender === job) activeRender = null;
      notify();
    }
  }

  async function initialize() {
    try {
      const runtime = await loadPDF();
      if (disposed) return null;
      loadingTask = runtime.loadPDFDocument(source.href);
      pdfDocument = await loadingTask.promise;
      if (disposed) { pdfDocument = null; return null; }
      if (sheet.pdfPage > pdfDocument.numPages) throw new Error('This sheet references a page that does not exist in its PDF.');
      page = await pdfDocument.getPage(sheet.pdfPage);
      if (disposed) { page = null; return null; }
      const canonical = page.getViewport({ scale: 1, rotation: 0 });
      const [, , width, height] = sheet.viewBox;
      if (Math.abs(canonical.width - width) > .1 || Math.abs(canonical.height - height) > .1)
        throw new Error('The PDF page dimensions do not match the authored region coordinates. Reconfirm the document version and page mapping.');
      if (!suspended) await renderPage();
      if (disposed) resolveReady(null);
    } catch (error) { reportError(error); if (disposed || cancelled(error)) resolveReady(null); else rejectReady(error); }
  }

  const controller = {
    select(id, { focus = false } = {}) {
      if (disposed || (id !== null && !sheet.regions.some(region => region.id === id))) return false;
      selectedId = id; pendingFocus = focus;
      return view ? view.select(id, { focus }) : true;
    },
    focusRegion(id) { if (disposed || !sheet.regions.some(region => region.id === id)) return false; if (view) return view.focusRegion(id); selectedId = id; pendingFocus = true; return true; },
    fit() { view?.fit(); }, zoomBy(factor) { view?.zoomBy(factor); }, resize() { view?.resize(); scheduleRender(); },
    setRotation(value) {
      if (disposed) return false;
      const next = normalizeRotation(value);
      if (next === rotation) return false;
      rotation = next; pendingFocus = false; scheduleRender(); notify(); return true;
    },
    rotateBy(value = 90) { return controller.setRotation(rotation + value); },
    pause() { if (disposed) return; suspended = true; generation += 1; clearTimer(); if (activeRender) { activeRender.cancelled = true; activeRender.task.cancel(); } },
    resume() { if (disposed) return; suspended = false; scheduleRender(); },
    get selectedId() { return selectedId; }, get element() { return view?.element || null; },
    get zoom() { return view?.zoom || 1; }, get rotation() { return rotation; },
    get pageCount() { return pdfDocument?.numPages || null; },
    get isDisposed() { return disposed; },
    dispose() {
      if (disposed) return;
      disposed = true; generation += 1; clearTimer(); activeRender?.task.cancel(); view?.dispose(); view = null;
      resolveReady(null);
      if (currentURL) objectURLs.revokeObjectURL(currentURL); currentURL = null;
      // LoadingTask owns the worker and transport even after getPage succeeds.
      Promise.resolve(loadingTask?.destroy()).catch(() => {});
      page = null; pdfDocument = null;
    },
  };
  controller.ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  // Hosts may mount optimistically and handle onError instead of awaiting ready.
  // Attach a rejection observer so that path never creates an unhandled promise.
  controller.ready.catch(() => {});
  initialize();
  return controller;
}
