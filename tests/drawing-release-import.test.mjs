import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, mkdir, readFile, readdir, rm, writeFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyDrawingRelease } from '../scripts/apply-drawing-release.mjs';
import { loadProject } from '../scripts/lib/project-config.mjs';
import { createDrawingRepository } from '../src/studio/drawing-repository.js';
import { updateDrawingMapping } from '../src/studio/drawing-domain.js';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
async function fixture() {
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
  const data = new Map(); let id = 0;
  const repo = createDrawingRepository({ packages: [entry], locks: null, storage: { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }, makeId: prefix => `${prefix}-${++id}`, now: () => '2026-11-01T12:00:00Z' });
  let draft = await repo.getDraft(); const sheet = pkg.sheets[0], region = sheet.regions[0];
  draft = updateDrawingMapping(draft, entry, sheet.id, region.id, { label: 'Reviewed source overview' }, { confirm: true });
  draft = await repo.saveDraft(draft);
  const release = await repo.publishReviewed(await repo.reviewDraft(draft), { confirmed: true });
  const packet = await repo.exportRelease(release.id);
  return { root, entry, repo, draft, packet, packageFile, original: await readFile(packageFile, 'utf8') };
}
async function withFixture(run) { const value = await fixture(); try { await run(value); } finally { await rm(value.root, { recursive: true, force: true }); } }

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
