import {
  DrawingStudioError, createDrawingDraft, assertDrawingDraft, createDrawingReview,
  drawingDraftKey, drawingPartIds, drawingSource, copyDrawingValue as copy, sameDrawingValue as same,
} from './drawing-domain.js';
import { validateDrawingPackage, releaseDiagnostic } from '../drawings/package.js';

export const DRAWING_STUDIO_STORAGE_KEY = 'annora.studio.drawing-packages.v1';
const empty = () => ({ schemaVersion: 1, revision: 0, drafts: [], previews: [], releases: [], published: {} });
const text = value => typeof value === 'string' && value.length > 0;
const date = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const unique = items => new Set(items.map(item => item.id)).size === items.length;
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
const snapshot = value => freeze(copy(value));

/** Reading old releases never substitutes files from a newly configured source version. */
export function parseDrawingStudioStore(raw) {
  if (raw === null || raw === undefined) return empty();
  try {
    const store = JSON.parse(raw);
    if (store.schemaVersion !== 1 || !Number.isSafeInteger(store.revision) || store.revision < 0
        || !['drafts', 'previews', 'releases'].every(key => Array.isArray(store[key]) && unique(store[key]))
        || !store.published || Array.isArray(store.published) || typeof store.published !== 'object'
        || new Set(store.drafts.map(draft => draft.key)).size !== store.drafts.length) throw new Error();
    for (const draft of store.drafts) {
      if (draft.schemaVersion !== 1 || !text(draft.id) || !text(draft.productId) || !text(draft.key) || !text(draft.sourceSignature)
          || !Number.isSafeInteger(draft.revision) || draft.revision < 1 || !date(draft.updatedAt)
          || !draft.packageSnapshot || !Array.isArray(draft.packageSnapshot.sheets)) throw new Error();
    }
    for (const record of [...store.releases, ...store.previews]) {
      if (!text(record.id) || !text(record.productId) || !text(record.modelId) || !text(record.modelRevision)
          || !text(record.mappingRevision) || !text(record.sourceRevision) || !date(record.createdAt)
          || !Number.isSafeInteger(record.version) || !Array.isArray(record.partIds)
          || !['demo', 'preview'].includes(record.source) || !text(record.draftId) || !Number.isSafeInteger(record.draftRevision)) throw new Error();
      const pkg = validateDrawingPackage(record.packageSnapshot, { modelRevision: record.modelRevision, partIds: record.partIds });
      if (!releaseDiagnostic(pkg, { modelRevision: record.modelRevision, partIds: record.partIds }).valid) throw new Error();
      if (pkg.modelId !== record.modelId || pkg.modelRevision !== record.modelRevision || pkg.mappingRevision !== record.mappingRevision || pkg.revision !== record.sourceRevision) throw new Error();
    }
    for (const [productId, id] of Object.entries(store.published)) if (!store.releases.some(release => release.id === id && release.productId === productId)) throw new Error();
    return store;
  } catch { throw new DrawingStudioError('STORAGE_CORRUPT', 'Saved drawing work could not be read. It has not been changed. Use a separate browser profile or recover the stored data.'); }
}

/** Local adapter boundary. Production hosts supply authentication, durable assets and authorization here. */
export function createDrawingRepository({ packages = [], storage: injectedStorage, key = DRAWING_STUDIO_STORAGE_KEY,
  now = () => new Date().toISOString(), makeId = prefix => `${prefix}-${globalThis.crypto.randomUUID()}`,
  locks = globalThis.navigator?.locks } = {}) {
  if (!packages.length || new Set(packages.map(entry => entry.id)).size !== packages.length) throw new DrawingStudioError('INVALID_CATALOG', 'Provide at least one uniquely identified prepared drawing product.');
  packages.forEach(drawingSource);
  const entryOf = id => {
    const entry = packages.find(item => item.id === id);
    if (!entry) throw new DrawingStudioError('NOT_FOUND', 'This prepared product is not in the current catalog.');
    return entry;
  };
  const storageOf = () => {
    try {
      const target = injectedStorage || globalThis.localStorage;
      if (!target?.getItem || !target?.setItem) throw new Error();
      return target;
    } catch { throw new DrawingStudioError('STORAGE_UNAVAILABLE', 'Browser storage is unavailable. Keep this page open and allow storage before saving.'); }
  };
  const read = () => {
    try { const raw = storageOf().getItem(key); return { raw, store: parseDrawingStudioStore(raw) }; }
    catch (error) { if (error instanceof DrawingStudioError) throw error; throw new DrawingStudioError('STORAGE_UNAVAILABLE', 'Saved drawing work could not be read. Nothing has been changed.'); }
  };
  const write = (store, before) => {
    try {
      const target = storageOf(), encoded = JSON.stringify(store);
      if (target.getItem(key) !== before) throw new DrawingStudioError('CONFLICT', 'Another tab changed this workspace. Reopen the latest saved draft before continuing.');
      target.setItem(key, encoded);
      if (target.getItem(key) !== encoded) throw new DrawingStudioError('CONFLICT', 'Drawing work changed in another tab. Reload the latest version.');
    } catch (error) { if (error instanceof DrawingStudioError) throw error; throw new DrawingStudioError('STORAGE_UNAVAILABLE', 'This change could not be saved. Your earlier draft and releases are unchanged. Allow storage or free space and try again.'); }
  };
  const change = operation => {
    const run = () => {
      const { raw, store } = read(), before = JSON.stringify(store), result = operation(store);
      if (JSON.stringify(store) !== before) { store.revision++; write(store, raw); }
      return copy(result);
    };
    return locks?.request ? locks.request(`annora:${key}`, run) : Promise.resolve().then(run);
  };
  const savedDraft = (store, input) => {
    const draft = assertDrawingDraft(input, entryOf(input.productId)), current = store.drafts.find(item => item.key === draft.key);
    if (!current || !same(assertDrawingDraft(current, entryOf(input.productId)), draft)) throw new DrawingStudioError('STALE_REVIEW', 'The draft has changed. Save and review the current associations again.');
    return draft;
  };
  const active = (store, id) => store.releases.find(release => release.id === store.published[id]) || null;
  const record = (draft, source, version) => ({ schemaVersion: 1, kind: 'annora-drawing-release', id: makeId(source === 'preview' ? 'DRAWING-PREVIEW' : 'DRAWING-RELEASE'),
    productId: draft.productId, version, source, draftId: draft.id, draftRevision: draft.revision,
    modelId: draft.packageSnapshot.modelId, modelRevision: draft.packageSnapshot.modelRevision,
    sourceRevision: draft.packageSnapshot.revision, mappingRevision: draft.packageSnapshot.mappingRevision,
    packageSnapshot: copy(draft.packageSnapshot), partIds: drawingPartIds(entryOf(draft.productId)), createdAt: now() });
  return Object.freeze({
    mode: 'demo',
    async getDraft(productId = packages[0].id) {
      const entry = entryOf(productId), current = read().store.drafts.find(draft => draft.key === drawingDraftKey(entry));
      return current ? assertDrawingDraft(current, entry) : createDrawingDraft(entry, makeId('DRAWING-DRAFT'));
    },
    async saveDraft(input) {
      const draft = assertDrawingDraft(input, entryOf(input.productId));
      return change(store => {
        const current = store.drafts.find(item => item.key === draft.key);
        if (current && (current.id !== draft.id || current.revision !== draft.revision) || !current && draft.revision !== 0)
          throw new DrawingStudioError('CONFLICT', 'A newer drawing draft is saved. Reopen it before saving these changes.');
        if (current && same(current, draft)) return current;
        const next = { ...draft, revision: draft.revision + 1, updatedAt: now() };
        store.drafts = store.drafts.filter(item => item.key !== draft.key); store.drafts.push(next); return next;
      });
    },
    async listReleases(productId = packages[0].id) {
      return snapshot(read().store.releases.filter(release => release.productId === productId).sort((a, b) => b.version - a.version));
    },
    async getRelease(id) {
      const release = read().store.releases.find(item => item.id === id);
      if (!release) throw new DrawingStudioError('NOT_FOUND', 'This release is not available in this browser.');
      return snapshot(release);
    },
    async getPublished(productId = packages[0].id) { const release = active(read().store, productId); return release ? snapshot(release) : null; },
    async reviewDraft(input) {
      const { store } = read(), draft = savedDraft(store, input);
      return snapshot(createDrawingReview(draft, entryOf(draft.productId), active(store, draft.productId)?.id || null));
    },
    async publishReviewed(review, { confirmed = false } = {}) {
      if (!confirmed) throw new DrawingStudioError('CONFIRMATION_REQUIRED', 'Review the mapping summary and confirm publication first.');
      const result = await change(store => {
        const previous = store.releases.find(item => item.reviewToken === review?.token);
        if (previous) return previous;
        if (review?.kind !== 'annora-drawing-review' || !review.draft) throw new DrawingStudioError('STALE_REVIEW', 'Open a fresh release review before publishing.');
        const draft = savedDraft(store, review.draft), current = active(store, draft.productId);
        const checked = createDrawingReview(draft, entryOf(draft.productId), current?.id || null);
        if (!same(review, checked)) throw new DrawingStudioError('STALE_REVIEW', 'The review no longer matches the saved draft or published version. Review it again.');
        const next = record(draft, 'demo', Math.max(0, ...store.releases.filter(item => item.productId === draft.productId).map(item => item.version)) + 1);
        next.reviewToken = review.token;
        next.baseReleaseId = current?.id || null;
        next.previousPackageSnapshot = copy(current?.packageSnapshot || drawingSource(entryOf(draft.productId)));
        store.releases.push(next); store.published[draft.productId] = next.id; return next;
      });
      return snapshot(result);
    },
    async createPreview(input) {
      const result = await change(store => {
        const draft = savedDraft(store, input);
        createDrawingReview(draft, entryOf(draft.productId));
        const previous = store.previews.find(item => item.draftId === draft.id && item.draftRevision === draft.revision);
        if (previous) return previous;
        const next = record(draft, 'preview', 0); store.previews.push(next); return next;
      });
      return snapshot(result);
    },
    async getPreview(id) {
      const preview = read().store.previews.find(item => item.id === id);
      if (!preview) throw new DrawingStudioError('NOT_FOUND', 'This preview is not available in this browser. Return to Studio and create a new preview.');
      return snapshot(preview);
    },
    async exportRelease(id) { const release = await this.getRelease(id), exported = copy(release); delete exported.reviewToken; return exported; },
  });
}
