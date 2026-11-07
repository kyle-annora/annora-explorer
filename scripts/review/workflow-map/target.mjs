// Read-only publication verification. No browser, accounts, or demo storage.
// BASE_URL=https://kyle-annora.github.io/annora-explorer/ \
// OUT=work/workflow-map/public-target.json EXPECTED_COMMIT=<sha> node scripts/review/workflow-map/target.mjs
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const root = fileURLToPath(new URL('../../../', import.meta.url));
if (!process.env.BASE_URL) throw new Error('Set BASE_URL to the published repository root, including its subpath.');
const base = new URL(process.env.BASE_URL.endsWith('/') ? process.env.BASE_URL : `${process.env.BASE_URL}/`);
if (!['http:', 'https:'].includes(base.protocol)) throw new Error('BASE_URL must use HTTP(S).');
const output = resolve(root, process.env.OUT || 'work/workflow-map/public-target.json');
const dist = resolve(root, process.env.DIST || 'dist');
const baseline = JSON.parse(await readFile(resolve(root, 'work/workflow-map/baseline.json'), 'utf8'));
const priorReceiptPath = 'docs/evidence/integration-walkthrough/release-receipt.json';
const priorReceipt = JSON.parse(await readFile(resolve(root, priorReceiptPath), 'utf8'));
const expectedCommit = process.env.EXPECTED_COMMIT || null;
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const baselineByPath = new Map([...baseline.publicEntries, ...baseline.publicAssets].map(record => [record.path, record]));
const special = new Set(['integration-kit/annora-integration-kit-0.2.0.tgz', 'integration-kit/release.json']);
const remoteBytes = new Map();
const localBytes = new Map();
const records = new Map();

function assetPaths(html, pagePath) {
  const paths = [];
  for (const tag of html.matchAll(/<(script|link)\b[^>]*>/gi)) {
    const attrs = Object.fromEntries([...tag[0].matchAll(/([\w-]+)\s*=\s*(["'])(.*?)\2/g)].map(match => [match[1].toLowerCase(), match[3]]));
    const ref = tag[1].toLowerCase() === 'script' ? attrs.src : /\b(stylesheet|modulepreload|preload)\b/.test(attrs.rel || '') ? attrs.href : null;
    if (!ref) continue;
    const url = new URL(ref.replaceAll('&amp;', '&'), new URL(pagePath, base));
    if (url.origin === base.origin && url.pathname.startsWith(base.pathname)) paths.push(decodeURIComponent(url.pathname.slice(base.pathname.length)));
  }
  return [...new Set(paths)];
}

function htmlComparison(a, b) {
  const split = html => ({
    document: html.replace(/<link\b[^>]*>/gi, '').replace(/\s+/g, ' ').trim(),
    links: [...html.matchAll(/<link\b[^>]*>/gi)].map(match => match[0]).sort(),
  });
  const left = split(a), right = split(b);
  return { sameDocumentAndLinkSet: left.document === right.document && JSON.stringify(left.links) === JSON.stringify(right.links) };
}

function htmlFingerprint(html) {
  return {
    documentWithoutLinksSha256: sha256(html.replace(/<link\b[^>]*>/gi, '').replace(/\s+/g, ' ').trim()),
    sortedLinkTagsSha256: sha256(JSON.stringify([...html.matchAll(/<link\b[^>]*>/gi)].map(match => match[0]).sort())),
  };
}

function knownHtmlPair(path, firstHash, secondHash) {
  return (priorReceipt.htmlDifferences || []).some(record => record.path === path
    && new Set([record.servedSha256, record.localSha256]).has(firstHash)
    && new Set([record.servedSha256, record.localSha256]).has(secondHash));
}

async function inspect(path) {
  if (records.has(path)) return;
  const record = { path, url: new URL(path, base).href };
  records.set(path, record);
  try {
    const bytes = await readFile(resolve(dist, path));
    localBytes.set(path, bytes);
    record.localBytes = bytes.length;
    record.localSha256 = sha256(bytes);
  } catch (error) { record.localError = error.code || error.message; }
  try {
    const response = await fetch(record.url, {
      headers: { 'Cache-Control': 'no-cache' }, credentials: 'omit', signal: AbortSignal.timeout(45000),
    });
    record.status = response.status;
    record.resolvedUrl = response.url;
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    remoteBytes.set(path, bytes);
    record.publicBytes = bytes.length;
    record.publicSha256 = sha256(bytes);
    record.exactLocalMatch = record.publicSha256 === record.localSha256;
    const prior = baselineByPath.get(path);
    if (prior) {
      record.baselineSha256 = prior.sha256;
      record.exactBaselineMatch = record.publicSha256 === prior.sha256;
    }
    if (path.endsWith('.html') && localBytes.has(path) && !record.exactLocalMatch) {
      record.htmlComparison = htmlComparison(bytes.toString('utf8'), localBytes.get(path).toString('utf8'));
      record.knownPriorHtmlVariantToLocal = record.htmlComparison.sameDocumentAndLinkSet
        && knownHtmlPair(path, record.publicSha256, record.localSha256);
    }
    if (path.endsWith('.html') && prior?.htmlFingerprint && !record.exactBaselineMatch) {
      const fingerprint = htmlFingerprint(bytes.toString('utf8'));
      record.htmlComparisonToBaseline = {
        sameDocumentAndLinkSet: fingerprint.documentWithoutLinksSha256 === prior.htmlFingerprint.documentWithoutLinksSha256
          && fingerprint.sortedLinkTagsSha256 === prior.htmlFingerprint.sortedLinkTagsSha256,
      };
      record.knownPriorHtmlVariantToBaseline = record.htmlComparisonToBaseline.sameDocumentAndLinkSet
        && knownHtmlPair(path, record.publicSha256, prior.sha256);
    }
  } catch (error) { record.publicError = error.message; }
}

async function inspectAll(paths) {
  const queue = [...new Set(paths)];
  await Promise.all(Array.from({ length: Math.min(6, queue.length) }, async () => {
    while (queue.length) await inspect(queue.shift());
  }));
}

function tarFiles(bytes) {
  const tar = gunzipSync(bytes), files = new Map();
  for (let offset = 0; offset + 512 <= tar.length;) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every(byte => byte === 0)) break;
    const string = (start, end) => header.subarray(start, end).toString('utf8').replace(/\0.*$/s, '');
    const name = [string(345, 500), string(0, 100)].filter(Boolean).join('/');
    const size = parseInt(string(124, 136).trim(), 8) || 0;
    const type = header[156];
    if (type === 0 || type === 48) files.set(name, tar.subarray(offset + 512, offset + 512 + size));
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return files;
}

await inspectAll([...baselineByPath.keys(), 'workflows/index.html']);
const entryPaths = [...baseline.publicEntries.map(record => record.path), 'workflows/index.html'];
const linked = new Set();
for (const path of entryPaths) {
  for (const source of [remoteBytes, localBytes]) {
    if (source.has(path)) for (const asset of assetPaths(source.get(path).toString('utf8'), path)) linked.add(asset);
  }
}
await inspectAll([...linked]);

let integrationPackage;
try {
  const archivePath = 'integration-kit/annora-integration-kit-0.2.0.tgz';
  const releasePath = 'integration-kit/release.json';
  const archive = remoteBytes.get(archivePath);
  const release = JSON.parse(remoteBytes.get(releasePath));
  const publicFiles = tarFiles(archive), builtFiles = tarFiles(localBytes.get(archivePath));
  const changedFiles = [...new Set([...publicFiles.keys(), ...builtFiles.keys()])].filter(path =>
    !publicFiles.has(path) || !builtFiles.has(path) || !publicFiles.get(path).equals(builtFiles.get(path)));
  const publicManifest = JSON.parse(publicFiles.get('package/manifest.json'));
  const localManifest = JSON.parse(builtFiles.get('package/manifest.json'));
  const withoutRevision = manifest => { const { sourceRevision, ...rest } = manifest; return rest; };
  const onlySourceRevisionDiffers = changedFiles.every(path => path === 'package/manifest.json')
    && JSON.stringify(withoutRevision(publicManifest)) === JSON.stringify(withoutRevision(localManifest));
  const releaseMatchesArchive = release.sha256 === sha256(archive) && release.bytes === archive.length;
  const releaseMatchesManifest = release.sourceRevision === publicManifest.sourceRevision
    && release.sourceTreeSha256 === publicManifest.sourceTreeSha256
    && JSON.stringify(release.package) === JSON.stringify(publicManifest.package);
  integrationPackage = {
    changedFilesFromLocalBuild: changedFiles, onlySourceRevisionDiffers,
    releaseMatchesArchive, releaseMatchesManifest,
    expectedCommit, sourceRevision: publicManifest.sourceRevision,
    sourceRevisionMatchesExpected: expectedCommit ? publicManifest.sourceRevision === expectedCommit : null,
    sourceTreeSha256: publicManifest.sourceTreeSha256,
    sourceTreeMatchesLocalBuild: publicManifest.sourceTreeSha256 === localManifest.sourceTreeSha256,
    release,
  };
} catch (error) { integrationPackage = { error: error.message }; }

const sourceDifferences = [];
for (const record of baseline.protectedSourceFiles) {
  try {
    const current = sha256(await readFile(resolve(root, record.path)));
    if (current !== record.sha256) sourceDifferences.push({ path: record.path, allowed: record.path === 'vite.config.js' });
  } catch (error) { sourceDifferences.push({ path: record.path, allowed: false, error: error.code || error.message }); }
}

const artifacts = [...records.values()].sort((a, b) => a.path.localeCompare(b.path));
const runtime = artifacts.filter(record => !special.has(record.path));
const existingRuntime = runtime.filter(record => baselineByPath.has(record.path));
const historicalArchive = records.get('integration-kit/annora-integration-kit-0.1.0.tgz');
const runtimeDifferences = runtime.filter(record => !record.exactLocalMatch && !record.knownPriorHtmlVariantToLocal);
const baselineDifferences = existingRuntime.filter(record => !record.exactBaselineMatch && !record.knownPriorHtmlVariantToBaseline);
const knownHtmlVariants = artifacts.filter(record => record.knownPriorHtmlVariantToLocal || record.knownPriorHtmlVariantToBaseline)
  .map(record => ({ path: record.path, evidence: priorReceiptPath, explanation: 'Exact hashes match the previously recorded W60 HTML link-order variant; document and link set also match.' }));
const packageVerified = integrationPackage.onlySourceRevisionDiffers && integrationPackage.releaseMatchesArchive
  && integrationPackage.releaseMatchesManifest && (!expectedCommit || integrationPackage.sourceRevisionMatchesExpected);
const summary = {
  status: runtimeDifferences.length === 0 && baselineDifferences.length === 0 && packageVerified
    && sourceDifferences.every(record => record.allowed) ? 'passed' : 'needs-review',
  artifactsChecked: artifacts.length,
  exactLocalMatches: artifacts.filter(record => record.exactLocalMatch).length,
  existingArtifactsComparedToBaseline: existingRuntime.length,
  exactBaselineMatches: existingRuntime.filter(record => record.exactBaselineMatch).length,
  runtimeDifferences: runtimeDifferences.map(record => record.path),
  existingRuntimeDifferencesFromBaseline: baselineDifferences.map(record => record.path),
  knownPriorHtmlVariants: knownHtmlVariants,
  historicalArchive010Unchanged: historicalArchive?.exactBaselineMatch === true,
  integrationPackageVerified: Boolean(packageVerified),
  unexpectedSourceChanges: sourceDifferences.filter(record => !record.allowed).map(record => record.path),
};
const result = {
  schemaVersion: 1, checkedAt: new Date().toISOString(), baseUrl: base.href,
  expectedCommit, baselineHead: baseline.baselineHead,
  priorPublishedApplicationCommit: baseline.publishedApplicationCommit,
  summary, integrationPackage, sourceDifferences, artifacts,
  limitations: ['HTTP and byte verification only; no UI execution or demo storage mutation.',
    'A source-only revision change in the integration package is accepted only when all other packaged bytes match and the published release hashes verify.',
    'Only the exact previously recorded W60 HTML link-order hashes are accepted, with matching normalized document and link set; other HTML changes require review.'],
};
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ output, ...summary }, null, 2));
if (summary.status !== 'passed') process.exitCode = 1;
