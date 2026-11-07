import { questionState } from './question-domain.js';

/** Any confirmed project change invalidates a pending review, including cross-tab changes. */
export const projectQuestionSourceKey = project => JSON.stringify([project?.id, project?.revision, project?.inquiry?.requestItems, project?.questions, project?.quotes]);

export function projectQuestionSummary(questions = []) {
  const unresolved = questions.filter(question => questionState(question).status !== 'resolved');
  return { total: questions.length, unresolved: unresolved.length, blocking: unresolved.filter(question => question.blocking).length };
}

/** Keep quotations attached to their own request scope and line labels, never a newer draft. */
export function questionQuoteLinks(project, question) {
  return (project?.quotes || []).flatMap(quote => {
    const frozen = quote.questionScope?.questions?.find(item => item.id === question.id && item.requestItemId === question.requestItemId);
    if (!frozen) return [];
    const entry = quote.scopeSelection?.entries?.find(item => item.id === question.scopeEntryId && item.requestItemId === question.requestItemId);
    return [{ quoteId: quote.id, quoteVersion: quote.version, questionStatus: questionState(frozen).status, disposition: entry?.disposition || null, rationale: entry?.rationale || '',
      lines: (entry?.lineIds || []).map(id => ({ id, label: quote.lineItems?.find(line => line.id === id)?.label || 'Unavailable quotation line' })) }];
  });
}

/** Opening text is shown once, even for adapters that carry it only on the question. */
export function questionTimeline(question) {
  const events = question.events || [];
  return events.some(event => event.kind === 'opened') ? events : [{ id: `${question.id}-opening`, kind: 'opened', authorRole: 'buyer', body: question.body, createdAt: question.createdAt }, ...events];
}

export function questionActionLabels(type, role, kind) {
  if (type === 'new') return { edit: 'Ask about a detail', review: 'Review your question', confirm: 'Confirm question', saved: 'Question confirmed.' };
  if (type === 'resolve') return { edit: role === 'buyer' ? 'Confirm the answer resolves this' : 'Resolve this question', review: 'Review resolution', confirm: 'Confirm resolved', saved: 'Question resolved.' };
  if (type === 'reopen') return { edit: 'Reopen this question', review: 'Review reopening', confirm: 'Confirm reopen', saved: 'Question reopened.' };
  return { edit: role === 'seller' ? 'Reply to this question' : 'Reply to the seller', review: kind === 'clarification' ? 'Review clarification request' : 'Review your reply', confirm: kind === 'clarification' ? 'Confirm clarification request' : 'Confirm reply', saved: kind === 'clarification' ? 'Clarification requested.' : 'Reply confirmed.' };
}
