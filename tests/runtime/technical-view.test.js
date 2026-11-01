import test from 'node:test';
import assert from 'node:assert/strict';
import { createTechnicalDrawingView } from '../../src/drawing-preview/technical-view.js';

const NS = 'http://www.w3.org/2000/svg';
const profile = {
  id: 'prepared-front', title: 'Front view', sheetId: 'sheet-1', viewBox: [0, 0, 1000, 720], detailViewBox: [330, 90, 315, 340],
  regions: [{ id: 'shaft-bore', label: 'Shaft bore', partId: 'body', geometry: { type: 'circle', cx: 487, cy: 306, r: 56 } },
    { id: 'isometric', label: 'Unmapped isometric region', bounds: [10, 10, 20, 20] }],
  featureOutlinePathIds: ['bore-left', 'bore-right'],
};

class Element {
  constructor(tag) { this.localName = tag; this.namespaceURI = NS; this.children = []; this.attrs = new Map(); this.listeners = new Map(); this.style = {}; this.captures = new Set(); }
  get attributes() { return [...this.attrs].map(([name, value]) => ({ name, localName: name.split(':').at(-1), value })); }
  setAttribute(name, value) { this.attrs.set(name, String(value)); }
  getAttribute(name) { return this.attrs.get(name) ?? null; }
  hasAttribute(name) { return this.attrs.has(name); }
  removeAttribute(name) { this.attrs.delete(name); }
  append(...children) { for (const child of children) { this.children.push(child); child.parentNode = this; } }
  replaceChildren(...children) { this.children.forEach(child => { child.parentNode = null; }); this.children = []; this.append(...children); }
  replaceWith(node) { const index = this.parentNode.children.indexOf(this); this.parentNode.children[index] = node; node.parentNode = this.parentNode; this.parentNode = null; }
  remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this); this.parentNode = null; }
  querySelectorAll(selector) {
    const matches = node => selector === '*' || (selector.startsWith('.') ? (node.getAttribute('class') || '').split(/\s+/).includes(selector.slice(1)) : node.localName === selector);
    return this.children.flatMap(child => [...(matches(child) ? [child] : []), ...child.querySelectorAll(selector)]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  cloneNode(deep) { const node = new Element(this.localName); for (const [name, value] of this.attrs) node.setAttribute(name, value); node.textContent = this.textContent; if (deep) node.append(...this.children.map(child => child.cloneNode(true))); return node; }
  addEventListener(name, listener) { if (!this.listeners.has(name)) this.listeners.set(name, new Set()); this.listeners.get(name).add(listener); }
  removeEventListener(name, listener) { this.listeners.get(name)?.delete(listener); }
  emit(name, values = {}) { const event = { preventDefault() {}, stopPropagation() {}, ...values }; for (const listener of this.listeners.get(name) || []) listener(event); return event; }
  getBoundingClientRect() { return this.rect || this.parentNode?.getBoundingClientRect() || { left: 0, top: 0, width: 800, height: 600 }; }
  setPointerCapture(id) { this.captures.add(id); }
  hasPointerCapture(id) { return this.captures.has(id); }
  releasePointerCapture(id) { this.captures.delete(id); }
}
const el = (tag, attributes = {}, children = []) => { const node = new Element(tag); for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value); node.append(...children); return node; };
function artwork() {
  return el('svg', { viewBox: '0 0 1000 720', 'aria-labelledby': 'drawing-title' }, [
    el('title', { id: 'drawing-title' }),
    el('g', { transform: 'translate(0 0)', fill: 'none' }, [el('path', { id: 'bore-left', d: 'M480 250C430 254 428 360 490 363' }), el('path', { id: 'bore-right', d: 'M490 363C544 336 544 250 494 250' })]),
    el('g', { 'data-presentation': 'front' }, [el('text', { x: 10, y: 20 })]),
    el('g', { 'data-presentation': 'detail', display: 'none' }, [el('text', { x: 566, y: 408 })]),
  ]);
}
function fixture({ size = { width: 800, height: 600 }, data = profile, parsed = artwork() } = {}) {
  const mount = new Element('div'); mount.rect = { left: 0, top: 0, ...size };
  const selected = [], views = [], errors = [], revoked = [], observers = [];
  class Parser { parseFromString() { return { documentElement: parsed, querySelector: () => null }; } }
  class Observer { constructor(callback) { this.callback = callback; observers.push(this); } observe() {} disconnect() { this.disconnected = true; } }
  const doc = { baseURI: 'https://example.test/', createElementNS: (_, tag) => new Element(tag), importNode: (node, deep) => node.cloneNode(deep) };
  const viewer = createTechnicalDrawingView({ mount, profile: data, artwork: '<svg/>', document: doc, window: new Element('window'), DOMParser: Parser, ResizeObserver: Observer,
    URL: { createObjectURL: () => 'blob:placeholder', revokeObjectURL: url => revoked.push(url) },
    onSelect: (...args) => selected.push(args), onViewChange: state => views.push(state), onError: error => errors.push(error) });
  const root = viewer.element, stage = root.children.find(child => child.localName === 'g');
  const region = () => root.querySelector('.drawing-region');
  const transform = () => stage.getAttribute('transform').match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/gi).map(Number);
  const point = (x, y) => { const [tx, ty, scale] = transform(); return { clientX: tx + x * scale, clientY: ty + y * scale }; };
  const pointer = (name, x, y, extra = {}) => root.emit(name, { pointerId: 1, button: 0, pointerType: 'mouse', ...point(x, y), ...extra });
  return { viewer, mount, selected, views, errors, revoked, observers, root, stage, region, transform, point, pointer };
}

test('prepared SVG stays inline with exact source paths, scoped states and a slot-preserving outline', async () => {
  const f = fixture(); await f.viewer.ready;
  assert.equal(f.root.querySelector('image'), null); assert.equal(f.root.querySelector('canvas'), null);
  const inline = f.root.querySelector('.technical-vector-artwork'), vector = inline.querySelector('svg');
  assert.equal(vector.getAttribute('viewBox'), '0 0 1000 720'); assert.equal(vector.getAttribute('width'), '1000');
  assert.equal(f.root.getAttribute('data-sheet-id'), 'sheet-1'); assert.equal(f.root.getAttribute('data-presentation'), 'front');
  const outlines = f.region().querySelectorAll('.technical-region-outline');
  assert.equal(outlines.length, 2); assert.ok(outlines.every(node => node.localName === 'path'));
  assert.equal(outlines[0].getAttribute('d'), 'M480 250C430 254 428 360 490 363');
  assert.equal(outlines[0].getAttribute('transform'), 'translate(0 0)');
  assert.equal(outlines[0].getAttribute('vector-effect'), 'non-scaling-stroke'); assert.equal(outlines[0].getAttribute('stroke-width'), '2');
  assert.equal(f.root.querySelector('circle'), null, 'the source slot must not be closed by a synthetic circle');
  assert.deepEqual(f.revoked, ['blob:placeholder']); assert.deepEqual(f.errors, []);
  assert.match(f.root.children.at(-1).textContent, /\.technical-drawing-view \.drawing-region-corners/);
});

test('canonical selection is silent, overview is unpainted, and unmapped regions cannot fake a highlight', () => {
  const f = fixture();
  assert.equal(f.viewer.select('shaft-bore'), true); assert.equal(f.selected.length, 0);
  assert.equal(f.region().getAttribute('aria-pressed'), 'true');
  assert.equal(f.viewer.select('isometric'), false); assert.equal(f.viewer.select('missing'), false); assert.equal(f.viewer.selectedId, 'shaft-bore');
  assert.equal(f.viewer.select('overview'), true); assert.equal(f.region().getAttribute('data-selected'), 'false');
  assert.equal(f.root.querySelectorAll('.drawing-region').length, 1);
  f.region().emit('keydown', { key: 'Enter' }); assert.equal(f.selected.length, 1); assert.equal(f.selected[0][0], 'shaft-bore');
  f.region().emit('click', { detail: 0 }); assert.equal(f.selected.length, 2);
  f.pointer('pointermove', 487, 306); assert.equal(f.region().getAttribute('data-hover'), 'true');
});

test('detail crop keeps original coordinates and exposes only its authored annotations', () => {
  const f = fixture({ data: { ...profile, presentation: 'bore', viewBox: profile.detailViewBox } });
  const vector = f.root.querySelector('.technical-vector-artwork').querySelector('svg');
  assert.equal(vector.getAttribute('viewBox'), '0 0 1000 720'); assert.equal(vector.getAttribute('x'), '0'); assert.equal(vector.getAttribute('width'), '1000');
  const crop = f.root.querySelector('clipPath').querySelector('rect');
  assert.equal(crop.getAttribute('x'), '330'); assert.equal(crop.getAttribute('y'), '90'); assert.equal(crop.getAttribute('width'), '315');
  const annotations = vector.querySelectorAll('g').filter(node => node.hasAttribute('data-presentation'));
  assert.equal(annotations[0].getAttribute('display'), 'none'); assert.equal(annotations[1].getAttribute('display'), 'inline');
  f.viewer.setZoom(4); f.viewer.focusRegion('shaft-bore'); assert.equal(f.viewer.zoom, 1, 'explicit detail composition is not magnified again on linkage');
});

test('mobile targets, presets, drag/pinch suppression and cleanup reuse the shared control behavior', () => {
  const f = fixture({ size: { width: 320, height: 420 } });
  const target = f.region().children[0], scale = f.transform()[2];
  assert.ok(Number(target.getAttribute('width')) * scale >= 44 - 1e-8); assert.ok(Number(target.getAttribute('height')) * scale >= 44 - 1e-8);
  f.viewer.setZoom(4); assert.equal(f.viewer.zoom, 4);
  const start = f.point(487, 306); f.root.emit('pointerdown', { pointerId: 1, button: 0, ...start });
  f.root.emit('pointermove', { pointerId: 1, clientX: start.clientX + 30, clientY: start.clientY });
  f.root.emit('pointerup', { pointerId: 1, clientX: start.clientX + 30, clientY: start.clientY }); assert.equal(f.selected.length, 0);
  f.viewer.setZoom(1); const fitted = f.transform(); f.viewer.setZoom(2); f.viewer.setZoom(1); assert.deepEqual(f.transform(), fitted);
  f.root.emit('pointerdown', { pointerId: 1, button: 0, clientX: 100, clientY: 160 }); f.root.emit('pointerdown', { pointerId: 2, button: 0, clientX: 150, clientY: 160 });
  f.root.emit('pointermove', { pointerId: 2, clientX: 200, clientY: 160 }); f.root.emit('pointerup', { pointerId: 2, clientX: 200, clientY: 160 }); f.root.emit('pointerup', { pointerId: 1, clientX: 100, clientY: 160 });
  assert.equal(f.viewer.zoom, 2); assert.equal(f.selected.length, 0); assert.equal(f.viewer.setZoom(3), false);
  f.mount.rect = { left: 0, top: 0, width: 390, height: 844 }; f.observers[0].callback(); assert.equal(f.viewer.zoom, 2);
  f.viewer.dispose(); f.viewer.dispose(); assert.equal(f.mount.children.length, 0); assert.ok(f.observers[0].disconnected); assert.equal(f.viewer.select('shaft-bore'), false);
});

test('invalid prepared geometry or missing outlines fail honestly; unprepared artwork cannot run host code', () => {
  assert.throws(() => fixture({ data: { ...profile, featureOutlinePathIds: ['no-such-source-path'] } }), /missing from the artwork/);
  assert.throws(() => fixture({ data: { ...profile, viewBox: [0, 0, 10, 10] } }), /inside its prepared view/);
  const scripted = artwork(); scripted.append(el('script')); assert.throws(() => fixture({ parsed: scripted }), /unsupported script/);
  const linked = artwork(); linked.append(el('use', { href: 'https://example.test/another.svg' })); assert.throws(() => fixture({ parsed: linked }), /external resources/);
  const styled = artwork(); styled.setAttribute('onload', 'alert(1)'); assert.throws(() => fixture({ parsed: styled }), /without scripts/);
});
