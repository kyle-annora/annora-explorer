/** Product Room owns one iframe; the unchanged Explorer owns its renderer and UI. */
import { createExplorerClient } from '../explorer/embed-client.js';
import { exactOrigin } from '../explorer/embed-bridge.js';

const problem = (code, message) => Object.assign(new Error(message), { code });
const stale = () => problem('SUPERSEDED', 'The product changed before this Explorer action finished.');
const notify = (callback, value) => { try { callback?.(value); } catch { /* Host UI errors cannot break the connection. */ } };
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));

function deferred() {
  let resolve, reject, settled = false;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  // Internal navigation can reject a mount after its caller has already left the page.
  promise.catch(() => {});
  return { promise, resolve(value) { if (!settled) { settled = true; resolve(value); } }, reject(error) { if (!settled) { settled = true; reject(error); } } };
}

function unwrap(event, method) {
  const payload = event?.payload;
  if (payload?.status === 'completed') return payload.result;
  if (payload?.status === 'cancelled') throw problem('CANCELLED', `The ${method} action was interrupted. Please try again.`);
  throw problem(payload?.error?.code || 'EXPLORER_ERROR', payload?.error?.message || `The Explorer could not complete ${method}.`);
}

/** Injection points keep lifecycle tests independent of WebGL and a live browser. */
export function createRoomViewer({ mount, explorerURL, onState, onReady, onError,
  clientFactory = createExplorerClient, window: win = globalThis.window,
  document: doc = mount?.ownerDocument || globalThis.document,
  readyTimeoutMs = 45000, disposeTimeoutMs = 1500 } = {}) {
  if (!mount?.replaceChildren || !doc?.createElement) throw new TypeError('A Product Room mount element is required.');
  const parentOrigin = exactOrigin(win?.location?.origin);
  const baseURL = new URL(explorerURL, win?.location?.href);
  if (!parentOrigin || !exactOrigin(baseURL.origin)) throw new TypeError('Product Room and Explorer need exact HTTP(S) origins.');

  let current = null, generation = 0, disposed = false, retirement = Promise.resolve();
  const active = (record, connection = record?.connection) => Boolean(record) && !disposed && current === record && record.generation === generation && record.connection === connection;

  function publish(record, connection, state) {
    if (!active(record, connection) || !state?.lifecycle) return;
    record.state = clone(state);
    notify(onState, clone(state));
    if (state.lifecycle === 'error') fail(record, connection, problem('ASSET_LOAD_FAILED', 'The model could not be loaded. You can still read the product information.'));
    else if (state.lifecycle === 'ready') void hydrate(record, connection);
  }

  function fail(record, connection, error) {
    if (!active(record, connection) || connection?.failed) return;
    if (connection) connection.failed = true;
    clearTimeout(record.timer);
    record.ready.reject(error);
    record.currentReady.reject(error);
    notify(onError, error);
  }

  async function invoke(connection, method, params = {}, options) {
    if (!connection) throw problem('NOT_READY', 'The 3D Explorer is still loading. Please try again when it is ready.');
    return unwrap(await connection.client.request(method, params, options), method);
  }

  async function hydrate(record, connection) {
    if (!connection || connection.hydrating || connection.hydrated || connection.failed || !active(record, connection)) return;
    connection.hydrating = true;
    try {
      const capabilities = await invoke(connection, 'getCapabilities');
      const state = await invoke(connection, 'getState');
      if (!active(record, connection)) return;
      if (state.lifecycle !== 'ready') { publish(record, connection, state); return; }
      record.capabilities = clone(capabilities);
      connection.hydrated = true;
      clearTimeout(record.timer);
      publish(record, connection, state);
      const payload = { state: clone(state), capabilities: clone(capabilities) };
      record.ready.resolve(payload);
      record.currentReady.resolve(payload);
      notify(onReady, payload);
    } catch (error) { fail(record, connection, error); }
    finally { connection.hydrating = false; }
  }

  function closeConnection(connection) {
    if (!connection || connection.closed) return;
    connection.closed = true;
    connection.unsubscribe?.();
    connection.client?.close();
  }

  function connect(record) {
    if (!active(record)) return;
    if (record.connection) {
      record.currentReady.reject(stale());
      record.currentReady = deferred();
    }
    closeConnection(record.connection);
    record.connection = null;
    record.state = { lifecycle: 'loading', model: null };
    record.capabilities = null;
    notify(onState, clone(record.state));
    clearTimeout(record.timer);
    // A load also fires when a visitor changes the model inside the unchanged iframe.
    // The new document receives a fresh nonce/session; the prior session is never reused.
    const connection = { client: null, handshaken: false, hydrated: false, hydrating: false, failed: false, closed: false };
    record.connection = connection;
    record.timer = setTimeout(() => {
      fail(record, connection, problem('LOAD_TIMEOUT', 'The 3D Explorer took too long to load. Try loading it again.'));
      closeConnection(connection);
    }, readyTimeoutMs);
    try {
      connection.client = clientFactory({ iframe: record.frame, origin: baseURL.origin, window: win });
      connection.unsubscribe = connection.client.subscribe(event => {
        if (!active(record, connection) || connection.failed) return;
        if (['stateChanged', 'ready', 'helloAck'].includes(event.type)) publish(record, connection, event.payload?.state || event.payload);
        else if (event.type === 'error') {
          const error = event.payload?.error || event.payload;
          fail(record, connection, problem(error?.code || 'EXPLORER_ERROR', error?.message || 'The Explorer could not load this model.'));
        }
      });
      connection.client.ready.then(payload => {
        if (!active(record, connection) || connection.failed) return;
        connection.handshaken = true;
        publish(record, connection, payload?.state);
      }).catch(error => { fail(record, connection, error); closeConnection(connection); });
    } catch (error) { fail(record, connection, error); closeConnection(connection); }
  }

  async function release(record) {
    if (!record) return;
    record.ready.reject(stale());
    record.currentReady.reject(stale());
    clearTimeout(record.timer);
    record.frame.removeEventListener('load', record.onLoad);
    record.frame.removeEventListener('error', record.onError);
    const connection = record.connection;
    connection?.unsubscribe?.();
    // Do not wait for a failed handshake before retiring its iframe. Once connected,
    // give the renderer a bounded opportunity to dispose its WebGL resources first.
    let timer;
    try {
      if (connection?.handshaken && !connection.closed) await Promise.race([
        invoke(connection, 'dispose', {}, { timeoutMs: disposeTimeoutMs }).catch(() => {}),
        new Promise(resolve => { timer = setTimeout(resolve, disposeTimeoutMs); }),
      ]);
    } finally {
      clearTimeout(timer);
      closeConnection(connection);
      record.frame.remove();
    }
  }

  async function mountModel(modelId) {
    if (disposed) throw problem('DISPOSED', 'This Product Room viewer has been closed.');
    if (typeof modelId !== 'string' || !/^[A-Za-z0-9_.:-]{1,96}$/.test(modelId)) throw new TypeError('A valid model ID is required.');
    const version = ++generation, previous = current;
    current = null;
    retirement = retirement.then(() => release(previous));
    await retirement;
    if (disposed || version !== generation) throw stale();

    const url = new URL(baseURL);
    url.searchParams.set('model', modelId);
    url.searchParams.set('embed', '1');
    url.searchParams.set('parentOrigin', parentOrigin);
    const frame = doc.createElement('iframe');
    frame.title = 'Interactive 3D product explorer';
    frame.allow = 'fullscreen';
    frame.src = url.href;
    const record = { generation: version, frame, state: null, capabilities: null, connection: null, timer: null, ready: deferred(), currentReady: deferred() };
    record.onLoad = () => connect(record);
    record.onError = () => fail(record, record.connection, problem('LOAD_FAILED', 'The 3D Explorer could not be opened. Try loading it again.'));
    current = record;
    frame.addEventListener('load', record.onLoad);
    frame.addEventListener('error', record.onError);
    record.timer = setTimeout(() => fail(record, record.connection, problem('LOAD_TIMEOUT', 'The 3D Explorer took too long to open. Try loading it again.')), readyTimeoutMs);
    mount.replaceChildren(frame);
    return record.ready.promise;
  }

  function whenReady() {
    if (!current || disposed) return Promise.reject(problem('NOT_READY', 'There is no active product Explorer to wait for.'));
    // This gate belongs to the current document, unlike mountModel's first-ready
    // result. Reading-page navigation can await an internal model reload without
    // creating a second iframe or reverting the model the visitor just selected.
    return current.currentReady.promise;
  }

  async function request(method, params = {}) {
    const record = current, connection = record?.connection;
    if (!active(record, connection) || !connection || connection.failed) throw problem('NOT_READY', 'The 3D Explorer is not ready. Product information is still available.');
    const result = await invoke(connection, method, params);
    if (!active(record, connection)) throw stale();
    if (method === 'getState') publish(record, connection, result);
    return result;
  }

  async function pause() {
    const record = current, connection = record?.connection;
    if (!connection?.handshaken || connection.failed || !active(record, connection)) return null;
    const call = async (method, params) => {
      if (!active(record, connection)) throw stale();
      const result = await invoke(connection, method, params);
      if (!active(record, connection)) throw stale();
      return result;
    };
    let state = await call('getState');
    if (state.lifecycle !== 'ready') return state;
    // A tour can be preparing assets before it becomes active. exitTour is also
    // valid in that state and works for both host and internal-UI requests. The
    // bridge intentionally cannot cancel request IDs owned by the internal UI.
    if (state.tour?.status === 'preparing' && !state.tour.active) {
      await call('exitTour', { restore: false });
    }
    if (state.tour?.active && state.tour.status !== 'paused') await call('pauseTour');
    state = await call('getState');
    if (state.operation?.available && state.operation.status === 'playing') await call('pauseOperation');
    if (state.presentation?.separation?.available && state.presentation.separation.playing) await call('pauseExplosion');
    state = await call('getState');
    publish(record, connection, state);
    return state;
  }

  async function context() {
    const record = current, connection = record?.connection;
    const state = await request('getState');
    if (state.lifecycle !== 'ready' || !state.model) throw problem('NOT_READY', 'Wait for the product model before attaching a 3D reference.');
    const value = { modelId: state.model.id, modelRevision: state.model.revision };
    if (state.navigation?.selectedId) {
      const node = await invoke(connection, 'getNode', { nodeId: state.navigation.selectedId });
      if (node.parentId) value.part = { id: node.id, title: node.title };
    }
    if (state.tour?.active && state.tour.tourId && state.tour.chapterId) {
      const tour = await invoke(connection, 'getTour', { tourId: state.tour.tourId });
      const chapter = tour.chapters?.find(item => item.id === state.tour.chapterId);
      if (chapter) value.chapter = { tourId: tour.id, id: chapter.id, title: chapter.label || chapter.title || chapter.id };
    }
    if (!active(record, connection)) throw stale();
    return value;
  }

  function dispose() {
    if (disposed) return retirement;
    disposed = true;
    generation++;
    win.removeEventListener('pagehide', onPageHide);
    const previous = current;
    current = null;
    retirement = retirement.then(() => release(previous));
    return retirement;
  }

  function onPageHide(event) {
    // History cache retains this document and its iframe. The child's own page
    // lifecycle suspends its clocks; do not destroy the retained renderer/session.
    if (!event.persisted) void dispose();
  }
  win.addEventListener('pagehide', onPageHide);

  return { mountModel, whenReady, request, pause, context, dispose, close: dispose,
    get state() { return clone(current?.state || null); },
    get capabilities() { return clone(current?.capabilities || null); },
    get iframe() { return current?.frame || null; },
  };
}
