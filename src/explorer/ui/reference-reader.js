import { createDrawingView } from '../../drawing-preview/drawing-view.js';
import './reference-reader.css';

const projections = new Map([['plan', 'Plan'], ['elevation', 'Elevation'], ['section', 'Section A–A']]);

function assetURL(assets, file) {
  if (!file || !assets) return null;
  const value = assets instanceof Map ? assets.get(file) : Object.hasOwn(assets, file) ? assets[file] : null;
  return value instanceof URL ? value.href : typeof value === 'string' && value ? value : null;
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Prepared, revision-bound SVG references. The host owns 3D / Drawings layout;
 * this reader owns projection choice and the existing SVG pan/zoom controller. */
export function createReferenceReader({ mount, guide, assets }) {
  const chapters = new Map();
  for (const chapter of guide.chapters) {
    const files = new Map();
    for (const view of projections.keys()) {
      const url = assetURL(assets, chapter.referenceViews?.[view]);
      if (url) files.set(view, url);
    }
    if (files.size) chapters.set(chapter.id, { label: chapter.label, files,
      initial: files.has(chapter.referenceViews.initial) ? chapter.referenceViews.initial : files.keys().next().value });
  }
  const root = element('section', 'explorer-reference-reader');
  root.setAttribute('aria-label', 'Model reference drawings');
  const header = element('header', 'explorer-reference-header');
  const identity = element('div', 'explorer-reference-identity');
  const eyebrow = element('p', 'explorer-reference-eyebrow', 'Model reference · At rest');
  const title = element('h3', 'explorer-reference-title');
  identity.append(eyebrow, title);
  const toolbar = element('div', 'explorer-reference-toolbar');
  const choices = element('div', 'explorer-reference-projections');
  choices.setAttribute('role', 'group');
  choices.setAttribute('aria-label', 'Reference projection');
  const zoom = element('div', 'explorer-reference-zoom');
  zoom.setAttribute('role', 'group');
  zoom.setAttribute('aria-label', 'Drawing zoom');
  const fit = element('button', 'explorer-reference-fit', 'Fit');
  const less = element('button', 'explorer-reference-minus', '−');
  const more = element('button', 'explorer-reference-plus', '+');
  fit.setAttribute('aria-label', 'Fit drawing');
  less.setAttribute('aria-label', 'Zoom out');
  more.setAttribute('aria-label', 'Zoom in');
  for (const button of [fit, less, more]) button.type = 'button';
  zoom.append(fit, less, more);
  toolbar.append(choices, zoom);
  header.append(identity, toolbar);
  const canvas = element('div', 'explorer-reference-canvas');
  const message = element('p', 'explorer-reference-status');
  message.setAttribute('role', 'status');
  const footer = element('p', 'explorer-reference-help', 'Drag to pan · Pinch to zoom');
  root.append(header, canvas, message, footer);
  mount.append(root);

  const abort = new AbortController();
  const listen = (node, type, callback, options = {}) =>
    node.addEventListener(type, callback, { ...options, signal: abort.signal });
  const buttons = new Map(), remembered = new Map(), paperBounds = new Map();
  let chapterId = null, selectedView = null, viewer = null, request = null, intent = 0, disposed = false;
  for (const [view, label] of projections) {
    const button = element('button', 'explorer-reference-choice', label);
    button.type = 'button'; button.dataset.projection = view;
    button.setAttribute('aria-pressed', 'false');
    listen(button, 'click', () => {
      if (!chapters.get(chapterId)?.files.has(view)) return;
      remembered.set(chapterId, view);
      showView(view);
    });
    choices.append(button); buttons.set(view, button);
  }
  function controls(state) {
    fit.disabled = !state;
    less.disabled = !state?.canZoomOut;
    more.disabled = !state?.canZoomIn;
  }
  function status(text, loading = false) {
    message.textContent = text;
    message.hidden = !text;
    root.setAttribute('aria-busy', String(loading));
  }
  async function readBounds(url, signal) {
    if (paperBounds.has(url)) return paperBounds.get(url);
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error('Drawing unavailable.');
    const source = new DOMParser().parseFromString(await response.text(), 'image/svg+xml');
    const svg = source.documentElement;
    const values = (svg.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
    if (svg.localName !== 'svg' || source.querySelector('parsererror') || values.length !== 4 ||
      !values.every(Number.isFinite) || values[2] <= 0 || values[3] <= 0) throw new Error('Drawing unavailable.');
    paperBounds.set(url, values);
    return values;
  }
  async function showView(view, force = false) {
    const chapter = chapters.get(chapterId);
    if (disposed || !chapter?.files.has(view) || (!force && selectedView === view && viewer)) return;
    request?.abort(); request = new AbortController();
    const current = ++intent, currentChapter = chapterId;
    selectedView = view;
    viewer?.dispose(); viewer = null;
    canvas.replaceChildren(); controls(null);
    root.dataset.projection = view;
    for (const [key, button] of buttons) button.setAttribute('aria-pressed', String(key === view));
    status('Loading reference…', true);
    const owns = () => !disposed && current === intent && currentChapter === chapterId;
    try {
      const url = chapter.files.get(view);
      const viewBox = await readBounds(url, request.signal);
      if (!owns()) return;
      viewer = createDrawingView({ mount: canvas, assetURL: url,
        sheet: { id: currentChapter + ':' + view, title: chapter.label + ' · ' + projections.get(view) + ' · At rest', viewBox, regions: [] },
        onViewChange: state => { if (owns()) controls(state); },
        onError: () => {
          if (!owns()) return;
          viewer?.dispose(); viewer = null; canvas.replaceChildren();
          controls(null); status('This reference could not load. Choose another view or try again.');
        },
      });
      // There are no mapped drawing regions in a model reference. Keep keyboard
      // instructions specific to this reader instead of promising linked details.
      viewer.element.querySelector('title').textContent = `${chapter.label}. ${projections.get(view)} at rest. Drag to pan or use the zoom controls.`;
      const artwork = viewer.element.querySelector('image');
      listen(artwork, 'load', () => { if (owns()) status(''); }, { once: true });
      status('');
      viewer.resize();
    } catch (error) {
      if (!owns() || error?.name === 'AbortError') return;
      controls(null); status('This reference could not load. Choose another view or try again.');
    }
  }
  function setChapter(id) {
    if (disposed || chapterId === id) return Promise.resolve();
    chapterId = id; selectedView = null;
    const chapter = chapters.get(id);
    root.dataset.chapter = id;
    title.textContent = chapter?.label || 'Reference drawings';
    for (const [view, button] of buttons) button.hidden = !chapter?.files.has(view);
    if (!chapter) {
      ++intent; request?.abort(); viewer?.dispose(); viewer = null;
      canvas.replaceChildren(); controls(null); status('No reference drawings for this chapter.');
      return Promise.resolve();
    }
    return showView(remembered.get(id) || chapter.initial, true);
  }
  listen(fit, 'click', () => viewer?.fit());
  listen(less, 'click', () => viewer?.zoomBy(1 / 1.5));
  listen(more, 'click', () => viewer?.zoomBy(1.5));
  controls(null);
  return {
    setChapter,
    resize: () => viewer?.resize(),
    element: root,
    dispose() {
      if (disposed) return;
      disposed = true; ++intent; request?.abort(); abort.abort(); viewer?.dispose(); root.remove();
    },
  };
}
