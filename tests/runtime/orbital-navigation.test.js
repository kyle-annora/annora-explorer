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
