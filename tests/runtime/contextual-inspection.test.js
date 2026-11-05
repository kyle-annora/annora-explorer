import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveChapterInspectionTarget, createContextualInspectionHandoff, createNavigation, enterScope } from '../../src/explorer/navigation-state.js';
import { createOrbitalNavigation } from '../../src/explorer/orbital-navigation.js';

const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const model = { id:'hexapod', revision:'pinned', tour:{ id:'show' }, allowedCapabilities:{ tours:['show'], operation:true, modes:['explore','explode'], renderStyles:['engineering'] } };
const guide = { schemaVersion:1, modelId:'hexapod', modelRevision:'pinned', tourId:'show', entry:'default', chapters:[
  { id:'overview' }, { id:'leg', inspectNodeId:'hex-leg-1', action:{ type:'motion' } }, { id:'electronics', action:{ type:'separate' } }
] };
const nodes = new Map([
  ['hexapod', { id:'hexapod', parent:null, children:['hex-leg-1','hex-body'] }],
  ['hex-leg-1', { id:'hex-leg-1', parent:'hexapod', children:['foot'] }],
  ['foot', { id:'foot', parent:'hex-leg-1', children:[] }],
  ['hex-body', { id:'hex-body', parent:'hexapod', children:[] }]
]);

test('only an explicitly authored chapter with a node in this model can hand off inspection', () => {
  assert.deepEqual(resolveChapterInspectionTarget(nodes, guide, 'leg'), { chapterId:'leg', nodeId:'hex-leg-1' });
  for (const id of ['overview','electronics','unknown',undefined]) assert.equal(resolveChapterInspectionTarget(nodes, guide, id), null);
  assert.equal(resolveChapterInspectionTarget(null, guide, 'leg'), null);
  const invalid = structuredClone(guide); invalid.chapters[1].inspectNodeId = 'another-model-leg';
  assert.equal(resolveChapterInspectionTarget(nodes, invalid, 'leg'), null);
  const noOptIn = structuredClone(guide); delete noOptIn.chapters[1].inspectNodeId;
  assert.equal(resolveChapterInspectionTarget(nodes, noOptIn, 'leg'), null, 'a visible chapter group is not an implicit handoff');
});

function routeFixture() {
  const browser = { location:new URL('https://example.test/explorer/?model=hexapod&presentation=1#leg') };
  browser.history = Object.fromEntries(['pushState','replaceState'].map(name => [name, (_state, _title, url) => { browser.location = new URL(url); }]));
  const original = { ...enterScope(createNavigation('hexapod'), nodes, 'hex-body'), camera:{ position:[4,3,8], offset:[12,4] } };
  let workspace = original, snapshot = { chapterId:'leg', progress:.65, view:{ position:[2,4,5] } };
  const mounted = [], calls = []; let navigation;
  navigation = createOrbitalNavigation({ model, guide, browser, listen() {}, load:async () => ({}),
    mount(_api, chapterId, _navigate, _exit, checkpoints) {
      snapshot = checkpoints.get(chapterId) || { chapterId, progress:.65, view:{ position:[2,4,5] } };
      mounted.push(structuredClone(snapshot));
      return { captureState:() => snapshot, dispose() { calls.push('dispose-demo'); } };
    }, onPending() {}, onChange() {}, onExit() { calls.push('restore-workspace'); workspace = original; }, onFailure(error) { throw error; }
  });
  const handoff = createContextualInspectionHandoff({
    resolveTarget:() => resolveChapterInspectionTarget(nodes, guide, navigation.state.chapter),
    isDemoActive:() => navigation.active, closeDemo:() => navigation.close(),
    focusTarget:({ nodeId }) => { calls.push(`focus:${nodeId}`); workspace = { ...enterScope(workspace, nodes, nodeId), camera:{ position:[1,2,3], offset:[0,0] } }; }
  });
  return { navigation, handoff, original, mounted, calls, get workspace() { return workspace; } };
}

test('ordinary Explore restores the old workspace without contextual focus', async () => {
  const f = routeFixture(); await f.navigation.sync(); await f.navigation.close();
  assert.equal(f.workspace, f.original); assert.deepEqual(f.calls, ['dispose-demo','restore-workspace']);
  await f.navigation.open(); assert.equal(f.mounted.at(-1).chapterId, 'leg'); assert.equal(f.mounted.at(-1).progress, .65);
  f.navigation.dispose();
});

test('context action focuses the authored subtree only after Demo disposal and resumes the same paused checkpoint', async () => {
  const f = routeFixture(); await f.navigation.sync(); assert.equal(await f.handoff.inspect(), true);
  assert.deepEqual(f.calls, ['dispose-demo','restore-workspace','focus:hex-leg-1']);
  assert.equal(f.workspace.scopeId, 'hex-leg-1'); assert.equal(f.workspace.selectedId, 'hex-leg-1'); assert.equal(f.workspace.isolated, false);
  assert.deepEqual([...f.workspace.expanded], ['hexapod','hex-leg-1']);
  assert.deepEqual(f.original.camera, { position:[4,3,8], offset:[12,4] }, 'handoff does not mutate the old snapshot');
  await f.navigation.open(); const checkpoint = f.mounted.at(-1);
  assert.equal(checkpoint.chapterId, 'leg'); assert.equal(checkpoint.progress, .65); assert.deepEqual(checkpoint.view, { position:[2,4,5] });
  f.navigation.dispose();
});

test('unavailable contextual action does not navigate or change state', async () => {
  const calls = [];
  for (const active of [false, true]) {
    const handoff = createContextualInspectionHandoff({ resolveTarget:() => null, isDemoActive:() => active, closeDemo:() => calls.push('close'), focusTarget:() => calls.push('focus') });
    assert.equal(await handoff.inspect(), false); assert.equal(handoff.pending, false);
  }
  assert.deepEqual(calls, []);
});

test('a newer route during closing cancels the old handoff without touching the newly mounted Demo', async () => {
  const closing = deferred(), pending = []; let active = true, focused = 0;
  const handoff = createContextualInspectionHandoff({ resolveTarget:() => ({ nodeId:'hex-leg-1' }), isDemoActive:() => active,
    closeDemo:() => closing.promise, focusTarget:() => focused++, onPending:value => pending.push(value) });
  const old = handoff.inspect(); assert.equal(handoff.pending, true); assert.equal(await handoff.inspect(), false, 'duplicate clicks do not enqueue a second exit');
  handoff.cancel(); active = true; closing.resolve();
  assert.equal(await old, false); assert.equal(focused, 0); assert.equal(handoff.pending, false); assert.deepEqual(pending, [true,false]);
});

test('new Demo ownership interrupts a multi-command focus before later mutations and ignores stale finally', async () => {
  const first = deferred(); let active = true; const calls = [], pending = [];
  const handoff = createContextualInspectionHandoff({ resolveTarget:() => ({ nodeId:'hex-leg-1' }), isDemoActive:() => active,
    closeDemo:async () => { active = false; }, onPending:value => pending.push(value),
    focusTarget:async (_target, owns) => { calls.push('normalize-old-pose'); await first.promise; if (!owns()) return false; calls.push('focus-leg'); }
  });
  const old = handoff.inspect(); await Promise.resolve();
  handoff.cancel(); active = true; first.resolve();
  assert.equal(await old, false); assert.deepEqual(calls, ['normalize-old-pose']); assert.deepEqual(pending, [true,false]);
});

test('failed focus clears pending so a later contextual retry can complete', async () => {
  let active = true, fail = true;
  const handoff = createContextualInspectionHandoff({ resolveTarget:() => ({ nodeId:'hex-leg-1' }), isDemoActive:() => active,
    closeDemo:async () => { active = false; }, focusTarget:async () => { if (fail) throw new Error('Focus unavailable'); return true; } });
  await assert.rejects(handoff.inspect(), /Focus unavailable/); assert.equal(handoff.pending, false);
  fail = false; active = true; assert.equal(await handoff.inspect(), true); assert.equal(handoff.pending, false);
});

test('an older handoff finally cannot unlock a newer pending contextual inspection', async () => {
  const first = deferred(), second = deferred(); let active = true, calls = 0;
  const handoff = createContextualInspectionHandoff({ resolveTarget:() => ({ nodeId:'hex-leg-1' }), isDemoActive:() => active,
    closeDemo:async () => { active = false; }, focusTarget:() => (++calls === 1 ? first.promise : second.promise) });
  const old = handoff.inspect(); await Promise.resolve();
  handoff.cancel(); active = true; const current = handoff.inspect(); await Promise.resolve();
  first.resolve(true); assert.equal(await old, false); assert.equal(handoff.pending, true);
  second.resolve(true); assert.equal(await current, true); assert.equal(handoff.pending, false);
});
