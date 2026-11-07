import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { normalizeViewerSnapshot, resolveFixtureParts, assertNotAborted, VIEWER_CAPABILITIES } from '../../examples/existing-viewer/viewer-state.js';

const fixture = JSON.parse(fs.readFileSync(new URL('../../examples/existing-viewer/public/fixture.json', import.meta.url)));
function snapshot(overrides = {}) {
  return {
    schemaVersion: 1, modelId: fixture.modelId, modelRevision: fixture.modelRevision,
    coordinateFrame: fixture.coordinateFrame, selectedPartId: 'kinetic-node-001',
    camera: { position: [0.2, 0.3, 0.4], target: [0, 0.05, 0], up: [0, 1, 0], projection: { fov: 35, zoom: 1, near: 0.0001, far: 20 } },
    ...overrides,
  };
}

test('independent fixture preserves exact original model, source provenance, license and every stable part ID', () => {
  const model = fs.readFileSync(new URL('../../content/models/kinetic-01/model.glb', import.meta.url));
  assert.equal(crypto.createHash('sha256').update(model).digest('hex'), fixture.source.sha256);
  assert.equal(model.length, fixture.stats.bytes);
  const metadata = JSON.parse(fs.readFileSync(new URL('../../content/models/kinetic-01/metadata.json', import.meta.url)));
  assert.deepEqual(fixture.parts.map(p => [p.id, p.meshName, p.sourceNodeIndex, p.sourcePath]), metadata.parts.map(p => [p.id, p.meshName, p.sourceNodeIndex, p.sourcePath]));
  assert.equal(fixture.source.license, 'MIT');
  const license = fs.readFileSync(new URL('../../examples/existing-viewer/public/MODEL-LICENSE.txt', import.meta.url));
  assert.equal(crypto.createHash('sha256').update(license).digest('hex'), fixture.source.licenseSha256);
  assert.equal(VIEWER_CAPABILITIES.drawingDetail, false);
  assert.equal(VIEWER_CAPABILITIES.story, false);
});

test('the independent camera snapshot roundtrips without Annora normalized coordinates or object handles', () => {
  const original = snapshot();
  const result = normalizeViewerSnapshot(JSON.parse(JSON.stringify(original)), fixture);
  assert.deepEqual(result, original);
  result.camera.position[0] = 7;
  assert.equal(original.camera.position[0], 0.2);
  assert.equal(normalizeViewerSnapshot(snapshot({ selectedPartId: null }), fixture).selectedPartId, null);
});

test('restore rejects old model identity, unavailable components and unknown coordinate systems', () => {
  for (const invalid of [
    { schemaVersion: 2 }, { modelRevision: 'newest' }, { modelId: 'another-product' },
    { coordinateFrame: 'normalized-assembly-v1' }, { selectedPartId: 'missing-part' }, { selectedPartId: undefined },
  ]) assert.throws(() => normalizeViewerSnapshot(snapshot(invalid), fixture));
});

test('restore rejects non-finite cameras and degenerate orientation before touching any renderer', () => {
  const samples = [];
  for (const field of ['position', 'target', 'up']) {
    const value = snapshot(); value.camera[field][0] = Infinity; samples.push(value);
  }
  for (const change of [{ fov: 0 }, { near: -1 }, { zoom: NaN }, { far: 0.00001 }]) {
    const value = snapshot(); Object.assign(value.camera.projection, change); samples.push(value);
  }
  const samePoint = snapshot(); samePoint.camera.position = [...samePoint.camera.target]; samples.push(samePoint);
  const parallelUp = snapshot(); parallelUp.camera.position = [0, 1, 0]; parallelUp.camera.target = [0, 0, 0]; samples.push(parallelUp);
  for (const value of samples) assert.throws(() => normalizeViewerSnapshot(value, fixture));
});

test('selection mapping refuses partial or duplicate mesh identities instead of silently relabelling parts', () => {
  const meshes = fixture.parts.map(part => ({ name: part.meshName }));
  const mapping = resolveFixtureParts(fixture, meshes);
  assert.equal(mapping.size, 107);
  assert.equal(mapping.get('kinetic-node-001').part.title, 'Connecting rod');
  assert.throws(() => resolveFixtureParts(fixture, meshes.slice(1)));
  assert.throws(() => resolveFixtureParts(fixture, [...meshes, { name: 'unreviewed-component' }]));
  assert.throws(() => resolveFixtureParts({ ...fixture, parts: [...fixture.parts, fixture.parts[0]] }, meshes));
});

test('the public Three loader resolves every fixture part against the real pinned GLB', async () => {
  const source = fs.readFileSync(new URL('../../content/models/kinetic-01/model.glb', import.meta.url));
  const gltf = await new GLTFLoader().parseAsync(source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength), '');
  const meshes = [];
  gltf.scene.traverse(node => { if (node.isMesh) meshes.push(node); });
  assert.equal(resolveFixtureParts(fixture, meshes).size, 107);
  assert.equal(meshes.reduce((sum, mesh) => sum + (mesh.geometry.index?.count || mesh.geometry.attributes.position.count) / 3, 0), fixture.stats.triangles);
  for (const mesh of meshes) { mesh.geometry.dispose(); mesh.material.dispose(); }
});

test('cancellation reports AbortError and independent viewer imports no application internals', () => {
  const cancelled = new AbortController(); cancelled.abort();
  assert.throws(() => assertNotAborted(cancelled.signal), { name: 'AbortError' });
  assert.doesNotThrow(() => assertNotAborted());
  const source = fs.readFileSync(new URL('../../examples/existing-viewer/viewer.js', import.meta.url), 'utf8');
  assert.equal(/src\/explorer|embed-client|iframe|src\/generated/.test(source.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '')), false);
});
