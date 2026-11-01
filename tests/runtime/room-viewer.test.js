import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoomViewer } from '../../src/product-room/viewer.js';

const tick = () => new Promise(resolve => setImmediate(resolve));
const gate = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const completed = result => ({ payload: { status: 'completed', result } });
const stateFor = (id = 'kinetic-01') => ({ lifecycle: 'ready', model: { id, revision: '1.0' },
  navigation: { selectedId: 'root', scopeId: 'root' }, presentation: { separation: { available: false, playing: false } },
  operation: { available: false, status: 'unavailable' }, tour: { active: false, status: 'idle' }, busy: [] });

class Target {
  listeners = new Map();
  addEventListener(name, callback) { if (!this.listeners.has(name)) this.listeners.set(name, new Set()); this.listeners.get(name).add(callback); }
  removeEventListener(name, callback) { this.listeners.get(name)?.delete(callback); }
  emit(name, payload = {}) { for (const callback of this.listeners.get(name) || []) callback(payload); }
  count(name) { return this.listeners.get(name)?.size || 0; }
}

function fixture(options = {}) {
  const win = new Target();
  win.location = { href: 'https://example.test/room/', origin: 'https://example.test' };
  const mount = { children: [], maximumChildren: 0, replaceChildren(...children) {
    for (const child of this.children) child.parent = null;
    this.children = children;
    this.maximumChildren = Math.max(this.maximumChildren, children.length);
    for (const child of children) child.parent = this;
  } };
  const frames = [], clients = [], received = { states: [], ready: [], errors: [] };
  const doc = { createElement(tag) {
    assert.equal(tag, 'iframe');
    const frame = new Target(); frame.contentWindow = {};
    frame.remove = () => { if (frame.parent) frame.parent.children = frame.parent.children.filter(item => item !== frame); frame.parent = null; };
    frames.push(frame); return frame;
  } };
  const clientFactory = input => {
    const ready = gate(), listeners = new Set(), allListeners = [];
    const client = { ready: ready.promise, input, state: stateFor(), calls: [], closed: 0, listeners,
      capabilities: { model: { id: 'kinetic-01', revision: '1.0' }, tours: { enabled: true, items: [{ id: 'kinetic-01' }] } },
      handshake(state) { if (state) this.state = state; ready.resolve({ state: this.state }); },
      failHandshake(error) { ready.reject(error); },
      subscribe(listener) { listeners.add(listener); allListeners.push(listener); return () => listeners.delete(listener); },
      emit(type, payload) { for (const listener of listeners) listener({ type, payload }); },
      emitStale(type, payload) { for (const listener of allListeners) listener({ type, payload }); },
      async request(method, params = {}, requestOptions) {
        this.calls.push({ method, params, options: requestOptions });
        const custom = options.request?.(this, method, params, requestOptions);
        if (custom !== undefined) return custom;
        if (method === 'getState') return completed(structuredClone(this.state));
        if (method === 'getCapabilities') return completed(this.capabilities);
        if (method === 'getNode') return completed({ id: params.nodeId, title: params.nodeId === 'root' ? 'Whole assembly' : 'Drive crank', parentId: params.nodeId === 'root' ? null : 'root' });
        if (method === 'getTour') return completed({ id: params.tourId, chapters: [{ id: 'motion', label: 'From rotation to motion' }] });
        if (method === 'pauseTour') this.state.tour.status = 'paused';
        if (method === 'pauseOperation') this.state.operation.status = 'paused';
        if (method === 'pauseExplosion') this.state.presentation.separation.playing = false;
        if (method === 'exitTour') this.state.tour = { active: false, status: 'idle' };
        return completed({});
      },
      close() { this.closed++; listeners.clear(); },
    };
    clients.push(client); return client;
  };
  const viewer = createRoomViewer({ mount, explorerURL: 'https://viewer.test/explorer/?existing=1',
    window: win, document: doc, clientFactory,
    onState: state => received.states.push(state), onReady: payload => received.ready.push(payload), onError: error => received.errors.push(error),
    disposeTimeoutMs: 20, readyTimeoutMs: 1000, ...options.viewer });
  return { viewer, mount, frames, clients, win, received, async open(modelId = 'kinetic-01') {
    const pending = viewer.mountModel(modelId); await tick();
    const frame = viewer.iframe; frame.emit('load');
    const client = clients.at(-1); client.handshake(stateFor(modelId));
    await pending; return { frame, client };
  } };
}

test('mount waits for geometry readiness, uses exact origins and exposes one unchanged iframe', async () => {
  const f = fixture(); let settled = false;
  const mounting = f.viewer.mountModel('kinetic-01').then(value => { settled = true; return value; });
  await tick();
  const frame = f.viewer.iframe, url = new URL(frame.src);
  assert.equal(url.origin, 'https://viewer.test');
  assert.equal(url.searchParams.get('existing'), '1');
  assert.equal(url.searchParams.get('embed'), '1');
  assert.equal(url.searchParams.get('parentOrigin'), 'https://example.test');
  frame.emit('load');
  const client = f.clients[0];
  assert.equal(client.input.origin, 'https://viewer.test');
  client.handshake({ ...stateFor(), lifecycle: 'loading' });
  await tick();
  assert.equal(settled, false); assert.equal(f.received.ready.length, 0);
  client.state.lifecycle = 'ready'; client.emit('ready', { state: client.state });
  const payload = await mounting;
  assert.equal(payload.state.model.id, 'kinetic-01'); assert.equal(f.received.ready.length, 1);
  await f.viewer.pause();
  assert.equal(f.viewer.iframe, frame); assert.equal(f.frames.length, 1);
  await f.viewer.dispose();
  assert.equal(f.mount.children.length, 0);
});

test('failed handshakes reject mounting and remain recoverable with a new frame', async () => {
  const f = fixture();
  const mounting = f.viewer.mountModel('apollo');
  const rejected = assert.rejects(mounting, /connection unavailable/);
  await tick(); f.viewer.iframe.emit('load');
  f.clients[0].failHandshake(Object.assign(new Error('connection unavailable'), { code: 'HANDSHAKE_TIMEOUT' }));
  await rejected;
  assert.equal(f.received.errors.length, 1); assert.equal(f.clients[0].closed, 1);
  await f.open();
  assert.equal(f.mount.children.length, 1); assert.equal(f.received.ready.length, 1);
  await f.viewer.dispose();
});

test('rapid mounts keep only the latest model and retire an existing renderer before replacement', async () => {
  const disposeGate = gate();
  const f = fixture({ request: (client, method) => method === 'dispose' && client === f.clients[0] ? disposeGate.promise : undefined });
  const initial = await f.open('apollo');
  const first = f.viewer.mountModel('kinetic-01');
  const superseded = assert.rejects(first, error => error.code === 'SUPERSEDED');
  const last = f.viewer.mountModel('apollo');
  await tick();
  assert.equal(f.mount.children[0], initial.frame); assert.equal(f.frames.length, 1);
  assert.equal(initial.frame.count('load'), 0);
  disposeGate.resolve(completed({})); await tick();
  await superseded;
  assert.equal(f.frames.length, 2); assert.equal(f.mount.maximumChildren, 1); assert.equal(initial.client.closed, 1);
  f.viewer.iframe.emit('load'); f.clients[1].handshake(stateFor('apollo')); await last;
  await f.viewer.dispose();
});

test('bounded disposal cannot trap a new model behind an unresponsive iframe', async () => {
  const f = fixture({ request: (client, method) => method === 'dispose' ? new Promise(() => {}) : undefined });
  const old = await f.open();
  const mounting = f.viewer.mountModel('apollo');
  await new Promise(resolve => setTimeout(resolve, 30));
  f.viewer.iframe.emit('load'); f.clients[1].handshake(stateFor('apollo')); await mounting;
  assert.equal(old.client.closed, 1); assert.equal(f.mount.children.length, 1);
  await f.viewer.dispose();
});

test('internal model navigation reconnects once and stale events never overwrite current model', async () => {
  const f = fixture(); const { frame, client } = await f.open();
  frame.emit('load');
  assert.deepEqual(f.viewer.state, { lifecycle: 'loading', model: null });
  const next = f.clients[1]; next.handshake(stateFor('apollo')); await tick();
  assert.equal(f.frames.length, 1); assert.equal(client.closed, 1); assert.equal(client.listeners.size, 0);
  assert.equal(f.received.ready.length, 2); assert.equal(f.viewer.state.model.id, 'apollo');
  client.emitStale('stateChanged', { state: stateFor('kinetic-01') });
  client.emitStale('error', { message: 'old error' });
  assert.equal(f.viewer.state.model.id, 'apollo'); assert.equal(f.received.errors.length, 0);
  await f.viewer.dispose();
});

test('pause only invokes applicable public transport commands and never resumes playback', async () => {
  const f = fixture(); const { client } = await f.open(); client.calls.length = 0;
  await f.viewer.pause();
  assert.ok(client.calls.every(call => call.method === 'getState'));
  client.state.tour = { active: true, status: 'playing' };
  client.state.operation = { available: true, status: 'playing' };
  client.state.presentation.separation = { available: true, playing: true };
  client.calls.length = 0;
  await f.viewer.pause();
  assert.deepEqual(client.calls.filter(call => call.method !== 'getState').map(call => call.method), ['pauseTour', 'pauseOperation', 'pauseExplosion']);
  assert.equal(f.viewer.state.operation.status, 'paused');
  assert.equal(f.viewer.state.presentation.separation.playing, false);
  await f.viewer.pause();
  assert.equal(client.calls.filter(call => call.method === 'pauseTour').length, 1);
  assert.ok(!client.calls.some(call => /resume|playOperation|startTour/.test(call.method)));
  await f.viewer.dispose();
});

test('leaving while a tour prepares cancels its start rather than letting it play behind a reading tab', async () => {
  const f = fixture(); const { client } = await f.open();
  client.state.tour = { active: false, status: 'preparing' };
  client.state.busy = [{ activity: 'startTour', requestId: 'pending-tour' }];
  await f.viewer.pause();
  assert.deepEqual(client.calls.find(call => call.method === 'exitTour').params, { restore: false });
  assert.ok(!client.calls.some(call => call.method === 'cancel'));
  assert.ok(!client.calls.some(call => call.method === 'pauseTour'));
  await f.viewer.dispose();
});

test('context attaches the exact revision, selected part and active chapter without capturing a live camera', async () => {
  const f = fixture(); const { client } = await f.open();
  assert.deepEqual(await f.viewer.context(), { modelId: 'kinetic-01', modelRevision: '1.0' });
  client.state.model.revision = '2.4'; client.state.navigation.selectedId = 'crank';
  client.state.tour = { active: true, status: 'playing', tourId: 'kinetic-01', chapterId: 'motion' };
  assert.deepEqual(await f.viewer.context(), { modelId: 'kinetic-01', modelRevision: '2.4',
    part: { id: 'crank', title: 'Drive crank' }, chapter: { tourId: 'kinetic-01', id: 'motion', title: 'From rotation to motion' } });
  assert.ok(!client.calls.some(call => call.method === 'captureView'));
  await f.viewer.dispose();
});

test('failed public commands keep their useful error and stale command completions are rejected', async () => {
  const delayed = gate();
  const f = fixture({ request: (client, method) => method === 'focus' ? { payload: { status: 'failed', error: { code: 'UNKNOWN_NODE', message: 'The component is not present in this model revision.' } } }
    : method === 'select' ? delayed.promise : undefined });
  const { frame } = await f.open();
  await assert.rejects(f.viewer.request('focus', { nodeId: 'missing' }), error => error.code === 'UNKNOWN_NODE' && /component is not present/.test(error.message));
  const selected = f.viewer.request('select', { nodeId: 'crank' });
  const rejected = assert.rejects(selected, error => error.code === 'SUPERSEDED');
  frame.emit('load'); f.clients[1].handshake(stateFor('apollo')); await tick();
  delayed.resolve(completed({})); await rejected;
  await f.viewer.dispose();
});

test('cached history retains its iframe and listener; ordinary navigation cleans up idempotently', async () => {
  const f = fixture(); const { client, frame } = await f.open();
  f.win.emit('pagehide', { persisted: true });
  assert.equal(client.closed, 0); assert.equal(f.viewer.iframe, frame); assert.equal(f.win.count('pagehide'), 1);
  f.win.emit('pagehide', { persisted: false });
  await f.viewer.dispose(); await f.viewer.close();
  assert.equal(client.closed, 1); assert.equal(client.listeners.size, 0); assert.equal(f.mount.children.length, 0);
  assert.equal(f.win.count('pagehide'), 0); assert.equal(frame.count('load'), 0); assert.equal(frame.count('error'), 0);
  await assert.rejects(f.viewer.mountModel('apollo'), error => error.code === 'DISPOSED');
});

test('teardown during loading rejects the pending mount and removes all iframe handlers', async () => {
  const f = fixture(); const mounting = f.viewer.mountModel('apollo');
  const rejected = assert.rejects(mounting, error => error.code === 'SUPERSEDED');
  await tick(); const frame = f.viewer.iframe;
  await f.viewer.dispose(); await rejected;
  assert.equal(frame.count('load'), 0); assert.equal(frame.count('error'), 0); assert.equal(f.mount.children.length, 0);
  frame.emit('load'); assert.equal(f.clients.length, 0);
});

test('failed model loading rejects readiness once and does not emit a ready callback', async () => {
  const f = fixture(); const mounting = f.viewer.mountModel('apollo');
  const rejected = assert.rejects(mounting, error => error.code === 'ASSET_LOAD_FAILED');
  await tick(); f.viewer.iframe.emit('load');
  const client = f.clients[0]; client.handshake({ ...stateFor('apollo'), lifecycle: 'loading' }); await tick();
  client.state.lifecycle = 'error'; client.emit('stateChanged', { state: client.state });
  client.emit('error', { code: 'ASSET_LOAD_FAILED', message: 'Failed to load assets.' });
  await rejected;
  assert.equal(f.received.errors.length, 1); assert.equal(f.received.ready.length, 0);
  assert.equal(f.viewer.state.lifecycle, 'error'); await f.viewer.dispose();
});

test('a missing iframe load event has a bounded failure and full cleanup', async () => {
  const f = fixture({ viewer: { readyTimeoutMs: 10 } });
  const mounting = f.viewer.mountModel('apollo');
  await assert.rejects(mounting, error => error.code === 'LOAD_TIMEOUT');
  assert.equal(f.received.errors.length, 1); assert.equal(f.clients.length, 0);
  await f.viewer.dispose(); assert.equal(f.mount.children.length, 0);
});

test('whenReady waits for the current iframe document and never remounts an internal model switch', async () => {
  const f = fixture(); const { frame } = await f.open();
  assert.equal((await f.viewer.whenReady()).state.model.id, 'kinetic-01');
  frame.emit('load');
  let settled = false;
  const next = f.viewer.whenReady().then(value => { settled = true; return value; });
  await tick();
  assert.equal(settled, false); assert.equal(f.frames.length, 1);
  f.clients[1].handshake(stateFor('apollo'));
  assert.equal((await next).state.model.id, 'apollo');
  assert.equal(f.viewer.iframe, frame);
  await f.viewer.dispose();
  await assert.rejects(f.viewer.whenReady(), error => error.code === 'NOT_READY');
});

test('an internal reload supersedes its readiness waiter but preserves the initial mount promise', async () => {
  const f = fixture(); const initialMount = f.viewer.mountModel('kinetic-01');
  await tick(); const frame = f.viewer.iframe; frame.emit('load');
  f.clients[0].handshake({ ...stateFor(), lifecycle: 'loading' }); await tick();
  const obsoleteWaiter = f.viewer.whenReady();
  const superseded = assert.rejects(obsoleteWaiter, error => error.code === 'SUPERSEDED');
  frame.emit('load'); f.clients[1].handshake(stateFor('apollo'));
  await superseded;
  assert.equal((await initialMount).state.model.id, 'apollo');
  assert.equal((await f.viewer.whenReady()).state.model.id, 'apollo');
  assert.equal(f.frames.length, 1); await f.viewer.dispose();
});
