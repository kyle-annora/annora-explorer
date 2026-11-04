import assert from 'node:assert/strict';
import test from 'node:test';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, PerspectiveCamera, Vector3 } from 'three';
import { applyScreenFrame, createPoseTransition, readScreenFrame } from '../../src/explorer/orbital/scene-continuity.js';

const near = (a, b) => assert.ok(Math.abs(a - b) < .00001, `${a} != ${b}`);

test('a new destination starts at the displayed joint, child position and partly visible guide', () => {
  const root = new Group(), joint = new Group(), tip = new Group(), locator = new Group();
  const mark = new Mesh(new BoxGeometry(), new MeshBasicMaterial({ opacity: .7, transparent: true, depthWrite: false }));
  root.add(joint, locator); joint.add(tip); locator.add(mark);
  tip.position.set(1, 0, 0);
  const pose = createPoseTransition(root, [mark]);
  const point = new Vector3();
  pose.capture();
  joint.rotation.z = Math.PI / 2; tip.position.x = 2; locator.visible = false;
  pose.target();
  near(tip.getWorldPosition(point).x, 1);
  pose.apply(.5);
  const interrupted = tip.getWorldPosition(point).clone();
  near(interrupted.x, Math.cos(Math.PI / 4) * 1.5);
  near(interrupted.y, Math.sin(Math.PI / 4) * 1.5);
  near(mark.material.opacity, .35);
  pose.capture();
  joint.rotation.z = 0; tip.position.x = 1; locator.visible = true;
  pose.target();
  near(interrupted.distanceTo(tip.getWorldPosition(point)), 0);
  near(mark.material.opacity, .35);
  pose.apply(1);
  near(tip.getWorldPosition(point).x, 1); near(point.y, 0);
  assert.equal(mark.material.opacity, .7);
  assert.equal(locator.visible, true);
  assert.equal(mark.material.depthWrite, false);
});

const project = (camera, point, rect) => {
  const p = point.clone().project(camera);
  return [rect.left + (1 + p.x) * rect.width / 2, rect.top + (1 - p.y) * rect.height / 2];
};
test('layout changes preserve pixels at the cut and on reversal before settling', () => {
  const camera = new PerspectiveCamera(26, 1, .001, 7);
  camera.position.set(.2, .5, 1); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(true);
  const a = { left: 0, top: 55, width: 390, height: 695 };
  const b = { left: 0, top: 45, width: 390, height: 575 };
  const target = new Vector3(.07, .02, .05);
  camera.setViewOffset(a.width, a.height, 0, .02 * a.height, a.width, a.height);
  const first = project(camera, target, a), origin = readScreenFrame(camera, a);
  applyScreenFrame(camera, b, origin, 0, 0, b.height * .02);
  project(camera, target, b).forEach((px, i) => near(px, first[i]));
  applyScreenFrame(camera, b, origin, .48, 0, b.height * .02);
  const mid = project(camera, target, b), interrupted = readScreenFrame(camera, b);
  applyScreenFrame(camera, a, interrupted, 0, 0, a.height * .02);
  project(camera, target, a).forEach((px, i) => near(px, mid[i]));
  applyScreenFrame(camera, a, interrupted, 1, 0, a.height * .02);
  project(camera, target, a).forEach((px, i) => near(px, first[i]));
  assert.equal(camera.zoom, 1);
});
