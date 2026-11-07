import { normalizeProjectContext } from '../product-room/project-domain.js';
import { describeViewerAdapter, requireViewerCapability, VIEWER_CAPABILITIES } from './contract.js';
import { IntegrationError, integrationText, copyViewerJSON, exactKeys, normalizeViewerReference } from './viewer-reference.js';

const copy = value => JSON.parse(JSON.stringify(value));
const fields = ['part', 'snapshot', 'drawing', 'document', 'chapter'];
const optionalContext = ['part', 'chapter', 'drawing', 'document', 'inspection', 'viewerReference'];
const sameIdentity = (a, b) => ['productId', 'productRevision', 'modelId', 'modelRevision', 'roomReleaseId', 'inquiryProfileVersion'].every(key => a[key] === b[key]);

/** A local JSON adapter, with no iframe, renderer, repository or network ownership. */
export function createIntegrationController({ adapter, context, timeoutMs = 8000 } = {}) {
  const descriptor = describeViewerAdapter(adapter);
  const product = normalizeProjectContext(context);
  integrationText(product.productRevision, 'Product revision');
  const base = copy(product);
  for (const key of optionalContext) delete base[key];
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) throw new TypeError('Use a viewer timeout between 1 and 60,000 milliseconds.');
  let active = null, disposed = false, sequence = 0;
  const assertActive = () => { if (disposed) throw new IntegrationError('DISPOSED', 'This viewer integration has been closed.'); };
  function cancel(code = 'CANCELLED', message = 'The viewer operation was cancelled. Your saved reference is unchanged.') {
    if (!active) return;
    const operation = active;
    active = null;
    operation.controller.abort(new IntegrationError(code, message));
  }
  async function run(kind, work, { signal } = {}) {
    assertActive();
    if (signal?.aborted) throw new IntegrationError('CANCELLED', 'The viewer operation was cancelled.');
    if (signal && (typeof signal.addEventListener !== 'function' || typeof signal.removeEventListener !== 'function')) throw new TypeError('Pass an AbortSignal.');
    cancel('STALE_OPERATION', 'A newer viewer operation replaced this one. Its result was not attached.');
    const controller = new AbortController(), operation = { controller, sequence: ++sequence, kind };
    active = operation;
    let timeout, onAbort;
    const externalAbort = () => controller.abort(new IntegrationError('CANCELLED', 'The viewer operation was cancelled.'));
    signal?.addEventListener('abort', externalAbort, { once: true });
    const aborted = new Promise((_, reject) => {
      onAbort = () => reject(controller.signal.reason || new IntegrationError('CANCELLED', 'The viewer operation was cancelled.'));
      controller.signal.addEventListener('abort', onAbort, { once: true });
    });
    timeout = setTimeout(() => controller.abort(new IntegrationError('VIEWER_TIMEOUT', 'The viewer did not respond in time. Your saved reference is unchanged. Try again.')), timeoutMs);
    try {
      const result = await Promise.race([Promise.resolve().then(() => {
        if (controller.signal.aborted) throw controller.signal.reason;
        return work(controller.signal);
      }), aborted]);
      if (disposed || active !== operation || controller.signal.aborted) throw controller.signal.reason || new IntegrationError('STALE_OPERATION', 'This viewer result is no longer current.');
      return result;
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', externalAbort);
      controller.signal.removeEventListener('abort', onAbort);
      if (active === operation) active = null;
    }
  }
  return Object.freeze({
    capabilities: () => copy(descriptor.capabilities),
    descriptor: () => copy(descriptor),
    captureContext(options) {
      return run('capture', async signal => {
        if (!VIEWER_CAPABILITIES.slice(1).some(name => descriptor.capabilities[name])) return copy(base);
        const captured = copyViewerJSON(await adapter.capture({ signal }));
        exactKeys(captured, fields, 'The captured view');
        for (const [field, capability] of [['part', 'selectedPart'], ['snapshot', 'capturedView'], ['drawing', 'drawingDetail'], ['document', 'drawingDetail'], ['chapter', 'story']])
          if (Object.hasOwn(captured, field)) requireViewerCapability(descriptor, capability);
        if (descriptor.capabilities.capturedView && !Object.hasOwn(captured, 'snapshot')) throw new IntegrationError('INVALID_REFERENCE', 'The viewer did not capture its promised saved view.');
        const result = { ...copy(base) };
        for (const field of ['part', 'drawing', 'document', 'chapter']) if (Object.hasOwn(captured, field)) result[field] = captured[field];
        if (Object.hasOwn(captured, 'snapshot')) result.viewerReference = normalizeViewerReference({ version: '1',
          adapter: { id: descriptor.id, version: descriptor.adapterVersion, coordinateFrame: descriptor.coordinateFrame },
          product: { id: base.productId, revision: base.productRevision }, model: { id: base.modelId, revision: base.modelRevision }, snapshot: captured.snapshot }, result);
        return normalizeProjectContext(result);
      }, options);
    },
    restoreContext(input, options) {
      return run('restore', async signal => {
        requireViewerCapability(descriptor, 'capturedView');
        const saved = normalizeProjectContext(input);
        if (!sameIdentity(saved, base)) throw new IntegrationError('IDENTITY_MISMATCH', 'This saved view belongs to another product or version. Open its original product to restore it.');
        const reference = normalizeViewerReference(saved.viewerReference, saved);
        if (reference.adapter.id !== descriptor.id || reference.adapter.version !== descriptor.adapterVersion || reference.adapter.coordinateFrame !== descriptor.coordinateFrame)
          throw new IntegrationError('INCOMPATIBLE_ADAPTER', 'This saved view needs its original compatible viewer adapter and coordinate frame. It has not been changed.');
        for (const [field, capability] of [['part', 'selectedPart'], ['drawing', 'drawingDetail'], ['chapter', 'story']])
          if (saved[field]) requireViewerCapability(descriptor, capability);
        await adapter.restore(copy(reference.snapshot), { signal });
        return copy(saved);
      }, options);
    },
    cancel() { assertActive(); cancel(); },
    dispose() { if (disposed) return; disposed = true; cancel('DISPOSED', 'This viewer integration was closed.'); },
  });
}
