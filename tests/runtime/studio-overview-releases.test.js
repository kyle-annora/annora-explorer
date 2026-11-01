import test from 'node:test';
import assert from 'node:assert/strict';
import { createDrawingRepository, DRAWING_STUDIO_STORAGE_KEY, parseDrawingStudioStore } from '../../src/studio/drawing-repository.js';
import { createDrawingDraft, createSourceDrawingDraft, updateDrawingMapping } from '../../src/studio/drawing-domain.js';
import { createOverviewPresentation, reviseOverviewPresentation, overviewAssociationKey } from '../../src/drawings/overview-presentation.js';

function entry({ overview = true } = {}) {
  const pkg = {
    schemaVersion: 2, id: 'support-drawing', modelId: 'support', modelRevision: 'model-A', title: 'Support drawing', revision: 'drawing-A', mappingRevision: 'mapping-A',
    sourceURL: 'https://example.com/source-A', units: 'mm', status: 'unreviewed-reference',
    pairing: { status: 'source-derived', evidence: 'The STEP and PDF share a reviewed source revision.' },
    assets: [{ id: 'pdf-A', kind: 'pdf', file: 'source.pdf', sha256: 'a'.repeat(64) }],
    sheets: [{ id: 'sheet-1', title: 'Sheet 1', assetId: 'pdf-A', format: 'pdf', pdfPage: 1, viewBox: [0, 0, 400, 300], coordinateFrame: 'page-top-left', rotation: 0,
      regions: [{ id: 'bore', label: 'Shaft bore', partId: 'body', bounds: [20, 30, 40, 40], mappingStatus: 'confirmed' }] }],
  };
  const result = { id: 'support', title: 'Support', package: pkg, model: { id: 'support', revision: 'model-A', parts: [{ id: 'body', title: 'Support body' }] } };
  if (overview) {
    result.overviewViews = ['front', 'bore-detail'].map(id => ({ id, title: id, viewRevision: `view-${id}-A`, sheetId: 'sheet-1', regionIds: ['bore'], defaultRegionId: 'bore',
      artwork: '<svg/>', profile: { regions: [{ id: 'bore', bounds: [10, 10, 20, 20] }] } }));
    result.overviewPresentation = createOverviewPresentation(pkg, result.overviewViews);
  }
  return result;
}
function fixture(source = entry()) {
  const data = new Map(); let serial = 0;
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  const options = { packages: [source], storage, locks: null, now: () => '2026-11-01T12:00:00Z', makeId: prefix => `${prefix}-${++serial}` };
  return { source, data, options, repo: createDrawingRepository(options) };
}
const publish = async (repo, draft) => repo.publishReviewed(await repo.reviewDraft(draft), { confirmed: true });
const revise = (snapshot, change) => { const sheets = structuredClone(snapshot.sheets); change(sheets); return reviseOverviewPresentation(snapshot, { sheets }); };

test('Overview v1 and v2 preserve independent source, mapping and immutable presentation identities', async () => {
  const { repo, source } = fixture();
  let draft = await repo.saveDraft(await repo.getDraft());
  const v1 = await publish(repo, draft), preview = await repo.createPreview(draft);
  const original = JSON.stringify(v1);
  draft.presentationSnapshot = revise(draft.presentationSnapshot, sheets => {
    sheets[0].views.reverse(); sheets[0].defaultViewId = 'bore-detail'; sheets[0].views[0].title = 'Inspect the shaft bore';
  });
  draft = await repo.saveDraft(draft);
  const v2 = await publish(repo, draft);
  assert.equal(v2.version, 2);
  assert.equal(v2.sourceRevision, v1.sourceRevision);
  assert.equal(v2.mappingRevision, v1.mappingRevision);
  assert.notEqual(v2.presentationRevision, v1.presentationRevision);
  assert.deepEqual(v2.previousPresentationSnapshot, v1.presentationSnapshot);
  assert.equal(v2.presentationSnapshot.sheets[0].views[0].id, 'bore-detail');
  assert.equal(JSON.stringify(await repo.getRelease(v1.id)), original);
  assert.equal((await repo.getPreview(preview.id)).presentationRevision, v1.presentationRevision);
  assert.equal((await repo.getPublished()).presentationRevision, v2.presentationRevision);
  assert.equal((await repo.exportRelease(v2.id)).presentationRevision, v2.presentationRevision);
  assert.deepEqual(v1.presentationSnapshot, source.overviewPresentation);
  assert.throws(() => { v1.presentationSnapshot.sheets[0].views.reverse(); }, TypeError);
});

test('Changed overview review is stale; incomplete feature links save but cannot publish', async () => {
  const { repo } = fixture(); let draft = await repo.saveDraft(await repo.getDraft());
  const review = await repo.reviewDraft(draft);
  draft.presentationSnapshot = revise(draft.presentationSnapshot, sheets => { sheets[0].views[0].targets[0].confirmed = false; });
  draft = await repo.saveDraft(draft);
  await assert.rejects(repo.reviewDraft(draft), error => error.code === 'VALIDATION' && error.issues.some(issue => issue.code === 'OVERVIEW_LINK_UNCONFIRMED'));
  await assert.rejects(repo.publishReviewed(review, { confirmed: true }), error => error.code === 'STALE_REVIEW');
  draft.presentationSnapshot = revise(draft.presentationSnapshot, sheets => { sheets[0].views[0].targets[0].confirmed = true; });
  draft = await repo.saveDraft(draft);
  const v1 = await publish(repo, draft);
  const store = JSON.parse(JSON.stringify(v1)); store.presentationSnapshot.sheets[0].views[0].title = 'Unreviewed tampering';
  const data = { schemaVersion: 1, revision: 1, drafts: [], previews: [], releases: [store], published: { support: store.id } };
  assert.throws(() => parseDrawingStudioStore(JSON.stringify(data)), error => error.code === 'STORAGE_CORRUPT');
});

test('Unavailable view bytes and changed canonical associations block overview publication', async () => {
  const { repo, source } = fixture(); let draft = await repo.getDraft();
  draft.presentationSnapshot = revise(draft.presentationSnapshot, sheets => { sheets[0].views[0].viewRevision = 'unknown-view-revision'; });
  draft = await repo.saveDraft(draft);
  await assert.rejects(repo.reviewDraft(draft), error => error.code === 'VALIDATION' && error.issues.some(issue => issue.code === 'OVERVIEW_VIEW_UNAVAILABLE'));
  draft.presentationSnapshot = structuredClone(source.overviewPresentation);
  draft = updateDrawingMapping(draft, source, 'sheet-1', 'bore', { bounds: [22, 30, 40, 40] }, { confirm: true });
  draft = await repo.saveDraft(draft);
  await assert.rejects(repo.reviewDraft(draft), error => error.code === 'VALIDATION' && error.issues.some(issue => issue.code === 'OVERVIEW_ASSOCIATION_CHANGED'));
  draft.presentationSnapshot = revise(draft.presentationSnapshot, sheets => {
    for (const view of sheets[0].views) view.targets[0].associationKey = overviewAssociationKey(draft.packageSnapshot, 'sheet-1', 'bore');
  });
  draft = await repo.saveDraft(draft); await publish(repo, draft);
});

test('Existing drafts gain the prepared baseline without rewriting older stored history', async () => {
  const f = fixture(entry({ overview: false }));
  const draft = await f.repo.saveDraft(await f.repo.getDraft()), oldRelease = await publish(f.repo, draft);
  const originalStore = f.data.get(DRAWING_STUDIO_STORAGE_KEY), source = entry();
  const repo = createDrawingRepository({ ...f.options, packages: [source] });
  const opened = await repo.getDraft();
  assert.deepEqual(opened.presentationSnapshot, source.overviewPresentation);
  assert.equal(f.data.get(DRAWING_STUDIO_STORAGE_KEY), originalStore);
  assert.equal((await repo.getRelease(oldRelease.id)).presentationSnapshot, undefined);
  const saved = await repo.saveDraft(opened), newRelease = await publish(repo, saved);
  assert.equal(newRelease.presentationRevision, source.overviewPresentation.revision);
  assert.deepEqual(await repo.getRelease(oldRelease.id), oldRelease);
});

test('An imported source draft cannot borrow a prepared overview from PDF A', () => {
  const source = entry(), pkg = structuredClone(source.package);
  pkg.revision = 'drawing-B'; pkg.assets[0].sha256 = 'b'.repeat(64);
  const version = { id: 'SOURCE-B', packageSnapshot: pkg, importWarnings: [] };
  const next = createSourceDrawingDraft(source, version, 'DRAFT-B');
  assert.equal(next.presentationSnapshot, undefined);
  assert.equal(createDrawingDraft({ ...source, package: pkg }, 'DRAFT-NEW').presentationSnapshot, undefined);
});

test('Explicit source-only presentation survives saving, review, preview, publication and store reload', async () => {
  const f = fixture(); let draft = await f.repo.getDraft();
  draft.presentationSnapshot = null;
  draft = await f.repo.saveDraft(draft);
  assert.equal((await f.repo.getDraft()).presentationSnapshot, null, 'the prepared baseline must not reappear');
  const review = await f.repo.reviewDraft(draft), preview = await f.repo.createPreview(draft), release = await f.repo.publishReviewed(review, { confirmed: true });
  assert.equal(review.draft.presentationSnapshot, null);
  for (const record of [preview, release, await f.repo.exportRelease(release.id)]) {
    assert.equal(record.presentationSnapshot, null); assert.equal(record.presentationRevision, undefined);
  }
  const parsed = parseDrawingStudioStore(f.data.get(DRAWING_STUDIO_STORAGE_KEY));
  assert.equal(parsed.previews[0].presentationSnapshot, null); assert.equal(parsed.releases[0].presentationSnapshot, null);
  const reopened = createDrawingRepository(f.options);
  assert.equal((await reopened.getDraft()).presentationSnapshot, null);
  assert.equal((await reopened.getPublished()).presentationSnapshot, null);
  draft = await reopened.getDraft(); draft.presentationSnapshot = structuredClone(f.source.overviewPresentation);
  draft = await reopened.saveDraft(draft);
  const next = await publish(reopened, draft);
  assert.equal(next.previousPresentationSnapshot, null);
  assert.equal((await reopened.getRelease(release.id)).presentationSnapshot, null);
});
