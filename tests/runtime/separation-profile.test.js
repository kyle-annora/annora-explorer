import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildHierarchy, createOffsets, createSeparationProfiles, positionAt, separationProgress } from '../../src/explorer/model-state.js';
import { validatePackage } from '../../src/explorer/model-validation.js';
import { DampedMotion } from '../../src/explorer/motion.js';

globalThis.window = { matchMedia: () => ({ matches: false }) };
const { AssemblyScene } = await import('../../src/explorer/scene.js');

const content = () => ({
  root: { id: 'machine', title: 'Independent assembly' },
  groups: [
    { id: 'shell', title: 'Shell', meshNames: ['Cover', 'Bracket'], children: [{ id: 'mounts', title: 'Mounts', meshNames: ['Bracket'] }] },
    { id: 'core', title: 'Core', meshNames: ['Drive'] },
  ],
  parts: [
    { id: 'cover', group: 'shell', meshName: 'Cover', center: [2, 0, 0], explode: [0, 4, 0] },
    { id: 'bracket', group: 'shell', meshName: 'Bracket', center: [0, 0, 0], explode: [3, 0, 0] },
    { id: 'drive', group: 'core', meshName: 'Drive', center: [-2, 0, 0], explode: [-4, 0, 0] },
  ],
});
const policy = { explosion: { separationProfiles: { shell: [0, .4], core: [.35, 1] } } };
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} != ${expected}`);

test('an omitted or full-range profile preserves legacy positions at every fraction', () => {
  const base = [2, -3, 4], offset = [-.8, .2, 1.5];
  for (let n = -5; n <= 105; n++) {
    const fraction = n / 100, clamped = Math.max(0, Math.min(1, fraction));
    const expected = base.map((value, axis) => value + offset[axis] * clamped);
    assert.deepEqual(positionAt(base, offset, fraction), expected);
    assert.deepEqual(positionAt(base, offset, fraction, [0, 1]), expected);
  }
});

test('outer parts finish opening before late internals and reverse seeks retrace the exact same poses', () => {
  const metadata = content(), before = JSON.stringify(metadata), { nodes } = buildHierarchy(metadata);
  const offsets = createOffsets(metadata.parts, nodes, 'machine', 1, policy);
  const profiles = createSeparationProfiles(metadata.parts, nodes, 'machine', policy);
  const pose = fraction => metadata.parts.map(part => positionAt(part.center, offsets.get(part.meshName), fraction, profiles.get(part.meshName)));
  assert.deepEqual(pose(.2)[2], [-2, 0, 0], 'The late core stays assembled while the shell opens');
  assert.deepEqual(pose(.4)[0], [2, 4, 0], 'The shell is fully open before the final internal reveal');
  assert.ok(pose(.6)[2][0] < -2 && pose(.6)[2][0] > -6);
  const frames = Array.from({ length: 101 }, (_, n) => pose(n / 100));
  for (let n = 100; n >= 0; n--) assert.deepEqual(pose(n / 100), frames[n]);
  assert.deepEqual(pose(0), metadata.parts.map(part => part.center));
  assert.equal(JSON.stringify(metadata), before, 'Source records are immutable');
  near(separationProgress(.35, [.35, 1]), 0);
  near(separationProgress(1, [.35, 1]), 1);
});

test('the nearest authored part or subassembly wins over a broader parent timing', () => {
  const metadata = content(), { nodes } = buildHierarchy(metadata);
  const profiles = createSeparationProfiles(metadata.parts, nodes, 'machine', { explosion: { separationProfiles: {
    machine: [0, .9], shell: [0, .4], mounts: [.2, .7], cover: [.1, .6],
  } } });
  assert.deepEqual(profiles.get('Cover'), [.1, .6]);
  assert.deepEqual(profiles.get('Bracket'), [.2, .7]);
  assert.deepEqual(profiles.get('Drive'), [0, .9]);
  assert.ok(Object.isFrozen(profiles.get('Cover')));
});

test('inspecting a narrower assembly restores a complete responsive local separation range', () => {
  const metadata = content(), { nodes } = buildHierarchy(metadata);
  assert.equal(createSeparationProfiles(metadata.parts, nodes, 'core', policy).size, 0);
  assert.equal(createSeparationProfiles(metadata.parts, nodes, 'cover', policy).size, 0);
  const offsets = createOffsets(metadata.parts, nodes, 'core', 1, policy);
  for (const part of metadata.parts.filter(part => part.group !== 'core')) assert.deepEqual(offsets.get(part.meshName), [0, 0, 0]);
  const local = createSeparationProfiles(metadata.parts, nodes, 'core', policy);
  near(separationProgress(.1, local.get('Drive')), .1);
});

test('displayed manual poses and full transform restoration targets use the same staggered path', () => {
  const metadata = content(), { nodes } = buildHierarchy(metadata), scene = Object.create(AssemblyScene.prototype);
  Object.assign(scene, {
    metadata, nodes, scopeId: 'machine', meshes: new Map(), edges: new Map(), movingMeshes: new Set(),
    separationMotion: new DampedMotion([0]), callbacks: {}, invalidate() {},
    offsets: createOffsets(metadata.parts, nodes, 'machine', 1, policy),
    separationProfiles: createSeparationProfiles(metadata.parts, nodes, 'machine', policy),
  });
  for (const part of metadata.parts) {
    const mesh = new THREE.Object3D(); mesh.name = part.meshName; mesh.position.fromArray(part.center);
    mesh.userData = { base: [...part.center], baseQuaternion: new THREE.Quaternion(), baseScale: new THREE.Vector3(1, 1, 1), pose: new DampedMotion(part.center) };
    scene.meshes.set(mesh.name, mesh);
    scene.edges.set(mesh.name, new THREE.Object3D());
  }
  for (const fraction of [.2, .65, .1, 1, 0]) {
    scene.applyFraction(fraction);
    const targets = scene.restTargets(fraction);
    for (const [name, mesh] of scene.meshes) {
      assert.deepEqual(mesh.position.toArray(), targets.get(name).position.toArray());
      assert.deepEqual(scene.edges.get(name).position.toArray(), mesh.position.toArray());
    }
  }
  for (const part of metadata.parts) assert.deepEqual(scene.meshes.get(part.meshName).position.toArray(), part.center);
});

test('malformed or dangling separation profiles fail before the renderer is created', () => {
  const metadata = content(), model = { rootId: 'machine', presentationPolicy: policy };
  assert.equal(validatePackage(metadata, model), true);
  for (const profiles of [null, [], 'early', { unknown: [0, 1] }, { shell: [0, 0] }, { shell: [.8, .2] },
    { shell: [-.1, 1] }, { shell: [0, 1.1] }, { shell: [0, NaN] }, { shell: [0, Infinity] }, { shell: [0, '1'] }, { shell: [0, .5, 1] }]) {
    assert.throws(() => validatePackage(metadata, { ...model, presentationPolicy: { explosion: { separationProfiles: profiles } } }), /separationProfiles/);
  }
});
