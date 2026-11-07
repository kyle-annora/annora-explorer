import {
  OnboardingError, onboardingCandidateFingerprint, createOnboardingDraft, normalizeOnboardingDraft,
  buildOnboardingPreview, createOnboardingReview, createOnboardingPackage, assertOnboardingPackage,
} from './onboarding-domain.js';
import { copyStudioValue as copy, sameStudioValue as same } from './value.js';

export const ONBOARDING_STORAGE_KEY = 'annora.onboarding.v1';
const empty = candidate => ({ schemaVersion: 1, revision: 0, candidateFingerprint: onboardingCandidateFingerprint(candidate), draft: null, previews: [], exports: [] });
const unique = records => Array.isArray(records) && records.length <= 500 && records.every(record => record && typeof record.id === 'string') && new Set(records.map(record => record.id)).size === records.length;

export function parseOnboardingStore(raw, candidate) {
  if (raw == null) return empty(candidate);
  let store;
  try { store = JSON.parse(raw); } catch { throw new OnboardingError('STORAGE_CORRUPT', 'Saved onboarding work could not be read. The stored data has not been changed.'); }
  if (store?.candidateFingerprint !== onboardingCandidateFingerprint(candidate)) throw new OnboardingError('SOURCE_CHANGED', 'The prepared source changed after this draft was saved. Open its original source or recover the draft before continuing. Existing exports have not changed.');
  try {
    if (store.schemaVersion !== 1 || !Number.isSafeInteger(store.revision) || store.revision < 0 || !unique(store.previews) || !unique(store.exports)) throw new Error();
    if (store.draft && (store.draft.revision < 1 || !store.draft.updatedAt || !same(store.draft, normalizeOnboardingDraft(store.draft, candidate)))) throw new Error();
    for (const preview of store.previews) if (!same(preview, buildOnboardingPreview(preview.draft, candidate))) throw new Error();
    for (const record of store.exports) assertOnboardingPackage(record, candidate);
    return store;
  } catch { throw new OnboardingError('STORAGE_CORRUPT', 'Saved onboarding work could not be read. The stored data has not been changed.'); }
}

/** Browser-local preparation only. Never writes Studio releases, drawings or customer projects. */
export function createOnboardingRepository({ candidate, storage, key = `${ONBOARDING_STORAGE_KEY}:${candidate?.id}`, now = () => new Date().toISOString(),
  makeId = prefix => `${prefix}-${globalThis.crypto.randomUUID()}`, locks = globalThis.navigator?.locks } = {}) {
  onboardingCandidateFingerprint(candidate);
  const storageOf = () => {
    try { storage ||= globalThis.localStorage; if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') throw new Error(); return storage; }
    catch { throw new OnboardingError('STORAGE_UNAVAILABLE', 'Browser storage is unavailable. Keep your edits open and allow storage before saving.'); }
  };
  const read = () => {
    try { const raw = storageOf().getItem(key); return { raw, store: parseOnboardingStore(raw, candidate) }; }
    catch (error) { if (error instanceof OnboardingError) throw error; throw new OnboardingError('STORAGE_UNAVAILABLE', 'Saved onboarding work could not be read. Nothing has been changed.'); }
  };
  const write = (store, raw) => {
    try {
      const target = storageOf(), encoded = JSON.stringify(store);
      if (target.getItem(key) !== raw) throw new OnboardingError('CONFLICT', 'Another tab changed this intake. Reopen the latest saved draft before continuing.');
      target.setItem(key, encoded);
      if (target.getItem(key) !== encoded) throw new OnboardingError('CONFLICT', 'This intake changed in another tab. Reopen its latest state.');
    } catch (error) { if (error instanceof OnboardingError) throw error; throw new OnboardingError('STORAGE_UNAVAILABLE', 'This change could not be saved. Your existing draft and exports have not been replaced.'); }
  };
  const change = operation => {
    const run = () => { const { raw, store } = read(), before = JSON.stringify(store), result = operation(store);
      if (JSON.stringify(store) !== before) { store.revision++; write(store, raw); } return copy(result); };
    return locks?.request ? locks.request(`annora:${key}`, run) : Promise.resolve().then(run);
  };
  const saved = (store, input) => {
    const draft = normalizeOnboardingDraft(input, candidate);
    if (!store.draft || !same(store.draft, draft)) throw new OnboardingError('STALE_REVIEW', 'Save the current intake before previewing or reviewing it.');
    return draft;
  };
  return Object.freeze({
    mode: 'demo', candidateId: candidate.id,
    async getDraft() { return copy(read().store.draft || createOnboardingDraft(candidate, { id: makeId('ONBOARD-DRAFT') })); },
    async saveDraft(input) {
      const draft = normalizeOnboardingDraft(input, candidate);
      return change(store => {
        const previous = store.draft;
        if (previous && (previous.id !== draft.id || previous.revision !== draft.revision) || !previous && draft.revision !== 0)
          throw new OnboardingError('CONFLICT', 'A different intake revision is saved. Reopen it before saving your edits.');
        if (previous && same(previous, draft)) return previous;
        store.draft = { ...draft, revision: draft.revision + 1, updatedAt: now() }; return store.draft;
      });
    },
    async createPreview(input) {
      return change(store => { const draft = saved(store, input), preview = buildOnboardingPreview(draft, candidate);
        const previous = store.previews.find(item => item.id === preview.id); if (previous) return previous;
        if (store.previews.length >= 500) throw new OnboardingError('STORAGE_LIMIT', 'Export or archive this intake before creating more previews. Existing records remain unchanged.');
        store.previews.push(preview); return preview; });
    },
    async review(input, previewId) {
      const { store } = read(), draft = saved(store, input), preview = store.previews.find(item => item.id === previewId);
      if (!preview) throw new OnboardingError('PREVIEW_REQUIRED', 'Open the saved product preview before reviewing its export.');
      return copy(createOnboardingReview(draft, preview, candidate));
    },
    async exportReviewed(review) {
      const expected = createOnboardingReview(review?.draft, review?.preview, candidate);
      if (!same(expected, review)) throw new OnboardingError('STALE_REVIEW', 'The review changed. Review the current intake again before exporting.');
      return change(store => {
        const previous = store.exports.find(item => item.reviewToken === review.token); if (previous) return previous;
        saved(store, review.draft);
        if (!store.previews.some(item => same(item, review.preview))) throw new OnboardingError('PREVIEW_REQUIRED', 'The reviewed preview is not saved with this intake.');
        if (store.exports.length >= 500) throw new OnboardingError('STORAGE_LIMIT', 'This intake has reached its export limit. Existing records remain unchanged.');
        const packet = createOnboardingPackage(review, candidate, { id: makeId('ONBOARD-EXPORT'), createdAt: now() });
        store.exports.push(packet); return packet;
      });
    },
    async listExports() { return copy(read().store.exports).reverse(); },
  });
}
