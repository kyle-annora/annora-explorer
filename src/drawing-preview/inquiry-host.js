/** Connect the shared inquiry surface to a drawing host without owning records
 * or drawing state. Navigation waits for the same panel that owns the input. */
export function createDrawingInquiryHost({ repository, mountPanel, readContext, canCapture,
  onRestore, onProject, onState, onOpening } = {}) {
  if (!repository || typeof mountPanel !== 'function' || typeof readContext !== 'function')
    throw new TypeError('A drawing inquiry host needs its repository, panel mount and reference reader.');
  let panel = null, opening = null, leaving = null;
  const notify = (callback, value) => { try { callback?.(value); } catch { /* Presentation cannot interrupt a save. */ } };
  const capture = () => {
    if (canCapture && !canCapture()) throw new Error('Choose an available, confirmed drawing detail before attaching it to this inquiry.');
    return readContext();
  };
  return {
    open({ opener } = {}) {
      if (leaving) return Promise.reject(new Error('Wait for the inquiry to finish saving before reopening it.'));
      if (opening) return opening;
      // Capture the clicked detail before a lazy import. Subsequent exploration
      // does not change the reference the customer chose at this entry point.
      let context;
      try { context = panel?.getContext() || capture(); }
      catch (error) { return Promise.reject(error); }
      notify(onOpening, true);
      opening = Promise.resolve().then(async () => {
        if (!panel) panel = await mountPanel({ repository, onCapture: capture, onRestore, onProject, onState });
        return panel.open({ context, suggestedIntent: 'application-review', opener });
      }).finally(() => { opening = null; notify(onOpening, false); });
      return opening;
    },
    beforeLeave({ release = false } = {}) {
      if (leaving) return leaving;
      leaving = Promise.resolve().then(async () => {
        if (opening) await opening.catch(() => {});
        if (!panel) return true;
        if (!(await panel.beforeLeave())) return false;
        if (release) {
          if (!(await panel.dispose())) return false;
          panel = null;
        }
        return true;
      }).finally(() => { leaving = null; });
      return leaving;
    },
    minimize() { return panel?.minimize() ?? Promise.resolve(false); },
    getContext() { return panel?.getContext() || null; },
  };
}
