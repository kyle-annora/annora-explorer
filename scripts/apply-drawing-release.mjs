#!/usr/bin/env node
import { readFile, writeFile, rename, rm, readdir, realpath, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadProject, containedFile } from './lib/project-config.mjs';
import { normalizeDrawingPackage, releaseDiagnostic } from '../src/drawings/package.js';
import { createDrawingDraft, assertDrawingDraft } from '../src/studio/drawing-domain.js';
import { sameStudioValue, studioFingerprint } from '../src/studio/value.js';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const safeId = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/.test(value) && !value.includes('..');
const portablePackage = input => { const pkg = normalizeDrawingPackage(input); pkg.assets = pkg.assets.map(({ url, ...asset }) => asset); return pkg; };
const readJSON = async file => JSON.parse(await readFile(file, 'utf8'));
const requireValue = (condition, message) => { if (!condition) throw new Error(message); };
async function exists(file) { try { return await lstat(file); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } }
const inside = (base, file) => { const rel = relative(base, file); return rel && !rel.startsWith(`..${sep}`) && rel !== '..' && !rel.startsWith(sep); };

/** Applies only prepared association metadata. Source drawings, STEP and model files are never written. */
export async function applyDrawingRelease(input, { root = projectRoot, replace = false } = {}) {
  root = await realpath(root);
  const record = structuredClone(input);
  requireValue(record?.schemaVersion === 1 && record.kind === 'annora-drawing-release' && record.source === 'demo', 'Export a reviewed and confirmed local drawing release. Drafts, previews and arbitrary packages cannot be applied.');
  requireValue(safeId(record.id) && safeId(record.productId) && safeId(record.modelId), 'Release, product and model IDs must be safe identifiers.');
  requireValue(record.productId === record.modelId, 'The release product must identify its configured model.');
  requireValue(Number.isSafeInteger(record.version) && record.version > 0 && Number.isSafeInteger(record.draftRevision) && record.draftRevision > 0
    && typeof record.draftId === 'string' && record.draftId.length > 0 && Number.isFinite(Date.parse(record.createdAt)), 'The export is missing its reviewed draft version or publication record.');
  const { models } = await loadProject(root), model = models.find(item => item.manifest.id === record.modelId);
  requireValue(model, 'This model is not configured in project.config.json. Import and verify its prepared package first.');
  requireValue(record.modelRevision === model.revision, 'This release targets a different model revision. Recheck it against the configured source model.');
  const snapshot = portablePackage(record.packageSnapshot), partIds = model.metadata.parts.map(part => part.id);
  requireValue(snapshot.modelId === record.modelId && snapshot.modelRevision === record.modelRevision && snapshot.revision === record.sourceRevision
    && snapshot.mappingRevision === record.mappingRevision, 'Release and package version identities do not match.');
  requireValue(Array.isArray(record.partIds) && sameStudioValue([...record.partIds].sort(), [...partIds].sort()), 'The reviewed part registry does not match the exact configured model.');
  const diagnostic = releaseDiagnostic(snapshot, { partIds, modelRevision: model.revision });
  requireValue(diagnostic.valid, diagnostic.issues.filter(item => item.severity === 'error').map(item => `${item.path}: ${item.message}`).join('\n'));
  const drawingsRoot = await realpath(resolve(root, 'content/drawings'));
  requireValue(inside(root, drawingsRoot), 'The drawing package directory must stay inside this project.');
  const matches = [];
  for (const directory of await readdir(drawingsRoot, { withFileTypes: true })) {
    if (!directory.isDirectory()) continue;
    const packageRoot = await realpath(resolve(drawingsRoot, directory.name));
    if (!inside(drawingsRoot, packageRoot)) throw new Error('Drawing package paths must stay inside content/drawings.');
    const file = resolve(packageRoot, 'package.json'), stat = await exists(file);
    if (!stat) continue;
    requireValue(stat.isFile() && !stat.isSymbolicLink(), 'Drawing package manifests must be regular files.');
    const bytes = await readFile(file, 'utf8'), pkg = normalizeDrawingPackage(JSON.parse(bytes));
    if (pkg.id === snapshot.id && pkg.modelId === record.modelId) matches.push({ file, bytes, pkg, packageRoot });
  }
  requireValue(matches.length === 1, 'Exactly one prepared drawing package must match this release model and package ID.');
  const target = matches[0], entry = { id: record.productId, title: model.manifest.title, package: target.pkg,
    model: { id: model.manifest.id, revision: model.revision, parts: model.metadata.parts } };
  // Reuse the editor's protected source/annotation contract, but retain the reviewed mapping identity.
  const draft = createDrawingDraft(entry, 'IMPORT-VALIDATION'); draft.packageSnapshot = snapshot;
  assertDrawingDraft(draft, entry);
  for (const asset of snapshot.assets) {
    const file = await containedFile(root, target.packageRoot, asset.file, `Drawing source ${asset.id}`);
    requireValue(inside(target.packageRoot, file), 'Drawing source files must stay inside their prepared package.');
    const hash = createHash('sha256').update(await readFile(file)).digest('hex');
    requireValue(hash === asset.sha256, `The actual source file hash differs for ${asset.id}. Do not replace source files while applying mappings.`);
  }
  const release = { ...record, source: 'bundled', packageSnapshot: snapshot };
  delete release.reviewToken;
  if (release.previousPackageSnapshot) release.previousPackageSnapshot = portablePackage(release.previousPackageSnapshot);
  const releaseFile = resolve(target.packageRoot, `release-${release.id}.json`), stat = await exists(releaseFile);
  requireValue(!stat || stat.isFile() && !stat.isSymbolicLink(), 'Release snapshots must be regular files inside the package.');
  if (stat) requireValue(sameStudioValue(await readJSON(releaseFile), release), 'This release ID already names different content. Publish a new version instead of rewriting a snapshot.');
  const defaultChanged = replace && !sameStudioValue(portablePackage(target.pkg), snapshot);
  // Archive the previous deployed association snapshot before replacing its default.
  // Its source publication date is unknown; createdAt records this archival event.
  let previousReleaseFile = null, previousRelease = null;
  if (defaultChanged) {
    const prior = portablePackage(target.pkg), files = await readdir(target.packageRoot);
    for (const name of files.filter(name => /^release-[A-Za-z0-9._-]+\.json$/.test(name))) {
      const file = resolve(target.packageRoot, name), item = await lstat(file);
      requireValue(item.isFile() && !item.isSymbolicLink(), 'Release snapshots must be regular files inside the package.');
      const existing = await readJSON(file);
      if (existing.kind === 'annora-drawing-release' && sameStudioValue(existing.packageSnapshot, prior)) { previousReleaseFile = file; break; }
    }
    if (!previousReleaseFile) {
      const id = `bundled-${studioFingerprint(prior)}`;
      previousReleaseFile = resolve(target.packageRoot, `release-${id}.json`);
      previousRelease = { schemaVersion: 1, kind: 'annora-drawing-release', id, source: 'bundled', version: 0,
        productId: record.productId, modelId: record.modelId, modelRevision: prior.modelRevision,
        sourceRevision: prior.revision, mappingRevision: prior.mappingRevision, packageSnapshot: prior,
        partIds, draftId: 'bundled-source', draftRevision: 0, createdAt: new Date().toISOString(),
        provenance: 'Previous bundled associations archived before a default change. Original source publication date is unknown.' };
    }
  }
  // Everything is validated before any write. The release file is immutable and can be staged independently.
  if (previousRelease) await writeFile(previousReleaseFile, JSON.stringify(previousRelease, null, 2) + '\n', { flag: 'wx' });
  let changed = false;
  if (!stat) {
    try { await writeFile(releaseFile, JSON.stringify(release, null, 2) + '\n', { flag: 'wx' }); changed = true; }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      requireValue(sameStudioValue(await readJSON(releaseFile), release), 'Another writer created different content for this release ID.');
    }
  }
  if (defaultChanged) {
    requireValue(await readFile(target.file, 'utf8') === target.bytes, 'The default drawing package changed during validation. The immutable release is staged; inspect the latest default before retrying.');
    const temporary = `${target.file}.${process.pid}.tmp`;
    try { await writeFile(temporary, JSON.stringify(snapshot, null, 2) + '\n', { flag: 'wx' }); await rename(temporary, target.file); }
    finally { await rm(temporary, { force: true }); }
  }
  return { releaseId: release.id, releaseFile, previousReleaseFile, packageFile: target.file, changed, defaultChanged, warnings: diagnostic.issues.filter(item => item.severity === 'warning') };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--help') {
    console.log('Usage: npm run apply:drawing-release -- --file <reviewed-release.json> [--replace]\nStores an immutable mapping release beside its prepared drawing package.\n--replace also makes its associations the default package. Source/model files are never changed.\nRun npm run verify, review the diff, then commit and push to deploy.'); return;
  }
  const fileAt = args.indexOf('--file');
  requireValue(fileAt >= 0 && args.filter(arg => arg === '--file').length === 1 && args[fileAt + 1] && !args[fileAt + 1].startsWith('--')
    && args.filter((_, index) => index !== fileAt && index !== fileAt + 1).every(arg => arg === '--replace')
    && args.filter(arg => arg === '--replace').length <= 1, 'Use --file <reviewed-release.json> and optional --replace.');
  const result = await applyDrawingRelease(await readJSON(resolve(args[fileAt + 1])), { replace: args.includes('--replace') });
  console.log(`${result.changed ? 'Stored' : 'Already stored'} immutable drawing release ${result.releaseId}.${result.defaultChanged ? ' Default associations updated.' : ' Default associations unchanged.'}\nNo deployment has run. Next: npm run verify, review the content diff, then commit and push.`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => { console.error(error.message); process.exitCode = 1; });
