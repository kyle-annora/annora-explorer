import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createDrawingAssetStore, resolveDrawingAssets, drawingBlobHash } from '../../src/studio/drawing-asset-store.js';
import { inspectDrawingPDF, importDrawingPDF } from '../../src/studio/drawing-source-import.js';
import { createDrawingRepository, DRAWING_STUDIO_STORAGE_KEY } from '../../src/studio/drawing-repository.js';
import { updateDrawingMapping, confirmDrawingPairing, addDrawingMapping, removeDrawingMapping, removeUnplacedDrawingMapping } from '../../src/studio/drawing-domain.js';

const code = expected => error => error.code === expected;
const pdf = text => new Blob([`%PDF-1.4\n${text}`], { type: 'application/pdf' });
function assetFixture() {
  const values = new Map(); let failure;
  const backend = { async get(key) { if (failure) throw failure; return values.get(key); }, async add(record) { if (failure) throw failure; if (values.has(record.key)) throw Object.assign(new Error('Exists'), { name: 'ConstraintError' }); values.set(record.key, record); } };
  return { values, backend, store: createDrawingAssetStore({ backend, crypto: webcrypto }), fail(error) { failure = error; } };
}
function modelEntry() {
  return { id: 'rod', title: 'Rod reference', model: { id: 'rod', revision: 'model-v1', parts: [{ id: 'body', title: 'Rod body' }, { id: 'pin', title: 'Pivot' }] }, package: {
    schemaVersion: 2, id: 'rod-drawing', modelId: 'rod', modelRevision: 'model-v1', title: 'Rod source', revision: 'source-A', mappingRevision: 'mapping-A',
    sourceURL: 'https://example.test/model-source', units: 'mm', status: 'unreviewed-reference', pairing: { status: 'source-derived', evidence: 'Original paired source package.' },
    assets: [{ id: 'pdf-A', kind: 'pdf', file: 'original.pdf', sha256: 'a'.repeat(64), url: '/original.pdf' }, { id: 'step-A', kind: 'step', file: 'original.step', sha256: 'b'.repeat(64), url: '/original.step' }],
    sheets: [1, 2].map(page => ({ id: `sheet-${page}`, title: `Original page ${page}`, assetId: 'pdf-A', format: 'pdf', pdfPage: page, viewBox: [0, 0, 400, 300], coordinateFrame: 'page-top-left', rotation: 0,
      regions: [{ id: `detail-${page}`, label: `Bore ${page}`, partId: 'body', bounds: [20, 30, 100, 70], mappingStatus: 'confirmed', dimension: 'Unreviewed source annotation', camera: { direction: [1, 1, 1], up: [0, 1, 0], halfSize: [1, 1, 1] }, focusPoint: [0, 0, 0] }] })) } };
}
function fixture() {
  const assets = assetFixture(), values = new Map(), entry = modelEntry(); let count = 0;
  const options = { packages: [entry], assetStore: assets.store, locks: null, storage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }, makeId: prefix => `${prefix}-${++count}`, now: () => '2026-11-01T18:00:00Z' };
  return { entry, assets, values, options, repo: createDrawingRepository(options) };
}
function runtime(pages = [[400, 300]], options = {}) {
  const stats = { created: [], revoked: [], destroyed: 0, cleaned: 0, loaded: 0 };
  const URL = { createObjectURL() { const url = `blob:test-${stats.created.length}`; stats.created.push(url); return url; }, revokeObjectURL(url) { stats.revoked.push(url); } };
  const document = { numPages: pages.length, async getPage(number) { if (options.pageError) throw new Error('Bad page'); return { getViewport: () => ({ width: pages[number - 1][0], height: pages[number - 1][1] }), cleanup() { stats.cleaned++; } }; } };
  const loadPDF = async () => { if (options.runtimeWait) await options.runtimeWait; return { loadPDFDocument() { stats.loaded++; return { promise: options.taskWait || Promise.resolve(document), destroy() { stats.destroyed++; return Promise.resolve(); } }; } }; };
  return { loadPDF, URL, stats };
}
async function saveA(f) { const draft = await f.repo.saveDraft(await f.repo.getDraft()); const release = await f.repo.publishReviewed(await f.repo.reviewDraft(draft), { confirmed: true }); return { draft, release }; }
async function importB(f, opts = {}) { const mock = runtime(opts.pages || [[400, 300], [400, 300]]); return importDrawingPDF({ productId: f.entry.id, file: pdf(opts.text || 'Source B'), revisionLabel: opts.label || 'Review B', repository: f.repo, ...mock, baseDraftId: opts.baseDraftId }); }

test('PDF inspection captures real page coordinates without rendering and releases worker/URL resources', async () => {
  const mock = runtime([[400, 300], [300, 600]]), result = await inspectDrawingPDF(pdf('source'), { ...mock, crypto: webcrypto });
  assert.equal(result.pages.length, 2); assert.deepEqual(result.pages[1], { pageNumber: 2, width: 300, height: 600, coordinateFrame: 'page-top-left', rotation: 0 });
  assert.equal(result.sha256, await drawingBlobHash(result.file)); assert.equal(mock.stats.cleaned, 2);
  assert.equal(mock.stats.destroyed, 1); assert.deepEqual(mock.stats.revoked, mock.stats.created);
});

test('Invalid, oversized, overlong and failed PDFs never create persistent assets', async () => {
  const f = fixture(), mock = runtime();
  await assert.rejects(inspectDrawingPDF(new Blob(['not a PDF']), mock), code('INVALID_PDF'));
  await assert.rejects(inspectDrawingPDF(pdf('source'), { ...mock, maxBytes: 5 }), code('PDF_TOO_LARGE'));
  await assert.rejects(inspectDrawingPDF(pdf('source'), { ...runtime([[400, 300], [400, 300]]), maxPages: 1 }), code('PDF_PAGE_LIMIT'));
  await assert.rejects(importDrawingPDF({ productId: 'rod', file: pdf('bad'), revisionLabel: 'B', repository: f.repo, ...runtime([[400, 300]], { pageError: true }) }), code('INVALID_PDF'));
  assert.equal(f.assets.values.size, 0); assert.equal(f.values.size, 0);
});

test('Timeout and cancellation during lazy runtime load cannot later create workers or object URLs', async () => {
  let finish; const wait = new Promise(resolve => { finish = resolve; }), mock = runtime([[400, 300]], { runtimeWait: wait });
  await assert.rejects(inspectDrawingPDF(pdf('source'), { ...mock, timeoutMs: 5 }), code('PDF_TIMEOUT'));
  finish(); await new Promise(resolve => setTimeout(resolve, 1));
  assert.equal(mock.stats.loaded, 0); assert.equal(mock.stats.created.length, 0);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(inspectDrawingPDF(pdf('source'), { ...runtime(), signal: controller.signal }), code('IMPORT_CANCELLED'));
});

test('Immutable SHA-addressed assets deduplicate, detect corruption and report quota failures', async () => {
  const f = assetFixture(), blob = pdf('source'), one = await f.store.put(blob, { fileName: '../source.pdf' }), two = await f.store.put(blob);
  assert.equal(one.key, two.key); assert.equal(one.created, true); assert.equal(two.created, false); assert.equal(f.values.size, 1);
  assert.equal((await f.store.get(one.key)).fileName, 'source.pdf');
  await assert.rejects(f.store.put(pdf('wrong'), { sha256: one.sha256 }), code('ASSET_HASH_MISMATCH'));
  const corrupt = f.values.get(one.key); f.values.set(one.key, { ...corrupt, blob: pdf('different') });
  await assert.rejects(f.store.get(one.key), code('ASSET_CORRUPT'));
  f.fail(Object.assign(new Error('Full'), { name: 'QuotaExceededError' }));
  await assert.rejects(f.store.put(pdf('another')), code('ASSET_QUOTA'));
});

test('Source B is separately saved, unconfirmed and survives repository recreation; A remains exact', async () => {
  const f = fixture(), a = await saveA(f), before = JSON.stringify(a.release);
  let b = await importB(f, { baseDraftId: a.draft.id });
  assert.notEqual(b.key, a.draft.key); assert.equal(b.revision, 1); assert.equal(b.packageSnapshot.modelRevision, a.release.modelRevision);
  assert.ok(b.packageSnapshot.sheets.flatMap(sheet => sheet.regions).every(region => region.mappingStatus === 'needs-review' && !('dimension' in region)));
  assert.equal(b.packageSnapshot.pairing.status, 'unverified');
  assert.ok(b.packageSnapshot.assets.find(asset => asset.kind === 'pdf').localBlobKey);
  assert.equal(JSON.stringify(b).includes('blob:'), false);
  await assert.rejects(f.repo.reviewDraft(b), code('VALIDATION'));
  const restored = createDrawingRepository(f.options); assert.equal((await restored.getDraft()).id, b.id);
  assert.equal((await restored.listSourceVersions('rod')).length, 2);
  assert.equal(JSON.stringify(await restored.getRelease(a.release.id)), before);
  assert.equal((await restored.getDraftById(a.draft.id)).packageSnapshot.revision, 'source-A');
  await restored.selectDraft(a.draft.id); assert.equal((await restored.getDraft()).id, a.draft.id);
  await restored.selectDraft(b.id);
  for (const sheet of b.packageSnapshot.sheets) for (const region of sheet.regions) b = updateDrawingMapping(b, f.entry, sheet.id, region.id, {}, { confirm: true });
  b = confirmDrawingPairing(b, f.entry, 'The uploaded PDF has been checked against the unchanged rod model.');
  b = await restored.saveDraft(b); const release = await restored.publishReviewed(await restored.reviewDraft(b), { confirmed: true });
  assert.equal(release.version, 2); assert.equal(release.sourceVersionId, b.sourceVersionId);
  assert.equal(JSON.stringify(await restored.getRelease(a.release.id)), before);
  assert.equal(JSON.stringify(release).includes('blob:'), false);
});

test('Changed page dimensions create missing regions; vanished sheets remain explicitly unplaced', async () => {
  const f = fixture(); let b = await importB(f, { pages: [[80, 60]] });
  assert.equal(b.packageSnapshot.sheets[0].regions[0].bounds, null); assert.equal(b.packageSnapshot.sheets[0].regions[0].mappingStatus, 'missing');
  assert.equal(b.packageSnapshot.unplacedMappings.length, 1); assert.equal(b.importWarnings.length, 2);
  b = updateDrawingMapping(b, f.entry, 'sheet-1', 'detail-1', { label: 'Recheck bore' });
  assert.equal(b.packageSnapshot.sheets[0].regions[0].mappingStatus, 'missing');
  assert.throws(() => updateDrawingMapping(b, f.entry, 'sheet-1', 'detail-1', {}, { confirm: true }), code('VALIDATION'));
  b = updateDrawingMapping(b, f.entry, 'sheet-1', 'detail-1', { bounds: [10, 10, 30, 20] }, { confirm: true });
  const unplaced = b.packageSnapshot.unplacedMappings[0];
  b = addDrawingMapping(b, f.entry, 'sheet-1', { fromUnplacedId: unplaced.id, bounds: [45, 10, 20, 20] });
  assert.equal(b.packageSnapshot.unplacedMappings.length, 0); assert.equal(b.packageSnapshot.sheets[0].regions[1].mappingStatus, 'needs-review');
  b = await f.repo.saveDraft(b); assert.equal((await f.repo.getDraft()).id, b.id);
});

test('Explicit region creation/removal preserves stable history and relinking clears stale authored cameras', async () => {
  const f = fixture(); let b = await importB(f);
  b = addDrawingMapping(b, f.entry, 'sheet-1', { id: 'new-pin', label: 'Pin interface', partId: 'pin', bounds: [150, 20, 50, 50] });
  assert.equal(b.packageSnapshot.sheets[0].regions.at(-1).mappingStatus, 'needs-review');
  b = updateDrawingMapping(b, f.entry, 'sheet-1', 'new-pin', {}, { confirm: true });
  b = updateDrawingMapping(b, f.entry, 'sheet-1', 'detail-1', { bounds: [22, 32, 90, 60] });
  assert.equal('camera' in b.packageSnapshot.sheets[0].regions[0], false, 'redrawing must not retain an old detail camera');
  b = updateDrawingMapping(b, f.entry, 'sheet-1', 'detail-1', { partId: 'pin' });
  assert.equal('camera' in b.packageSnapshot.sheets[0].regions[0], false);
  b = removeDrawingMapping(b, f.entry, 'sheet-1', 'new-pin');
  assert.throws(() => addDrawingMapping(b, f.entry, 'sheet-1', { id: 'new-pin', partId: 'pin', bounds: [150, 20, 50, 50] }), code('DUPLICATE_REGION'));
  b = await f.repo.saveDraft(b); assert.equal(b.packageSnapshot.sheets[0].regions.length, 1);
  const forged = structuredClone(b); forged.sourcePackageSnapshot.assets.at(-1).sha256 = 'c'.repeat(64);
  await assert.rejects(f.repo.saveDraft(forged), code('SOURCE_CHANGED'));
});

test('URL leases are transient, revoke on disposal/failure and missing originals block reviewed publication', async () => {
  const f = fixture(); let b = await importB(f), mock = runtime();
  const lease = await resolveDrawingAssets(b.packageSnapshot, { assetStore: f.assets.store, URL: mock.URL });
  assert.ok(lease.package.assets.find(asset => asset.localBlobKey).url.startsWith('blob:'));
  assert.equal(JSON.stringify(b).includes('blob:'), false); lease.dispose(); lease.dispose(); assert.equal(mock.stats.revoked.length, 1);
  const invalid = structuredClone(b.packageSnapshot); invalid.assets.push({ id: 'missing', kind: 'pdf', file: 'missing.pdf', sha256: 'f'.repeat(64), localBlobKey: `sha256:${'f'.repeat(64)}` });
  await assert.rejects(resolveDrawingAssets(invalid, { assetStore: f.assets.store, URL: mock.URL }), code('ASSET_MISSING'));
  assert.equal(mock.stats.created.length, mock.stats.revoked.length);
  for (const sheet of b.packageSnapshot.sheets) for (const region of sheet.regions) b = updateDrawingMapping(b, f.entry, sheet.id, region.id, {}, { confirm: true });
  b = confirmDrawingPairing(b, f.entry, 'The uploaded file and unchanged model have been reviewed together.'); b = await f.repo.saveDraft(b);
  f.assets.values.clear(); await assert.rejects(f.repo.reviewDraft(b), code('ASSET_MISSING'));
  assert.equal((await f.repo.getDraft()).id, b.id); assert.ok(f.values.get(DRAWING_STUDIO_STORAGE_KEY));
});
