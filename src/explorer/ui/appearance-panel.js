import { CLIENT_THEMES, normalizeHex } from '../themes.js';

/** Appearance controls consume plain state and commands; persistence stays in the shell. */
export function createAppearancePanel({ document, getState, command, changeAppearance, themesEnabled, signal, onError }) {
  const $ = id => document.getElementById(id);
  const panel = $('theme-panel'), options = $('theme-options');
  const lifetime = new AbortController(), buttons = [];
  const listen = (node, type, callback) => node.addEventListener(type, callback, { signal: lifetime.signal });
  const text = (tag, value, className) => {
    const node = document.createElement(tag);
    node.textContent = value;
    if (className) node.className = className;
    return node;
  };
  const run = action => {
    if (lifetime.signal.aborted) return;
    Promise.resolve().then(() => lifetime.signal.aborted ? undefined : action()).catch(error => {
      if (!lifetime.signal.aborted) onError?.(error);
    });
  };
  options.hidden = !themesEnabled;
  panel.querySelector('.custom-accent-row').hidden = !themesEnabled;
  panel.querySelector('.accent-section-label').hidden = !themesEnabled;
  for (const theme of CLIENT_THEMES) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'theme-option'; button.dataset.theme = theme.id;
    const swatch = text('span', '', 'theme-swatch'); swatch.style.background = theme.accent;
    const copy = text('span', '', 'theme-option-copy'); copy.append(text('strong', theme.name), text('small', theme.description));
    const check = text('span', '✓', 'theme-check'); check.setAttribute('aria-hidden', 'true');
    button.append(swatch, copy, check);
    listen(button, 'click', () => run(() => command('setTheme', { themeId: theme.id })));
    options.append(button); buttons.push(button);
  }
  listen($('custom-accent'), 'input', event => {
    const accent = event.target.value;
    if (themesEnabled) run(() => command('setTheme', { themeId: 'custom', accent }));
  });
  listen($('custom-accent-hex'), 'change', event => {
    const accent = normalizeHex(event.target.value);
    $('custom-accent-hex').setAttribute('aria-invalid', String(!accent));
    $('accent-validation').hidden = Boolean(accent);
    if (accent && themesEnabled) run(() => command('setTheme', { themeId: 'custom', accent }));
  });
  listen($('custom-accent-hex'), 'keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); event.target.dispatchEvent(new Event('change')); }
  });
  for (const value of ['light', 'dark']) listen($('appearance-' + value), 'click', () => run(() => changeAppearance(value)));

  function sync() {
    if (lifetime.signal.aborted) return;
    const { ready, appearance, theme } = getState();
    for (const value of ['light', 'dark']) {
      $('appearance-' + value).setAttribute('aria-pressed', String(value === appearance));
      $('appearance-' + value).disabled = !ready;
    }
    for (const input of [...buttons, $('custom-accent'), $('custom-accent-hex')]) input.disabled = !ready;
    $('theme-trigger').setAttribute('aria-label', `Appearance: ${appearance === 'dark' ? 'Dark' : 'Light'} · ${theme.name}`);
  }
  // Called for a committed theme, not every animation frame: preserve in-progress edits.
  function syncTheme() {
    if (lifetime.signal.aborted) return;
    const { theme } = getState();
    $('theme-label').textContent = 'Appearance';
    $('custom-accent').value = theme.accent; $('custom-accent-hex').value = theme.accent;
    $('custom-accent-hex').removeAttribute('aria-invalid'); $('accent-validation').hidden = true;
    for (const button of buttons) {
      const active = button.dataset.theme === theme.id;
      button.classList.toggle('is-selected', active); button.setAttribute('aria-pressed', String(active));
    }
    sync();
  }
  function dispose() {
    if (lifetime.signal.aborted) return;
    lifetime.abort(); buttons.forEach(button => button.remove());
    signal?.removeEventListener('abort', dispose);
  }
  if (signal?.aborted) dispose(); else signal?.addEventListener('abort', dispose, { once: true });
  return { sync, syncTheme, initialFocus: () => $('appearance-' + getState().appearance), dispose };
}
