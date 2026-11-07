/** Read-only, allowlisted evidence derived from a validated, persisted project.
 * This is not an activity tracker or a claim of customer interest/conversion.
 * Hosts supply provenance from the storage namespace, never from the viewing role.
 */
export const EVIDENCE_SCHEMA_VERSION = 1;
export const EVIDENCE_EVENT_LIMIT = 120;
export const EVIDENCE_OBSERVATION_TYPES = Object.freeze(['reference.requested', 'reference.opened', 'quotation.opened', 'inquiry.reviewed']);
export const EVIDENCE_EVENT_LABELS = Object.freeze({
  'inquiry.confirmed': 'Inquiry confirmed',
  'question.opened': 'Question opened',
  'question.answered': 'Question answered',
  'question.clarification-requested': 'Question clarification requested',
  'question.buyer-replied': 'Question reply confirmed',
  'question.resolved': 'Question resolution confirmed',
  'question.reopened': 'Question reopened',
  'preference.confirmed': 'Preference confirmed',
  'quotation.issued': 'Quotation issued',
  'quotation.sample-created': 'Sample quotation created',
  'change.requested': 'Quotation change requested',
  'reply.recorded': 'Reply confirmed',
  'clarification.requested': 'Clarification requested',
  'customer.replied': 'Customer reply confirmed',
  'next-step.requested': 'Next step requested',
  'next-step.acknowledged': 'Next step acknowledged',
  'drawing-impact.confirmed': 'Drawing impact confirmed',
  'drawing-reference.adopted': 'Drawing reference adopted',
  'reference.requested': 'Saved reference requested',
  'reference.opened': 'Reference opened',
  'quotation.opened': 'Quotation opened',
  'inquiry.reviewed': 'Inquiry review opened'
});
const modes = ['demo', 'presenter', 'ordinary', 'unknown'];
const roles = ['buyer', 'seller', 'system', 'unknown'];
const token = value => typeof value === 'string' && value.length > 0 && value.length <= 320
  && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value) ? value : null;
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)) ? value : null;
const positive = value => Number.isSafeInteger(value) && value > 0;
const modeOf = value => modes.includes(value) ? value : 'unknown';
const roleOf = value => roles.includes(value) ? value : 'unknown';
const sourceKeys = ['productId', 'modelId', 'modelRevision', 'roomReleaseId', 'partId', 'documentId', 'documentRevision', 'drawingId', 'drawingRevision', 'drawingAssetId', 'drawingAssetRevision', 'mappingRevision', 'overviewRevision', 'sheetId', 'regionId'];
const recordKinds = ['inquiry', 'question', 'preference', 'quotation', 'change', 'message', 'next-step', 'impact', 'drawing-adoption', 'reference'];

function sourceEnvelope(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const source = {};
  for (const key of sourceKeys) if (token(input[key])) source[key] = input[key];
  return source.modelId && source.modelRevision ? source : null;
}

/** Titles, source URLs, snapshots, geometry and camera state never enter evidence. */
export function safeEvidenceSource(context) {
  if (!context || typeof context !== 'object') return null;
  return sourceEnvelope({
    productId: context.productId, modelId: context.modelId, modelRevision: context.modelRevision,
    roomReleaseId: context.roomReleaseId, partId: context.part?.id,
    documentId: context.document?.id, documentRevision: context.document?.revision,
    drawingId: context.drawing?.id, drawingRevision: context.drawing?.revision,
    drawingAssetId: context.drawing?.assetId, drawingAssetRevision: context.drawing?.assetRevision,
    mappingRevision: context.drawing?.mappingRevision, overviewRevision: context.drawing?.presentationRevision,
    sheetId: context.drawing?.sheetId, regionId: context.drawing?.regionId
  });
}
function recordEnvelope(input) {
  if (!input || !recordKinds.includes(input.kind) || !token(input.id)) return null;
  const result = {kind: input.kind, id: input.id};
  for (const key of ['questionId', 'quoteId']) if (token(input[key])) result[key] = input[key];
  if (positive(input.quoteVersion)) result.quoteVersion = input.quoteVersion;
  return result;
}

/** Optional telemetry has its own identity/stream and can never become a business fact. */
export function normalizeEvidenceObservation(input) {
  if (!input || (input.schemaVersion !== undefined && input.schemaVersion !== EVIDENCE_SCHEMA_VERSION)
      || (input.stream !== undefined && input.stream !== 'observation') || !EVIDENCE_OBSERVATION_TYPES.includes(input.type)
      || !token(input.projectId) || !token(input.sessionId) || !token(input.operationId)
      || !date(input.occurredAt) || !modes.includes(input.mode) || !roles.includes(input.role)) return null;
  const source = sourceEnvelope(input.source), record = input.record === undefined ? null : recordEnvelope(input.record);
  if (!source || (input.record !== undefined && !record)
      || (input.projectRevision !== undefined && !positive(input.projectRevision))) return null;
  return {
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    id: `observation:${input.sessionId.length}:${input.sessionId}:${input.operationId.length}:${input.operationId}`,
    type: input.type, stream: 'observation', role: input.role, mode: input.mode,
    occurredAt: input.occurredAt, projectId: input.projectId,
    ...(input.projectRevision !== undefined ? {projectRevision: input.projectRevision} : {}),
    sessionId: input.sessionId, operationId: input.operationId, source,
    ...(record ? {record} : {})
  };
}

const questionTypes = Object.freeze({opened: 'question.opened', answer: 'question.answered', clarification: 'question.clarification-requested', 'buyer-reply': 'question.buyer-replied', resolved: 'question.resolved', reopened: 'question.reopened'});
const messageTypes = Object.freeze({reply: 'reply.recorded', clarification: 'clarification.requested', 'change-response': 'reply.recorded', 'customer-reply': 'customer.replied', 'next-step-confirmation': 'next-step.acknowledged'});
const emptySummary = () => ({questionCount: null, resolvedQuestions: null, pendingBlockingQuestions: null, latestQuoteVersion: null, lastAction: null,
  availableDenominators: {savedProjects: null, questions: null, issuedQuotations: null, viewingSessions: null}});

/** Consumers must read via the project repository first. A draft or UI review is
 * deliberately insufficient. No mutation hook, parallel ledger or review token is used.
 */
export function projectEvidence(project, {mode = 'unknown', limit = EVIDENCE_EVENT_LIMIT} = {}) {
  const result = {schemaVersion: EVIDENCE_SCHEMA_VERSION, projectId: token(project?.id), projectRevision: positive(project?.revision) ? project.revision : null,
    mode: modeOf(mode), events: [], counts: {available: 0, total: null, byType: {}},
    coverage: {history: 'unavailable', omittedCount: 0, invalidRecordCount: 0, missing: []}, summary: emptySummary()};
  if (!result.projectId || !result.projectRevision || !project?.inquiry || !token(project.inquiry.id) || !date(project.inquiry.createdAt)) {
    result.coverage.missing.push('saved-project-unavailable'); return result;
  }
  const events = new Map(), conflicting = new Set(), missing = new Set(); let invalid = 0, scanned = 0;
  const MAX_RECORDS = 5000;
  const add = (type, record, role, context, revision) => {
    if (++scanned > MAX_RECORDS) { missing.add('record-limit'); return; }
    if (!EVIDENCE_EVENT_LABELS[type] || !token(record?.id) || !date(record?.createdAt)
        || (revision !== undefined && (!positive(revision) || revision > project.revision))) { invalid++; return; }
    const reference = recordEnvelope(record.reference);
    if (!reference) { invalid++; return; }
    const source = safeEvidenceSource(context);
    if (!source) missing.add('source-unavailable');
    const event = {schemaVersion: EVIDENCE_SCHEMA_VERSION, id: `${type}:${record.id}`, type, stream: 'confirmed', role: roleOf(role), mode: result.mode,
      occurredAt: record.createdAt, projectId: project.id, ...(revision !== undefined ? {projectRevision: revision} : {}), source, record: reference};
    if (conflicting.has(event.id)) { invalid++; return; }
    const before = events.get(event.id);
    if (before && JSON.stringify(before) !== JSON.stringify(event)) { invalid++; missing.add('conflicting-operation'); conflicting.add(event.id); events.delete(event.id); return; }
    events.set(event.id, event);
  };
  const rows = (key, required = false) => {
    if (project[key] === undefined && !required) return [];
    if (!Array.isArray(project[key])) { missing.add(`${key}-unavailable`); return []; }
    if (project[key].length > MAX_RECORDS) missing.add('record-limit');
    return project[key].slice(0, MAX_RECORDS);
  };
  add('inquiry.confirmed', {...project.inquiry, reference: {kind: 'inquiry', id: project.inquiry.id}}, 'buyer', project.context, 1);
  const questions = rows('questions');
  let validQuestions = Array.isArray(project.questions) && project.questions.length <= 24;
  for (const question of questions) {
    if (!token(question?.id) || !Array.isArray(question.events) || !question.events.length || question.events.length > 60) { invalid++; validQuestions = false; continue; }
    for (const event of question.events) {
      if (!questionTypes[event?.kind] || !token(event?.id) || !date(event?.createdAt) || !positive(event?.projectRevision) || event.projectRevision > project.revision) { invalid++; validQuestions = false; continue; }
      add(questionTypes[event.kind], {...event, reference: {kind: 'question', id: event.id, questionId: question.id}}, event.authorRole, question.context, event.projectRevision);
    }
  }
  for (const preference of rows('optionPreferences')) add('preference.confirmed', {...preference, reference: {kind: 'preference', id: preference.id}}, 'buyer', preference.context || project.context, preference.projectRevision);
  const quotes = rows('quotes', true);
  const validQuotes = Array.isArray(project.quotes) && quotes.every(quote => token(quote?.id) && date(quote?.createdAt) && ['seller-demo', 'sample'].includes(quote?.source) && positive(quote.version));
  for (const quote of quotes) {
    if (!['seller-demo', 'sample'].includes(quote?.source) || !positive(quote.version)) { invalid++; continue; }
    add(quote.source === 'sample' ? 'quotation.sample-created' : 'quotation.issued', {...quote, reference: {kind: 'quotation', id: quote.id, quoteId: quote.id, quoteVersion: quote.version}}, quote.source === 'sample' ? 'system' : 'seller', quote.context || project.context, quote.issuedProjectRevision);
  }
  for (const change of rows('changes', true)) add('change.requested', {...change, reference: {kind: 'change', id: change.id, quoteId: change.quoteId, quoteVersion: change.quoteVersion}}, 'buyer', change.context || project.context, change.projectRevision);
  for (const reply of rows('replies', true)) add('reply.recorded', {...reply, reference: {kind: 'message', id: reply.id, quoteId: reply.quoteId, quoteVersion: reply.quoteVersion}}, reply.source === 'sample' ? 'system' : 'seller', reply.context || project.context, reply.projectRevision);
  for (const message of rows('messages', true)) add(messageTypes[message?.kind], {...message, reference: {kind: 'message', id: message.id}}, message.authorRole, message.context || project.context, message.projectRevision);
  for (const step of rows('nextSteps', true)) add('next-step.requested', {...step, reference: {kind: 'next-step', id: step.id, quoteId: step.quoteId, quoteVersion: step.quoteVersion}}, 'buyer', step.context || project.context, step.projectRevision);
  const impacts = rows('impactReviews');
  for (const impact of impacts) add('drawing-impact.confirmed', {...impact, reference: {kind: 'impact', id: impact.id}}, 'seller', impact.review?.context, impact.projectRevision);
  for (const adoption of rows('drawingRevisions')) {
    // One manual impact confirmation also updates the primary drawing reference.
    // Represent the saved operation once, not as two conversions.
    if (impacts.some(impact => impact.projectRevision === adoption.projectRevision)) continue;
    add('drawing-reference.adopted', {...adoption, reference: {kind: 'drawing-adoption', id: adoption.id}}, 'seller', adoption.context, adoption.projectRevision);
  }
  const all = [...events.values()].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt) || (b.projectRevision || 0) - (a.projectRevision || 0) || a.id.localeCompare(b.id));
  const pageLimit = Number.isInteger(limit) ? Math.max(1, Math.min(limit, 200)) : EVIDENCE_EVENT_LIMIT;
  result.events = all.slice(0, pageLimit);
  result.counts.available = all.length;
  result.counts.total = invalid || missing.size ? null : all.length;
  for (const event of all) result.counts.byType[event.type] = (result.counts.byType[event.type] || 0) + 1;
  result.coverage = {history: invalid || missing.size ? 'partial' : 'available', omittedCount: all.length - result.events.length, invalidRecordCount: invalid, missing: [...missing]};
  const resolved = validQuestions ? questions.filter(question => question.events.at(-1).kind === 'resolved').length : null;
  result.summary = {
    questionCount: validQuestions ? questions.length : null,
    resolvedQuestions: resolved,
    pendingBlockingQuestions: validQuestions ? questions.filter(question => question.blocking && question.events.at(-1).kind !== 'resolved').length : null,
    latestQuoteVersion: validQuotes ? Math.max(0, ...quotes.map(quote => quote.version)) : null,
    lastAction: all[0] || null,
    availableDenominators: {savedProjects: 1, questions: validQuestions ? questions.length : null,
      issuedQuotations: validQuotes ? all.filter(event => event.type === 'quotation.issued').length : null, viewingSessions: null}
  };
  return result;
}
