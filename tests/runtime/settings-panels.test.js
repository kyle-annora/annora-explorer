import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { createOverlayCoordinator } from '../../src/explorer/ui/overlay-coordinator.js';
import { createAppearancePanel } from '../../src/explorer/ui/appearance-panel.js';
import { createDisplayUI } from '../../src/explorer/display-ui.js';
import { CLIENT_THEMES, resolveTheme } from '../../src/explorer/themes.js';
import { DISPLAY_DEFAULTS } from '../../src/explorer/display-profiles.js';

// A small DOM surface for ownership/lifecycle tests. Browser QA covers layout,
// native keyboard traversal, disabled click suppression and real focus behavior.
class Element extends EventTarget {
  constructor(document, tag = 'div') {
    super(); this.ownerDocument = document; this.tagName = tag.toUpperCase();
    this.children = []; this.dataset = {}; this.style = {}; this.attributes = new Map();
    this.hidden = false; this.disabled = false; this.checked = false; this.value = ''; this.textContent = ''; this.focusCount = 0;
    const classes = new Set();
    this.classList = {
      toggle(name, force) { const active = force ?? !classes.has(name); if (active) classes.add(name); else classes.delete(name); return active; },
      contains: name => classes.has(name),
    };
  }
  setAttribute(key, value) { this.attributes.set(key, String(value)); }
  getAttribute(key) { return this.attributes.get(key) ?? null; }
  removeAttribute(key) { this.attributes.delete(key); }
  append(...children) { for (const child of children) { child.parentElement = this; this.children.push(child); } }
  remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(child => child !== this); this.parentElement = null; }
  contains(node) { return node === this || this.children.some(child => child.contains(node)); }
  focus() { this.focusCount++; this.ownerDocument.activeElement = this; }
  querySelector(selector) {
    const matches = node => selector.startsWith('.') ? node.className?.split(' ').includes(selector.slice(1)) : node.tagName.toLowerCase() === selector;
    for (const child of this.children) { if (matches(child)) return child; const found = child.querySelector(selector); if (found) return found; }
    return null;
  }
  set innerHTML(markup) {
    // The Display renderer writes static symbol/label markup. Only label nodes
    // participate in these controller and lifecycle tests.
    this.children = [];
    for (const tag of ['strong', 'small']) if (markup.includes(`<${tag}>`)) this.append(new Element(this.ownerDocument, tag));
  }
}
function fixture(t) {
  const document = new EventTarget(), elements = new Map(), signal = new AbortController();
  document.body = new Element(document, 'body'); document.activeElement = document.body;
  document.createElement = tag => new Element(document, tag);
  const element = id => {
    if (!elements.has(id)) { const node = new Element(document); node.id = id; elements.set(id, node); }
    return elements.get(id);
  };
  document.getElementById = element;
  for (const id of ['theme-panel', 'display-panel']) element(id).hidden = true;
  for (const name of ['custom-accent-row', 'accent-section-label']) {
    const node = new Element(document); node.className = name; element('theme-panel').append(node);
  }
  element('theme-panel').append(element('theme-options'), element('appearance-light'), element('appearance-dark'), element('custom-accent'), element('custom-accent-hex'));
  const errors = [], calls = [], state = { ready:true, appearance:'light', theme:resolveTheme('ember'), renderStyle:'engineering', displayOptions:{ ...DISPLAY_DEFAULTS } };
  const command = async (method, params) => { calls.push([method, params]); return { payload:{ status:'completed' } }; };
  t.after(() => signal.abort());
  return { document, element, signal, errors, calls, state, command, getState:() => state, onError:error => errors.push(error) };
}
const click = node => node.dispatchEvent(new Event('click'));
const change = node => node.dispatchEvent(new Event('change'));
function eventAt(target, type, values = {}) {
  const event = new Event(type, { cancelable:true });
  Object.defineProperties(event, Object.fromEntries(Object.entries({ target, ...values }).map(([key, value]) => [key, { value }])));
  return event;
}
function appearance(f, overrides = {}) {
  return createAppearancePanel({ ...f, themesEnabled:true, signal:f.signal.signal, changeAppearance:async value => { f.calls.push(['appearance', value]); }, ...overrides });
}
function display(f, overrides = {}) {
  return createDisplayUI({ ...f, signal:f.signal.signal, styles:['engineering', 'linework', 'flat'], accentName:() => f.state.theme.name, ...overrides });
}
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function register(coordinator, f, id, overrides = {}) {
  const panel = f.element(`${id}-panel`), trigger = f.element(`${id}-trigger`), closeButton = f.element(`${id}-close`), focus = f.element(`${id}-focus`);
  panel.hidden = true; panel.append(focus, closeButton);
  coordinator.register(id, { panel, trigger, closeButton, initialFocus:() => focus, ...overrides });
  return { panel, trigger, closeButton, focus };
}

test('settings coordinator makes panels exclusive and preserves opening and return focus contracts', t => {
  const f = fixture(t), before = [], coordinator = createOverlayCoordinator({ document:f.document, signal:f.signal.signal });
  const theme = register(coordinator, f, 'theme', { beforeToggle:opening => before.push(['theme', opening]), restoreOnToggleClose:false });
  const view = register(coordinator, f, 'display', { beforeToggle:opening => before.push(['display', opening]) });
  click(theme.trigger);
  assert.equal(theme.panel.hidden, false); assert.equal(theme.trigger.getAttribute('aria-expanded'), 'true'); assert.equal(f.document.activeElement, theme.focus);
  click(view.trigger);
  assert.equal(theme.panel.hidden, true); assert.equal(theme.trigger.getAttribute('aria-expanded'), 'false'); assert.equal(view.panel.hidden, false); assert.equal(f.document.activeElement, view.focus);
  click(view.closeButton);
  assert.equal(view.panel.hidden, true); assert.equal(f.document.activeElement, view.trigger);
  click(view.trigger); click(view.trigger);
  assert.equal(view.panel.hidden, true); assert.equal(f.document.activeElement, view.trigger);
  click(theme.trigger); const focusCount = theme.trigger.focusCount; click(theme.trigger);
  assert.equal(theme.panel.hidden, true); assert.equal(theme.trigger.focusCount, focusCount, 'Appearance trigger-close does not add focus movement');
  assert.deepEqual(before, [['theme', true], ['display', true], ['display', true], ['display', false], ['theme', true], ['theme', false]]);
});

test('outside dismissal preserves pointer focus; Escape and Tab remain with the shell', t => {
  const f = fixture(t), coordinator = createOverlayCoordinator({ document:f.document, signal:f.signal.signal });
  const theme = register(coordinator, f, 'theme'); click(theme.trigger);
  for (const target of [theme.focus, theme.trigger]) f.document.dispatchEvent(eventAt(target, 'pointerdown'));
  assert.equal(theme.panel.hidden, false, 'inside and trigger pointer presses do not dismiss');
  for (const key of ['Escape', 'Tab']) {
    const event = eventAt(theme.focus, 'keydown', { key }); f.document.dispatchEvent(event);
    assert.equal(event.defaultPrevented, false); assert.equal(theme.panel.hidden, false, 'coordinator does not compete with global keyboard priority');
  }
  const outside = new Element(f.document); outside.focus(); f.document.dispatchEvent(eventAt(outside, 'pointerdown'));
  assert.equal(theme.panel.hidden, true); assert.equal(f.document.activeElement, outside);
  click(theme.trigger); coordinator.close('theme', true);
  assert.equal(f.document.activeElement, theme.trigger, 'shell Escape can explicitly restore trigger focus');
});

test('coordinator disposal removes trigger and document handlers; a remount acts once', t => {
  const f = fixture(t), coordinator = createOverlayCoordinator({ document:f.document, signal:f.signal.signal });
  let opened = 0; const theme = register(coordinator, f, 'theme', { onOpen:() => opened++ });
  assert.throws(() => register(coordinator, f, 'theme'), /already registered/);
  click(theme.trigger); coordinator.dispose(); coordinator.dispose();
  assert.equal(theme.panel.hidden, true); assert.equal(theme.trigger.getAttribute('aria-expanded'), 'false');
  click(theme.trigger); assert.equal(opened, 1);
  const next = createOverlayCoordinator({ document:f.document, signal:f.signal.signal });
  register(next, f, 'theme', { onOpen:() => opened++ }); click(theme.trigger);
  assert.equal(opened, 2); assert.equal(theme.panel.hidden, false);
  f.signal.abort(); click(theme.trigger); assert.equal(opened, 2);
});

test('Display pending state rejects a second style action and recovers from rejected work', async t => {
  const f = fixture(t), pending = deferred(); let requests = 0;
  const ui = display(f, { command:() => { requests++; return pending.promise; } });
  const buttons = f.element('display-options').children, linework = buttons[1];
  f.element('display-panel').hidden = false; click(linework);
  assert.equal(f.element('display-panel').getAttribute('aria-busy'), 'true'); assert.ok(buttons.every(button => button.disabled));
  assert.equal(f.element('display-grid').disabled, true); assert.equal(f.element('display-reset').disabled, false, 'preserve the existing Reset policy');
  click(buttons[2]); assert.equal(requests, 1);
  pending.reject(new Error('Preparation failed')); await nextTurn();
  assert.equal(f.errors[0].message, 'Preparation failed'); assert.equal(f.element('display-panel').getAttribute('aria-busy'), 'false');
  assert.ok(buttons.every(button => !button.disabled)); assert.equal(ui.initialFocus(), buttons[0], 'failed work retains the current style');
});

test('Display sends display options through the injected controller and keeps appearance out of Reset', async t => {
  const f = fixture(t); f.state.renderStyle = 'flat'; const ui = display(f);
  assert.equal(f.element('display-current').textContent, 'Flat Ember'); assert.equal(ui.initialFocus().dataset.style, 'flat');
  f.element('display-grid').checked = true; change(f.element('display-grid'));
  f.element('display-lineWeight').value = 'bold'; change(f.element('display-lineWeight'));
  click(f.element('display-reset')); await nextTurn();
  assert.deepEqual(f.calls[0], ['setDisplayOptions', { options:{ grid:true } }]);
  assert.deepEqual(f.calls[1], ['setDisplayOptions', { options:{ lineWeight:'bold' } }]);
  const reset = f.calls[2][1].options; assert.equal(reset.grid, false); assert.equal('appearance' in reset, false);
  f.state.ready = false; ui.sync(); assert.equal(f.element('display-reset').disabled, true); assert.equal(f.element('display-grid').disabled, true);
});

test('closing Display during preparation does not steal focus on completion', async t => {
  const f = fixture(t), pending = deferred(); display(f, { command:() => pending.promise });
  const button = f.element('display-options').children[1]; f.element('display-panel').hidden = false; click(button);
  f.element('display-panel').hidden = true; const outside = new Element(f.document); outside.focus();
  f.state.renderStyle = 'linework'; pending.resolve({ payload:{ status:'completed' } }); await nextTurn();
  assert.equal(f.document.activeElement, outside); assert.equal(button.focusCount, 0);
  assert.equal(button.getAttribute('aria-pressed'), 'true'); assert.equal(f.element('display-panel').hidden, true);
});

test('Display disposal prevents late DOM/focus commits and removes generated controls before remount', async t => {
  const f = fixture(t), pending = deferred(); let snapshots = 0;
  const ui = display(f, { getState:() => { snapshots++; return f.state; }, command:() => pending.promise });
  const staleButton = f.element('display-options').children[1]; f.element('display-panel').hidden = false; click(staleButton);
  ui.dispose(); const countAtDispose = snapshots; assert.equal(f.element('display-options').children.length, 0);
  const next = display(f); assert.equal(f.element('display-options').children.length, 3);
  pending.resolve({ payload:{ status:'completed' } }); await nextTurn();
  assert.equal(snapshots, countAtDispose); assert.equal(staleButton.focusCount, 0); assert.equal(f.element('display-panel').getAttribute('aria-busy'), 'false');
  click(staleButton); assert.equal(snapshots, countAtDispose, 'disposed handlers cannot request again');
  next.dispose(); assert.equal(f.element('display-options').children.length, 0);
});

test('Display honors configured style choices and does not remain busy after controller failure', async t => {
  const f = fixture(t), ui = display(f, { styles:['engineering'], command:async () => ({ payload:{ status:'failed', error:{ message:'Unavailable' } } }) });
  assert.deepEqual(f.element('display-options').children.map(button => button.dataset.style), ['engineering']);
  click(ui.initialFocus()); await nextTurn(); assert.equal(f.element('display-panel').getAttribute('aria-busy'), 'false'); assert.equal(ui.initialFocus().disabled, false);
});

test('Appearance preserves uncommitted edits during sync and clears validation only on committed theme', async t => {
  const f = fixture(t), ui = appearance(f); ui.syncTheme();
  const input = f.element('custom-accent-hex'); input.value = 'oops'; change(input);
  assert.equal(input.getAttribute('aria-invalid'), 'true'); assert.equal(f.element('accent-validation').hidden, false);
  ui.sync(); assert.equal(input.value, 'oops'); assert.equal(input.getAttribute('aria-invalid'), 'true'); assert.equal(f.calls.length, 0);
  input.value = '#12ABef'; change(input); await nextTurn();
  assert.deepEqual(f.calls, [['setTheme', { themeId:'custom', accent:'#12abef' }]]);
  assert.equal(input.getAttribute('aria-invalid'), 'false'); assert.equal(f.element('accent-validation').hidden, true);
  f.state.theme = resolveTheme('custom', '#12abef'); ui.syncTheme();
  assert.equal(input.value, '#12abef'); assert.equal(input.getAttribute('aria-invalid'), null);
  assert.ok(f.element('theme-options').children.every(button => button.getAttribute('aria-pressed') === 'false'));
});

test('Appearance delegates preset, custom and mode changes while readiness remains snapshot-owned', async t => {
  const f = fixture(t), ui = appearance(f); ui.syncTheme();
  const presets = f.element('theme-options').children; assert.equal(presets.length, CLIENT_THEMES.length);
  assert.equal(presets.find(button => button.dataset.theme === 'ember').getAttribute('aria-pressed'), 'true');
  click(presets[1]); click(f.element('appearance-dark'));
  f.element('custom-accent').value = '#abcdef'; f.element('custom-accent').dispatchEvent(new Event('input')); await nextTurn();
  assert.deepEqual(f.calls, [['setTheme', { themeId:CLIENT_THEMES[1].id }], ['appearance', 'dark'], ['setTheme', { themeId:'custom', accent:'#abcdef' }]]);
  assert.equal(f.state.appearance, 'light', 'panel does not mutate domain state optimistically');
  f.state.appearance = 'dark'; f.state.ready = false; ui.sync();
  assert.equal(f.element('appearance-dark').getAttribute('aria-pressed'), 'true'); assert.equal(ui.initialFocus(), f.element('appearance-dark'));
  assert.ok(presets.every(button => button.disabled)); assert.equal(f.element('custom-accent-hex').disabled, true);
});

test('Appearance hides disabled theme customization without disabling Light/Dark', async t => {
  const f = fixture(t), ui = appearance(f, { themesEnabled:false }); ui.syncTheme();
  assert.equal(f.element('theme-options').hidden, true); assert.equal(f.element('theme-panel').querySelector('.custom-accent-row').hidden, true);
  f.element('custom-accent-hex').value = '#abcdef'; change(f.element('custom-accent-hex'));
  f.element('custom-accent').dispatchEvent(new Event('input')); click(f.element('appearance-dark')); await nextTurn();
  assert.deepEqual(f.calls, [['appearance', 'dark']]); assert.equal(f.element('appearance-dark').disabled, false);
});

test('Appearance abort cancels queued actions and late errors, and remount has one preset set', async t => {
  const f = fixture(t), pending = deferred(); let requests = 0;
  const ui = appearance(f, { command:() => { requests++; return pending.promise; } }); ui.syncTheme();
  const staleButton = f.element('theme-options').children[0]; click(staleButton); await nextTurn(); assert.equal(requests, 1);
  click(f.element('appearance-dark')); ui.dispose();
  assert.equal(f.element('theme-options').children.length, 0);
  pending.reject(new Error('Late failure')); await nextTurn();
  assert.equal(f.errors.length, 0); assert.equal(f.calls.length, 0, 'queued appearance callback is cancelled');
  const next = appearance(f); next.syncTheme(); assert.equal(f.element('theme-options').children.length, CLIENT_THEMES.length);
  click(staleButton); await nextTurn(); assert.equal(requests, 1);
  f.signal.abort(); assert.equal(f.element('theme-options').children.length, 0);
});

test('already-aborted mounts do not leave controls or actionable listeners', async t => {
  const f = fixture(t); f.signal.abort();
  const a = appearance(f), d = display(f), c = createOverlayCoordinator({ document:f.document, signal:f.signal.signal });
  assert.equal(f.element('theme-options').children.length, 0); assert.equal(f.element('display-options').children.length, 0);
  assert.throws(() => register(c, f, 'theme'), /disposed/);
  a.syncTheme(); d.sync(); click(f.element('appearance-dark')); click(f.element('display-reset')); await nextTurn();
  assert.equal(f.calls.length, 0);
});
