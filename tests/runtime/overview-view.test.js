import test from 'node:test';
import assert from 'node:assert/strict';
import { createDrawingOverview } from '../../src/drawings/drawing-overview.js';

class ClassList {
 constructor(node){this.node=node;}
 get set(){return new Set((this.node.className||'').split(/\s+/).filter(Boolean));}
 contains(value){return this.set.has(value);}
 add(...values){const s=this.set;for(const value of values)s.add(value);this.node.className=[...s].join(' ');}
 remove(...values){const s=this.set;for(const value of values)s.delete(value);this.node.className=[...s].join(' ');}
 toggle(value,force){const on=force??!this.contains(value);if(on)this.add(value);else this.remove(value);return on;}
}
class Element {
 constructor(tag,doc){this.tagName=tag.toUpperCase();this.localName=tag;this.ownerDocument=doc;this.children=[];this.attrs=new Map();this.dataset={};this.style={};this.listeners=new Map();this.classList=new ClassList(this);this.hidden=false;this.value='';}
 get className(){return this.attrs.get('class')||'';}
 set className(value){this.attrs.set('class',value);}
 get parentElement(){return this.parentNode;}
 get clientWidth(){return this.getBoundingClientRect().width;}
 setAttribute(name,value){this.attrs.set(name,String(value));if(name.startsWith('data-'))this.dataset[name.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=String(value);}
 getAttribute(name){return this.attrs.get(name)??null;}
 hasAttribute(name){return this.attrs.has(name);}
 removeAttribute(name){this.attrs.delete(name);}
 append(...children){for(const child of children){this.children.push(child);child.parentNode=this;}}
 appendChild(child){this.append(child);return child;}
 replaceChildren(...children){for(const child of this.children)child.parentNode=null;this.children=[];this.append(...children);}
 remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(child=>child!==this);this.parentNode=null;}
 contains(node){return node===this||this.children.some(child=>child.contains(node));}
 matches(selector){if(selector.includes(','))return selector.split(',').some(s=>this.matches(s.trim()));if(selector.startsWith('.'))return this.classList.contains(selector.slice(1));const attr=selector.match(/^\[([^=\]]+)(?:=["']?([^"'\]]+)["']?)?\]$/);if(attr)return this.hasAttribute(attr[1])&&(attr[2]===undefined||this.getAttribute(attr[1])===attr[2]);return this.localName===selector;}
 closest(selector){return this.matches(selector)?this:this.parentNode?.closest(selector)||null;}
 querySelectorAll(selector){return this.children.flatMap(child=>[...(child.matches(selector)?[child]:[]),...child.querySelectorAll(selector)]);}
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
 addEventListener(type,listener,options){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add({listener,capture:options===true||options?.capture===true});}
 removeEventListener(type,listener){for(const item of this.listeners.get(type)||[])if(item.listener===listener)this.listeners.get(type).delete(item);}
 emit(type,event={}){const ev={type,target:this,currentTarget:this,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.propagationStopped=true;},...event};for(const item of this.listeners.get(type)||[])if(!event.phase||item.capture===(event.phase==='capture'))item.listener(ev);return ev;}
 getBoundingClientRect(){return this.rect||this.parentNode?.getBoundingClientRect()||{left:0,top:0,width:1000,height:600};}
 focus(){this.ownerDocument.activeElement=this;}
}

const entries = [
  { id: 'front:A', title: 'Front view', sheetId: 'page-A', regionIds: ['bore-A'], defaultRegionId: 'bore-A', artwork: '<svg/>', profile: { id: 'front:A', regions: [{ id: 'bore-A', partId: 'body-A', label: 'Shaft bore' }] } },
  { id: 'top:A', title: 'Top view', sheetId: 'page-A', regionIds: ['holes-A'], defaultRegionId: 'holes-A', artwork: '<svg/>', profile: { id: 'top:A', regions: [{ id: 'holes-A', partId: 'body-A', label: 'Mounting holes' }] } },
  { id: 'iso:A', title: 'Isometric', sheetId: 'page-A', regionIds: ['overview-A'], defaultRegionId: 'overview-A', artwork: '<svg/>', profile: { id: 'iso:A', regions: [{ id: 'overview-A', partId: 'body-A', label: 'Body overview' }] } },
];
function fixture({ width = 1000, lockedRegionId = null, selectedId = 'bore-A', data = entries, failId } = {}) {
 const doc = { createElement: tag => new Element(tag, doc), createElementNS: (_, tag) => new Element(tag, doc) };
 const mount = doc.createElement('div'); mount.rect = { left: 0, top: 0, width, height: 600 };
 const calls = [], opened = [], errors = [], observers = [];
 class Observer { constructor(callback) { this.callback = callback; observers.push(this); } observe(target) { this.target = target; } disconnect() { this.disconnected = true; } }
 const createView = options => {
  if (options.profile.id === failId) throw new Error('Prepared source unavailable');
  const element = doc.createElementNS('', 'svg'); options.mount.append(element);
  const state = { options, selected: [], resized: 0, disposed: 0, element };
  const viewer = { element, ready: Promise.resolve(), select(id) { state.selected.push(id); }, resize() { state.resized++; }, dispose() { state.disposed++; element.remove(); } };
  calls.push(state); return viewer;
 };
 const viewer = createDrawingOverview({ mount, entries: data, selectedId, lockedRegionId, document: doc, window: { innerWidth: width }, ResizeObserver: Observer, createView,
  onOpen: value => opened.push(value), onError: error => errors.push(error.message) });
 return { viewer, mount, calls, opened, errors, observers,
  heading(index = 0) { return viewer.element.querySelectorAll('.drawing-overview-open')[index]; },
  canvas(index = 0) { return viewer.element.querySelectorAll('.drawing-overview-canvas')[index]; },
  resize(next) { mount.rect.width = next; observers[0].callback(); },
 };
}
const tick = () => Promise.resolve();

test('overview opens exact canonical targets and never mutates its source entries', async () => {
 const before = structuredClone(entries), f = fixture(); await f.viewer.ready;
 assert.equal(f.viewer.element.getAttribute('data-layout'), 'grid'); assert.equal(f.calls.length, 3);
 assert.deepEqual(f.calls.map(call => call.selected.at(-1)), ['bore-A', null, null]);
 f.heading(1).emit('click'); assert.deepEqual(f.opened.at(-1), { entryId: 'top:A', regionId: 'holes-A', focus: false });
 f.calls[0].options.onSelect('bore-A'); assert.deepEqual(f.opened.at(-1), { entryId: 'front:A', regionId: 'bore-A', focus: true });
 assert.deepEqual(entries, before); assert.equal(f.viewer.select('unrelated-region'), false);
 f.viewer.dispose();
});

test('frozen overview allows another composition without switching the recorded region or exposing other targets', async () => {
 const f = fixture({ lockedRegionId: 'bore-A', selectedId: 'holes-A' }); await f.viewer.ready;
 assert.deepEqual(f.calls.map(call => call.options.profile.regions.map(region => region.id)), [['bore-A'], [], []]);
 f.heading(1).emit('click'); assert.deepEqual(f.opened.at(-1), { entryId: 'top:A', regionId: 'bore-A', focus: false });
 f.calls[1].options.onSelect('holes-A'); assert.deepEqual(f.opened.at(-1), { entryId: 'top:A', regionId: 'bore-A', focus: false });
 assert.equal(f.viewer.select('holes-A'), false); assert.equal(f.viewer.select(null), false);
 assert.equal(f.viewer.focusRegion('holes-A'), false); assert.equal(f.viewer.focusRegion('bore-A'), true);
 assert.deepEqual(f.opened.at(-1), { entryId: 'front:A', regionId: 'bore-A', focus: true });
 assert.equal(f.viewer.select('bore-A'), true);
 assert.deepEqual(f.calls.map(call => call.selected.at(-1)), ['bore-A', null, null]);
 f.viewer.dispose();
});

test('narrow containers mount one vector reader and dispose replaced views across selection and layout changes', async () => {
 const pinned = fixture({ width: 320, lockedRegionId: 'bore-A', data: [
   { ...entries[0], id: 'whole:A', regionIds: ['bore-A', 'holes-A'] }, entries[0],
 ] });
 await pinned.viewer.ready; assert.equal(pinned.viewer.activeEntryId, 'front:A', 'a pinned mobile feature prefers its dedicated composition over a whole-part view');
 assert.equal(pinned.calls.length, 1); pinned.viewer.dispose();
 const f = fixture({ width: 320 }); await f.viewer.ready;
 assert.equal(f.viewer.element.getAttribute('data-layout'), 'single'); assert.equal(f.calls.length, 1);
 const picker = f.viewer.element.querySelector('select'); picker.value = 'top:A'; picker.emit('change'); await f.viewer.ready;
 assert.equal(f.calls[0].disposed, 1); assert.equal(f.calls.length, 2); assert.equal(f.viewer.activeEntryId, 'top:A'); assert.equal(f.opened.length, 0, 'browsing the compact chooser does not change a reference');
 f.viewer.select('bore-A'); await f.viewer.ready; assert.equal(f.viewer.activeEntryId, 'front:A'); assert.equal(f.calls[1].disposed, 1);
 f.resize(1000); await f.viewer.ready; assert.equal(f.viewer.element.getAttribute('data-layout'), 'grid'); assert.equal(f.calls.length, 6); assert.equal(f.calls[2].disposed, 1);
 f.resize(800); assert.ok(f.calls.slice(3).every(call => call.resized === 1));
 f.viewer.dispose(); f.viewer.dispose(); assert.ok(f.calls.every(call => call.disposed === 1)); assert.equal(f.mount.children.length, 0); assert.equal(f.observers[0].disconnected, true);
 picker.emit('change'); assert.equal(f.calls.length, 6); assert.equal(f.viewer.select('bore-A'), false);
});

test('a single feature tap opens once; blank taps open the composition while drag and pinch do not navigate', async () => {
 const f = fixture(), canvas = f.canvas(); await f.viewer.ready;
 canvas.emit('pointerdown', { pointerId: 1, button: 0, clientX: 100, clientY: 100 });
 canvas.emit('pointerup', { phase: 'capture', pointerId: 1, button: 0, clientX: 100, clientY: 100 });
 f.calls[0].options.onSelect('bore-A'); canvas.emit('pointerup', { phase: 'bubble', pointerId: 1, button: 0, clientX: 100, clientY: 100 }); await tick(); assert.equal(f.opened.length, 1); assert.equal(f.opened[0].focus, true);
 canvas.emit('pointerdown', { pointerId: 2, button: 0, clientX: 10, clientY: 10 });
 canvas.emit('pointerup', { pointerId: 2, button: 0, clientX: 10, clientY: 10 }); await tick(); assert.equal(f.opened.length, 2); assert.equal(f.opened[1].focus, false);
 canvas.emit('pointerdown', { pointerId: 3, button: 0, clientX: 10, clientY: 10 });
 canvas.emit('pointermove', { pointerId: 3, clientX: 40, clientY: 30 });
 canvas.emit('pointerup', { pointerId: 3, clientX: 40, clientY: 30 }); await tick(); assert.equal(f.opened.length, 2);
 canvas.emit('pointerdown', { pointerId: 4, button: 0, clientX: 10, clientY: 10 });
 canvas.emit('pointerdown', { pointerId: 5, button: 0, clientX: 50, clientY: 10 });
 canvas.emit('pointerup', { pointerId: 5, clientX: 50, clientY: 10 }); canvas.emit('pointerup', { pointerId: 4, clientX: 10, clientY: 10 }); await tick(); assert.equal(f.opened.length, 2);
 canvas.emit('pointerdown', { pointerId: 6, button: 0, clientX: 10, clientY: 10 }); canvas.emit('pointerup', { phase: 'capture', pointerId: 6, clientX: 10, clientY: 10 }); f.viewer.dispose(); canvas.emit('pointerup', { phase: 'bubble', pointerId: 6, clientX: 10, clientY: 10 }); await tick(); assert.equal(f.opened.length, 2, 'a disposed host cannot reopen a late gesture');
});

test('unavailable prepared views report failure without creating another source or silently picking a different entry', async () => {
 const f = fixture({ failId: 'top:A' }); await f.viewer.ready;
 assert.deepEqual(f.errors, ['Prepared source unavailable']); assert.equal(f.heading(1).disabled, true); assert.equal(f.calls.length, 2); assert.equal(f.opened.length, 0);
 f.viewer.dispose();
 const empty = fixture({ data: [] }); await empty.viewer.ready; assert.equal(empty.calls.length, 0); assert.match(empty.viewer.element.querySelector('.drawing-overview-error').textContent, /not available for this source version/); empty.viewer.dispose();
 assert.throws(() => fixture({ data: [entries[0], entries[0]] }), /unique IDs/);
});
