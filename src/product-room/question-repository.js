import { ProjectError, cloneProjectValue as copy, sameProjectValue as same, assertReview, normalizeInquiryDraft, inquiryErrors } from './project-domain.js';
import { reviewQuestion, reviewQuestionReply, reviewQuestionResolution, reviewQuestionReopen, validateQuestionsProject } from './question-domain.js';

const reviewers = {'question-add':reviewQuestion,'question-reply':reviewQuestionReply,'question-resolution':reviewQuestionResolution,'question-reopen':reviewQuestionReopen};

/** Uses the existing transaction and lock boundary. Roles here are demonstration attribution, not authentication. */
export function createQuestionRepositoryMethods({read,change,findProject,now,makeId}) {
  const confirm = (kind,review,{confirmed=false}={}) => {
    if (!confirmed) throw new ProjectError('CONFIRMATION_REQUIRED','Review the exact question and explicitly confirm this action.');
    const packet=assertReview(review,kind);
    return change(store => {
      const project=findProject(store,packet.projectId);
      if (project.questions?.some(question => question.events.some(event => event.reviewToken === review.token))) return project;
      if (project.revision !== packet.projectRevision || !same(reviewers[kind](project,{...packet,kind:packet.action}),review))
        throw new ProjectError('STALE_REVIEW','The project or question changed after review. Your input is still available; reopen the latest question and review again.');
      const createdAt=now();
      let question;
      if (kind === 'question-add') {
        question={id:makeId('QUESTION'),projectId:project.id,requestItemId:packet.requestItemId,requestItem:copy(packet.requestItem),context:copy(packet.context),
          body:packet.body,blocking:packet.blocking,scopeEntryId:packet.scopeEntryId,createdAt,events:[]};
        project.questionPolicy ||= {version:1};
        project.questions ||= [];
        project.questions.push(question);
      } else question=project.questions.find(item => item.id === packet.questionId);
      const event={id:makeId('QUESTION-EVENT'),questionId:question.id,version:question.events.length+1,kind:packet.action || 'opened',authorRole:packet.authorRole,
        body:packet.body,projectRevision:project.revision+1,createdAt,reviewToken:review.token};
      question.events.push(event);
      project.questionEventIndex ||= [];
      project.questionEventIndex.push({id:event.id,questionId:question.id,projectRevision:event.projectRevision});
      project.revision++;project.updatedAt=createdAt;
      return project;
    });
  };
  return {
    supportsQuestions:true,
    async reviewQuestion(projectId,input) { return reviewQuestion(findProject(read().store,projectId),input); },
    async reviewQuestionReply(projectId,input) { return reviewQuestionReply(findProject(read().store,projectId),input); },
    async reviewQuestionResolution(projectId,input) { return reviewQuestionResolution(findProject(read().store,projectId),input); },
    async reviewQuestionReopen(projectId,input) { return reviewQuestionReopen(findProject(read().store,projectId),input); },
    async confirmQuestion(review,options) { return confirm('question-add',review,options); },
    async confirmQuestionReply(review,options) { return confirm('question-reply',review,options); },
    async confirmQuestionResolution(review,options) { return confirm('question-resolution',review,options); },
    async confirmQuestionReopen(review,options) { return confirm('question-reopen',review,options); },
  };
}
export function assertQuestionsRepository(repository) {
  if (repository?.supportsQuestions !== true || !['getProject','getQuoteDraft','saveQuoteDraft','issueQuote','confirmQuestion','confirmQuestionReply','confirmQuestionResolution','confirmQuestionReopen'].every(name => typeof repository[name] === 'function'))
    throw new ProjectError('UNSUPPORTED_QUESTIONS','This project adapter does not support reviewed independent questions and exact quotation evidence.');
  return repository;
}
export function assertQuestionScopeRoundTrip(expected,actual) {
  if (!same(expected?.questionScope,actual?.questionScope)) throw new ProjectError('QUESTION_DATA_LOSS','The project adapter did not retain the exact quotation question evidence. Reopen the saved draft before continuing.');
  return actual;
}
/** Check the host envelope before either workspace installs the returned project. */
function assertQuestionProjectEnvelope(project, packet) {
  const nonempty=value=>typeof value === 'string' && value.trim() === value && value.length > 0;
  const date=value=>typeof value === 'string' && Number.isFinite(Date.parse(value));
  const reject=()=>{throw new Error('The returned project envelope is incomplete or changed.');};
  if (!project || project.id !== packet.projectId || !Number.isSafeInteger(project.revision) || project.revision < packet.projectRevision+1
      || !date(project.createdAt) || !date(project.updatedAt)) reject();
  for (const key of ['quotes','changes','replies','nextSteps','messages','questions','questionEventIndex']) {
    const records=project[key];
    if (!Array.isArray(records) || records.some(record=>!record || !nonempty(record.id)) || new Set(records.map(record=>record.id)).size !== records.length) reject();
  }
  const inquiry=project.inquiry;
  if (!inquiry || !nonempty(inquiry.id) || !nonempty(inquiry.reviewToken) || !date(inquiry.createdAt)) reject();
  const optional=Object.fromEntries(['requestItems','inquiryRulesVersion'].filter(key=>Object.hasOwn(inquiry,key)).map(key=>[key,inquiry[key]]));
  const normalized=normalizeInquiryDraft({id:inquiry.id,revision:1,...optional,context:project.context,values:inquiry.values,requirements:inquiry.requirements});
  const reviewed=assertReview({...JSON.parse(inquiry.reviewToken),token:inquiry.reviewToken},'inquiry').draft;
  const originalFields=value=>({context:value.context,values:value.values,requirements:value.requirements,
    ...Object.fromEntries(['requestItems','inquiryRulesVersion'].filter(key=>Object.hasOwn(value,key)).map(key=>[key,value[key]]))});
  if (Object.keys(inquiryErrors(normalized)).length || !same(originalFields(normalized),originalFields({...inquiry,context:project.context}))
      || !same(originalFields(normalized),originalFields(reviewed))) reject();
}
export function assertQuestionRoundTrip(review,project) {
  const reviewer=reviewers[review?.kind];
  if (!reviewer) throw new ProjectError('QUESTION_DATA_LOSS','The question review type is unavailable.');
  const packet=assertReview(review,review.kind);
  let valid=false;
  try {
    assertQuestionProjectEnvelope(project,packet);
    validateQuestionsProject(project);
    const question=project.questions.find(item => item.events.some(event => event.reviewToken === review.token));
    const event=question?.events.find(item => item.reviewToken === review.token);
    const previous={...copy(project),revision:packet.projectRevision,questions:project.questions.filter(item => item.events[0].projectRevision <= packet.projectRevision).map(item => ({...item,events:item.events.filter(value => value.projectRevision <= packet.projectRevision)}))};
    valid=project.id === packet.projectId && same(project.questionPolicy,{version:1}) && !!question && !!event
      && same(reviewer(previous,{...packet,kind:packet.action}),review) && same(question.context,packet.context) && question.requestItemId === packet.requestItemId
      && question.scopeEntryId === packet.scopeEntryId && event.projectRevision === packet.projectRevision+1 && event.authorRole === packet.authorRole
      && event.body === packet.body && event.kind === (packet.action || 'opened')
      && (packet.kind !== 'question-add' || question.body === packet.body && question.blocking === packet.blocking && same(question.requestItem,packet.requestItem));
  } catch { valid=false; }
  if (!valid) throw new ProjectError('QUESTION_DATA_LOSS','The project adapter did not retain your reviewed question action and original reference. Reopen the saved project before continuing.');
  return project;
}
