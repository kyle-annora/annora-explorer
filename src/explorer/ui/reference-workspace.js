import { createReferenceReader } from './reference-reader.js';
import './reference-workspace.css';

/** Representation belongs to the viewport, independently of Demo / Explore.
 * Hosts provide camera/pause adapters; no second renderer or animation clock. */
export function createReferenceWorkspace({ main, guide, assets, freeAdapter, beforeChange }) {
  const abort = new AbortController();
  const bar = document.createElement('nav');
  bar.className = 'reference-workspace-bar';
  bar.setAttribute('aria-label', 'View type');
  const group = document.createElement('div');
  group.className = 'reference-workspace-switch';
  group.setAttribute('role', 'group'); group.setAttribute('aria-label', 'View type');
  const pane = document.createElement('section');
  pane.className = 'reference-workspace-pane'; pane.id = 'reference-workspace-pane'; pane.hidden = true;
  pane.setAttribute('aria-label', 'Reference drawing workspace');
  const status = document.createElement('span'); status.className = 'reference-workspace-status';
  status.setAttribute('role', 'status');
  const buttons = new Map();
  for (const [id, label] of [['3d','3D'],['drawings','Drawings'],['compare','Compare']]) {
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = label; button.dataset.viewType = id;
    button.setAttribute('aria-pressed', String(id === '3d'));
    if (id !== '3d') button.setAttribute('aria-controls', pane.id);
    button.addEventListener('click', () => setView(id), { signal: abort.signal });
    buttons.set(id, button); group.append(button);
  }
  bar.append(group, status); main.append(bar, pane);
  document.body.dataset.referenceWorkspace = 'true';
  const reader = createReferenceReader({ mount: pane, guide, assets });
  const compact = matchMedia('(max-width: 980px)');
  let view = '3d', adapter = freeAdapter, demoAdapter = null, chapterId = null, contextKey = null, frame, disposed = false;
  const cameras = new Map();
  const cameraKey=()=>`${demoAdapter?'demo':'explore'}:${contextKey}`;
  function sync() {
    document.body.dataset.referenceView = view;
    pane.hidden = view === '3d';
    const viewport = main.querySelector('.viewport');
    viewport.inert = view === 'drawings';
    viewport.setAttribute('aria-hidden', String(view === 'drawings'));
    for (const [id, button] of buttons) button.setAttribute('aria-pressed', String(id === view));
    buttons.get('compare').hidden = compact.matches;
    status.textContent = view === 'compare' ? '3D pose · Drawing at rest' : '';
    adapter?.representation?.(view);
  }
  function checkpoint() {
    if(view==='3d')cameras.set(cameraKey(),{camera:adapter.capture?.(),width:main.clientWidth,height:main.clientHeight});
  }
  function setView(next, { focus = false } = {}) {
    if (disposed || !buttons.has(next) || (next === 'compare' && compact.matches)) return;
    if (next === view) return;
    beforeChange?.(); adapter?.pause?.();
    const currentAdapter = adapter;
    checkpoint();
    view = next; sync();
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      if (disposed || adapter !== currentAdapter) return;
      currentAdapter.resize?.(); reader.resize();
      // Compare reframes into a narrower canvas. Restore the user's original
      // full-size camera after its original layout has been reinstated.
      const saved=cameras.get(cameraKey());
      if(next!=='compare' && saved?.width===main.clientWidth && saved?.height===main.clientHeight)currentAdapter.restore?.(saved.camera);
      else currentAdapter.reframe?.();
    });
    if (focus) buttons.get(next).focus({ preventScroll: true });
  }
  function setChapter(id, context = id) {
    contextKey=context;
    if (!id || id === chapterId) return;
    chapterId = id; reader.setChapter(id);
  }
  function bindDemo(value) {
    demoAdapter = value; adapter = value || freeAdapter;
    if (view !== '3d') adapter.pause?.();
    sync(); reader.resize();
  }
  compact.addEventListener('change', () => {
    if (compact.matches && view === 'compare') setView('drawings', { focus: true });
    else sync();
  }, { signal: abort.signal });
  window.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || view === '3d') return;
    // Existing menus/dialogs keep first refusal; Escape steps out one layer.
    if(document.querySelector('dialog[open],#orbit-menu[open],#theme-panel:not([hidden]),#perf-panel:not([hidden]),#display-panel:not([hidden]),#path-panel:not([hidden])'))return;
    event.preventDefault(); event.stopImmediatePropagation(); setView('3d', { focus: true });
  }, { capture: true, signal: abort.signal });
  sync();
  return {
    setView, setChapter, bindDemo, checkpoint,
    get view() { return view; }, get isDemo() { return Boolean(demoAdapter); },
    dispose() {
      if (disposed) return; disposed = true; abort.abort(); cancelAnimationFrame(frame);
      reader.dispose(); bar.remove(); pane.remove();
      const viewport = main.querySelector('.viewport'); viewport.inert = false; viewport.removeAttribute('aria-hidden');
      delete document.body.dataset.referenceWorkspace; delete document.body.dataset.referenceView;
    },
  };
}
