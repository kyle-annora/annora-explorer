import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, mkdir, readFile, readdir, rm, writeFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyDrawingRelease } from '../scripts/apply-drawing-release.mjs';
import { loadProject } from '../scripts/lib/project-config.mjs';
import { createDrawingAssetStore } from '../src/studio/drawing-asset-store.js';
import { createDrawingRepository } from '../src/studio/drawing-repository.js';
import { updateDrawingMapping, confirmDrawingPairing } from '../src/studio/drawing-domain.js';
import { reviseOverviewPresentation } from '../src/drawings/overview-presentation.js';
import { loadOverviewCatalog } from '../scripts/lib/overview-catalog.mjs';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
async function fixture({ overview = false } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'annora-drawing-release-'));
  const config = JSON.parse(await readFile(join(projectRoot, 'project.config.json'), 'utf8'));
  config.models = [{ manifest: 'content/models/linkrods/manifest.json' }]; config.defaultModel = 'linkrods';
  await mkdir(join(root, 'content/models'), { recursive: true }); await mkdir(join(root, 'content/drawings'), { recursive: true });
  await cp(join(projectRoot, 'content/models/linkrods'), join(root, 'content/models/linkrods'), { recursive: true });
  await cp(join(projectRoot, 'content/drawings/linkrods'), join(root, 'content/drawings/linkrods'), { recursive: true });
  await writeFile(join(root, 'project.config.json'), JSON.stringify(config));
  const { models } = await loadProject(root), model = models[0], packageFile = join(root, 'content/drawings/linkrods/package.json');
  const pkg = JSON.parse(await readFile(packageFile, 'utf8'));
  const entry = { id: model.manifest.id, title: model.manifest.title, package: pkg, model: { id: model.manifest.id, revision: model.revision, parts: model.metadata.parts } };
  if (overview) Object.assign(entry, await loadOverviewCatalog(join(root, 'content/drawings/linkrods'), pkg));
  const data = new Map(), blobs = new Map(); let id = 0;
  const assetStore = createDrawingAssetStore({ backend: { async get(key) { return blobs.get(key); }, async add(record) { blobs.set(record.key, record); } } });
  const repo = createDrawingRepository({ packages: [entry], assetStore, locks: null, storage: { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }, makeId: prefix => `${prefix}-${++id}`, now: () => '2026-11-01T12:00:00Z' });
  let draft = await repo.getDraft(); const sheet = pkg.sheets[0], region = sheet.regions[0];
  draft = updateDrawingMapping(draft, entry, sheet.id, region.id, { label: 'Reviewed source overview' }, { confirm: true });
  draft = await repo.saveDraft(draft);
  const release = await repo.publishReviewed(await repo.reviewDraft(draft), { confirmed: true });
  const packet = await repo.exportRelease(release.id);
  return { root, entry, repo, draft, packet, packageFile, assetStore, original: await readFile(packageFile, 'utf8') };
}
async function withFixture(run, options) { const value = await fixture(options); try { await run(value); } finally { await rm(value.root, { recursive: true, force: true }); } }

test('Drawing release apply stages immutable snapshots and changes the default only with --replace', async () => withFixture(async f => {
  const sourceFile = join(f.root, 'content/drawings/linkrods/sheet.pdf'), modelFile = join(f.root, 'content/models/linkrods/model.glb');
  const source = await readFile(sourceFile), model = await readFile(modelFile);
  const result = await applyDrawingRelease(f.packet, { root: f.root });
  assert.equal(result.changed, true); assert.equal(result.defaultChanged, false);
  assert.equal(await readFile(f.packageFile, 'utf8'), f.original);
  const snapshot = JSON.parse(await readFile(result.releaseFile, 'utf8'));
  assert.equal(snapshot.source, 'bundled'); assert.equal(snapshot.id, f.packet.id);
  assert.equal(snapshot.packageSnapshot.assets.some(asset => 'url' in asset), false);
  assert.equal((await applyDrawingRelease(f.packet, { root: f.root })).changed, false);
  const applied = await applyDrawingRelease(f.packet, { root: f.root, replace: true });
  assert.equal(applied.defaultChanged, true);
  const baseline = JSON.parse(await readFile(applied.previousReleaseFile, 'utf8'));
  assert.equal(baseline.source, 'bundled'); assert.equal(baseline.version, 0);
  assert.deepEqual(baseline.packageSnapshot, JSON.parse(f.original));
  assert.match(baseline.provenance, /publication date is unknown/);
  assert.equal(JSON.parse(await readFile(f.packageFile, 'utf8')).mappingRevision, f.packet.mappingRevision);
  assert.deepEqual(await readFile(sourceFile), source); assert.deepEqual(await readFile(modelFile), model);
  assert.equal((await applyDrawingRelease(f.packet, { root: f.root, replace: true })).defaultChanged, false);
}));

test('A later reviewed mapping release preserves earlier static snapshots', async () => withFixture(async f => {
  const one = await applyDrawingRelease(f.packet, { root: f.root, replace: true }), original = await readFile(one.releaseFile, 'utf8');
  const sheet = f.entry.package.sheets[0], region = sheet.regions[0];
  let draft = updateDrawingMapping(f.draft, f.entry, sheet.id, region.id, { label: 'Second reviewed source detail' }, { confirm: true });
  draft = await f.repo.saveDraft(draft); const release = await f.repo.publishReviewed(await f.repo.reviewDraft(draft), { confirmed: true });
  const second = await applyDrawingRelease(await f.repo.exportRelease(release.id), { root: f.root, replace: true });
  assert.notEqual(one.releaseFile, second.releaseFile); assert.equal(await readFile(one.releaseFile, 'utf8'), original);
  const rewritten = structuredClone(f.packet); rewritten.packageSnapshot.sheets[0].regions[0].label = 'Different text under an old release ID';
  await assert.rejects(applyDrawingRelease(rewritten, { root: f.root, replace: true }), /new version/);
}));

test('Invalid review, version, part and path data cannot write a static release', async () => withFixture(async f => {
  for (const [mutate, pattern] of [
    [packet => { packet.source = 'preview'; }, /reviewed and confirmed/],
    [packet => { packet.modelRevision = 'different-model'; }, /model revision/],
    [packet => { packet.id = '../outside'; }, /safe identifiers/],
    [packet => { packet.packageSnapshot.assets[0].file = '../outside.pdf'; }, /file path relative/],
    [packet => { packet.packageSnapshot.sheets[0].regions[0].partId = 'invented-part'; }, /does not exist/],
    [packet => { packet.packageSnapshot.sheets[0].regions[0].mappingStatus = 'needs-review'; }, /Confirm the model/],
    [packet => { packet.packageSnapshot.sheets[0].regions[0].bounds[0] = 9999; }, /inside its source page/],
    [packet => { packet.packageSnapshot.pairing.status = 'unverified'; }, /Confirm evidence/],
  ]) {
    const packet = structuredClone(f.packet); mutate(packet);
    await assert.rejects(applyDrawingRelease(packet, { root: f.root, replace: true }), pattern);
  }
  assert.equal(await readFile(f.packageFile, 'utf8'), f.original);
  assert.equal((await readdir(join(f.root, 'content/drawings/linkrods'))).some(name => name.startsWith('release-')), false);
}));

test('Actual source bytes and target symlinks are checked before writing', async () => withFixture(async f => {
  const asset = f.packet.packageSnapshot.assets[0], path = join(f.root, 'content/drawings/linkrods', asset.file), original = await readFile(path);
  await writeFile(path, Buffer.concat([original, Buffer.from('\nchanged source bytes')]));
  await assert.rejects(applyDrawingRelease(f.packet, { root: f.root, replace: true }), /actual source file hash differs/);
  await writeFile(path, original);
  const outside = join(f.root, 'protected.json'); await writeFile(outside, '{"keep":true}');
  await symlink(outside, join(f.root, 'content/drawings/linkrods', `release-${f.packet.id}.json`));
  await assert.rejects(applyDrawingRelease(f.packet, { root: f.root, replace: true }), /regular files/);
  assert.equal(await readFile(outside, 'utf8'), '{"keep":true}'); assert.equal(await readFile(f.packageFile, 'utf8'), f.original);
}));


test('A reviewed PDF version installs only new hashed bytes and retains earlier source releases', async () => withFixture(async f => {
  const first = await applyDrawingRelease(f.packet, { root: f.root, replace: true });
  const prior = await readFile(first.releaseFile, 'utf8'), originalPDF = await readFile(join(f.root, 'content/drawings/linkrods/sheet.pdf'));
  const blob = new Blob([originalPDF, '\n% Local reviewed demonstration source version B\n'], { type: 'application/pdf' });
  const saved = await f.assetStore.put(blob, { fileName: 'demonstration-B.pdf' });
  const imported = { fileName: 'demonstration-B.pdf', asset: { id: `pdf-${saved.sha256}`, kind: 'pdf', file: `imports/${saved.sha256}.pdf`, sha256: saved.sha256, byteLength: saved.byteLength, localBlobKey: saved.key },
    pages: f.entry.package.sheets.map(sheet => ({ pageNumber: sheet.pdfPage, width: sheet.viewBox[2], height: sheet.viewBox[3] })) };
  let draft = await f.repo.createSourceDraft(f.entry.id, imported, { baseDraftId: f.draft.id, revisionLabel: 'Demonstration B' });
  for (const sheet of draft.packageSnapshot.sheets) for (const region of sheet.regions) draft = updateDrawingMapping(draft, f.entry, sheet.id, region.id, {}, { confirm: true });
  draft = confirmDrawingPairing(draft, f.entry, 'The demonstration PDF B has been checked against the same configured model.');
  draft = await f.repo.saveDraft(draft); const release = await f.repo.publishReviewed(await f.repo.reviewDraft(draft), { confirmed: true }), packet = await f.repo.exportRelease(release.id);
  await assert.rejects(applyDrawingRelease(packet, { root: f.root, replace: true }), /--asset-dir/);
  const assets = join(f.root, 'incoming-assets'); await mkdir(assets);
  const exported = await f.repo.exportAsset(release.id, imported.asset.id);
  await writeFile(join(assets, exported.fileName), new Uint8Array(await exported.blob.arrayBuffer()));
  const wrongPage = structuredClone(packet); wrongPage.packageSnapshot.sheets[0].viewBox[2] -= 1; wrongPage.sourcePackageSnapshot.sheets[0].viewBox[2] -= 1;
  await assert.rejects(applyDrawingRelease(wrongPage, { root: f.root, replace: true, assetDirectory: assets }), /actual PDF page dimensions/);
  const result = await applyDrawingRelease(packet, { root: f.root, replace: true, assetDirectory: assets });
  const deployed = JSON.parse(await readFile(result.releaseFile, 'utf8'));
  assert.equal(JSON.stringify(deployed).includes('localBlobKey'), false); assert.equal(JSON.stringify(deployed).includes('blob:'), false);
  assert.equal(deployed.sourceRevision, packet.sourceRevision); assert.equal(deployed.modelRevision, f.packet.modelRevision);
  assert.deepEqual(await readFile(join(f.root, 'content/drawings/linkrods/sheet.pdf')), originalPDF);
  assert.equal(await readFile(first.releaseFile, 'utf8'), prior);
  assert.deepEqual(await readFile(join(f.root, 'content/drawings/linkrods', imported.asset.file)), Buffer.from(await blob.arrayBuffer()));
  assert.equal((await applyDrawingRelease(packet, { root: f.root, replace: true })).changed, false);
  assert.equal((await readdir(join(f.root, 'content/drawings/linkrods'))).includes('overview-presentation.json'), false);
  const archived = await loadOverviewCatalog(join(f.root, 'content/drawings/linkrods'), f.packet.packageSnapshot);
  assert.ok(archived.overviewViews.length > 0, 'Source A artwork remains resolvable after package.json switches to B');
}, { overview: true }));

test('Presentation-only publication updates its own default and preserves exact v1 release and original files', async () => withFixture(async f => {
  const directory = join(f.root, 'content/drawings/linkrods'), originalPDF = await readFile(join(directory, 'sheet.pdf'));
  const first = await applyDrawingRelease(f.packet, { root: f.root, replace: true });
  assert.equal(first.presentationChanged, true);
  const firstBytes = await readFile(first.releaseFile, 'utf8'), packageBytes = await readFile(f.packageFile, 'utf8');
  const draft = await f.repo.getDraft(), sheets = structuredClone(draft.presentationSnapshot.sheets);
  sheets[0].views.reverse(); sheets[0].defaultViewId = sheets[0].views[0].id; sheets[0].views[0].title = 'Start with the small bore';
  draft.presentationSnapshot = reviseOverviewPresentation(draft.presentationSnapshot, { sheets });
  const saved = await f.repo.saveDraft(draft), release = await f.repo.publishReviewed(await f.repo.reviewDraft(saved), { confirmed: true });
  const exported = await f.repo.exportRelease(release.id), second = await applyDrawingRelease(exported, { root: f.root, replace: true });
  assert.equal(second.presentationChanged, true); assert.equal(second.defaultChanged, true);
  assert.equal(await readFile(f.packageFile, 'utf8'), packageBytes);
  assert.equal(await readFile(first.releaseFile, 'utf8'), firstBytes);
  assert.deepEqual(await readFile(join(directory, 'sheet.pdf')), originalPDF);
  assert.equal(JSON.parse(await readFile(second.presentationFile, 'utf8')).revision, release.presentationRevision);
  assert.equal((await loadOverviewCatalog(directory)).overviewPresentation.revision, release.presentationRevision);
  assert.equal((await applyDrawingRelease(exported, { root: f.root, replace: true })).defaultChanged, false);
  const changed = structuredClone(f.packet), changedSheets = structuredClone(changed.presentationSnapshot.sheets);
  changedSheets[0].views[0].title = 'Changed content under the old release identity';
  changed.presentationSnapshot = reviseOverviewPresentation(changed.presentationSnapshot, { sheets: changedSheets });
  changed.presentationRevision = changed.presentationSnapshot.revision;
  await assert.rejects(applyDrawingRelease(changed, { root: f.root }), /new version/);
}, { overview: true }));

test('Static overview installation rejects changed geometry identity and unconfirmed targets', async () => withFixture(async f => {
  for (const mutate of [view => { view.viewRevision = 'unavailable-artwork-version'; }, view => { view.targets[0].confirmed = false; }]) {
    const packet = structuredClone(f.packet), sheets = structuredClone(packet.presentationSnapshot.sheets);
    mutate(sheets[0].views[0]);
    packet.presentationSnapshot = reviseOverviewPresentation(packet.presentationSnapshot, { sheets });
    packet.presentationRevision = packet.presentationSnapshot.revision;
    await assert.rejects(applyDrawingRelease(packet, { root: f.root, replace: true }), /prepared view|Confirm this feature link/);
  }
  assert.equal((await readdir(join(f.root, 'content/drawings/linkrods'))).includes('overview-presentation.json'), false);
  assert.equal(await readFile(f.packageFile, 'utf8'), f.original);
}, { overview: true }));

test('Explicit source-only release installs a null default rather than resurrecting the legacy overview', async () => withFixture(async f => {
  const first = await applyDrawingRelease(f.packet, { root: f.root, replace: true }), original = await readFile(first.releaseFile, 'utf8');
  let draft = await f.repo.getDraft(); draft.presentationSnapshot = null;
  draft = await f.repo.saveDraft(draft);
  const release = await f.repo.publishReviewed(await f.repo.reviewDraft(draft), { confirmed: true });
  const exported = await f.repo.exportRelease(release.id), installed = await applyDrawingRelease(exported, { root: f.root, replace: true });
  assert.equal(installed.presentationChanged, true);
  assert.equal(JSON.parse(await readFile(installed.presentationFile, 'utf8')), null);
  assert.equal(JSON.parse(await readFile(installed.releaseFile, 'utf8')).presentationSnapshot, null);
  assert.equal((await loadOverviewCatalog(join(f.root, 'content/drawings/linkrods'))).overviewPresentation, null);
  assert.equal((await applyDrawingRelease(exported, { root: f.root, replace: true })).defaultChanged, false);
  assert.equal(await readFile(first.releaseFile, 'utf8'), original);
  draft = await f.repo.getDraft(); draft.presentationSnapshot = structuredClone(f.entry.overviewPresentation);
  draft = await f.repo.saveDraft(draft);
  const restored = await f.repo.publishReviewed(await f.repo.reviewDraft(draft), { confirmed: true });
  const result = await applyDrawingRelease(await f.repo.exportRelease(restored.id), { root: f.root, replace: true });
  assert.equal(JSON.parse(await readFile(result.previousReleaseFile, 'utf8')).presentationSnapshot, null);
  assert.equal(JSON.parse(await readFile(installed.releaseFile, 'utf8')).presentationSnapshot, null);
}, { overview: true }));
