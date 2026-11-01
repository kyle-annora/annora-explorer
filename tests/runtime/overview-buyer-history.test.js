import test from 'node:test';
import assert from 'node:assert/strict';
import { createDrawingContext } from '../../src/drawing-preview/context.js';
import { createOverviewPresentation, reviseOverviewPresentation } from '../../src/drawings/overview-presentation.js';
import { resolveReferencePreview } from '../../src/drawings/reference-preview.js';
import { createDrawingProjectRepository, DRAWING_PROJECT_STORAGE_KEY } from '../../src/product-room/drawing-inquiry.js';
import { createInquiryDraft, projectContextKey, reviewInquiry, compareQuotes } from '../../src/product-room/project-domain.js';
import { reviewQuote, reviewReply } from '../../src/product-room/seller-domain.js';
import { parseProjectStore } from '../../src/product-room/project-repository.js';
import { sampleInquiryValues } from '../../src/product-room/project-fixtures.js';
import { validatePublishedDrawingContext } from '../../src/product-room/drawing-revision.js';

const copy = structuredClone;
const model = { id: 'overview-fixture', title: 'Overview fixture', revision: 'model-A', parts: [{ id: 'body', title: 'Support body' }] };
const pkg = {
  schemaVersion: 2, id: 'overview-drawing', modelId: model.id, modelRevision: model.revision,
  title: 'Support drawing', revision: 'A', mappingRevision: 'map-A', units: 'mm',
  sourceURL: 'https://example.org/overview-fixture/A', status: 'unreviewed-reference',
  pairing: { status: 'human-confirmed', evidence: 'A reviewer checked the fixture model and its original drawing.' },
  assets: [{ id: 'pdf-A', kind: 'pdf', file: 'source-A.pdf', sha256: 'a'.repeat(64) }],
  sheets: [{ id: 'sheet-1', title: 'Support views', assetId: 'pdf-A', format: 'pdf', pdfPage: 1,
    viewBox: [0, 0, 400, 300], coordinateFrame: 'page-top-left', rotation: 0,
    regions: [{ id: 'bore', label: 'Shaft bore', partId: 'body', bounds: [30, 40, 50, 50], mappingStatus: 'confirmed' }] }],
};
const views = ['front', 'bore'].map(id => ({ id, viewRevision: `asset-${id}-1`, sheetId: 'sheet-1', title: `${id} view`,
  profile: { regions: [{ id: 'bore' }] } }));
const first = createOverviewPresentation(pkg, views);
const changed = copy(first);
changed.sheets[0].views.reverse();
changed.sheets[0].views[0].title = 'Start with the shaft bore';
changed.sheets[0].defaultViewId = 'bore';
const second = reviseOverviewPresentation(changed);
const contextFor = (presentationSnapshot, drawing = pkg) => createDrawingContext({ drawing, sheetId: 'sheet-1', regionId: 'bore', modelRevision: model.revision, model, presentationSnapshot });
function fixture() {
  const data = new Map(); let serial = 0;
  const options = { storage: { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) },
    locks: null, now: () => '2026-11-01T12:00:00Z', makeId: prefix => `${prefix}-${++serial}` };
  return { data, options, repository: createDrawingProjectRepository(options) };
}
async function submit(repository, context) {
  let draft = await repository.getDraft(context); draft.values = sampleInquiryValues(context);
  draft = await repository.saveDraft(draft);
  return repository.submitInquiry(reviewInquiry(draft));
}
async function issue(repository, project) {
  let draft = await repository.getQuoteDraft(project.id); draft.values.lineItems[0].unitPrice = '125';
  draft = await repository.saveQuoteDraft(draft);
  return repository.issueQuote(reviewQuote(await repository.getSellerProject(project.id), draft));
}

test('inquiries pin a normalized overview snapshot without changing their engineering or draft identity', () => {
  const input = copy(first), one = contextFor(input), two = contextFor(second);
  assert.equal(one.drawing.presentationRevision, first.revision);
  assert.deepEqual(one.drawing.presentationSnapshot, first);
  assert.equal(projectContextKey(one), projectContextKey(two));
  assert.equal(one.roomReleaseId, two.roomReleaseId);
  input.sheets[0].views[0].title = 'Unsaved mutation';
  assert.equal(one.drawing.presentationSnapshot.sheets[0].views[0].title, 'front view');
  const edited = copy(one); edited.drawing.presentationSnapshot.sheets[0].views.reverse();
  assert.throws(() => createInquiryDraft(edited), { code: 'VALIDATION' });
  const mismatched = copy(one); mismatched.drawing.presentationRevision = second.revision;
  assert.throws(() => createInquiryDraft(mismatched), { code: 'VALIDATION' });
  const missing = copy(one); delete missing.drawing.presentationSnapshot;
  assert.throws(() => createInquiryDraft(missing), { code: 'VALIDATION' });
  const sourceOnly = contextFor(null);
  assert.equal(sourceOnly.drawing.presentationSnapshot, null);
  assert.equal(sourceOnly.drawing.presentationRevision, undefined);
});

test('v2 publication does not replace a v1 draft, issued quotation or conversation; a new inquiry captures v2', async () => {
  const { repository, data, options } = fixture(), one = contextFor(first), two = contextFor(second);
  let draft = await repository.getDraft(one); draft.values = sampleInquiryValues(one);
  draft = await repository.saveDraft(draft);
  assert.deepEqual(await repository.getDraft(two), draft, 'a saved v1 draft resumes its own overview');
  let project = await repository.submitInquiry(reviewInquiry(draft));
  project = await issue(repository, project);
  project = await repository.sendReply(reviewReply(project, { kind: 'reply', body: 'Review the shaft bore shown in the saved overview.' }));
  const old = copy(await repository.getProject(project.id));
  assert.deepEqual(old.context.drawing.presentationSnapshot, first);
  assert.deepEqual(old.quotes[0].context.drawing.presentationSnapshot, first);
  assert.deepEqual(old.messages[0].context.drawing.presentationSnapshot, first);
  let newer = await submit(repository, two); newer = await issue(repository, newer);
  assert.deepEqual(newer.context.drawing.presentationSnapshot, second);
  assert.deepEqual(newer.quotes[0].context.drawing.presentationSnapshot, second);
  assert.deepEqual(await createDrawingProjectRepository(options).getProject(old.id), old);
  assert.equal(parseProjectStore(data.get(DRAWING_PROJECT_STORAGE_KEY)).projects.length, 2);
  assert.equal(compareQuotes(old.quotes[0], newer.quotes[0]).find(row => row.key === 'drawingOverview').changed, true);
  assert.equal(compareQuotes(old.quotes[0], newer.quotes[0]).find(row => row.key === 'drawingSource').changed, false);
});

test('historical previews use their snapshot or preserved legacy baseline, never the current seller overview', async () => {
  const entry = { id: model.id, model, package: pkg, overviewPresentation: second, legacyOverviewPresentation: first };
  const options = { catalog: [entry], resolveEntry: async (entry, snapshot) => ({ ...entry, package: copy(snapshot) }),
    listReleases: async () => [{ productId: model.id, packageSnapshot: pkg, presentationSnapshot: second }] };
  const recorded = await resolveReferencePreview(contextFor(first), options);
  assert.deepEqual(recorded.presentationSnapshot, first); assert.equal(recorded.presentationState, 'recorded');
  const legacyContext = contextFor(undefined), legacy = await resolveReferencePreview(legacyContext, options);
  assert.deepEqual(legacy.presentationSnapshot, first); assert.equal(legacy.presentationState, 'legacy');
  assert.equal(legacyContext.drawing.presentationSnapshot, undefined);
  const noBaseline = await resolveReferencePreview(legacyContext, { ...options, catalog: [{ ...entry, legacyOverviewPresentation: null }] });
  assert.equal(noBaseline.presentationSnapshot, null);
  const sourceOnly = await resolveReferencePreview(contextFor(null), options);
  assert.equal(sourceOnly.presentationSnapshot, null); assert.equal(sourceOnly.presentationState, 'source-only');
});

test('an incompatible or missing presentation falls back to the exact source rather than borrowing the latest layout', async () => {
  const entry = { id: model.id, model, package: pkg, overviewPresentation: second, legacyOverviewPresentation: first };
  const options = { catalog: [entry], resolveEntry: async (entry, snapshot) => ({ ...entry, package: copy(snapshot) }) };
  const recorded = contextFor(first);
  recorded.drawing.presentationSnapshot.sourceKey = 'source-unavailable';
  recorded.drawing.presentationSnapshot = reviseOverviewPresentation(recorded.drawing.presentationSnapshot);
  recorded.drawing.presentationRevision = recorded.drawing.presentationSnapshot.revision;
  const result = await resolveReferencePreview(recorded, options);
  assert.equal(result.presentationSnapshot, null); assert.equal(result.presentationState, 'unavailable');
  assert.equal(result.package.assets[0].sha256, pkg.assets[0].sha256);
  assert.equal(recorded.drawing.presentationRevision, recorded.drawing.presentationSnapshot.revision);
});

test('source changes and changed canonical geometry cannot accept an old overview through context creation', () => {
  const changedSource = copy(pkg); changedSource.revision = 'B'; changedSource.assets[0].sha256 = 'b'.repeat(64);
  assert.throws(() => contextFor(first, changedSource), /overview does not match/);
  const changedAssociation = copy(pkg); changedAssociation.sheets[0].regions[0].bounds[0] += 5;
  assert.throws(() => contextFor(first, changedAssociation), /overview does not match/);
  assert.equal(contextFor(null, changedSource).drawing.presentationSnapshot, null);
});

test('project drawing adoption captures the selected release overview and rejects a different layout snapshot', () => {
  const release = { kind: 'annora-drawing-release', id: 'release-1', version: 1, source: 'demo', productId: model.id,
    modelId: model.id, modelRevision: model.revision, sourceRevision: pkg.revision, mappingRevision: pkg.mappingRevision,
    packageSnapshot: pkg, partIds: ['body'], presentationSnapshot: first, presentationRevision: first.revision };
  assert.deepEqual(validatePublishedDrawingContext(contextFor(first), release), contextFor(first));
  assert.throws(() => validatePublishedDrawingContext(contextFor(second), release), { code: 'DRAWING_REFERENCE_INVALID' });
  const sourceOnly = { ...release, presentationSnapshot: null }; delete sourceOnly.presentationRevision;
  assert.equal(validatePublishedDrawingContext(contextFor(null), sourceOnly).drawing.presentationSnapshot, null);
  assert.throws(() => validatePublishedDrawingContext(contextFor(first), sourceOnly), { code: 'DRAWING_REFERENCE_INVALID' });
});
