#!/usr/bin/env node
import { readFile, writeFile, rename, rm, readdir, realpath, lstat, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadProject, containedFile } from './lib/project-config.mjs';
import { normalizeDrawingPackage, releaseDiagnostic } from '../src/drawings/package.js';
import { createDrawingDraft, assertDrawingDraft } from '../src/studio/drawing-domain.js';
import { sameStudioValue, studioFingerprint } from '../src/studio/value.js';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const safeId = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/.test(value) && !value.includes('..');
const portablePackage = input => { const pkg = normalizeDrawingPackage(input); pkg.assets = pkg.assets.map(({ url, localBlobKey, ...asset }) => asset); return pkg; };
const readJSON = async file => JSON.parse(await readFile(file, 'utf8'));
const requireValue = (condition, message) => { if (!condition) throw new Error(message); };
async function exists(file) { try { return await lstat(file); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } }
const inside = (base, file) => { const rel = relative(base, file); return rel && !rel.startsWith(`..${sep}`) && rel !== '..' && !rel.startsWith(sep); };

/** Applies only prepared association metadata. Source drawings, STEP and model files are never written. */
export async function applyDrawingRelease(input, { root = projectRoot, replace = false, assetDirectory = null } = {}) {
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
  const rawSnapshot = normalizeDrawingPackage(record.packageSnapshot), snapshot = portablePackage(rawSnapshot), partIds = model.metadata.parts.map(part => part.id);
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
  let validationEntry = entry;
  if (record.sourceVersionId) {
    requireValue(safeId(record.sourceVersionId) && record.sourcePackageSnapshot, 'Imported source releases need their immutable source-version baseline.');
    const baseline = normalizeDrawingPackage(record.sourcePackageSnapshot), origin = baseline.sourceOrigin;
    requireValue(origin?.kind === 'local-pdf' && origin.sourceVersionId === record.sourceVersionId && origin.sha256
      && baseline.modelId === model.manifest.id && baseline.modelRevision === model.revision, 'The imported source baseline does not match its registered model and source version.');
    const known = [target.pkg];
    for (const name of (await readdir(target.packageRoot)).filter(name => /^release-[A-Za-z0-9._-]+\.json$/.test(name))) {
      const file = resolve(target.packageRoot, name), stat = await lstat(file);
      requireValue(stat.isFile() && !stat.isSymbolicLink(), 'Release snapshots must be regular files inside the package.');
      const previous = await readJSON(file); if (previous.packageSnapshot) known.push(previous.packageSnapshot);
    }
    requireValue(known.some(pkg => pkg.revision === origin.baseSourceRevision && pkg.modelRevision === model.revision), 'Apply the preceding source release before this version so its drawing history remains available.');
    for (const asset of baseline.assets) {
      if (asset.kind === 'pdf') requireValue(asset.sha256 === origin.sha256 && asset.localBlobKey === `sha256:${asset.sha256}` && asset.file === `imports/${asset.sha256}.pdf`, 'An imported PDF must use its exact immutable source hash and prepared import path.');
      else requireValue(asset.kind === 'step' && known.some(pkg => pkg.assets.some(original => original.id === asset.id && original.sha256 === asset.sha256 && original.file === asset.file)), 'A PDF source-version change cannot replace the configured STEP geometry.');
    }
    validationEntry = { ...entry, package: baseline };
  }
  // Editable associations are checked against their registered immutable source,
  // including explicit added/removed IDs. A PDF version is a separate operation.
  const draft = createDrawingDraft(validationEntry, 'IMPORT-VALIDATION'); draft.packageSnapshot = rawSnapshot;
  if (record.regionChanges) draft.regionChanges = record.regionChanges;
  assertDrawingDraft(draft, validationEntry);
  const assetWrites = [];
  for (const asset of rawSnapshot.assets) {
    const output = resolve(target.packageRoot, asset.file), present = await exists(output);
    let file;
    if (present) {
      requireValue(present.isFile() && !present.isSymbolicLink(), 'Drawing source assets must be regular files.');
      file = await containedFile(root, target.packageRoot, asset.file, `Drawing source ${asset.id}`);
      requireValue(inside(target.packageRoot, file), 'Drawing source files must stay inside their prepared package.');
    } else {
      requireValue(record.sourceVersionId && asset.kind === 'pdf' && asset.localBlobKey === `sha256:${asset.sha256}` && asset.file === `imports/${asset.sha256}.pdf`, 'Only an explicitly reviewed imported PDF may add a new source file.');
      requireValue(assetDirectory, 'This release includes a new original PDF. Export its source file and provide --asset-dir <folder> containing <sha256>.pdf.');
      const base = await realpath(resolve(assetDirectory));
      file = await realpath(resolve(base, `${asset.sha256}.pdf`));
      requireValue(inside(base, file) && (await lstat(resolve(base, `${asset.sha256}.pdf`))).isFile(), 'Imported PDF files must be regular files inside --asset-dir.');
    }
    const bytes = await readFile(file), hash = createHash('sha256').update(bytes).digest('hex');
    requireValue(hash === asset.sha256, `The actual source file hash differs for ${asset.id}. Original source versions cannot be replaced.`);
    if (!present) {
      requireValue(bytes.length <= 32 * 1024 * 1024 && bytes.length === asset.byteLength, 'The imported PDF size differs or exceeds the 32 MB limit.');
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const task = pdfjs.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false, enableXfa: false, stopAtErrors: true });
      try {
        const pdf = await task.promise;
        requireValue(pdf.numPages >= 1 && pdf.numPages <= 50, 'Imported PDFs may contain at most 50 pages.');
        for (const sheet of snapshot.sheets.filter(sheet => sheet.assetId === asset.id)) {
          const page = await pdf.getPage(sheet.pdfPage), viewport = page.getViewport({ scale: 1, rotation: 0 });
          requireValue(Math.abs(viewport.width - sheet.viewBox[2]) <= .1 && Math.abs(viewport.height - sheet.viewBox[3]) <= .1, 'The actual PDF page dimensions differ from the reviewed source version.');
          page.cleanup();
        }
      } finally { await task.destroy(); }
      assetWrites.push({ output, bytes });
    }
  }
  const release = { ...record, source: 'bundled', packageSnapshot: snapshot };
  delete release.reviewToken;
  if (release.previousPackageSnapshot) release.previousPackageSnapshot = portablePackage(release.previousPackageSnapshot);
  if (release.sourcePackageSnapshot) release.sourcePackageSnapshot = portablePackage(release.sourcePackageSnapshot);
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
  for (const asset of assetWrites) {
    const folder = dirname(asset.output), existingFolder = await exists(folder);
    if (existingFolder) requireValue(existingFolder.isDirectory() && !existingFolder.isSymbolicLink(), 'Imported source folders must be real package directories.');
    await mkdir(folder, { recursive: true });
    try { await writeFile(asset.output, asset.bytes, { flag: 'wx' }); }
    catch (error) { if (error.code !== 'EEXIST' || !Buffer.from(await readFile(asset.output)).equals(asset.bytes)) throw error; }
  }
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
    console.log('Usage: npm run apply:drawing-release -- --file <reviewed-release.json> [--replace] [--asset-dir <folder>]\nStores an immutable mapping release beside its prepared drawing package.\n--replace also makes its associations the default package. Original source/model files are never changed. Imported PDFs are added by SHA-256.\nRun npm run verify, review the diff, then commit and push to deploy.'); return;
  }
  const parsed = {}; let replace = false;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--replace' && !replace) { replace = true; continue; }
    requireValue(['--file', '--asset-dir'].includes(arg) && !parsed[arg] && args[index + 1] && !args[index + 1].startsWith('--'), 'Use --file <reviewed-release.json>, optional --replace and --asset-dir <folder>.');
    parsed[arg] = args[++index];
  }
  requireValue(parsed['--file'], 'Use --file <reviewed-release.json>.');
  const result = await applyDrawingRelease(await readJSON(resolve(parsed['--file'])), { replace, assetDirectory: parsed['--asset-dir'] || null });
  console.log(`${result.changed ? 'Stored' : 'Already stored'} immutable drawing release ${result.releaseId}.${result.defaultChanged ? ' Default associations updated.' : ' Default associations unchanged.'}\nNo deployment has run. Next: npm run verify, review the content diff, then commit and push.`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => { console.error(error.message); process.exitCode = 1; });
