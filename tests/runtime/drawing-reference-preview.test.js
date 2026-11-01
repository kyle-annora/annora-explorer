import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveReferencePreview } from '../../src/drawings/reference-preview.js';

const pkg = { id: 'part-drawing', modelId: 'part', modelRevision: 'model-A', revision: 'source-A', mappingRevision: 'map-A',
  assets: [{ id: 'pdf-A', kind: 'pdf', sha256: 'hash-A' }],
  sheets: [{ id: 'sheet-1', assetId: 'pdf-A', pdfPage: 1, rotation: 0, viewBox: [0, 0, 600, 400],
    regions: [{ id: 'bore', label: 'Bore', partId: 'body', bounds: [10, 20, 30, 40], mappingStatus: 'confirmed' }] }] };
const context = { modelId: 'part', modelRevision: 'model-A', part: { id: 'body' }, drawing: { id: 'part-drawing', revision: 'source-A', mappingRevision: 'map-A',
  assetId: 'pdf-A', assetRevision: 'hash-A', sheetId: 'sheet-1', regionId: 'bore', partId: 'body' } };
const entry = { id: 'part', model: { id: 'part', revision: 'model-A' }, package: pkg };
const fixture = (options = {}) => ({ catalog: [entry], resolveEntry: async (candidate, snapshot) => ({ ...candidate, package: structuredClone(snapshot), dispose() {} }), ...options });
const release = snapshot => ({ productId: 'part', sourceRevision: snapshot.revision, mappingRevision: snapshot.mappingRevision, packageSnapshot: snapshot });

test('recorded preview resolves the exact source and mapping without modifying the commercial context', async () => {
  const original = JSON.stringify(context), result = await resolveReferencePreview(context, fixture());
  assert.equal(result.package.mappingRevision, 'map-A'); assert.equal(result.previewSheetId, 'sheet-1'); assert.equal(result.previewRegionId, 'bore');
  assert.equal(JSON.stringify(context), original);
});

test('a newer catalog does not replace an old record; its archived exact release is used', async () => {
  const newer = structuredClone(pkg); newer.revision = 'source-B'; newer.mappingRevision = 'map-B'; newer.assets[0].sha256 = 'hash-B';
  const options = fixture({ catalog: [{ ...entry, package: newer }], staticReleases: [release(pkg)] });
  const result = await resolveReferencePreview(context, options); assert.equal(result.package.revision, 'source-A');
  await assert.rejects(resolveReferencePreview(context, { ...options, staticReleases: [] }), /newer file will not replace/);
});

test('locally reviewed revisions resolve only their exact model, asset, sheet and part bindings', async () => {
  const next = structuredClone(pkg); next.mappingRevision = 'map-B'; next.sheets[0].regions[0].bounds = [20, 30, 40, 50];
  const pinned = { ...context, drawing: { ...context.drawing, mappingRevision: 'map-B' } };
  const result = await resolveReferencePreview(pinned, fixture({ listReleases: async () => [release(next)] }));
  assert.deepEqual(result.package.sheets[0].regions[0].bounds, [20, 30, 40, 50]);
  for (const change of [{ assetRevision: 'different' }, { sheetId: 'sheet-2' }, { partId: 'wrong-part' }])
    await assert.rejects(resolveReferencePreview({ ...context, drawing: { ...context.drawing, ...change } }, fixture()), /unavailable/);
  await assert.rejects(resolveReferencePreview({ ...context, modelRevision: 'model-B' }, fixture()), /model version is unavailable/);
});

test('legacy references require unambiguous geometry rather than adopting the latest mapping', async () => {
  const legacy = structuredClone(context); delete legacy.drawing.mappingRevision;
  const sameGeometry = structuredClone(pkg); sameGeometry.mappingRevision = 'map-B';
  const okay = await resolveReferencePreview(legacy, fixture({ staticReleases: [release(sameGeometry)] })); assert.equal(okay.package.mappingRevision, 'map-A');
  const changed = structuredClone(sameGeometry); changed.sheets[0].regions[0].bounds[0] += 10;
  await assert.rejects(resolveReferencePreview(legacy, fixture({ staticReleases: [release(changed)] })), /does not identify an association version/);
  assert.equal(legacy.drawing.mappingRevision, undefined);
});

test('unconfirmed bindings and missing source bytes fail explicitly', async () => {
  const unconfirmed = structuredClone(pkg); unconfirmed.sheets[0].regions[0].mappingStatus = 'needs-review';
  await assert.rejects(resolveReferencePreview(context, fixture({ catalog: [{ ...entry, package: unconfirmed }] })), /association version is unavailable/);
  await assert.rejects(resolveReferencePreview(context, fixture({ resolveEntry: async () => { throw new Error('Original PDF missing'); } })), /Original PDF missing/);
});
