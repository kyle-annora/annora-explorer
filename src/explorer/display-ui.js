import { GRID_DEFAULTS } from './display-preferences.js';
import { DISPLAY_DEFAULTS, DISPLAY_PROFILES } from './display-profiles.js';

/** Display controls consume a plain snapshot; the coordinator owns visibility. */
export function createDisplayUI({ document, command, getState, styles, signal, accentName, onError }) {
  const $ = id => document.getElementById(id), panel = $('display-panel'), trigger = $('display-trigger');
  const lifetime = new AbortController();
  const listen = (node, type, fn) => node.addEventListener(type, fn, { signal: lifetime.signal });
  let busy = false, lastPresentation = '';
  const buttons = [];
  const reportError = error => { if (!lifetime.signal.aborted) onError?.(error); };
  const request = (method, params) => { void command(method, params).catch(reportError); };
  for (const style of styles) {
    const profile = DISPLAY_PROFILES[style], button = document.createElement('button');
    button.type = 'button'; button.dataset.style = style; button.className = 'display-option';
    // Static, locally authored symbols and text. Model packages cannot inject markup.
    button.innerHTML = `<svg aria-hidden="true"><use href="#i-${profile.icon}"/></svg><span><strong></strong><small></small></span><span class="display-check" aria-hidden="true">✓</span>`;
    button.querySelector('strong').textContent = profile.title;
    button.querySelector('small').textContent = profile.description;
    listen(button, 'click', async () => {
      if (busy || !getState().ready) return;
      busy = true; sync();
      try { await command('setRenderStyle', { style }); }
      catch (error) { reportError(error); }
      finally {
        busy = false;
        if (!lifetime.signal.aborted) {
          sync();
          if (!panel.hidden && (document.activeElement === document.body || document.activeElement === button)) button.focus({ preventScroll: true });
        }
      }
    });
    $('display-options').append(button); buttons.push(button);
  }
  for (const id of ['grid', 'ambientOcclusion', 'featureEdges', 'hiddenEdges', 'lineWeight']) {
    listen($('display-' + id), 'change', event => request('setDisplayOptions', { options: { [id]: id === 'lineWeight' ? event.target.value : event.target.checked } }));
  }
  listen($('display-reset'), 'click', () => {
    const { appearance, ...defaults } = DISPLAY_DEFAULTS;
    request('setDisplayOptions', { options: { ...defaults, grid: GRID_DEFAULTS[getState().renderStyle || 'engineering'] } });
  });
  function sync(force = false) {
    if (lifetime.signal.aborted) return;
    const current = getState(), style = current.renderStyle || 'engineering';
    const options = { ...DISPLAY_DEFAULTS, ...current.displayOptions };
    const title = style === 'flat' ? `Flat ${accentName()}` : DISPLAY_PROFILES[style].title;
    const signature = JSON.stringify([Boolean(current.ready), busy, style, options, title]);
    if (!force && signature === lastPresentation) return;
    lastPresentation = signature;
    $('display-current').textContent = title; trigger.setAttribute('aria-label', `Display settings: ${title}`);
    for (const button of buttons) {
      button.disabled = busy || !current.ready;
      button.setAttribute('aria-pressed', String(button.dataset.style === style));
      if (button.dataset.style === 'flat') button.querySelector('strong').textContent = `Flat ${accentName()}`;
    }
    panel.setAttribute('aria-busy', String(busy));
    $('display-legend').textContent = busy ? 'Preparing display…' : DISPLAY_PROFILES[style].legend;
    $('display-engineering').hidden = style !== 'engineering'; $('display-linework').hidden = style === 'engineering';
    for (const [id, value] of Object.entries(options)) {
      const input = $('display-' + id); if (!input) continue;
      if (id === 'lineWeight') input.value = value; else input.checked = value;
      input.disabled = busy || !current.ready;
    }
    // Reset remains available during preparation, matching the existing controller policy.
    $('display-reset').disabled = !current.ready;
  }
  function dispose() {
    if (lifetime.signal.aborted) return;
    lifetime.abort(); buttons.forEach(button => button.remove());
    signal?.removeEventListener('abort', dispose);
  }
  if (signal?.aborted) dispose(); else signal?.addEventListener('abort', dispose, { once: true });
  sync();
  return { sync, initialFocus: () => buttons.find(button => button.getAttribute('aria-pressed') === 'true') || $('display-close'), dispose };
}
