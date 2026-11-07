/** Runs against the installed tarball in the fresh host, never repository source. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const freshResult = JSON.parse(await readFile(process.env.FRESH_RESULT || join(root, 'work/product-expansion/W60/fresh-host/result.json'), 'utf8'));
assert.equal(freshResult.status, 'passed', 'Qualify the fresh artifact build first.');
const host = process.env.FRESH_HOST || freshResult.host;
const out = resolve(process.env.OUT || join(root, 'work/product-expansion/W60/artifact-conformance'));
await mkdir(out, { recursive: true });
const packageRoot = join(host, 'node_modules/@annora/integration-kit');
const metadata = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'));
const entry = key => {
  const value = metadata.exports[key];
  return pathToFileURL(join(packageRoot, typeof value === 'string' ? value : value.import || value.default)).href;
};
const kit = await import(entry('.'));
const { createBrowserDemoRepository } = await import(entry('./demo-repository'));
const copy = value => JSON.parse(JSON.stringify(value));
const hash = value => createHash('sha256').update(value).digest('hex');
const base = { productId: 'qualified-product', productTitle: 'Qualification mechanism', productRevision: 'product-r1', modelId: 'qualified-model', modelRevision: 'model-r1' };
const basicCapabilities = { inquiry: true, selectedPart: true, capturedView: true, drawingDetail: false, story: false };
const selected = { id: 'stable-rod', title: 'Connecting rod' };
const camera = { schemaVersion: 1, sourceRevision: 'model-r1', selectedPartId: selected.id, camera: { position: [2, 1, 3], target: [0, 0, 0] } };
const adapter = overrides => ({ version: '1', id: 'qualification-viewer', adapterVersion: '1', coordinateFrame: 'source-meters-y-up-v1',
  capabilities: { ...basicCapabilities }, capture: async () => ({ part: selected, snapshot: copy(camera) }), restore: async () => {}, ...overrides });
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
function store() {
  const data = new Map([['existing.customer.projects', 'unchanged-existing-customer-data']]);
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  let serial = 0;
  const namespace = 'qualification.integration.projects.v1';
  const repository = createBrowserDemoRepository({ namespace, storage, locks: null, now: () => '2026-11-06T12:00:00.000Z', makeId: prefix => `${prefix}-${++serial}` });
  return { data, storage, namespace, repository };
}
const checks = [];
async function check(name, run) {
  try { const evidence = await run(); checks.push({ name, status: 'passed', ...(evidence ? { evidence } : {}) }); console.log(`PASS ${name}`); }
  catch (error) { checks.push({ name, status: 'failed', error: { message: error.message, code: error.code, stack: error.stack } }); console.error(`FAIL ${name}: ${error.message}`); }
}
const capturedContext = () => kit.createIntegrationController({ adapter: adapter(), context: base }).captureContext();

await check('inquiry-only host does not invent selection or capture', async () => {
  const controller = kit.createIntegrationController({ context: base, adapter: adapter({ capabilities: { inquiry: true, selectedPart: false, capturedView: false, drawingDetail: false, story: false }, capture: undefined, restore: undefined }) });
  assert.deepEqual(await controller.captureContext(), base);
  await assert.rejects(controller.restoreContext(base), { code: 'UNSUPPORTED_CAPABILITY' });
  controller.dispose();
});
await check('unsupported drawing and story capture reject explicitly', async () => {
  for (const field of ['drawing', 'chapter']) {
    const controller = kit.createIntegrationController({ context: base, adapter: adapter({ capture: async () => ({ part: selected, snapshot: camera, [field]: {} }) }) });
    await assert.rejects(controller.captureContext(), { code: 'UNSUPPORTED_CAPABILITY' }); controller.dispose();
  }
});
await check('independent camera and part restore retain exact identities', async () => {
  const restores = [], controller = kit.createIntegrationController({ context: base, adapter: adapter({ restore: async snapshot => restores.push(snapshot) }) });
  const captured = await controller.captureContext();
  assert.deepEqual(captured.part, selected);
  assert.deepEqual(captured.viewerReference.model, { id: base.modelId, revision: base.modelRevision });
  assert.deepEqual(captured.viewerReference.product, { id: base.productId, revision: base.productRevision });
  assert.equal(captured.inspection, undefined);
  assert.deepEqual(await controller.restoreContext(captured), captured);
  assert.deepEqual(restores, [camera]); controller.dispose();
});
await check('new capture supersedes stale completion', async () => {
  const slow = deferred(); let call = 0;
  const controller = kit.createIntegrationController({ context: base, adapter: adapter({ capture: async () => ++call === 1 ? slow.promise : { snapshot: camera } }) });
  const first = controller.captureContext(); const rejected = assert.rejects(first, { code: 'STALE_OPERATION' });
  await tick(); const second = await controller.captureContext(); slow.resolve({ snapshot: { stale: true } });
  await rejected; assert.deepEqual(second.viewerReference.snapshot, camera); controller.dispose();
});
await check('timeout retries succeed without adopting late state', async () => {
  let call = 0;
  const controller = kit.createIntegrationController({ context: base, timeoutMs: 20, adapter: adapter({ capture: async () => ++call === 1 ? new Promise(() => {}) : { snapshot: camera } }) });
  await assert.rejects(controller.captureContext(), { code: 'VIEWER_TIMEOUT' });
  assert.deepEqual((await controller.captureContext()).viewerReference.snapshot, camera); controller.dispose();
});
await check('disposal aborts active work and prevents subsequent capture', async () => {
  let signal;
  const controller = kit.createIntegrationController({ context: base, adapter: adapter({ capture: async options => { signal = options.signal; return new Promise(() => {}); } }) });
  const pending = controller.captureContext(); const rejected = assert.rejects(pending, { code: 'DISPOSED' });
  await tick(); controller.dispose(); await rejected; assert.equal(signal.aborted, true);
  await assert.rejects(controller.captureContext(), { code: 'DISPOSED' }); controller.dispose();
});
await check('external cancellation preserves a saved attachment', async () => {
  const controller = kit.createIntegrationController({ context: base, adapter: adapter({ capture: async () => new Promise(() => {}) }) });
  const abort = new AbortController(), pending = controller.captureContext({ signal: abort.signal });
  const rejected = assert.rejects(pending, { code: 'CANCELLED' }); abort.abort(); await rejected; controller.dispose();
});
await check('declared adapter and saved-reference versions fail closed', async () => {
  assert.throws(() => kit.createIntegrationController({ context: base, adapter: adapter({ version: '99' }) }), { code: 'UNSUPPORTED_ADAPTER_VERSION' });
  const captured = await capturedContext();
  const controller = kit.createIntegrationController({ context: base, adapter: adapter({ adapterVersion: '2' }) });
  await assert.rejects(controller.restoreContext(captured), { code: 'INCOMPATIBLE_ADAPTER' }); controller.dispose();
});
await check('invalid JSON is rejected without coercion or truncation', async () => {
  for (const snapshot of [{ number: Infinity }, { callback() {} }, { text: 'x'.repeat(8193) }]) {
    const controller = kit.createIntegrationController({ context: base, adapter: adapter({ capture: async () => ({ snapshot }) }) });
    await assert.rejects(controller.captureContext(), { code: 'INVALID_REFERENCE' }); controller.dispose();
  }
});
await check('repository support cannot silently discard an external reference', async () => {
  const env = store(), context = await capturedContext();
  const unsupported = { ...env.repository, supportedViewerReferenceVersions: [] };
  const session = kit.createInquirySession({ repository: unsupported, schedule: () => 1, cancel: () => {} });
  await assert.rejects(session.open({ context }));
  assert.equal(env.storage.getItem(env.namespace), null); session.dispose();
  const dropping = { ...env.repository, saveDraft: async input => { const value = copy(input); delete value.context.viewerReference; return { ...value, revision: input.revision + 1, updatedAt: '2026-11-06T12:00:00.000Z' }; } };
  const retained = kit.createInquirySession({ repository: dropping, schedule: () => 1, cancel: () => {} });
  await retained.open({ context }); retained.updateValues({ application: 'Keep the selected component reference.', quantity: '4' });
  await assert.rejects(retained.review());
  assert.deepEqual(retained.getContext().viewerReference, context.viewerReference);
  assert.equal(retained.getState().draft.values.application, 'Keep the selected component reference.'); retained.dispose();
});

let reinstallFixture;
await check('review, explicit confirmation and repeat confirmation preserve one project', async () => {
  const env = store(), context = await capturedContext();
  const session = kit.createInquirySession({ repository: env.repository, schedule: () => 1, cancel: () => {} });
  await session.open({ context }); session.updateValues({ application: 'Fictional request for this connecting rod.', quantity: '4' });
  await assert.rejects(session.confirm(), { code: 'STALE_REVIEW' });
  const reviewed = await session.review(); assert.equal((await env.repository.listProjects()).length, 0);
  const project = await session.confirm(); assert.equal((await env.repository.listProjects()).length, 1);
  assert.deepEqual(project.context.viewerReference, context.viewerReference);
  assert.deepEqual(await session.confirm(), project);
  assert.equal(env.storage.getItem('existing.customer.projects'), 'unchanged-existing-customer-data');
  reinstallFixture = { context, project, namespace: env.namespace, raw: env.storage.getItem(env.namespace) };
  assert.deepEqual(reviewed.draft.context, project.context); session.dispose();
  return { projectId: project.id, storeSha256: hash(reinstallFixture.raw), existingStoreUnchanged: true };
});
await check('missing old model version does not substitute the current view', async () => {
  assert.ok(reinstallFixture);
  const before = reinstallFixture.raw, controller = kit.createIntegrationController({ context: { ...base, modelRevision: 'model-r2' }, adapter: adapter() });
  await assert.rejects(controller.restoreContext(reinstallFixture.context), { code: 'IDENTITY_MISMATCH' });
  assert.equal(reinstallFixture.raw, before); controller.dispose();
});
await check('unknown future reference leaves raw stored history unchanged', async () => {
  assert.ok(reinstallFixture);
  const env = store(), future = JSON.parse(reinstallFixture.raw);
  future.projects[0].context.viewerReference.version = '99';
  const raw = JSON.stringify(future); env.storage.setItem(env.namespace, raw);
  await assert.rejects(env.repository.getProject(reinstallFixture.project.id));
  assert.equal(env.storage.getItem(env.namespace), raw);
  return { unsupportedStoreSha256: hash(raw), unchangedAfterReadFailure: true };
});
await check('same-version package reinstall reopens unchanged host-owned records', async () => {
  assert.ok(reinstallFixture);
  const fixturePath = join(out, 'reinstall-store.json');
  await writeFile(fixturePath, JSON.stringify(reinstallFixture, null, 2));
  assert.equal(hash(await readFile(freshResult.artifact)), freshResult.artifactSha256, 'The artifact changed after the fresh-host build; rerun qualification.');
  await rm(packageRoot, { recursive: true, force: true });
  const npm = await promisify(execFile)('npm', ['install', '--force', '--no-audit', '--no-fund', `@annora/integration-kit@file:${freshResult.artifact}`], { cwd: host, maxBuffer: 2 * 1024 * 1024 });
  await writeFile(join(out, 'reinstall.log'), npm.stdout + npm.stderr);
  const runner = `import assert from 'node:assert/strict';\nimport {readFile,writeFile} from 'node:fs/promises';\nimport {createBrowserDemoRepository} from '@annora/integration-kit/demo-repository';\nconst f=JSON.parse(await readFile(process.argv[2],'utf8'));let raw=f.raw;\nconst metadata=JSON.parse(await readFile(new URL('./node_modules/@annora/integration-kit/package.json',import.meta.url),'utf8'));assert.equal(metadata.version,process.argv[4]);\nconst repository=createBrowserDemoRepository({namespace:f.namespace,storage:{getItem:()=>raw,setItem:(_key,value)=>{raw=value;}},locks:null});\nassert.deepEqual(await repository.getProject(f.project.id),f.project);assert.equal(raw,f.raw);\nawait writeFile(process.argv[3],JSON.stringify({status:'passed',version:metadata.version,storeUnchanged:true,projectId:f.project.id}));\n`;
  const runnerPath = join(host, 'reinstall-check.mjs'), reportPath = join(out, 'reinstall-result.json');
  await writeFile(runnerPath, runner);
  await promisify(execFile)(process.execPath, [runnerPath, fixturePath, reportPath, metadata.version], { cwd: host });
  return JSON.parse(await readFile(reportPath, 'utf8'));
});

await check('0.1.0 confirmed inquiry upgrades to 0.2.0 without rewriting historical references', async () => {
  assert.equal(metadata.version, '0.2.0', 'This qualification targets the released 0.1.0 to 0.2.0 boundary.');
  assert.equal(hash(await readFile(freshResult.artifact)), freshResult.artifactSha256, 'The current artifact changed; rerun the fresh-host qualification.');
  const priorArtifact = resolve(root, 'releases/integration-kit/annora-integration-kit-0.1.0.tgz');
  const priorArtifactSha256 = hash(await readFile(priorArtifact));
  const upgradeBase = {...base, productId:'kinetic-01', productTitle:'Crank-slider mechanism', modelId:'kinetic-01'};
  const priorHost = join(out, 'prior-0.1.0-host');
  await mkdir(priorHost, {recursive:true});
  await writeFile(join(priorHost, 'package.json'), JSON.stringify({name:'annora-prior-artifact-qualification',version:'1.0.0',private:true,type:'module',
    dependencies:{'@annora/integration-kit':`file:${priorArtifact}`,...metadata.peerDependencies}}, null, 2) + '\n');
  // Only the installed release may create this fixture. Repository source and
  // hand-authored stored records would not prove backward compatibility.
  const npm = await promisify(execFile)('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund'], {cwd:priorHost,maxBuffer:2*1024*1024});
  await writeFile(join(out, 'prior-install.log'), npm.stdout + npm.stderr);
  const fixturePath = join(out, 'upgrade-0.1.0-store.json');
  const runner = `import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createIntegrationController,createInquirySession} from '@annora/integration-kit';
import {createBrowserDemoRepository} from '@annora/integration-kit/demo-repository';
const metadata=JSON.parse(await readFile(new URL('./node_modules/@annora/integration-kit/package.json',import.meta.url),'utf8'));
assert.equal(metadata.version,'0.1.0');
const base=${JSON.stringify(upgradeBase)},part=${JSON.stringify(selected)},snapshot=${JSON.stringify(camera)};
const controller=createIntegrationController({context:base,adapter:{version:'1',id:'qualification-viewer',adapterVersion:'1',coordinateFrame:'source-meters-y-up-v1',
 capabilities:${JSON.stringify(basicCapabilities)},capture:async()=>({part,snapshot}),restore:async()=>{}}});
const context=await controller.captureContext(),data=new Map([['existing.customer.projects','unchanged-existing-customer-data']]);
const storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};
let serial=0;const namespace='qualification.upgrade.projects.v1';
const repository=createBrowserDemoRepository({namespace,storage,locks:null,now:()=> '2026-11-06T12:00:00.000Z',makeId:prefix=>prefix+'-prior-'+(++serial)});
const session=createInquirySession({repository,schedule:()=>1,cancel:()=>{}});
await session.open({context});session.updateValues({application:'Fictional request created by the released 0.1.0 package.',quantity:'4'});
await assert.rejects(session.confirm(),{code:'STALE_REVIEW'});
const review=await session.review();assert.equal((await repository.listProjects()).length,0);
const project=await session.confirm();assert.deepEqual(review.draft.context,project.context);assert.deepEqual(await session.confirm(),project);
assert.equal((await repository.listProjects()).length,1);assert.equal(project.context.viewerReference.version,'1');
assert.equal(storage.getItem('existing.customer.projects'),'unchanged-existing-customer-data');
await writeFile(process.argv[2],JSON.stringify({packageVersion:metadata.version,context,project,namespace,raw:storage.getItem(namespace)},null,2)+'\\n');
session.dispose();controller.dispose();
`;
  const runnerPath = join(priorHost, 'create-prior-inquiry.mjs');
  await writeFile(runnerPath, runner);
  await promisify(execFile)(process.execPath, [runnerPath, fixturePath], {cwd:priorHost});
  const fixture = JSON.parse(await readFile(fixturePath, 'utf8'));
  assert.equal(fixture.packageVersion, '0.1.0');
  const data = new Map([[fixture.namespace, fixture.raw], ['existing.customer.projects', 'unchanged-existing-customer-data']]);
  const writes = [];
  const storage = {getItem:key=>data.get(key)??null,setItem:(key,value)=>{writes.push(key);data.set(key,value);}};
  const repository = createBrowserDemoRepository({namespace:fixture.namespace,storage,locks:null,
    now:()=> '2026-11-06T13:00:00.000Z',makeId:prefix=>`${prefix}-upgrade-draft`});
  assert.deepEqual(await repository.getProject(fixture.project.id), fixture.project);
  assert.deepEqual(await repository.listProjects(), [fixture.project]);
  assert.deepEqual(writes, []);assert.equal(storage.getItem(fixture.namespace), fixture.raw);
  const restores = [], controller = kit.createIntegrationController({context:upgradeBase,adapter:adapter({restore:async snapshot=>restores.push(snapshot)})});
  assert.deepEqual(await controller.restoreContext(fixture.context), fixture.context);
  assert.deepEqual(restores, [camera]);controller.dispose();
  const draft = await repository.getQuoteDraft(fixture.project.id);
  assert.deepEqual(draft.context, fixture.context);
  assert.deepEqual(writes, []);assert.equal(storage.getItem(fixture.namespace), fixture.raw);
  draft.values.scope = 'Seller draft prepared in 0.2.0 against the original confirmed inquiry.';
  const savedDraft = await repository.saveQuoteDraft(draft);
  assert.deepEqual(savedDraft.context.viewerReference, fixture.context.viewerReference);
  await assert.rejects(repository.issueQuote(savedDraft), {code:'STALE_REVIEW'});
  assert.deepEqual(await repository.getProject(fixture.project.id), fixture.project, 'Saving a seller draft must not alter the original inquiry or issue a quotation.');
  const after = JSON.parse(storage.getItem(fixture.namespace)), before = JSON.parse(fixture.raw);
  assert.equal(after.schemaVersion, before.schemaVersion);
  assert.equal(after.projects[0].context.viewerReference.version, '1');
  assert.equal(after.quoteDrafts[0].context.viewerReference.version, '1');
  assert.deepEqual(after.projects, before.projects);
  assert.equal(storage.getItem('existing.customer.projects'), 'unchanged-existing-customer-data');
  assert.equal(hash(await readFile(priorArtifact)), priorArtifactSha256, 'The previous release archive must remain immutable.');
  assert.equal(hash(await readFile(freshResult.artifact)), freshResult.artifactSha256, 'The current artifact changed during qualification.');
  return {fromVersion:fixture.packageVersion,toVersion:metadata.version,priorArtifactSha256,
    projectId:fixture.project.id,referenceVersion:'1',storeSchemaVersion:before.schemaVersion,
    originalStoreSha256:hash(fixture.raw),readOnlyStoreUnchanged:true,originalInquiryUnchanged:true,
    exactReferenceRestored:true,newSellerDraftReferencePreserved:true,unreviewedIssueRejected:true,priorArchiveUnchanged:true};
});

const result = { package: { name: metadata.name, version: metadata.version, artifactSha256: freshResult.artifactSha256 }, host,
  status: checks.every(check => check.status === 'passed') ? 'passed' : 'failed', checks,
  limits: ['Upgrade qualification covers the released 0.1.0 inquiry and reference schema with 0.2.0; it is not a claim about arbitrary future versions.', 'No browser or physical-device performance claim.', 'No real backend delivery.'] };
await writeFile(join(out, 'result.json'), JSON.stringify(result, null, 2) + '\n');
if (result.status !== 'passed') process.exitCode = 1;
