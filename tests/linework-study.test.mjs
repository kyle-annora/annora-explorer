import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createAssemblyLinework } from '../src/explorer/assembly-linework.js';
import { buildContourSegments, packContourSegments } from '../src/explorer/assembly-linework-data.js';
import { renderPixelRatio } from '../src/explorer/performance.js';
import { groupTreatment, studyPartRole, studySampling, studyVariant } from '../src/linework-study/study-policy.js';
import { prepareStudyLinework } from '../src/linework-study/study-linework.js';

test('the four choices isolate sampling and density at each camera size', () => {
  for (const [width, height, devicePixelRatio] of [[2134, 1224, 2], [1280, 720, 1], [390, 844, 3], [844, 390, 2]]) {
    const viewport = { width, height, devicePixelRatio, quality: 'balanced', supportedSamples: [2, 4] };
    const sampling = variant => studySampling({ ...viewport, variant });
    const baseline = sampling('baseline'), sharper = sampling('clarity');
    assert.deepEqual(baseline, { pixelRatio: renderPixelRatio({ ...viewport, renderStyle: 'linework' }), samples: 0 });
    assert.deepEqual(sampling('density'), baseline);
    assert.deepEqual(sampling('combined'), sharper);
    assert.ok(sharper.pixelRatio >= baseline.pixelRatio);
    assert.ok(sharper.pixelRatio > baseline.pixelRatio || sharper.samples > 0);
  }
  assert.equal(studyVariant('baseline').density, false);
  assert.equal(studyVariant('clarity').density, false);
  assert.equal(studyVariant('density').density, true);
  assert.equal(studyVariant('combined').density, true);
  assert.throws(() => studyVariant('unreviewed'));
  assert.throws(() => studyVariant('__proto__'));
});

test('high-resolution review remains bounded and falls back when multisampling is unsupported', () => {
  for (const [width, height, quality, pixels, allocation] of [
    [2134, 1224, 'balanced', 4_000_000, 8_000_000],
    [390, 844, 'balanced', 2_000_000, 4_000_000],
    [1920, 1080, 'performance', 1_600_000, 3_200_000],
  ]) {
    for (const supportedSamples of [[], [2, 4], [4]]) {
      const result = studySampling({ variant: 'combined', width, height, quality, devicePixelRatio: 3, supportedSamples });
      const renderArea = width * height * result.pixelRatio ** 2;
      assert.ok(renderArea <= pixels + 1);
      assert.ok(renderArea * Math.max(1, result.samples) <= allocation + 1);
      assert.ok(result.samples === 0 || supportedSamples.includes(result.samples));
    }
  }
});

test('tessellating a large closed hole more finely preserves its scale and priority', () => {
  const closed = { span: 0.8, partSpan: 2, segmentCount: 12, closed: true, role: 'structural', contour: false };
  const low = groupTreatment(closed);
  assert.deepEqual(groupTreatment({ ...closed, segmentCount: 288 }), low);
  const dense = groupTreatment({ ...closed, role: 'electronics', closed: false, segmentCount: 288 });
  assert.ok(low.effectiveSpan > dense.effectiveSpan && low.floor > dense.floor);
  assert.equal(studyPartRole('Hex_leg_1_coxa_motor_1_surface2'), 'motor');
  assert.equal(studyPartRole('Hex_electronics_1_surface2'), 'electronics');
  assert.equal(studyPartRole('Hex_leg_1_tibia_1'), 'structural');
});

// A cylindrical wall has two disconnected circular rims. Rendering the same
// shape at different tessellations catches segment-level density regressions.
async function prepareRims(t, segments) {
  const geometry = new THREE.CylinderGeometry(1, 1, 0.2, segments);
  const authoredMesh = new THREE.Mesh(geometry);
  authoredMesh.name = 'test-rim';
  const creases = new THREE.EdgesGeometry(geometry, 32);
  const positions = creases.attributes.position.array;
  const creaseRecord = { byteOffset: 0, vertexCount: positions.length / 3, segmentCount: positions.length / 6, geometryId: 0 };
  const edgeMetadata = { meshes: { 'test-rim': creaseRecord }, geometries: [{ bounds: [[-1, -0.1, -1], [1, 0.1, 1]] }] };
  const contours = buildContourSegments(geometry);
  const contourRecord = { byteOffset: 0, segmentCount: contours.length / 12 };
  const production = await createAssemblyLinework({
    meshes: [authoredMesh], camera: new THREE.PerspectiveCamera(), edgeMetadata,
    edgeBuffer: positions.buffer.slice(positions.byteOffset, positions.byteOffset + positions.byteLength),
    silhouetteMetadata: { contours: { format: 'uint32-oct16-le', bytesPerSegment: 16 }, meshes: { 'test-rim': contourRecord } },
    silhouetteBuffer: packContourSegments(geometry, contours),
  });
  const sourcePositions = geometry.attributes.position.array.slice();
  const { depthScene, lineScene } = production.pass;
  const depth = depthScene.children[0], depthGeometry = depth.geometry;
  const originalMaterials = lineScene.children.map(mesh => mesh.material);
  const study = await prepareStudyLinework(production, [authoredMesh], edgeMetadata);
  t.after(() => { study.dispose(); creases.dispose(); geometry.dispose(); authoredMesh.material.dispose(); });
  return { geometry, sourcePositions, study, depth, depthGeometry, lineScene, originalMaterials };
}

test('every segment of a complete rim receives one distance and fade treatment', async t => {
  for (const count of [24, 96]) {
    const { study, lineScene } = await prepareRims(t, count);
    assert.equal(study.stats.featureGroups, 2);
    const creases = lineScene.children.find(mesh => mesh.renderOrder === 1).geometry;
    const groups = creases.getAttribute('studyGroup'), floors = creases.getAttribute('studyFloor');
    assert.equal(groups.count, 2 * count);
    const top = new Set(), bottom = new Set();
    for (let i = 0; i < groups.count; i++) {
      const center = [groups.getX(i), groups.getY(i), groups.getZ(i)];
      const rim = center[1] > 0 ? top : bottom;
      rim.add([...center, groups.getW(i), floors.getX(i)].join(','));
      assert.ok(Math.abs(groups.getW(i) - Math.sqrt(8)) < 1e-5);
    }
    assert.equal(top.size, 1);
    assert.equal(bottom.size, 1);
  }
});

test('switching density restores the exact original strokes, depth occluder and source geometry', async t => {
  const { study, geometry, sourcePositions, depth, depthGeometry, lineScene, originalMaterials } = await prepareRims(t, 24);
  assert.deepEqual(lineScene.children.map(mesh => mesh.material), originalMaterials);
  study.setDensity(true);
  const edited = lineScene.children.map(mesh => mesh.material);
  for (let i = 0; i < edited.length; i++) {
    assert.notEqual(edited[i], originalMaterials[i]);
    assert.equal(edited[i].uniforms, originalMaterials[i].uniforms);
  }
  study.sync({ active: new Set(['test-rim']), displayOptions: { appearance: 'dark' } });
  assert.ok(edited.every(material => material.blendEquation === THREE.MaxEquation));
  study.sync({ active: new Set(['test-rim']), displayOptions: { appearance: 'light' } });
  assert.ok(edited.every(material => material.blendEquation === THREE.MinEquation));
  study.setDensity(false);
  assert.deepEqual(lineScene.children.map(mesh => mesh.material), originalMaterials);
  assert.equal(depth.geometry, depthGeometry);
  assert.equal(depth.material.depthWrite, true);
  assert.deepEqual(geometry.attributes.position.array, sourcePositions);
});
