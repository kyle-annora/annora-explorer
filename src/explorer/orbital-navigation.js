import { presentationEntry } from './presentation-entry.js';

export function hasOrbitalGuide(model, guide, embedded, requestedGuide) {
  const policy = model.allowedCapabilities;
  if (embedded || requestedGuide === 'timeline' || guide?.schemaVersion !== 1 ||
      guide.modelId !== model.id || guide.modelRevision !== model.revision || guide.tourId !== model.tour?.id ||
      !policy.tours.includes(guide.tourId) || !policy.renderStyles.includes('engineering')) return false;
  if (guide.entry !== 'default' && requestedGuide !== 'spatial') return false;
  return guide.chapters.every(chapter => {
    if (chapter.action?.type === 'motion') return policy.operation;
    if (chapter.action?.type === 'separate') return policy.modes.includes('explode');
    return true;
  });
}

/** Chapter history belongs to the Explorer document. Geometry and UI are lazy. */
export function createOrbitalNavigation({ model, guide, browser, listen, load, mount, onPending, onExit, onFailure, onChange }) {
  const chapters = new Set(guide.chapters.map(chapter => chapter.id));
  const checkpoints = new Map();
  const url = () => new URL(browser.location.href);
  function destination() {
    const current = url();
    if (!presentationEntry(current.searchParams, model) ||
        !hasOrbitalGuide(model, guide, false, current.searchParams.get('guide'))) return null;
    const id = current.hash.slice(1);
    return chapters.has(id) ? id : 'overview';
  }
  let current = null, remembered = 'overview', view = null, task = null, disposed = false, pending = false;
  const state = () => ({ active: current !== null, pending, chapter: current });
  function updatePending(value) {
    pending = value;
    onPending?.(value);
    onChange?.(state());
  }
  function capture() {
    if (current === null) return;
    remembered = current;
    const checkpoint = view?.captureState?.();
    if (checkpoint?.chapterId === current) checkpoints.set(current, { ...checkpoint });
  }
  function change(id) {
    if (disposed || (id !== null && !chapters.has(id))) return;
    const next = url();
    if (id === null) next.searchParams.delete('presentation');
    else {
      next.searchParams.set('model', model.id);
      next.searchParams.set('presentation', '1');
      if (guide.entry !== 'default') next.searchParams.set('guide', 'spatial');
    }
    next.hash = id && id !== 'overview' ? id : '';
    if (next.href !== browser.location.href) browser.history.pushState(null, '', next);
    return sync();
  }
  async function sync() {
    if (disposed) return;
    const id = destination();
    if (id === current) return task;
    capture();
    current = id;
    if (id === null) {
      if (view) { view.dispose(); view = null; onExit(); }
      updatePending(false);
      return;
    }
    remembered = id;
    if (view) { view.setChapter(id, checkpoints.get(id)); onChange?.(state()); return; }
    if (task) { updatePending(true); return task; }
    updatePending(true);
    task = (async () => {
      try {
        // Defer even a synchronous loader failure until task owns its promise.
        const api = await Promise.resolve().then(load);
        if (!disposed && current !== null) view = mount(api, current, change, () => change(null), checkpoints);
      } catch (error) {
        if (!disposed && current !== null) {
          const fallback = url(); fallback.hash = ''; fallback.searchParams.delete('presentation');
          browser.history.replaceState(null, '', fallback);
          current = null;
          onFailure(error);
        }
      } finally { task = null; if (!disposed) updatePending(false); }
    })();
    return task;
  }
  listen(browser, 'popstate', sync);
  listen(browser, 'hashchange', sync);
  return {
    sync, open: () => change(remembered), close: () => change(null),
    get active() { return current !== null; },
    get state() { return state(); },
    restart() {
      if (disposed) return;
      checkpoints.clear(); remembered = 'overview';
      view?.dispose(); view = null; current = null;
      return change('overview');
    },
    dispose() { capture(); disposed = true; view?.dispose(); view = null; current = null; pending = false; }
  };
}
