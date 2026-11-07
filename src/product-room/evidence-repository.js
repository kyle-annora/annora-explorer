import { normalizeEvidenceObservation, safeEvidenceSource } from './evidence-domain.js';

export const EVIDENCE_OBSERVATION_LIMIT = 200;
export const EVIDENCE_DEDUPLICATION_LIMIT = 1024;
export const EVIDENCE_STORE_BYTE_LIMIT = 256000;
const VERSION = 1;
const MODES = ['demo', 'presenter', 'ordinary', 'unknown'];
const token = value => typeof value === 'string' && value.length > 0 && value.length <= 320 && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value);
const date = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT/.test(value) && Number.isFinite(Date.parse(value));
const bytes = value => new TextEncoder().encode(value).byteLength;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const copy = value => JSON.parse(JSON.stringify(value));
const exactKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const hash = async value => Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), byte => byte.toString(16).padStart(2, '0')).join('');
const fingerprint = event => JSON.stringify({ ...event, occurredAt: undefined });

/** Optional local observations. The project store is never read or written here.
 * Every method resolves a status, including storage/schema/crypto failures. No
 * network or business mutation is coupled to this collection boundary.
 */
export function createEvidenceRepository(options = {}) {
  const mode = MODES.includes(options.mode) ? options.mode : 'unknown';
  const scope = token(options.key) ? options.key : null;
  const storageKey = scope ? `annora.evidence.observations.v1:${scope}` : null;
  const sessionKey = scope ? `annora.evidence.session.v1:${scope}` : null;
  const now = options.now || (() => new Date().toISOString());
  const makeId = options.makeId || (prefix => `${prefix}-${globalThis.crypto.randomUUID()}`);
  let pending = Promise.resolve();
  const unavailable = (reason, projectId = null) => ({schemaVersion: VERSION, projectId, mode, status: 'unavailable', coverage: 'unknown',
    events: [], collectionStartedAt: null, omittedCount: null, retainedCount: null, sessionDenominator: null,
    limit: EVIDENCE_OBSERVATION_LIMIT, deduplicationWindow: EVIDENCE_DEDUPLICATION_LIMIT, reason, recorded: false, duplicate: false});
  const storage = () => options.storage || globalThis.localStorage;
  const sessionStorage = () => options.sessionStorage || globalThis.sessionStorage;
  async function parsed(raw) {
    if (raw === null) return null;
    if (typeof raw !== 'string' || bytes(raw) > EVIDENCE_STORE_BYTE_LIMIT) throw Error('invalid-history');
    const value = JSON.parse(raw);
    if (!exactKeys(value, ['schemaVersion', 'mode', 'startedAt', 'omittedCount', 'events', 'seen']) || value.schemaVersion !== VERSION || value.mode !== mode || !date(value.startedAt)
      || !Number.isSafeInteger(value.omittedCount) || value.omittedCount < 0 || !Array.isArray(value.events) || value.events.length > EVIDENCE_OBSERVATION_LIMIT
      || !Array.isArray(value.seen) || value.seen.length > EVIDENCE_DEDUPLICATION_LIMIT) throw Error('invalid-history');
    const identities = new Set();
    for (const item of value.seen) {
      if (!exactKeys(item, ['identity', 'payload']) || !/^[a-f0-9]{64}$/.test(item.identity) || !/^[a-f0-9]{64}$/.test(item.payload) || identities.has(item.identity)) throw Error('invalid-history');
      identities.add(item.identity);
    }
    const eventIds = new Set();
    for (const event of value.events) {
      const normalized = normalizeEvidenceObservation(event);
      if (!normalized || !same(normalized, event) || event.mode !== mode || eventIds.has(event.id)) throw Error('invalid-history');
      eventIds.add(event.id);
      const identity = await hash(event.id), match = value.seen.find(item => item.identity === identity);
      if (!match || match.payload !== await hash(fingerprint(event))) throw Error('invalid-history');
    }
    return value;
  }
  const result = (value, projectId) => ({schemaVersion: VERSION, projectId, mode, status: value ? 'available' : 'not-started', coverage: value ? 'partial' : 'unknown',
    events: value ? copy(value.events.filter(event => event.projectId === projectId).slice().reverse()) : [],
    collectionStartedAt: value?.startedAt || null, omittedCount: value?.omittedCount ?? null, retainedCount: value?.events.length ?? null,
    sessionDenominator: null, limit: EVIDENCE_OBSERVATION_LIMIT, deduplicationWindow: EVIDENCE_DEDUPLICATION_LIMIT,
    reason: value ? 'local-observations-only' : 'collection-not-started', recorded: false, duplicate: false});
  async function read(projectId) {
    if (!scope || !token(projectId)) return unavailable('invalid-scope', token(projectId) ? projectId : null);
    try { return result(await parsed(storage().getItem(storageKey)), projectId); }
    catch { return unavailable('history-unavailable', projectId); }
  }
  function session() {
    const target = sessionStorage(), existing = target.getItem(sessionKey);
    if (existing !== null) { if (!token(existing)) throw Error('invalid-session'); return existing; }
    const id = makeId('EVIDENCE-SESSION');
    if (!token(id)) throw Error('invalid-session');
    target.setItem(sessionKey, id);
    if (target.getItem(sessionKey) !== id) throw Error('session-unavailable');
    return id;
  }
  async function record(input) {
    const projectId = token(input?.projectId) ? input.projectId : null;
    if (!scope || !projectId) return unavailable('invalid-scope', projectId);
    try {
      const target = storage(), raw = target.getItem(storageKey), previous = await parsed(raw);
      const time = now(); if (!date(time)) return unavailable('invalid-time', projectId);
      const event = normalizeEvidenceObservation({...input, mode, sessionId: session(), occurredAt: time,
        source: input.context ? safeEvidenceSource(input.context) : input.source});
      if (!event) return unavailable('invalid-observation', projectId);
      const identity = await hash(event.id), payload = await hash(fingerprint(event));
      const matched = previous?.seen.find(item => item.identity === identity);
      if (matched) return matched.payload === payload ? {...result(previous, projectId), duplicate: true} : unavailable('operation-conflict', projectId);
      const value = previous || {schemaVersion: VERSION, mode, startedAt: time, omittedCount: 0, events: [], seen: []};
      value.events.push(event); value.seen.push({identity, payload});
      while (value.events.length > EVIDENCE_OBSERVATION_LIMIT) { value.events.shift(); value.omittedCount++; }
      while (value.seen.length > EVIDENCE_DEDUPLICATION_LIMIT) value.seen.shift();
      let encoded = JSON.stringify(value);
      while (bytes(encoded) > EVIDENCE_STORE_BYTE_LIMIT && value.events.length > 1) { value.events.shift(); value.omittedCount++; encoded = JSON.stringify(value); }
      if (bytes(encoded) > EVIDENCE_STORE_BYTE_LIMIT) return unavailable('capacity-unavailable', projectId);
      if (target.getItem(storageKey) !== raw) return unavailable('concurrent-observation', projectId);
      target.setItem(storageKey, encoded);
      if (target.getItem(storageKey) !== encoded) return unavailable('concurrent-observation', projectId);
      return {...result(value, projectId), recorded: true};
    } catch { return unavailable('collection-unavailable', projectId); }
  }
  return Object.freeze({schemaVersion: VERSION, mode, storageKey,
    readProject: projectId => Promise.resolve().then(() => read(projectId)).catch(() => unavailable('history-unavailable')),
    recordObservation(input) {
      // Serialize this host's observations; separate tabs also compare raw storage
      // before writing. A lost optional observation never retries a business action.
      const operation = pending.then(() => record(input)).catch(() => unavailable('collection-unavailable'));
      pending = operation.then(() => undefined); return operation;
    }
  });
}
