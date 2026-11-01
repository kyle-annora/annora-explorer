import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const base = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const model = resolve(base, '../../models/linkrods');
const readJSON = async path => JSON.parse(await readFile(path, 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const [drawing, provenance, report, metadata] = await Promise.all([
  readJSON(resolve(base, 'drawing.json')),
  readJSON(resolve(base, 'provenance.json')),
  readJSON(resolve(model, 'preparation-report.json')),
  readJSON(resolve(model, 'metadata.json')),
]);
const stepBytes = await readFile(resolve(base, 'linkrods.step'));
const pdfBytes = await readFile(resolve(base, 'sheet.pdf'));
const svgBytes = await readFile(resolve(base, 'sheet.svg'));
assert.equal(hash(stepBytes), '3674e4b01ee0e983c81ed170f0574cda201ad08e0f7b46e05e4f4613400fd5f7');
assert.equal(hash(pdfBytes), '20799c4c0107c3cc7998f7c56c014b91533b83b413e85954710801a6bc0e7c08');
assert.equal(hash(stepBytes), drawing.stepSha256);
assert.equal(hash(pdfBytes), drawing.assetRevision);
assert.equal(hash(svgBytes), provenance.derivedSVGHash);
assert.equal(pdfBytes.subarray(0, 5).toString(), '%PDF-');
const step = stepBytes.toString();
assert.equal((step.match(/MANIFOLD_SOLID_BREP\(/g) || []).length, 1);
assert.equal((step.match(/ADVANCED_FACE\(/g) || []).length, 37);
assert.ok(step.includes('SI_UNIT(.MILLI.,.METRE.)'));
assert.ok(step.includes("CYLINDRICAL_SURFACE('',#7503,0.517234284238)"));
assert.ok(step.includes("CYLINDRICAL_SURFACE('',#3593,0.219923711459)"));
assert.equal(provenance.sourceDimensionChecks.largeBoreDiameterMm, 2 * 0.517234284238);
assert.equal(provenance.sourceDimensionChecks.smallBoreDiameterMm, 2 * 0.219923711459);
assert.equal(drawing.manufacturerRevision, null);
assert.equal(drawing.status, 'unreviewed-reference');
assert.equal(drawing.revision, 'source-c4c72a71');
assert.equal(report.counts.meshes, 1);
assert.equal(report.counts.triangles, 15242);
assert.equal(report.operation, null);
assert.equal(report.tour, null);
for (const [name, asset] of Object.entries(report.assets)) {
  const bytes = await readFile(resolve(model, name));
  assert.equal(bytes.length, asset.bytes, name);
  assert.equal(hash(bytes), asset.sha256, name);
}
const svg = svgBytes.toString();
assert.ok(!/<(?:script|foreignObject|image)\b/i.test(svg), 'Vector sheet must not contain script, HTML or bitmap elements.');
assert.ok(!/(?:href|xlink:href)="(?!#)/i.test(svg), 'Vector sheet must not reference external resources.');
const partIds = new Set(metadata.parts.map(part => part.id));
for (const sheet of drawing.sheets) {
  const [, , width, height] = sheet.viewBox;
  for (const region of sheet.regions) {
    const [x, y, w, h] = region.bounds;
    assert.ok(x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= width && y + h <= height, region.id);
    assert.ok(partIds.has(region.partId), `Missing real part for ${region.id}`);
    assert.equal(region.focusPoint.length, 3);
    assert.ok(region.focusPoint.every(Number.isFinite));
  }
}
console.log('Verified unchanged STEP/PDF hashes, matching source dimensions, 1 real solid, 4 valid drawing regions and prepared model integrity.');
