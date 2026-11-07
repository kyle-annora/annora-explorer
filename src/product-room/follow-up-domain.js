import {
  ProjectError, cloneProjectValue as copy, normalizeProjectContext,
  sameProjectValue, reviewedProjectValue, assertReview,
} from './project-domain.js';
import { normalizeInspectionReference } from '../explorer/inspection-reference.js';
import { validateProductStory, STORY_MAX_STEPS } from './story.js';
import { requestItemCollectionKey, requestItemTitle } from './request-items.js';
import { pendingClarification } from './project-state.js';

export const FOLLOW_UP_SCHEMA_VERSION = 1;
const text = value => typeof value === 'string' ? value.trim() : '';
const integer = value => Number.isSafeInteger(value) && value >= 0;
const date = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const fail = (message, fields = {}, code = 'VALIDATION') => { throw new ProjectError(code, message, fields); };
const identity = context => ({ id: context.modelId, revision: context.modelRevision });
const requests = project => project.inquiry?.requestItems || [];

function normalizeAction(value) {
  if (value === null || value === undefined) return null;
  if (value.kind === 'quotation' && text(value.quoteId) && integer(value.quoteVersion) && value.quoteVersion > 0)
    return { kind: 'quotation', quoteId: text(value.quoteId), quoteVersion: value.quoteVersion };
  if (value.kind === 'clarification' && text(value.messageId)) return { kind: 'clarification', messageId: text(value.messageId) };
  fail('Choose an existing quotation or open clarification.', { nextAction: 'Choose an available next action.' });
}

/** Authored content comes only from the inquiry's pinned release, never today's catalog. */
export function followUpCatalog(project, runtime = {}) {
  const context = project.context, entries = [], model = runtime.model || identity(context);
  const incompatibleModel = model.id !== context.modelId || model.revision !== context.modelRevision;
  const authored = context.roomSnapshot?.presentation?.story;
  for (const step of Array.isArray(authored?.steps) ? authored.steps : []) {
    const valid = validateProductStory({ version: authored.version, title: authored.title, steps: [step] }, {
      model, parts: runtime.parts || [], historical: !runtime.model,
    });
    entries.push({ id: `story:${step.id}`, source: 'released-story', sourceId: step.id,
      title: step.title || 'Unavailable story step', kind: step.kind, step: copy(step),
      available: !incompatibleModel && !valid.length, reason: incompatibleModel || valid.length ? 'This saved story step is not compatible with the available model or source.' : '' });
  }
  const captures = [
    ...requests(project).filter(item => item.context?.inspection).map(item => ({ id: `request:${item.id}`, sourceId: item.id,
      title: requestItemTitle(item), caption: item.notes, context: item.context })),
    ...(context.inspection ? [{ id: 'inquiry-inspection', sourceId: project.inquiry.id,
      title: context.part?.title || 'Saved inquiry view', caption: project.inquiry.values.application, context }] : []),
  ];
  for (const capture of captures) {
    let step = null, reason = '';
    try {
      if (incompatibleModel || requestItemCollectionKey(capture.context) !== requestItemCollectionKey(context)) throw new Error();
      const inspection = normalizeInspectionReference(capture.context.inspection, { model: identity(context) });
      if (!inspection.view) { reason = 'This saved tour position is not a prepared follow-up view. Choose a released story step.'; }
      else {
        // A thumbnail is not an executable view and is not needed by the story player.
        delete inspection.preview;
        step = { id: capture.id, title: capture.title.slice(0, 100), caption: (capture.caption || 'Review this saved component view.').slice(0, 320),
          kind: 'inspection', nodeId: inspection.view.selectedId, inspection };
        if (validateProductStory({ version: 1, title: 'Saved project views', steps: [step] }, {
          model, parts: runtime.parts || [], historical: !runtime.model,
        }).length) reason = 'The saved view is not compatible with the available model or source.';
      }
    } catch { reason = 'The saved view belongs to an unavailable or incompatible model revision.'; }
    entries.push({ id: capture.id, source: 'saved-inspection', sourceId: capture.sourceId, title: capture.title,
      kind: 'inspection', step, available: !reason, reason });
  }
  return entries;
}

export function followUpNextActions(project) {
  const entries = (project.quotes || []).map(quote => ({ id: `quotation:${quote.id}`, label: `Review quotation v${quote.version}`,
    action: { kind: 'quotation', quoteId: quote.id, quoteVersion: quote.version }, available: true, reason: '' }));
  const clarification = pendingClarification(project);
  if (clarification) entries.push({ id: `clarification:${clarification.id}`, label: 'Reply to the open clarification',
    action: { kind: 'clarification', messageId: clarification.id }, available: true, reason: '' });
  return entries;
}

/** Availability is live; the release itself remains an unchanged historical record. */
export function followUpActionAvailability(release, project) {
  const action = release?.nextAction;
  const label = action?.kind === 'quotation' ? `Review quotation v${action.quoteVersion}` : 'Reply to the clarification';
  if (!project || project.id !== release?.projectId) return { available: false, reason: 'This project is not available in this browser.', label, action };
  if (action?.kind === 'quotation') {
    const quote = project.quotes.find(item => item.id === action.quoteId && item.version === action.quoteVersion);
    return { available: !!quote, reason: quote ? '' : 'The exact quotation referenced by this follow-up is unavailable.', label, action };
  }
  if (action?.kind === 'clarification') {
    const exists = project.messages.some(item => item.id === action.messageId);
    const available = exists && pendingClarification(project)?.id === action.messageId;
    return { available, reason: available ? '' : exists ? 'This clarification is no longer awaiting a reply. Its original discussion remains in the project.' : 'The original clarification is unavailable.', label, action };
  }
  return { available: false, reason: 'This follow-up has no supported next action.', label: 'Next action unavailable', action };
}

export function createFollowUpDraft(project, id = `FOLLOW-UP-DRAFT-${globalThis.crypto.randomUUID()}`) {
  return { schemaVersion: FOLLOW_UP_SCHEMA_VERSION, id, revision: 0, projectId: project.id, projectRevision: project.revision,
    context: normalizeProjectContext(project.context), title: 'Your project follow-up', introduction: '',
    stepIds: [], requestItemIds: [], nextAction: null, updatedAt: null };
}

export function normalizeFollowUpDraft(input) {
  if (input?.schemaVersion !== FOLLOW_UP_SCHEMA_VERSION || !text(input.id) || text(input.id).length > 160
      || !integer(input.revision) || !text(input.projectId) || !integer(input.projectRevision) || input.projectRevision < 1)
    fail('This follow-up has no valid project identity or revision.');
  for (const [key, max] of [['title', 100], ['introduction', 1200]])
    if (typeof input[key] !== 'string' || input[key].length > max) fail(`Keep ${key} within ${max} characters.`, { [key]: `Use up to ${max} characters.` });
  for (const [key, max] of [['stepIds', STORY_MAX_STEPS], ['requestItemIds', 12]])
    if (!Array.isArray(input[key]) || input[key].length > max || input[key].some(id => !text(id) || text(id) !== id || id.length > 300)
        || new Set(input[key]).size !== input[key].length) fail('Keep each follow-up selection unique and within its limit.', { [key]: `Choose up to ${max} distinct items.` });
  if (input.updatedAt !== null && !date(input.updatedAt)) fail('This follow-up has an invalid saved date.');
  return { schemaVersion: FOLLOW_UP_SCHEMA_VERSION, id: text(input.id), revision: input.revision, projectId: text(input.projectId),
    projectRevision: input.projectRevision, context: normalizeProjectContext(input.context), title: text(input.title), introduction: text(input.introduction),
    stepIds: [...input.stepIds], requestItemIds: [...input.requestItemIds], nextAction: normalizeAction(input.nextAction), updatedAt: input.updatedAt };
}

export function assertFollowUpProject(project, draft, code = 'STALE_REVIEW') {
  if (project.id !== draft.projectId || project.revision !== draft.projectRevision || !sameProjectValue(project.context, draft.context))
    fail('This project changed. Reopen the current project and review the follow-up again. Your saved work has not been replaced.', {}, code);
}

/** Incomplete drafts are saveable; executable selections and the next action need review. */
export function reviewFollowUp(project, input) {
  const draft = normalizeFollowUpDraft(input), fields = {};
  assertFollowUpProject(project, draft);
  if (draft.revision < 1) fail('Save the follow-up before reviewing it.', {}, 'STALE_REVIEW');
  if (!draft.title) fields.title = 'Name this follow-up.';
  const catalog = followUpCatalog(project), selected = draft.stepIds.map(id => catalog.find(item => item.id === id));
  if (!selected.length) fields.stepIds = 'Choose at least one released story step or saved view.';
  else if (selected.some(item => !item?.available)) fields.stepIds = 'A selected source is unavailable. Remove it or choose another saved source.';
  const agenda = draft.requestItemIds.map(id => requests(project).find(item => item.id === id));
  if (agenda.some(item => !item) || (requests(project).length && !agenda.length)) fields.requestItemIds = 'Choose the existing customer requests this follow-up addresses.';
  const availability = followUpActionAvailability({ projectId: project.id, nextAction: draft.nextAction }, project);
  if (!availability.available) fields.nextAction = availability.reason;
  if (Object.keys(fields).length) fail('Review the highlighted follow-up details.', fields);
  const snapshot = { projectId: project.id, projectRevision: project.revision, context: copy(project.context), title: draft.title, introduction: draft.introduction,
    story: { version: 1, title: draft.title, steps: selected.map(entry => ({ ...copy(entry.step), id: entry.id })) },
    sources: selected.map(({ id, source, sourceId, step }) => ({ id, source, sourceId, step: copy(step) })),
    agenda: copy(agenda), nextAction: copy(draft.nextAction) };
  return reviewedProjectValue({ kind: 'follow-up', draft, snapshot });
}

export function createFollowUpRelease(review, { id, version, createdAt }) {
  const packet = assertReview(review, 'follow-up');
  if (!text(id) || !integer(version) || version < 1 || !date(createdAt)) fail('A follow-up release needs its identity, version and confirmation time.');
  return { schemaVersion: FOLLOW_UP_SCHEMA_VERSION, id, version, ...copy(packet.snapshot), createdAt, reviewToken: review.token, delivery: 'demo-only' };
}

export function createFollowUpProgress(release) {
  return { schemaVersion: FOLLOW_UP_SCHEMA_VERSION, followUpId: release.id, revision: 0, stepId: release.story.steps[0].id, mode: 'paused', updatedAt: null };
}

export function normalizeFollowUpProgress(release, input) {
  if (!integer(input?.revision) || !release.story.steps.some(step => step.id === input.stepId)
      || !['paused', 'exploring', 'complete'].includes(input.mode)) fail('Choose a valid step in this follow-up revision.');
  return { schemaVersion: FOLLOW_UP_SCHEMA_VERSION, followUpId: release.id, revision: input.revision, stepId: input.stepId, mode: input.mode,
    updatedAt: input.updatedAt ?? null };
}

/** Optional fields preserve legacy stores exactly. Historical actions need not remain open. */
export function validateFollowUpStore(store) {
  for (const key of ['followUpDrafts', 'followUps', 'followUpProgress']) {
    if (store[key] !== undefined && !Array.isArray(store[key])) throw new Error('Invalid follow-up collection.');
  }
  const drafts = store.followUpDrafts || [], releases = store.followUps || [], progress = store.followUpProgress || [];
  if (new Set(drafts.map(item => item.id)).size !== drafts.length || new Set(drafts.map(item => item.projectId)).size !== drafts.length
      || new Set(releases.map(item => item.id)).size !== releases.length || new Set(releases.map(item => item.reviewToken)).size !== releases.length
      || new Set(progress.map(item => item.followUpId)).size !== progress.length) throw new Error('Duplicate follow-up identity.');
  for (const draft of drafts) {
    const project = store.projects.find(item => item.id === draft.projectId);
    if (!project || !sameProjectValue(normalizeFollowUpDraft(draft), draft) || draft.revision < 1 || !date(draft.updatedAt)
        || draft.projectRevision > project.revision || !sameProjectValue(draft.context, project.context)) throw new Error('Invalid follow-up draft.');
  }
  for (const release of releases) {
    const project = store.projects.find(item => item.id === release.projectId);
    if (!project || release.schemaVersion !== FOLLOW_UP_SCHEMA_VERSION || !text(release.id) || !date(release.createdAt)
        || !integer(release.version) || release.version < 1 || release.delivery !== 'demo-only' || !text(release.reviewToken)
        || !sameProjectValue(release.context, project.context) || release.projectRevision > project.revision) throw new Error('Invalid follow-up release.');
    const packet = JSON.parse(release.reviewToken), reviewed = { ...packet, token: release.reviewToken };
    assertReview(reviewed, 'follow-up');
    if (!sameProjectValue(createFollowUpRelease(reviewed, release), release)) throw new Error('Follow-up snapshot changed.');
    // Rebuild against the historical project revision and exact action. This
    // validates sources without demanding that a past clarification is open now.
    const action = packet.snapshot.nextAction;
    const historical = { ...project, revision: release.projectRevision,
      messages: project.messages.filter(message => message.projectRevision <= release.projectRevision),
      quotes: project.quotes.filter(quote => !quote.issuedProjectRevision || quote.issuedProjectRevision <= release.projectRevision) };
    if (!sameProjectValue(reviewFollowUp(historical, packet.draft), reviewed)) throw new Error('Follow-up sources changed.');
    if (action.kind === 'quotation' && !project.quotes.some(quote => quote.id === action.quoteId && quote.version === action.quoteVersion)) throw new Error('Missing pinned quotation.');
    const versions = releases.filter(item => item.projectId === project.id).map(item => item.version).sort((a, b) => a - b);
    if (versions.some((version, index) => version !== index + 1)) throw new Error('Invalid follow-up version history.');
  }
  for (const record of progress) {
    const release = releases.find(item => item.id === record.followUpId);
    if (!release || record.revision < 1 || !date(record.updatedAt)
        || !sameProjectValue(normalizeFollowUpProgress(release, record), record)) throw new Error('Invalid follow-up progress.');
  }
}
