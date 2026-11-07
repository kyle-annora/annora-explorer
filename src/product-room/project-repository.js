import {
  ProjectError, cloneProjectValue, createInquiryDraft, normalizeInquiryDraft,
  projectContextKey, sameProjectValue, inquiryErrors, assertReview, reviewInquiry, reviewRevision, reviewNextStep, validInquiryQuantity
} from './project-domain.js';
import { projectDrawingContext, recordContext } from './drawing-context.js';
import { proposeProjectDrawingRevision, reviewProjectDrawingRevision, validateProjectDrawingHistory, validateRecordDrawingContext, projectContextAtRevision } from './drawing-revision.js';
import { SAMPLE_PRODUCT_ID, sampleQuote, sampleSupplierReply, sampleInquiryValues } from './project-fixtures.js';
import { validateFollowUpStore } from './follow-up-domain.js';
import { createFollowUpRepositoryMethods } from './follow-up-repository.js';
import { validateOptionScopeProject, assertQuoteScopeSource } from './option-scope-domain.js';
import { createOptionScopeRepositoryMethods } from './option-scope-repository.js';
import { validateQuestionsProject, assertQuestionScopeSource } from './question-domain.js';
import { createQuestionRepositoryMethods } from './question-repository.js';
import { validateImpactProject, assertImpactScopeSource } from './impact-domain.js';
import { createImpactRepositoryMethods } from './impact-repository.js';

import { createQuoteDraft, normalizeQuoteDraft, quoteDraftPreview, reviewQuote, reviewReply, reviewCustomerReply, reviewAcknowledgement, pendingProjectChange, pendingClarification } from './seller-domain.js';

export const PROJECT_STORAGE_KEY = 'annora.product-room.projects.v1';
export const PROJECT_SCHEMA_VERSION = 2;
const emptyStore = () => ({ schemaVersion: PROJECT_SCHEMA_VERSION, revision: 0, drafts: [], projects: [], quoteDrafts: [] });
const array = value => Array.isArray(value);
const nonempty = value => typeof value === 'string' && value.length > 0;
const integer = value => Number.isSafeInteger(value) && value >= 0;
const date = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const unique = records => new Set(records.map(record => record.id)).size === records.length;
const inquiryRuleSnapshot = inquiry => Object.hasOwn(inquiry, 'inquiryRulesVersion') ? { inquiryRulesVersion: inquiry.inquiryRulesVersion } : {};
const inquiryItemsSnapshot = inquiry => Object.hasOwn(inquiry, 'requestItems') ? { requestItems: cloneProjectValue(inquiry.requestItems) } : {};
const validOpenItems = items => array(items) && items.every(item => nonempty(item.id) && nonempty(item.label) && nonempty(item.owner) && nonempty(item.status));
const validateInspectionRecord = (project, record) => {
  if (!project?.context.drawing && (project?.context.inspection || record.context?.inspection) && !sameProjectValue(record.context, project?.context)) throw new Error('A saved record changed its inquiry view.');
};

/** Reject corrupt/unknown versions without replacing or silently resetting user records. */
export function parseProjectStore(raw) {
  if (raw === null || raw === undefined) return emptyStore();
  try {
    const store = JSON.parse(raw);
    if (store.schemaVersion === 1) {
      // Migrate in memory only; a read never writes or replaces historical records.
      if (Object.hasOwn(store,'quoteDrafts') || (store.projects || []).some(project => Object.hasOwn(project,'messages'))) throw new Error();
      store.schemaVersion = PROJECT_SCHEMA_VERSION;
      store.quoteDrafts = [];
      for (const project of store.projects || []) project.messages = [];
    }
    if (store.schemaVersion !== PROJECT_SCHEMA_VERSION || !integer(store.revision) || !array(store.drafts) || !array(store.projects) || !unique(store.drafts) || !unique(store.projects) || !array(store.quoteDrafts) || !unique(store.quoteDrafts)) throw new Error();
    for (const draft of store.drafts) {
      const normalized = normalizeInquiryDraft(draft);
      if (draft.revision < 1 || !date(draft.updatedAt) || !sameProjectValue(normalized, draft)) throw new Error();
    }
    if (new Set(store.drafts.map(draft => projectContextKey(draft.context))).size !== store.drafts.length) throw new Error();
    for (const project of store.projects) {
      if (!nonempty(project.id) || !integer(project.revision) || project.revision < 1 || !date(project.createdAt) || !date(project.updatedAt)) throw new Error();
      if (!project.inquiry || !nonempty(project.inquiry.id) || !nonempty(project.inquiry.reviewToken) || !date(project.inquiry.createdAt)) throw new Error();
      const normalizedInquiry = normalizeInquiryDraft({ id: project.inquiry.id, revision: 1, ...inquiryRuleSnapshot(project.inquiry), ...inquiryItemsSnapshot(project.inquiry), context: project.context, values: project.inquiry.values, requirements: project.inquiry.requirements });
      if (Object.keys(inquiryErrors(normalizedInquiry)).length || !sameProjectValue(inquiryRuleSnapshot(normalizedInquiry), inquiryRuleSnapshot(project.inquiry)) || !sameProjectValue(inquiryItemsSnapshot(normalizedInquiry), inquiryItemsSnapshot(project.inquiry)) || !sameProjectValue(normalizedInquiry.context, project.context) || !sameProjectValue(normalizedInquiry.values, project.inquiry.values) || !sameProjectValue(normalizedInquiry.requirements, project.inquiry.requirements)) throw new Error();
      if (Object.hasOwn(project.inquiry, 'requestItems')) {
        const reviewed = JSON.parse(project.inquiry.reviewToken);
        if (reviewed.kind !== 'inquiry' || !sameProjectValue(reviewed.draft?.requestItems, project.inquiry.requestItems)) throw new Error();
      }
      validateProjectDrawingHistory(project);
      for (const key of ['quotes', 'changes', 'replies', 'nextSteps', 'messages']) if (!array(project[key]) || !unique(project[key])) throw new Error();
      for (const [index, quote] of project.quotes.entries()) {
        if(project.context.drawing)validateRecordDrawingContext(project,quote,projectContextAtRevision(project,quote.issuedProjectRevision || 1));
        validateInspectionRecord(project, quote);
        if (!nonempty(quote.id) || quote.version !== index + 1 || !date(quote.createdAt) || !integer(quote.quantity) || quote.quantity < 1 || (quote.unitPrice !== null && (!Number.isFinite(quote.unitPrice) || quote.unitPrice < 0)) || !Number.isFinite(quote.subtotal) || quote.total !== null || quote.currency !== 'USD' || !['sample', 'seller-demo'].includes(quote.source) || !nonempty(quote.scope) || !nonempty(quote.proposedLeadTime) || !array(quote.assumptions) || !quote.assumptions.every(item => typeof item === 'string') || !validOpenItems(quote.openItems)) throw new Error();
        if (quote.requestedWeeks !== null && (!integer(quote.requestedWeeks) || quote.requestedWeeks < 1)) throw new Error();
        if (!array(quote.lineItems) || !quote.lineItems.every(item => nonempty(item.label) && (item.amount === null || (Number.isFinite(item.amount) && item.amount >= 0)))) throw new Error();
        if (Math.round(quote.lineItems.reduce((sum, item) => sum + (item.amount ?? 0), 0) * 100) / 100 !== quote.subtotal) throw new Error();
        if (index === 0 && (quote.previousQuoteId !== null || quote.changeId !== null || quote.replyId !== null)) throw new Error();
        if (index > 0 && quote.source === 'sample') {
          const change = project.changes.find(item => item.id === quote.changeId), reply = project.replies.find(item => item.id === quote.replyId);
          if (quote.previousQuoteId !== project.quotes[index - 1].id || !change || !reply || change.quoteId !== quote.previousQuoteId || reply.changeId !== change.id || reply.quoteId !== change.quoteId) throw new Error();
        }
        if (quote.source === 'seller-demo') {
          if (!integer(quote.issuedProjectRevision) || quote.issuedProjectRevision < 2 || quote.issuedProjectRevision > project.revision || !nonempty(quote.reviewToken) || !array(quote.exclusions) || !quote.exclusions.every(item => typeof item === 'string') || typeof quote.validity !== 'string' || quote.replyId !== null) throw new Error();
          if (quote.previousQuoteId !== (project.quotes[index-1]?.id || null) || (quote.changeId !== null && !project.changes.some(item => item.id === quote.changeId && item.quoteId === quote.previousQuoteId))) throw new Error();
          if (!quote.lineItems.length || !unique(quote.lineItems) || quote.lineItems.some(item => !nonempty(item.id) || !Number.isFinite(item.quantity) || item.quantity <= 0 || (item.unitPrice !== null && (!Number.isFinite(item.unitPrice) || item.unitPrice < 0)) || item.amount !== (item.unitPrice === null ? null : Math.round((item.quantity * item.unitPrice + Number.EPSILON) * 100) / 100))) throw new Error();
          if (quote.unitPrice !== quote.lineItems[0].unitPrice) throw new Error();
        }
      }
      for (const change of project.changes) {
        validateInspectionRecord(project, change);
        const quote = project.quotes.find(item => item.id === change.quoteId);
        if(project.context.drawing&&quote)validateRecordDrawingContext(project,change,recordContext(project,quote));
        if (!nonempty(change.id) || !quote || quote.version !== change.quoteVersion || !date(change.createdAt) || !nonempty(change.reviewToken) || !change.values || !/^\d+$/.test(change.values.quantity) || +change.values.quantity < 1 || typeof change.values.targetWeeks !== 'string' || typeof change.values.notes !== 'string') throw new Error();
      }
      for (const reply of project.replies) {
        validateInspectionRecord(project, reply);
        const change = project.changes.find(item => item.id === reply.changeId);
        if(project.context.drawing&&change)validateRecordDrawingContext(project,reply,recordContext(project,change));
        if (!nonempty(reply.id) || !change || reply.quoteId !== change.quoteId || reply.quoteVersion !== change.quoteVersion || !date(reply.createdAt) || reply.source !== 'sample' || !array(reply.topics) || !reply.topics.every(item => ['label', 'requested', 'response', 'status'].every(key => typeof item[key] === 'string')) || !validOpenItems(reply.openItems)) throw new Error();
      }
      if (new Set(project.replies.map(reply => reply.changeId)).size !== project.replies.length) throw new Error();
      for (const [messageIndex,message] of project.messages.entries()) {
        validateInspectionRecord(project, message);
        if(project.context.drawing){
          const parent=message.replyTo?project.messages.find(item=>item.id===message.replyTo):message.changeId?project.changes.find(item=>item.id===message.changeId):message.nextStepId?project.nextSteps.find(item=>item.id===message.nextStepId):null;
          validateRecordDrawingContext(project,message,parent?recordContext(project,parent):projectContextAtRevision(project,message.projectRevision));
        }
        if (!integer(message.projectRevision) || message.projectRevision < 2 || message.projectRevision > project.revision || (messageIndex > 0 && message.projectRevision <= project.messages[messageIndex-1].projectRevision) || !nonempty(message.id) || !['seller','buyer'].includes(message.authorRole) || !['reply','clarification','change-response','customer-reply','next-step-confirmation'].includes(message.kind) || !nonempty(message.body) || message.body.length > 4000 || !date(message.createdAt) || !nonempty(message.reviewToken) || message.delivery !== 'demo-only' || !array(message.resolutions)) throw new Error();
        for (const key of ['changeId','replyTo','nextStepId']) if (message[key] !== null && !nonempty(message[key])) throw new Error();
        if ((message.authorRole === 'buyer') !== (message.kind === 'customer-reply')) throw new Error();
        if (message.kind === 'customer-reply' && (message.nextStepId !== null || pendingClarification({...project,messages:project.messages.slice(0,messageIndex)})?.id !== message.replyTo)) throw new Error();
        if (message.kind === 'next-step-confirmation' && (message.replyTo !== null || !project.nextSteps.some(item => item.id === message.nextStepId && (!item.projectRevision || item.projectRevision < message.projectRevision)))) throw new Error();
        if (['reply','clarification','change-response'].includes(message.kind)) {
          if (message.replyTo !== null || message.nextStepId !== null) throw new Error();
          reviewReply({ ...project, messages: project.messages.slice(0,messageIndex) }, message);
        } else if (message.resolutions.length || message.changeId !== null) throw new Error();
      }
      if (new Set(project.messages.filter(item => item.kind === 'customer-reply').map(item => item.replyTo)).size !== project.messages.filter(item => item.kind === 'customer-reply').length) throw new Error();
      if (new Set(project.messages.filter(item => item.kind === 'next-step-confirmation').map(item => item.nextStepId)).size !== project.messages.filter(item => item.kind === 'next-step-confirmation').length) throw new Error();
      for (const step of project.nextSteps) {
        validateInspectionRecord(project, step);
        const quote = project.quotes.find(item => item.id === step.quoteId);
        if(project.context.drawing&&quote)validateRecordDrawingContext(project,step,recordContext(project,quote));
        if (!nonempty(step.id) || !quote || quote.version !== step.quoteVersion || !date(step.createdAt) || !nonempty(step.reviewToken) || !nonempty(step.message) || !['discussion', 'engineering-review'].includes(step.intent) || step.delivery !== 'demo-only') throw new Error();
      }
    }
    for (const draft of store.quoteDrafts) {
      const normalized = normalizeQuoteDraft(draft), project = store.projects.find(item => item.id === draft.projectId);
      if(project?.context.drawing)validateRecordDrawingContext(project,draft);
      validateInspectionRecord(project, draft);
      if (!project || draft.revision < 1 || !date(draft.updatedAt) || !sameProjectValue(normalized,{...draft,replyDraft:draft.replyDraft ?? null}) || draft.projectRevision > project.revision || draft.previousQuoteId !== (project.quotes.at(-1)?.id || null) || (draft.changeId !== null && !project.changes.some(item => item.id === draft.changeId && item.quoteId === draft.previousQuoteId))) throw new Error();
    }
    if (new Set(store.quoteDrafts.map(item => item.projectId)).size !== store.quoteDrafts.length) throw new Error();
    validateFollowUpStore(store);
    for(const project of store.projects)validateOptionScopeProject(project,store.quoteDrafts.filter(draft=>draft.projectId===project.id));
    for(const project of store.projects)validateQuestionsProject(project,store.quoteDrafts.filter(draft=>draft.projectId===project.id));
    for(const project of store.projects)validateImpactProject(project,store.quoteDrafts.filter(draft=>draft.projectId===project.id));
    return store;
  } catch {
    throw new ProjectError('STORAGE_CORRUPT', 'Saved project data could not be read. It has not been changed. Use a different browser profile for a fresh demo, or recover the stored data before continuing.');
  }
}

function findProject(store, id) {
  const project = store.projects.find(item => item.id === id);
  if (!project) throw new ProjectError('NOT_FOUND', 'This project is not saved in this browser. Open My projects to choose an available project.');
  return project;
}
function assertSample(project) {
  if (project.context.productId !== SAMPLE_PRODUCT_ID) throw new ProjectError('UNSUPPORTED_PRODUCT', 'The commercial example is available for the crank-slider mechanism only.');
}
function assertFreshProject(project, review) {
  if (project.revision !== review.projectRevision) throw new ProjectError('STALE_REVIEW', 'This project changed after your review. Reopen it and review the latest details.');
  const quote = project.quotes.at(-1);
  if (!quote || quote.id !== review.quoteId || quote.version !== review.quoteVersion) throw new ProjectError('STALE_REVIEW', 'A newer quotation is available. Review the latest version first.');
  return quote;
}
function assertProjectRevision(project,packet) { if (project.revision !== packet.projectRevision) throw new ProjectError('STALE_REVIEW', 'This project changed after your review. Reopen it and review the latest details.'); }
function touch(project, now) { project.revision++; project.updatedAt = now; return project; }

/**
 * Async host contract: the UI can receive a different repository implementing these methods.
 * This adapter performs no fetch, login, delivery or supplier approval. Values stay browser-local.
 * Optional Web Locks serialize cooperating browser tabs; revision checks also reject stale forms.
 */
export function createDemoProjectRepository(options = {}) {
  const key = options.key || PROJECT_STORAGE_KEY;
  // Drawing hosts explicitly opt into the reviewed commercial workflow. The
  // ordinary sample adapter and its records keep their existing product gate.
  function assertCommercial(project) {
    if (options.commercialProduct?.id === project.context.productId && options.commercialProduct.modelRevision === project.context.modelRevision) return;
    if (options.drawingWorkflow === true && project.context.drawing) return;
    assertSample(project);
  }
  const now = options.now || (() => new Date().toISOString());
  const makeId = options.makeId || (prefix => `${prefix}-DEMO-${globalThis.crypto.randomUUID().slice(0, 8).toUpperCase()}`);
  const locks = Object.hasOwn(options, 'locks') ? options.locks : globalThis.navigator?.locks;
  let storage;
  function storageOf() {
    try {
      storage ||= options.storage || globalThis.localStorage;
      if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') throw new Error();
      return storage;
    } catch { throw new ProjectError('STORAGE_UNAVAILABLE', 'Browser storage is unavailable. Keep this page open and enable storage before saving. Nothing has been submitted.'); }
  }
  function read() {
    let raw;
    try { raw = storageOf().getItem(key); }
    catch (error) { if (error instanceof ProjectError) throw error; throw new ProjectError('STORAGE_UNAVAILABLE', 'Saved projects could not be read. Nothing has been changed.'); }
    return { raw, store: parseProjectStore(raw) };
  }
  function write(store, originalRaw) {
    const encoded = JSON.stringify(store);
    try {
      const target = storageOf();
      if (target.getItem(key) !== originalRaw) throw new ProjectError('CONFLICT', 'Another tab changed this project. Reopen the latest saved record before continuing.');
      target.setItem(key, encoded);
      if (target.getItem(key) !== encoded) throw new ProjectError('CONFLICT', 'Another tab changed the saved data. Reload the project to check its latest state.');
    } catch (error) {
      if (error instanceof ProjectError) throw error;
      throw new ProjectError('STORAGE_UNAVAILABLE', 'The change could not be saved in this browser. Your input is still available; try again after allowing storage or freeing space.');
    }
  }
  function change(operation) {
    const run = () => {
      const { raw, store } = read(), before = JSON.stringify(store), result = operation(store);
      if (JSON.stringify(store) !== before) { store.revision++; write(store, raw); }
      return cloneProjectValue(result);
    };
    return locks?.request ? locks.request(`annora:${key}`, run) : Promise.resolve().then(run);
  }
  function sellerProjection(store,project) {
    const saved = store.quoteDrafts.find(item => item.projectId === project.id);
    let draft = saved ? normalizeQuoteDraft(saved) : null;
    if (draft) {
      const latestChange = project.changes.filter(item => item.quoteId === draft.previousQuoteId).at(-1);
      const hasResponseInput = draft.replyDraft && (draft.replyDraft.body || draft.replyDraft.resolutions.some(item => item.response));
      if (latestChange && draft.changeId !== latestChange.id && !hasResponseInput) {
        const next = createQuoteDraft(project,draft.id);
        draft.changeId = latestChange.id;
        draft.replyDraft = next.replyDraft;
      }
      draft.projectRevision = project.revision;
      if (saved.projectRevision !== project.revision) draft.rebasedFromRevision = saved.projectRevision;
      if(project.context.drawing&&!sameProjectValue(recordContext(project,draft),projectDrawingContext(project)))draft.drawingReferenceStale=true;
    }
    return { ...project, quoteDraft:draft };
  }
  function appendMessage(project,values,token,authorRole = 'seller') {
    const parent=values.replyTo?project.messages.find(item=>item.id===values.replyTo):values.changeId?project.changes.find(item=>item.id===values.changeId):values.nextStepId?project.nextSteps.find(item=>item.id===values.nextStepId):null;
    const pinned=parent?recordContext(project,parent):projectDrawingContext(project);
    const message = { ...(project.context.drawing || project.context.inspection ? {context:cloneProjectValue(pinned)} : {}),id:makeId('MSG'),projectRevision:project.revision+1,authorRole,kind:values.kind,body:values.body,changeId:values.changeId || null,replyTo:values.replyTo || null,nextStepId:values.nextStepId || null,resolutions:cloneProjectValue(values.resolutions || []),createdAt:now(),reviewToken:token,delivery:'demo-only' };
    project.messages.push(message); return message;
  }
  async function drawingRelease(input) {
    if(options.drawingWorkflow!==true || typeof options.getDrawingRelease!=='function') throw new ProjectError('DRAWING_RELEASE_UNAVAILABLE','This host must provide the published drawing repository before project references can change.');
    const releaseId=input?.releaseId || input?.release?.id;
    if(!nonempty(releaseId))throw new ProjectError('VALIDATION','Choose a published drawing release.');
    let release;
    try{release=await options.getDrawingRelease(releaseId);}catch{throw new ProjectError('DRAWING_RELEASE_UNAVAILABLE','This published release is no longer available. Reopen the drawing workspace.');}
    if(!release || release.id!==releaseId || (input.release&&!sameProjectValue(input.release,release)))throw new ProjectError('STALE_REVIEW','The proposed source does not match the saved published release. Choose it again.');
    return release;
  }
  const api = {
    mode: 'demo',
    evidenceScope: Object.freeze({schemaVersion:1, namespace:key, storage:'browser-local'}),
    supportsRequestItems: true,
    ...createFollowUpRepositoryMethods({ read, change, findProject, now, makeId }),
    ...createOptionScopeRepositoryMethods({ read, change, findProject, now, makeId }),
    ...createQuestionRepositoryMethods({ read, change, findProject, now, makeId }),
    ...createImpactRepositoryMethods({read,change,findProject,now,makeId,drawingRelease,sellerProjection,enabled:options.drawingWorkflow===true && typeof options.getDrawingRelease==='function'}),
    async proposeDrawingRevision(projectId,input) {
      const release=await drawingRelease(input),{store}=read(),project=findProject(store,projectId);assertCommercial(project);
      if(project.impactPolicy || options.requireDrawingImpact===true)throw new ProjectError('IMPACT_REVIEW_REQUIRED','Review affected questions and scope through drawing impact before changing this project source.');
      return proposeProjectDrawingRevision(project,input,release,store.quoteDrafts.find(draft=>draft.projectId===projectId));
    },
    async reviewDrawingRevision(projectId,input) {
      return reviewProjectDrawingRevision(await api.proposeDrawingRevision(projectId,input),now());
    },
    async confirmDrawingRevision(review,{confirmed=false}={}) {
      if(!confirmed)throw new ProjectError('CONFIRMATION_REQUIRED','Review the source change and explicitly confirm adoption.');
      const packet=assertReview(review,'drawing-revision'),release=await drawingRelease(packet);
      return change(store=>{
        const project=findProject(store,packet.projectId);assertCommercial(project);
        if(project.lastDrawingReviewToken===review.token || project.drawingRevisions?.some(item=>item.reviewToken===review.token))return sellerProjection(store,project);
        if(project.impactPolicy || options.requireDrawingImpact===true)throw new ProjectError('IMPACT_REVIEW_REQUIRED','Review affected questions and scope before adopting another source.');
        assertProjectRevision(project,packet);
        const saved=store.quoteDrafts.find(item=>item.projectId===project.id)||null;
        if(!sameProjectValue(saved,packet.quoteDraft))throw new ProjectError('STALE_REVIEW','The quotation draft changed after reference review. Review the change again.');
        const proposal=proposeProjectDrawingRevision(project,packet,release,saved);
        const expected=reviewProjectDrawingRevision(proposal,packet.reviewedAt);
        if(!sameProjectValue(expected,review))throw new ProjectError('STALE_REVIEW','The project reference or reviewed source changed. Review it again.');
        const createdAt=now();
        if(packet.referenceChanged){
          project.activeDrawingContext=cloneProjectValue(packet.context);
          project.drawingRevisions ||= [];
          project.drawingRevisions.push({id:makeId('DRAWING-ADOPTION'),status:'adopted',projectRevision:project.revision+1,fromContext:cloneProjectValue(packet.fromContext),context:cloneProjectValue(packet.context),release:cloneProjectValue(release),note:packet.note,quoteDraftAction:packet.quoteDraftAction,reviewedAt:packet.reviewedAt,createdAt,reviewToken:review.token});
        }
        project.lastDrawingReviewToken=review.token;
        touch(project,createdAt);
        if(packet.quoteDraftAction==='replace'&&saved){
          store.quoteDrafts=store.quoteDrafts.filter(item=>item.projectId!==project.id);
          store.quoteDrafts.push({...createQuoteDraft(project,makeId('QD')),revision:1,updatedAt:createdAt});
        }
        return sellerProjection(store,project);
      });
    },
    async listProjects() { return cloneProjectValue(read().store.projects).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); },
    async getProject(projectId) { return cloneProjectValue(findProject(read().store, projectId)); },
    async listSellerProjects() { const {store} = read(); return cloneProjectValue(store.projects.map(project => sellerProjection(store,project))).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)); },
    async getSellerProject(projectId) { const {store} = read(); return cloneProjectValue(sellerProjection(store,findProject(store,projectId))); },
    async getQuoteDraft(projectId) { const {store} = read(), project = findProject(store,projectId); assertCommercial(project); return cloneProjectValue(sellerProjection(store,project).quoteDraft || createQuoteDraft(project,makeId('QD'))); },
    async saveQuoteDraft(input) {
      const draft = normalizeQuoteDraft(input);
      return change(store => {
        const project = findProject(store,draft.projectId); assertCommercial(project);
        const previous = store.quoteDrafts.find(item => item.projectId === project.id);
        assertQuoteScopeSource(project,draft);
        assertQuestionScopeSource(project,draft);
        assertImpactScopeSource(project,draft);
        if(project.context.drawing&&!sameProjectValue(recordContext(project,draft),projectDrawingContext(project)))throw new ProjectError('DRAWING_REVIEW_REQUIRED','This quotation draft uses an earlier drawing reference. Review and explicitly replace it before saving or issuing a new version.');
        if(project.context.inspection&&!project.context.drawing&&!sameProjectValue(draft.context,project.context))throw new ProjectError('VALIDATION','Keep the saved inquiry view attached to this quotation.');
        if(previous&&project.context.drawing&&!sameProjectValue(recordContext(project,draft),recordContext(project,previous)))throw new ProjectError('DRAWING_REVIEW_REQUIRED','A quotation draft reference can change only through explicit drawing-reference review.');
        if (draft.projectRevision !== project.revision || draft.previousQuoteId !== (project.quotes.at(-1)?.id || null)) throw new ProjectError('CONFLICT','The customer project changed. Reopen it before saving the quotation draft. Your input is still available.');
        if (previous ? previous.id !== draft.id || previous.revision !== draft.revision : draft.revision !== 0) throw new ProjectError('CONFLICT','This quotation draft changed or was issued in another tab. Reopen the latest draft.');
        if (draft.changeId !== null && !project.changes.some(item => item.id === draft.changeId && item.quoteId === draft.previousQuoteId)) throw new ProjectError('VALIDATION','The draft change request does not match its quotation.');
        if (previous && sameProjectValue(previous,draft)) return previous;
        const saved = { ...draft,revision:draft.revision+1,updatedAt:now() };
        store.quoteDrafts = store.quoteDrafts.filter(item => item.projectId !== project.id); store.quoteDrafts.push(saved); return saved;
      });
    },
    async issueQuote(review) {
      const packet = assertReview(review,'issue-quote');
      return change(store => {
        const project = findProject(store,packet.projectId); assertCommercial(project);
        if (project.quotes.some(item => item.reviewToken === review.token)) return sellerProjection(store,project);
        assertProjectRevision(project,packet); reviewQuote(project,packet.draft,packet.reply);
        const saved = store.quoteDrafts.find(item => item.id === packet.draft.id);
        if (!saved || !sameProjectValue(saved,packet.draft)) throw new ProjectError('STALE_REVIEW','The saved quotation draft changed after review. Review the latest draft.');
        if (packet.reply) appendMessage(project,packet.reply,review.token);
        const createdAt = now();
        project.quotes.push({ ...quoteDraftPreview(saved,project),id:makeId('QT'),createdAt,issuedProjectRevision:project.revision+1,reviewToken:review.token });
        store.quoteDrafts = store.quoteDrafts.filter(item => item.id !== saved.id);
        touch(project,createdAt); return sellerProjection(store,project);
      });
    },
    async sendReply(review) {
      const packet = assertReview(review,'seller-reply');
      return change(store => {
        const project = findProject(store,packet.projectId); assertCommercial(project);
        if (project.messages.some(item => item.reviewToken === review.token)) return project;
        assertProjectRevision(project,packet); reviewReply(project,packet.values);
        const message = appendMessage(project,packet.values,review.token); return touch(project,message.createdAt);
      });
    },
    async sendCustomerReply(review) {
      const packet = assertReview(review,'customer-reply');
      return change(store => {
        const project = findProject(store,packet.projectId); assertCommercial(project);
        if (project.messages.some(item => item.reviewToken === review.token)) return project;
        assertProjectRevision(project,packet); reviewCustomerReply(project,packet);
        const message = appendMessage(project,{...packet,kind:'customer-reply'},review.token,'buyer'); return touch(project,message.createdAt);
      });
    },
    async acknowledgeNextStep(review) {
      const packet = assertReview(review,'acknowledge-next-step');
      return change(store => {
        const project = findProject(store,packet.projectId); assertCommercial(project);
        if (project.messages.some(item => item.reviewToken === review.token)) return project;
        assertProjectRevision(project,packet); reviewAcknowledgement(project,packet);
        const message = appendMessage(project,{...packet,kind:'next-step-confirmation'},review.token); return touch(project,message.createdAt);
      });
    },
    async createSampleInquiry(context) {
      return change(store => {
        const existing = store.projects.find(item => item.demoSeed === 'seller-inbox' && item.context.productId === context.productId && item.context.modelRevision === context.modelRevision && (item.context.roomReleaseId || null) === (context.roomReleaseId || null) && (!context.drawing || projectContextKey(item.context) === projectContextKey(context)));
        if (existing) return sellerProjection(store,existing);
        const createdAt = now(), draft = createInquiryDraft(context,makeId('DRAFT'));
        draft.revision = 1; draft.values = sampleInquiryValues(context); draft.updatedAt = createdAt;
        const review = reviewInquiry(draft), project = {id:makeId('PRJ'),revision:1,context:draft.context,inquiry:{id:makeId('RFQ'),...inquiryRuleSnapshot(draft),values:draft.values,requirements:draft.requirements,createdAt,reviewToken:review.token},quotes:[],changes:[],replies:[],nextSteps:[],messages:[],createdAt,updatedAt:createdAt,demoSeed:'seller-inbox'};
        assertCommercial(project); store.projects.push(project); return sellerProjection(store,project);
      });
    },
    async listDrafts() { return cloneProjectValue(read().store.drafts).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')); },
    async getDraft(context) {
      const candidate = createInquiryDraft(context, makeId('DRAFT'));
      const saved = read().store.drafts.find(item => projectContextKey(item.context) === projectContextKey(candidate.context));
      return cloneProjectValue(saved || candidate);
    },
    async saveDraft(input) {
      const draft = normalizeInquiryDraft(input);
      return change(store => {
        const previous = store.drafts.find(item => projectContextKey(item.context) === projectContextKey(draft.context));
        if (previous && (previous.id !== draft.id || previous.revision !== draft.revision)) throw new ProjectError('CONFLICT', 'This draft changed in another tab. Reopen it before saving again.');
        if (!previous && draft.revision !== 0) throw new ProjectError('CONFLICT', 'This draft has already been submitted or removed. Start a new inquiry.');
        if (previous && sameProjectValue(previous, draft)) return previous;
        const saved = { ...draft, revision: draft.revision + 1, updatedAt: now() };
        store.drafts = store.drafts.filter(item => item.id !== draft.id); store.drafts.push(saved);
        return saved;
      });
    },
    async submitInquiry(review) {
      const packet = assertReview(review, 'inquiry'); reviewInquiry(packet.draft);
      return change(store => {
        const existing = store.projects.find(project => project.inquiry.reviewToken === review.token);
        if (existing) return existing;
        const saved = store.drafts.find(item => item.id === packet.draft.id);
        if (!saved || !sameProjectValue(saved, packet.draft)) throw new ProjectError('STALE_REVIEW', 'The saved inquiry changed after review. Review the latest draft before submitting.');
        const createdAt = now();
        const project = {
          id: makeId('PRJ'), revision: 1, context: cloneProjectValue(saved.context),
          inquiry: { id: makeId('RFQ'), ...inquiryRuleSnapshot(saved), ...inquiryItemsSnapshot(saved), values: cloneProjectValue(saved.values), requirements: cloneProjectValue(saved.requirements), createdAt, reviewToken: review.token },
          quotes: [], changes: [], replies: [], nextSteps: [], messages: [], createdAt, updatedAt: createdAt
        };
        store.projects.push(project); store.drafts = store.drafts.filter(item => item.id !== saved.id); return project;
      });
    },
    async createSampleQuote(projectId) {
      return change(store => {
        const project = findProject(store, projectId); assertSample(project);
        if(project.impactPolicy)throw new ProjectError('IMPACT_REVIEW_REQUIRED','Prepare and review the source impact in Studio before issuing this quotation.');
        if(project.questionPolicy)throw new ProjectError('QUESTION_REVIEW_REQUIRED','Prepare and review the question evidence in Studio before issuing this quotation.');
        if(project.approvedOptionSet)throw new ProjectError('SCOPE_REVIEW_REQUIRED','Prepare and review the mapped scope in Studio before issuing a quotation for this project.');
        if (project.quotes.length) return project;
        if (!validInquiryQuantity(project.inquiry.values.quantity)) throw new ProjectError('VALIDATION', 'Quantity is unknown. Prepare a seller quotation with an explicit quantity before issuing it.', { quantity: 'Confirm a whole quantity from 1 to 100,000.' });
        const createdAt = now();
        if (store.quoteDrafts.some(item => item.projectId === project.id)) throw new ProjectError('CONFLICT','A seller quotation draft is already in progress. Open Studio to review it.');
        const quote = sampleQuote({ id: makeId('QT'), version: 1, createdAt, values: project.inquiry.values });
        if (project.context.inspection) quote.context = cloneProjectValue(project.context);
        project.quotes.push(quote);
        return touch(project, createdAt);
      });
    },
    async requestRevision(review) {
      const packet = assertReview(review, 'revision');
      return change(store => {
        const project = findProject(store, packet.projectId); assertCommercial(project);
        if (project.changes.some(item => item.reviewToken === review.token)) return project;
        const quote = assertFreshProject(project, packet); reviewRevision(project, quote.id, packet.values);
        if (pendingProjectChange(project) || pendingClarification(project)) throw new ProjectError('CONFLICT', 'A change request already awaits a reply for this quotation.');
        const createdAt = now();
        project.changes.push({ id: makeId('CHG'), projectRevision:project.revision+1, quoteId: quote.id, quoteVersion: quote.version, values: cloneProjectValue(packet.values), ...(project.context.drawing || project.context.inspection?{context:cloneProjectValue(recordContext(project,quote))}:{}), createdAt, reviewToken: review.token });
        return touch(project, createdAt);
      });
    },
    async simulateReply(projectId, changeId) {
      return change(store => {
        const project = findProject(store, projectId); assertSample(project);
        if(project.impactPolicy)throw new ProjectError('IMPACT_REVIEW_REQUIRED','Prepare and review the source impact in Studio before issuing this quotation.');
        if(project.questionPolicy)throw new ProjectError('QUESTION_REVIEW_REQUIRED','Prepare and review the question evidence in Studio before issuing a revised quotation.');
        if(project.approvedOptionSet)throw new ProjectError('SCOPE_REVIEW_REQUIRED','Prepare and review the mapped scope in Studio before issuing a quotation for this project.');
        if (project.replies.some(item => item.changeId === changeId)) return project;
        const requested = project.changes.find(item => item.id === changeId);
        if (!requested) throw new ProjectError('NOT_FOUND', 'Choose a saved change request before opening an example reply.');
        const quote = project.quotes.find(item => item.id === requested.quoteId);
        if (quote?.id !== project.quotes.at(-1)?.id) throw new ProjectError('STALE_REVIEW', 'This change request belongs to an older quotation.');
        const createdAt = now(), reply = sampleSupplierReply({ id: makeId('REPLY'), createdAt, change: requested, quote, inquiry: project.inquiry });
        const revised = sampleQuote({ id: makeId('QT'), version: quote.version + 1, createdAt, values: { ...project.inquiry.values, quantity: requested.values.quantity, targetWeeks: requested.values.targetWeeks }, additionalQuestions: project.changes.map(item => item.values.notes), previousQuoteId: quote.id, changeId, replyId: reply.id });
        if (store.quoteDrafts.some(item => item.projectId === project.id)) throw new ProjectError('CONFLICT','A seller quotation draft is already in progress. Open Studio to review it.');
        if(project.context.drawing || project.context.inspection){reply.context=cloneProjectValue(recordContext(project,requested));revised.context=cloneProjectValue(projectDrawingContext(project));}
        project.replies.push(reply); project.quotes.push(revised);
        return touch(project, createdAt);
      });
    },
    async confirmNextStep(review) {
      const packet = assertReview(review, 'next-step');
      return change(store => {
        const project = findProject(store, packet.projectId); assertCommercial(project);
        if (project.nextSteps.some(item => item.reviewToken === review.token)) return project;
        const quote = assertFreshProject(project, packet); reviewNextStep(project, quote.id, packet);
        if (pendingProjectChange(project) || pendingClarification(project)) throw new ProjectError('CONFLICT', 'Review the pending change response before confirming a next step.');
        if (project.nextSteps.some(item => item.quoteId === quote.id && ((!project.messages.some(message => message.kind === 'next-step-confirmation' && message.nextStepId === item.id)) || (item.intent === packet.intent && item.message === packet.message)))) throw new ProjectError('CONFLICT','A matching or unanswered next-step request is already saved for this quotation.');
        const createdAt = now();
        project.nextSteps.push({ id: makeId('NEXT'), projectRevision:project.revision+1, quoteId: quote.id, quoteVersion: quote.version, intent: packet.intent, message: packet.message, ...(project.context.drawing || project.context.inspection?{context:cloneProjectValue(recordContext(project,quote))}:{}), createdAt, delivery: 'demo-only', reviewToken: review.token });
        return touch(project, createdAt);
      });
    }
  };
  return Object.freeze(api);
}
