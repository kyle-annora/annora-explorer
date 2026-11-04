import { presentationEntry } from './presentation-entry.js';

const chapters = new Set(['overview', 'leg', 'electronics']);

export function hasOrbitalGuide(model, presentation, embedded) {
  const policy = model.allowedCapabilities;
  return !embedded && presentation?.interactiveGuide === 'hexapod-orbit-v1' &&
    presentation.modelId === model.id && presentation.modelRevision === model.revision &&
    policy.tours.includes(model.tour?.id) && policy.operation && policy.modes.includes('explode') &&
    policy.renderStyles.includes('engineering');
}

/** Chapter history belongs to the Explorer document. Geometry and UI are lazy. */
export function createOrbitalNavigation({ model, browser, listen, load, mount, onPending, onExit, onFailure }) {
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
