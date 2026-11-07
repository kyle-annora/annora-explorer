/** Qualify the distributable from a real host outside this source checkout. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const root = fileURLToPath(new URL('../../../', import.meta.url));
const artifact = resolve(process.env.KIT_ARTIFACT || join(root, 'dist-integration/annora-integration-kit-0.1.0.tgz'));
const sourceHost = resolve(process.env.HOST_SOURCE || join(root, 'examples/existing-viewer'));
const evidence = resolve(process.env.OUT || join(root, 'work/product-expansion/W50/fresh-host'));
const parent = await mkdtemp(join(tmpdir(), 'annora-kit-qualification-'));
const host = join(parent, 'host');
await mkdir(evidence, { recursive: true });
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const records = [];
async function command(name, args, cwd = host) {
  const label = `${name} ${args.join(' ')}`;
  try {
    const result = await exec(name, args, { cwd, maxBuffer: 8 * 1024 * 1024, env: process.env });
    records.push({ command: label, exitCode: 0 });
    await writeFile(join(evidence, `${records.length}-${basename(name)}.log`), result.stdout + result.stderr);
    return result.stdout;
  } catch (error) {
    records.push({ command: label, exitCode: error.code });
    await writeFile(join(evidence, `${records.length}-${basename(name)}.log`), (error.stdout || '') + (error.stderr || ''));
    throw error;
  }
}
async function files(directory) {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...await files(path));
    else if (entry.isFile()) found.push(path);
  }
  return found.sort();
}
let result = { status: 'running', artifact, sourceHost, host, evidence, node: process.version, claims: {
  independentHostBuild: true,
  sameVersionReinstallOnly: true,
  crossVersionMigration: false,
  browserQualification: false,
} };
try {
  result.artifactSha256 = digest(await readFile(artifact));
  const entries = (await command('tar', ['-tzf', artifact], parent)).trim().split('\n');
  assert.ok(entries.every(path => path.startsWith('package/') && !path.includes('../')));
  assert.ok(entries.every(path => !/(?:node_modules\/|\.(?:glb|gltf|bin|step|stp|pdf|png|jpg|webp|mp4)$)/i.test(path)), 'The kit must contain no model, PDF or media assets.');
  const metadata = JSON.parse(await command('tar', ['-xOzf', artifact, 'package/package.json'], parent));
  assert.equal(metadata.name, '@annora/integration-kit');
  assert.equal(metadata.version, '0.1.0');
  assert.ok(metadata.peerDependencies?.react, 'React must be an explicit peer.');
  assert.ok(metadata.peerDependencies?.['react-dom'], 'React DOM must be an explicit peer.');
  assert.ok(!metadata.dependencies?.three && !metadata.dependencies?.['pdfjs-dist']);
  assert.ok(metadata.exports?.['.'] && metadata.exports?.['./style.css'] && metadata.exports?.['./demo-repository']);
  result.package = { name: metadata.name, version: metadata.version, peers: metadata.peerDependencies, exports: metadata.exports, entries };
  await cp(sourceHost, host, { recursive: true, filter: source => !relative(sourceHost, source).split('/').some(segment => ['node_modules', 'dist', '.git'].includes(segment)) });
  const packagePath = join(host, 'package.json');
  const hostPackage = JSON.parse(await readFile(packagePath, 'utf8'));
  assert.ok(hostPackage.dependencies?.['@annora/integration-kit'], 'The fixture must declare the installed package.');
  hostPackage.dependencies['@annora/integration-kit'] = `file:${artifact}`;
  await writeFile(packagePath, JSON.stringify(hostPackage, null, 2) + '\n');
  const sourceFiles = (await files(host)).filter(path => /\.(?:m?js|jsx|ts|tsx)$/.test(path));
  for (const path of sourceFiles) {
    const source = await readFile(path, 'utf8');
    assert.ok(!/(?:from\s*|import\s*\()\s*['"](?:\.\.\/){2}|annora-explorer\/src\/|src\/explorer\//.test(source), `${relative(host, path)} imports repository source.`);
  }
  await command('npm', ['install', '--no-audit', '--no-fund']);
  result.dependencies = JSON.parse(await command('npm', ['ls', '--json', 'react', 'react-dom', 'three', '@annora/integration-kit']));
  const installed = join(host, 'node_modules/@annora/integration-kit');
  const installedPackage = JSON.parse(await readFile(join(installed, 'package.json'), 'utf8'));
  assert.equal(installedPackage.version, metadata.version);
  await command('npm', ['run', 'build']);
  result.build = await Promise.all((await files(join(host, 'dist'))).map(async path => ({ path: relative(join(host, 'dist'), path), sha256: digest(await readFile(path)) })));
  assert.ok(result.build.some(file => file.path === 'index.html'));
  result.status = 'passed';
  console.log(JSON.stringify({ status: result.status, host, artifactSha256: result.artifactSha256, evidence }, null, 2));
} catch (error) {
  result.status = 'failed'; result.error = { name: error.name, message: error.message };
  process.exitCode = 1; console.error(error);
} finally {
  result.commands = records;
  await writeFile(join(evidence, 'result.json'), JSON.stringify(result, null, 2) + '\n');
}
