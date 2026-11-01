import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { DrawingPackageError, normalizeDrawingPackage, releaseDiagnostic, resolveSheetContext, sourceAssetFor } from '../src/drawings/package.js';
import { normalizeRotation, pdfRasterSize, rotateBounds, rotatePoint, rotateSheet, unrotatePoint, unrotateBounds } from '../src/drawings/coordinates.js';

const hash = 'a'.repeat(64);
const sourcePackage = () => ({
  schemaVersion: 2, id: 'bearing-drawings', modelId: 'bearing', modelRevision: 'geometry-001',
  title: 'Bearing reference', revision: 'source-001', mappingRevision: 'mapping-001',
  sourceURL: 'https://example.org/bearing.pdf', units: 'mm', status: 'unreviewed-reference',
  pairing: { status: 'human-confirmed', evidence: 'STEP and source PDF checked against the supplier revision.' },
  assets: [
    { id: 'original-pdf', kind: 'pdf', file: 'original.pdf', sha256: hash },
    { id: 'source-step', kind: 'step', file: 'source.step', sha256: 'b'.repeat(64) },
    { id: 'reference-pdf', kind: 'pdf', file: 'reference.pdf', sha256: 'c'.repeat(64), sourceAssetId: 'original-pdf' },
  ],
  sheets: [1, 2].map(number => ({ id: `sheet-${number}`, title: `Sheet ${number}`, assetId: 'reference-pdf', format: 'pdf', pdfPage: number,
    coordinateFrame: 'page-top-left', viewBox: [0, 0, 800, 600], rotation: number === 1 ? 0 : 90,
    regions: [{ id: 'bore', label: 'Bearing bore', partId: 'bearing-body', bounds: [100, 150, 60, 40], mappingStatus: 'confirmed',
      camera: { target: [1, 2, 3], direction: [0, 0, 1], halfSize: [1, 1, 1] } }],
  })),
});

test('normalization preserves exact source/model/mapping identities and never mutates the authoring package', () => {
  const input = sourcePackage(), before = structuredClone(input);
  const pkg = normalizeDrawingPackage(input, { assetURLs: { 'reference-pdf': 'https://example.test/assets/reference-abc.pdf' } });
  assert.deepEqual(input, before);
  assert.equal(pkg.modelRevision, 'geometry-001'); assert.equal(pkg.mappingRevision, 'mapping-001');
  assert.equal(pkg.assets[2].sha256, 'c'.repeat(64)); assert.equal(pkg.assets[2].url, 'https://example.test/assets/reference-abc.pdf');
  assert.equal(sourceAssetFor(pkg, 'reference-pdf').id, 'original-pdf');
  const context = resolveSheetContext(pkg, 'sheet-2', 'bore');
  assert.equal(context.asset.id, 'reference-pdf'); assert.equal(context.sheet.pdfPage, 2); assert.equal(context.region.partId, 'bearing-body');
  assert.equal(resolveSheetContext(pkg, 'missing', 'bore'), null); assert.equal(resolveSheetContext(pkg, 'sheet-1', 'missing'), null);
  assert.equal(releaseDiagnostic(pkg, { partIds: ['bearing-body'], modelRevision: 'geometry-001' }).valid, true);
});

test('source identities, formats and derived-source chains cannot be guessed', () => {
  for (const mutate of [
    pkg => { pkg.assets[0].sha256 = 'unknown'; },
    pkg => { pkg.assets[0].file = '../secret.pdf'; },
    pkg => { pkg.assets[0].url = 'javascript:alert(1)'; },
    pkg => { pkg.sourceURL = 'blob:https://example.test/source'; },
    pkg => { pkg.sourceURL = './source.pdf'; },
    pkg => { pkg.sourceURL = 'https://username:password@example.test/source.pdf'; },
    pkg => { pkg.assets[2].sourceAssetId = 'missing'; },
    pkg => { pkg.assets[0].sourceAssetId = 'reference-pdf'; },
    pkg => { pkg.sheets[0].format = 'svg'; },
    pkg => { pkg.sheets[0].pdfPage = 0; },
    pkg => { pkg.pairing.evidence = ''; },
  ]) {
    const pkg = sourcePackage(); mutate(pkg);
    assert.throws(() => normalizeDrawingPackage(pkg), DrawingPackageError);
  }
});

test('invalid semantic regions, page units and camera data are rejected', () => {
  for (const mutate of [
    sheet => { sheet.regions[0].bounds = [790, 0, 20, 20]; },
    sheet => { sheet.regions[0].bounds = [0, 0, 0, 20]; },
    sheet => { sheet.regions[0].bounds = [0, NaN, 10, 20]; },
    sheet => { sheet.regions.push(structuredClone(sheet.regions[0])); },
    sheet => { sheet.regions[0].partId = null; },
    sheet => { sheet.regions[0].camera.direction = [0, 0, 0]; },
    sheet => { sheet.regions[0].camera = {}; },
    sheet => { sheet.regions[0].camera.halfSize = [1, -2, 1]; },
    sheet => { sheet.coordinateFrame = 'screen'; },
    sheet => { sheet.rotation = 45; },
    sheet => { sheet.viewBox[0] = 12; },
  ]) {
    const pkg = sourcePackage(); mutate(pkg.sheets[0]);
    assert.throws(() => normalizeDrawingPackage(pkg), DrawingPackageError);
  }
});

test('unconfirmed drafts can be saved but wrong part IDs or model versions cannot pass release', () => {
  const pkg = sourcePackage(); pkg.sheets[0].regions[0].mappingStatus = 'missing'; pkg.sheets[0].regions[0].partId = null;
  assert.doesNotThrow(() => normalizeDrawingPackage(pkg));
  const diagnostic = releaseDiagnostic(pkg, { partIds: ['bearing-body'], modelRevision: 'geometry-002' });
  assert.equal(diagnostic.valid, false);
  assert.ok(diagnostic.issues.some(item => item.code === 'mapping-unconfirmed'));
  assert.ok(diagnostic.issues.some(item => item.code === 'unknown-part'));
  assert.ok(diagnostic.issues.some(item => item.code === 'model-version'));
  assert.ok(diagnostic.issues.some(item => item.code === 'reference-only' && item.severity === 'warning'));
  assert.equal(releaseDiagnostic(sourcePackage()).valid, false, 'A real model registry is mandatory at publication.');
});

test('legacy metadata preserves saved PDF asset and region IDs with a verified original file identity', async () => {
  const input = JSON.parse(await readFile(new URL('../content/drawings/linkrods/drawing.json', import.meta.url)));
  const pkg = normalizeDrawingPackage(input, { modelRevision: 'linkrods-exact-model-revision' });
  assert.equal(pkg.assets[0].id, `${input.id}-pdf`);
  assert.equal(pkg.assets[0].sha256, input.assetRevision);
  assert.equal(pkg.sheets[0].regions[1].id, input.sheets[0].regions[1].id);
  assert.equal(pkg.sheets[0].assetId, pkg.assets[0].id);
  for (const asset of pkg.assets) {
    const actual = createHash('sha256').update(await readFile(new URL(`../content/drawings/linkrods/${asset.file}`, import.meta.url))).digest('hex');
    assert.equal(actual, asset.sha256, 'Declared source identity must match unchanged source bytes.');
  }
  assert.equal(pkg.pairing.status, 'unverified', 'Legacy metadata alone cannot upgrade source pairing proof.');
});

test('clockwise rotation transforms canonical overlay bounds and keeps original mappings unchanged', () => {
  const sheet = sourcePackage().sheets[0], before = structuredClone(sheet);
  assert.deepEqual(rotatePoint([100, 150], sheet.viewBox, 90), [450, 100]);
  assert.deepEqual(rotateBounds([100, 150, 60, 40], sheet.viewBox, 90), [410, 100, 40, 60]);
  assert.deepEqual(rotateBounds([100, 150, 60, 40], sheet.viewBox, 180), [640, 410, 60, 40]);
  assert.deepEqual(rotateBounds([100, 150, 60, 40], sheet.viewBox, 270), [150, 640, 40, 60]);
  assert.deepEqual(rotateSheet(sheet, 90).viewBox, [0, 0, 600, 800]);
  assert.equal(rotateSheet(sheet, 90).regions[0].partId, 'bearing-body');
  assert.deepEqual(sheet, before); assert.equal(normalizeRotation(-90), 270);
  assert.throws(() => normalizeRotation(13));
});

test('PDF pixel budgets remain bounded at extreme zoom and high device pixel ratios', () => {
  for (const [width, height] of [[800, 600], [5000, 300], [100, 20000]]) {
    const output = pdfRasterSize({ width, height, scale: 100, pixelRatio: 4 });
    assert.ok(output.width * output.height <= 8_000_000);
    assert.ok(output.width <= 4096 && output.height <= 4096);
  }
  assert.deepEqual(pdfRasterSize({ width: 800, height: 600, scale: 1, pixelRatio: 1 }), { width: 800, height: 600, scale: 1 });
  assert.throws(() => pdfRasterSize({ width: -1, height: 600 }));
});


test('authoring display rectangles round-trip to canonical page units at every PDF rotation', () => {
  for (const paper of [[0, 0, 842, 595], [12, 15, 800, 600]]) for (const rotation of [0, 90, 180, 270]) {
    const original = [paper[0] + 25, paper[1] + 30, 120, 55];
    assert.deepEqual(unrotateBounds(rotateBounds(original, paper, rotation), paper, rotation), original);
    const point = [original[0], original[1]];
    assert.deepEqual(unrotatePoint(rotatePoint(point, paper, rotation), paper, rotation), point);
  }
});

test('unplaced source-revision details can persist honestly but never pass release', () => {
  const pkg = sourcePackage(); pkg.sheets[0].regions[0].bounds = null; pkg.sheets[0].regions[0].mappingStatus = 'missing';
  assert.equal(normalizeDrawingPackage(pkg).sheets[0].regions[0].bounds, null);
  assert.equal(rotateSheet(pkg.sheets[0], 90).regions[0].bounds, null);
  assert.equal(releaseDiagnostic(pkg, { partIds: ['bearing-body'], modelRevision: 'geometry-001' }).valid, false);
  pkg.sheets[0].regions[0].mappingStatus = 'confirmed'; assert.throws(() => normalizeDrawingPackage(pkg), DrawingPackageError);
  const ready = sourcePackage(); ready.unplacedMappings = [{ id: 'old-sheet:bore' }];
  assert.ok(releaseDiagnostic(ready, { partIds: ['bearing-body'], modelRevision: 'geometry-001' }).issues.some(item => item.code === 'unplaced-mappings'));
});
