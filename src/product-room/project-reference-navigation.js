import { sameProjectValue } from './project-domain.js';

const referenceKeys = ['referenceQuote', 'referenceReview', 'referenceEntry'];
const unavailable = () => new Error('This exact reviewed reference is not in the saved project. Return to the quotation and open its reference again.');

/** URLs carry immutable record identities; the actual context comes from saved evidence. */
export function setProjectReferenceIdentity(url, project, context = project.context) {
  if (!project.impactPolicy || !context?.drawing) return url;
  for (const key of [...referenceKeys, 'requestItem']) url.searchParams.delete(key);
  const request = project.inquiry?.requestItems?.find(item => sameProjectValue(item.context, context));
  if (request) { url.searchParams.set('requestItem', request.id); return url; }
  for (const quote of [...project.quotes].reverse()) {
    const entry = quote.impactScope?.entries.find(item => item.context && sameProjectValue(item.context, context));
    if (entry || sameProjectValue(quote.context, context)) {
      url.searchParams.set('referenceQuote', quote.id);
      if (entry) url.searchParams.set('referenceEntry', entry.id);
      return url;
    }
  }
  for (const record of [...project.impactReviews].reverse()) {
    const decision = record.review.decisions.find(item => item.context && sameProjectValue(item.context, context));
    if (decision || sameProjectValue(record.review.context, context)) {
      url.searchParams.set('referenceReview', record.id);
      if (decision) url.searchParams.set('referenceEntry', decision.id);
      return url;
    }
  }
  if (sameProjectValue(project.inquiry.context, context)) return url;
  throw unavailable();
}

export function hasProjectReferenceIdentity(parameters) {
  return referenceKeys.some(key => parameters.has(key));
}

/** Never substitute the current project or original A when a pinned record is missing. */
export function readProjectReferenceContext(project, parameters) {
  if (!hasProjectReferenceIdentity(parameters)) return null;
  if (!project.impactPolicy || referenceKeys.some(key => parameters.getAll(key).length > 1 || parameters.has(key) && !parameters.get(key))
    || parameters.has('requestItem') || parameters.has('followUp')
    || parameters.has('referenceQuote') === parameters.has('referenceReview')) throw unavailable();
  const quoteId = parameters.get('referenceQuote'), reviewId = parameters.get('referenceReview'), entryId = parameters.get('referenceEntry');
  let context;
  if (quoteId) {
    const quote = project.quotes.find(item => item.id === quoteId);
    context = entryId ? quote?.impactScope?.entries.find(item => item.id === entryId)?.context : quote?.context;
  } else if (reviewId) {
    const record = project.impactReviews.find(item => item.id === reviewId);
    context = entryId ? record?.review.decisions.find(item => item.id === entryId)?.context : record?.review.context;
  }
  if (!context?.drawing) throw unavailable();
  return context;
}
