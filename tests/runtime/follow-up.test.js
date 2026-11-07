import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoProjectRepository, parseProjectStore, PROJECT_STORAGE_KEY } from '../../src/product-room/project-repository.js';
import { reviewInquiry } from '../../src/product-room/project-domain.js';
import { reviewReply, reviewCustomerReply, reviewQuote } from '../../src/product-room/seller-domain.js';
import { followUpCatalog, followUpNextActions, followUpActionAvailability, reviewFollowUp } from '../../src/product-room/follow-up-domain.js';
import { BUNDLED_RELEASE, STUDIO_MODEL as model, STUDIO_PARTS as parts } from '../../src/studio/seed.js';

const copy = value => structuredClone(value);
const identity = { id: model.id, revision: model.revision };
const inspection = { version: '1', model: identity, view: { viewVersion: '0.1', model: identity,
  coordinateFrame: 'normalized-assembly-v1', selectedId: 'rod', scopeId: model.rootId, isolated: false,
  mode: 'explore', renderStyle: 'engineering', separation: 0, operation: null,
  displayOptions: { appearance: 'light', grid: true, ambientOcclusion: true, featureEdges: true, hiddenEdges: false, lineWeight: 'standard' },
  camera: { position: [2, 3, 8], target: [0, 0, 0], up: [0, 1, 0], projection: { kind: 'perspective', verticalFovDegrees: 42, zoom: 1, offsetX: 0, offsetY: 0 }, viewport: { width: 1200, height: 800 } },
} };
const story = { version: 1, title: 'The linkage', steps: [
  { id: 'close', title: 'Connecting rod', caption: 'Two pivots connect rotary input and linear output.', kind: 'inspection', nodeId: 'rod', inspection },
  { id: 'move', title: 'Follow one cycle', caption: 'The guide keeps the slider straight.', kind: 'chapter', nodeId: 'crank', tourId: model.tour.id, chapterId: 'motion' },
] };
const release = { ...copy(BUNDLED_RELEASE), presentation: { defaultRenderStyle: 'engineering', story } };
const context = { productId: release.productId, productTitle: release.content.title, modelId: model.id, modelRevision: model.revision,
  roomReleaseId: release.id, inquiryProfileVersion: release.inquiryProfile.version, inquiryProfile: release.inquiryProfile, roomSnapshot: release };

function setup() {
  let serial = 0, blocked = false;
  const data = new Map(), storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => {
    if (blocked) throw new Error('Quota exceeded'); data.set(key, value);
  } };
  const options = { storage, locks: null, makeId: prefix => `${prefix}-${++serial}`, now: () => '2026-11-06T12:00:00.000Z' };
  return { data, storage, options, repo: createDemoProjectRepository(options), block: value => { blocked = value; } };
}
async function projectFixture(repo, selectedContext = context) {
  let draft = await repo.getDraft(copy(selectedContext));
  draft.values = { ...draft.values, application: 'Review two mounting details.', quantity: '20', intent: 'quotation' };
  draft.requestItems = [
    { id: 'request-rod', purpose: 'review', notes: 'Review the connecting rod clearance.', context: { ...copy(selectedContext), part: { id: 'rod', title: 'Connecting rod' }, inspection: copy(inspection) } },
    { id: 'request-guide', purpose: 'change', notes: 'Can the guide be longer?', context: { ...copy(selectedContext), part: { id: 'guide', title: 'Linear guide' } } },
  ];
  draft = await repo.saveDraft(draft);
  const submitted = await repo.submitInquiry(reviewInquiry(draft));
  return repo.createSampleQuote(submitted.id);
}
async function savedFollowUp(repo, project, action) {
  let draft = await repo.getFollowUpDraft(project.id);
  Object.assign(draft, { title: 'Review your mounting questions', introduction: 'See the two details before reviewing the proposal.',
    stepIds: ['story:close', 'story:move'], requestItemIds: ['request-rod', 'request-guide'],
    nextAction: action || { kind: 'quotation', quoteId: project.quotes[0].id, quoteVersion: 1 } });
  return repo.saveFollowUpDraft(draft);
}
async function published(repo, project, action) {
  await savedFollowUp(repo, project, action);
  return repo.publishFollowUp(await repo.reviewFollowUp(project.id), { confirmed: true });
}

test('follow-up source catalog uses only the exact inquiry release and compatible saved inspections', async () => {
  const { repo } = setup(), project = await projectFixture(repo), catalog = followUpCatalog(project, { model, parts });
  assert.deepEqual(catalog.map(item => item.id), ['story:close', 'story:move', 'request:request-rod']);
  assert.ok(catalog.every(item => item.available));
  assert.equal(catalog[2].step.inspection.view.selectedId, 'rod');
  const legacy = copy(project); delete legacy.context.roomSnapshot;
  assert.equal(followUpCatalog(legacy).some(item => item.source === 'released-story'), false);
  assert.deepEqual(followUpNextActions(project)[0].action, { kind: 'quotation', quoteId: project.quotes[0].id, quoteVersion: 1 });
  const removed = followUpCatalog(project, { model, parts: parts.filter(item => item.id !== 'rod') });
  assert.equal(removed.find(item => item.id === 'story:close').available, false);
  assert.equal(removed.find(item => item.id === 'request:request-rod').available, false);
});

test('draft save and review do not mutate the confirmed inquiry, quote, project or product release', async () => {
  const { repo, storage } = setup(), project = await projectFixture(repo), before = copy(project), originalRelease = copy(release);
  const fresh = await repo.getFollowUpDraft(project.id);
  assert.equal(fresh.revision, 0); assert.deepEqual(fresh.stepIds, []);
  await repo.saveFollowUpDraft(fresh);
  await assert.rejects(repo.reviewFollowUp(project.id), error => !!error.fields.stepIds && !!error.fields.requestItemIds && !!error.fields.nextAction);
  const draft = await savedFollowUp(repo, project), reviewed = await repo.reviewFollowUp(project.id);
  assert.deepEqual(reviewed.snapshot.agenda, project.inquiry.requestItems);
  assert.deepEqual(reviewed.snapshot.story.steps.map(item => item.id), draft.stepIds);
  assert.deepEqual(await repo.getProject(project.id), before);
  assert.deepEqual(release, originalRelease);
  assert.equal(parseProjectStore(storage.getItem(PROJECT_STORAGE_KEY)).followUps, undefined);
});

test('confirmation is explicit, review is sealed, repeated confirmation is idempotent and history stays immutable', async () => {
  const { repo } = setup(), project = await projectFixture(repo);
  await savedFollowUp(repo, project);
  const reviewed = await repo.reviewFollowUp(project.id);
  await assert.rejects(repo.publishFollowUp(reviewed), { code: 'CONFIRMATION_REQUIRED' });
  const tampered = copy(reviewed); tampered.snapshot.title = 'Unreviewed';
  await assert.rejects(repo.publishFollowUp(tampered, { confirmed: true }), { code: 'STALE_REVIEW' });
  const first = await repo.publishFollowUp(reviewed, { confirmed: true });
  assert.deepEqual(await repo.publishFollowUp(reviewed, { confirmed: true }), first);
  let draft = await repo.getFollowUpDraft(project.id); draft.title = 'A revised follow-up'; draft.stepIds.reverse();
  draft = await repo.saveFollowUpDraft(draft);
  const second = await repo.publishFollowUp(await repo.reviewFollowUp(project.id), { confirmed: true });
  assert.equal(first.version, 1); assert.equal(second.version, 2);
  assert.deepEqual(await repo.getFollowUp(first.id), first);
  assert.deepEqual((await repo.listFollowUps(project.id)).map(item => item.version), [1, 2]);
  first.title = 'External mutation';
  assert.notEqual((await repo.getFollowUp(first.id)).title, first.title);
  assert.deepEqual(await repo.getProject(project.id), project);
});

test('draft and progress conflicts are explicit, including a different tab at the same project', async () => {
  const { repo, options } = setup(), project = await projectFixture(repo);
  const old = await savedFollowUp(repo, project), other = createDemoProjectRepository(options);
  await other.saveFollowUpDraft({ ...old, introduction: 'Edited in another tab.' });
  await assert.rejects(repo.saveFollowUpDraft({ ...old, title: 'Stale edit' }), { code: 'CONFLICT' });
  const followUp = await repo.publishFollowUp(await repo.reviewFollowUp(project.id), { confirmed: true });
  const position = await repo.getFollowUpProgress(followUp.id);
  await other.saveFollowUpProgress(followUp.id, { ...position, stepId: followUp.story.steps[1].id, mode: 'exploring' });
  await assert.rejects(repo.saveFollowUpProgress(followUp.id, { ...position, mode: 'complete' }), { code: 'CONFLICT' });
  assert.deepEqual(await repo.getFollowUp(followUp.id), followUp);
});

test('review rejects a stale draft or changed project and does not overwrite new confirmed facts', async () => {
  const { repo } = setup(), project = await projectFixture(repo);
  let draft = await savedFollowUp(repo, project), reviewed = await repo.reviewFollowUp(project.id);
  draft = await repo.saveFollowUpDraft({ ...draft, introduction: 'New text needs new review.' });
  await assert.rejects(repo.publishFollowUp(reviewed, { confirmed: true }), { code: 'STALE_REVIEW' });
  reviewed = await repo.reviewFollowUp(project.id);
  const updated = await repo.sendReply(reviewReply(project, { kind: 'clarification', body: 'Please confirm the clearance.' }));
  await assert.rejects(repo.publishFollowUp(reviewed, { confirmed: true }), { code: 'STALE_REVIEW' });
  await assert.rejects(repo.saveFollowUpDraft(draft), { code: 'CONFLICT' });
  assert.deepEqual(await repo.getProject(project.id), updated);
  assert.deepEqual((await repo.getFollowUpDraft(project.id)).introduction, draft.introduction);
});

test('storage failure preserves saved draft and retry publishes exactly one local version', async () => {
  const fixture = setup(), { repo, storage } = fixture, project = await projectFixture(repo);
  const draft = await savedFollowUp(repo, project), reviewed = await repo.reviewFollowUp(project.id), saved = storage.getItem(PROJECT_STORAGE_KEY);
  fixture.block(true);
  await assert.rejects(repo.saveFollowUpDraft({ ...draft, title: 'Keep this unsaved input' }), { code: 'STORAGE_UNAVAILABLE' });
  await assert.rejects(repo.publishFollowUp(reviewed, { confirmed: true }), { code: 'STORAGE_UNAVAILABLE' });
  assert.equal(storage.getItem(PROJECT_STORAGE_KEY), saved);
  fixture.block(false);
  const followUp = await repo.publishFollowUp(reviewed, { confirmed: true });
  assert.deepEqual(await repo.publishFollowUp(reviewed, { confirmed: true }), followUp);
  assert.equal((await repo.listFollowUps(project.id)).length, 1);
});

test('playback progress is revision-scoped, persisted and never a project action or automatic play receipt', async () => {
  const { repo, options } = setup(), project = await projectFixture(repo), first = await published(repo, project);
  const initial = await repo.getFollowUpProgress(first.id);
  assert.equal(initial.mode, 'paused'); assert.equal(initial.revision, 0);
  const progress = await repo.saveFollowUpProgress(first.id, { ...initial, stepId: first.story.steps[1].id, mode: 'exploring' });
  assert.deepEqual(await createDemoProjectRepository(options).getFollowUpProgress(first.id), progress);
  await assert.rejects(repo.saveFollowUpProgress(first.id, { ...progress, stepId: 'missing' }), { code: 'VALIDATION' });
  let draft = await repo.getFollowUpDraft(project.id); draft.title = 'Second edition'; await repo.saveFollowUpDraft(draft);
  const second = await repo.publishFollowUp(await repo.reviewFollowUp(project.id), { confirmed: true });
  assert.equal((await repo.getFollowUpProgress(second.id)).revision, 0);
  assert.deepEqual(await repo.getFollowUpProgress(first.id), progress);
  assert.deepEqual(await repo.getProject(project.id), project);
});

test('exact quotation v1 stays pinned and readable after quotation v2', async () => {
  const { repo } = setup(); let project = await projectFixture(repo);
  const followUp = await published(repo, project), original = copy(followUp);
  let draft = await repo.getQuoteDraft(project.id); draft.values.scope = 'Revised guide length';
  draft.values.lineItems.forEach(item => { if (!Number(item.quantity)) item.quantity = '1'; });
  draft = await repo.saveQuoteDraft(draft);
  project = await repo.issueQuote(reviewQuote(project, draft));
  assert.equal(project.quotes.length, 2);
  assert.equal(followUpActionAvailability(followUp, project).available, true);
  assert.equal(followUpActionAvailability(followUp, project).action.quoteId, project.quotes[0].id);
  assert.deepEqual(await repo.getFollowUp(followUp.id), original);
});

test('answered clarification becomes unavailable while the historical follow-up remains readable', async () => {
  const { repo } = setup(); let project = await projectFixture(repo);
  project = await repo.sendReply(reviewReply(project, { kind: 'clarification', body: 'Please confirm the clearance.' }));
  const message = project.messages.at(-1), followUp = await published(repo, project, { kind: 'clarification', messageId: message.id });
  assert.equal(followUpActionAvailability(followUp, project).available, true);
  project = await repo.sendCustomerReply(reviewCustomerReply(project, { replyTo: message.id, body: 'Please allow 5 mm.' }));
  const state = followUpActionAvailability(followUp, project);
  assert.equal(state.available, false); assert.match(state.reason, /no longer awaiting/);
  assert.deepEqual(await repo.getFollowUp(followUp.id), followUp);
  assert.equal((await repo.listFollowUps(project.id)).length, 1);
});

test('unavailable sources are visible and block review without losing saved choices', async () => {
  const { repo } = setup(), project = await projectFixture(repo);
  const draft = await savedFollowUp(repo, project);
  await repo.saveFollowUpDraft({ ...draft, stepIds: ['story:missing'] });
  await assert.rejects(repo.reviewFollowUp(project.id), error => /unavailable/.test(error.fields.stepIds));
  assert.deepEqual((await repo.getFollowUpDraft(project.id)).stepIds, ['story:missing']);
  const altered = copy(project); altered.context.roomSnapshot.presentation.story.steps[0].inspection.model.revision = 'another';
  assert.equal(followUpCatalog(altered)[0].available, false);
  const invalidTarget = copy(draft); invalidTarget.nextAction.quoteVersion = 99;
  assert.throws(() => reviewFollowUp(project, invalidTarget), error => /exact quotation/.test(error.fields.nextAction));
});

test('historical stores without follow-ups remain byte-shape compatible; malformed new history is rejected', async () => {
  const { repo, storage } = setup(), project = await projectFixture(repo);
  const original = JSON.parse(storage.getItem(PROJECT_STORAGE_KEY));
  assert.deepEqual(parseProjectStore(JSON.stringify(original)), original);
  assert.equal(Object.hasOwn(original, 'followUps'), false);
  const released = await published(repo, project), valid = storage.getItem(PROJECT_STORAGE_KEY);
  const malformed = JSON.parse(valid); malformed.followUps[0].story.steps[0].caption = 'Changed after confirmation';
  assert.throws(() => parseProjectStore(JSON.stringify(malformed)), { code: 'STORAGE_CORRUPT' });
  await assert.rejects(createDemoProjectRepository({ storage: { getItem: () => null, setItem() {} }, locks: null }).getFollowUp(released.id), { code: 'NOT_FOUND' });
});
