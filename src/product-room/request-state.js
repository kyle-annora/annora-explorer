/** In-memory demo request state. No delivery, account or storage implementation. */
import { normalizeDrawingContext, drawingVersionKey } from './drawing-context.js';
import { normalizeInspection } from '../explorer/inspection-reference.js';
export const REQUEST_PURPOSES = Object.freeze([
  Object.freeze({ id: 'question', label: 'Ask a product question' }),
  Object.freeze({ id: 'application', label: 'Discuss an application' }),
  Object.freeze({ id: 'review', label: 'Request a technical review' })
]);
const text = value => typeof value === 'string' ? value.trim() : '';
const copy = value => JSON.parse(JSON.stringify(value));

export function requestContext(input) {
  if (!text(input?.productId) || !text(input?.productTitle)) throw new TypeError('A request needs a product identity.');
  const context = {
    productId: text(input.productId), productTitle: text(input.productTitle),
    modelId: text(input.modelId), modelRevision: text(input.modelRevision)
  };
  for (const key of ['part', 'document', 'chapter']) {
    const item = input[key];
    if (!item) continue;
    if (!text(item.id) || !text(item.title)) throw new TypeError(`Invalid ${key} context.`);
    if (key !== 'document' && (!context.modelId || !context.modelRevision)) throw new TypeError('Part and chapter context need an exact model revision.');
    context[key] = { id: text(item.id), title: text(item.title) };
    if (key === 'chapter') {
      if (!text(item.tourId)) throw new TypeError('A chapter needs its tour identity.');
      context[key].tourId = text(item.tourId);
    }
  }
  if (input.drawing !== undefined) context.drawing = normalizeDrawingContext(input.drawing, context);
  if (input.inspection !== undefined) context.inspection = normalizeInspection(input.inspection, { model: { id: context.modelId, revision: context.modelRevision } });
  return context;
}

export function createRequestDraft(context) {
  return { stage: 'draft', context: requestContext(context), values: { purpose: 'question', message: '', name: '', email: '' }, errors: {}, receipt: null };
}

export function updateRequestDraft(state, values) {
  if (state.stage !== 'draft') throw new Error('Return to details before editing a reviewed request.');
  const next = copy(state);
  for (const key of ['purpose', 'message', 'name', 'email']) if (Object.hasOwn(values, key)) next.values[key] = typeof values[key] === 'string' ? values[key] : '';
  next.errors = {};
  return next;
}

export function removeRequestContext(state, key) {
  if (state.stage !== 'draft' || !['part', 'document', 'chapter'].includes(key)) throw new Error('Only optional draft context can be removed.');
  if (key === 'part' && state.context.drawing) throw new Error('Keep the part linked to its drawing detail.');
  const next = copy(state); delete next.context[key]; return next;
}

export function replaceRequestContext(state, context) {
  const nextContext = requestContext(context);
  if (state.stage !== 'draft' || requestDraftKey(nextContext) !== requestDraftKey(state.context)) throw new Error('A new product, model or drawing revision needs its own draft.');
  return { ...copy(state), context: nextContext };
}

export function reviewRequest(state) {
  if (state.stage !== 'draft') throw new Error('Only draft details can enter review.');
  const next = copy(state), errors = {};
  for (const key of ['purpose', 'message', 'name', 'email']) next.values[key] = text(next.values[key]);
  if (!REQUEST_PURPOSES.some(item => item.id === next.values.purpose)) errors.purpose = 'Choose a next step.';
  if (!next.values.message) errors.message = 'Add the question or application you want to discuss.';
  else if (next.values.message.length > 2000) errors.message = 'Keep your message within 2,000 characters.';
  if (next.values.name.length > 120) errors.name = 'Keep the name within 120 characters.';
  if (next.values.email && (next.values.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.values.email))) errors.email = 'Enter a valid email address, or leave it blank for this demo.';
  next.errors = errors;
  if (!Object.keys(errors).length) next.stage = 'review';
  return next;
}

export function editRequest(state) {
  if (state.stage !== 'review') throw new Error('Only a reviewed request can return to details.');
  return { ...copy(state), stage: 'draft', errors: {} };
}

export function confirmRequest(state, receipt) {
  if (state.stage === 'confirmed') return state;
  if (state.stage !== 'review') throw new Error('Review the request before confirming it.');
  if (!text(receipt?.id) || !Number.isFinite(Date.parse(receipt?.createdAt))) throw new TypeError('A demo receipt needs a reference and time.');
  return { ...copy(state), stage: 'confirmed', receipt: { id: text(receipt.id), createdAt: receipt.createdAt, delivery: 'demo-only' } };
}

export const requestDraftKey = context => JSON.stringify([context.productId, context.modelId, context.modelRevision, ...(context.drawing ? [drawingVersionKey(context)] : [])]);

/** Reopening against a different selection must not confirm the older question
 * without showing its restored context in the editable details screen first. */
export function reopenRequest(state, context) {
  const current = requestContext(context);
  if (!state || state.stage === 'confirmed' || requestDraftKey(state.context) !== requestDraftKey(current)) return createRequestDraft(current);
  let next = copy(state);
  if (!next.values.message.trim()) next.context = current;
  else if (next.stage === 'review' && JSON.stringify(next.context) !== JSON.stringify(current)) next = editRequest(next);
  return next;
}
