import { requestContext } from './request-state.js';

/** Customer-owned project records, independent of presentation and transport. */
export class ProjectError extends Error {
  constructor(code, message, fields = {}) { super(message); this.name = 'ProjectError'; this.code = code; this.fields = fields; }
}
export const cloneProjectValue = value => JSON.parse(JSON.stringify(value));
const text = value => typeof value === 'string' ? value.trim() : '';
const fieldNames = ['name', 'email', 'company', 'application', 'quantity', 'targetWeeks', 'stroke', 'load', 'notes'];
const blankValues = () => Object.fromEntries(fieldNames.map(key => [key, '']));
const id = () => `DRAFT-${globalThis.crypto.randomUUID()}`;
export const projectContextKey = context => JSON.stringify([context.productId, context.modelId, context.modelRevision]);

function contextOf(input) {
  let context;
  try { context = requestContext(input); } catch (error) { throw new ProjectError('VALIDATION', error.message); }
  if (!context.modelId || !context.modelRevision) throw new ProjectError('VALIDATION', 'An inquiry needs the exact model and revision.');
  return context;
}

export function createInquiryDraft(context, draftId = id()) {
  return { id: draftId, revision: 0, context: contextOf(context), values: blankValues(), requirements: [], updatedAt: null };
}

/** Normalization is intentionally separate from final review: incomplete drafts can be saved. */
export function normalizeInquiryDraft(input) {
  if (!input || !text(input.id) || !Number.isSafeInteger(input.revision) || input.revision < 0) throw new ProjectError('VALIDATION', 'This draft has no valid identity or revision.');
  const values = Object.fromEntries(fieldNames.map(key => [key, text(input.values?.[key])]));
  if (!Array.isArray(input.requirements) || input.requirements.length > 30) throw new ProjectError('VALIDATION', 'Keep the inquiry within 30 confirmed requirements.', { requirements: 'Check the requirement list.' });
  const requirements = input.requirements.map(item => {
    if (!item || !text(item.id) || !text(item.label) || !['customer', 'model-reference'].includes(item.source)) throw new ProjectError('VALIDATION', 'A requirement needs a label and source.', { requirements: 'Check each requirement and its source.' });
    const normalized = { id: text(item.id), label: text(item.label), value: text(item.value), unit: text(item.unit), source: item.source, confirmed: item.confirmed === true };
    if (item.part) {
      if (!text(item.part.id) || !text(item.part.title)) throw new ProjectError('VALIDATION', 'A linked requirement needs a valid part.');
      normalized.part = { id: text(item.part.id), title: text(item.part.title) };
    }
    if ([normalized.id, normalized.label, normalized.value, normalized.unit, normalized.part?.title || ''].some(value => value.length > 1000)) throw new ProjectError('VALIDATION', 'Keep requirement details within 1,000 characters.');
    return normalized;
  });
  if (new Set(requirements.map(item => item.id)).size !== requirements.length) throw new ProjectError('VALIDATION', 'Each requirement needs a unique identity.');
  if (Object.values(values).some(value => value.length > 4000)) throw new ProjectError('VALIDATION', 'Keep individual fields within 4,000 characters.');
  return { id: text(input.id), revision: input.revision, context: contextOf(input.context), values, requirements, updatedAt: input.updatedAt || null };
}

export function inquiryErrors(draft) {
  const { values, requirements } = draft, fields = {};
  if (!values.application) fields.application = 'Describe the application or question to review.';
  else if (values.application.length > 2000) fields.application = 'Keep the application within 2,000 characters.';
  if (!/^\d+$/.test(values.quantity) || +values.quantity < 1 || +values.quantity > 100000) fields.quantity = 'Enter a whole quantity from 1 to 100,000.';
  if (values.targetWeeks && (!/^\d+$/.test(values.targetWeeks) || +values.targetWeeks < 1 || +values.targetWeeks > 104)) fields.targetWeeks = 'Enter 1–104 weeks, or leave it open.';
  if (values.email && (values.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email))) fields.email = 'Enter a valid email, or leave it blank for this demo.';
  if (values.name.length > 120) fields.name = 'Keep the name within 120 characters.';
  if (values.company.length > 160) fields.company = 'Keep the company within 160 characters.';
  if (values.notes.length > 2000) fields.notes = 'Keep the notes within 2,000 characters.';
  if (values.stroke && (!/^\d+(\.\d+)?$/.test(values.stroke) || +values.stroke <= 0 || +values.stroke > 100000)) fields.stroke = 'Enter a positive stroke in millimeters, or leave it open.';
  if (values.load.length > 200) fields.load = 'Keep the load detail within 200 characters.';
  if (requirements.some(item => !item.confirmed)) fields.requirements = 'Confirm each attached requirement, or remove it from the inquiry.';
  return fields;
}

// Review seals detect accidental edits, not authorization. A real host must validate server-side.
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
export const sameProjectValue = (left, right) => canonical(left) === canonical(right);
function seal(payload) { return canonical(payload); }
function reviewed(payload) { return { ...cloneProjectValue(payload), token: seal(payload) }; }
export function assertReview(review, kind) {
  if (!review || review.kind !== kind || typeof review.token !== 'string') throw new ProjectError('STALE_REVIEW', 'Review the details before confirming.');
  const { token, ...payload } = review;
  if (token !== seal(payload)) throw new ProjectError('STALE_REVIEW', 'The reviewed details changed. Review them again before confirming.');
  return cloneProjectValue(payload);
}
export function reviewInquiry(input) {
  const draft = normalizeInquiryDraft(input), fields = inquiryErrors(draft);
  if (Object.keys(fields).length) throw new ProjectError('VALIDATION', 'Check the highlighted inquiry details.', fields);
  if (draft.revision < 1) throw new ProjectError('STALE_REVIEW', 'Save the draft before reviewing it.');
  return reviewed({ kind: 'inquiry', draft });
}

function quoteOf(project, quoteId) {
  const quote = project?.quotes?.find(item => item.id === quoteId);
  if (!quote) throw new ProjectError('NOT_FOUND', 'This quotation is no longer available.');
  return quote;
}
function assertCurrentQuote(project, quoteId) {
  const quote = quoteOf(project, quoteId);
  if (project.quotes.at(-1)?.id !== quote.id) throw new ProjectError('STALE_REVIEW', 'Open the latest quotation before requesting the next step.');
  return quote;
}
export function reviewRevision(project, quoteId, input) {
  const quote = assertCurrentQuote(project, quoteId);
  const values = { quantity: text(input?.quantity), targetWeeks: text(input?.targetWeeks), notes: text(input?.notes) }, fields = {};
  if (!/^\d+$/.test(values.quantity) || +values.quantity < 1 || +values.quantity > 100000) fields.quantity = 'Enter a whole quantity from 1 to 100,000.';
  if (values.targetWeeks && (!/^\d+$/.test(values.targetWeeks) || +values.targetWeeks < 1 || +values.targetWeeks > 104)) fields.targetWeeks = 'Enter 1–104 weeks, or leave it open.';
  if (values.notes.length > 2000) fields.notes = 'Keep the question within 2,000 characters.';
  if (!Object.keys(fields).length && +values.quantity === quote.quantity && (values.targetWeeks ? +values.targetWeeks : null) === quote.requestedWeeks && !values.notes) fields.notes = 'Describe what you want to change, or update quantity or timing.';
  if (Object.keys(fields).length) throw new ProjectError('VALIDATION', 'Check the requested changes.', fields);
  return reviewed({ kind: 'revision', projectId: project.id, projectRevision: project.revision, quoteId: quote.id, quoteVersion: quote.version, values });
}
export function reviewNextStep(project, quoteId, input) {
  const quote = assertCurrentQuote(project, quoteId);
  const intent = text(input?.intent), message = text(input?.message), fields = {};
  if (!['discussion', 'engineering-review'].includes(intent)) fields.intent = 'Choose a next step.';
  if (!message) fields.message = 'Add what you would like to discuss or review.';
  else if (message.length > 2000) fields.message = 'Keep the message within 2,000 characters.';
  if (Object.keys(fields).length) throw new ProjectError('VALIDATION', 'Check the next-step request.', fields);
  return reviewed({ kind: 'next-step', projectId: project.id, projectRevision: project.revision, quoteId: quote.id, quoteVersion: quote.version, intent, message });
}

const money = value => value === null ? 'Pending review' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(value);
export function compareQuotes(before, after) {
  if (!before || !after) return [];
  const rows = [
    ['quantity', 'Quantity', `${before.quantity} units`, `${after.quantity} units`],
    ['unitPrice', 'Sample unit price', money(before.unitPrice), money(after.unitPrice)],
    ['requestedWeeks', 'Requested timing', before.requestedWeeks === null ? 'To discuss' : `${before.requestedWeeks} weeks`, after.requestedWeeks === null ? 'To discuss' : `${after.requestedWeeks} weeks`],
    ['proposedLeadTime', 'Proposed lead time', before.proposedLeadTime, after.proposedLeadTime],
    ['scope', 'Scope', before.scope, after.scope],
    ['subtotal', 'Priced subtotal', money(before.subtotal), money(after.subtotal)],
    ['total', 'Final total', money(before.total), money(after.total)]
  ];
  return rows.map(([key, label, left, right]) => ({ key, label, before: left, after: right, changed: left !== right }));
}

export function projectStatus(project) {
  const latestQuote = project.quotes.at(-1);
  const change = project.changes.filter(item => item.quoteId === latestQuote?.id).at(-1);
  if (change && !project.replies.some(reply => reply.changeId === change.id)) return { label: 'Changes requested', next: 'Supplier reply pending', owner: 'Supplier' };
  if (project.nextSteps.some(item => item.quoteId === latestQuote?.id)) return { label: 'Next step requested', next: 'Supplier to review the request', owner: 'Supplier' };
  if (project.quotes.length > 1) return { label: 'Revised quotation', next: 'Review the changed terms', owner: 'You' };
  if (project.quotes.length) return { label: 'Quotation ready', next: 'Review the sample quotation', owner: 'You' };
  return { label: 'Inquiry saved', next: 'Awaiting supplier review', owner: 'Supplier' };
}
