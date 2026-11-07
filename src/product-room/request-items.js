import { ProjectError, normalizeProjectContext } from './project-domain.js';

/** Independent, revision-pinned questions collected during one product inquiry. */
export const REQUEST_ITEM_LIMIT = 12;
export const REQUEST_ITEM_PURPOSES = Object.freeze([
  Object.freeze({ value: 'question', label: 'Ask a question' }),
  Object.freeze({ value: 'change', label: 'Request a change' }),
  Object.freeze({ value: 'review', label: 'Request technical review' }),
]);
const text = value => typeof value === 'string' ? value.trim() : '';
export const requestItemPurposeLabel = purpose => REQUEST_ITEM_PURPOSES.find(item => item.value === purpose)?.label || 'Question';
export const requestItemTitle = item => item?.context?.drawing?.regionLabel || item?.context?.part?.title || item?.context?.document?.title || item?.context?.chapter?.title || item?.context?.productTitle || 'Product reference';

// A collection may cite different source sheets or drawing revisions, but never
// silently combine unrelated products, geometry revisions or product releases.
export const requestItemCollectionKey = context => JSON.stringify([
  context.productId, context.modelId, context.modelRevision,
  context.roomReleaseId || null, context.inquiryProfileVersion || null,
  ...(context.productRevision ? [{productRevision:context.productRevision}] : []),
]);

export function normalizeRequestItems(input, inquiryContext) {
  if (!Array.isArray(input) || input.length > REQUEST_ITEM_LIMIT)
    throw new ProjectError('VALIDATION', `Keep this inquiry within ${REQUEST_ITEM_LIMIT} referenced requests.`, { requestItems: 'Review the request list.' });
  const items = input.map(item => {
    if (!item || !text(item.id) || text(item.id).length > 128)
      throw new ProjectError('VALIDATION', 'Each request needs its own valid identity.', { requestItems: 'Review the request list.' });
    if (!REQUEST_ITEM_PURPOSES.some(purpose => purpose.value === item.purpose))
      throw new ProjectError('VALIDATION', 'Choose a purpose for each request.', { requestItems: 'Choose a listed purpose.' });
    if (typeof item.notes !== 'string' || item.notes.length > 2000)
      throw new ProjectError('VALIDATION', 'Keep each request within 2,000 characters.', { requestItems: 'Check the request notes.' });
    const context = normalizeProjectContext(item.context);
    if (requestItemCollectionKey(context) !== requestItemCollectionKey(inquiryContext))
      throw new ProjectError('INCOMPATIBLE_CONTEXT', 'This reference belongs to another product, model revision or product release. Your request list is unchanged.');
    return { id: text(item.id), purpose: item.purpose, notes: text(item.notes), context };
  });
  if (new Set(items.map(item => item.id)).size !== items.length)
    throw new ProjectError('VALIDATION', 'Each referenced request needs a unique identity.', { requestItems: 'Review the request list.' });
  return items;
}

export function requestItemErrors(items = []) {
  const missing = items.filter(item => !text(item.notes));
  if (!missing.length) return {};
  return {
    requestItems: 'Describe each referenced request, or remove it before reviewing.',
    ...Object.fromEntries(missing.map(item => [`requestItem-${item.id}`, 'Add what you want to ask, change or review.'])),
  };
}
