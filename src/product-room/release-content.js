import { createDemoProjectRepository } from './project-repository.js';

const copy = value => JSON.parse(JSON.stringify(value));
const error = message => Object.assign(new Error(message), { code: 'RELEASE_NOT_FOUND' });

/** An explicit preview/release link may never silently resolve to current content. */
export async function loadRoomRelease(repository, parameters) {
  const previewId = parameters.get('studioPreview'), releaseId = parameters.get('release');
  if (previewId && releaseId) throw error('This link contains two different product versions. Open a fresh preview from Studio.');
  const release = previewId ? await repository.getPreview(previewId)
    : releaseId ? await repository.getRelease(releaseId) : await repository.getPublished('kinetic-01');
  if (!release || release.productId !== 'kinetic-01' || !release.content || !release.inquiryProfile)
    throw error('This product version is not available in this browser. Return to Studio to open or create a preview.');
  if (previewId && release.id !== previewId || releaseId && release.id !== releaseId)
    throw error('The requested product version could not be opened. Return to Studio and try again.');
  return { release: copy(release), preview: Boolean(previewId), pinned: Boolean(previewId || releaseId) };
}

export function contextForRelease(release, extras = {}) {
  const snapshot = copy(release);
  delete snapshot.reviewToken;
  return {
    productId: release.productId, productTitle: release.content.title,
    modelId: release.content.modelId, modelRevision: release.modelRevision,
    roomReleaseId: release.id, inquiryProfileVersion: release.inquiryProfile.version,
    inquiryProfile: copy(release.inquiryProfile), roomSnapshot: snapshot,
    ...copy(extras),
  };
}

/** Preview interactions are real, but their customer projects never use browser
 * project storage. Each opened preview gets its own disposable in-memory store. */
export function createPreviewProjectRepository() {
  const records = new Map();
  return Object.freeze({...createDemoProjectRepository({
    key: 'annora.product-room.preview-only', locks: null,
    storage: { getItem: key => records.get(key) ?? null, setItem: (key, value) => records.set(key, value) },
  }), mode:'preview'});
}
