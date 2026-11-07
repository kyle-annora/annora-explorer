import { projectDrawingContext, recordContext } from '../product-room/drawing-context.js';

/** Presentation only: identify the record being acted on, not the last opened tab. */
export function customerRecordContext({ project, mode, tab, quote, draft, response, review }) {
  if (!project) return { context: null, label: '' };
  if (mode === 'edit' || mode === 'quote-review') {
    const record = mode === 'quote-review' ? review?.draft || draft : draft;
    return {
      context: recordContext(project, record),
      label: `Quotation v${project.quotes.length + 1} · ${mode === 'quote-review' ? 'Review' : 'Draft'}`,
    };
  }
  if (mode === 'reply' || mode === 'reply-review') {
    // Review owns the confirmed request identity even if editing state changes.
    const values = mode === 'reply-review' ? review?.values || response : response;
    const request = project.changes.find(item => item.id === values?.changeId);
    const title = values?.kind === 'clarification' ? 'Clarification'
      : values?.kind === 'change-response' ? 'Change response' : 'Customer response';
    return {
      context: request ? recordContext(project, request) : projectDrawingContext(project),
      label: `${title}${request?.quoteVersion ? ` · Quotation v${request.quoteVersion}` : ''} · ${mode === 'reply-review' ? 'Review' : 'Draft'}`,
    };
  }
  if (mode === 'ack' || mode === 'ack-review') {
    const values = mode === 'ack-review' ? review || response : response;
    const request = project.nextSteps.find(item => item.id === values?.nextStepId);
    return {
      context: request ? recordContext(project, request) : projectDrawingContext(project),
      label: `Next-step confirmation${request?.quoteVersion ? ` · Quotation v${request.quoteVersion}` : ''} · ${mode === 'ack-review' ? 'Review' : 'Draft'}`,
    };
  }
  return {
    context: tab === 'quotation' && quote ? recordContext(project, quote) : project.context,
    label: tab === 'quotation' && quote ? `Quotation v${quote.version}` : tab === 'conversation' ? 'Conversation' : 'Customer inquiry',
  };
}
