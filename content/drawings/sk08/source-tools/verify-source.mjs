import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const base = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const sourceStep = await readFile(resolve(base, 'sk08.step'));
assert.equal(hash(sourceStep), 'bb89218f5cd90ce713b08359d4d719f4297483039ef55d2abb33eb5af65d9cd5');
assert.equal(hash(await readFile(resolve(base, 'source.pdf'))), 'db5468501a8a7c61b840db481786161313b0befbcbd31fe1c910054033a73ca2');
const text = sourceStep.toString('utf8');
assert.match(text, /#7 = PRODUCT\('SK08','SK08'/);
assert.match(text, /#15 = MANIFOLD_SOLID_BREP/);
assert.match(text, /SI_UNIT\(\.MILLI\.,\.METRE\.\)/);
const pkg = JSON.parse(await readFile(resolve(base, 'package.json'), 'utf8'));
for (const asset of pkg.assets) assert.equal(hash(await readFile(resolve(base, asset.file))), asset.sha256, asset.file);
const model = resolve(base, '../../models/sk08');
const provenance = JSON.parse(await readFile(resolve(base, 'provenance.json'), 'utf8'));
assert.equal(hash(await readFile(resolve(model, 'model.glb'))), provenance.adaptations.model.modelSha256);
const { MODEL_CATALOG } = await import(new URL('../../../../src/generated/catalog.js', import.meta.url));
assert.equal(pkg.modelRevision, MODEL_CATALOG.sk08.revision);
const meta = JSON.parse(await readFile(resolve(model, 'metadata.json'), 'utf8'));
assert.deepEqual(meta.parts.map(part => part.id), ['sk08-body']);
const { releaseDiagnostic } = await import(new URL('../../../../src/drawings/package.js', import.meta.url));
const diagnostic = releaseDiagnostic(pkg, { partIds: meta.parts.map(part => part.id), modelRevision: pkg.modelRevision });
assert.equal(diagnostic.valid, true, JSON.stringify(diagnostic.issues));
console.log(JSON.stringify({ valid: true, modelId: pkg.modelId, sheets: pkg.sheets.length,
  regions: pkg.sheets.reduce((count, sheet) => count + sheet.regions.length, 0),
  warning: 'Unreviewed reference; no manufacturer approval or revision supplied.' }, null, 2));
