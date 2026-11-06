import test from 'node:test';
import assert from 'node:assert/strict';
import { createInquiryDraft, normalizeInquiryDraft, reviewInquiry, INQUIRY_RULES_VERSION, inquiryIntentLabel, inquiryQuantityLabel } from '../../src/product-room/project-domain.js';
import { inquiryField } from '../../src/product-room/inquiry-profile.js';
import { createDemoProjectRepository, parseProjectStore, PROJECT_STORAGE_KEY } from '../../src/product-room/project-repository.js';
import { quoteDraftPreview, quoteDraftErrors, reviewQuote } from '../../src/product-room/seller-domain.js';
import { contextForRelease } from '../../src/product-room/release-content.js';
import { BUNDLED_RELEASE } from '../../src/studio/seed.js';

const context = { productId: 'kinetic-01', productTitle: 'Crank-slider mechanism', modelId: 'kinetic-01', modelRevision: 'kinetic-r1' };
function setup() {
  let serial = 0;
  const data = new Map(), storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  const options = { storage, locks: null, makeId: prefix => `${prefix}-${++serial}`, now: () => '2026-11-05T12:00:00.000Z' };
  return { storage, options, repo: createDemoProjectRepository(options) };
}
async function consultation(repo, reference = context) {
  const draft = await repo.getDraft(reference);
  draft.values.intent = 'application-review';
  draft.values.application = 'Review the mounting arrangement before we decide how many units are needed.';
  return repo.saveDraft(draft);
}

test('new drafts default to quotation while effective required flags leave historical profiles intact', () => {
  const release = structuredClone(BUNDLED_RELEASE);
  release.inquiryProfile.version = 'kinetic-inquiry-v1';
  const reference = contextForRelease(release), draft = createInquiryDraft(reference, 'DRAFT-NEW');
  assert.equal(draft.values.intent, 'quotation');
  assert.equal(draft.inquiryRulesVersion, INQUIRY_RULES_VERSION);
  assert.equal(inquiryField(reference, 'quantity', draft.values).required, true);
  draft.values.intent = 'application-review';
  assert.equal(inquiryField(reference, 'quantity', draft.values).required, false);
  assert.equal(reference.inquiryProfile.fields.find(field => field.id === 'quantity').required, true);
  assert.deepEqual(normalizeInquiryDraft(draft).context, reference);
  assert.equal(draft.context.inquiryProfileVersion, 'kinetic-inquiry-v1');
});

test('application review preserves unknown quantity, exact rules and product profile through confirmation and reopening', async () => {
  const { repo, options } = setup(), reference = contextForRelease(BUNDLED_RELEASE);
  const draft = await consultation(repo, reference), review = reviewInquiry(draft);
  assert.equal(review.draft.values.quantity, '');
  assert.equal(review.draft.inquiryRulesVersion, INQUIRY_RULES_VERSION);
  const project = await repo.submitInquiry(review);
  assert.deepEqual(await repo.submitInquiry(review), project);
  assert.equal(project.inquiry.values.intent, 'application-review');
  assert.equal(project.inquiry.values.quantity, '');
  assert.equal(project.inquiry.inquiryRulesVersion, INQUIRY_RULES_VERSION);
  assert.deepEqual(project.context, reference);
  assert.equal(inquiryIntentLabel(project.inquiry.values), 'Application review and consultation');
  assert.equal(inquiryQuantityLabel(project.inquiry.values), 'Quantity unknown');
  assert.deepEqual(await createDemoProjectRepository(options).getProject(project.id), project);
  assert.deepEqual(project.quotes, []);
});

test('quantity is optional only for application review and supplied values still require valid integers', async () => {
  const { repo } = setup(), draft = await consultation(repo);
  for (const quantity of ['0', '-1', '1.5', '100001', 'unknown', 0, null]) {
    assert.throws(() => reviewInquiry({ ...draft, values: { ...draft.values, quantity } }), error => error.code === 'VALIDATION' && !!error.fields.quantity);
  }
  assert.equal(reviewInquiry({ ...draft, values: { ...draft.values, quantity: '20' } }).draft.values.quantity, '20');
  assert.throws(() => reviewInquiry({ ...draft, values: { ...draft.values, intent: 'quotation' } }), error => !!error.fields.quantity);
  assert.throws(() => reviewInquiry({ ...draft, values: { ...draft.values, intent: 'guess' } }), error => !!error.fields.intent);
});

test('changing intent or rule version after review cannot bypass explicit confirmation', async () => {
  const { repo } = setup(), draft = await consultation(repo), review = reviewInquiry(draft);
  for (const mutate of [value => { value.draft.values.intent = 'quotation'; }, value => { value.draft.inquiryRulesVersion = 'next-rules'; }]) {
    const altered = structuredClone(review); mutate(altered);
    await assert.rejects(repo.submitInquiry(altered), { code: 'STALE_REVIEW' });
  }
  await repo.saveDraft({ ...draft, values: { ...draft.values, intent: 'quotation', quantity: '12' } });
  await assert.rejects(repo.submitInquiry(review), { code: 'STALE_REVIEW' });
  assert.equal((await repo.listProjects()).length, 0);
});

test('historical records without intent or rules stay unchanged and keep their original quantity requirement', async () => {
  const { repo, storage, options } = setup();
  const legacy = await repo.getDraft(context);
  delete legacy.values.intent; delete legacy.inquiryRulesVersion;
  legacy.values.application = 'Original inquiry'; legacy.values.quantity = '4';
  const saved = await repo.saveDraft(legacy), beforeDraftRead = storage.getItem(PROJECT_STORAGE_KEY);
  assert.deepEqual(await repo.getDraft(context), saved);
  assert.equal(storage.getItem(PROJECT_STORAGE_KEY), beforeDraftRead);
  assert.equal(Object.hasOwn(saved.values, 'intent'), false);
  assert.equal(Object.hasOwn(saved, 'inquiryRulesVersion'), false);
  assert.throws(() => reviewInquiry({ ...saved, values: { ...saved.values, quantity: '' } }), error => !!error.fields.quantity);
  const project = await repo.submitInquiry(reviewInquiry(saved)), beforeProjectRead = storage.getItem(PROJECT_STORAGE_KEY);
  assert.equal(Object.hasOwn(project.inquiry, 'inquiryRulesVersion'), false);
  assert.equal(Object.hasOwn(project.inquiry.values, 'intent'), false);
  assert.equal(inquiryIntentLabel(project.inquiry.values), 'Not specified');
  assert.deepEqual(await createDemoProjectRepository(options).getProject(project.id), project);
  assert.equal(storage.getItem(PROJECT_STORAGE_KEY), beforeProjectRead);
});

test('unknown or missing rules on intent-bearing stored records fail without resetting storage', async () => {
  const { repo, storage } = setup(), draft = await consultation(repo);
  const project = await repo.submitInquiry(reviewInquiry(draft)), raw = storage.getItem(PROJECT_STORAGE_KEY);
  for (const mutate of [inquiry => { inquiry.inquiryRulesVersion = 'future-rules'; }, inquiry => { delete inquiry.inquiryRulesVersion; }]) {
    const store = JSON.parse(raw); mutate(store.projects[0].inquiry);
    const corrupt = JSON.stringify(store); storage.setItem(PROJECT_STORAGE_KEY, corrupt);
    assert.throws(() => parseProjectStore(corrupt));
    await assert.rejects(repo.getProject(project.id));
    assert.equal(storage.getItem(PROJECT_STORAGE_KEY), corrupt);
  }
});

test('seller quotation needs an explicit quantity and preserves the consultation after issue', async () => {
  const { repo } = setup(), project = await repo.submitInquiry(reviewInquiry(await consultation(repo)));
  let draft = await repo.saveQuoteDraft(await repo.getQuoteDraft(project.id));
  assert.equal(draft.values.quantity, '');
  assert.equal(draft.values.lineItems[0].quantity, '');
  const preview = quoteDraftPreview(draft, project);
  assert.equal(preview.quantity, null);
  assert.equal(preview.lineItems[0].quantity, null);
  assert.ok(quoteDraftErrors(draft).quantity);
  assert.throws(() => reviewQuote(project, draft), error => error.code === 'VALIDATION' && !!error.fields.quantity);
  draft.values.quantity = '12'; draft.values.lineItems[0].quantity = '12'; draft.values.lineItems[0].unitPrice = '185';
  draft = await repo.saveQuoteDraft(draft);
  const review = reviewQuote(project, draft), issued = await repo.issueQuote(review);
  assert.equal(issued.quotes[0].quantity, 12);
  assert.deepEqual(issued.inquiry, project.inquiry);
  assert.deepEqual(await repo.issueQuote(review), issued);
});

test('sample pricing cannot turn an unknown consultation quantity into a quotation', async () => {
  const { repo, storage } = setup(), project = await repo.submitInquiry(reviewInquiry(await consultation(repo)));
  const raw = storage.getItem(PROJECT_STORAGE_KEY);
  await assert.rejects(repo.createSampleQuote(project.id), error => error.code === 'VALIDATION' && !!error.fields.quantity);
  assert.equal(storage.getItem(PROJECT_STORAGE_KEY), raw);
  assert.deepEqual((await repo.getProject(project.id)).quotes, []);
});
