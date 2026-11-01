import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
globalThis.window = { matchMedia: () => ({ matches: false }) };
const { AssemblyScene } = await import('../../src/explorer/scene.js');

test('benchmark accepts a prepared package without optional source statistics', () => {
  let report;
  const scene = {
    ready: true, benchmark: { active: false, begin(value) { report = value; } }, mode: 'explore', renderStyle: 'engineering', metadata: {}, model: { id: 'generic-model' }, rootId: 'root', callbacks: {}, meshes: new Map(), nodes: new Map(), outline: {},
    setScope() {}, applyFraction() {}, emitOperation() {}, fit() {}, syncLinePresentation() {}, layoutRegion: () => ({ width: 800, height: 600 }),
    renderer: { getPixelRatio: () => 1, domElement: { width: 800, height: 600 } }, cameraMotion: { values: [0, 0, 10] }, controls: { enabled: true }, invalidate() {},
  };
  AssemblyScene.prototype.startBenchmark.call(scene);
  assert.equal(report.modelId, 'generic-model'); assert.equal(report.modelStats.edgeBytes, 0); assert.equal(scene.controls.enabled, false); assert.deepEqual(scene.benchmarkBase, [0, 0, 10]);
});

function selectionFixture(renderStyle, { authored = true } = {}) {
  let report;
  const selected = [];
  const mesh = name => {
    const object = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()); object.name = name;
    object.userData = { visibility: { to() {} }, baseOpacity: 1, baseTransparent: false, baseDepthWrite: true };
    return object;
  };
  const a = mesh('A'), b = mesh('B');
  const scene = {
    ready: true, renderStyle, mode: 'explore', rootId: 'root', scopeId: 'root', selectedId: 'root',
    metadata: {}, model: { id: 'fixture' }, lineAccent: '#ff6840',
    operationConfig: authored ? { stages: [{ nodeId: 'drive' }] } : {},
    operationPlayer: { state: () => ({ stage: null }) },
    nodes: new Map([
      ['root', { id: 'root', type: 'assembly', meshNames: ['A', 'B'] }],
      ['frame', { id: 'frame', type: 'assembly', meshNames: ['B'] }],
      ['drive', { id: 'drive', type: 'assembly', meshNames: ['A'] }]
    ]),
    meshes: new Map([['A', a], ['B', b]]), active: [a, b],
    outline: { selectedObjects: [], visibleEdgeColor: new THREE.Color(), hiddenEdgeColor: new THREE.Color(0) },
    benchmark: { active: false, begin(value) { report = value; } },
    callbacks: { benchmarkSelection: id => selected.push(id) },
    setScope(id) { this.scopeId = id; this.selectedId = id; }, applyFraction() {}, emitOperation() {}, fit() {},
    refreshOutline: AssemblyScene.prototype.refreshOutline,
    syncLinePresentation() { this.lineState = { filled: new Set(renderStyle === 'flat' ? this.outline.selectedObjects.map(object => object.name) : []) }; },
    layoutRegion: () => ({ width: 800, height: 600 }),
    renderer: { getPixelRatio: () => 1, domElement: { width: 800, height: 600 } },
    cameraMotion: { values: [0, 0, 10] }, controls: { enabled: true }, invalidate() {}
  };
  return { scene, selected, report: () => report, dispose() { for (const object of [a, b]) { object.geometry.dispose(); object.material.dispose(); } } };
}

test('engineering and flat benchmarks include a representative selection and report its rendered part count', () => {
  for (const renderStyle of ['engineering', 'flat']) {
    const run = selectionFixture(renderStyle);
    try {
      AssemblyScene.prototype.startBenchmark.call(run.scene);
      assert.equal(run.scene.selectedId, 'drive');
      assert.equal(run.scene.scopeId, 'root', 'the measured scope remains the complete assembly');
      assert.deepEqual(run.selected, ['drive']);
      assert.deepEqual(run.scene.outline.selectedObjects.map(object => object.name), ['A']);
      assert.equal(run.scene.outline.visibleEdgeColor.getHex(THREE.LinearSRGBColorSpace), 0xff6840);
      assert.equal(run.report().modelStats.selectedPartCount, 1);
      assert.equal(run.report().modelStats.flatPartCount, renderStyle === 'flat' ? 1 : 0);
      for (const object of run.scene.active) {
        assert.equal(object.material.opacity, 1); assert.equal(object.material.depthWrite, true);
        assert.equal(object.material.transparent, false);
      }
    } finally { run.dispose(); }
  }
});

test('engineering benchmark without motion metadata selects the first inspectable group', () => {
  const run = selectionFixture('engineering', { authored: false });
  try {
    AssemblyScene.prototype.startBenchmark.call(run.scene);
    assert.equal(run.scene.selectedId, 'frame');
    assert.deepEqual(run.scene.outline.selectedObjects.map(object => object.name), ['B']);
    assert.equal(run.report().modelStats.selectedPartCount, 1);
  } finally { run.dispose(); }
});

test('plain linework benchmark remains unselected and records no flat fill', () => {
  const run = selectionFixture('linework');
  try {
    AssemblyScene.prototype.startBenchmark.call(run.scene);
    assert.equal(run.scene.selectedId, 'root');
    assert.deepEqual(run.scene.outline.selectedObjects, []);
    assert.equal(run.report().modelStats.selectedPartCount, 0);
    assert.equal(run.report().modelStats.flatPartCount, 0);
  } finally { run.dispose(); }
});
