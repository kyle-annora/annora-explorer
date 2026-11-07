import test from 'node:test';
import assert from 'node:assert/strict';
import drawing from '../../content/drawings/sk08/package.json' with { type: 'json' };
import metadata from '../../content/models/sk08/metadata.json' with { type: 'json' };
import overview from '../../content/drawings/sk08/overview-legacy.json' with { type: 'json' };
import bundledSupport from '../../content/rooms/sk08/release.json' with { type: 'json' };
import { MODEL_CATALOG } from '../../src/generated/catalog.js';
import { createDrawingContext } from '../../src/drawing-preview/context.js';
import { createTechnicalStoryReference } from '../../src/product-room/technical-story.js';
import { preparedProductParts, preparedProductReadiness, createPreparedProductRegistry } from '../../src/product-room/prepared-products.js';
import { createStudioRepository, STUDIO_STORAGE_KEY, parseStudioStore } from '../../src/studio/repository.js';
import { validateRelease, studioChanges } from '../../src/studio/domain.js';
import { profileVersion } from '../../src/studio/value.js';
import { contextForRelease } from '../../src/product-room/release-content.js';
import { createInquiryDraft } from '../../src/product-room/project-domain.js';
import { applyRoomRelease } from '../../scripts/apply-room-release.mjs';
import { mkdtemp, readFile, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const clone = value => JSON.parse(JSON.stringify(value));
function fixture() {
  const model = MODEL_CATALOG.sk08;
  const sourceContext = createDrawingContext({ drawing, sheetId: 'sheet-1', regionId: 'shaft-bore', modelRevision: model.revision,
    model: { ...model, parts: metadata.parts }, presentationSnapshot: overview });
  const release = clone(sourceContext.roomSnapshot);
  release.id = 'ROOM-SUPPORT-REFERENCE-1'; release.content.posterAssetId = 'support-poster';
  release.content.specGroups = release.content.specGroups.map(group => ({ ...group, facts: group.facts.map((fact, index) => ({ ...fact, id: `fact-${index}`, status: 'illustrative' })) }));
  release.content.documents = release.content.documents.map(document => ({ ...document, date: '2026-11-01', sample: true, assetRevision: drawing.revision }));
  release.inquiryProfile.version = profileVersion(release.inquiryProfile.fields);
  const technical = createTechnicalStoryReference({ context: sourceContext, pdfPage: 1, viewId: overview.sheets[0].views[0].id });
  const choice = { id: 'front-bore', title: 'Front view · shaft bore', nodeId: 'sk08-body', technical };
  release.presentation = { defaultRenderStyle: 'engineering', story: { version: 1, title: 'Read the support', steps: [
    { id: 'front', title: 'Inspect the bore', caption: 'Use the exact source drawing to discuss the bore.', kind: 'technical', nodeId: 'sk08-body', technical: clone(technical) },
  ] } };
  const descriptor = { id: 'sk08', model, source: metadata.source, parts: preparedProductParts(metadata),
    units: { source: 'mm', display: 'm', evidence: 'Pinned source preparation provenance.' },
    posterAssetId: 'support-poster', posterTitle: 'Support view',
    assets: [{ id: 'reference-pdf', revision: drawing.revision, title: 'Reference drawing', fileName: 'reference.pdf', type: 'PDF', url: '/reference.pdf', sha256: drawing.assets.find(asset => asset.id === 'reference-pdf').sha256 }],
    bundledRelease: release, originalRelease: release, inquiryProfile: release.inquiryProfile, commercial: { mode: 'sample' },
    drawingPackages: [drawing], technicalReferences: [choice],
    overviewViews: overview.sheets.flatMap(sheet => sheet.views.map(view => ({ id: view.id, sheetId: sheet.sheetId, viewRevision: view.viewRevision,
      profile: { regions: view.targets.map(target => ({ id: target.targetId })) } }))),
  };
  return clone(descriptor);
}
function storage() { const data = new Map(); return { data, storage: { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) } }; }

test('second prepared product exposes static and technical stories without invented motion', () => {
  const input = fixture(), product = createPreparedProductRegistry([input]).get('sk08');
  assert.equal(product.readiness.viewer.status, 'ready'); assert.equal(product.readiness.inquiry.status, 'ready');
  assert.deepEqual(product.readiness.story.stepKinds, ['inspection', 'technical']);
  assert.equal(product.capabilities.chapter.available, false); assert.match(product.capabilities.chapter.reason, /No prepared/);
  assert.equal(product.readiness.commercial.status, 'sample-only');
  assert.equal(product.model.tour, null); assert.equal(product.technicalReferences.length, 1);
  assert.equal(product.technicalReferences[0].technical.context.drawing.assetRevision, drawing.assets.find(asset => asset.id === 'reference-pdf').sha256);
  assert.equal(product.source.note, metadata.source.note);
  assert.equal(validateRelease(product.bundledRelease, { product }).filter(issue => issue.severity === 'error').length, 0);
});

test('actual bundled SK08 technical story enters inquiry with its exact product and document identity', () => {
  for (const step of bundledSupport.presentation.story.steps) {
    const context = contextForRelease(bundledSupport, step.technical.context);
    const draft = createInquiryDraft(context, `actual-${step.id}`);
    assert.equal(draft.context.roomReleaseId, bundledSupport.id);
    assert.equal(draft.context.drawing.id, drawing.id);
    assert.equal(draft.context.drawing.revision, drawing.revision);
    assert.equal(draft.context.drawing.regionId, step.technical.context.drawing.regionId);
    assert.deepEqual(draft.context.drawing.presentationSnapshot, step.technical.context.drawing.presentationSnapshot);
  }
  const descriptor = fixture(); descriptor.bundledRelease.content.documents[0].id = 'friendly-alias';
  assert.ok(validateRelease(descriptor.bundledRelease, { product: descriptor }).some(issue => issue.path === 'presentation.story.steps.0.technical'));
  assert.equal(preparedProductReadiness(descriptor).inquiry.status, 'blocked');
});

test('product registry fails duplicate identities atomically and does not mutate input', () => {
  const input = fixture(), before = JSON.stringify(input);
  assert.throws(() => createPreparedProductRegistry([input, clone(input)]), { code: 'INVALID_PRODUCT_REGISTRY' });
  assert.throws(() => createPreparedProductRegistry([{ ...input, id: '../unsafe' }]), { code: 'INVALID_PRODUCT_REGISTRY' });
  const registry = createPreparedProductRegistry([input]); input.bundledRelease.content.title = 'Changed outside registry';
  assert.notEqual(registry.get('sk08').bundledRelease.content.title, input.bundledRelease.content.title);
  assert.throws(() => { registry.get('sk08').parts.push({ id: 'unexpected' }); }, TypeError);
  assert.equal(registry.get('unknown'), null);
  assert.equal(JSON.stringify(fixture()), before);
});

test('unsupported technical sources disable only technical steps while preserving static browsing and inquiry', () => {
  for (const change of [
    input => { input.technicalReferences[0].technical.pdfPage = 2; },
    input => { input.technicalReferences[0].technical.context.drawing.mappingRevision = 'new-mapping'; },
    input => { input.technicalReferences[0].technical.context.drawing.assetRevision = 'a'.repeat(64); },
    input => { input.overviewViews = []; },
    input => { input.drawingPackages[0].sheets[0].regions.find(region => region.id === 'shaft-bore').mappingStatus = 'unconfirmed'; },
  ]) {
    const input = fixture(); change(input); const product = createPreparedProductRegistry([input]).get('sk08');
    assert.equal(product.capabilities.technical.available, false); assert.equal(product.technicalReferences.length, 0);
    assert.equal(product.capabilities.inspection.available, true); assert.equal(product.capabilities.inquiry.available, true);
    assert.ok(product.readiness.issues.some(issue => issue.area === 'drawings' && issue.severity === 'error'));
    assert.ok(validateRelease(product.bundledRelease, { product }).some(issue => issue.path.includes('.technical')));
  }
});

test('readiness separates missing model, attribution, units and commercial preparation', () => {
  let input = fixture(); input.parts[1].parentId = input.parts[1].id;
  assert.equal(preparedProductReadiness(input).viewer.status, 'blocked');
  input = fixture(); input.source.license = '';
  assert.equal(preparedProductReadiness(input).viewer.status, 'blocked');
  input = fixture(); delete input.units;
  assert.equal(preparedProductReadiness(input).viewer.status, 'ready');
  assert.ok(preparedProductReadiness(input).issues.some(issue => issue.code === 'UNITS_UNCONFIRMED' && issue.severity === 'warning'));
  input = fixture(); delete input.commercial;
  assert.equal(preparedProductReadiness(input).inquiry.status, 'ready');
  assert.equal(preparedProductReadiness(input).commercial.status, 'not-configured');
});

test('historical release lookup and documents never silently substitute current versions', () => {
  const input = fixture(), registry = createPreparedProductRegistry([input]), product = registry.get('sk08');
  assert.equal(registry.forRelease(input.bundledRelease), product);
  assert.throws(() => registry.forRelease({ ...input.bundledRelease, modelRevision: 'older' }), { code: 'PREPARED_PRODUCT_UNAVAILABLE' });
  const content = product.resolveContent(input.bundledRelease.content);
  assert.equal(content.documents[0].url, '/reference.pdf');
  const changed = clone(input.bundledRelease.content); changed.documents[0].assetRevision = 'old-source';
  assert.throws(() => product.resolveContent(changed), { code: 'DOCUMENT_UNAVAILABLE' });
  assert.equal(input.bundledRelease.content.documents[0].url, undefined);
});

test('injected Studio product saves, previews, reviews and publishes independently of the crank store', async () => {
  const product = createPreparedProductRegistry([fixture()]).get('sk08'), memory = storage();
  memory.data.set(STUDIO_STORAGE_KEY, 'untouched crank storage');
  const repository = createStudioRepository({ product, storage: memory.storage, locks: null });
  const original = await repository.getPublished(); let draft = await repository.getDraft();
  assert.equal(draft.productId, 'sk08');
  draft.content.tagline = 'Review the chosen support detail.';
  draft = await repository.saveDraft(draft); const preview = await repository.createPreview(draft);
  const review = await repository.reviewRelease(draft); const release = await repository.publishDemo(review);
  assert.equal(release.version, original.version + 1); assert.deepEqual(release.presentation.story, original.presentation.story);
  assert.equal(memory.data.get(STUDIO_STORAGE_KEY), 'untouched crank storage');
  assert.ok(memory.data.has(`${STUDIO_STORAGE_KEY}:sk08`));
  const reloaded = createStudioRepository({ product, storage: memory.storage, locks: null });
  assert.deepEqual(await reloaded.getPublished(), release); assert.deepEqual(await reloaded.getRelease(original.id), original);
  assert.deepEqual(await reloaded.getPreview(preview.id), preview);
  await assert.rejects(repository.getDraft('kinetic-01'), { code: 'UNSUPPORTED_PRODUCT' });
  assert.ok((await repository.exportRelease(release.id)).assetManifest.some(asset => asset.id === 'reference-pdf'));
});

test('second-product release confirmation preserves review, stale edits and failed persistence guards', async () => {
  const product = createPreparedProductRegistry([fixture()]).get('sk08'), memory = storage();
  const repository = createStudioRepository({ product, storage: memory.storage, locks: null });
  let draft = await repository.getDraft(); draft = await repository.saveDraft(draft); const review = await repository.reviewRelease(draft);
  draft.presentation.story.steps[0].caption = 'Changed after review'; draft = await repository.saveDraft(draft);
  await assert.rejects(repository.publishDemo(review), { code: 'STALE_REVIEW' });
  const nextReview = await repository.reviewRelease(draft), originalWrite = memory.storage.setItem;
  memory.storage.setItem = () => { throw new Error('quota'); };
  await assert.rejects(repository.publishDemo(nextReview), { code: 'STORAGE_UNAVAILABLE' });
  memory.storage.setItem = originalWrite;
  assert.equal((await repository.getPublished()).id, product.bundledRelease.id);
  const release = await repository.publishDemo(nextReview);
  assert.deepEqual(await repository.publishDemo(nextReview), release);
});

test('saving a draft does not replace a pinned document revision with the current asset version', async () => {
  const product = createPreparedProductRegistry([fixture()]).get('sk08'), memory = storage();
  const repository = createStudioRepository({ product, storage: memory.storage, locks: null });
  let draft = await repository.getDraft(); draft.content.documents[0].assetRevision = 'previous-reference';
  draft = await repository.saveDraft(draft);
  assert.equal(draft.content.documents[0].assetRevision, 'previous-reference');
  assert.equal((await repository.getDraft()).content.documents[0].assetRevision, 'previous-reference');
  await assert.rejects(repository.createPreview(draft), { code: 'VALIDATION' });
  await assert.rejects(repository.reviewRelease(draft), { code: 'VALIDATION' });
  assert.equal((await repository.getPublished()).id, product.bundledRelease.id);
});

test('archived technical source stays readable while new publication requires available references', async () => {
  const product = createPreparedProductRegistry([fixture()]).get('sk08'), memory = storage();
  const repository = createStudioRepository({ product, storage: memory.storage, locks: null });
  let draft = await repository.saveDraft(await repository.getDraft());
  const released = await repository.publishDemo(await repository.reviewRelease(draft));
  const raw = memory.data.get(`${STUDIO_STORAGE_KEY}:sk08`);
  const unavailable = { ...product, technicalReferences: [] };
  const archive = parseStudioStore(raw, { product: unavailable });
  assert.equal(archive.releases.find(release => release.id === released.id).presentation.story.steps[0].technical.context.drawing.assetRevision,
    released.presentation.story.steps[0].technical.context.drawing.assetRevision);
  assert.ok(validateRelease(released, { product: unavailable }).some(issue => issue.path.includes('.technical')));
  assert.equal(memory.data.get(`${STUDIO_STORAGE_KEY}:sk08`), raw);
});

test('release comparison names a technical reference change rather than hiding it in camera data', () => {
  const product = fixture(), before = product.bundledRelease, after = clone(before);
  after.presentation.story.steps[0].technical.context.drawing.revision = 'reference-b';
  const rows = studioChanges(before, after, { product });
  assert.ok(rows.some(row => row.label.includes('Drawing reference') && row.after.includes('reference-b')));
});

test('reviewed second-product export applies only its registered package with exact source checks', async () => {
  const product = createPreparedProductRegistry([fixture()]).get('sk08'), memory = storage();
  const repository = createStudioRepository({ product, storage: memory.storage, locks: null });
  const draft = await repository.saveDraft(await repository.getDraft());
  const release = await repository.publishDemo(await repository.reviewRelease(draft));
  const packet = await repository.exportRelease(release.id);
  const root = await mkdtemp(join(tmpdir(), 'annora-prepared-release-'));
  try {
    await mkdir(join(root, 'content/rooms/kinetic-01'), { recursive: true });
    await writeFile(join(root, 'content/rooms/kinetic-01/release.json'), 'existing crank release');
    const result = await applyRoomRelease(packet, { root, product });
    assert.equal(result.target, join(root, 'content/rooms/sk08/release.json'));
    assert.equal((await readFile(join(root, 'content/rooms/kinetic-01/release.json'), 'utf8')), 'existing crank release');
    const published = JSON.parse(await readFile(result.target, 'utf8'));
    assert.equal(published.source, 'bundled'); assert.deepEqual(published.presentation.story, release.presentation.story);
    assert.equal((await applyRoomRelease(packet, { root, product })).changed, false);
    const invalid = clone(packet); invalid.release.presentation.story.steps[0].technical.context.drawing.assetRevision = 'a'.repeat(64);
    await assert.rejects(applyRoomRelease(invalid, { root, product, replace: true }), /drawing|association|overview/i);
    await assert.rejects(applyRoomRelease(packet, { root, product: { ...product, id: '../outside' } }), /registered/);
    assert.deepEqual(JSON.parse(await readFile(result.target, 'utf8')), published);
  } finally { await rm(root, { recursive: true, force: true }); }
});
