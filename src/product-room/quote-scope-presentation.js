import { requestItemPurposeLabel, requestItemTitle } from './request-items.js';
import { optionPreferenceLabel } from './option-scope-domain.js';

/** Display only the frozen choice carried by a quotation, never the project's latest preference. */
export const quoteScopeChoice = selection => optionPreferenceLabel(selection || {});

/** A quote's evidence comes only from its frozen snapshot, including historical events. */
export function quoteScopeQuestions(entry, questionScope) {
  return (questionScope?.questions || []).filter(question => question.scopeEntryId === entry.id);
}

export function quoteQuestionEventLabel(event) {
  return {
    opened: 'Question raised', answer: 'Seller answer', clarification: 'Seller clarification request',
    'buyer-reply': 'Customer reply', resolved: 'Resolution confirmed', reopened: 'Question reopened',
  }[event.kind] || 'Question activity';
}

export function quoteScopeRow(entry, selection, requestItems = [], lineItems = []) {
  const request = requestItems.find(item => item.id === entry.requestItemId);
  const preference = entry.id === 'preference';
  const choice = selection?.optionSet?.options?.find(option => option.id === selection.preference?.optionId);
  const relevantRequests = preference ? (choice?.requestItemIds || []).map(id => requestItems.find(item => item.id === id)).filter(Boolean) : [];
  return {
    title: preference ? quoteScopeChoice(selection) : requestItemTitle({ context: entry.context }),
    kind: preference ? 'Customer preference' : requestItemPurposeLabel(request?.purpose),
    notes: preference ? selection?.preference?.notes || '' : request?.notes || '',
    relevantRequests,
    lines: (entry.lineIds || []).map(id => {
      const line = lineItems.find(item => item.id === id);
      return { id, label: line?.label || (line ? 'Untitled quotation line' : 'Unavailable quotation line'), available: Boolean(line) };
    }),
  };
}

/** Keep exact identity visible without using raw IDs as the primary customer-facing label. */
export function quoteScopeReferenceFacts(context = {}) {
  const drawing = context.drawing;
  return [
    ['Product', context.productTitle],
    ['Component', context.part?.title],
    ['Component ID', context.part?.id],
    ['Model', context.modelId],
    ['Model version', context.modelRevision],
    ['Product version', context.roomSnapshot?.version],
    ['Product release', context.roomReleaseId],
    ['Document', context.document?.title],
    ['Document ID', context.document?.id],
    ['Document version', context.document?.revision],
    ['Drawing', drawing?.title],
    ['Drawing version', drawing?.revisionLabel || drawing?.revision],
    ['Drawing revision ID', drawing?.revisionLabel ? drawing.revision : null],
    ['Source file version', drawing?.assetRevision],
    ['Sheet', drawing?.sheetTitle],
    ['Sheet ID', drawing?.sheetId],
    ['Detail', drawing?.regionLabel],
    ['Detail ID', drawing?.regionId],
    ['Associations', drawing?.mappingRevision],
    ['Overview version', drawing?.presentationRevision],
  ].filter(([, value]) => value !== undefined && value !== null && value !== '');
}
