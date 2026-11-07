import { IntegrationError, integrationText, exactKeys, copyViewerJSON } from './viewer-reference.js';
export { IntegrationError, VIEWER_REFERENCE_VERSION, VIEWER_SNAPSHOT_LIMITS, normalizeViewerReference } from './viewer-reference.js';

export const VIEWER_ADAPTER_CONTRACT_VERSION = '1';
export const VIEWER_CAPABILITIES = Object.freeze(['inquiry', 'selectedPart', 'capturedView', 'drawingDetail', 'story']);

/** Methods stay in the host; only the validated descriptor crosses the boundary. */
export function describeViewerAdapter(adapter) {
  if (!adapter || adapter.version !== VIEWER_ADAPTER_CONTRACT_VERSION)
    throw new IntegrationError('UNSUPPORTED_ADAPTER_VERSION', 'Use a viewer adapter implementing integration contract version 1.');
  const capabilities = copyViewerJSON(adapter.capabilities);
  exactKeys(capabilities, VIEWER_CAPABILITIES, 'Viewer capabilities');
  if (VIEWER_CAPABILITIES.some(key => typeof capabilities[key] !== 'boolean') || capabilities.inquiry !== true)
    throw new IntegrationError('INVALID_ADAPTER', 'Declare every viewer capability as a boolean, with inquiry enabled.');
  if (VIEWER_CAPABILITIES.slice(1).some(key => capabilities[key]) && typeof adapter.capture !== 'function')
    throw new IntegrationError('INVALID_ADAPTER', 'Enabled viewer capabilities need a capture method.');
  if (capabilities.capturedView && typeof adapter.restore !== 'function')
    throw new IntegrationError('INVALID_ADAPTER', 'Captured views need a restore method.');
  return Object.freeze({ version: VIEWER_ADAPTER_CONTRACT_VERSION,
    id: integrationText(adapter.id, 'Adapter identity'), adapterVersion: integrationText(adapter.adapterVersion, 'Adapter version'),
    coordinateFrame: integrationText(adapter.coordinateFrame, 'Coordinate frame'), capabilities: Object.freeze(capabilities) });
}

export function requireViewerCapability(descriptor, name) {
  if (!VIEWER_CAPABILITIES.includes(name) || descriptor.capabilities[name] !== true)
    throw new IntegrationError('UNSUPPORTED_CAPABILITY', `This viewer does not support ${name}. The saved reference is unchanged.`);
}
