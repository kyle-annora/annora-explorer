import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { createTimelineNavigation } from '../../src/explorer/timeline-navigation.js';

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

function fixture({ initial = '?model=kinetic-01&quality=performance&guide=timeline', start, exit } = {}) {
  const browser = { location: new URL(initial, 'https://example.test/explorer/') };
  const entries = [browser.location.href], events = [], failures = [], states = [];
  let index = 0;
  browser.history = {
    pushState(_state, _title, next) { browser.location = new URL(next); entries.splice(++index); entries.push(next.href); },
    replaceState(_state, _title, next) { browser.location = new URL(next); entries[index] = next.href; },
  };
  const tour = {
    modelId: 'kinetic-01', active: false, chapterId: 'whole', seconds: 0,
    captureCheckpoint() { return this.active ? { tourId: 'motion-tour', chapterId: this.chapterId, seconds: this.seconds } : null; },
    restoreCheckpoint(saved) { events.push(['restore', saved]); Object.assign(this, saved); return true; },
  };
  const navigation = createTimelineNavigation({ browser, listen() {}, getTour: () => tour,
    async start() {
      events.push(['start']);
      if (start) await start(tour);
      else { tour.active = true; tour.chapterId = 'whole'; tour.seconds = 0; }
    },
    async exit(options) {
      events.push(['exit', options]);
      if (exit) await exit(tour, options);
      else tour.active = false;
    }, onChange: state => states.push(state), onFailure: error => failures.push(error.message),
  });
  return { browser, navigation, tour, events, failures, states,
    back() { browser.location = new URL(entries[--index]); return navigation.sync(); },
    forward() { browser.location = new URL(entries[++index]); return navigation.sync(); },
  };
}

test('opening and closing timeline Demo keeps URL, visible mode and restore intent aligned', async () => {
  const f = fixture(), opening = f.navigation.open();
  assert.deepEqual(f.navigation.state, { active: true, pending: true, chapter: null });
  await opening;
  assert.equal(f.tour.active, true);
  assert.equal(f.browser.location.searchParams.get('presentation'), '1');
  await f.navigation.close({ restore: false });
  assert.deepEqual(f.navigation.state, { active: false, pending: false, chapter: null });
  assert.equal(f.browser.location.searchParams.has('presentation'), false);
  assert.equal(f.browser.location.searchParams.get('quality'), 'performance');
  assert.equal(f.browser.location.searchParams.get('guide'), 'timeline');
  assert.deepEqual(f.events.at(-1), ['exit', { restore: false }]);
});

test('Explore and browser history preserve the exact timeline chapter and time', async () => {
  const f = fixture(); await f.navigation.open();
  f.tour.chapterId = 'layers'; f.tour.seconds = 2.5;
  await f.navigation.close(); await f.back();
  assert.equal(f.tour.chapterId, 'layers'); assert.equal(f.tour.seconds, 2.5);
  assert.equal(f.navigation.state.active, true);
  await f.forward(); assert.equal(f.tour.active, false);
  await f.navigation.open();
  assert.deepEqual(f.events.at(-1), ['restore', { tourId: 'motion-tour', chapterId: 'layers', seconds: 2.5 }]);
});

test('rapid Demo, Explore, Demo during preparation opens only the final requested mode', async () => {
  const ready = deferred();
  const f = fixture({ start: async tour => { await ready.promise; tour.active = true; } });
  const first = f.navigation.open(); await nextTurn();
  const second = f.navigation.close(), third = f.navigation.open();
  ready.resolve(); await Promise.all([first, second, third]);
  assert.deepEqual(f.events, [['start']]);
  assert.equal(f.navigation.state.active, true); assert.equal(f.navigation.state.pending, false);
});

test('closing during preparation settles in Explore without a stale active presentation', async () => {
  const ready = deferred();
  const f = fixture({ start: async tour => { await ready.promise; tour.active = true; } });
  const opening = f.navigation.open(); await nextTurn();
  const closing = f.navigation.close(); ready.resolve();
  await Promise.all([opening, closing]);
  assert.equal(f.tour.active, false); assert.equal(f.navigation.state.pending, false);
  assert.equal(f.browser.location.searchParams.has('presentation'), false);
  assert.equal(f.events.filter(([name]) => name === 'exit').length, 1);
});

test('returning while exit settles waits for restoration before starting the saved chapter', async () => {
  const finished = deferred();
  const f = fixture({ exit: async tour => { await finished.promise; tour.active = false; } });
  await f.navigation.open(); f.tour.chapterId = 'layers'; f.tour.seconds = 3.7;
  const closing = f.navigation.close(); await nextTurn(); const opening = f.navigation.open();
  assert.equal(f.events.filter(([name]) => name === 'start').length, 1);
  finished.resolve(); await Promise.all([closing, opening]);
  assert.equal(f.tour.active, true); assert.equal(f.tour.seconds, 3.7); assert.equal(f.tour.chapterId, 'layers');
  assert.deepEqual(f.events.map(([name]) => name), ['start', 'exit', 'start', 'restore']);
});

test('a command that fails without throwing falls back to the actual scene and permits retry', async () => {
  let attempts = 0;
  const f = fixture({ start: async tour => { tour.active = ++attempts > 1; } });
  await f.navigation.open();
  assert.equal(f.failures.length, 1); assert.equal(f.navigation.state.active, false);
  assert.equal(f.browser.location.searchParams.has('presentation'), false);
  await f.navigation.open(); assert.equal(f.tour.active, true);
});

test('an unsuccessful exit keeps the visible Demo represented in the URL', async () => {
  const f = fixture({ exit: async () => {} }); await f.navigation.open(); await f.navigation.close();
  assert.equal(f.failures.length, 1); assert.equal(f.navigation.state.active, true);
  assert.equal(f.browser.location.searchParams.get('presentation'), '1');
});

test('failure from an obsolete entry does not overwrite the later Explore request', async () => {
  const ready = deferred();
  const f = fixture({ start: async () => { await ready.promise; throw new Error('offline'); } });
  const opening = f.navigation.open(); await nextTurn();
  const closing = f.navigation.close(); ready.resolve(); await Promise.all([opening, closing]);
  assert.deepEqual(f.failures, []); assert.equal(f.navigation.state.active, false);
});

test('invalid presentation or model links cannot autoplay the resolved fallback model', async () => {
  for (const initial of ['?model=missing&presentation=1', '?model=kinetic-01&model=other&presentation=1', '?presentation=1&presentation=1']) {
    const f = fixture({ initial }); await f.navigation.sync(); assert.deepEqual(f.events, []);
    await f.navigation.open(); assert.equal(f.tour.active, true);
    assert.deepEqual(f.browser.location.searchParams.getAll('model'), ['kinetic-01']);
  }
});

test('disposing during a request prevents late routing and notification', async () => {
  const ready = deferred();
  const f = fixture({ start: async () => { await ready.promise; throw new Error('disposed'); } });
  const opening = f.navigation.open(); await nextTurn();
  f.navigation.dispose(); const count = f.states.length, href = f.browser.location.href;
  ready.resolve(); await opening;
  assert.equal(f.states.length, count); assert.equal(f.browser.location.href, href);
  assert.deepEqual(f.failures, []);
});
