import { INQUIRY_FIELD_IDS } from './inquiry-profile.js';
import { INQUIRY_INTENTS } from './inquiry-rules.js';

const defaults = Object.freeze({
  eyebrow: 'YOUR INQUIRY', detailsTitle: 'Tell us what you need.', reviewTitle: 'Review your request.', confirmedTitle: 'Inquiry saved.',
  requirementsStep: 'Requirements', reviewStep: 'Review & confirm', stepsLabel: 'Inquiry steps',
  minimizeLabel: 'Minimize inquiry', closeLabel: 'Close inquiry and keep draft', errorTitle: 'Check your inquiry',
  resumeLabel: 'Continue your inquiry', savedLabel: 'Inquiry saved', draftLabel: 'Saved inquiry draft', productLabel: 'Product inquiry',
  loadingLabel: 'Opening your saved inquiry…', reviewButton: 'Review inquiry', confirmButton: 'Confirm demo inquiry',
  receiptTitle: 'Your requirements and reference are saved together.',
  receiptDescription: 'Open the project to follow the quotation and conversation.',
  receiptNote: 'Nothing has been sent. This demo project stays in this browser.',
  openProjectButton: 'Open project', startAnotherButton: 'Start another inquiry', saveNote: 'Demo only · Nothing is sent',
  reviewNote: 'Save these details with the attached reference. Engineering suitability remains subject to review.',
});

/** Presentation only: an adapter still owns field mapping and business validation. */
export function normalizeInquiryPresentation(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Provide an inquiry presentation object.');
  if (input.fixedIntent !== undefined && !INQUIRY_INTENTS.some(item => item.value === input.fixedIntent)) throw new TypeError('Choose a supported fixed inquiry intent.');
  if (input.fields !== undefined && (!Array.isArray(input.fields) || !input.fields.includes('application') || new Set(input.fields).size !== input.fields.length || input.fields.some(id => !INQUIRY_FIELD_IDS.includes(id))))
    throw new TypeError('Inquiry fields must be unique supported fields and include application.');
  if (input.fields && !input.fields.includes('quantity') && input.fixedIntent !== 'application-review') throw new TypeError('Hide quantity only for a fixed application-review inquiry.');
  if (input.renderReview !== undefined && typeof input.renderReview !== 'function') throw new TypeError('The custom review must be a rendering function.');
  const labels = { ...defaults };
  for (const [key,value] of Object.entries(input.labels || {})) {
    if (!Object.hasOwn(defaults,key) || typeof value !== 'string' || !value.trim() || value.length > 1000) throw new TypeError(`Invalid inquiry label: ${key}.`);
    labels[key] = value;
  }
  const fieldLabels = {};
  for (const [key,value] of Object.entries(input.fieldLabels || {})) {
    if (!INQUIRY_FIELD_IDS.includes(key) || typeof value !== 'string' || !value.trim() || value.length > 100) throw new TypeError(`Invalid inquiry field label: ${key}.`);
    fieldLabels[key] = value;
  }
  return Object.freeze({ fixedIntent: input.fixedIntent || null, fields: input.fields ? Object.freeze([...input.fields]) : null,
    showScope: input.showScope !== false, labels: Object.freeze(labels), fieldLabels: Object.freeze(fieldLabels), renderReview: input.renderReview });
}

export const inquiryFieldVisible = (presentation, id) => !presentation.fields || presentation.fields.includes(id);
export const inquiryPresentationError = (presentation, draft) => presentation.fixedIntent && draft && draft.values.intent !== presentation.fixedIntent
  ? 'This saved draft uses a different request purpose. Open it with its original form; your entries have not been changed.' : '';
