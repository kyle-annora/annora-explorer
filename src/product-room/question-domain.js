import { ProjectError, cloneProjectValue as copy, sameProjectValue as same, normalizeProjectContext, reviewedProjectValue, assertReview } from './project-domain.js';

const text = value => typeof value === 'string' ? value.trim() : '';
const fail = (message, fields = {}) => { throw new ProjectError('VALIDATION', message, fields); };
const validDate = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const positive = value => Number.isSafeInteger(value) && value > 0;
const roles = ['buyer', 'seller'];
const kinds = ['opened', 'answer', 'clarification', 'buyer-reply', 'resolved', 'reopened'];
const requireProject = project => { if (!project?.id || !positive(project.revision)) fail('Open a saved customer project first.'); };
const requireBody = body => {
  const value = text(body);
  if (!value || value.length > 4000) fail('Write a question, reply or explanation of 1–4,000 characters.', {body:'Enter a concise explanation before reviewing.'});
  return value;
};

/** A reply never implies acceptance. Only an explicit reviewed resolution closes a thread. */
export function questionState(question) {
  const kind = question?.events?.at(-1)?.kind;
  const status = ({opened:'open',answer:'answered',clarification:'waiting-on-buyer','buyer-reply':'waiting-on-seller',resolved:'resolved',reopened:'open'})[kind] || 'open';
  return {status,ownerRole:status === 'resolved' ? null : status === 'waiting-on-buyer' ? 'buyer' : 'seller'};
}
export function questionStatusLabel(question) {
  const status = typeof question === 'string' ? question : question?.status || questionState(question).status;
  return ({open:'Open','waiting-on-buyer':'Waiting on buyer','waiting-on-seller':'Waiting on seller',answered:'Answered',resolved:'Resolved'})[status] || 'Open';
}
export const pendingBlockingQuestions = project => (project?.questions || []).filter(question => question.blocking && questionState(question).status !== 'resolved');
export function assertNoBlockingQuestions(project) {
  if (pendingBlockingQuestions(project).length) throw new ProjectError('CONFLICT','Resolve the scope-affecting questions through explicit review before confirming a next step.');
}

export function reviewQuestion(project, input) {
  requireProject(project);
  if (input?.authorRole !== undefined && input.authorRole !== 'buyer') fail('Only the buyer can open a new question.');
  if ((project.questions || []).length >= 24) fail('Keep this demonstration within 24 independent questions.');
  const requestItem = project.inquiry?.requestItems?.find(item => item.id === input?.requestItemId);
  if (!requestItem) fail('Choose an original requested detail in this project.', {requestItemId:'Choose the saved component or view this question concerns.'});
  if (typeof input.blocking !== 'boolean') fail('State whether this question affects quotation scope.', {blocking:'Choose whether this question blocks a quotation.'});
  return reviewedProjectValue({kind:'question-add',projectId:project.id,projectRevision:project.revision,
    requestItemId:requestItem.id,requestItem:copy(requestItem),context:copy(requestItem.context),
    body:requireBody(input.body),blocking:input.blocking,scopeEntryId:`request:${requestItem.id}`,authorRole:'buyer'});
}

function reviewEvent(project, input, kind, action) {
  requireProject(project);
  const question = project.questions?.find(item => item.id === input?.questionId);
  if (!question) fail('Choose a saved question in this project.', {questionId:'Reopen the question before continuing.'});
  if (question.events.length >= 60) fail('This demonstration keeps up to 60 events per question.');
  const authorRole = input.authorRole;
  if (!roles.includes(authorRole)) fail('Choose the buyer or seller role for this action.');
  const state = questionState(question).status;
  if (kind === 'question-reply') {
    if (state === 'resolved') throw new ProjectError('CONFLICT','Reopen this resolved question before adding another reply.');
    if (authorRole === 'seller' ? !['answer','clarification'].includes(action) : action !== 'buyer-reply' || state !== 'waiting-on-buyer')
      fail('The reply must match this question’s current owner and action.');
  } else if (kind === 'question-resolution') {
    if (state !== 'answered') throw new ProjectError('CONFLICT','Answer this question before reviewing its resolution. An answer alone does not resolve it.');
  } else if (state !== 'resolved') throw new ProjectError('CONFLICT','Only a resolved question can be reopened.');
  return reviewedProjectValue({kind,projectId:project.id,projectRevision:project.revision,questionId:question.id,
    questionRevision:question.events.length,requestItemId:question.requestItemId,context:copy(question.context),
    scopeEntryId:question.scopeEntryId,action,authorRole,body:requireBody(input.body)});
}
export const reviewQuestionReply = (project,input) => reviewEvent(project,input,'question-reply',input?.kind || input?.action);
export const reviewQuestionResolution = (project,input) => reviewEvent(project,input,'question-resolution','resolved');
export const reviewQuestionReopen = (project,input) => reviewEvent(project,input,'question-reopen','reopened');

function questionsAtRevision(project, revision) {
  return (project.questions || []).filter(question => question.events[0].projectRevision <= revision).map(question => ({
    ...copy(question),events:copy(question.events.filter(event => event.projectRevision <= revision))
  }));
}
export function createQuestionScope(project) {
  return project.questionPolicy ? {version:1,projectRevision:project.revision,questions:copy(project.questions)} : undefined;
}
export function adoptCurrentQuestions(project, draft) {
  requireProject(project);
  if (draft?.projectId !== project.id) fail('Question evidence must belong to this quotation project.');
  if (!project.questionPolicy) throw new ProjectError('UNSUPPORTED_QUESTIONS','This project has no reviewed question threads.');
  return {...copy(draft),projectRevision:project.revision,questionScope:createQuestionScope(project)};
}
export function normalizeQuestionScope(input) {
  if (!input || input.version !== 1 || !positive(input.projectRevision) || !Array.isArray(input.questions) || input.questions.length > 24)
    fail('Keep the quotation’s question evidence attached to its reviewed project revision.');
  for (const question of input.questions) {
    if (!text(question.id) || !text(question.projectId) || !text(question.requestItemId) || !text(question.body) || question.body.length > 4000
        || typeof question.blocking !== 'boolean' || question.scopeEntryId !== `request:${question.requestItemId}` || !validDate(question.createdAt)
        || !question.requestItem || !Array.isArray(question.events) || !question.events.length || question.events.length > 60
        || !same(normalizeProjectContext(question.context),question.context)) fail('A question snapshot lost its original context or history.');
  }
  if (new Set(input.questions.map(question => question.id)).size !== input.questions.length) fail('Each quotation question needs a distinct identity.');
  return {version:1,projectRevision:input.projectRevision,questions:copy(input.questions)};
}
export function quoteQuestionErrors(project, draft, {current=true,requireResolved=true} = {}) {
  if (!project.questionPolicy && !draft.questionScope) return {};
  if (!project.questionPolicy || !draft.questionScope) return {questionScope:'Review and explicitly adopt the question evidence before saving or issuing this quotation.'};
  let snapshot;
  try { snapshot = normalizeQuestionScope(draft.questionScope); } catch(error) { return {questionScope:error.message}; }
  if (snapshot.projectRevision > project.revision || !same(snapshot.questions,questionsAtRevision(project,snapshot.projectRevision)))
    return {questionScope:'The quotation question evidence does not match the exact saved history.'};
  if (current && !same(snapshot.questions,project.questions)) return {questionScope:'Review and explicitly adopt the latest question evidence before issuing this quotation.'};
  const fields = {};
  for (const question of snapshot.questions) {
    if (project.approvedOptionSet && !draft.scopeSelection?.entries?.some(entry => entry.id === question.scopeEntryId && entry.requestItemId === question.requestItemId && same(entry.context,question.context)))
      fields[`questionScope.${question.id}`] = 'Keep this question linked to the matching original request scope entry.';
    else if (requireResolved && question.blocking && questionState(question).status !== 'resolved')
      fields[`questionScope.${question.id}`] = 'This scope-affecting question needs an explicit reviewed resolution before issue.';
  }
  return fields;
}
export function assertQuestionScopeSource(project,draft) {
  const fields = quoteQuestionErrors(project,draft,{requireResolved:false});
  if (Object.keys(fields).length) throw new ProjectError('QUESTION_REVIEW_REQUIRED',Object.values(fields)[0],fields);
}

/** Replay reviewed events and exact historical quote cutoffs; a read never writes a migration. */
export function validateQuestionsProject(project,drafts=[]) {
  if (!project.questionPolicy) {
    if (Object.hasOwn(project,'questions') || Object.hasOwn(project,'questionEventIndex') || project.quotes.some(quote => quote.questionScope) || drafts.some(draft => draft.questionScope)) fail('Question history has no opt-in policy.');
    return;
  }
  if (!same(project.questionPolicy,{version:1}) || !Array.isArray(project.questions) || !project.questions.length || project.questions.length > 24) fail('The saved question policy or history is invalid.');
  const replay = {...project,questions:[]}, events = [], questionIds = new Set(), eventIds = new Set(), revisions = new Set(), tokens = new Set();
  for (const question of project.questions) {
    if (questionIds.has(question.id)) fail('Question identities must be unique.');
    questionIds.add(question.id);
    if (!Array.isArray(question.events) || !question.events.length || question.events.length > 60) fail('Question history is incomplete.');
    let previousRevision = 0;
    for (const [index,event] of question.events.entries()) {
      if (!text(event.id) || eventIds.has(event.id) || tokens.has(event.reviewToken) || event.questionId !== question.id || event.version !== index + 1
          || !positive(event.projectRevision) || event.projectRevision <= 1 || event.projectRevision > project.revision || event.projectRevision <= previousRevision
          || revisions.has(event.projectRevision) || !validDate(event.createdAt) || !roles.includes(event.authorRole) || !kinds.includes(event.kind)) fail('Question events have invalid identity, order or provenance.');
      previousRevision=event.projectRevision;eventIds.add(event.id);revisions.add(event.projectRevision);tokens.add(event.reviewToken);events.push({question,event});
    }
  }
  events.sort((a,b) => a.event.projectRevision - b.event.projectRevision);
  if (!same(project.questionEventIndex,events.map(({event}) => ({id:event.id,questionId:event.questionId,projectRevision:event.projectRevision})))) fail('The question history index identifies missing or changed events.');
  for (const {question,event} of events) {
    replay.revision = event.projectRevision - 1;
    const kind = event.kind === 'opened' ? 'question-add' : event.kind === 'resolved' ? 'question-resolution' : event.kind === 'reopened' ? 'question-reopen' : 'question-reply';
    const packet = assertReview({...JSON.parse(event.reviewToken),token:event.reviewToken},kind);
    const reviewer = ({'question-add':reviewQuestion,'question-reply':reviewQuestionReply,'question-resolution':reviewQuestionResolution,'question-reopen':reviewQuestionReopen})[kind];
    const expected = reviewer(replay,{...packet,kind:packet.action});
    if (!same(expected,{...packet,token:event.reviewToken}) || packet.projectRevision + 1 !== event.projectRevision
        || packet.authorRole !== event.authorRole || packet.body !== event.body || (packet.action || 'opened') !== event.kind) fail('A question event changed after review.');
    const expectedEvent = {id:event.id,questionId:question.id,version:event.version,kind:event.kind,authorRole:packet.authorRole,body:packet.body,
      projectRevision:event.projectRevision,createdAt:event.createdAt,reviewToken:event.reviewToken};
    if (!same(expectedEvent,event)) fail('A question event has unexpected or missing fields.');
    if (event.kind === 'opened') {
      const expectedQuestion = {id:question.id,projectId:project.id,requestItemId:packet.requestItemId,requestItem:copy(packet.requestItem),context:copy(packet.context),
        body:packet.body,blocking:packet.blocking,scopeEntryId:packet.scopeEntryId,createdAt:event.createdAt,events:[copy(event)]};
      if (!text(question.id) || question.projectId !== project.id || !same({...question,events:[event]},expectedQuestion)) fail('A question’s immutable source or opening text changed.');
      replay.questions.push(expectedQuestion);
    } else replay.questions.find(item => item.id === question.id).events.push(copy(event));
  }
  if (!same(replay.questions,project.questions)) fail('Question order or history changed.');
  const firstRevision = events[0].event.projectRevision;
  for (const quote of project.quotes) {
    if (!quote.questionScope) {
      if (quote.source === 'seller-demo' && quote.issuedProjectRevision > firstRevision) fail('An issued quotation lost its question evidence.');
      continue;
    }
    if (quote.source !== 'seller-demo' || quote.questionScope.projectRevision >= quote.issuedProjectRevision
        || !same(quote.questionScope.questions,questionsAtRevision(project,quote.issuedProjectRevision - 1))
        || Object.keys(quoteQuestionErrors(project,quote,{current:false})).length) fail('An issued quotation changed its question evidence or contains unresolved blockers.');
    const packet = assertReview({...JSON.parse(quote.reviewToken),token:quote.reviewToken},'issue-quote');
    if (!same(packet.draft.questionScope,quote.questionScope)) fail('Issued question evidence differs from the reviewed quotation.');
  }
  for (const draft of drafts) {
    if (!draft.questionScope) {
      // A pre-question draft stays recoverable and requires explicit adoption on its next save.
      if (draft.projectRevision >= firstRevision) fail('A saved quotation draft lost its question evidence.');
    } else if (Object.keys(quoteQuestionErrors(project,draft,{current:false,requireResolved:false})).length) fail('A saved quotation draft changed its question evidence.');
  }
}
