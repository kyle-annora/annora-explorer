import { ProjectError, cloneProjectValue, normalizeProjectContext, sameProjectValue, validInquiryQuantity } from './project-domain.js';
import { pendingProjectChange, pendingClarification, changeTopics, changeIsResolved } from './project-state.js';
export { pendingProjectChange, pendingClarification, changeIsResolved, sellerProjectStatus, changeTopics } from './project-state.js';

import { projectDrawingContext, recordContext } from './drawing-context.js';
import { createQuoteScopeSelection, normalizeQuoteScopeSelection, quoteScopeErrors } from './option-scope-domain.js';
import { createQuestionScope, normalizeQuestionScope, quoteQuestionErrors, assertNoBlockingQuestions } from './question-domain.js';

const text = value => typeof value === 'string' ? value.trim() : '';
const numeric = value => /^\d+(\.\d{1,2})?$/.test(value) && Number.isFinite(+value) && +value <= 100000000;
const cents = value => Math.round((value + Number.EPSILON) * 100) / 100;
const lines = value => text(value).split('\n').map(text).filter(Boolean);
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
const reviewed = payload => ({ ...cloneProjectValue(payload), token: canonical(payload) });
export const quoteProductTitle = project => text(project?.context?.productTitle) || text(project?.context?.part?.title) || 'Product';
const requireProject = project => {
  if (!project?.id || !Number.isSafeInteger(project.revision)) throw new ProjectError('VALIDATION', 'Open a saved customer project first.');
};
const editableQuoteLine = (item, index) => {
  const knownQuantity = Number.isFinite(item.quantity) && item.quantity > 0;
  const unitPrice = item.unitPrice ?? (item.unitPrice === undefined && knownQuantity && Number.isFinite(item.amount) ? item.amount / item.quantity : null);
  return { id: item.id || `line-${index+1}`, label: item.label, quantity: knownQuantity ? String(item.quantity) : '', unitPrice: unitPrice === null ? '' : String(unitPrice) };
};
export function createQuoteDraft(project, id) {
  requireProject(project);
  const quote = project.quotes.at(-1), pending = pendingProjectChange(project);
  const change = project.changes.filter(item => item.quoteId === quote?.id).at(-1) || pending;
  return {
    id, revision: 0, projectId: project.id, projectRevision: project.revision,
    previousQuoteId: quote?.id || null, changeId: change?.id || null,
    ...(project.approvedOptionSet ? {scopeSelection:quote?.scopeSelection ? cloneProjectValue(quote.scopeSelection) : createQuoteScopeSelection(project)} : {}),
    ...(project.questionPolicy ? {questionScope:quote ? cloneProjectValue(quote.questionScope || {version:1,projectRevision:quote.issuedProjectRevision || 1,questions:[]}) : createQuestionScope(project)} : {}),
    ...(project.context.drawing || project.context.inspection ? {context:cloneProjectValue(projectDrawingContext(project))} : {}),
    replyDraft: pending ? {kind:'change-response',body:'',changeId:pending.id,resolutions:changeTopics(pending).map(topic=>({topic,status:'needs-info',response:''}))} : null,
    values: {
      quantity: String(quote?.quantity ?? project.inquiry.values.quantity),
      scope: quote?.scope || project.inquiry.values.application,
      proposedLeadTime: quote?.proposedLeadTime || 'To be confirmed after technical review',
      assumptions: quote?.assumptions.join('\n') || 'Application suitability, load and mounting require engineering review.\nFictional demonstration only; not a manufacturer offer.',
      exclusions: (quote?.exclusions || ['Freight, tax and application-specific engineering remain unpriced.']).join('\n'),
      validity: quote?.validity || 'To be agreed',
      lineItems: quote ? quote.lineItems.map(editableQuoteLine)
        : [{ id: 'assembly', label: `${quoteProductTitle(project)} — illustrative allowance`, quantity: project.inquiry.values.quantity, unitPrice: '' },
          { id: 'setup', label: 'Setup allowance', quantity: '1', unitPrice: '' },
          { id: 'freight', label: 'Freight and applicable tax', quantity: '1', unitPrice: '' }]
    }, updatedAt: null
  };
}
export function normalizeQuoteDraft(input) {
  if (!input || !text(input.id) || !text(input.projectId) || !Number.isSafeInteger(input.revision) || input.revision < 0 || !Number.isSafeInteger(input.projectRevision) || input.projectRevision < 1)
    throw new ProjectError('VALIDATION', 'This quotation draft has no valid identity or revision.');
  const values = Object.fromEntries(['quantity','scope','proposedLeadTime','assumptions','exclusions','validity'].map(key => [key,text(input.values?.[key])]));
  if (Object.values(values).some(value => value.length > 8000)) throw new ProjectError('VALIDATION', 'Keep quotation fields within 8,000 characters.');
  if (!Array.isArray(input.values?.lineItems) || input.values.lineItems.length > 30) throw new ProjectError('VALIDATION', 'Keep the quotation within 30 line items.');
  values.lineItems = input.values.lineItems.map(item => ({ id: text(item.id), label: text(item.label), quantity: text(item.quantity), unitPrice: text(item.unitPrice) }));
  if (values.lineItems.some(item => !item.id || Object.values(item).some(value => value.length > 1000)) || new Set(values.lineItems.map(item => item.id)).size !== values.lineItems.length)
    throw new ProjectError('VALIDATION', 'Each quotation line needs a unique identity and concise details.');
  for (const key of ['previousQuoteId','changeId']) if (input[key] !== null && !text(input[key])) throw new ProjectError('VALIDATION', 'The quotation draft has invalid version references.');
  let replyDraft = null;
  if (input.replyDraft !== undefined && input.replyDraft !== null) {
    if (!Array.isArray(input.replyDraft.resolutions) || input.replyDraft.resolutions.length > 3) throw new ProjectError('VALIDATION','Keep one response per change topic.');
    replyDraft = {kind:text(input.replyDraft.kind),body:text(input.replyDraft.body),changeId:input.replyDraft.changeId || null,resolutions:input.replyDraft.resolutions.map(item=>({topic:text(item.topic),status:text(item.status),response:text(item.response)}))};
    if (replyDraft.body.length > 4000 || replyDraft.resolutions.some(item=>item.response.length > 2000 || !['quantity','timing','notes'].includes(item.topic) || !['accepted','alternative','needs-info'].includes(item.status)) || new Set(replyDraft.resolutions.map(item=>item.topic)).size !== replyDraft.resolutions.length || (replyDraft.changeId !== null && replyDraft.changeId !== input.changeId) || !['reply','clarification','change-response'].includes(replyDraft.kind)) throw new ProjectError('VALIDATION','Check the saved reply draft.');
  }
  return { id:text(input.id), revision:input.revision, projectId:text(input.projectId), projectRevision:input.projectRevision,
    previousQuoteId:input.previousQuoteId,changeId:input.changeId,replyDraft,values,updatedAt:input.updatedAt || null,
    ...(input.context!==undefined ? {context:normalizeProjectContext(input.context)} : {}),
    ...(input.questionScope!==undefined ? {questionScope:normalizeQuestionScope(input.questionScope)} : {}),
    ...(input.scopeSelection!==undefined ? {scopeSelection:normalizeQuoteScopeSelection(input.scopeSelection)} : {}) };
}
export function quoteDraftErrors(input) {
  const {values} = normalizeQuoteDraft(input), fields = {};
  if (!validInquiryQuantity(values.quantity)) fields.quantity = 'Enter a whole quantity from 1 to 100,000 before issuing a quotation.';
  if (!values.scope) fields.scope = 'Describe what this quotation includes.';
  if (!values.proposedLeadTime) fields.proposedLeadTime = 'State the proposed lead time, or say it remains to be confirmed.';
  if (!values.lineItems.length) fields.lineItems = 'Add at least one line item.';
  for (const [index,item] of values.lineItems.entries()) {
    if (!item.label) fields[`lineItems.${index}.label`] = 'Name this item.';
    if (!numeric(item.quantity) || +item.quantity <= 0 || +item.quantity > 100000) fields[`lineItems.${index}.quantity`] = 'Enter a positive quantity up to 100,000.';
    if (item.unitPrice && !numeric(item.unitPrice)) fields[`lineItems.${index}.unitPrice`] = 'Enter a non-negative price with up to two decimal places, or leave it unpriced.';
    if (numeric(item.quantity) && numeric(item.unitPrice) && +item.quantity * +item.unitPrice > 100000000) fields[`lineItems.${index}.unitPrice`] = 'Keep the line amount within 100 million.';
  }
  return fields;
}
export function quoteDraftPreview(input, project) {
  const draft = normalizeQuoteDraft(input), {values} = draft;
  const change = project.changes.find(item => item.id === draft.changeId);
  const lineItems = values.lineItems.map(item => ({ id:item.id,label:item.label,quantity:numeric(item.quantity) ? +item.quantity : null,unitPrice:item.unitPrice && numeric(item.unitPrice) ? +item.unitPrice : null,
    amount:item.unitPrice && numeric(item.unitPrice) && numeric(item.quantity) ? cents(+item.quantity * +item.unitPrice) : null }));
  const requestedWeeks = (change?.values || project.inquiry.values).targetWeeks;
  const existingOpenItems = project.quotes.at(-1)?.openItems || [
    {id:'load-cycle',label:'Confirm application load and required cycle rate.',owner:'Customer / engineering',status:'Open'},
    {id:'mounting',label:'Review mounting interfaces, tolerances and application fit.',owner:'Engineering',status:'Open'},
    ...(project.inquiry.values.notes ? [{id:'customer-notes',label:project.inquiry.values.notes,owner:'Sales / engineering',status:'Unanswered'}] : [])
  ];
  const resolvedQuestions = new Set((project.messages || []).flatMap(message => message.resolutions?.some(item => item.topic === 'notes' && item.status !== 'needs-info') ? [project.changes.find(item => item.id === message.changeId)?.values.notes] : []));
  const openItems = existingOpenItems.filter(item => !item.id.startsWith('unpriced-') && !resolvedQuestions.has(item.label));
  for (const item of lineItems.filter(item => item.amount === null)) if (!openItems.some(existing => existing.label === item.label)) openItems.push({id:`unpriced-${item.id}`,label:item.label,owner:'Sales / customer',status:'Unpriced'});
  return { ...(project.context.drawing || project.context.inspection ? {context:cloneProjectValue(recordContext(project,draft))} : {}),version:project.quotes.length+1,quantity:validInquiryQuantity(values.quantity) ? +values.quantity : null,unitPrice:lineItems[0]?.unitPrice ?? null,currency:'USD',lineItems,
    subtotal:cents(lineItems.reduce((sum,item) => sum+(item.amount ?? 0),0)),total:null,requestedWeeks:requestedWeeks ? +requestedWeeks : null,
    proposedLeadTime:values.proposedLeadTime,scope:values.scope,assumptions:lines(values.assumptions),exclusions:lines(values.exclusions),validity:values.validity,
    openItems,
    ...(draft.scopeSelection ? {scopeSelection:cloneProjectValue(draft.scopeSelection)} : {}),
    ...(draft.questionScope ? {questionScope:cloneProjectValue(draft.questionScope)} : {}),
    previousQuoteId:draft.previousQuoteId,changeId:draft.changeId,replyId:null,source:'seller-demo' };
}
function normalizeReply(project,input) {
  const body = text(input?.body), kind = input?.kind, changeId = input?.changeId || null, fields = {};
  if (!['reply','clarification','change-response'].includes(kind)) fields.kind = 'Choose a reply type.';
  if (!body || body.length > 4000) fields.body = 'Write a message of 1–4,000 characters.';
  const change = changeId && project.changes.find(item => item.id === changeId);
  if (changeId && !change) fields.changeId = 'Choose a change request in this project.';
  if (kind === 'change-response' && !change) fields.changeId = 'Choose the change request to answer.';
  const resolutions = (Array.isArray(input?.resolutions) ? input.resolutions : []).map(item => ({topic:text(item.topic),status:text(item.status),response:text(item.response)}));
  if (resolutions.length && kind !== 'change-response') fields.resolutions = 'Only a change response can resolve requested terms.';
  if (resolutions.length && (!change || resolutions.length > 3 || new Set(resolutions.map(item => item.topic)).size !== resolutions.length || resolutions.some(item => !changeTopics(change).includes(item.topic) || !['accepted','alternative','needs-info'].includes(item.status) || !item.response || item.response.length > 2000))) fields.resolutions = 'Give each requested change one clear outcome and explanation.';
  if (kind === 'change-response' && change && !changeTopics(change).every(topic => resolutions.some(item => item.topic === topic))) fields.resolutions = 'Respond to quantity, timing and any written question.';
  if (Object.keys(fields).length) throw new ProjectError('VALIDATION','Check the reply details.',fields);
  return {kind,body,changeId,resolutions};
}
export function reviewReply(project,input) {
  requireProject(project); const values = normalizeReply(project,input);
  if (['clarification','change-response'].includes(values.kind) && pendingClarification(project)) throw new ProjectError('CONFLICT','Wait for the customer to answer the outstanding question before requesting or resolving further changes.');
  return reviewed({kind:'seller-reply',projectId:project.id,projectRevision:project.revision,values});
}
export function reviewQuote(project,input,optionalReply = null) {
  requireProject(project); const draft = normalizeQuoteDraft(input), fields = {...quoteDraftErrors(draft),...quoteScopeErrors(project,draft),...quoteQuestionErrors(project,draft)};
  if (Object.keys(fields).length) throw new ProjectError('VALIDATION','Check the quotation details.',fields);
  if (draft.revision < 1 || draft.projectId !== project.id || draft.projectRevision !== project.revision || draft.previousQuoteId !== (project.quotes.at(-1)?.id || null)) throw new ProjectError('STALE_REVIEW','Save and review the latest quotation draft before issuing it.');
  if(project.context.drawing&&!sameProjectValue(recordContext(project,draft),projectDrawingContext(project))) throw new ProjectError('DRAWING_REVIEW_REQUIRED','This quotation draft uses an earlier drawing reference. Explicitly review and replace it before issuing a new quotation.');
  if(project.context.inspection&&!project.context.drawing&&!sameProjectValue(draft.context,project.context)) throw new ProjectError('STALE_REVIEW','Keep the saved inquiry view attached to this quotation.');
  const replyInput = optionalReply || draft.replyDraft;
  const reply = replyInput ? normalizeReply(project,replyInput) : null;
  if (pendingClarification(project)) throw new ProjectError('CONFLICT','Wait for the customer clarification before issuing a quotation.');
  const pending = pendingProjectChange(project);
  if (pending) {
    if (draft.changeId !== pending.id || !reply || reply.kind !== 'change-response' || reply.changeId !== pending.id || reply.resolutions.some(item => item.status === 'needs-info')) throw new ProjectError('VALIDATION','Resolve each requested change in the reviewed reply before issuing the new quotation.',{resolutions:'Answer each change, or request clarification first.'});
  }
  return reviewed({kind:'issue-quote',projectId:project.id,projectRevision:project.revision,draft,reply});
}
export function reviewCustomerReply(project,input) {
  requireProject(project); const body = text(input?.body), replyTo = text(input?.replyTo), pending = pendingClarification(project);
  if (!body || body.length > 4000) throw new ProjectError('VALIDATION','Add a reply of 1–4,000 characters.',{body:'Add your answer.'});
  if (!pending || pending.id !== replyTo) throw new ProjectError('STALE_REVIEW','Open the current clarification before replying.');
  return reviewed({kind:'customer-reply',projectId:project.id,projectRevision:project.revision,body,replyTo});
}
export function reviewAcknowledgement(project,input) {
  requireProject(project); const body = text(input?.body), nextStepId = text(input?.nextStepId), step = project.nextSteps.find(item => item.id === nextStepId);
  assertNoBlockingQuestions(project);
  if (!body || body.length > 4000) throw new ProjectError('VALIDATION','Describe the agreed next step in 1–4,000 characters.',{body:'Describe what happens next.'});
  if (!step || step.quoteId !== project.quotes.at(-1)?.id) throw new ProjectError('STALE_REVIEW','Choose a next-step request for the current quotation.');
  if (pendingProjectChange(project) || pendingClarification(project)) throw new ProjectError('CONFLICT','Resolve the outstanding customer questions before confirming the next step.');
  if ((project.messages || []).some(item => item.nextStepId === nextStepId && item.kind === 'next-step-confirmation')) throw new ProjectError('CONFLICT','This next-step request is already confirmed.');
  return reviewed({kind:'acknowledge-next-step',projectId:project.id,projectRevision:project.revision,body,nextStepId});
}
