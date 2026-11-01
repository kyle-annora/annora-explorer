/** Shared, presentation-independent ownership and resolution rules. */
export function changeTopics(change) {
  return ['quantity', 'timing', ...(change.values.notes ? ['notes'] : [])];
}
export function changeIsResolved(project, changeId) {
  if (project.replies?.some(reply => reply.changeId === changeId)) return true; // Preserve legacy fixture behavior.
  const change = project.changes.find(item => item.id === changeId);
  if (!change) return false;
  const responses = new Map();
  for (const message of project.messages || []) {
    if (message.authorRole !== 'seller' || message.kind !== 'change-response' || message.changeId !== changeId) continue;
    for (const response of message.resolutions || []) responses.set(response.topic, response);
  }
  return changeTopics(change).every(topic => responses.has(topic) && responses.get(topic).status !== 'needs-info');
}
export function pendingProjectChange(project) {
  return project.changes.filter(change => !changeIsResolved(project, change.id)).at(-1) || null;
}
export function pendingClarification(project) {
  return (project.messages || []).filter(message => (message.kind === 'clarification' || (message.kind === 'change-response' && message.resolutions?.some(item => item.status === 'needs-info')))
    && !(project.messages || []).some(reply => reply.replyTo === message.id && reply.authorRole === 'buyer')).at(-1) || null;
}
export function sellerProjectStatus(project) {
  const quote = project.quotes.at(-1), messages = project.messages || [];
  if (pendingClarification(project)) return { label: 'Information requested', next: 'Customer to answer the question', owner: 'Customer', filter: 'waiting' };
  if (pendingProjectChange(project)) return { label: 'Changes requested', next: 'Review and respond to requested changes', owner: 'Seller', filter: 'attention' };
  const lastMessage = messages.at(-1);
  const messageAfterQuote = lastMessage && (!quote || (lastMessage.projectRevision && quote.issuedProjectRevision ? lastMessage.projectRevision > quote.issuedProjectRevision : lastMessage.createdAt > quote.createdAt));
  if (lastMessage?.authorRole === 'buyer' && messageAfterQuote) return { label: 'Customer replied', next: 'Review the customer response', owner: 'Seller', filter: 'attention' };
  const step = project.nextSteps.filter(item => item.quoteId === quote?.id).at(-1);
  if (step) {
    const acknowledged = messages.some(item => item.kind === 'next-step-confirmation' && item.nextStepId === step.id);
    return acknowledged ? { label: 'Next step confirmed', next: 'Continue the agreed discussion', owner: 'Customer', filter: 'waiting' }
      : { label: 'Next step requested', next: 'Confirm the requested next step', owner: 'Seller', filter: 'attention' };
  }
  if (project.quoteDraft) return { label: 'Quotation draft', next: 'Continue preparing the quotation', owner: 'Seller', filter: 'attention' };
  if (quote) return { label: quote.version > 1 ? 'Revised quotation' : 'Quotation ready', next: 'Customer to review the quotation', owner: 'Customer', filter: 'waiting' };
  return { label: 'New inquiry', next: 'Review the inquiry and prepare a quotation', owner: 'Seller', filter: 'attention' };
}
