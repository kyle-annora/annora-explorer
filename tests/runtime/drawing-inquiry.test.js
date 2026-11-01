import test from 'node:test';
import assert from 'node:assert/strict';
import { requestContext, requestDraftKey, createRequestDraft, removeRequestContext, replaceRequestContext } from '../../src/product-room/request-state.js';
import { createInquiryDraft, projectContextKey, reviewInquiry } from '../../src/product-room/project-domain.js';
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
  assert.equal(repository.capabilities.inquiryOnly, true);
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
