import { build } from 'vite';
import { readFile, writeFile, mkdir, copyFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {INTEGRATION_KIT_VERSION} from '../src/integration-kit/version.js';
import config from '../vite.integration.config.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const out = resolve(root, 'dist-integration'), directory = resolve(out, 'package');
await build({ ...config, configFile: false, root });
const manifest = JSON.parse(await readFile(resolve(directory, 'manifest.json'), 'utf8'));
const packageInfo = {
  name: '@annora/integration-kit', version: INTEGRATION_KIT_VERSION, type: 'module', license: 'MIT',
  description: 'Versioned, viewer-independent product-to-inquiry integration. Host-owned storage; no 3D assets.',
  engines: { node: '>=22.13.0' },
  exports: { '.': './kit.js', './style.css': './style.css', './demo-repository': './demo-repository.js', './walkthrough': './walkthrough.js', './manifest.json': './manifest.json' },
  peerDependencies: { react: '19.3.1', 'react-dom': '19.3.1' },
  sideEffects: ['*.css'],
  repository: { type: 'git', url: 'https://github.com/kyle-annora/annora-explorer.git' },
};
manifest.format = 'annora-integration-kit-v1';
manifest.package = { name: packageInfo.name, version: packageInfo.version };
manifest.protocolVersion = '1';
manifest.supportedViewerReferenceVersions = ['1'];
manifest.supportedModes = ['inquiry', 'selectedPart', 'capturedView', 'drawingDetail', 'story'];
manifest.rendererIncluded = false;
await writeFile(resolve(directory, 'package.json'), JSON.stringify(packageInfo, null, 2) + '\n');
await copyFile(resolve(root, 'docs/integration-kit.md'), resolve(directory, 'README.md'));
for (const name of ['integration-kit-api.md','integration-kit-acceptance.md','w60-integration-walkthrough-review.md','w60-integration-walkthrough-acceptance.md']) await copyFile(resolve(root, 'docs', name), resolve(directory, name));
await copyFile(resolve(root, 'LICENSE'), resolve(directory, 'LICENSE'));
await mkdir(resolve(directory, 'templates'), { recursive: true });
for (const name of await readdir(resolve(root, 'src/integration-kit/templates'))) await copyFile(resolve(root, 'src/integration-kit/templates', name), resolve(directory, 'templates', name));
await writeFile(resolve(directory, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
const packed = JSON.parse(execFileSync('npm', ['pack', '--json', '--pack-destination', out], { cwd: directory, encoding: 'utf8' }))[0];
const bytes = await readFile(resolve(out, packed.filename));
await writeFile(resolve(out, 'release.json'), JSON.stringify({ package: manifest.package, sourceRevision: manifest.sourceRevision,
  sourceTreeSha256: manifest.sourceTreeSha256, file: packed.filename, sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length,
  installation: `npm install ./${packed.filename} react@19.3.1 react-dom@19.3.1`, assetsIncluded: false }, null, 2) + '\n');
console.log(`Packed ${packed.filename}: ${bytes.length} bytes; no renderer or product assets.`);
