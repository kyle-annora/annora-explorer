import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { applyOnboardingPackage, loadTrustedTechnicalOverview } from '../../scripts/apply-onboarding-package.mjs';
import { loadProject } from '../../scripts/lib/project-config.mjs';
import { descriptorFromPackage } from '../../src/product-room/package-descriptor.js';
import { createOnboardingDraft, normalizeOnboardingDraft, buildOnboardingPreview, createOnboardingReview, createOnboardingPackage } from '../../src/studio/onboarding-domain.js';
import { validateRelease } from '../../src/studio/domain.js';

const exec = promisify(execFile), repo = fileURLToPath(new URL('../../',import.meta.url)), id = 'nema17-bracket';
const clone = value => JSON.parse(JSON.stringify(value)), readJSON = async file => JSON.parse(await fs.readFile(file,'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function fixture(t) {
  const root = await fs.realpath(await fs.mkdtemp(join(tmpdir(),'annora-onboarding-')));
  t.after(() => fs.rm(root,{recursive:true,force:true}));
  await fs.cp(resolve(repo,'src'),resolve(root,'src'),{recursive:true});
  await fs.symlink(resolve(repo,'node_modules'),resolve(root,'node_modules'),'dir');
  await fs.writeFile(resolve(root,'package.json'),JSON.stringify({type:'module'}));
  for (const directory of [`content/models/${id}`,`content/drawings/${id}`,`content/onboarding/${id}`]) await fs.cp(resolve(repo,directory),resolve(root,directory),{recursive:true});
  const config = await readJSON(resolve(repo,'project.config.json')); config.models = [{manifest:`content/models/${id}/manifest.json`}]; config.defaultModel = id;
  await fs.writeFile(resolve(root,'project.config.json'),JSON.stringify(config));
  await fs.mkdir(resolve(root,'content/rooms/existing-product'),{recursive:true});
  await fs.writeFile(resolve(root,'content/rooms/existing-product/release.json'),'historical customer-independent content');
  const {models} = await loadProject(root), prepared = models[0], drawing = await readJSON(resolve(root,`content/drawings/${id}/intake-source.json`));
  const registration = await readJSON(resolve(root,`content/onboarding/${id}/candidate.json`));
  const urls = Object.fromEntries(drawing.assets.map(asset => [asset.id,`/drawings/${id}/${asset.file}`]));
  const candidate = descriptorFromPackage({registration,model:prepared.runtime,metadata:prepared.metadata,drawingPackage:drawing,assetURLs:urls,posterURL:`/drawings/${id}/poster.svg`});
  let draft = createOnboardingDraft(candidate); draft.checks = {source:true,units:true}; draft.revision = 1; draft.updatedAt = '2026-11-07T06:00:00.000Z';
  for (const sheet of draft.drawingPackage.sheets) for (const region of sheet.regions) region.mappingStatus = 'confirmed';
  draft = normalizeOnboardingDraft(draft,candidate);
  const preview = buildOnboardingPreview(draft,candidate), review = createOnboardingReview(draft,preview,candidate);
  const packet = createOnboardingPackage(review,candidate,{id:'ONBOARD-EXPORT-TEST',createdAt:'2026-11-07T06:01:00.000Z'});
  const drawingPath = resolve(root,`content/drawings/${id}/package.json`), intakePath = resolve(root,`content/drawings/${id}/intake-source.json`);
  return {root,candidate,packet,drawingPath,intakePath,drawingBefore:await fs.readFile(drawingPath),intakeBefore:await fs.readFile(intakePath)};
}
async function unchanged(context) {
  assert.deepEqual(await fs.readFile(context.drawingPath),context.drawingBefore);
  assert.deepEqual(await fs.readFile(context.intakePath),context.intakeBefore);
  assert.equal(await fs.readFile(resolve(context.root,'content/rooms/existing-product/release.json'),'utf8'),'historical customer-independent content');
  await assert.rejects(fs.stat(resolve(context.root,`content/rooms/${id}`)),{code:'ENOENT'});
  assert.ok((await fs.readdir(resolve(context.root,'content/rooms'))).every(file => !file.startsWith('.onboarding-')));
  assert.ok((await fs.readdir(dirname(context.drawingPath))).every(file => !file.includes('.onboarding-')));
}

test('reviewed fresh product applies generic room + exact confirmed mapping and rebuilds technical references', async t => {
  const context = await fixture(t), {root,candidate,packet} = context;
  const result = await applyOnboardingPackage(packet,{root,candidate});
  assert.equal(result.changed,true); assert.equal(result.receipt.deployment,'not-run');
  assert.deepEqual(await fs.readFile(context.intakePath),context.intakeBefore);
  assert.equal(await fs.readFile(resolve(root,'content/rooms/existing-product/release.json'),'utf8'),'historical customer-independent content');
  const pkg = await readJSON(context.drawingPath), release = await readJSON(resolve(result.target,'release.json'));
  assert.equal(pkg.mappingRevision,packet.preview.drawingPackage.mappingRevision);
  assert.notEqual(pkg.mappingRevision,JSON.parse(context.intakeBefore).mappingRevision);
  assert.ok(pkg.sheets.every(sheet => sheet.regions.every(region => region.mappingStatus === 'confirmed')));
  assert.ok(pkg.assets.every(asset => !('url' in asset)));
  assert.equal(release.source,'bundled'); assert.equal(release.version,1);
  assert.ok(release.presentation.story.steps.length > 0);
  for (const step of release.presentation.story.steps) {
    assert.equal(step.kind,'technical'); assert.equal(step.technical.context.drawing.mappingRevision,pkg.mappingRevision);
    assert.equal(step.technical.context.drawing.assetRevision,pkg.assets.find(asset => asset.id === step.technical.context.drawing.assetId).sha256);
  }
  assert.equal(result.receipt.reviewToken,packet.reviewToken);
  for (const record of result.receipt.files) assert.equal(hash(await fs.readFile(resolve(root,record.file))),record.sha256);
  const technicalOverview = await loadTrustedTechnicalOverview(root,pkg);
  assert.equal(technicalOverview.presentationSnapshot.revision,result.receipt.drawing.overviewRevision);
  assert.ok(release.presentation.story.steps.every(step => step.technical.viewId && step.technical.context.drawing.presentationRevision === technicalOverview.presentationSnapshot.revision));
  assert.equal(new Set(release.presentation.story.steps.map(step => step.technical.viewId)).size,3);
  const published = descriptorFromPackage({registration:result.registration,model:candidate.model,...technicalOverview,
    metadata:await readJSON(resolve(root,`content/models/${id}/metadata.json`)),drawingPackage:pkg,
    assetURLs:Object.fromEntries(candidate.assets.map(asset => [asset.id,asset.url])),posterURL:candidate.posterURL,release});
  assert.deepEqual(validateRelease(release,{product:published}).filter(issue => issue.severity === 'error'),[]);
  assert.deepEqual((await fs.readdir(result.target)).sort(),['onboarding-receipt.json','product.json','release.json']);
  const before = await fs.readFile(context.drawingPath);
  await assert.rejects(applyOnboardingPackage(packet,{root,candidate}),/already has a Room directory/);
  assert.deepEqual(await fs.readFile(context.drawingPath),before);
});

test('invalid, stale and altered package data fail before creating output', async t => {
  const context = await fixture(t);
  for (const edit of [
    packet => { packet.reviewToken = 'unchecked'; },
    packet => { packet.preview.content.title = 'Changed after review'; },
    packet => { packet.modelManifest = 'content/models/../../private.json'; },
    packet => { packet.draft.drawingPackage.sheets[0].regions[0].bounds[0] += 10; },
  ]) {
    const packet = clone(context.packet); edit(packet);
    await assert.rejects(applyOnboardingPackage(packet,{root:context.root,candidate:context.candidate})); await unchanged(context);
  }
});

test('source hashes and prepared model revisions are checked against real bytes', async t => {
  const context = await fixture(t), path = resolve(context.root,`content/drawings/${id}/source.pdf`), original = await fs.readFile(path);
  await fs.appendFile(path,'changed source bytes');
  await assert.rejects(applyOnboardingPackage(context.packet,{root:context.root,candidate:context.candidate}),/reviewed SHA-256/); await unchanged(context);
  await fs.writeFile(path,original);
  const manifestPath = resolve(context.root,context.packet.modelManifest), manifest = await readJSON(manifestPath); manifest.view.normalizedWidth += .1;
  await fs.writeFile(manifestPath,JSON.stringify(manifest));
  await assert.rejects(applyOnboardingPackage(context.packet,{root:context.root,candidate:context.candidate}),/model bytes or manifest changed/); await unchanged(context);
});

test('manifest registration and immutable intake source are required', async t => {
  const context = await fixture(t), configPath = resolve(context.root,'project.config.json'), before = await fs.readFile(configPath);
  const config = JSON.parse(before); config.models = [{manifest:'content/models/unregistered/manifest.json'}];
  await fs.writeFile(configPath,JSON.stringify(config));
  await assert.rejects(applyOnboardingPackage(context.packet,{root:context.root,candidate:context.candidate}),/exact model manifest/); await unchanged(context);
  await fs.writeFile(configPath,before);
  const changed = JSON.parse(context.intakeBefore); changed.sheets[0].regions[0].label = 'Unreviewed replacement';
  await fs.writeFile(context.intakePath,JSON.stringify(changed));
  await assert.rejects(applyOnboardingPackage(context.packet,{root:context.root,candidate:context.candidate}),/immutable intake source changed/);
  await fs.writeFile(context.intakePath,context.intakeBefore); await unchanged(context);
});

test('internal source symlinks and output directory symlinks are rejected', async t => {
  const context = await fixture(t), path = resolve(context.root,`content/drawings/${id}/source.pdf`), copy = path+'.kept';
  await fs.rename(path,copy); await fs.symlink(copy,path);
  await assert.rejects(applyOnboardingPackage(context.packet,{root:context.root,candidate:context.candidate}),/Symlinks are not allowed/); await unchanged(context);
  await fs.rm(path); await fs.rename(copy,path);
  const output = resolve(context.root,`content/rooms/${id}`); await fs.symlink(resolve(context.root,'content/rooms/existing-product'),output,'dir');
  await assert.rejects(applyOnboardingPackage(context.packet,{root:context.root,candidate:context.candidate}),/Symlinks are not allowed/);
  await fs.rm(output); await unchanged(context);
});

test('a failure after staging the drawing restores original mapping and removes new output', async t => {
  const context = await fixture(t), roomPath = resolve(context.root,`content/rooms/${id}`);
  let failed = false;
  const io = {...fs,rename:async (from,to) => { if (to === roomPath) { failed = true; throw new Error('Simulated directory commit failure'); } return fs.rename(from,to); }};
  await assert.rejects(applyOnboardingPackage(context.packet,{root:context.root,candidate:context.candidate,io}),/Simulated directory commit failure/);
  assert.equal(failed,true); await unchanged(context);
});

test('a staging write failure and competing apply lock preserve old content', async t => {
  const context = await fixture(t);
  const io = {...fs,writeFile:async (file,...args) => { if (file.includes('.onboarding-') && file.endsWith('release.json')) throw new Error('Simulated quota'); return fs.writeFile(file,...args); }};
  await assert.rejects(applyOnboardingPackage(context.packet,{root:context.root,candidate:context.candidate,io}),/Simulated quota/); await unchanged(context);
  const lock = resolve(context.root,`content/rooms/.onboarding-${id}.lock`); await fs.writeFile(lock,'another operation');
  await assert.rejects(applyOnboardingPackage(context.packet,{root:context.root,candidate:context.candidate}),{code:'EEXIST'});
  assert.equal(await fs.readFile(lock,'utf8'),'another operation'); await fs.rm(lock); await unchanged(context);
});

test('command-line --root loads its trusted Vite candidate and reports application without deployment', async t => {
  const context = await fixture(t), {root} = context;
  // These legacy default seed imports are not modified or registered as the new product.
  for (const path of ['content/models/kinetic-01/metadata.json','content/rooms/kinetic-01/release.json']) {
    await fs.mkdir(dirname(resolve(root,path)),{recursive:true}); await fs.copyFile(resolve(repo,path),resolve(root,path));
  }
  const file = resolve(root,'reviewed.json'); await fs.writeFile(file,JSON.stringify(context.packet));
  const {stdout} = await exec(process.execPath,[resolve(repo,'scripts/apply-onboarding-package.mjs'),'--file',file,'--root',root],{maxBuffer:1024*1024});
  assert.match(stdout,/Prepared package applied/); assert.match(stdout,/Deployment still required/);
  assert.equal((await readJSON(resolve(root,`content/rooms/${id}/onboarding-receipt.json`))).deployment,'not-run');
});
