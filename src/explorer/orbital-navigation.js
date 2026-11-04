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
export function createOrbitalNavigation({ model, guide, browser, listen, load, mount, onPending, onExit, onFailure }) {
  const chapters = new Set(guide.chapters.map(chapter => chapter.id));
  const url = () => new URL(browser.location.href);
  function destination() {
    const current = url();
    if (!presentationEntry(current.searchParams, model)) return null;
    const id = current.hash.slice(1);
    return chapters.has(id) ? id : 'overview';
  }
  let current = null, view = null, task = null, disposed = false;
  function change(id) {
    if (disposed || (id !== null && !chapters.has(id))) return;
    const next = url();
    if (id === null) next.searchParams.delete('presentation');
    else {
      next.searchParams.set('model', model.id);
      next.searchParams.set('presentation', '1');
    }
    next.hash = id && id !== 'overview' ? id : '';
    if (next.href !== browser.location.href) browser.history.pushState(null, '', next);
    return sync();
  }
  async function sync() {
    if (disposed) return;
    const id = destination();
    if (id === current) return task;
    current = id;
    if (id === null) {
      onPending(false);
      if (view) { view.dispose(); view = null; onExit(); }
      return;
    }
    if (view) { view.setChapter(id); return; }
    if (task) { onPending(true); return task; }
    onPending(true);
    task = (async () => {
      try {
        const api = await load();
        if (!disposed && current !== null) view = mount(api, current, change, () => change(null));
      } catch (error) {
        if (!disposed && current !== null) {
          const fallback = url(); fallback.hash = ''; fallback.searchParams.delete('presentation');
          browser.history.replaceState(null, '', fallback);
          current = null;
          onFailure(error);
        }
      } finally { task = null; if (!disposed) onPending(false); }
    })();
    return task;
  }
  listen(browser, 'popstate', sync);
  listen(browser, 'hashchange', sync);
  return {
    sync, open: () => change('overview'), get active() { return current !== null; },
    dispose() { disposed = true; view?.dispose(); view = null; }
  };
}
