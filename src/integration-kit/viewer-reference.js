/** Vendor-neutral saved views. Never convert these snapshots into Explorer state. */
export const VIEWER_REFERENCE_VERSION = '1';
export const VIEWER_SNAPSHOT_LIMITS = Object.freeze({ bytes: 65536, depth: 10, nodes: 4096, array: 256, keys: 128, string: 8192 });

export class IntegrationError extends Error {
  constructor(code, message) { super(message); this.name = 'IntegrationError'; this.code = code; }
}
const fail = message => { throw new IntegrationError('INVALID_REFERENCE', message); };

export function integrationText(value, label, limit = 256) {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim() || value.length > limit)
    fail(`${label} needs a non-empty, bounded identifier.`);
  return value;
}

/** Copy only inert JSON. Reject truncation, accessors, cycles and oversized state. */
export function copyViewerJSON(input) {
  let nodes = 0;
  const ancestors = new Set();
  function visit(value, depth) {
    if (++nodes > VIEWER_SNAPSHOT_LIMITS.nodes || depth > VIEWER_SNAPSHOT_LIMITS.depth) fail('The saved view exceeds its JSON limits.');
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'string') { if (value.length > VIEWER_SNAPSHOT_LIMITS.string) fail('A saved-view value is too long.'); return value; }
    if (typeof value === 'number') { if (!Number.isFinite(value)) fail('A saved-view number must be finite.'); return value; }
    if (!value || typeof value !== 'object' || ancestors.has(value)) fail('The saved view must be acyclic plain JSON.');
    const isArray = Array.isArray(value), prototype = Object.getPrototypeOf(value);
    if (isArray ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) fail('The saved view must contain only plain objects and arrays.');
    const keys = Reflect.ownKeys(value);
    if (keys.some(key => typeof key !== 'string' || ['__proto__', 'prototype', 'constructor'].includes(key))) fail('The saved view contains an unsupported JSON key.');
    if (isArray ? value.length > VIEWER_SNAPSHOT_LIMITS.array || keys.length !== value.length + 1 : keys.length > VIEWER_SNAPSHOT_LIMITS.keys) fail('The saved view exceeds its collection limits.');
    ancestors.add(value);
    const result = isArray ? [] : {};
    for (const key of keys) {
      if (isArray && key === 'length') continue;
      if (isArray && (!/^(0|[1-9]\d*)$/.test(key) || +key >= value.length)) fail('Saved-view arrays cannot contain additional properties.');
      if (key.length > 256) fail('A saved-view key is too long.');
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) fail('Saved views cannot contain accessors or hidden properties.');
      result[key] = visit(descriptor.value, depth + 1);
    }
    ancestors.delete(value);
    return result;
  }
  const result = visit(input, 0);
  if (new TextEncoder().encode(JSON.stringify(result)).byteLength > VIEWER_SNAPSHOT_LIMITS.bytes) fail('The saved view exceeds 64 KiB.');
  return result;
}

export function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key)))
    fail(`${label} contains unsupported fields.`);
}
const identity = (value, label) => {
  exactKeys(value, ['id', 'revision'], label);
  return { id: integrationText(value.id, `${label} identity`), revision: integrationText(value.revision, `${label} revision`) };
};

/** Old callers retain their original shape; an unknown reference never disappears. */
export function normalizeViewerReference(input, context) {
  const value = copyViewerJSON(input);
  if (value?.version !== VIEWER_REFERENCE_VERSION) throw new IntegrationError('UNSUPPORTED_REFERENCE_VERSION', 'This saved view uses an unsupported reference version. Keep the original record and use a compatible integration.');
  exactKeys(value, ['version', 'adapter', 'product', 'model', 'snapshot'], 'The saved view');
  exactKeys(value.adapter, ['id', 'version', 'coordinateFrame'], 'The viewer adapter');
  const adapter = { id: integrationText(value.adapter.id, 'Adapter identity'), version: integrationText(value.adapter.version, 'Adapter version'), coordinateFrame: integrationText(value.adapter.coordinateFrame, 'Coordinate frame') };
  const product = identity(value.product, 'Product'), model = identity(value.model, 'Model');
  if (!value.snapshot || typeof value.snapshot !== 'object' || Array.isArray(value.snapshot)) fail('The saved view needs an object snapshot.');
  if (context && (product.id !== context.productId || product.revision !== context.productRevision || model.id !== context.modelId || model.revision !== context.modelRevision))
    throw new IntegrationError('IDENTITY_MISMATCH', 'This saved view belongs to another product or model version. Keep its original reference.');
  return { version: VIEWER_REFERENCE_VERSION, adapter, product, model, snapshot: value.snapshot };
}
