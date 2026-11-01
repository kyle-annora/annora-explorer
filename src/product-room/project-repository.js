import {
  ProjectError, cloneProjectValue, createInquiryDraft, normalizeInquiryDraft,
  projectContextKey, sameProjectValue, inquiryErrors, assertReview, reviewInquiry, reviewRevision, reviewNextStep
} from './project-domain.js';
import { SAMPLE_PRODUCT_ID, sampleQuote, sampleSupplierReply } from './project-fixtures.js';

export const PROJECT_STORAGE_KEY = 'annora.product-room.projects.v1';
export const PROJECT_SCHEMA_VERSION = 1;
const emptyStore = () => ({ schemaVersion: PROJECT_SCHEMA_VERSION, revision: 0, drafts: [], projects: [] });
const array = value => Array.isArray(value);
const nonempty = value => typeof value === 'string' && value.length > 0;
const integer = value => Number.isSafeInteger(value) && value >= 0;
const date = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const unique = records => new Set(records.map(record => record.id)).size === records.length;
const validOpenItems = items => array(items) && items.every(item => nonempty(item.id) && nonempty(item.label) && nonempty(item.owner) && nonempty(item.status));

/** Reject corrupt/unknown versions without replacing or silently resetting user records. */
export function parseProjectStore(raw) {
  if (raw === null || raw === undefined) return emptyStore();
  try {
    const store = JSON.parse(raw);
    if (store.schemaVersion !== PROJECT_SCHEMA_VERSION || !integer(store.revision) || !array(store.drafts) || !array(store.projects) || !unique(store.drafts) || !unique(store.projects)) throw new Error();
    for (const draft of store.drafts) {
      const normalized = normalizeInquiryDraft(draft);
      if (draft.revision < 1 || !date(draft.updatedAt) || !sameProjectValue(normalized, draft)) throw new Error();
    }
    if (new Set(store.drafts.map(draft => projectContextKey(draft.context))).size !== store.drafts.length) throw new Error();
    for (const project of store.projects) {
      if (!nonempty(project.id) || !integer(project.revision) || project.revision < 1 || !date(project.createdAt) || !date(project.updatedAt)) throw new Error();
      if (!project.inquiry || !nonempty(project.inquiry.id) || !nonempty(project.inquiry.reviewToken) || !date(project.inquiry.createdAt)) throw new Error();
      const normalizedInquiry = normalizeInquiryDraft({ id: project.inquiry.id, revision: 1, context: project.context, values: project.inquiry.values, requirements: project.inquiry.requirements });
      if (Object.keys(inquiryErrors(normalizedInquiry)).length || !sameProjectValue(normalizedInquiry.context, project.context) || !sameProjectValue(normalizedInquiry.values, project.inquiry.values) || !sameProjectValue(normalizedInquiry.requirements, project.inquiry.requirements)) throw new Error();
      for (const key of ['quotes', 'changes', 'replies', 'nextSteps']) if (!array(project[key]) || !unique(project[key])) throw new Error();
      for (const [index, quote] of project.quotes.entries()) {
        if (!nonempty(quote.id) || quote.version !== index + 1 || !date(quote.createdAt) || !integer(quote.quantity) || quote.quantity < 1 || !Number.isFinite(quote.unitPrice) || quote.unitPrice < 0 || !Number.isFinite(quote.subtotal) || quote.total !== null || quote.currency !== 'USD' || quote.source !== 'sample' || !nonempty(quote.scope) || !nonempty(quote.proposedLeadTime) || !array(quote.assumptions) || !quote.assumptions.every(item => typeof item === 'string') || !validOpenItems(quote.openItems)) throw new Error();
        if (quote.requestedWeeks !== null && (!integer(quote.requestedWeeks) || quote.requestedWeeks < 1)) throw new Error();
        if (!array(quote.lineItems) || !quote.lineItems.every(item => nonempty(item.label) && (item.amount === null || (Number.isFinite(item.amount) && item.amount >= 0)))) throw new Error();
        if (quote.lineItems.reduce((sum, item) => sum + (item.amount ?? 0), 0) !== quote.subtotal) throw new Error();
        if (index === 0 && (quote.previousQuoteId !== null || quote.changeId !== null || quote.replyId !== null)) throw new Error();
        if (index > 0) {
          const change = project.changes.find(item => item.id === quote.changeId), reply = project.replies.find(item => item.id === quote.replyId);
          if (quote.previousQuoteId !== project.quotes[index - 1].id || !change || !reply || change.quoteId !== quote.previousQuoteId || reply.changeId !== change.id || reply.quoteId !== change.quoteId) throw new Error();
        }
      }
      for (const change of project.changes) {
        const quote = project.quotes.find(item => item.id === change.quoteId);
        if (!nonempty(change.id) || !quote || quote.version !== change.quoteVersion || !date(change.createdAt) || !nonempty(change.reviewToken) || !change.values || !/^\d+$/.test(change.values.quantity) || +change.values.quantity < 1 || typeof change.values.targetWeeks !== 'string' || typeof change.values.notes !== 'string') throw new Error();
      }
      for (const reply of project.replies) {
        const change = project.changes.find(item => item.id === reply.changeId);
        if (!nonempty(reply.id) || !change || reply.quoteId !== change.quoteId || reply.quoteVersion !== change.quoteVersion || !date(reply.createdAt) || reply.source !== 'sample' || !array(reply.topics) || !reply.topics.every(item => ['label', 'requested', 'response', 'status'].every(key => typeof item[key] === 'string')) || !validOpenItems(reply.openItems)) throw new Error();
      }
      if (new Set(project.replies.map(reply => reply.changeId)).size !== project.replies.length) throw new Error();
      for (const step of project.nextSteps) {
        const quote = project.quotes.find(item => item.id === step.quoteId);
        if (!nonempty(step.id) || !quote || quote.version !== step.quoteVersion || !date(step.createdAt) || !nonempty(step.reviewToken) || !nonempty(step.message) || !['discussion', 'engineering-review'].includes(step.intent) || step.delivery !== 'demo-only') throw new Error();
      }
    }
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
function touch(project, now) { project.revision++; project.updatedAt = now; return project; }

/**
 * Async host contract: the UI can receive a different repository implementing these methods.
 * This adapter performs no fetch, login, delivery or supplier approval. Values stay browser-local.
 * Optional Web Locks serialize cooperating browser tabs; revision checks also reject stale forms.
 */
export function createDemoProjectRepository(options = {}) {
  const key = options.key || PROJECT_STORAGE_KEY;
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
  const api = {
    mode: 'demo',
    async listProjects() { return cloneProjectValue(read().store.projects).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); },
    async getProject(projectId) { return cloneProjectValue(findProject(read().store, projectId)); },
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
          inquiry: { id: makeId('RFQ'), values: cloneProjectValue(saved.values), requirements: cloneProjectValue(saved.requirements), createdAt, reviewToken: review.token },
          quotes: [], changes: [], replies: [], nextSteps: [], createdAt, updatedAt: createdAt
        };
        store.projects.push(project); store.drafts = store.drafts.filter(item => item.id !== saved.id); return project;
      });
    },
    async createSampleQuote(projectId) {
      return change(store => {
        const project = findProject(store, projectId); assertSample(project);
        if (project.quotes.length) return project;
        const createdAt = now();
        project.quotes.push(sampleQuote({ id: makeId('QT'), version: 1, createdAt, values: project.inquiry.values }));
        return touch(project, createdAt);
      });
    },
    async requestRevision(review) {
      const packet = assertReview(review, 'revision');
      return change(store => {
        const project = findProject(store, packet.projectId); assertSample(project);
        if (project.changes.some(item => item.reviewToken === review.token)) return project;
        const quote = assertFreshProject(project, packet); reviewRevision(project, quote.id, packet.values);
        if (project.changes.some(item => item.quoteId === quote.id && !project.replies.some(reply => reply.changeId === item.id))) throw new ProjectError('CONFLICT', 'A change request already awaits a reply for this quotation.');
        const createdAt = now();
        project.changes.push({ id: makeId('CHG'), quoteId: quote.id, quoteVersion: quote.version, values: cloneProjectValue(packet.values), createdAt, reviewToken: review.token });
        return touch(project, createdAt);
      });
    },
    async simulateReply(projectId, changeId) {
      return change(store => {
        const project = findProject(store, projectId); assertSample(project);
        if (project.replies.some(item => item.changeId === changeId)) return project;
        const requested = project.changes.find(item => item.id === changeId);
        if (!requested) throw new ProjectError('NOT_FOUND', 'Choose a saved change request before opening an example reply.');
        const quote = project.quotes.find(item => item.id === requested.quoteId);
        if (quote?.id !== project.quotes.at(-1)?.id) throw new ProjectError('STALE_REVIEW', 'This change request belongs to an older quotation.');
        const createdAt = now(), reply = sampleSupplierReply({ id: makeId('REPLY'), createdAt, change: requested, quote, inquiry: project.inquiry });
        const revised = sampleQuote({ id: makeId('QT'), version: quote.version + 1, createdAt, values: { ...project.inquiry.values, quantity: requested.values.quantity, targetWeeks: requested.values.targetWeeks }, additionalQuestions: project.changes.map(item => item.values.notes), previousQuoteId: quote.id, changeId, replyId: reply.id });
        project.replies.push(reply); project.quotes.push(revised);
        return touch(project, createdAt);
      });
    },
    async confirmNextStep(review) {
      const packet = assertReview(review, 'next-step');
      return change(store => {
        const project = findProject(store, packet.projectId); assertSample(project);
        if (project.nextSteps.some(item => item.reviewToken === review.token)) return project;
        const quote = assertFreshProject(project, packet); reviewNextStep(project, quote.id, packet);
        if (project.changes.some(item => item.quoteId === quote.id && !project.replies.some(reply => reply.changeId === item.id))) throw new ProjectError('CONFLICT', 'Review the pending change response before confirming a next step.');
        const createdAt = now();
        project.nextSteps.push({ id: makeId('NEXT'), quoteId: quote.id, quoteVersion: quote.version, intent: packet.intent, message: packet.message, createdAt, delivery: 'demo-only', reviewToken: review.token });
        return touch(project, createdAt);
      });
    }
  };
  return Object.freeze(api);
}
