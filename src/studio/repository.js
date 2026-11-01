import {
  StudioError, normalizeStudioDraft, validateStudioDraft, validateRelease, validateReleasePackage,
  createReleaseReview, assertReleaseReview, studioChanges,
} from './domain.js';
import { STUDIO_PRODUCT_ID, STUDIO_ASSETS, BUNDLED_RELEASE, ORIGINAL_BUNDLED_RELEASE } from './seed.js';
import { copyStudioValue, sameStudioValue } from './value.js';

export const STUDIO_STORAGE_KEY = 'annora.studio.products.v1';
export const STUDIO_SCHEMA_VERSION = 1;
const empty = () => ({ schemaVersion: STUDIO_SCHEMA_VERSION, revision: 0, drafts: [], releases: [], previews: [], publishedId: null });
const nonempty = value => typeof value === 'string' && value.length > 0;
const date = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const unique = values => new Set(values.map(item => item.id)).size === values.length;
const product = id => { if (id !== STUDIO_PRODUCT_ID) throw new StudioError('UNSUPPORTED_PRODUCT', 'This Studio demonstration edits the crank-slider product.'); };
const records = store => {
  const all = [ORIGINAL_BUNDLED_RELEASE, BUNDLED_RELEASE, ...store.releases];
  return [...new Map(all.map(record => [record.id, record])).values()];
};
const published = store => store.publishedId ? records(store).find(release => release.id === store.publishedId) : BUNDLED_RELEASE;
const currentDraft = (store, productId) => store.drafts.find(draft => draft.productId === productId);
const errors = issues => issues.filter(issue => issue.severity === 'error');

/** Unknown or malformed stores are rejected without overwriting the user's local work. */
export function parseStudioStore(raw) {
  if (raw === null || raw === undefined) return empty();
  try {
    const store = JSON.parse(raw);
    if (store.schemaVersion !== STUDIO_SCHEMA_VERSION || !Number.isSafeInteger(store.revision) || store.revision < 0
        || !['drafts', 'releases', 'previews'].every(key => Array.isArray(store[key]) && unique(store[key]))
        || new Set(store.drafts.map(draft => draft.productId)).size !== store.drafts.length) throw new Error();
    for (const draft of store.drafts) {
      if (draft.revision < 1 || !date(draft.updatedAt) || !sameStudioValue(draft, normalizeStudioDraft(draft))) throw new Error();
    }
    for (const release of [...store.releases, ...store.previews]) {
      // Archived revisions can outlive the configured geometry. Never rewrite them
      // to fit a newly deployed model; the host must explain unavailable references.
      if (!nonempty(release.id) || !Number.isSafeInteger(release.version) || release.version < 0 || !date(release.createdAt)
          || release.productId !== STUDIO_PRODUCT_ID || !nonempty(release.modelRevision)
          || !release.content || !release.inquiryProfile || !release.presentation) throw new Error();
      const historical = release.modelRevision !== BUNDLED_RELEASE.modelRevision;
      const invalid = errors(validateRelease(release)).filter(issue => !historical || !(
        issue.path === 'modelRevision' || issue.path.endsWith('.nodeId') ||
        /^content\.questions\.\d+\.target$/.test(issue.path) ||
        /^content\.documents\.\d+\.(assetId|assetRevision)$/.test(issue.path)
      ));
      if (invalid.length) throw new Error();
    }
    if (store.releases.some(release => release.source !== 'demo' && release.source !== 'bundled')) throw new Error();
    if (store.previews.some(preview => preview.source !== 'preview' || !nonempty(preview.draftId) || !Number.isSafeInteger(preview.draftRevision))) throw new Error();
    if (store.publishedId !== null && !nonempty(store.publishedId) || !published(store)) throw new Error();
    return store;
  } catch { throw new StudioError('STORAGE_CORRUPT', 'Saved Studio content could not be read. It has not been changed. Recover the stored data or use a separate browser profile.'); }
}

/** Local demonstration adapter. A host may inject an authenticated service with this contract. */
export function createStudioRepository(options = {}) {
  const key = options.key || STUDIO_STORAGE_KEY;
  const now = options.now || (() => new Date().toISOString());
  const makeId = options.makeId || (prefix => `${prefix}-${globalThis.crypto.randomUUID()}`);
  const locks = Object.hasOwn(options, 'locks') ? options.locks : globalThis.navigator?.locks;
  let storage;
  const storageOf = () => {
    try {
      storage ||= options.storage || globalThis.localStorage;
      if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') throw new Error();
      return storage;
    } catch { throw new StudioError('STORAGE_UNAVAILABLE', 'Browser storage is unavailable. Keep this page open and allow storage before saving.'); }
  };
  const read = () => {
    const bundledErrors = errors(validateRelease(BUNDLED_RELEASE));
    if (bundledErrors.length) throw new StudioError('INCOMPATIBLE_RELEASE', 'The prepared product release needs review before Studio can open.', bundledErrors);
    try { const raw = storageOf().getItem(key); return { raw, store: parseStudioStore(raw) }; }
    catch (error) { if (error instanceof StudioError) throw error; throw new StudioError('STORAGE_UNAVAILABLE', 'Saved Studio content could not be read. Nothing has been changed.'); }
  };
  const write = (store, before) => {
    try {
      const target = storageOf(), encoded = JSON.stringify(store);
      if (target.getItem(key) !== before) throw new StudioError('CONFLICT', 'Another tab changed this product. Reopen its saved draft before continuing.');
      target.setItem(key, encoded);
      if (target.getItem(key) !== encoded) throw new StudioError('CONFLICT', 'The saved product changed in another tab. Reload its latest state.');
    } catch (error) {
      if (error instanceof StudioError) throw error;
      throw new StudioError('STORAGE_UNAVAILABLE', 'This change could not be saved. Your edits remain on screen; allow storage or free space and try again.');
    }
  };
  const change = operation => {
    const run = () => {
      const { raw, store } = read(), before = JSON.stringify(store), result = operation(store);
      if (JSON.stringify(store) !== before) { store.revision++; write(store, raw); }
      return copyStudioValue(result);
    };
    return locks?.request ? locks.request(`annora:${key}`, run) : Promise.resolve().then(run);
  };
  const assertSaved = (store, input) => {
    const draft = normalizeStudioDraft(input), saved = currentDraft(store, draft.productId);
    if (!saved || !sameStudioValue(saved, draft)) throw new StudioError('STALE_REVIEW', 'This draft changed after it was saved. Save and review the current content again.');
    return draft;
  };
  const releaseOf = (store, id) => {
    const release = records(store).find(item => item.id === id);
    if (!release) throw new StudioError('NOT_FOUND', 'This product release is not available in this browser or deployment.');
    return release;
  };
  const api = {
    mode: 'demo',
    async listProducts() {
      const { store } = read(), release = published(store), draft = currentDraft(store, STUDIO_PRODUCT_ID);
      return [{ id: STUDIO_PRODUCT_ID, title: draft?.content.title || release.content.title, shortTitle: draft?.content.shortTitle || release.content.shortTitle,
        draftRevision: draft?.revision || 0, releaseVersion: release.version, releaseId: release.id, releaseSource: release.source,
        updatedAt: draft?.updatedAt || release.createdAt, hasChanges: !!draft && studioChanges(release, draft).length > 0 }];
    },
    async getDraft(productId = STUDIO_PRODUCT_ID) {
      product(productId); const { store } = read(), draft = currentDraft(store, productId);
      if (draft) return copyStudioValue(draft);
      const release = published(store);
      return normalizeStudioDraft({ id: makeId('STUDIO-DRAFT'), revision: 0, productId, modelRevision: release.modelRevision,
        content: release.content, inquiryProfile: release.inquiryProfile, presentation: release.presentation, updatedAt: null });
    },
    async saveDraft(input) {
      const draft = normalizeStudioDraft(input);
      return change(store => {
        const previous = currentDraft(store, draft.productId);
        if (previous && (previous.id !== draft.id || previous.revision !== draft.revision)) throw new StudioError('CONFLICT', 'A newer product draft is saved. Reopen it before saving these changes.');
        if (!previous && draft.revision !== 0) throw new StudioError('CONFLICT', 'This saved draft is no longer available. Reopen the product.');
        if (previous && sameStudioValue(previous, draft)) return previous;
        const saved = { ...draft, revision: draft.revision + 1, updatedAt: now() };
        store.drafts = store.drafts.filter(item => item.productId !== draft.productId); store.drafts.push(saved);
        return saved;
      });
    },
    async getPublished(productId = STUDIO_PRODUCT_ID) { product(productId); return copyStudioValue(published(read().store)); },
    async getRelease(id) { return copyStudioValue(releaseOf(read().store, id)); },
    async listReleases(productId = STUDIO_PRODUCT_ID) { product(productId); return copyStudioValue(records(read().store)).sort((a, b) => b.version - a.version || b.createdAt.localeCompare(a.createdAt)); },
    async createPreview(input) {
      return change(store => {
        const draft = assertSaved(store, input), issues = validateStudioDraft(draft);
        if (errors(issues).length) throw new StudioError('VALIDATION', 'Resolve the highlighted issues before opening the buyer preview.', issues);
        const existing = store.previews.find(item => item.draftId === draft.id && item.draftRevision === draft.revision);
        if (existing) return existing;
        const preview = { id: makeId('ROOM-PREVIEW'), version: 0, productId: draft.productId, modelRevision: draft.modelRevision,
          content: copyStudioValue(draft.content), inquiryProfile: copyStudioValue(draft.inquiryProfile), presentation: copyStudioValue(draft.presentation),
          createdAt: now(), source: 'preview', draftId: draft.id, draftRevision: draft.revision };
        preview.content.roomRevision = preview.id;
        store.previews.push(preview); return preview;
      });
    },
    async getPreview(id) {
      const preview = read().store.previews.find(item => item.id === id);
      if (!preview) throw new StudioError('NOT_FOUND', 'This preview is not available in this browser. Return to Studio and create a new preview.');
      return copyStudioValue(preview);
    },
    async reviewRelease(input) {
      const { store } = read(), draft = assertSaved(store, input);
      return createReleaseReview(draft, published(store));
    },
    async publishDemo(review) {
      const packet = assertReleaseReview(review);
      return change(store => {
        const existing = store.releases.find(release => release.reviewToken === review.token);
        if (existing) return existing;
        const draft = assertSaved(store, packet.draft), active = published(store);
        if (active.id !== packet.baseReleaseId) throw new StudioError('STALE_REVIEW', 'A different product version is now active. Review the changes against that version before release.');
        const confirmed = createReleaseReview(draft, active);
        if (confirmed.token !== review.token) throw new StudioError('STALE_REVIEW', 'The release review is out of date. Review the current product again.');
        const release = { id: makeId('ROOM-DEMO'), version: Math.max(...records(store).map(item => item.version)) + 1,
          productId: draft.productId, modelRevision: draft.modelRevision, content: copyStudioValue(draft.content),
          inquiryProfile: copyStudioValue(draft.inquiryProfile), presentation: copyStudioValue(draft.presentation),
          createdAt: now(), source: 'demo', reviewToken: review.token };
        release.content.roomRevision = release.id;
        if (!store.releases.some(item => item.id === active.id)) store.releases.push(copyStudioValue(active));
        store.releases.push(release); store.publishedId = release.id;
        return release;
      });
    },
    async exportRelease(id) {
      const release = copyStudioValue(releaseOf(read().store, typeof id === 'string' ? id : id?.id));
      delete release.reviewToken;
      const referenced = new Set(release.content.documents.map(doc => doc.assetId));
      const packet = { schemaVersion: 1, kind: 'annora-room-release', release,
        assetManifest: STUDIO_ASSETS.filter(asset => referenced.has(asset.id)).map(({ id, fileName, type }) => ({ id, fileName, type })) };
      const issues = validateReleasePackage(packet);
      if (errors(issues).length) throw new StudioError('VALIDATION', 'This release package needs review before export.', issues);
      return packet;
    },
  };
  return Object.freeze(api);
}
