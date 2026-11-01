import {
  DrawingStudioError, createDrawingDraft, assertDrawingDraft, createDrawingReview,
  drawingDraftKey, drawingPartIds, drawingSource, drawingSourceSignature, createImportedDrawingSource, createSourceDrawingDraft, copyDrawingValue as copy, sameDrawingValue as same,
} from './drawing-domain.js';
import { defaultDrawingAssetStore } from './drawing-asset-store.js';
import { validateDrawingPackage, releaseDiagnostic } from '../drawings/package.js';

export const DRAWING_STUDIO_STORAGE_KEY = 'annora.studio.drawing-packages.v1';
const empty = () => ({ schemaVersion: 1, revision: 0, drafts: [], previews: [], releases: [], published: {}, sourceVersions: [], activeDrafts: {} });
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
    store.sourceVersions ||= []; store.activeDrafts ||= {};
    if (!Array.isArray(store.sourceVersions) || !unique(store.sourceVersions) || !store.activeDrafts || typeof store.activeDrafts !== 'object' || Array.isArray(store.activeDrafts)) throw new Error();
    for (const source of store.sourceVersions) {
      if (source.schemaVersion !== 1 || source.kind !== 'local-pdf' || !text(source.id) || !text(source.productId) || !text(source.label) || !date(source.createdAt)) throw new Error();
      const pkg = validateDrawingPackage(source.packageSnapshot);
      if (source.revision !== pkg.revision || source.modelRevision !== pkg.modelRevision || pkg.sourceOrigin?.sourceVersionId !== source.id) throw new Error();
      if (pkg.assets.some(asset => asset.localBlobKey && (asset.localBlobKey !== `sha256:${asset.sha256}` || Object.hasOwn(asset, 'url')))) throw new Error();
    }
    if (store.schemaVersion !== 1 || !Number.isSafeInteger(store.revision) || store.revision < 0
        || !['drafts', 'previews', 'releases'].every(key => Array.isArray(store[key]) && unique(store[key]))
        || !store.published || Array.isArray(store.published) || typeof store.published !== 'object'
        || new Set(store.drafts.map(draft => draft.key)).size !== store.drafts.length) throw new Error();
    for (const draft of store.drafts) {
      if (draft.schemaVersion !== 1 || !text(draft.id) || !text(draft.productId) || !text(draft.key) || !text(draft.sourceSignature)
          || !Number.isSafeInteger(draft.revision) || draft.revision < 1 || !date(draft.updatedAt)
          || !draft.packageSnapshot || !Array.isArray(draft.packageSnapshot.sheets)) throw new Error();
      if (draft.sourceVersionId && !store.sourceVersions.some(source => source.id === draft.sourceVersionId && source.productId === draft.productId && same(source.packageSnapshot, draft.sourcePackageSnapshot))) throw new Error();
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
    for (const [productId, id] of Object.entries(store.activeDrafts)) if (!store.drafts.some(draft => draft.id === id && draft.productId === productId)) throw new Error();
    for (const [productId, id] of Object.entries(store.published)) if (!store.releases.some(release => release.id === id && release.productId === productId)) throw new Error();
    return store;
  } catch { throw new DrawingStudioError('STORAGE_CORRUPT', 'Saved drawing work could not be read. It has not been changed. Use a separate browser profile or recover the stored data.'); }
}

/** Local adapter boundary. Production hosts supply authentication, durable assets and authorization here. */
export function createDrawingRepository({ packages = [], storage: injectedStorage, key = DRAWING_STUDIO_STORAGE_KEY,
  now = () => new Date().toISOString(), makeId = prefix => `${prefix}-${globalThis.crypto.randomUUID()}`,
  locks = globalThis.navigator?.locks, assetStore = defaultDrawingAssetStore() } = {}) {
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
  const validateDraft = (store, input) => {
    if (input.sourceVersionId && !store.sourceVersions.some(source => source.id === input.sourceVersionId && source.productId === input.productId && same(source.packageSnapshot, input.sourcePackageSnapshot)))
      throw new DrawingStudioError('SOURCE_CHANGED', 'This imported source version is not registered in the workspace. Import the original PDF through the source-version workflow.');
    return assertDrawingDraft(input, entryOf(input.productId));
  };
  const ensureAssets = async pkg => {
    for (const asset of pkg.assets.filter(item => item.localBlobKey)) await assetStore.get(asset.localBlobKey, { sha256: asset.sha256 });
  };
  const savedDraft = (store, input) => {
    const draft = validateDraft(store, input), current = store.drafts.find(item => item.key === draft.key);
    if (!current || !same(assertDrawingDraft(current, entryOf(input.productId)), draft)) throw new DrawingStudioError('STALE_REVIEW', 'The draft has changed. Save and review the current associations again.');
    return draft;
  };
  const active = (store, id) => store.releases.find(release => release.id === store.published[id]) || null;
  const record = (draft, source, version) => ({ schemaVersion: 1, kind: 'annora-drawing-release', id: makeId(source === 'preview' ? 'DRAWING-PREVIEW' : 'DRAWING-RELEASE'),
    productId: draft.productId, version, source, draftId: draft.id, draftRevision: draft.revision,
    modelId: draft.packageSnapshot.modelId, modelRevision: draft.packageSnapshot.modelRevision,
    sourceRevision: draft.packageSnapshot.revision, mappingRevision: draft.packageSnapshot.mappingRevision,
    packageSnapshot: copy(draft.packageSnapshot), ...(draft.regionChanges ? { regionChanges: copy(draft.regionChanges) } : {}), ...(draft.sourceVersionId ? { sourceVersionId: draft.sourceVersionId, sourcePackageSnapshot: copy(draft.sourcePackageSnapshot) } : {}), partIds: drawingPartIds(entryOf(draft.productId)), createdAt: now() });
  return Object.freeze({
    mode: 'demo', assetStore,
    async getDraft(productId = packages[0].id, selector = {}) {
      if (typeof selector === 'string') selector = { sourceVersionId: selector };
      const entry = entryOf(productId), { store } = read();
      let current;
      if (selector.draftId) current = store.drafts.find(draft => draft.id === selector.draftId && draft.productId === productId);
      else if (selector.sourceVersionId && selector.sourceVersionId !== `bundled:${drawingSourceSignature(entry)}`) current = store.drafts.find(draft => draft.sourceVersionId === selector.sourceVersionId && draft.productId === productId);
      else if (!selector.sourceVersionId) {
        const active = store.drafts.find(draft => draft.id === store.activeDrafts[productId]);
        if (active && active.packageSnapshot.modelRevision === entry.model.revision && (active.sourceVersionId || active.key === drawingDraftKey(entry))) current = active;
      }
      if (!current && (selector.draftId || selector.sourceVersionId && selector.sourceVersionId !== `bundled:${drawingSourceSignature(entry)}`)) throw new DrawingStudioError('NOT_FOUND', 'This source-version draft is not available in this browser.');
      current ||= store.drafts.find(draft => draft.key === drawingDraftKey(entry));
      return current ? validateDraft(store, current) : createDrawingDraft(entry, makeId('DRAWING-DRAFT'));
    },
    async getDraftById(id) { const { store } = read(), draft = store.drafts.find(item => item.id === id); if (!draft) throw new DrawingStudioError('NOT_FOUND', 'Save the current draft before importing a new source version.'); return validateDraft(store, draft); },
    async selectDraft(id) { return change(store => { const draft = store.drafts.find(item => item.id === id); if (!draft) throw new DrawingStudioError('NOT_FOUND', 'Save this source draft before switching to it.'); validateDraft(store, draft); store.activeDrafts[draft.productId] = id; return draft; }); },
    async listSourceVersions(productId = packages[0].id) {
      const entry = entryOf(productId), { store } = read(), pkg = drawingSource(entry), bundledDraft = store.drafts.find(draft => draft.key === drawingDraftKey(entry));
      return snapshot([{ id: `bundled:${drawingSourceSignature(entry)}`, revision: pkg.revision, label: pkg.revisionLabel || pkg.revision, kind: 'bundled', productId, draftId: bundledDraft?.id || null, packageSnapshot: pkg },
        ...store.sourceVersions.filter(source => source.productId === productId).map(source => ({ ...source, draftId: store.drafts.find(draft => draft.sourceVersionId === source.id)?.id || null }))]);
    },
    async createSourceDraft(productId, imported, options = {}) {
      const entry = entryOf(productId);
      if (!imported?.asset?.localBlobKey) throw new DrawingStudioError('INVALID_IMPORT', 'Import and verify an original PDF file before creating a source version.');
      const file = await assetStore.get(imported.asset.localBlobKey, { sha256: imported.asset.sha256 });
      if (file.byteLength !== imported.asset.byteLength) throw new DrawingStudioError('INVALID_IMPORT', 'The inspected PDF size differs from the saved source file.');
      return change(store => {
        let base = options.baseDraftId ? store.drafts.find(draft => draft.id === options.baseDraftId && draft.productId === productId) : store.drafts.find(draft => draft.id === store.activeDrafts[productId]);
        if (options.baseDraftId && !base) throw new DrawingStudioError('NOT_FOUND', 'Save the current association draft before importing another source version.');
        if (base) base = validateDraft(store, base);
        if (!base) {
          base = store.drafts.find(draft => draft.key === drawingDraftKey(entry));
          if (!base) { base = { ...createDrawingDraft(entry, makeId('DRAWING-DRAFT')), revision: 1, updatedAt: now() }; store.drafts.push(base); }
        }
        if (base.packageSnapshot.assets.some(asset => asset.kind === 'pdf' && asset.sha256 === imported.asset.sha256)) throw new DrawingStudioError('SOURCE_UNCHANGED', 'This PDF is already the selected source version. Choose a different file to create a new version.');
        const sourceId = makeId('DRAWING-SOURCE'), source = createImportedDrawingSource(entry, base.packageSnapshot, imported, { ...options, sourceVersionId: sourceId, importedAt: now() });
        const draft = { ...createSourceDrawingDraft(entry, source, makeId('DRAWING-DRAFT')), revision: 1, updatedAt: now() };
        store.sourceVersions.push(source); store.drafts.push(draft); store.activeDrafts[productId] = draft.id; return draft;
      });
    },
    async saveDraft(input) {
      return change(store => {
        const draft = validateDraft(store, input);
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
      await ensureAssets(draft.packageSnapshot);
      return snapshot(createDrawingReview(draft, entryOf(draft.productId), active(store, draft.productId)?.id || null));
    },
    async publishReviewed(review, { confirmed = false } = {}) {
      if (!confirmed) throw new DrawingStudioError('CONFIRMATION_REQUIRED', 'Review the mapping summary and confirm publication first.');
      if (review?.draft?.packageSnapshot) await ensureAssets(review.draft.packageSnapshot);
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
      await ensureAssets(input.packageSnapshot);
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
    async exportAsset(id, assetId) { const release = await this.getRelease(id), asset = release.packageSnapshot.assets.find(item => item.id === assetId); if (!asset?.localBlobKey) throw new DrawingStudioError('NOT_FOUND', 'This release does not contain that imported PDF.'); return { ...(await assetStore.get(asset.localBlobKey, { sha256: asset.sha256 })), fileName: asset.file.split('/').at(-1), packagePath: asset.file }; },
    async exportRelease(id) { const release = await this.getRelease(id), exported = copy(release); delete exported.reviewToken; return exported; },
  });
}
