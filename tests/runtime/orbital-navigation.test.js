import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrbitalNavigation, hasOrbitalGuide } from '../../src/explorer/orbital-navigation.js';

const model = { id: 'hexapod', revision: 'pinned', tour: { id: 'show' }, allowedCapabilities: {
  tours: ['show'], operation: true, modes: ['explore', 'explode'], renderStyles: ['engineering']
} };
const guide = { schemaVersion: 1, modelId: model.id, modelRevision: model.revision, tourId: 'show', entry: 'default',
  chapters: [{ id: 'overview' }, { id: 'leg', action: { type: 'motion' } }, { id: 'electronics', action: { type: 'separate' } }] };

function setup(initial = '?model=hexapod&quality=performance') {
  const browser = { location: new URL(initial, 'https://example.test/explorer/') };
  browser.history = Object.fromEntries(['pushState', 'replaceState'].map(name =>
    [name, (_state, _title, url) => { browser.location = new URL(url); }]));
  let resolve, reject, navigate;
  const events = [], chunk = new Promise((yes, no) => { resolve = yes; reject = no; });
  const navigation = createOrbitalNavigation({ model, guide, browser, listen() {}, load: () => chunk,
    mount(_api, chapter, move) {
      navigate = move; events.push(chapter);
      return { setChapter(id) { events.push(id); }, dispose() { events.push('dispose'); } };
    }, onPending() {}, onExit() { events.push('free'); }, onFailure() { events.push('failed'); }
  });
  return { browser, events, navigation, resolve, reject, change: id => navigate(id) };
}

test('only a top-level guide matching this revision and its allowed capabilities can replace the tour entry', () => {
  assert.ok(hasOrbitalGuide(model, guide, false));
  assert.equal(hasOrbitalGuide(model, guide, false, 'timeline'), false);
  assert.equal(hasOrbitalGuide(model, { ...guide, entry: 'opt-in' }, false), false);
  assert.equal(hasOrbitalGuide(model, { ...guide, entry: 'opt-in' }, false, 'spatial'), true);
  for (const [candidate, record, embed] of [[model, guide, true], [model, { ...guide, modelRevision: 'old' }, false],
    [{ ...model, allowedCapabilities: { ...model.allowedCapabilities, operation: false } }, guide, false],
    [model, { ...guide, modelId: 'other' }, false], [model, null, false]]) {
    assert.equal(hasOrbitalGuide(candidate, record, embed), false);
  }
});

test('Back during a lazy load never mounts a stale presentation', async () => {
  const s = setup(), free = s.browser.location.href;
  const opening = s.navigation.open();
  s.browser.location = new URL(free);
  await s.navigation.sync(); s.resolve({}); await opening;
  assert.deepEqual(s.events, []);
  assert.equal(s.navigation.active, false);
});

test('latest deep link wins during loading; chapter navigation and explicit exit retain other URL options', async () => {
  const s = setup(), opening = s.navigation.open();
  s.browser.location.hash = 'electronics';
  const moving = s.navigation.sync(); s.resolve({}); await Promise.all([opening, moving]);
  await s.change('leg'); await s.navigation.sync(); await s.change(null);
  assert.deepEqual(s.events, ['electronics', 'leg', 'dispose', 'free']);
  assert.equal(s.browser.location.search, '?model=hexapod&quality=performance');
  assert.equal(s.browser.location.hash, '');
});

test('a failed presentation keeps the free Explorer and removes only presentation routing', async () => {
  const s = setup('?model=hexapod&quality=performance&presentation=1#electronics');
  const opening = s.navigation.sync(); s.reject(new Error('offline')); await opening;
  assert.deepEqual(s.events, ['failed']);
  assert.equal(s.browser.location.search, '?model=hexapod&quality=performance');
  assert.equal(s.browser.location.hash, '');
});

function resumable(initial = '?model=hexapod&presentation=1#electronics', record = guide) {
  const browser = { location: new URL(initial, 'https://example.test/explorer/') };
  const history = [browser.location.href];
  let position = 0, navigate, snapshot, mounted = 0;
  const notifications = [];
  browser.history = {
    pushState(_state, _title, next) {
      browser.location = new URL(next); history.splice(++position); history.push(next.href);
    },
    replaceState(_state, _title, next) { browser.location = new URL(next); history[position] = next.href; },
  };
  const navigation = createOrbitalNavigation({ model, guide: record, browser, listen() {}, load: async () => ({}),
    mount(_api, chapter, change, _exit, checkpoints) {
      mounted++; navigate = change;
      snapshot = { chapterId: chapter, progress: 0, ...checkpoints.get(chapter) };
      return {
        captureState: () => snapshot,
        setChapter(id, checkpoint) { snapshot = { chapterId: id, progress: 0, ...checkpoint }; },
        dispose() {},
      };
    }, onExit() {}, onFailure(error) { throw error; }, onChange(value) { notifications.push(value); },
  });
  return { browser, navigation, notifications, move: id => navigate(id),
    get snapshot() { return snapshot; }, get mounts() { return mounted; },
    back() { browser.location = new URL(history[--position]); return navigation.sync(); },
    forward() { browser.location = new URL(history[++position]); return navigation.sync(); },
  };
}

test('Demo returns to the last chapter and playhead after Explore', async () => {
  const s = resumable(); await s.navigation.sync(); s.snapshot.progress = .37;
  await s.navigation.close();
  assert.deepEqual(s.navigation.state, { active: false, pending: false, chapter: null });
  await s.navigation.open();
  assert.equal(s.browser.location.hash, '#electronics');
  assert.deepEqual(s.snapshot, { chapterId: 'electronics', progress: .37 });
  assert.deepEqual(s.navigation.state, { active: true, pending: false, chapter: 'electronics' });
  assert.ok(s.notifications.some(state => state.active && state.pending));
});

test('chapter Back and Forward restore each chapter independently and retain one mounted view', async () => {
  const s = resumable(); await s.navigation.sync(); s.snapshot.progress = .37;
  await s.move('leg'); s.snapshot.progress = .82;
  await s.back(); assert.deepEqual(s.snapshot, { chapterId: 'electronics', progress: .37 });
  await s.forward(); assert.deepEqual(s.snapshot, { chapterId: 'leg', progress: .82 });
  assert.equal(s.mounts, 1);
});

test('an explicit history destination wins over the most recently visited chapter', async () => {
  const s = resumable(); await s.navigation.sync(); s.snapshot.progress = .37;
  await s.navigation.close();
  s.browser.location = new URL('?model=hexapod&presentation=1#leg', s.browser.location);
  await s.navigation.sync();
  assert.deepEqual(s.snapshot, { chapterId: 'leg', progress: 0 });
  await s.navigation.close(); await s.navigation.open();
  assert.equal(s.snapshot.chapterId, 'leg');
});

test('checkpoint identity cannot leak another chapter into a restored pose', async () => {
  const s = resumable(); await s.navigation.sync(); s.snapshot.chapterId = 'leg'; s.snapshot.progress = .9;
  await s.navigation.close(); await s.navigation.open();
  assert.deepEqual(s.snapshot, { chapterId: 'electronics', progress: 0 });
});

test('restart discards chapter checkpoints, including a currently mounted overview', async () => {
  const s = resumable(); await s.navigation.sync(); s.snapshot.progress = .37;
  await s.navigation.restart(); assert.deepEqual(s.snapshot, { chapterId: 'overview', progress: 0 });
  await s.move('electronics'); assert.equal(s.snapshot.progress, 0);
  await s.move('overview'); s.snapshot.progress = .42;
  await s.navigation.restart(); assert.deepEqual(s.snapshot, { chapterId: 'overview', progress: 0 });
});

test('opening an opt-in spatial guide declares it in the URL and history honors explicit timeline routes', async () => {
  const s = resumable('?model=hexapod&quality=performance', { ...guide, entry: 'opt-in' });
  await s.navigation.open();
  assert.equal(s.browser.location.searchParams.get('guide'), 'spatial');
  assert.equal(s.browser.location.searchParams.get('quality'), 'performance');
  s.browser.location.searchParams.set('guide', 'timeline');
  await s.navigation.sync(); assert.equal(s.navigation.active, false);
  assert.equal(s.browser.location.searchParams.get('presentation'), '1');
  assert.equal(s.browser.location.searchParams.get('guide'), 'timeline');
});

test('a configured default guide opens from a plain Demo product link while explicit timeline links stay outside it', async () => {
  const record = { ...guide, entry: 'default' };
  const direct = resumable('?model=hexapod&presentation=1#electronics', record);
  await direct.navigation.sync();
  assert.equal(direct.navigation.active, true);
  assert.equal(direct.snapshot.chapterId, 'electronics');
  const timeline = resumable('?model=hexapod&presentation=1&guide=timeline', record);
  await timeline.navigation.sync();
  assert.equal(timeline.navigation.active, false);
  assert.equal(timeline.mounts, 0);
});

test('a synchronous lazy-loader failure can be retried without a stuck pending state', async () => {
  const browser = { location: new URL('https://example.test/?model=hexapod') };
  browser.history = { pushState(_state, _title, next) { browser.location = new URL(next); }, replaceState(_state, _title, next) { browser.location = new URL(next); } };
  let attempts = 0, mounts = 0, failures = 0;
  const navigation = createOrbitalNavigation({ model, guide, browser, listen() {},
    load() { if (!attempts++) throw new Error('unavailable'); return {}; },
    mount() { mounts++; return { dispose() {} }; }, onExit() {}, onFailure() { failures++; },
  });
  await navigation.open(); assert.equal(navigation.state.pending, false); assert.equal(navigation.active, false);
  await navigation.open(); assert.equal(mounts, 1); assert.equal(failures, 1); assert.equal(navigation.active, true);
});
