import test from 'node:test';
import assert from 'node:assert/strict';
import { createInquirySession, prepareInquirySubmission, confirmInquirySubmission } from '../../src/product-room/inquiry-session.js';
import { createDemoProjectRepository } from '../../src/product-room/project-repository.js';

const context = { productId: 'kinetic-01', productTitle: 'Crank-slider mechanism', modelId: 'kinetic-01', modelRevision: 'kinetic-r1', part: { id: 'guide', title: 'Linear guide' } };
const otherPart = { ...context, part: { id: 'rod', title: 'Connecting rod' } };
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
function setup(options = {}) {
  const data = new Map(); let serial = 0;
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  const repository = createDemoProjectRepository({ storage, locks: null, makeId: prefix => `${prefix}-${++serial}`, now: () => '2026-11-05T12:00:00.000Z' });
  const timers = new Map(); let timerId = 0;
  const session = createInquirySession({ repository: options.wrap?.(repository) || repository, schedule: fn => { const id = ++timerId; timers.set(id, fn); return id; }, cancel: id => timers.delete(id) });
  return { repository, session, storage, timers };
}

test('contextual entries resume one draft without replacing pinned context or changing intent', async () => {
  const { session, repository } = setup();
  await session.open({ context, suggestedIntent: 'application-review', suggestedScope: 'discuss' });
  const id = session.getState().draft.id;
  session.updateValues({ application: 'Check the installation envelope.' });
  await session.open({ context: otherPart, suggestedIntent: 'quotation', suggestedScope: 'part' });
  assert.equal(session.getState().draft.id, id);
  assert.equal(session.getState().draft.values.intent, 'application-review');
  assert.equal(session.getContext().part.id, 'guide');
  assert.match(session.getState().notice, /keeps its saved view/);
  assert.equal(await session.beforeLeave(), true);
  assert.equal((await repository.listDrafts()).length, 1);
  session.dispose();
});

test('saved draft reopening ignores fresh-entry suggestions and preserves its revision', async () => {
  const { session, repository } = setup();
  const saved = await repository.saveDraft({ ...await repository.getDraft(context), values: { ...(await repository.getDraft(context)).values, intent: 'application-review', application: 'Saved consultation', quantity: '' } });
  await session.open({ context: otherPart, suggestedIntent: 'quotation', suggestedScope: 'product' });
  const loaded = session.getState().draft;
  assert.equal(loaded.id, saved.id); assert.equal(loaded.revision, saved.revision);
  assert.equal(loaded.values.intent, 'application-review'); assert.equal(loaded.context.part.id, 'guide');
  session.dispose();
});

test('application review can confirm unknown quantity through the same project repository', async () => {
  const { session, repository } = setup();
  await session.open({ context, suggestedIntent: 'application-review' });
  session.updateValues({ application: 'Review this mounting arrangement.' });
  const review = await session.review();
  assert.equal(review.draft.values.quantity, ''); assert.equal(session.getState().stage, 'review');
  const project = await session.confirm();
  assert.equal(project.inquiry.values.intent, 'application-review');
  assert.equal(project.inquiry.values.quantity, '');
  assert.equal((await repository.getSellerProject(project.id)).inquiry.id, project.inquiry.id);
  assert.equal((await repository.listProjects()).length, 1);
  assert.equal((await repository.listDrafts()).length, 0);
  assert.deepEqual(await session.confirm(), project);
  await session.open({ context: otherPart });
  assert.equal(session.getState().stage, 'confirmed');
  session.dispose();
});

test('starting another inquiry captures a fresh draft and preserves the original confirmed project', async () => {
  const { session, repository } = setup(), capture = deferred();
  await session.open({ context, suggestedIntent: 'application-review' });
  session.updateValues({ application: 'Original consultation.' });
  const originalReview = await session.review(), originalDraftId = originalReview.draft.id;
  const project = await session.confirm(), original = structuredClone(project);
  assert.deepEqual(await session.confirm(), original);
  const starting = session.startAnother({ capture: () => capture.promise });
  await tick();
  assert.equal(session.getState().stage, 'confirmed');
  assert.equal(session.getState().project.id, original.id);
  assert.equal(session.getState().draft, null);
  capture.resolve(otherPart); await starting;
  const next = session.getState().draft;
  assert.notEqual(next.id, originalDraftId); assert.equal(next.revision, 0);
  assert.equal(next.values.intent, 'quotation'); assert.equal(next.values.application, '');
  assert.equal(next.values.quantity, ''); assert.equal(next.context.part.id, 'rod');
  assert.equal(session.getState().stage, 'details');
  assert.equal(session.getState().project, null);
  assert.deepEqual(await repository.getProject(original.id), original);
  assert.equal((await repository.listProjects()).length, 1);
  await assert.rejects(session.confirm(), { code: 'STALE_REVIEW' });
  assert.deepEqual(await confirmInquirySubmission({ repository, review: originalReview }), original);
  assert.equal((await repository.listProjects()).length, 1);
  await session.beforeLeave();
  assert.equal((await repository.listDrafts()).length, 1);
  session.dispose();
});

test('failed new-inquiry capture or draft read keeps the confirmed receipt available', async () => {
  let failRead = false;
  const { session, repository } = setup({ wrap: repo => ({ ...repo, getDraft: input => failRead ? Promise.reject(new Error('Draft storage is unavailable.')) : repo.getDraft(input) }) });
  await session.open({ context }); session.updateValues({ application: 'Confirmed request.', quantity: '12' });
  await session.review(); const project = await session.confirm();
  await assert.rejects(session.startAnother({ capture: () => Promise.reject(new Error('Capture is unavailable.')) }), /Capture is unavailable/);
  assert.equal(session.getState().stage, 'confirmed'); assert.equal(session.getState().project.id, project.id);
  failRead = true;
  await assert.rejects(session.startAnother({ capture: () => otherPart }), /Draft storage is unavailable/);
  assert.equal(session.getState().stage, 'confirmed'); assert.equal(session.getState().project.id, project.id);
  assert.equal(session.getState().draft, null);
  assert.equal((await repository.listDrafts()).length, 0);
  assert.equal((await repository.listProjects()).length, 1);
  session.dispose();
});

test('quotation review validates quantity and keeps incomplete input editable', async () => {
  const { session } = setup();
  await session.open({ context });
  session.updateValues({ application: 'Quote the whole mechanism.' });
  await assert.rejects(session.review(), error => error.code === 'VALIDATION' && Boolean(error.fields.quantity));
  assert.equal(session.getState().stage, 'details');
  assert.equal(session.getState().draft.values.application, 'Quote the whole mechanism.');
  session.updateValues({ quantity: '12' });
  await session.review();
  assert.throws(() => session.updateValues({ quantity: '30' }), { code: 'STALE_REVIEW' });
  session.edit(); session.updateValues({ quantity: '30' });
  await assert.rejects(session.confirm(), { code: 'STALE_REVIEW' });
  await session.review();
  assert.equal((await session.confirm()).inquiry.values.quantity, '30');
  session.dispose();
});

test('explicit reference adoption preserves entered values and resets part-dependent claims', async () => {
  const { session } = setup();
  await session.open({ context, suggestedScope: 'part' });
  session.updateValues({ application: 'Check the guide.', quantity: '12', stroke: '70' });
  session.updateRequirements([{ id: 'stroke-confirmed', label: 'Required stroke', value: '70', unit: 'mm', source: 'customer', confirmed: true, part: context.part }]);
  await session.adopt(otherPart);
  const draft = session.getState().draft;
  assert.equal(draft.context.part.id, 'rod'); assert.equal(draft.values.quoteScope, 'discuss');
  assert.equal(draft.values.application, 'Check the guide.'); assert.equal(draft.values.stroke, '70');
  assert.deepEqual(draft.requirements, []);
  session.dispose();
});

test('adopting another revision is rejected without replacing the reference or values', async () => {
  const { session } = setup();
  await session.open({ context }); session.updateValues({ application: 'Keep this question.', quantity: '5' });
  await assert.rejects(session.adopt({ ...context, modelRevision: 'kinetic-r2' }), { code: 'INCOMPATIBLE_CONTEXT' });
  assert.equal(session.getContext().modelRevision, 'kinetic-r1');
  assert.equal(session.getState().draft.values.application, 'Keep this question.');
  session.dispose();
});

test('capture failure preserves input and review is forbidden while capture is pending', async () => {
  const gate = deferred(), { session } = setup();
  await session.open({ context }); session.updateValues({ application: 'Pending capture question.' });
  const capturing = session.capture(() => gate.promise);
  await assert.rejects(session.review(), { code: 'BUSY_STATE' });
  gate.reject(new Error('The source is still moving.'));
  await assert.rejects(capturing, /still moving/);
  assert.equal(session.getState().draft.values.application, 'Pending capture question.');
  assert.equal(session.getContext().part.id, 'guide');
  session.dispose();
});

test('failed persistence blocks leaving and retains values until a successful retry', async () => {
  let fail = true;
  const { session, repository } = setup({ wrap: repo => ({ ...repo, saveDraft: input => fail ? Promise.reject(Object.assign(new Error('Storage is unavailable.'), { code: 'STORAGE_UNAVAILABLE' })) : repo.saveDraft(input) }) });
  await session.open({ context }); session.updateValues({ application: 'Do not lose this input.', quantity: '8' });
  assert.equal(await session.beforeLeave(), false);
  assert.equal(session.getState().draft.values.application, 'Do not lose this input.');
  assert.equal(session.getState().dirty, true);
  fail = false; assert.equal(await session.beforeLeave(), true);
  assert.equal(session.getState().dirty, false);
  assert.equal((await repository.getDraft(context)).values.application, 'Do not lose this input.');
  session.dispose();
});

test('normalized save becomes clean, while typing during an in-flight save survives', async () => {
  let gate = deferred(), wait = true;
  const { session, repository } = setup({ wrap: repo => ({ ...repo, saveDraft: async input => { if (wait) await gate.promise; return repo.saveDraft(input); } }) });
  await session.open({ context }); session.updateValues({ application: ' first question ', quantity: '12' });
  const saving = session.save(); await tick();
  session.updateValues({ application: ' second question ' });
  gate.resolve(); await saving;
  assert.equal(session.getState().draft.values.application, ' second question ');
  assert.equal(session.getState().dirty, true);
  wait = false; await session.save();
  assert.equal(session.getState().draft.values.application, 'second question');
  assert.equal(session.getState().dirty, false);
  assert.equal((await repository.getDraft(context)).values.application, 'second question');
  session.dispose();
});

test('beforeLeave waits for pending save and persists edits made during it', async () => {
  const gate = deferred(); let waiting = true;
  const { session, repository } = setup({ wrap: repo => ({ ...repo, saveDraft: async input => { if (waiting) await gate.promise; return repo.saveDraft(input); } }) });
  await session.open({ context }); session.updateValues({ application: 'First', quantity: '4' });
  const saving = session.save(); await tick();
  session.updateValues({ application: 'Last entered value' });
  let finished = false;
  const leaving = session.beforeLeave().then(value => { finished = true; return value; });
  await tick(); assert.equal(finished, false);
  waiting = false; gate.resolve(); await saving;
  assert.equal(await leaving, true);
  assert.equal((await repository.getDraft(context)).values.application, 'Last entered value');
  session.dispose();
});

test('beforeLeave waits for an opening draft and saves its pinned reference before departure', async () => {
  const gate = deferred();
  const { session, repository } = setup({ wrap: repo => ({ ...repo, getDraft: async input => { await gate.promise; return repo.getDraft(input); } }) });
  const opening = session.open({ context, suggestedIntent: 'application-review' });
  await tick();
  let finished = false;
  const leaving = session.beforeLeave().then(value => { finished = true; return value; });
  await tick(); assert.equal(finished, false);
  gate.resolve(); await opening;
  assert.equal(await leaving, true);
  assert.equal((await repository.getDraft(context)).revision, 1);
  assert.equal((await repository.getDraft(context)).values.intent, 'application-review');
  session.dispose();
});

test('a newer saved draft rejects confirmation and preserves the reviewed input', async () => {
  const { session, repository } = setup();
  await session.open({ context }); session.updateValues({ application: 'Original review', quantity: '12' });
  const review = await session.review();
  await repository.saveDraft({ ...review.draft, values: { ...review.draft.values, quantity: '99' } });
  await assert.rejects(session.confirm(), { code: 'STALE_REVIEW' });
  assert.equal(session.getState().stage, 'review');
  assert.equal(session.getState().draft.values.quantity, '12');
  assert.equal((await repository.listProjects()).length, 0);
  session.dispose();
});

test('explicit load of the saved draft recovers stale review and requires a fresh review', async () => {
  const { session, repository } = setup();
  await session.open({ context }); session.updateValues({ application: 'Local reviewed application', quantity: '12' });
  const review = await session.review();
  const remote = await repository.saveDraft({ ...review.draft, context: otherPart, values: { ...review.draft.values, application: 'Saved in another tab', quantity: '99' } });
  await assert.rejects(session.confirm(), { code: 'STALE_REVIEW' });
  await session.open({ context });
  assert.equal(session.getState().draft.values.application, 'Local reviewed application');
  assert.equal(session.getContext().part.id, 'guide');
  const loaded = await session.loadSavedDraft();
  assert.deepEqual(loaded, remote);
  assert.equal(session.getState().stage, 'details');
  assert.equal(session.getState().review, null);
  assert.equal(session.getState().dirty, false);
  assert.equal(session.getContext().part.id, 'rod');
  await assert.rejects(session.confirm(), { code: 'STALE_REVIEW' });
  session.updateValues({ application: 'Reviewed saved application with my addition' });
  await session.review();
  const project = await session.confirm();
  assert.equal(project.inquiry.values.quantity, '99');
  assert.equal(project.inquiry.values.application, 'Reviewed saved application with my addition');
  assert.equal((await repository.listProjects()).length, 1);
  session.dispose();
});

test('failed saved-draft reload leaves unsaved local edits and original reference intact', async () => {
  let failRead = false;
  const { session, repository } = setup({ wrap: repo => ({ ...repo, getDraft: input => failRead ? Promise.reject(new Error('Storage cannot be read.')) : repo.getDraft(input) }) });
  await session.open({ context }); session.updateValues({ application: 'Original', quantity: '12' });
  await session.save();
  const saved = await repository.getDraft(context);
  await repository.saveDraft({ ...saved, values: { ...saved.values, quantity: '99' } });
  session.updateValues({ application: 'Unsaved local note' });
  await assert.rejects(session.save(), { code: 'CONFLICT' });
  failRead = true;
  await assert.rejects(session.loadSavedDraft(), { code: 'RELOAD_FAILED' });
  assert.equal(session.getState().draft.values.application, 'Unsaved local note');
  assert.equal(session.getState().draft.values.quantity, '12');
  assert.equal(session.getContext().part.id, 'guide');
  failRead = false; await session.loadSavedDraft();
  assert.equal(session.getState().draft.values.quantity, '99');
  session.dispose();
});

test('loading a draft submitted elsewhere fails visibly instead of starting another inquiry', async () => {
  const { session, repository } = setup();
  await session.open({ context }); session.updateValues({ application: 'Original local details', quantity: '12' });
  const review = await session.review();
  const newer = await repository.saveDraft({ ...review.draft, values: { ...review.draft.values, quantity: '13' } });
  const { review: remoteReview } = await prepareInquirySubmission({ repository, draft: newer });
  await confirmInquirySubmission({ repository, review: remoteReview });
  await assert.rejects(session.confirm(), { code: 'STALE_REVIEW' });
  await assert.rejects(session.loadSavedDraft(), { code: 'DRAFT_UNAVAILABLE' });
  assert.equal(session.getState().draft.values.application, 'Original local details');
  assert.equal((await repository.listDrafts()).length, 0);
  assert.equal((await repository.listProjects()).length, 1);
  session.dispose();
});

test('page and embedded helpers require persistence before review and repository confirmation', async () => {
  const { repository } = setup();
  const draft = await repository.getDraft(context);
  draft.values.application = 'Shared review path'; draft.values.quantity = '6';
  const prepared = await prepareInquirySubmission({ repository, draft });
  assert.equal(prepared.draft.revision, 1);
  const project = await confirmInquirySubmission({ repository, review: prepared.review });
  assert.equal(project.inquiry.values.application, 'Shared review path');
  assert.deepEqual(await confirmInquirySubmission({ repository, review: prepared.review }), project);
});
