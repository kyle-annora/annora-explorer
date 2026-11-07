/** Host template: the kit never chooses a database or sends an inquiry itself.
 * Pass your existing project's methods. An API host must validate authorization,
 * revision concurrency, idempotency and the complete review packet server-side.
 */
export function createHostInquiryRepository({ getDraft, saveDraft, submitInquiry, prepareInquiryReview,
  supportsRequestItems = false, supportedViewerReferenceVersions = [] }) {
  for (const [name, method] of Object.entries({ getDraft, saveDraft, submitInquiry }))
    if (typeof method !== 'function') throw new TypeError(`Implement ${name} in the host project repository.`);
  if (!Array.isArray(supportedViewerReferenceVersions) || supportedViewerReferenceVersions.some(version => version !== '1'))
    throw new TypeError('Declare only viewer reference versions this host can preserve; this kit supports version 1.');
  if (prepareInquiryReview !== undefined && typeof prepareInquiryReview !== 'function') throw new TypeError('prepareInquiryReview must be a function.');
  return Object.freeze({ getDraft, saveDraft, submitInquiry, ...(prepareInquiryReview ? { prepareInquiryReview } : {}),
    supportsRequestItems: supportsRequestItems === true, supportedViewerReferenceVersions: Object.freeze([...supportedViewerReferenceVersions]) });
}

// getDraft(context) returns the same product/release draft, retaining the original
// reference on a resumed draft. A new draft uses the supplied exact context.
// saveDraft(draft) returns a revisioned saved draft without removing metadata.
// submitInquiry(review) confirms exactly the reviewed draft and returns a project
// with project.context and project.inquiry; it must be safe to retry the same review.
// Optional prepareInquiryReview(savedDraft) returns a token + the exact draft.
// Advertise supportedViewerReferenceVersions:['1'] only after round-trip tests.
