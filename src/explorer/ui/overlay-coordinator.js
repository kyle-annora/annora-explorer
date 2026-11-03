/** Settings visibility only. The shell retains global Escape and Tab precedence. */
export function createOverlayCoordinator({ document, signal }) {
  const lifetime = new AbortController();
  const surfaces = new Map();
  const listen = (node, type, callback) => node.addEventListener(type, callback, { signal: lifetime.signal });

  function close(id, restore = false) {
    const surface = surfaces.get(id);
    if (!surface || lifetime.signal.aborted) return;
    surface.panel.hidden = true;
    surface.trigger.setAttribute('aria-expanded', 'false');
    if (restore) surface.trigger.focus();
  }

  function register(id, { panel, trigger, closeButton, initialFocus, onOpen, beforeToggle, restoreOnToggleClose = true }) {
    if (surfaces.has(id)) throw new Error(`Settings surface already registered: ${id}`);
    if (lifetime.signal.aborted) throw new Error('Settings coordinator is disposed');
    const surface = { panel, trigger };
    surfaces.set(id, surface);
    listen(trigger, 'click', () => {
      const opening = panel.hidden;
      if (opening) for (const other of surfaces.keys()) if (other !== id) close(other);
      beforeToggle?.(opening);
      if (!opening) { close(id, restoreOnToggleClose); return; }
      panel.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      onOpen?.();
      initialFocus()?.focus();
    });
    listen(closeButton, 'click', () => close(id, true));
  }

  listen(document, 'pointerdown', event => {
    for (const [id, { panel, trigger }] of surfaces) {
      if (!panel.hidden && !panel.contains(event.target) && !trigger.contains(event.target)) close(id);
    }
  });

  function dispose() {
    if (lifetime.signal.aborted) return;
    for (const id of surfaces.keys()) close(id);
    lifetime.abort();
    surfaces.clear();
    signal?.removeEventListener('abort', dispose);
  }
  if (signal?.aborted) dispose();
  else signal?.addEventListener('abort', dispose, { once: true });
  return { register, close, dispose };
}
