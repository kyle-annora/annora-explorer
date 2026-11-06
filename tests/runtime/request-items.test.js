import test from 'node:test';
import assert from 'node:assert/strict';
import { createInquiryDraft, normalizeInquiryDraft, reviewInquiry } from '../../src/product-room/project-domain.js';
import { normalizeRequestItems, REQUEST_ITEM_LIMIT } from '../../src/product-room/request-items.js';
import { createInquirySession, prepareInquirySubmission, confirmInquirySubmission } from '../../src/product-room/inquiry-session.js';
import { createDemoProjectRepository, PROJECT_STORAGE_KEY } from '../../src/product-room/project-repository.js';
import { reviewQuote } from '../../src/product-room/seller-domain.js';

const context = { productId: 'kinetic-01', productTitle: 'Crank-slider mechanism', modelId: 'kinetic-01', modelRevision: 'kinetic-r1', part: { id: 'guide', title: 'Linear guide' } };
const other = { ...context, part: { id: 'rod', title: 'Connecting rod' } };
const drawing = revision => ({ ...context, drawing: {
  id: 'guide-drawing', title: 'Guide drawing', revision, assetId: 'guide-sheet', assetRevision: `sha256:source-${revision}`,
  partId: 'guide', sheetId: 'sheet-1', sheetTitle: 'Guide detail', regionId: 'mounting', regionLabel: 'Mounting holes',
  sourceURL: `https://example.org/${revision}/guide.pdf`,
} });
function setup(wrap) {
  const data = new Map(); let serial = 0;
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  const repository = createDemoProjectRepository({ storage, locks: null, makeId: prefix => `${prefix}-${++serial}`, now: () => '2026-11-06T12:00:00.000Z' });
  const session = createInquirySession({ repository: wrap?.(repository) || repository, schedule: () => 1, cancel: () => {} });
  return { repository, session, storage };
}
async function open(session, selected = context) {
  await session.open({ context: selected, suggestedIntent: 'application-review' });
  session.updateValues({ application: 'Review these details together.' });
}

test('request lists are explicit and legacy draft shapes remain unchanged', () => {
  const draft = createInquiryDraft(context, 'legacy');
  assert.equal(Object.hasOwn(draft, 'requestItems'), false);
  assert.equal(Object.hasOwn(normalizeInquiryDraft(draft), 'requestItems'), false);
  assert.deepEqual(normalizeInquiryDraft({ ...draft, requestItems: [] }).requestItems, []);
  assert.throws(() => normalizeInquiryDraft({ ...draft, requestItems: null }), { code: 'VALIDATION' });
});

test('each collected question keeps its own part, purpose and notes through review and seller reopening', async () => {
  const { session, repository } = setup();
  await open(session);
  const first = await session.addRequestItem({ context, purpose: 'change', notes: 'Can this guide be longer?' });
  const second = await session.addRequestItem({ capture: async () => other, purpose: 'review', notes: 'Review the rod clearance.' });
  const ids = [first.id, second.id];
  await session.adopt(other);
  assert.equal(session.getState().draft.requestItems[0].context.part.id, 'guide');
  assert.equal(session.getState().draft.context.part.id, 'rod');
  const review = await session.review(), project = await session.confirm();
  assert.deepEqual(project.inquiry.requestItems.map(item => item.id), ids);
  assert.deepEqual(project.inquiry.requestItems, review.draft.requestItems);
  assert.deepEqual((await repository.getSellerProject(project.id)).inquiry.requestItems, review.draft.requestItems);
  let restored;
  await session.restoreRequestItem(first.id, value => { restored = value; });
  assert.equal(restored.part.id, 'guide');
  assert.equal(session.getContext().part.id, 'rod');
  restored.part.title = 'Outside mutation';
  assert.equal(session.getRequestItemContext(first.id).part.title, 'Linear guide');
  session.dispose();
});

test('different drawing references retain exact source versions and cannot be coerced by primary view changes', async () => {
  const { session, repository } = setup();
  await open(session, drawing('A'));
  await session.addRequestItem({ context: drawing('A'), notes: 'Keep the A mounting pattern.' });
  await session.addRequestItem({ context: drawing('B'), purpose: 'change', notes: 'Review the alternative B detail.' });
  const project = await session.confirm().catch(error => { assert.equal(error.code, 'STALE_REVIEW'); return null; });
  assert.equal(project, null);
  await session.review();
  const saved = await session.confirm();
  assert.equal(saved.context.drawing.revision, 'A');
  assert.deepEqual(saved.inquiry.requestItems.map(item => item.context.drawing.revision), ['A', 'B']);
  assert.deepEqual((await repository.getProject(saved.id)).inquiry.requestItems, saved.inquiry.requestItems);
  session.dispose();
});

test('incomplete notes block review and editing requires a fresh full review', async () => {
  const { session, repository } = setup();
  await open(session);
  const item = await session.addRequestItem({ context });
  await assert.rejects(session.review(), error => Boolean(error.fields.requestItems && error.fields[`requestItem-${item.id}`]));
  session.editRequestItem(item.id, { notes: '  Check this mounting.  ' });
  assert.equal(session.getState().draft.requestItems[0].notes, '  Check this mounting.  ');
  const first = await session.review();
  assert.equal(first.draft.requestItems[0].notes, 'Check this mounting.');
  assert.throws(() => session.editRequestItem(item.id, { notes: 'Not reviewed' }), { code: 'STALE_REVIEW' });
  session.edit();
  await session.updateRequestItem(item.id, { purpose: 'change', notes: 'Please change the mounting.' });
  await assert.rejects(repository.submitInquiry(first), { code: 'STALE_REVIEW' });
  const review = await session.review();
  const tampered = structuredClone(review); tampered.draft.requestItems[0].context.part.id = 'wrong';
  await assert.rejects(repository.submitInquiry(tampered), { code: 'STALE_REVIEW' });
  assert.equal((await session.confirm()).inquiry.requestItems[0].purpose, 'change');
  session.dispose();
});

test('collection validation rejects unrelated revisions, malformed drawing identities, duplicate IDs and overflow', () => {
  const base = { id: 'item', purpose: 'question', notes: 'Question', context };
  for (const replacement of [{ ...context, modelRevision: 'r2' }, { ...context, productId: 'another' }, { ...drawing('A'), drawing: { ...drawing('A').drawing, assetRevision: '' } }])
    assert.throws(() => normalizeRequestItems([{ ...base, context: replacement }], context));
  assert.throws(() => normalizeRequestItems([base, base], context), { code: 'VALIDATION' });
  assert.throws(() => normalizeRequestItems(Array.from({ length: REQUEST_ITEM_LIMIT + 1 }, (_, index) => ({ ...base, id: `${index}` })), context), { code: 'VALIDATION' });
  assert.throws(() => normalizeRequestItems([{ ...base, notes: 'x'.repeat(2001) }], context), { code: 'VALIDATION' });
});

test('failed list mutations roll back only that mutation and retain earlier application edits', async () => {
  let fail = false;
  const { session, repository } = setup(repo => ({ ...repo, saveDraft: input => fail ? Promise.reject(new Error('Storage unavailable')) : repo.saveDraft(input) }));
  await open(session);
  const item = await session.addRequestItem({ notes: 'Keep this question.' });
  session.updateValues({ application: 'Latest application text.' });
  await session.save();
  fail = true;
  await assert.rejects(session.removeRequestItem(item.id), /Storage unavailable/);
  assert.equal(session.getState().draft.requestItems[0].id, item.id);
  assert.equal(session.getState().draft.values.application, 'Latest application text.');
  fail = false;
  await session.removeRequestItem(item.id);
  assert.deepEqual((await repository.getDraft(context)).requestItems, []);
  session.dispose();
});

test('typed request notes share autosave and leave guards, with failed save input preserved', async () => {
  let fail = false;
  const { session, repository } = setup(repo => ({ ...repo, saveDraft: input => fail ? Promise.reject(new Error('Quota exceeded')) : repo.saveDraft(input) }));
  await open(session);
  const item = await session.addRequestItem({ notes: 'Before' });
  fail = true;
  session.editRequestItem(item.id, { notes: 'Latest note' });
  assert.equal(await session.beforeLeave(), false);
  assert.equal(session.getState().draft.requestItems[0].notes, 'Latest note');
  fail = false;
  assert.equal(await session.beforeLeave(), true);
  assert.equal((await repository.getDraft(context)).requestItems[0].notes, 'Latest note');
  session.dispose();
});

test('custom repositories must opt in and must preserve every referenced item', async () => {
  const unsupported = setup(repo => ({ ...repo, supportsRequestItems: undefined }));
  await open(unsupported.session);
  assert.equal(unsupported.session.getState().supportsRequestItems, false);
  assert.throws(() => unsupported.session.addRequestItem({ notes: 'Not supported' }), { code: 'UNSUPPORTED_REQUEST_ITEMS' });
  unsupported.session.dispose();
  const dropping = setup(repo => ({ ...repo, saveDraft: async input => {
    const saved = await repo.saveDraft(input);
    delete saved.requestItems;
    return saved;
  } }));
  await open(dropping.session);
  await assert.rejects(dropping.session.addRequestItem({ notes: 'Must be retained' }), { code: 'UNSUPPORTED_REQUEST_ITEMS' });
  assert.equal(dropping.session.getState().draft.requestItems, undefined);
  dropping.session.dispose();
});

test('issued quotation revisions do not mutate the original inquiry request collection', async () => {
  const { session, repository, storage } = setup();
  await open(session);
  session.updateValues({ quantity: '8' });
  await session.addRequestItem({ notes: 'Check the guide.', context });
  await session.addRequestItem({ notes: 'Check the rod.', context: other });
  await session.review();
  let project = await session.confirm();
  const inquiry = structuredClone(project.inquiry);
  let draft = await repository.saveQuoteDraft(await repository.getQuoteDraft(project.id));
  project = await repository.issueQuote(reviewQuote(project, draft));
  const firstQuote = structuredClone(project.quotes[0]);
  draft = await repository.getQuoteDraft(project.id);
  draft.values.scope = 'Revised proposed mounting scope.';
  draft = await repository.saveQuoteDraft(draft);
  project = await repository.issueQuote(reviewQuote(project, draft));
  assert.deepEqual(project.inquiry, inquiry);
  assert.deepEqual(project.quotes[0], firstQuote);
  const tampered = JSON.parse(storage.getItem(PROJECT_STORAGE_KEY));
  tampered.projects[0].inquiry.requestItems[0].notes = 'Changed after confirmation';
  storage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(tampered));
  await assert.rejects(repository.getProject(project.id), { code: 'STORAGE_CORRUPT' });
  session.dispose();
});

test('the shared submission helper rejects an adapter that discards request items while saving', async () => {
  const { repository } = setup();
  const draft = createInquiryDraft(context, 'adapter-draft');
  draft.values.application = 'Check the guide.'; draft.values.quantity = '2';
  draft.requestItems = [{ id: 'request-1', purpose: 'question', notes: 'Keep this reference', context }];
  const dropping = { ...repository, saveDraft: async input => {
    const saved = await repository.saveDraft(input); delete saved.requestItems; return saved;
  } };
  await assert.rejects(prepareInquirySubmission({ repository: dropping, draft }), { code: 'UNSUPPORTED_REQUEST_ITEMS' });
});

test('confirmation is not shown when an opted-in adapter omits or rewrites the submitted request collection', async () => {
  let drop = true;
  const { repository, session } = setup(repo => ({ ...repo, submitInquiry: async review => {
    const project = await repo.submitInquiry(review);
    if (drop) delete project.inquiry.requestItems;
    return project;
  } }));
  await open(session);
  await session.addRequestItem({ notes: 'Keep this exact reference.' });
  const review = await session.review();
  await assert.rejects(session.confirm(), { code: 'INVALID_CONFIRMATION' });
  assert.equal(session.getState().stage, 'review');
  assert.equal(session.getState().project, null);
  assert.deepEqual(session.getState().review, review);
  assert.equal((await repository.listProjects()).length, 1);
  await assert.rejects(confirmInquirySubmission({ repository: {
    ...repository, submitInquiry: async value => {
      const project = await repository.submitInquiry(value);
      project.inquiry.requestItems[0].context.part.id = 'changed-after-review';
      return project;
    },
  }, review }), { code: 'INVALID_CONFIRMATION' });
  drop = false;
  const result = await session.confirm();
  assert.equal(result.inquiry.requestItems[0].context.part.id, 'guide');
  assert.equal((await repository.listProjects()).length, 1, 'confirmation recovery is idempotent');
  session.dispose();
});

test('restoring a request waits for the shared save boundary and never changes the view after save failure', async () => {
  let fail = false, gate = null;
  const { session, repository } = setup(repo => ({ ...repo, saveDraft: async input => {
    if (gate) await gate.promise;
    if (fail) throw new Error('Cannot save the current notes');
    return repo.saveDraft(input);
  } }));
  await open(session);
  const item = await session.addRequestItem({ notes: 'Before' });
  session.editRequestItem(item.id, { notes: 'After' });
  let resolve;
  gate = { promise: new Promise(yes => { resolve = yes; }) };
  let restored = false;
  const restoring = session.restoreRequestItem(item.id, () => { restored = true; });
  await new Promise(yes => setImmediate(yes));
  assert.equal(restored, false);
  resolve(); await restoring; gate = null;
  assert.equal(restored, true);
  assert.equal((await repository.getDraft(context)).requestItems[0].notes, 'After');
  session.editRequestItem(item.id, { notes: 'Keep this input on failure' });
  fail = true; restored = false;
  await assert.rejects(session.restoreRequestItem(item.id, () => { restored = true; }), /Cannot save/);
  assert.equal(restored, false);
  assert.equal(session.getState().draft.requestItems[0].notes, 'Keep this input on failure');
  await assert.rejects(session.restore(() => { restored = true; }), /Cannot save/);
  assert.equal(restored, false);
  session.dispose();
});
