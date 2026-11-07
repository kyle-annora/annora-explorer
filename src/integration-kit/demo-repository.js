import { createDemoProjectRepository } from '../product-room/project-repository.js';

/** Explicit opt-in sample storage. A production host implements the repository API. */
export function createBrowserDemoRepository({ namespace, storage, ...options } = {}) {
  if (typeof namespace !== 'string' || !namespace.trim() || namespace.startsWith('annora.product-room.') || namespace.startsWith('annora.studio.')) {
    throw new TypeError('Provide a separate integration namespace; existing product workspaces are reserved.');
  }
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') throw new TypeError('Provide host-owned browser storage.');
  return createDemoProjectRepository({ ...options, key: namespace, storage });
}
