import { createDemoProjectRepository } from './project-repository.js';

export const DRAWING_PROJECT_STORAGE_KEY = 'annora.drawing-preview.projects.v1';

/** Reuse the reviewed buyer workflow in a separate persistent demo namespace.
 * No customer/Studio records are read, migrated, reset or written by this host. */
export function createDrawingProjectRepository(options = {}) {
  return Object.freeze({
    ...createDemoProjectRepository({ ...options, key: DRAWING_PROJECT_STORAGE_KEY }),
    mode: 'drawing-preview',
    capabilities: Object.freeze({ inquiryOnly: true }),
  });
}
