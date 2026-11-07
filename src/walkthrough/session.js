import { createDemoProjectRepository } from '../product-room/project-repository.js';

export const WALKTHROUGH_SESSION_KEY = 'annora.walkthrough.session.v1';
export const INDEPENDENT_WALKTHROUGH_SESSION_KEY = 'annora.walkthrough.independent.session.v1';
export const WALKTHROUGH_PRODUCT_ID = 'kinetic-01';
const PROJECT_PREFIX = 'annora.walkthrough.projects.v1.';
const INDEPENDENT_PROJECT_PREFIX = 'annora.walkthrough.independent.projects.v1.';
const SESSION_ID = /^WTI?-[A-Za-z0-9-]{8,64}$/;
const problem = (code, message) => Object.assign(new Error(message), { code });
const validId = id => typeof id === 'string' && SESSION_ID.test(id);

function parameters(search) {
  if (search instanceof URLSearchParams) return search;
  if (search instanceof URL) return search.searchParams;
  return new URLSearchParams(search || '');
}

export function hasWalkthroughRequest(search = globalThis.location?.search || '') {
  return parameters(search).has('walkthrough');
}

/** A malformed explicit session must be handled as an error by the host, never
 * as permission to open or mutate its ordinary customer-project repository. */
export function readWalkthroughSession(search = globalThis.location?.search || '') {
  const values = parameters(search).getAll('walkthrough');
  return values.length === 1 && validId(values[0]) ? values[0] : null;
}

function requireId(id) {
  if (!validId(id)) throw problem('WALKTHROUGH_SESSION_INVALID', 'This walkthrough link is incomplete. Open the walkthrough start page to resume or start a new demonstration.');
  return id;
}

/** The namespace travels in the validated session ID, including seller links. */
export function walkthroughViewer(id) {
  return requireId(id).startsWith('WTI-') ? 'independent' : 'explorer';
}

function sessionMode(options) {
  const viewer = options.viewer ?? 'explorer';
  if (viewer !== 'explorer' && viewer !== 'independent')
    throw problem('WALKTHROUGH_SESSION_INVALID', 'This demonstration viewer is not supported. Open a walkthrough start page.');
  return {viewer, key:viewer === 'independent' ? INDEPENDENT_WALKTHROUGH_SESSION_KEY : WALKTHROUGH_SESSION_KEY};
}

export function walkthroughStorageKey(id) {
  return (walkthroughViewer(id) === 'independent' ? INDEPENDENT_PROJECT_PREFIX : PROJECT_PREFIX) + id;
}

export function withWalkthroughSession(input, id) {
  const url = new URL(input, globalThis.location?.href || 'http://localhost/');
  url.searchParams.set('walkthrough', requireId(id));
  return url;
}

function storageOf(options) {
  try {
    const storage = options.storage || globalThis.localStorage;
    if (!storage?.getItem || !storage?.setItem) throw new Error();
    return storage;
  } catch {
    throw problem('WALKTHROUGH_STORAGE_UNAVAILABLE', 'Browser storage is unavailable. Enable storage to keep this demonstration separate from your existing projects.');
  }
}

function readMetadata(storage, mode) {
  let raw;
  try { raw = storage.getItem(mode.key); }
  catch { throw problem('WALKTHROUGH_STORAGE_UNAVAILABLE', 'The saved demonstration could not be read. Existing projects have not been changed.'); }
  if (raw === null) return null;
  try {
    const value = JSON.parse(raw);
    if (value.schemaVersion !== 1 || !validId(value.id) || walkthroughViewer(value.id) !== mode.viewer
      || (mode.viewer === 'independent' ? value.viewer !== 'independent' : value.viewer !== undefined)
      || value.productId !== WALKTHROUGH_PRODUCT_ID
      || typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt))) throw new Error();
    return { schemaVersion:1, id:value.id, createdAt:value.createdAt, productId:WALKTHROUGH_PRODUCT_ID,
      ...(mode.viewer === 'independent' ? {viewer:'independent'} : {}) };
  } catch {
    throw problem('WALKTHROUGH_SESSION_CORRUPT', 'The saved demonstration reference could not be read. Start a new demonstration to continue; previous project records will be kept.');
  }
}

/** Read-only. Merely opening the start page never seeds or submits an inquiry. */
export function getWalkthroughSession(options = {}) {
  return readMetadata(storageOf(options), sessionMode(options));
}

/** Create only a session pointer. Project data is written later by the existing
 * explicitly reviewed workflow, under this session's independent storage key. */
export function createWalkthroughSession(options = {}) {
  const mode = sessionMode(options);
  const storage = storageOf(options);
  const id = requireId(options.makeSessionId ? options.makeSessionId() : `${mode.viewer === 'independent' ? 'WTI' : 'WT'}-${globalThis.crypto.randomUUID()}`);
  if (walkthroughViewer(id) !== mode.viewer) throw problem('WALKTHROUGH_SESSION_INVALID', 'The demonstration identifier does not match its viewer. Start a new demonstration.');
  const createdAt = options.now ? options.now() : new Date().toISOString();
  if (typeof createdAt !== 'string' || !Number.isFinite(Date.parse(createdAt))) throw problem('WALKTHROUGH_SESSION_INVALID', 'The demonstration date could not be created. Try starting again.');
  let previous;
  try {
    previous = storage.getItem(mode.key);
    let priorId;
    try { priorId = JSON.parse(previous)?.id; } catch { /* Explicit creation can recover a corrupt pointer, preserving data. */ }
    if (priorId === id || storage.getItem(walkthroughStorageKey(id)) !== null) throw problem('WALKTHROUGH_SESSION_EXISTS', 'This demonstration identifier is already in use. Start a new demonstration with a new identifier.');
    const session = { schemaVersion:1, id, createdAt, productId:WALKTHROUGH_PRODUCT_ID,
      ...(mode.viewer === 'independent' ? {viewer:'independent'} : {}) };
    const encoded = JSON.stringify(session);
    if (storage.getItem(mode.key) !== previous) throw problem('WALKTHROUGH_SESSION_CONFLICT', 'Another tab started a demonstration. Reopen the walkthrough start page to resume it.');
    storage.setItem(mode.key, encoded);
    if (storage.getItem(mode.key) !== encoded) throw problem('WALKTHROUGH_SESSION_CONFLICT', 'Another tab changed the demonstration reference. Reopen the walkthrough start page to check it.');
    return session;
  } catch (error) {
    if (error.code?.startsWith('WALKTHROUGH_')) throw error;
    throw problem('WALKTHROUGH_STORAGE_UNAVAILABLE', 'This demonstration could not be saved. Existing project records have not been changed.');
  }
}

export function resumeWalkthroughSession(options = {}) {
  return getWalkthroughSession(options) || createWalkthroughSession(options);
}

/** Restart is intentionally explicit and creates a namespace; no project store
 * is deleted or overwritten, including the previous demonstration's records. */
export function restartWalkthroughSession(options = {}) {
  return createWalkthroughSession(options);
}

const mutationMethods = new Set([
  'saveDraft', 'submitInquiry', 'saveQuoteDraft', 'issueQuote', 'sendReply',
  'sendCustomerReply', 'acknowledgeNextStep', 'createSampleInquiry',
  'createSampleQuote', 'requestRevision', 'simulateReply', 'confirmNextStep',
]);

function requireProduct(context, independent = false) {
  if (context && (context.productId !== WALKTHROUGH_PRODUCT_ID || context.modelId !== WALKTHROUGH_PRODUCT_ID))
    throw problem('WALKTHROUGH_PRODUCT_INVALID', 'This demonstration follows the crank-slider project. Open another product outside the walkthrough.');
  if (context && independent && !context.viewerReference)
    throw problem('WALKTHROUGH_REFERENCE_REQUIRED', 'Return to the independent viewer and select a part before continuing this inquiry. Its saved model reference must stay with the demonstration.');
}

/** Same async host contract and review gates, with a non-overridable namespace.
 * No renderer, business transition or quotation generator is added here. */
export function createWalkthroughRepository(id, options = {}) {
  const key = walkthroughStorageKey(id);
  const independent = walkthroughViewer(id) === 'independent';
  const base = createDemoProjectRepository({ ...options, key });
  const repository = { ...base, mode:'walkthrough', storageKey:key, sessionId:id };
  for (const [method, invoke] of Object.entries(base)) {
    if (typeof invoke !== 'function') continue;
    repository[method] = async (...args) => {
      if (method === 'getDraft' || method === 'createSampleInquiry') requireProduct(args[0], independent);
      const draft = method === 'saveDraft' ? args[0] : method === 'submitInquiry' ? args[0]?.draft : null;
      if (draft) {
        requireProduct(draft.context, independent);
        if (independent && Array.isArray(draft.requestItems))
          for (const item of draft.requestItems) requireProduct(item?.context, true);
      }
      const result = await invoke(...args);
      if (mutationMethods.has(method)) {
        try {
          const target = globalThis.window;
          if (target?.dispatchEvent && typeof globalThis.CustomEvent === 'function')
            target.dispatchEvent(new CustomEvent('annora:walkthrough-change', { detail:{sessionId:id, method} }));
        } catch { /* Presentation listeners cannot turn a successful save into a failed one. */ }
      }
      return result;
    };
  }
  return Object.freeze(repository);
}
