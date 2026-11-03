import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { GuidedTour } from '../../src/explorer/tour-ui.js';
import { presentationEntry } from '../../src/explorer/presentation-entry.js';
import { loadProject } from '../../scripts/lib/project-config.mjs';

const rectangle = (left = 0, top = 0, width = 0, height = 0) => ({ left, top, width, height, right:left + width, bottom:top + height });
class Element extends EventTarget {
  constructor(document) {
    super(); this.ownerDocument = document; this.children = []; this.dataset = {}; this.attributes = new Map(); this.descendants = new Map();
    this.hidden = false; this.disabled = false; this.inert = false; this.textContent = ''; this.rect = rectangle(); this.offsetWidth = 100; this.offsetHeight = 24;
    this.style = { setProperty(name, value) { this[name] = value; } };
    const classes = new Set(); this.classList = { add:name => classes.add(name), remove:name => classes.delete(name), contains:name => classes.has(name) };
  }
  querySelector(selector) { if (!this.descendants.has(selector)) this.descendants.set(selector, new Element(this.ownerDocument)); return this.descendants.get(selector); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  contains(node) { return node === this || this.children.some(child => child.contains(node)); }
  focus() { this.ownerDocument.activeElement = this; }
  getBoundingClientRect() { return this.rect; }
}
function authoredTour(steps) {
  const chapters = ['Whole', 'Layers'].map((title, index) => ({
    id:title.toLowerCase(), label:title, title:`${title} in view.`, caption:'Read the connected parts.',
    start:index * 2.5, end:(index + 1) * 2.5, duration:2.5, previewAt:0, settledAt:2.5,
    scopeId:'fixture', selectedId:'fixture', highlightIds:[], renderStyle:'engineering',
    explosion:index ? [0, 1] : [0, 0], camera:{ focusId:'fixture', direction:[1, 1, 1] }, annotations:[],
  }));
  return { id:'fixture-presentation', duration:5, playback:steps ? 'steps' : 'continuous', chapters };
}
function fixture(t, { steps = false, reducedMotion = false } = {}) {
  const document = new Element(), elements = new Map(), selectors = new Map(), motion = new Element();
  document.ownerDocument = document; document.hidden = false; document.body = new Element(document); motion.matches = reducedMotion;
  const element = id => { if (!elements.has(id)) elements.set(id, new Element(document)); return elements.get(id); };
  document.getElementById = element;
  document.querySelector = selector => { if (!selectors.has(selector)) selectors.set(selector, new Element(document)); return selectors.get(selector); };
  document.createElement = document.createElementNS = () => new Element(document);
  element('tour-panel').hidden = true; element('tour-chapters').hidden = true;
  element('tour-panel').rect = rectangle(20, 100, 960, 580);
  element('tour-copy').rect = rectangle(24, 460, 260, 90);
  document.querySelector('.tour-transport').rect = rectangle(24, 600, 952, 80);
  document.querySelector('.stage-heading').rect = rectangle(24, 60, 250, 20);
  document.querySelector('.tour-playback').append(element('tour-play'));
  const previous = { document:globalThis.document, matchMedia:globalThis.matchMedia, innerWidth:globalThis.innerWidth };
  globalThis.document = document; globalThis.matchMedia = () => motion; globalThis.innerWidth = 1000;
  const calls = [], anchors = new Map(), snapshot = { source:'prior pose' }, navigation = { source:'prior navigation' };
  const scene = {
    ready:true, disposed:false, prepareEdges:async () => {}, capturePresentation() { calls.push(['capture']); return snapshot; },
    restorePresentation:async value => { calls.push(['restore', value]); return true; },
    cancelPresentationRequest() { calls.push(['cancel']); }, cancelBenchmark() {}, pausePresentation() { calls.push(['pause']); },
    leaveTour() { calls.push(['leave']); }, refitLayout() { calls.push(['refit']); }, invalidate() { calls.push(['invalidate']); },
    applyTourFrame(frame) { calls.push(['sample', frame.time]); }, projectTourAnchor:id => anchors.get(id),
  };
  const tour = new GuidedTour({
    scene, model:{ id:'fixture', tour:authoredTour(steps) }, captureNavigation:() => navigation,
    restoreNavigation:value => calls.push(['navigation', value]), syncScene() {}, closeOverlays() {}, syncLayout() {},
  });
  t.after(() => { tour.dispose(); Object.assign(globalThis, previous); });
  return { tour, scene, document, element, calls, anchors, snapshot, navigation };
}

test('continuous presentation keeps replay and free exploration reachable through pause and completion', async t => {
  const f = fixture(t); await f.tour.start();
  assert.equal(f.tour.player.state().status, 'playing');
  assert.equal(f.element('tour-replay').hidden, false); assert.equal(f.element('tour-explore').hidden, false);
  assert.equal(f.document.querySelector('.detail-panel').inert, true);
  f.tour.jump('seek', 1.2); f.tour.interact();
  assert.equal(f.tour.player.state().reason, 'takeover'); assert.equal(f.tour.player.state().time, 1.2);
  assert.equal(f.element('tour-play').querySelector('span').textContent, 'Resume');
  assert.equal(f.document.querySelector('.detail-panel').inert, false);
  assert.equal(f.document.querySelector('.stage-tools').inert, false);
  f.tour.resume(); assert.equal(f.tour.player.state().status, 'playing');
  assert.equal(f.document.querySelector('.detail-panel').inert, true);
  f.tour.jump('seek', 5);
  assert.equal(f.tour.player.state().status, 'completed'); assert.equal(f.element('tour-play').hidden, true);
  assert.equal(f.element('tour-replay').hidden, false); assert.equal(f.element('tour-explore').hidden, false);
  assert.equal(f.element('tour-progress').value, '100');
  f.element('tour-replay').dispatchEvent(new Event('click'));
  assert.equal(f.tour.player.state().status, 'playing'); assert.equal(f.tour.player.state().time, 0);
});

test('step presentation preserves chapter-end holds and only removes the duplicate final exploration action', async t => {
  const f = fixture(t, { steps:true }); await f.tour.start();
  assert.equal(f.tour.player.state().status, 'paused'); assert.equal(f.element('tour-explore').hidden, false);
  f.tour.player.holdChapterEnd(0); f.tour.apply();
  assert.equal(f.tour.frame.chapterId, 'whole'); assert.equal(f.element('tour-progress').value, '100');
  assert.equal(f.element('tour-play').querySelector('span').textContent, 'Next step');
  f.element('tour-play').dispatchEvent(new Event('click')); await nextTurn();
  assert.equal(f.tour.player.state().index, 1); assert.equal(f.tour.player.state().status, 'playing');
  f.tour.player.holdChapterEnd(1); f.tour.apply();
  assert.equal(f.element('tour-play').querySelector('span').textContent, 'Explore freely');
  assert.equal(f.element('tour-explore').hidden, true); assert.equal(f.element('tour-replay').hidden, false);
  f.element('tour-play').dispatchEvent(new Event('click')); await nextTurn();
  assert.equal(f.tour.active, false); assert.equal(f.calls.some(([name]) => name === 'restore'), false);
});

for (const restore of [true, false]) {
  test(restore ? 'Close restores the prior scene and navigation' : 'Explore freely retains the current pose without restoring prior navigation', async t => {
    const f = fixture(t); await f.tour.start(); f.tour.jump('seek', 3.5);
    assert.equal(await f.tour.exit({ restore }), true); assert.equal(f.tour.active, false);
    assert.equal(f.element('tour-panel').hidden, true); assert.equal(f.document.body.classList.contains('tour-active'), false);
    assert.equal(f.document.querySelector('.stage-tools').inert, false); assert.equal(f.document.querySelector('.detail-panel').inert, false);
    assert.deepEqual(f.calls.filter(([name]) => name === 'restore'), restore ? [['restore', f.snapshot]] : []);
    assert.deepEqual(f.calls.filter(([name]) => name === 'navigation'), restore ? [['navigation', f.navigation]] : []);
  });
}

test('reduced motion keeps presentation controls usable without starting source time', async t => {
  const f = fixture(t, { reducedMotion:true }); await f.tour.start();
  assert.equal(f.tour.player.state().status, 'paused'); assert.equal(f.tour.frame.settled, true);
  assert.equal(f.element('tour-play').querySelector('span').textContent, 'Next chapter');
  assert.equal(f.element('tour-explore').hidden, false); assert.equal(f.document.querySelector('.detail-panel').inert, false);
  f.tour.resume(); f.tour.tick(0); f.tour.tick(500);
  assert.equal(f.tour.player.state().time, 0); assert.equal(f.tour.player.state().status, 'paused');
});

test('a presentation prepared in an already hidden page remains paused until explicit resume', async t => {
  const f = fixture(t); f.document.hidden = true;
  let prepared; f.scene.prepareEdges = () => new Promise(resolve => { prepared = resolve; });
  const starting = f.tour.start(); assert.equal(f.tour.pending, true);
  prepared(); assert.equal(await starting, true);
  assert.equal(f.tour.player.state().hidden, true); assert.equal(f.tour.player.state().status, 'paused');
  assert.equal(f.tour.player.state().time, 0); assert.equal(f.document.querySelector('.detail-panel').inert, false);
  f.document.hidden = false; f.document.dispatchEvent(new Event('visibilitychange'));
  f.tour.tick(0); f.tour.tick(500);
  assert.equal(f.tour.player.state().status, 'paused'); assert.equal(f.tour.player.state().time, 0);
  f.tour.resume(); assert.equal(f.tour.player.state().status, 'playing');
});

test('annotation collision checks the visible caption and transport rather than their large wrapper', t => {
  const f = fixture(t); f.tour.active = true;
  f.anchors.set('clear', { visible:true, x:500, y:300 }); f.anchors.set('caption', { visible:true, x:150, y:500 });
  f.tour.frame = { annotations:[{ nodeId:'clear', label:'Clear detail' }, { nodeId:'caption', label:'Under caption' }] };
  f.tour.updateAnnotations();
  assert.equal(f.element('tour-annotations').children[0].hidden, false, 'empty space inside the wrapper remains usable');
  assert.equal(f.element('tour-annotations').children[1].hidden, true);
  f.anchors.set('transport', { visible:true, x:500, y:650 });
  f.tour.frame = { annotations:[{ nodeId:'transport', label:'Under transport' }, { nodeId:'missing', label:'Unavailable anchor' }] };
  f.tour.updateAnnotations();
  assert.equal(f.element('tour-annotations').children[0].hidden, true);
  assert.equal(f.element('tour-annotations').children[1].hidden, true);
});

test('presentation deep links cannot autoplay a fallback model or an unsupported tour', () => {
  const model = { id:'open-duck', tour:{ id:'duck-film' }, allowedCapabilities:{ tours:['duck-film'] } };
  assert.deepEqual(presentationEntry(new URLSearchParams('model=open-duck&presentation=1'), model), { tourId:'duck-film' });
  assert.equal(presentationEntry(new URLSearchParams('model=missing&presentation=1'), model), null);
  assert.equal(presentationEntry(new URLSearchParams('model=&presentation=1'), model), null);
  assert.equal(presentationEntry(new URLSearchParams('model=open-duck'), model), null);
  assert.equal(presentationEntry(new URLSearchParams('model=open-duck&presentation=1'), { ...model, allowedCapabilities:{ tours:[] } }), null);
  assert.equal(presentationEntry(new URLSearchParams('model=open-duck&presentation=1'), { ...model, tour:null }), null);
});

test('integrating robot presentations preserves the four published model revisions used by old projects', async () => {
  const baseline = {
    'kinetic-01':'sha256:6b8de14cd5f65835670aa6bf8b1f3b42f8d46f2192601d9c852c06e5564572b9',
    apollo:'sha256:26a0a051eca58f6bbaea230ba02209674bb15dcd8be3fb61fbfe6085bc440305',
    linkrods:'sha256:0fcf3da383d9da8cb65f870d50bc24200864254a23192ad5c10646804de4076a',
    sk08:'sha256:c1f912af43ddac4ad27f2ff99c05ed1ffa3f8bc4e7057309eca6c1194912949a',
  };
  const { project, models } = await loadProject(fileURLToPath(new URL('../../', import.meta.url)));
  assert.equal(project.id, 'annora-explorer'); assert.equal(project.defaultModel, 'kinetic-01');
  const revisions = new Map(models.map(model => [model.manifest.id, model.revision]));
  for (const [id, revision] of Object.entries(baseline)) assert.equal(revisions.get(id), revision, `published ${id} references remain compatible`);
});
