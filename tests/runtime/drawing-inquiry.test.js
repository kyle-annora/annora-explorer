import test from 'node:test';
import assert from 'node:assert/strict';
import { requestContext, requestDraftKey, createRequestDraft, removeRequestContext, replaceRequestContext } from '../../src/product-room/request-state.js';
import { createInquiryDraft, projectContextKey, reviewInquiry, reviewRevision, reviewNextStep, compareQuotes } from '../../src/product-room/project-domain.js';
import { reviewQuote, reviewReply, reviewCustomerReply, reviewAcknowledgement } from '../../src/product-room/seller-domain.js';
import { createDemoProjectRepository, PROJECT_STORAGE_KEY, parseProjectStore } from '../../src/product-room/project-repository.js';
import { createDrawingProjectRepository, DRAWING_PROJECT_STORAGE_KEY } from '../../src/product-room/drawing-inquiry.js';
import { sampleInquiryValues } from '../../src/product-room/project-fixtures.js';
import { DEFAULT_INQUIRY_PROFILE } from '../../src/product-room/inquiry-profile.js';
import { contextForRelease } from '../../src/product-room/release-content.js';

const copy = value => structuredClone(value);
const context = {
  productId: 'bearing-study', productTitle: 'Bearing housing', modelId: 'bearing-study', modelRevision: 'model-r1',
  part: { id: 'housing', title: 'Housing' },
  drawing: {
    id: 'housing-drawing', title: 'Bearing housing drawing', revision: 'A',
    assetId: 'housing-sheet', assetRevision: 'sha256:paired-asset-1', partId: 'housing',
    sheetId: 'sheet-1', sheetTitle: 'Sheet 1 · Housing', regionId: 'bore', regionLabel: 'Bearing bore',
    sourceURL: 'https://example.org/source/commit-r1/housing.pdf',
  },
};
function setup() {
  const data = new Map(); let serial = 0;
  const options = { locks: null, storage: { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }, makeId: prefix => `${prefix}-${++serial}`, now: () => '2026-11-01T12:00:00.000Z' };
  return { data, options, repository: createDrawingProjectRepository(options) };
}
async function savedDraft(repository, selected = context) {
  const draft = await repository.getDraft(selected);
  draft.values = sampleInquiryValues(selected);
  return repository.saveDraft(draft);
}

test('drawing inquiries persist the exact selected region, part and asset revision through review and reopening', async () => {
  const { options, repository, data } = setup();
  assert.equal(repository.mode, 'drawing-preview');
  assert.equal(repository.capabilities.inquiryOnly, false);
  const draft = await savedDraft(repository), review = reviewInquiry(draft);
  assert.deepEqual(review.draft.context.drawing, context.drawing);
  const project = await repository.submitInquiry(review);
  assert.deepEqual(await repository.submitInquiry(review), project, 'confirmation retries are idempotent');
  assert.deepEqual(project.context, context);
  assert.deepEqual(project.inquiry.requirements, [], 'viewed dimensions are never promoted to customer requirements');
  assert.equal(project.inquiry.values.stroke, '');
  assert.deepEqual(await createDrawingProjectRepository(options).getProject(project.id), project);
  assert.deepEqual(parseProjectStore(data.get(DRAWING_PROJECT_STORAGE_KEY)).projects[0], project);
  assert.equal(data.has(PROJECT_STORAGE_KEY), false);
});

test('a changed drawing selection cannot be submitted with an earlier review', async () => {
  const { repository } = setup();
  let draft = await savedDraft(repository);
  const review = reviewInquiry(draft), editedReview = copy(review);
  editedReview.draft.context.drawing.regionId = 'mounting';
  await assert.rejects(repository.submitInquiry(editedReview), { code: 'STALE_REVIEW' });
  draft.context.drawing.regionId = 'mounting'; draft.context.drawing.regionLabel = 'Mounting holes';
  draft = await repository.saveDraft(draft);
  await assert.rejects(repository.submitInquiry(review), { code: 'STALE_REVIEW' });
  assert.equal((await repository.submitInquiry(reviewInquiry(draft))).context.drawing.regionId, 'mounting');
});

test('new drawing revisions start distinct drafts while a new region preserves the existing draft until adoption', async () => {
  const { repository } = setup();
  const original = await savedDraft(repository), selected = copy(context);
  selected.drawing.regionId = 'mounting'; selected.drawing.regionLabel = 'Mounting holes';
  assert.deepEqual(await repository.getDraft(selected), original);
  assert.equal(projectContextKey(selected), projectContextKey(context));
  for (const key of ['id', 'revision', 'assetId', 'assetRevision']) {
    const newer = copy(context); newer.drawing[key] += '-new';
    const fresh = await repository.getDraft(newer);
    assert.equal(fresh.revision, 0); assert.equal(fresh.values.application, '');
    assert.notEqual(projectContextKey(newer), projectContextKey(context));
    assert.notEqual(requestDraftKey(newer), requestDraftKey(context));
    assert.throws(() => replaceRequestContext(createRequestDraft(context), newer), /own draft/);
  }
  assert.deepEqual(await repository.getDraft(context), original);
});

test('drawing references require a matched part, exact model and complete non-executable source identity', () => {
  for (const mutate of [
    item => delete item.modelRevision,
    item => delete item.part,
    item => { item.drawing.partId = 'another-part'; },
    item => { item.drawing.revision = ''; },
    item => { item.drawing.assetRevision = ''; },
    item => { item.drawing.sheetId = ''; },
    item => { item.drawing.regionId = ''; },
    item => { item.drawing.sourceURL = 'javascript:alert(1)'; },
    item => { item.drawing.sourceURL = 'data:text/html,unsafe'; },
    item => { item.drawing.sourceURL = 'https://name:secret@example.org/'; },
    item => { item.drawing.regionLabel = 'x'.repeat(321); },
  ]) {
    const invalid = copy(context); mutate(invalid);
    assert.throws(() => createInquiryDraft(invalid), { code: 'VALIDATION' });
  }
  assert.throws(() => removeRequestContext(createRequestDraft(context), 'part'), /drawing detail/);
  const input = copy(context), normalized = requestContext(input);
  input.drawing.revision = 'modified';
  assert.equal(normalized.drawing.revision, 'A');
});

test('the preview cannot read or change ordinary buyer or Studio records', async () => {
  const { options, data, repository } = setup();
  const ordinary = createDemoProjectRepository(options);
  const oldContext = { productId: 'kinetic-01', productTitle: 'Crank-slider mechanism', modelId: 'kinetic-01', modelRevision: 'kinetic-r1' };
  const original = await ordinary.getDraft(oldContext); original.values = sampleInquiryValues();
  const saved = await ordinary.saveDraft(original), project = await ordinary.submitInquiry(reviewInquiry(saved));
  await ordinary.createSampleQuote(project.id);
  const ordinaryBytes = data.get(PROJECT_STORAGE_KEY);
  data.set('annora.studio.products.v1', '{"existing":"must remain untouched"}');
  const studioBytes = data.get('annora.studio.products.v1');
  assert.deepEqual(await repository.listProjects(), []);
  await repository.submitInquiry(reviewInquiry(await savedDraft(repository)));
  assert.equal(data.get(PROJECT_STORAGE_KEY), ordinaryBytes);
  assert.equal(data.get('annora.studio.products.v1'), studioBytes);
  assert.equal(projectContextKey(oldContext), JSON.stringify(['kinetic-01', 'kinetic-01', 'kinetic-r1', null, null]));
  assert.equal(requestDraftKey(oldContext), JSON.stringify(['kinetic-01', 'kinetic-01', 'kinetic-r1']));
  assert.equal((await ordinary.getProject(project.id)).context.drawing, undefined);
});

test('a versioned product snapshot must contain the same drawing, revision and asset', () => {
  const release = {
    id: 'bearing-room-r1', version: 1, productId: context.productId, modelRevision: context.modelRevision,
    source: 'bundled', createdAt: '2026-11-01T12:00:00.000Z',
    content: { id: context.productId, modelId: context.modelId, title: context.productTitle, shortTitle: 'Housing', eyebrow: 'Drawing preview', tagline: 'Linked study', description: 'Fictional inquiry example.', summary: 'Paired references.', demoNotice: 'Demo', roomRevision: 'room-r1',
      source: { label: 'Fixture', author: 'Example', license: 'MIT', url: context.drawing.sourceURL, note: 'Test fixture' }, highlights: [], specGroups: [], questions: [],
      documents: [{ id: context.drawing.id, title: context.drawing.title, revision: context.drawing.revision, assetId: context.drawing.assetId }],
    },
    inquiryProfile: copy(DEFAULT_INQUIRY_PROFILE),
  };
  const versioned = contextForRelease(release, { part: context.part, drawing: context.drawing });
  assert.deepEqual(createInquiryDraft(versioned).context.drawing, context.drawing);
  for (const key of ['id', 'title', 'revision', 'assetId']) {
    const invalid = copy(versioned); invalid.drawing[key] += '-other';
    assert.throws(() => createInquiryDraft(invalid), { code: 'VALIDATION' });
  }
});

test('corrupted drawing identity never silently resets saved inquiries', async () => {
  const { repository, data } = setup();
  await repository.submitInquiry(reviewInquiry(await savedDraft(repository)));
  const stored = JSON.parse(data.get(DRAWING_PROJECT_STORAGE_KEY));
  stored.projects[0].context.drawing.partId = 'unrelated';
  const corrupted = JSON.stringify(stored); data.set(DRAWING_PROJECT_STORAGE_KEY, corrupted);
  await assert.rejects(repository.listProjects(), { code: 'STORAGE_CORRUPT' });
  assert.equal(data.get(DRAWING_PROJECT_STORAGE_KEY), corrupted);
});

test('mapping editions are pinned without rewriting legacy draft keys or submitted records', async () => {
  const { repository, options, data } = setup();
  const original = await savedDraft(repository);
  const originalKey = projectContextKey(context), bytes = data.get(DRAWING_PROJECT_STORAGE_KEY);
  assert.equal(originalKey, JSON.stringify(['bearing-study', 'bearing-study', 'model-r1', null, null,
    ['housing-drawing', 'A', 'housing-sheet', 'sha256:paired-asset-1']]));
  const selected = copy(context); selected.drawing.mappingRevision = 'mapping-1';
  const first = await repository.getDraft(selected);
  assert.equal(first.revision, 0);
  assert.notEqual(projectContextKey(selected), originalKey);
  assert.equal(data.get(DRAWING_PROJECT_STORAGE_KEY), bytes, 'reading new metadata does not rewrite old storage');
  assert.deepEqual(await createDrawingProjectRepository(options).getDraft(context), original);
  const saved = await savedDraft(repository, selected), project = await repository.submitInquiry(reviewInquiry(saved));
  selected.drawing.mappingRevision = 'mapping-2';
  assert.equal((await repository.getDraft(selected)).revision, 0);
  assert.notEqual(requestDraftKey(selected), requestDraftKey(project.context));
  assert.equal((await repository.getProject(project.id)).context.drawing.mappingRevision, 'mapping-1');
  for (const value of ['', null, 'x'.repeat(321), 'map\n1']) {
    const invalid = copy(context); invalid.drawing.mappingRevision = value;
    assert.throws(() => createInquiryDraft(invalid), { code: 'VALIDATION' });
  }
});

test('drawing inquiry, seller review, revision, comparison and next step retain one exact source context', async () => {
  const { repository, options, data } = setup();
  const selected = copy(context); selected.drawing.mappingRevision = 'mapping-1';
  let project = await repository.submitInquiry(reviewInquiry(await savedDraft(repository, selected)));
  const pinned = copy(project.context), inquiry = copy(project.inquiry);
  const seller = createDrawingProjectRepository(options);
  let draft = await seller.getQuoteDraft(project.id);
  assert.match(draft.values.lineItems[0].label, /Bearing housing/);
  assert.doesNotMatch(draft.values.lineItems[0].label, /crank/i);
  assert.equal(draft.values.lineItems[0].unitPrice, '', 'no automatic fake quote or inferred price');
  await assert.rejects(seller.createSampleQuote(project.id), { code: 'UNSUPPORTED_PRODUCT' });
  draft.values.lineItems[0].unitPrice = '28';
  draft = await seller.saveQuoteDraft(draft);
  assert.equal((await repository.getProject(project.id)).quotes.length, 0, 'saved seller draft stays private to seller projection');
  await assert.rejects(seller.issueQuote(draft), { code: 'STALE_REVIEW' });
  project = await seller.issueQuote(reviewQuote(project, draft));
  const firstQuote = copy(project.quotes[0]);
  project = await repository.requestRevision(reviewRevision(project, firstQuote.id, { quantity: '30', targetWeeks: '5', notes: 'Please review the fit at the selected bearing bore.' }));
  const change = project.changes[0];
  project = await seller.sendReply(reviewReply(project, { kind: 'clarification', changeId: change.id, body: 'Is the saved drawing edition still the reference for this request?' }));
  project = await repository.sendCustomerReply(reviewCustomerReply(project, { replyTo: project.messages[0].id, body: 'Yes. Please retain the saved source and mapping edition.' }));
  draft = await seller.getQuoteDraft(project.id);
  draft.values.quantity = '30'; draft.values.lineItems[0].quantity = '30'; draft.values.lineItems[0].unitPrice = '26';
  draft = await seller.saveQuoteDraft(draft);
  const reply = { kind: 'change-response', changeId: change.id, body: 'Quantity revised. The original source remains the reference.', resolutions: [
    { topic: 'quantity', status: 'accepted', response: '30 supports included.' },
    { topic: 'timing', status: 'alternative', response: 'Timing follows engineering review.' },
    { topic: 'notes', status: 'alternative', response: 'Fit remains to be confirmed against the pinned source drawing.' },
  ] };
  project = await seller.issueQuote(reviewQuote(project, draft, reply));
  assert.deepEqual(project.quotes[0], firstQuote);
  assert.ok(compareQuotes(project.quotes[0], project.quotes[1]).find(row => row.key === 'quantity').changed);
  project = await repository.confirmNextStep(reviewNextStep(project, project.quotes[1].id, { intent: 'engineering-review', message: 'Review the pinned bore detail with engineering.' }));
  project = await seller.acknowledgeNextStep(reviewAcknowledgement(project, { nextStepId: project.nextSteps[0].id, body: 'We will discuss the exact saved model, sheet and bore region.' }));
  assert.deepEqual(project.context, pinned);
  assert.deepEqual(project.inquiry, inquiry);
  assert.deepEqual((await createDrawingProjectRepository(options).getProject(project.id)).context, pinned);
  assert.equal(data.has(PROJECT_STORAGE_KEY), false);
});

test('drawing sample inquiry is contextual and edition-specific while the ordinary repository keeps its product gate', async () => {
  const { repository, options } = setup();
  const selected = copy(context); selected.drawing.mappingRevision = 'mapping-1';
  const first = await repository.createSampleInquiry(selected);
  assert.match(first.inquiry.values.application, /bearing bore.*Bearing housing/);
  assert.equal(first.inquiry.values.stroke, '');
  assert.equal(first.quotes.length, 0);
  assert.equal((await repository.createSampleInquiry(selected)).id, first.id);
  const newer = copy(selected); newer.drawing.mappingRevision = 'mapping-2';
  assert.notEqual((await repository.createSampleInquiry(newer)).id, first.id);
  const ordinary = createDemoProjectRepository(options);
  await assert.rejects(ordinary.createSampleInquiry(selected), { code: 'UNSUPPORTED_PRODUCT' });
  let draft = await ordinary.getDraft(selected); draft.values = sampleInquiryValues(selected); draft = await ordinary.saveDraft(draft);
  const saved = await ordinary.submitInquiry(reviewInquiry(draft));
  await assert.rejects(ordinary.getQuoteDraft(saved.id), { code: 'UNSUPPORTED_PRODUCT' });
});
