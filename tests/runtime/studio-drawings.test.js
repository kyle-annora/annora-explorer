import test from 'node:test';
import assert from 'node:assert/strict';
import { createDrawingRepository, DRAWING_STUDIO_STORAGE_KEY, parseDrawingStudioStore } from '../../src/studio/drawing-repository.js';
import { updateDrawingMapping, confirmDrawingPairing, drawingReleaseIssues, drawingMappingSummary, compareDrawingPackages } from '../../src/studio/drawing-domain.js';

function entry({ revision = 'source-v1', modelRevision = 'model-v1', pairing = 'source-derived' } = {}) {
  return { id: 'linkage', title: 'Prepared linkage', model: { id: 'linkage', revision: modelRevision, parts: [{ id: 'rod', title: 'Connecting rod' }, { id: 'pin', title: 'Pivot pin' }] }, package: {
    schemaVersion: 2, id: 'linkage-drawing', modelId: 'linkage', modelRevision, title: 'Linkage drawing', revision, mappingRevision: 'mapping-v1',
    sourceURL: 'https://example.com/pinned-source', units: 'mm', status: 'unreviewed-reference', pairing: { status: pairing, evidence: 'STEP and PDF exported from the same versioned source.' },
    assets: [{ id: 'drawing-pdf', kind: 'pdf', file: 'drawing.pdf', sha256: 'a'.repeat(64), url: '/drawing.pdf' }, { id: 'source-step', kind: 'step', file: 'part.step', sha256: 'b'.repeat(64), url: '/part.step' }],
    sheets: [{ id: 'sheet-1', title: 'Sheet 1', assetId: 'drawing-pdf', format: 'pdf', pdfPage: 1, viewBox: [0, 0, 400, 300], coordinateFrame: 'page-top-left', rotation: 0,
      regions: [{ id: 'bore', label: 'Large bore', partId: 'rod', bounds: [10, 20, 100, 80], mappingStatus: 'confirmed', dimension: 'Source reference' }] }],
  } };
}
function fixture(packages = [entry()]) {
  const data = new Map([['annora.room.projects.v1', 'existing buyer work'], ['annora.studio.products.v1', 'existing seller work']]);
  let count = 0, fail = false;
  const storage = { getItem: key => data.get(key) ?? null, setItem(key, value) { if (fail) throw new Error('Quota'); data.set(key, value); } };
  const options = { packages, storage, locks: null, now: () => '2026-11-01T12:00:00Z', makeId: prefix => `${prefix}-${++count}` };
  return { repo: createDrawingRepository(options), other: () => createDrawingRepository(options), storage, data, fail: value => { fail = value; }, options };
}
const code = expected => error => error.code === expected;
const save = async repo => repo.saveDraft(await repo.getDraft());
const publish = async (repo, draft) => repo.publishReviewed(await repo.reviewDraft(draft), { confirmed: true });

test('Drawing mappings require explicit confirmation; failed review retains a saved draft', async () => {
  const f = fixture(), source = entry(); let draft = await f.repo.getDraft();
  draft = updateDrawingMapping(draft, source, 'sheet-1', 'bore', { label: 'Pivot detail', bounds: [20, 25, 120, 85] });
  assert.equal(draft.packageSnapshot.sheets[0].regions[0].mappingStatus, 'needs-review');
  draft = await f.repo.saveDraft(draft);
  await assert.rejects(f.repo.reviewDraft(draft), code('VALIDATION'));
  assert.deepEqual(await f.repo.getDraft(), draft); assert.equal(await f.repo.getPublished(), null);
  draft = updateDrawingMapping(draft, source, 'sheet-1', 'bore', {}, { confirm: true });
  draft = await f.repo.saveDraft(draft);
  const review = await f.repo.reviewDraft(draft);
  await assert.rejects(f.repo.publishReviewed(review), code('CONFIRMATION_REQUIRED'));
  const release = await f.repo.publishReviewed(review, { confirmed: true });
  assert.equal(release.mappingRevision, draft.packageSnapshot.mappingRevision);
  assert.equal(release.modelRevision, source.model.revision); assert.equal(release.sourceRevision, source.package.revision);
  assert.equal(release.packageSnapshot.sheets[0].regions[0].label, 'Pivot detail');
  assert.equal(f.data.get('annora.room.projects.v1'), 'existing buyer work');
  assert.equal(f.data.get('annora.studio.products.v1'), 'existing seller work');
});

test('Off-page regions and unknown part IDs cannot be confirmed or published', async () => {
  const { repo } = fixture(), source = entry(); let draft = await repo.getDraft();
  assert.throws(() => updateDrawingMapping(draft, source, 'sheet-1', 'bore', { bounds: [390, 20, 30, 40] }, { confirm: true }), code('VALIDATION'));
  assert.throws(() => updateDrawingMapping(draft, source, 'sheet-1', 'bore', { partId: 'invented-part' }, { confirm: true }), code('VALIDATION'));
  draft = updateDrawingMapping(draft, source, 'sheet-1', 'bore', { bounds: [390, 20, 30, 40], partId: 'invented-part' });
  const saved = await repo.saveDraft(draft);
  await assert.rejects(repo.reviewDraft(saved), code('VALIDATION'));
  assert.deepEqual((await repo.getDraft()).packageSnapshot, saved.packageSnapshot);
});

test('Immutable source geometry, asset hashes and sheet coordinates cannot be edited as mappings', async () => {
  const { repo } = fixture();
  for (const mutate of [draft => { draft.packageSnapshot.modelRevision = 'new-model'; }, draft => { draft.packageSnapshot.assets[0].sha256 = 'c'.repeat(64); }, draft => { draft.packageSnapshot.sheets[0].viewBox[2] = 800; }, draft => { draft.packageSnapshot.sheets[0].regions[0].dimension = 'Invented dimension'; }]) {
    const draft = await repo.getDraft(); mutate(draft); await assert.rejects(repo.saveDraft(draft), code('SOURCE_CHANGED'));
  }
});

test('Review is invalidated by later edits or tampering, and repeat publish is idempotent', async () => {
  const { repo } = fixture(); let draft = await save(repo), review = await repo.reviewDraft(draft);
  const tampered = structuredClone(review); tampered.draft.packageSnapshot.sheets[0].regions[0].label = 'Unreviewed replacement';
  await assert.rejects(repo.publishReviewed(tampered, { confirmed: true }), code('STALE_REVIEW'));
  draft = updateDrawingMapping(draft, entry(), 'sheet-1', 'bore', { label: 'A reviewed detail' }, { confirm: true });
  draft = await repo.saveDraft(draft);
  await assert.rejects(repo.publishReviewed(review, { confirmed: true }), code('STALE_REVIEW'));
  review = await repo.reviewDraft(draft); const first = await repo.publishReviewed(review, { confirmed: true });
  assert.deepEqual(await repo.publishReviewed(review, { confirmed: true }), first);
  draft = updateDrawingMapping(draft, entry(), 'sheet-1', 'bore', { label: 'A second detail' }, { confirm: true });
  draft = await repo.saveDraft(draft); const second = await publish(repo, draft);
  assert.equal(second.version, 2);
  await repo.publishReviewed(review, { confirmed: true });
  assert.equal((await repo.getPublished()).id, second.id);
  assert.equal((await repo.getRelease(first.id)).packageSnapshot.sheets[0].regions[0].label, 'A reviewed detail');
  assert.throws(() => { first.packageSnapshot.sheets[0].regions[0].label = 'Mutation'; }, TypeError);
});

test('A source replacement starts a separate draft and keeps exact old releases readable', async () => {
  const f = fixture(); const draft = await save(f.repo), first = await publish(f.repo, draft);
  const changed = entry({ revision: 'source-v2', modelRevision: 'model-v2' }); changed.package.assets[0].sha256 = 'c'.repeat(64);
  const repo = createDrawingRepository({ ...f.options, packages: [changed] });
  const next = await repo.getDraft(); assert.equal(next.revision, 0); assert.notEqual(next.key, draft.key);
  assert.equal(next.packageSnapshot.modelRevision, 'model-v2');
  assert.deepEqual(await repo.getRelease(first.id), first);
  await assert.rejects(repo.saveDraft(draft), code('SOURCE_CHANGED'));
  await repo.saveDraft(next);
  assert.equal(parseDrawingStudioStore(f.data.get(DRAWING_STUDIO_STORAGE_KEY)).drafts.length, 2);
});

test('Unverified pairing blocks release until evidence is explicitly confirmed', async () => {
  const source = entry({ pairing: 'unverified' }), { repo } = fixture([source]); let draft = await save(repo);
  assert.ok(drawingReleaseIssues(draft, source).some(issue => issue.code === 'UNVERIFIED_PAIRING'));
  await assert.rejects(repo.reviewDraft(draft), code('VALIDATION'));
  assert.throws(() => confirmDrawingPairing(draft, source, 'OK'), code('VALIDATION'));
  draft = confirmDrawingPairing(draft, source, 'The original PDF and STEP share the pinned source revision and shape.');
  draft = await repo.saveDraft(draft); const release = await publish(repo, draft);
  assert.equal(release.packageSnapshot.pairing.status, 'human-confirmed');
  assert.equal(release.packageSnapshot.status, 'unreviewed-reference');
});

test('Failed storage writes and corrupt stores preserve earlier work', async () => {
  const f = fixture(), draft = await save(f.repo), review = await f.repo.reviewDraft(draft);
  f.fail(true); await assert.rejects(f.repo.publishReviewed(review, { confirmed: true }), code('STORAGE_UNAVAILABLE'));
  assert.equal(await f.repo.getPublished(), null); assert.deepEqual(await f.repo.getDraft(), draft);
  f.fail(false); await f.repo.publishReviewed(review, { confirmed: true });
  const broken = '{"schemaVersion":999,"unrelated":"keep me"}'; f.data.set(DRAWING_STUDIO_STORAGE_KEY, broken);
  await assert.rejects(f.repo.getDraft(), code('STORAGE_CORRUPT'));
  assert.equal(f.data.get(DRAWING_STUDIO_STORAGE_KEY), broken);
});

test('Concurrent draft writers conflict instead of overwriting, and previews remain pinned', async () => {
  const f = fixture(), other = f.other(), first = await f.repo.getDraft(), stale = await other.getDraft();
  let current = await f.repo.saveDraft(first);
  await assert.rejects(other.saveDraft(stale), code('CONFLICT'));
  const preview = await f.repo.createPreview(current);
  current = updateDrawingMapping(current, entry(), 'sheet-1', 'bore', { label: 'Later revision' }, { confirm: true });
  current = await f.repo.saveDraft(current);
  assert.equal((await f.repo.getPreview(preview.id)).packageSnapshot.sheets[0].regions[0].label, 'Large bore');
  assert.notEqual((await f.repo.createPreview(current)).id, preview.id);
  assert.deepEqual(drawingMappingSummary(current.packageSnapshot), { total: 1, confirmed: 1, needsReview: 0, missing: 0 });
});

test('A deployment URL change resolves hash-identical assets without replacing draft source identity', async () => {
  const f = fixture(), saved = await save(f.repo), source = entry();
  source.assets = { 'drawing-pdf': '/new-base/assets/drawing.pdf', 'source-step': '/new-base/assets/part.step' };
  const repo = createDrawingRepository({ ...f.options, packages: [source] });
  let draft = await repo.getDraft();
  assert.equal(draft.key, saved.key); assert.equal(draft.revision, saved.revision);
  assert.equal(draft.packageSnapshot.assets[0].url, '/new-base/assets/drawing.pdf');
  draft.packageSnapshot.assets[0].url = 'https://untrusted.example/replaced.pdf';
  draft = await repo.saveDraft(draft);
  assert.equal(draft.packageSnapshot.assets[0].url, '/new-base/assets/drawing.pdf');
  assert.equal((await publish(repo, draft)).packageSnapshot.assets[0].sha256, 'a'.repeat(64));
});

test('An updated prepared mapping version starts a new draft even when the source file is unchanged', async () => {
  const f = fixture(), original = await save(f.repo), source = entry();
  source.package.mappingRevision = 'mapping-v2'; source.package.sheets[0].regions[0].label = 'Corrected prepared detail';
  const repo = createDrawingRepository({ ...f.options, packages: [source] }), next = await repo.getDraft();
  assert.notEqual(next.key, original.key); assert.equal(next.revision, 0);
  assert.equal(next.packageSnapshot.sheets[0].regions[0].label, 'Corrected prepared detail');
});


test('Stored releases reject unconfirmed or unresolved associations without erasing the record', async () => {
  const f = fixture(), draft = await save(f.repo); await publish(f.repo, draft);
  const store = JSON.parse(f.data.get(DRAWING_STUDIO_STORAGE_KEY));
  store.releases[0].packageSnapshot.sheets[0].regions[0].partId = 'unknown-part';
  const corrupt = JSON.stringify(store); f.data.set(DRAWING_STUDIO_STORAGE_KEY, corrupt);
  await assert.rejects(f.repo.getPublished(), code('STORAGE_CORRUPT'));
  assert.equal(f.data.get(DRAWING_STUDIO_STORAGE_KEY), corrupt);
});

test('Mapping comparisons keep document identity separate from association edits and quotation versions', async () => {
  const f = fixture(), original = entry().package; let draft = await f.repo.getDraft();
  draft = updateDrawingMapping(draft, entry(), 'sheet-1', 'bore', { label: 'Updated bore detail', bounds: [12, 22, 80, 70] }, { confirm: true });
  draft = await f.repo.saveDraft(draft); const release = await publish(f.repo, draft);
  assert.deepEqual(release.previousPackageSnapshot, original);
  const comparison = compareDrawingPackages(release.previousPackageSnapshot, release.packageSnapshot, { parts: entry().model.parts });
  assert.equal(comparison.sourceFilesUnchanged, true); assert.equal(comparison.sourceChanges.length, 0);
  assert.equal(comparison.associationCount, 1); assert.equal(comparison.associationChanges.length, 2);
  const changedSource = structuredClone(release.packageSnapshot); changedSource.revision = 'source-v2'; changedSource.assets[0].sha256 = 'd'.repeat(64);
  const next = compareDrawingPackages(release.packageSnapshot, changedSource);
  assert.equal(next.sourceFilesUnchanged, false); assert.equal(next.associationCount, 0);
  assert.ok(next.sourceChanges.some(row => row.label === 'Drawing source version'));
  assert.equal(compareDrawingPackages(null, changedSource).available, false);
});
