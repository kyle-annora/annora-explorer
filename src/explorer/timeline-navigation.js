/** Route ownership for the standalone timeline. Embedded hosts keep their
 * existing controller commands and do not install this adapter. */
export function createTimelineNavigation({ browser, listen, getTour, start, exit, onChange, onFailure }) {
  const url = () => new URL(browser.location.href);
  function destination() {
    const params = url().searchParams;
    const modelId = getTour()?.modelId;
    return params.get('presentation') === '1' && params.getAll('presentation').length === 1 &&
      params.getAll('model').length <= 1 && (!params.has('model') || !modelId || params.get('model') === modelId);
  }
  let desired = destination(), task = null, disposed = false, checkpoint = null;
  let exitOptions = { restore: true };
  const state = () => ({
    active: !disposed && desired,
    pending: !disposed && task !== null,
    chapter: !disposed && desired ? getTour()?.captureCheckpoint?.()?.chapterId ?? checkpoint?.chapterId ?? null : null,
  });
  const notify = () => { if (!disposed) onChange?.(state()); };
  function capture() {
    const saved = getTour()?.captureCheckpoint?.();
    if (saved) checkpoint = { ...saved };
  }
  function route(active, replace = false) {
    const next = url();
    if (active) {
      next.searchParams.set('presentation', '1');
      if (getTour()?.modelId) next.searchParams.set('model', getTour().modelId);
    }
    else next.searchParams.delete('presentation');
    if (next.href !== browser.location.href) browser.history[replace ? 'replaceState' : 'pushState'](null, '', next);
  }
  async function reconcile() {
    while (!disposed && Boolean(getTour()?.active) !== desired) {
      const entering = desired;
      try {
        if (entering) {
          await start();
          if (disposed) return;
          if (!getTour()?.active) throw new Error('The presentation could not open.');
          // Restore before a queued exit can capture a fresh zero-time frame.
          if (checkpoint && !getTour().restoreCheckpoint(checkpoint)) checkpoint = null;
        } else {
          capture();
          const options = exitOptions;
          exitOptions = { restore: true };
          await exit(options);
          if (disposed) return;
          if (getTour()?.active) throw new Error('The presentation could not close.');
        }
      } catch (error) {
        if (disposed) return;
        // A newer route wins when an earlier request fails or is cancelled.
        if (entering === desired) {
          desired = Boolean(getTour()?.active);
          route(desired, true);
          onFailure?.(error);
        }
      }
      notify();
    }
  }
  function sync() {
    if (disposed) return Promise.resolve();
    desired = destination();
    if (!task && Boolean(getTour()?.active) !== desired) {
      task = Promise.resolve().then(reconcile).finally(() => {
        task = null;
        if (!disposed && Boolean(getTour()?.active) !== desired) return sync();
        notify();
      });
    }
    notify();
    return task || Promise.resolve();
  }
  listen(browser, 'popstate', sync);
  listen(browser, 'hashchange', sync);
  return {
    sync,
    open() { if (disposed) return Promise.resolve(); route(true); return sync(); },
    close(options = {}) {
      if (disposed) return Promise.resolve();
      capture();
      exitOptions = { restore: options.restore !== false };
      route(false);
      return sync();
    },
    get state() { return state(); },
    dispose() { capture(); disposed = true; },
  };
}
