import test from 'node:test';
import assert from 'node:assert/strict';
import drawing from '../../content/drawings/sk08/package.json' with { type: 'json' };
import { createDrawingContext } from '../../src/drawing-preview/context.js';
import { preparedProjectRepository } from '../../src/product-room/prepared-host.js';
import { createPreviewProjectRepository, loadRoomRelease } from '../../src/product-room/release-content.js';
import { PROJECT_STORAGE_KEY } from '../../src/product-room/project-repository.js';
import { reviewInquiry } from '../../src/product-room/project-domain.js';
import { sampleInquiryValues } from '../../src/product-room/project-fixtures.js';
import { reviewQuote } from '../../src/product-room/seller-domain.js';

const product = { id: 'sk08', model: { id: 'sk08', revision: drawing.modelRevision },
  technicalReferences: [{}], capabilities: { quotation: { available: true } } };
const context = createDrawingContext({ drawing, sheetId: 'sheet-1', regionId: 'shaft-bore',
  modelRevision: drawing.modelRevision, model: { title: 'SK08 shaft support' }, presentationSnapshot: null });
const crank = { productId: 'kinetic-01', productTitle: 'Crank', modelId: 'kinetic-01', modelRevision: 'crank-v1' };
function store() {
  const records = new Map(); let sequence = 0;
  return { records, storage: { getItem: key => records.get(key) ?? null, setItem: (key, value) => records.set(key, value) },
    locks: null, makeId: prefix => `${prefix}-PREPARED-${++sequence}`, now: () => '2026-11-07T00:00:00.000Z' };
}
async function draft(repo, reference) {
  const value = await repo.getDraft(reference); value.values = sampleInquiryValues(reference);
  return repo.saveDraft(value);
}
async function issue(repo, project) {
  let quote = await repo.getQuoteDraft(project.id);
  quote.values.lineItems.forEach(line => { line.unitPrice = '20'; });
  quote = await repo.saveQuoteDraft(quote);
  return repo.issueQuote(reviewQuote(project, quote));
}

test('second product uses a separate store while preserving ordinary crank records', async () => {
  const options = store(), crankRepo = preparedProjectRepository({ id: 'kinetic-01' }, options);
  const old = await draft(crankRepo, crank), snapshot = options.records.get(PROJECT_STORAGE_KEY);
  const support = preparedProjectRepository(product, options);
  const saved = await draft(support, context), project = await support.submitInquiry(reviewInquiry(saved));
  const quoted = await issue(support, project);
  assert.equal(quoted.context.modelId, 'sk08');
  assert.equal(quoted.quotes.length, 1);
  assert.equal(quoted.quotes[0].context.drawing.assetRevision, context.drawing.assetRevision);
  assert.equal(options.records.get(PROJECT_STORAGE_KEY), snapshot);
  assert.deepEqual(await crankRepo.getDraft(crank), old);
  assert.equal((await support.listProjects()).length, 1);
  assert.equal((await crankRepo.listProjects()).length, 0);
});

test('a stale host cannot create or submit another product in the second-product namespace', async () => {
  const options = store(), support = preparedProjectRepository(product, options);
  const saved = await draft(support, context), before = [...options.records];
  await assert.rejects(support.getDraft(crank), { code: 'INCOMPATIBLE_PRODUCT' });
  await assert.rejects(support.saveDraft({ ...saved, context: crank }), { code: 'INCOMPATIBLE_PRODUCT' });
  await assert.rejects(support.createSampleInquiry(crank), { code: 'INCOMPATIBLE_PRODUCT' });
  const other = await draft(preparedProjectRepository({ id: 'kinetic-01' }, store()), crank);
  await assert.rejects(support.submitInquiry(reviewInquiry(other)), { code: 'INCOMPATIBLE_PRODUCT' });
  await assert.rejects(support.getDraft({ ...context, modelRevision: 'new-unprepared-model' }), { code: 'INCOMPATIBLE_PRODUCT' });
  assert.deepEqual([...options.records], before);
});

test('a second-product preview can complete the commercial example without persisting into the live demo', async () => {
  const options = store(), support = preparedProjectRepository(product, options);
  await draft(support, context); const before = [...options.records];
  const preview = createPreviewProjectRepository(product);
  const saved = await draft(preview, context), project = await preview.submitInquiry(reviewInquiry(saved));
  const quote = await issue(preview, project);
  assert.equal(preview.mode, 'preview');
  assert.equal(quote.quotes.length, 1);
  assert.deepEqual([...options.records], before);
  assert.deepEqual(await createPreviewProjectRepository(product).listProjects(), []);
});

test('exact second-product links reject another product rather than falling back to a release', async () => {
  let reads = 0;
  const release = context.roomSnapshot;
  const repository = { getPublished: async id => { reads++; assert.equal(id, 'sk08'); return release; },
    getRelease: async () => ({ ...release, productId: 'kinetic-01' }), getPreview: async () => null };
  assert.equal((await loadRoomRelease(repository, new URLSearchParams(), 'sk08')).release.productId, 'sk08');
  await assert.rejects(loadRoomRelease(repository, new URLSearchParams('release=wrong-product'), 'sk08'), { code: 'RELEASE_NOT_FOUND' });
  await assert.rejects(loadRoomRelease(repository, new URLSearchParams('studioPreview=gone'), 'sk08'), { code: 'RELEASE_NOT_FOUND' });
  assert.equal(reads, 1);
});
