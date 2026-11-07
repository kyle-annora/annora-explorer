import { sellerProjectStatus } from './project-state.js';
import { requestContext } from './request-state.js';
import { normalizeInquiryProfile } from './inquiry-profile.js';
import { validHistoricalRoomSnapshot } from './release-snapshot.js';
import { drawingVersionKey, recordContext, drawingVersionLabel } from './drawing-context.js';
import { INQUIRY_INTENTS, INQUIRY_RULES_VERSION, inquiryRequiresQuantity, validInquiryQuantity } from './inquiry-rules.js';
import { normalizeRequestItems, requestItemErrors } from './request-items.js';
import { assertNoBlockingQuestions, questionStatusLabel } from './question-domain.js';
export { INQUIRY_INTENTS, INQUIRY_RULES_VERSION, inquiryRequiresQuantity, validInquiryQuantity, inquiryIntentLabel, inquiryQuantityLabel } from './inquiry-rules.js';

/** Customer-owned project records, independent of presentation and transport. */
export class ProjectError extends Error {
  constructor(code, message, fields = {}) { super(message); this.name = 'ProjectError'; this.code = code; this.fields = fields; }
}
export const cloneProjectValue = value => JSON.parse(JSON.stringify(value));
const text = value => typeof value === 'string' ? value.trim() : '';
const fieldNames = ['name', 'email', 'company', 'application', 'quantity', 'targetWeeks', 'stroke', 'load', 'notes'];
const blankValues = () => Object.fromEntries(fieldNames.map(key => [key, '']));
export const QUOTE_SCOPES = Object.freeze([
  Object.freeze({ value: 'discuss', label: 'Help define scope' }),
  Object.freeze({ value: 'product', label: 'Whole product' }),
  Object.freeze({ value: 'part', label: 'Selected component' })
]);
export function quoteScopeLabel(values, context) {
  if (values?.quoteScope === 'part') return `Selected component${context?.part ? ` · ${context.part.title}` : ''}`;
  return QUOTE_SCOPES.find(item => item.value === values?.quoteScope)?.label || 'Not specified';
}
const id = () => `DRAFT-${globalThis.crypto.randomUUID()}`;
export const projectContextKey = context => JSON.stringify([context.productId, context.modelId, context.modelRevision, context.roomReleaseId || null, context.inquiryProfileVersion || null, ...(context.productRevision ? [{productRevision:context.productRevision}] : []), ...(context.drawing ? [drawingVersionKey(context)] : [])]);

export function normalizeProjectContext(input) {
  let context;
  try { context = requestContext(input); } catch (error) { throw new ProjectError('VALIDATION', error.message); }
  if (!context.modelId || !context.modelRevision) throw new ProjectError('VALIDATION', 'An inquiry needs the exact model and revision.');
  // Legacy records intentionally keep no release attribution. Never assign today's
  // product content or form to an older customer record during normalization.
  if (input.roomReleaseId !== undefined || input.inquiryProfile !== undefined || input.roomSnapshot !== undefined) {
    if (!text(input.roomReleaseId) || !text(input.inquiryProfileVersion)) throw new ProjectError('VALIDATION', 'A versioned inquiry needs its product release and inquiry profile.');
    let profile;
    try { profile = normalizeInquiryProfile(input.inquiryProfile); } catch (error) { throw new ProjectError('VALIDATION', error.message); }
    if (profile.version !== input.inquiryProfileVersion) throw new ProjectError('VALIDATION', 'The inquiry profile does not match its saved version.');
    const snapshot = input.roomSnapshot;
    let snapshotProfile;
    try { snapshotProfile = normalizeInquiryProfile(snapshot?.inquiryProfile); }
    catch { throw new ProjectError('VALIDATION', 'The saved product release has an invalid inquiry profile.'); }
    if (!validHistoricalRoomSnapshot(snapshot,{...context,roomReleaseId:input.roomReleaseId})
        || JSON.stringify(snapshotProfile) !== JSON.stringify(profile) || JSON.stringify(snapshot).length > 200000)
      throw new ProjectError('VALIDATION', 'The saved product release is incomplete or does not match this inquiry.');
    context.roomReleaseId = text(input.roomReleaseId);
    context.inquiryProfileVersion = text(input.inquiryProfileVersion);
    context.inquiryProfile = profile;
    context.roomSnapshot = cloneProjectValue(snapshot);
  }
  if (context.document && input.document.revision !== undefined) {
    if (!text(input.document.revision)) throw new ProjectError('VALIDATION', 'A linked document needs its revision.');
    context.document.revision = text(input.document.revision);
  }
  if (context.document && context.roomSnapshot) {
    const doc = context.roomSnapshot.content.documents.find(item=>item.id===context.document.id);
    if (!doc || doc.revision !== context.document.revision || doc.title !== context.document.title)
      throw new ProjectError('VALIDATION', 'The linked document does not match its saved product version.');
  }
  if (context.drawing && context.roomSnapshot) {
    const doc = context.roomSnapshot.content.documents.find(item => item.id === context.drawing.id);
    if (!doc || doc.title !== context.drawing.title || doc.revision !== context.drawing.revision || doc.assetId !== context.drawing.assetId)
      throw new ProjectError('VALIDATION', 'The drawing does not match its saved product version.');
  }
  return context;
}

export function createInquiryDraft(context, draftId = id()) {
  return { id: draftId, revision: 0, inquiryRulesVersion: INQUIRY_RULES_VERSION, context: normalizeProjectContext(context), values: { ...blankValues(), intent: 'quotation', quoteScope: 'discuss' }, requirements: [], updatedAt: null };
}

/** Normalization is intentionally separate from final review: incomplete drafts can be saved. */
export function normalizeInquiryDraft(input) {
  if (!input || !text(input.id) || !Number.isSafeInteger(input.revision) || input.revision < 0) throw new ProjectError('VALIDATION', 'This draft has no valid identity or revision.');
  const values = Object.fromEntries(fieldNames.map(key => [key, text(input.values?.[key])]));
  if (input.values?.quantity !== undefined && typeof input.values.quantity !== 'string') throw new ProjectError('VALIDATION', 'Quantity must be a whole number or left unknown.', { quantity: 'Enter a whole quantity from 1 to 100,000.' });
  if (Object.hasOwn(input.values || {}, 'intent')) {
    values.intent = text(input.values.intent);
    if (!INQUIRY_INTENTS.some(item => item.value === values.intent)) throw new ProjectError('VALIDATION', 'Choose an inquiry intent.', { intent: 'Choose quotation or application review.' });
  }
  // Choosing an intent on an older draft explicitly adopts these rules. Merely
  // opening historical records never assigns an intent or a rule version.
  const inquiryRulesVersion = input.inquiryRulesVersion ?? (values.intent ? INQUIRY_RULES_VERSION : undefined);
  if (inquiryRulesVersion !== undefined && inquiryRulesVersion !== INQUIRY_RULES_VERSION) throw new ProjectError('VALIDATION', 'This inquiry uses an unsupported rule version.');
  // Older inquiries keep their original shape. A viewed part never supplies scope.
  if (Object.hasOwn(input.values || {}, 'quoteScope')) {
    values.quoteScope = text(input.values.quoteScope);
    if (values.quoteScope && !QUOTE_SCOPES.some(item => item.value === values.quoteScope)) throw new ProjectError('VALIDATION', 'Choose a quotation scope.', { quoteScope: 'Choose a listed scope or leave it open.' });
  }
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
  const context = normalizeProjectContext(input.context);
  // Keep legacy records byte-shape compatible; an explicit list is additive and
  // is never inferred from the currently highlighted component.
  const requestItems = Object.hasOwn(input, 'requestItems') ? { requestItems: normalizeRequestItems(input.requestItems, context) } : {};
  return { id: text(input.id), revision: input.revision, ...(inquiryRulesVersion !== undefined ? { inquiryRulesVersion } : {}), context, values, requirements, ...requestItems, updatedAt: input.updatedAt || null };
}

export function inquiryErrors(draft) {
  const { values, requirements } = draft, fields = {};
  if (values.quoteScope === 'part' && !draft.context.part) fields.quoteScope = 'Attach a component reference or choose another scope.';
  if (!values.application) fields.application = 'Describe the application or question to review.';
  else if (values.application.length > 2000) fields.application = 'Keep the application within 2,000 characters.';
  if ((inquiryRequiresQuantity(values) || values.quantity) && !validInquiryQuantity(values.quantity)) fields.quantity = 'Enter a whole quantity from 1 to 100,000.';
  if (values.targetWeeks && (!/^\d+$/.test(values.targetWeeks) || +values.targetWeeks < 1 || +values.targetWeeks > 104)) fields.targetWeeks = 'Enter 1–104 weeks, or leave it open.';
  if (values.email && (values.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email))) fields.email = 'Enter a valid email, or leave it blank for this demo.';
  if (values.name.length > 120) fields.name = 'Keep the name within 120 characters.';
  if (values.company.length > 160) fields.company = 'Keep the company within 160 characters.';
  if (values.notes.length > 2000) fields.notes = 'Keep the notes within 2,000 characters.';
  if (values.stroke && (!/^\d+(\.\d+)?$/.test(values.stroke) || +values.stroke <= 0 || +values.stroke > 100000)) fields.stroke = 'Enter a positive stroke in millimeters, or leave it open.';
  if (values.load.length > 200) fields.load = 'Keep the load detail within 200 characters.';
  if (requirements.some(item => !item.confirmed)) fields.requirements = 'Confirm each attached requirement, or remove it from the inquiry.';
  return { ...fields, ...requestItemErrors(draft.requestItems) };
}

// Review seals detect accidental edits, not authorization. A real host must validate server-side.
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
export const sameProjectValue = (left, right) => canonical(left) === canonical(right);
function seal(payload) { return canonical(payload); }
export function reviewedProjectValue(payload) { return { ...cloneProjectValue(payload), token: seal(payload) }; }
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
  return reviewedProjectValue({ kind: 'inquiry', draft });
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
  return reviewedProjectValue({ kind: 'revision', projectId: project.id, projectRevision: project.revision, quoteId: quote.id, quoteVersion: quote.version, values, ...(project.context.drawing || project.context.inspection || project.context.viewerReference ? {context:cloneProjectValue(recordContext(project,quote))} : {}) });
}
export function reviewNextStep(project, quoteId, input) {
  const quote = assertCurrentQuote(project, quoteId);
  assertNoBlockingQuestions(project);
  const intent = text(input?.intent), message = text(input?.message), fields = {};
  if (!['discussion', 'engineering-review'].includes(intent)) fields.intent = 'Choose a next step.';
  if (!message) fields.message = 'Add what you would like to discuss or review.';
  else if (message.length > 2000) fields.message = 'Keep the message within 2,000 characters.';
  if (Object.keys(fields).length) throw new ProjectError('VALIDATION', 'Check the next-step request.', fields);
  return reviewedProjectValue({ kind: 'next-step', projectId: project.id, projectRevision: project.revision, quoteId: quote.id, quoteVersion: quote.version, intent, message, ...(project.context.drawing || project.context.inspection || project.context.viewerReference ? {context:cloneProjectValue(recordContext(project,quote))} : {}) });
}

const money = value => value === null ? 'Pending review' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(value);
export function compareQuotes(before, after, project) {
  if (!before || !after) return [];
  const leftContext=project?recordContext(project,before):before.context,rightContext=project?recordContext(project,after):after.context;
  const describeDrawing = context => context?.drawing ? `${context.drawing.title} · ${drawingVersionLabel(context.drawing)} · ${context.drawing.sheetTitle} · ${context.drawing.regionLabel}` : 'Original inquiry reference';
  const rows = [
    ...(leftContext?.drawing || rightContext?.drawing ? [
      ['drawingReference', 'Drawing reference', describeDrawing(leftContext), describeDrawing(rightContext)],
      ['drawingSource', 'Drawing source identity',leftContext?.drawing?.assetRevision || 'Original inquiry reference',rightContext?.drawing?.assetRevision || 'Original inquiry reference'],
      ['drawingMapping', 'Association version',leftContext?.drawing?.mappingRevision || 'Legacy association',rightContext?.drawing?.mappingRevision || 'Legacy association'],
      ...(leftContext?.drawing?.presentationRevision || rightContext?.drawing?.presentationRevision ? [['drawingOverview', 'Overview version', leftContext?.drawing?.presentationRevision || 'Original source view', rightContext?.drawing?.presentationRevision || 'Original source view']] : []),
      ['drawingModel', 'Model version',leftContext?.modelRevision || 'Original inquiry reference',rightContext?.modelRevision || 'Original inquiry reference'],
      ...(leftContext?.drawing?.revisionLabel || rightContext?.drawing?.revisionLabel ? [['drawingVersionId','Drawing version identity',leftContext?.drawing?.revision,rightContext?.drawing?.revision]] : [])
    ] : []),
    ['quantity', 'Quantity', `${before.quantity} units`, `${after.quantity} units`],
    ['unitPrice', 'Unit price', money(before.unitPrice), money(after.unitPrice)],
    ['requestedWeeks', 'Requested timing', before.requestedWeeks === null ? 'To discuss' : `${before.requestedWeeks} weeks`, after.requestedWeeks === null ? 'To discuss' : `${after.requestedWeeks} weeks`],
    ['proposedLeadTime', 'Proposed lead time', before.proposedLeadTime, after.proposedLeadTime],
    ['scope', 'Scope', before.scope, after.scope],
    ['subtotal', 'Priced subtotal', money(before.subtotal), money(after.subtotal)],
    ['total', 'Final total', money(before.total), money(after.total)],
    ['assumptions', 'Assumptions', (before.assumptions || []).join('\n'), (after.assumptions || []).join('\n')],
    ['exclusions', 'Exclusions', (before.exclusions || []).join('\n') || 'Not specified', (after.exclusions || []).join('\n') || 'Not specified'],
    ['validity', 'Validity', before.validity || 'Not specified', after.validity || 'Not specified']
  ];
  const describeLine = item => item ? `${item.label}: ${item.quantity ?? 'To discuss'} × ${money(item.unitPrice ?? null)} · ${money(item.amount)}` : 'Not included';
  const keyFor = (item,index) => item.id || `line-${index+1}`;
  const beforeLines = new Map(before.lineItems.map((item,index) => [keyFor(item,index),item]));
  const afterLines = new Map(after.lineItems.map((item,index) => [keyFor(item,index),item]));
  for (const key of new Set([...beforeLines.keys(), ...afterLines.keys()])) {
    const left = beforeLines.get(key), right = afterLines.get(key);
    rows.push([`line-${key}`, right?.label || left.label, describeLine(left), describeLine(right)]);
  }
  if(before.scopeSelection || after.scopeSelection){
    const describePreference = selection => !selection ? 'Not recorded' : !selection.preference ? 'No preference recorded' : selection.preference.choice==='help-me-decide' ? `Help me decide · preference v${selection.preference.version}` : `${selection.optionSet.options.find(option=>option.id===selection.preference.optionId)?.title || 'Unavailable package'} · preference v${selection.preference.version}`;
    rows.push(['option-preference','Customer preference',describePreference(before.scopeSelection),describePreference(after.scopeSelection),!sameProjectValue(before.scopeSelection?.preference,after.scopeSelection?.preference)]);
    if(before.scopeSelection?.preference?.notes || after.scopeSelection?.preference?.notes)rows.push(['option-preference-note','Preference note',before.scopeSelection?.preference?.notes || 'No note',after.scopeSelection?.preference?.notes || 'No note']);
    const entries = selection => new Map((selection?.entries || []).map(entry=>[entry.id,entry]));
    const left=entries(before.scopeSelection),right=entries(after.scopeSelection);
    const describe = (entry,quote) => !entry ? 'Not recorded' : `${entry.disposition.replaceAll('-',' ')}${entry.lineIds.length ? ' · '+entry.lineIds.map(id=>quote.lineItems.find(line=>line.id===id)?.label || id).join(', ') : ''}${entry.rationale ? ' · '+entry.rationale : ''}`;
    for(const id of new Set([...left.keys(),...right.keys()])){
      const entry=right.get(id)||left.get(id);
      rows.push([`scope-${id}`,id==='preference'?'Preferred package scope':entry.context.part?.title || 'Requested detail',describe(left.get(id),before),describe(right.get(id),after),!sameProjectValue(left.get(id),right.get(id))]);
    }
  }
  if (before.questionScope || after.questionScope) {
    const left = new Map((before.questionScope?.questions || []).map(question => [question.id,question]));
    const right = new Map((after.questionScope?.questions || []).map(question => [question.id,question]));
    const describe = question => {
      if (!question) return 'Not in this quotation';
      const latest=question.events.at(-1);
      const resolution=latest.kind === 'resolved' ? ` · ${latest.authorRole === 'buyer' ? 'Buyer acknowledged' : 'Seller confirmed'}` : '';
      return `${questionStatusLabel(question)}${resolution} · ${question.blocking ? 'Scope-affecting' : 'Informational'} · ${latest.body}`;
    };
    for (const id of new Set([...left.keys(),...right.keys()])) {
      const question=right.get(id) || left.get(id);
      rows.push([`question-${id}`,`Question · ${question.context.part?.title || 'Requested detail'} · ${question.body}`,describe(left.get(id)),describe(right.get(id)),!sameProjectValue(left.get(id),right.get(id))]);
    }
  }
  if (before.impactScope || after.impactScope) {
    const left=new Map((before.impactScope?.entries || []).map(entry=>[entry.id,entry]));
    const right=new Map((after.impactScope?.entries || []).map(entry=>[entry.id,entry]));
    const describe=(entry,quote,fallback)=>!entry ? `Original reference · ${describeDrawing(fallback)}` : `${entry.decision === 'omitted' ? 'Excluded from quoted scope' : `${entry.decision === 'retained' ? 'Original source retained' : 'Reviewed source adopted'} · ${describeDrawing(entry.context)}`}${entry.lineIds.length ? ' · '+entry.lineIds.map(id=>quote.lineItems.find(line=>line.id===id)?.label || id).join(', ') : ''} · ${entry.reason}`;
    for (const id of new Set([...left.keys(),...right.keys()])) {
      const entry=right.get(id)||left.get(id);
      rows.push([`impact-${id}`,`${entry.kind==='question'?'Question reference':'Scope reference'} · ${entry.label}`,describe(left.get(id),before,entry.originalContext),describe(right.get(id),after,entry.originalContext),!sameProjectValue(left.get(id),right.get(id))]);
    }
  }
  return rows.map(([key, label, left, right, changed]) => ({ key, label, before: left, after: right, changed: changed ?? left !== right }));
}

export function projectStatus(project) {
  const status = sellerProjectStatus(project);
  const owner = status.owner === 'Seller' ? 'Supplier' : 'You';
  const label = status.label === 'New inquiry' ? 'Inquiry saved' : status.label;
  const next = status.label === 'New inquiry' ? 'Awaiting supplier review'
    : status.label === 'Quotation ready' ? 'Review the quotation'
    : status.label === 'Revised quotation' ? 'Review the changed terms'
    : status.label === 'Changes requested' ? 'Supplier reply pending'
    : status.label === 'Next step requested' ? 'Supplier to review the request'
    : status.label === 'Information requested' ? 'Answer the supplier question'
    : status.label === 'Customer replied' ? 'Supplier to review your response'
    : status.label === 'Preference needed' ? 'Compare the approaches and confirm your preference'
    : status.label === 'Preference confirmed' ? 'Supplier to review your preference and quotation scope'
    : status.next;
  return { label, next, owner };
}
