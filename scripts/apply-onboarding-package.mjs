#!/usr/bin/env node
import * as fs from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { assertOnboardingPackage, createOnboardingDraft, normalizeOnboardingDraft } from '../src/studio/onboarding-domain.js';
import { validateRelease } from '../src/studio/domain.js';
import { sameStudioValue as same, studioFingerprint } from '../src/studio/value.js';
import { descriptorFromPackage, releaseFromOnboarding, validateProductRegistration } from '../src/product-room/package-descriptor.js';
import { normalizeDrawingPackage } from '../src/drawings/package.js';
import { createOverviewPresentation, overviewPresentationIssues } from '../src/drawings/overview-presentation.js';
import { preparedProductParts } from '../src/product-room/prepared-products.js';
import { loadProject, validateProjectShape } from './lib/project-config.mjs';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const hash = value => createHash('sha256').update(value).digest('hex');
const requireValue = (condition, message) => { if (!condition) throw new Error(message); };
const json = value => JSON.stringify(value, null, 2) + '\n';
const portableDrawing = value => { const pkg = normalizeDrawingPackage(value); pkg.assets = pkg.assets.map(({url,...asset}) => asset); return pkg; };

/** Reject even internal symlinks: reviewed source and output identities name exact files. */
async function checkedPath(root, value, { allowMissing = false, kind = 'file', io = fs } = {}) {
  requireValue(typeof value === 'string' && value && !isAbsolute(value) && !/[\\?#%\u0000-\u001f]/.test(value)
    && value.split('/').every(piece => piece && piece !== '.' && piece !== '..'), 'Use a contained repository-relative path.');
  const target = resolve(root, value);
  requireValue(target.startsWith(root + sep), 'The prepared path escapes its repository.');
  const pieces = relative(root, target).split(sep); let current = root;
  for (let index = 0; index < pieces.length; index++) {
    current = resolve(current, pieces[index]); let info;
    try { info = await io.lstat(current); } catch (error) { if (allowMissing && error.code === 'ENOENT') return target; throw error; }
    requireValue(!info.isSymbolicLink(), `Symlinks are not allowed in prepared source or output paths: ${value}`);
    if (index < pieces.length - 1) requireValue(info.isDirectory(), `A prepared parent path is not a directory: ${value}`);
    else requireValue(kind === 'directory' ? info.isDirectory() : info.isFile(), `Unexpected prepared path type: ${value}`);
  }
  return target;
}
const exists = async (path, io) => { try { await io.lstat(path); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } };

/** Load the configured candidate, never a URL or a module named in the export. */
export async function loadTrustedOnboardingCandidate(root, productId) {
  root = await fs.realpath(root);
  await checkedPath(root, 'src/studio/onboarding-catalog.js');
  const { createServer } = await import('vite');
  const server = await createServer({ root, configFile: false, publicDir: false,
    server: { middlewareMode: true, watch: null }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  try {
    const { onboardingCandidate, onboardingDiagnostics } = await server.ssrLoadModule('/src/studio/onboarding-catalog.js');
    const candidate = onboardingCandidate(productId);
    requireValue(candidate, `The prepared intake candidate is unavailable: ${onboardingDiagnostics?.find(item => item.productId === productId)?.message || productId}`);
    return candidate;
  } finally { await server.close(); }
}

/** Rebind the prepared view order to the reviewed mapping without copying old links. */
export async function loadTrustedTechnicalOverview(root, drawingPackage) {
  root = await fs.realpath(root);
  await checkedPath(root, 'src/drawing-preview/technical-catalog.js');
  const {createServer} = await import('vite');
  const server = await createServer({root,configFile:false,publicDir:false,
    server:{middlewareMode:true,watch:null},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
  try {
    const {preparedOverviewViewsFor,overviewPresentationFor} = await server.ssrLoadModule('/src/drawing-preview/technical-catalog.js');
    const overviewViews = preparedOverviewViewsFor(drawingPackage), configured = overviewPresentationFor(drawingPackage);
    const orders = {sheets:Object.fromEntries((configured?.sheets || []).map(sheet => [sheet.sheetId,sheet.views.map(view => view.id)]))};
    const presentationSnapshot = createOverviewPresentation(drawingPackage,overviewViews,orders);
    const issues = overviewPresentationIssues(presentationSnapshot,drawingPackage,overviewViews);
    requireValue(!issues.length,issues.map(issue => issue.message).join('\n'));
    return {overviewViews,presentationSnapshot};
  } finally { await server.close(); }
}

/** Apply a new reviewed product configuration. No renderer, customer store or deployment is changed. */
export async function applyOnboardingPackage(input, { root = projectRoot, candidate, io = fs } = {}) {
  root = await io.realpath(root);
  const trusted = candidate || await loadTrustedOnboardingCandidate(root, input?.productId);
  const packet = assertOnboardingPackage(input, trusted);
  const recipePath = await checkedPath(root, `content/onboarding/${trusted.id}/candidate.json`, {io});
  const recipe = validateProductRegistration(JSON.parse(await io.readFile(recipePath, 'utf8')));
  requireValue(same(recipe, trusted.registration), 'The prepared source recipe changed. Reopen and review the current candidate.');
  const configPath = await checkedPath(root, 'project.config.json', {io});
  const config = validateProjectShape(JSON.parse(await io.readFile(configPath, 'utf8')));
  requireValue(config.models.some(item => item.manifest === packet.modelManifest), 'Register this exact model manifest in project.config.json before applying the package.');
  const manifestPath = await checkedPath(root, packet.modelManifest, {io});
  const manifest = JSON.parse(await io.readFile(manifestPath, 'utf8'));
  requireValue(manifest.id === trusted.id, 'The prepared manifest belongs to another model.');
  for (const file of Object.values(manifest.assets || {})) await checkedPath(root, `${relative(root, dirname(manifestPath))}/${file}`, {io});
  if (manifest.tour) await checkedPath(root, `${relative(root, dirname(manifestPath))}/${manifest.tour}`, {io});
  const {models} = await loadProject(root);
  const prepared = models.find(item => item.manifest.id === trusted.id);
  requireValue(prepared?.revision === packet.modelRevision && prepared.manifestPath === manifestPath,
    'The actual prepared model bytes or manifest changed after review. Prepare the project and review it again.');
  requireValue(same(prepared.metadata.source, trusted.source) && same(preparedProductParts(prepared.metadata), trusted.parts),
    'The prepared component or source identities changed after review.');
  const directory = packet.drawingDirectory;
  requireValue(directory, 'This apply adapter currently requires a prepared drawing package.');
  await checkedPath(root, directory, {kind:'directory',io});
  const intakePath = await checkedPath(root, `${directory}/intake-source.json`, {io});
  const intakeBytes = await io.readFile(intakePath), intake = portableDrawing(JSON.parse(intakeBytes));
  requireValue(same(intake, portableDrawing(trusted.drawingPackages[0])), 'The immutable intake source changed after review.');
  const verifiedAssets = [];
  for (const asset of intake.assets) {
    const path = await checkedPath(root, `${directory}/${asset.file}`, {io});
    const actualHash = hash(await io.readFile(path));
    requireValue(actualHash === asset.sha256, `Source asset ${asset.id} no longer matches its reviewed SHA-256 hash.`);
    verifiedAssets.push({id:asset.id,file:asset.file,sha256:actualHash});
  }
  const posterPath = await checkedPath(root, `${directory}/${recipe.posterFile}`, {io});
  const drawingPath = await checkedPath(root, `${directory}/package.json`, {io});
  const oldDrawingBytes = await io.readFile(drawingPath);
  normalizeOnboardingDraft({...createOnboardingDraft(trusted), drawingPackage:JSON.parse(oldDrawingBytes)}, trusted);
  const roomRelative = `content/rooms/${trusted.id}`, roomPath = await checkedPath(root, roomRelative, {allowMissing:true,kind:'directory',io});
  requireValue(!await exists(roomPath, io), 'This product already has a Room directory. Use its existing versioned Studio release workflow; intake never overwrites a registered product.');
  const registration = {...recipe,title:packet.preview.content.title,shortTitle:packet.preview.content.shortTitle,summary:packet.preview.content.summary};
  const drawingPackage = portableDrawing(packet.preview.drawingPackage);
  const assetURLs = Object.fromEntries(intake.assets.map(asset => [asset.id,`/${directory}/${asset.file}`]));
  const technicalOverview = await loadTrustedTechnicalOverview(root,drawingPackage);
  const descriptor = descriptorFromPackage({registration,model:prepared.runtime,metadata:prepared.metadata,drawingPackage,assetURLs,posterURL:`/${directory}/${recipe.posterFile}`,...technicalOverview});
  const release = releaseFromOnboarding(packet.preview, descriptor, {id:`ROOM-${trusted.id}-${studioFingerprint({id:packet.id,reviewToken:packet.reviewToken})}`,createdAt:packet.createdAt});
  const issues = validateRelease(release,{product:descriptor}).filter(issue => issue.severity === 'error');
  requireValue(!issues.length, issues.map(issue => `${issue.path}: ${issue.message}`).join('\n'));
  const resultDescriptor = descriptorFromPackage({registration,model:prepared.runtime,metadata:prepared.metadata,drawingPackage,assetURLs,
    posterURL:`/${directory}/${recipe.posterFile}`,release,...technicalOverview});
  requireValue(resultDescriptor.readiness.inquiry.status === 'ready' && resultDescriptor.technicalReferences.length > 0,
    'The final product must retain usable inquiry and confirmed technical references.');
  const contents = {'product.json':json(registration),'release.json':json(release)};
  const receipt = {schemaVersion:1,kind:'annora-onboarding-application',source:'demo',packageId:packet.id,reviewToken:packet.reviewToken,
    candidateFingerprint:packet.candidateFingerprint,productId:trusted.id,modelRevision:packet.modelRevision,releaseId:release.id,
    appliedAt:new Date().toISOString(),deployment:'not-run',
    drawing:{id:drawingPackage.id,revision:drawingPackage.revision,mappingRevision:drawingPackage.mappingRevision,overviewRevision:technicalOverview.presentationSnapshot?.revision || null},
    sourceAssets:verifiedAssets,poster:{file:recipe.posterFile,sha256:hash(await io.readFile(posterPath))},
    files:Object.entries(contents).map(([file,bytes]) => ({file:`${roomRelative}/${file}`,sha256:hash(bytes)}))};
  contents['onboarding-receipt.json'] = json(receipt);

  // Validate everything above before creating even temporary output. The room is
  // published as one directory rename; the drawing mapping has a rollback copy.
  const parent = dirname(roomPath), suffix = randomUUID(), lock = resolve(parent, `.onboarding-${trusted.id}.lock`);
  const stage = resolve(parent, `.onboarding-${trusted.id}-${suffix}`), mappingStage = `${drawingPath}.onboarding-${suffix}.tmp`, backup = `${drawingPath}.onboarding-${suffix}.backup`;
  let locked = false, drawingReplaced = false, roomCommitted = false, preserveBackup = false;
  await io.mkdir(parent,{recursive:true});
  try {
    await io.writeFile(lock,packet.id,{flag:'wx'}); locked = true;
    await checkedPath(root, roomRelative, {allowMissing:true,kind:'directory',io});
    requireValue(!await exists(roomPath,io), 'Another intake registered this product before application.');
    await io.mkdir(stage);
    for (const [name,bytes] of Object.entries(contents)) await io.writeFile(resolve(stage,name),bytes,{flag:'wx'});
    await io.writeFile(mappingStage,json(drawingPackage),{flag:'wx'});
    await io.writeFile(backup,oldDrawingBytes,{flag:'wx'});
    requireValue((await io.readFile(drawingPath)).equals(oldDrawingBytes) && (await io.readFile(intakePath)).equals(intakeBytes),
      'The drawing source changed while applying the reviewed package. Nothing has been committed.');
    await checkedPath(root, `${directory}/package.json`, {io});
    await checkedPath(root, 'content/rooms', {kind:'directory',io});
    await io.rename(mappingStage,drawingPath); drawingReplaced = true;
    await io.rename(stage,roomPath); roomCommitted = true;
    await io.rm(backup,{force:true});
    return {changed:true,productId:trusted.id,releaseId:release.id,target:roomPath,receipt,release,registration};
  } catch (error) {
    const failures = [];
    if (roomCommitted) try { await io.rm(roomPath,{recursive:true,force:true}); } catch (failure) { failures.push(failure); }
    if (drawingReplaced) try { await io.rename(backup,drawingPath); } catch (failure) { preserveBackup = true; failures.push(failure); }
    if (failures.length) throw new AggregateError([error,...failures],`Application failed and needs recovery. The original drawing backup is preserved at ${backup}.`);
    throw error;
  } finally {
    await io.rm(stage,{recursive:true,force:true});
    await io.rm(mappingStage,{force:true});
    if (!preserveBackup) await io.rm(backup,{force:true});
    if (locked) await io.rm(lock,{force:true});
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--help') {
    console.log('Usage: npm run apply:onboarding -- --file <reviewed-onboarding.json> [--root <working-repository>]\nApplies a new prepared product configuration only. Run verification and deploy through the existing GitHub workflow separately.'); return;
  }
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index]; requireValue(['--file','--root'].includes(flag) && args[index+1] && !args[index+1].startsWith('--') && !(flag in options), 'Use --file <reviewed-onboarding.json> and optional --root <working-repository>.');
    options[flag] = args[index+1];
  }
  requireValue(options['--file'], 'Use --file <reviewed-onboarding.json>.');
  const packet = JSON.parse(await fs.readFile(resolve(options['--file']),'utf8'));
  const result = await applyOnboardingPackage(packet,{root:resolve(options['--root'] || projectRoot)});
  console.log(`Prepared package applied: ${result.productId} (${result.releaseId}).\nDeployment still required. Run npm run verify, review the content changes, and use the existing GitHub workflow. No customer records or hosted releases were changed.`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => { console.error(error.message); process.exitCode = 1; });
