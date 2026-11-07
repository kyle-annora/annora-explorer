import test from 'node:test';
import assert from 'node:assert/strict';
import sourceDrawing from '../../content/drawings/sk08/package.json' with { type: 'json' };
import metadata from '../../content/models/sk08/metadata.json' with { type: 'json' };
import seed from '../../content/rooms/sk08/release.json' with { type: 'json' };
import { MODEL_CATALOG } from '../../src/generated/catalog.js';
import { preparedProductParts } from '../../src/product-room/prepared-products.js';
import { onboardingDrawingParts, onboardingCandidateFingerprint, createOnboardingDraft, normalizeOnboardingDraft, validateOnboardingDraft,
  buildOnboardingPreview, createOnboardingReview, createOnboardingPackage, assertOnboardingPackage } from '../../src/studio/onboarding-domain.js';
import { createOnboardingRepository, parseOnboardingStore, ONBOARDING_STORAGE_KEY } from '../../src/studio/onboarding-repository.js';

const clone = value => JSON.parse(JSON.stringify(value));
function fixture() {
  return clone({ id: 'sk08', model: MODEL_CATALOG.sk08, parts: preparedProductParts(metadata), source: metadata.source,
    modelManifest: 'content/models/sk08/model.json', drawingDirectory: 'content/drawings/sk08',
    units: { source: 'mm', display: 'm', evidence: 'Pinned STEP source units converted to meters by the preparation pipeline.' },
    assets: sourceDrawing.assets.map(asset => ({ id: asset.id, title: asset.id, revision: seed.content.documents.find(doc => doc.assetId === asset.id)?.assetRevision || asset.sha256,
      type: asset.kind.toUpperCase(), sha256: asset.sha256, fileName: asset.file, url: `/annora-explorer/drawings/sk08/${asset.file}` })),
    drawingPackages: [sourceDrawing], bundledRelease: seed, inquiryProfile: seed.inquiryProfile, posterAssetId: seed.content.posterAssetId,
  });
}
function complete(candidate, input = createOnboardingDraft(candidate)) {
  const draft = clone(input); draft.checks = { source: true, units: true };
  for (const sheet of draft.drawingPackage?.sheets || []) for (const region of sheet.regions) region.mappingStatus = 'confirmed';
  return normalizeOnboardingDraft(draft, candidate);
}
function memory() { const data = new Map(); return { data, storage: { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) } }; }
function setup(candidate = fixture(), m = memory()) {
  let id = 0; const repo = createOnboardingRepository({ candidate, storage: m.storage, locks: null, now: () => '2026-11-06T12:00:00.000Z', makeId: prefix => `${prefix}-${++id}` });
  return { candidate, ...m, repo, key: `${ONBOARDING_STORAGE_KEY}:${candidate.id}` };
}
async function reviewed(context) {
  const draft = await context.repo.saveDraft(complete(context.candidate, await context.repo.getDraft()));
  const preview = await context.repo.createPreview(draft), review = await context.repo.review(draft, preview.id);
  return { draft, preview, review };
}

test('intake starts with explicit source checks and unconfirmed links, without reusing the seed story', () => {
  const candidate = fixture(), before = clone(candidate), draft = createOnboardingDraft(candidate);
  assert.equal(draft.revision, 0); assert.equal(draft.presentation.story, undefined);
  assert.deepEqual(draft.checks, { source: false, units: false });
  assert.ok(draft.drawingPackage.sheets.every(sheet => sheet.regions.every(region => region.mappingStatus === 'needs-review')));
  const issues = validateOnboardingDraft(draft, candidate);
  assert.ok(issues.some(issue => issue.code === 'SOURCE_REVIEW_REQUIRED'));
  assert.ok(issues.some(issue => issue.code === 'UNITS_REVIEW_REQUIRED'));
  assert.ok(issues.some(issue => issue.section === 'associations' && issue.severity === 'error'));
  assert.throws(() => buildOnboardingPreview(draft, candidate), { code: 'VALIDATION' });
  assert.deepEqual(candidate, before);
});

test('reviewed preview is portable, immutable and retains source limitations', () => {
  const candidate = fixture(), draft = complete(candidate), issues = validateOnboardingDraft(draft, candidate);
  assert.deepEqual(issues.filter(issue => issue.severity === 'error'), []);
  const preview = buildOnboardingPreview(draft, candidate), review = createOnboardingReview(draft, preview, candidate);
  assert.equal(preview.content.source.note, seed.content.source.note);
  assert.equal(preview.content.documents[0].sample, true);
  assert.equal(preview.presentation.story, undefined);
  assert.ok(preview.drawingPackage.assets.every(asset => !('url' in asset)));
  assert.throws(() => { preview.content.title = 'Outside change'; }, TypeError);
  assert.ok(review.summary.some(item => /separate build/.test(item.value)));
  assert.ok(review.issues.some(issue => issue.severity === 'warning'));
});

test('stable candidate identity excludes delivery URLs but includes source, units and parts', () => {
  const candidate = fixture(), initial = onboardingCandidateFingerprint(candidate), altered = clone(candidate);
  altered.assets.forEach(asset => { asset.url = `https://cdn.example.test/another-build/${asset.fileName}`; });
  altered.drawingPackages[0].assets.forEach(asset => { asset.url = `/local-preview/${asset.file}`; });
  assert.equal(onboardingCandidateFingerprint(altered), initial);
  altered.units.evidence += ' Revised conversion.';
  assert.notEqual(onboardingCandidateFingerprint(altered), initial);
  assert.throws(() => normalizeOnboardingDraft(createOnboardingDraft(candidate), altered), { code: 'SOURCE_CHANGED' });
});

test('source files, annotations, content claims and prepared paths cannot be changed through intake', () => {
  const candidate = fixture();
  for (const mutate of [
    draft => { draft.drawingPackage.assets[0].sha256 = 'a'.repeat(64); },
    draft => { draft.drawingPackage.assets[0].file = 'different.pdf'; },
    draft => { draft.drawingPackage.sheets[0].regions[0].bounds[0] += 1; },
    draft => { draft.drawingPackage.sheets[0].regions[0].label = 'Approved bore'; },
    draft => { draft.content.source.note = 'Manufacturer approved'; },
    draft => { draft.content.documents[0].assetRevision = 'unverified-new-file'; },
  ]) { const draft = complete(candidate); mutate(draft); assert.throws(() => normalizeOnboardingDraft(draft, candidate), { code: 'SOURCE_CHANGED' }); }
  assert.throws(() => createOnboardingDraft({ ...candidate, modelManifest: 'content/models/../secrets.json' }), { code: 'INVALID_CANDIDATE' });
  assert.throws(() => createOnboardingDraft({ ...candidate, drawingDirectory: '/private/drawings' }), { code: 'INVALID_CANDIDATE' });
});

test('new association revision is deterministic while original drawing identity stays unchanged', () => {
  const candidate = fixture(); candidate.parts.push({ id: 'second-prepared-part', title: 'Second prepared part', parentId: null });
  const draft = complete(candidate), previous = draft.drawingPackage.mappingRevision;
  const region = draft.drawingPackage.sheets[0].regions[0]; region.partId = 'second-prepared-part';
  const changed = normalizeOnboardingDraft(draft, candidate);
  assert.notEqual(changed.drawingPackage.mappingRevision, previous);
  assert.equal(changed.drawingPackage.mappingRevision, normalizeOnboardingDraft(changed, candidate).drawingPackage.mappingRevision);
  assert.deepEqual(changed.drawingPackage.assets, draft.drawingPackage.assets);
  assert.equal(changed.drawingPackage.revision, sourceDrawing.revision);
  assert.equal(changed.drawingPackage.sheets[0].regions[0].camera, undefined);
  assert.equal(changed.drawingPackage.sheets[0].regions[0].focusPoint, undefined);
  changed.drawingPackage.sheets[0].regions[0].partId = 'not-a-prepared-part';
  assert.throws(() => buildOnboardingPreview(changed, candidate), { code: 'VALIDATION' });
});

test('drawing links target prepared geometry rather than root and grouping navigation nodes', () => {
  const candidate = fixture(); candidate.drawingPartIds = metadata.parts.map(part => part.id);
  assert.deepEqual(onboardingDrawingParts(candidate).map(part => part.id),candidate.drawingPartIds);
  for (const part of candidate.parts.filter(part => !candidate.drawingPartIds.includes(part.id))) {
    const draft = complete(candidate); draft.drawingPackage.sheets[0].regions[0].partId = part.id;
    assert.ok(validateOnboardingDraft(draft,candidate).some(issue => issue.section === 'associations' && issue.severity === 'error'));
    assert.throws(() => buildOnboardingPreview(draft,candidate),{code:'VALIDATION'});
  }
  const valid = complete(candidate); assert.equal(buildOnboardingPreview(valid,candidate).drawingPackage.sheets[0].regions[0].partId,'sk08-body');
});

test('source acknowledgement does not override missing license, failed preparation or unknown units', () => {
  for (const alter of [
    candidate => { candidate.source.license = ''; },
    candidate => { candidate.units.source = 'unknown'; },
    candidate => { candidate.readiness = { issues: [{ area: 'viewer', code: 'MESH_MISSING', path: 'model', message: 'Prepared geometry is missing.', severity: 'error' }] }; },
    candidate => { candidate.assets[0].sha256 = '0'.repeat(64); },
  ]) { const candidate = fixture(); alter(candidate); assert.throws(() => buildOnboardingPreview(complete(candidate), candidate), { code: 'VALIDATION' }); }
});

test('a 3D-only candidate remains usable without fabricated drawing or motion', () => {
  const candidate = fixture(); candidate.drawingPackages = []; candidate.drawingDirectory = null;
  const draft = complete(candidate), preview = buildOnboardingPreview(draft, candidate);
  assert.equal(preview.drawingPackage, null); assert.equal(preview.presentation.story, undefined);
  assert.ok(validateOnboardingDraft(draft, candidate).some(issue => issue.code === 'NO_DRAWING' && issue.severity === 'info'));
});

test('repository saves incomplete work but requires preview and review before export', async () => {
  const context = setup(), { repo } = context;
  const initial = await repo.getDraft(); assert.equal(initial.revision, 0); assert.equal(context.data.size, 0);
  let draft = await repo.saveDraft(initial); assert.equal(draft.revision, 1);
  await assert.rejects(repo.createPreview(draft), { code: 'VALIDATION' });
  await assert.rejects(repo.review(draft, 'no-preview'), { code: 'PREVIEW_REQUIRED' });
  draft = await repo.saveDraft(complete(context.candidate, draft));
  const preview = await repo.createPreview(draft); assert.deepEqual(await repo.createPreview(draft), preview);
  const review = await repo.review(draft, preview.id); assert.equal((await repo.listExports()).length, 0);
  const packet = await repo.exportReviewed(review); assert.equal(packet.kind, 'annora-onboarding-package');
  assert.deepEqual(await repo.exportReviewed(review), packet); assert.equal((await repo.listExports()).length, 1);
  assert.deepEqual(assertOnboardingPackage(packet, context.candidate), packet);
});

test('saved edits invalidate a pending preview and review; subsequent history remains pinned', async () => {
  const context = setup(), { repo } = context, first = await reviewed(context);
  let draft = clone(first.draft); draft.content.title = 'Changed intake title'; draft = await repo.saveDraft(draft);
  await assert.rejects(repo.review(draft, first.preview.id), { code: 'STALE_PREVIEW' });
  await assert.rejects(repo.exportReviewed(first.review), { code: 'STALE_REVIEW' });
  const preview = await repo.createPreview(draft), review = await repo.review(draft, preview.id), packet = await repo.exportReviewed(review);
  let next = clone(draft); next.content.summary = 'A second reviewed presentation.'; next = await repo.saveDraft(next);
  const nextPreview = await repo.createPreview(next), nextPacket = await repo.exportReviewed(await repo.review(next, nextPreview.id));
  const history = await repo.listExports(); assert.equal(history.length, 2);
  assert.deepEqual(history.find(item => item.id === packet.id), packet); assert.notEqual(nextPacket.preview.fingerprint, packet.preview.fingerprint);
  assert.deepEqual(await repo.exportReviewed(review), packet, 'retrying an already completed export returns its original receipt');
});

test('draft conflict, corrupt storage and storage quota preserve existing records', async () => {
  const context = setup(), { repo, key, data, storage } = context, { draft } = await reviewed(context);
  const stale = clone(draft); stale.content.title = 'First edit'; const current = await repo.saveDraft(stale);
  await assert.rejects(repo.saveDraft({ ...draft, content: { ...draft.content, title: 'Stale edit' } }), { code: 'CONFLICT' });
  const previousRaw = data.get(key), realWrite = storage.setItem;
  storage.setItem = () => { throw new Error('quota'); };
  await assert.rejects(repo.saveDraft({ ...current, content: { ...current.content, title: 'Unpersisted edit' } }), { code: 'STORAGE_UNAVAILABLE' });
  assert.equal(data.get(key), previousRaw); storage.setItem = realWrite;
  data.set(key, '{bad-json'); await assert.rejects(repo.getDraft(), { code: 'STORAGE_CORRUPT' });
  await assert.rejects(repo.saveDraft(current), { code: 'STORAGE_CORRUPT' }); assert.equal(data.get(key), '{bad-json');
  data.set(key, previousRaw); assert.deepEqual(await repo.getDraft(), current);
});

test('repository is separate from existing Studio, drawings and customer projects', async () => {
  const context = setup();
  for (const key of ['annora.studio.v1', 'annora.drawings.v1', 'annora.projects.v1']) context.data.set(key, 'existing history');
  const { review } = await reviewed(context); await context.repo.exportReviewed(review);
  for (const key of ['annora.studio.v1', 'annora.drawings.v1', 'annora.projects.v1']) assert.equal(context.data.get(key), 'existing history');
  const reloaded = setup(context.candidate, { data: context.data, storage: context.storage });
  assert.deepEqual(await reloaded.repo.listExports(), await context.repo.listExports());
});

test('export validation rejects altered target, mapping, source and unreviewed payload fields', () => {
  const candidate = fixture(), draft = complete(candidate), preview = buildOnboardingPreview(draft, candidate), review = createOnboardingReview(draft, preview, candidate);
  const packet = createOnboardingPackage(review, candidate, { id: 'EXPORT-1', createdAt: '2026-11-06T12:00:00.000Z' });
  for (const change of [
    item => { item.modelManifest = 'content/models/other/model.json'; },
    item => { item.drawingDirectory = 'content/drawings/other'; },
    item => { item.draft.drawingPackage.mappingRevision = 'unchecked'; },
    item => { item.draft.drawingPackage.assets[0].sha256 = 'a'.repeat(64); },
    item => { item.preview.content.title = 'After review'; },
    item => { item.reviewToken = 'forged'; },
    item => { item.deploy = true; },
  ]) { const altered = clone(packet); change(altered); assert.throws(() => assertOnboardingPackage(altered, candidate)); }
});

test('source changes and corrupt archived previews are held rather than silently migrated', async () => {
  const context = setup(); await reviewed(context); const raw = context.data.get(context.key);
  const changed = fixture(); changed.source.note += ' new source';
  assert.throws(() => parseOnboardingStore(raw, changed), { code: 'SOURCE_CHANGED' });
  const corrupt = JSON.parse(raw); corrupt.previews[0].content.title = 'Wrong snapshot';
  assert.throws(() => parseOnboardingStore(JSON.stringify(corrupt), context.candidate), { code: 'STORAGE_CORRUPT' });
  assert.equal(context.data.get(context.key), raw);
});
