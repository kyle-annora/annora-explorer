import test from 'node:test';
import assert from 'node:assert/strict';
import { createDrawingView, drawingHitBounds, drawingRegionAtPoint } from '../../src/drawing-preview/drawing-view.js';

const sheet = {
  title: 'Reference drawing', viewBox: [0, 0, 800, 600],
  regions: [
    { id: 'overview', label: 'Part overview', bounds: [80, 80, 450, 150] },
    { id: 'large', label: 'Large bore', bounds: [100, 100, 40, 40] },
    { id: 'small', label: 'Small bore', bounds: [210, 110, 16, 16] },
    { id: 'web', label: 'Connecting web', bounds: [140, 112, 70, 12] },
  ],
};

class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.attributes = new Map(); this.listeners = new Map(); this.style = {}; this.captures = new Set(); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name); }
  append(...children) { for (const child of children) { this.children.push(child); child.parent = this; } }
  replaceChildren(...children) { this.children.forEach(child => { child.parent = null; }); this.children = []; this.append(...children); }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.parent = null; }
  addEventListener(name, listener) { if (!this.listeners.has(name)) this.listeners.set(name, new Set()); this.listeners.get(name).add(listener); }
  removeEventListener(name, listener) { this.listeners.get(name)?.delete(listener); }
  emit(name, values = {}) {
    const event = { prevented: false, preventDefault() { this.prevented = true; }, stopPropagation() {}, ...values };
    for (const listener of this.listeners.get(name) || []) listener(event);
    return event;
  }
  getBoundingClientRect() { return this.rect || this.parent?.getBoundingClientRect() || { left: 0, top: 0, width: 800, height: 600 }; }
  setPointerCapture(id) { this.captures.add(id); }
  hasPointerCapture(id) { return this.captures.has(id); }
  releasePointerCapture(id) { this.captures.delete(id); }
}
function fixture(size = { width: 800, height: 600 }) {
  const mount = new Element('div'); mount.rect = { left: 0, top: 0, ...size };
  const selected = [], views = [], errors = [];
  const observers = [];
  class Observer { constructor(callback) { this.callback = callback; observers.push(this); } observe(element) { this.element = element; } disconnect() { this.disconnected = true; } }
  const doc = { baseURI: 'https://example.test/repo/drawings/', createElementNS: (namespace, tag) => new Element(tag) };
  const viewer = createDrawingView({ mount, assetURL: './sheet.svg', sheet, document: doc, window: new Element('window'), ResizeObserver: Observer,
    onSelect: (...args) => selected.push(args), onViewChange: view => views.push(view), onError: error => errors.push(error) });
  const root = viewer.element, stage = root.children.at(-1);
  const region = id => stage.children.find(child => child.getAttribute('data-region-id') === id);
  const transform = () => stage.getAttribute('transform').match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/gi).map(Number);
  const point = (x, y) => { const [tx, ty, scale] = transform(); return { clientX: tx + x * scale, clientY: ty + y * scale }; };
  const pointer = (name, x, y, extra = {}) => root.emit(name, { pointerId: 1, button: 0, pointerType: 'mouse', ...point(x, y), ...extra });
  return { viewer, mount, selected, views, errors, observers, root, stage, region, transform, point, pointer };
}

test('drawing renders the original SVG as one vector image with exact source coordinates', () => {
  const f = fixture();
  assert.equal(f.stage.children[1].tag, 'image');
  assert.equal(f.stage.children[1].getAttribute('href'), 'https://example.test/repo/drawings/sheet.svg');
  assert.equal(f.stage.children[1].getAttribute('width'), '800');
  assert.equal(f.stage.children[1].getAttribute('height'), '600');
  assert.equal(f.region('overview'), undefined, 'overview must not swallow the individual detail targets');
  assert.equal(f.region('small').getAttribute('role'), 'button');
  assert.equal(f.region('small').getAttribute('tabindex'), '0');
  assert.match(f.region('small').getAttribute('aria-label'), /Small bore.*3D/);
  assert.equal(f.views.at(-1).zoom, 1);
});

test('minimum target sizes remain usable on mobile without stealing a neighbouring actual detail', () => {
  const f = fixture({ width: 360, height: 420 }), [, , scale] = f.transform();
  const target = f.region('small').children[0];
  assert.ok(Number(target.getAttribute('width')) * scale >= 44 - 1e-8);
  assert.ok(Number(target.getAttribute('height')) * scale >= 44 - 1e-8);
  assert.deepEqual(drawingHitBounds([0, 0, 2, 2], .5, [0, 0, 800, 600]), [0, 0, 88, 88]);
  const regions = sheet.regions.slice(1);
  assert.equal(drawingRegionAtPoint(regions, { x: 215, y: 118 }, scale, sheet.viewBox).id, 'small');
  assert.equal(drawingRegionAtPoint(regions, { x: 175, y: 118 }, scale, sheet.viewBox).id, 'web');
  assert.equal(drawingRegionAtPoint(regions, { x: -1, y: 118 }, scale, sheet.viewBox), null);
  f.pointer('pointermove', 215, 118);
  assert.equal(f.region('small').getAttribute('data-hover'), 'true');
  assert.equal(f.region('web').getAttribute('data-hover'), 'false');
  f.pointer('pointerdown', 215, 118); f.pointer('pointerup', 215, 118);
  assert.equal(f.selected.at(-1)[0], 'small');
});

test('programmatic linkage is silent; keyboard and assistive activation announce the chosen region', () => {
  const f = fixture();
  assert.equal(f.viewer.select('large'), true);
  assert.equal(f.selected.length, 0, '3D->drawing should not echo a drawing->3D selection');
  assert.equal(f.region('large').getAttribute('aria-pressed'), 'true');
  f.region('small').emit('keydown', { key: 'Enter' });
  assert.equal(f.selected.length, 1); assert.equal(f.selected[0][0], 'small');
  assert.equal(f.region('large').getAttribute('aria-pressed'), 'false');
  f.region('web').emit('click', { detail: 0 });
  assert.equal(f.selected.at(-1)[0], 'web');
  assert.equal(f.viewer.select('missing'), false);
  assert.equal(f.viewer.selectedId, 'web');
});

test('zoom, focus and resize preserve vector coordinates and keep the paper reachable', () => {
  const f = fixture();
  f.viewer.zoomBy(2); assert.equal(f.viewer.zoom, 2);
  f.viewer.select('small', { focus: true }); assert.equal(f.viewer.zoom, 4);
  assert.equal(f.selected.length, 0);
  f.mount.rect = { left: 0, top: 0, width: 360, height: 640 };
  f.observers[0].callback(); assert.equal(f.viewer.zoom, 4);
  assert.equal(f.root.getAttribute('viewBox'), '0 0 360 640');
  f.viewer.zoomBy(100); assert.equal(f.viewer.zoom, 8);
  f.viewer.zoomBy(.0001); assert.equal(f.viewer.zoom, 1);
  f.viewer.zoomBy(-1); assert.equal(f.viewer.zoom, 1);
  f.viewer.fit(); assert.equal(f.views.at(-1).canZoomOut, false);
});

test('dragging and pinching never accidentally activate a drawing region', () => {
  const f = fixture();
  f.viewer.zoomBy(2);
  const start = f.point(120, 120);
  f.root.emit('pointerdown', { pointerId: 1, button: 0, ...start });
  f.root.emit('pointermove', { pointerId: 1, clientX: start.clientX + 30, clientY: start.clientY });
  f.root.emit('pointerup', { pointerId: 1, clientX: start.clientX + 30, clientY: start.clientY });
  assert.equal(f.selected.length, 0);
  f.viewer.fit();
  f.root.emit('pointerdown', { pointerId: 1, button: 0, clientX: 250, clientY: 250 });
  f.root.emit('pointerdown', { pointerId: 2, button: 0, clientX: 350, clientY: 250 });
  f.root.emit('pointermove', { pointerId: 2, clientX: 450, clientY: 250 });
  assert.equal(f.viewer.zoom, 2);
  f.root.emit('pointerup', { pointerId: 2, clientX: 450, clientY: 250 });
  f.root.emit('pointerup', { pointerId: 1, clientX: 250, clientY: 250 });
  assert.equal(f.selected.length, 0);
});

test('ordinary wheel scrolling remains available; zoom opts in and disposal removes listeners', () => {
  const f = fixture();
  const scroll = f.root.emit('wheel', { ctrlKey: false, deltaY: -100, clientX: 400, clientY: 300 });
  assert.equal(scroll.prevented, false); assert.equal(f.viewer.zoom, 1);
  const zoom = f.root.emit('wheel', { ctrlKey: true, deltaY: -40, clientX: 400, clientY: 300 });
  assert.equal(zoom.prevented, true); assert.ok(f.viewer.zoom > 1);
  f.stage.children[1].emit('error'); assert.match(f.errors[0].message, /original PDF/);
  f.viewer.dispose(); f.viewer.dispose();
  assert.equal(f.mount.children.length, 0); assert.equal(f.observers[0].disconnected, true);
  assert.ok([...f.root.listeners.values()].every(listeners => listeners.size === 0));
  assert.equal(f.viewer.select('small'), false);
});
