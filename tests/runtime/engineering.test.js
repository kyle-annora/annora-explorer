import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { FINISHES } from '../../src/explorer/appearance.js';
import { createEngineeringEnvironment, createEngineeringLights, createEngineeringMaterial, createPanelTexture } from '../../src/explorer/engineering.js';

test('engineering materials preserve opaque assembly depth and independent per-part highlight state', () => {
  const geometry = new THREE.BoxGeometry(), positions = geometry.attributes.position.array.slice();
  const before = JSON.stringify(FINISHES);
  for (const spec of Object.values(FINISHES)) {
    const material = createEngineeringMaterial(spec), peer = createEngineeringMaterial(spec);
    const mesh = new THREE.Mesh(geometry, material);
    assert.equal(material.isMeshStandardMaterial, true);
    assert.equal(material.color.getHexString(), spec.color.slice(1));
    assert.equal(material.metalness, spec.metalness);
    assert.equal(material.roughness, spec.roughness);
    assert.equal(material.transparent, false);
    assert.equal(material.opacity, 1);
    assert.equal(material.depthWrite, true);
    assert.equal(material.depthTest, true);
    assert.equal(material.side, THREE.DoubleSide);
    assert.equal(material.displacementMap, null, 'finish cannot change the source shape');
    assert.equal(material.alphaMap, null, 'finish cannot cut holes in occluders');
    assert.equal(mesh.geometry, geometry);
    material.emissive.set('#242424');
    material.opacity = .06;
    assert.equal(peer.emissive.getHex(), 0, 'hover must not bleed across parts sharing a finish');
    assert.equal(peer.opacity, 1);
    material.dispose(); peer.dispose();
  }
  assert.deepEqual(geometry.attributes.position.array, positions);
  assert.equal(JSON.stringify(FINISHES), before);
  geometry.dispose();
});

test('studio panel texture is compact, neutral, deterministic and softened at its boundary', () => {
  const first = createPanelTexture(), second = createPanelTexture();
  const { data, width, height } = first.image;
  assert.ok(width <= 128 && height <= 128, 'reflection shaping does not require a large downloaded texture');
  assert.deepEqual(data, second.image.data, 'panel reflections must not change between frames or reloads');
  assert.equal(first.colorSpace, THREE.NoColorSpace, 'panel intensities are linear data, not painted sRGB color');
  assert.equal(first.minFilter, THREE.LinearFilter);
  const center = (Math.floor(height / 2) * width + Math.floor(width / 2)) * 4;
  assert.ok(data[center] > data[0] * 10, 'boundary rolloff softens the studio reflection');
  for (let i = 0; i < data.length; i += 4) {
    assert.equal(data[i], data[i + 1]); assert.equal(data[i + 1], data[i + 2]);
    assert.equal(data[i + 3], 255);
  }
  first.dispose(); second.dispose();
});

for (const fails of [false, true]) test(`studio bake ${fails ? 'failure' : 'success'} releases temporary resources without taking ownership of the result`, t => {
  const counts = new Map(), resources = new Set();
  const output = new THREE.WebGLRenderTarget(1, 1);
  let outputDisposed = false;
  output.addEventListener('dispose', () => { outputDisposed = true; });
  const watch = resource => {
    if (resources.has(resource)) return;
    resources.add(resource); counts.set(resource, 0);
    resource.addEventListener('dispose', () => counts.set(resource, counts.get(resource) + 1));
  };
  const bake = t.mock.method(THREE.PMREMGenerator.prototype, 'fromScene', function(scene, sigma, near, far, options) {
    assert.ok(options.size <= 256, 'baked environment resolution stays bounded');
    assert.ok(near > 0 && far > near);
    assert.ok(scene.children.length <= 8, 'small one-time bake scene');
    for (const panel of scene.children) {
      assert.equal(panel.isMesh, true);
      assert.equal(panel.material.toneMapped, false, 'radiance stays linear during environment capture');
      assert.ok(panel.material.color.r > 1, 'reflection sources preserve HDR headroom');
      watch(panel.geometry); watch(panel.material); watch(panel.material.map);
    }
    if (fails) throw new Error('Bake unavailable');
    return output;
  });
  const dispose = t.mock.method(THREE.PMREMGenerator.prototype, 'dispose');
  const renderer = { compile() {} };
  if (fails) assert.throws(() => createEngineeringEnvironment(renderer), /Bake unavailable/);
  else assert.equal(createEngineeringEnvironment(renderer), output);
  assert.equal(bake.mock.callCount(), 1);
  assert.equal(dispose.mock.callCount(), 1);
  assert.ok(resources.size > 0);
  for (const count of counts.values()) assert.equal(count, 1, 'temporary GPU resource released once');
  assert.equal(outputDisposed, false, 'the Explorer owns the completed environment target');
  output.dispose();
});

test('supporting studio lights require no shadow maps or per-frame target updates', () => {
  const rig = createEngineeringLights();
  assert.ok(rig.children.length <= 4);
  assert.ok(rig.children.some(light => light.isHemisphereLight));
  for (const light of rig.children) {
    assert.equal(light.castShadow, false);
    assert.ok(Number.isFinite(light.intensity) && light.intensity > 0);
    assert.equal(light.color.r, light.color.g); assert.equal(light.color.g, light.color.b);
    if (light.isDirectionalLight) assert.deepEqual(light.target.position.toArray(), [0, 0, 0]);
  }
});
