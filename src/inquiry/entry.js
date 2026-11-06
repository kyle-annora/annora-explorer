import { mountEmbeddedInquiry as mountSurface } from '../product-room/embedded-inquiry.jsx';

/** Client-local bundle: storage ownership is mandatory, never an implicit demo store. */
export function mountEmbeddedInquiry(element, options) {
  if (!options?.repository) throw new TypeError('A client inquiry requires its own repository adapter.');
  return mountSurface(element, options);
}

export { createInquirySession, prepareInquirySubmission, confirmInquirySubmission } from '../product-room/inquiry-session.js';
export { ProjectError, createInquiryDraft, normalizeInquiryDraft, normalizeProjectContext, projectContextKey,
  reviewInquiry, assertReview, reviewedProjectValue, cloneProjectValue, sameProjectValue,
  INQUIRY_INTENTS, INQUIRY_RULES_VERSION } from '../product-room/project-domain.js';
export { normalizeInspectionReference } from '../explorer/inspection-reference.js';
export { normalizeInquiryPresentation } from '../product-room/inquiry-presentation.js';
