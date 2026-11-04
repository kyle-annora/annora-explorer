import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, BoxGeometry, Group, Mesh, MeshBasicMaterial, PerspectiveCamera, Raycaster, Vector2, Vector3 } from 'three';
import { createSurfaceCallout } from '../../src/explorer/orbital/surface-callout.js';

function fixture(width = 900, height = 540) {
  const rig = new Group(), joint = new Group();
  const target = new Mesh(new BoxGeometry(1.4, .45, .18), new MeshBasicMaterial());
  const cover = new Mesh(new BoxGeometry(1.7, .7, .15), new MeshBasicMaterial());
  target.name = 'rail'; cover.name = 'cover';
  joint.rotation.z = .3; joint.position.x = .1;
  joint.add(target); rig.add(joint, cover);
  cover.position.set(4, 0, 1);
  const camera = new PerspectiveCamera(32, width / height, .1, 10);
  camera.position.set(.4, .35, 4); camera.lookAt(0,0,0);
  camera.updateMatrixWorld();
  rig.updateMatrixWorld(true);
  const meshes = [target, cover];
  const partsByName = new Map(meshes.map(m => {
    const bounds = new Box3().setFromObject(m);
    return [m.name, { bounds: [bounds.min.toArray(), bounds.max.toArray()] }];
  }));
  const received = [], canvas = { clientWidth: width, clientHeight: height };
  const cue = createSurfaceCallout({ camera, canvas, meshes, partsByName, onPoint: p => received.push(p) });
  const anchor = { meshName: target.name, fraction: [.58, .53, .64] };
  cue.setTarget(anchor);
  function surfaceAt(point) {
    const ray = new Raycaster();
    ray.setFromCamera(new Vector2(point.x / width * 2 - 1, 1 - point.y / height * 2), camera);
    return ray.intersectObjects(meshes.filter(m=>m.visible), false)[0]?.object;
  }
  return { rig, joint, target, cover, camera, cue, anchor, received, surfaceAt };
}

for (const [label, width, height] of [['desktop', 900, 540], ['phone', 390, 705]]) {
  test(`the ${label} leader follows a real surface under a joint transform and camera orbit`, () => {
    const { rig, joint, target, camera, cue, received, surfaceAt } = fixture(width, height);
    cue.update(); const first = received.at(-1);
    assert.equal(surfaceAt(first), target);
    joint.position.x += .15; joint.rotation.z += .22;
    rig.updateMatrixWorld(true); cue.invalidatePose(); cue.update();
    const moved = received.at(-1);
    assert.notDeepEqual(moved, first); assert.equal(surfaceAt(moved), target);
    camera.position.set(-.8,.8,3); camera.lookAt(0,0,0); camera.updateMatrixWorld(true);
    cue.update(); const turned = received.at(-1);
    assert.notDeepEqual(turned, moved); assert.equal(surfaceAt(turned), target);
    cue.update(true); assert.equal(received.at(-1), null);
    cue.update(); assert.deepEqual(received.at(-1), turned);
  });
}

test('an occluder erases the leader and an unmoving frame does no more raycasts or DOM work', () => {
  const { rig, target, cover, anchor, cue, received } = fixture();
  const raycast = target.raycast; let rays = 0;
  target.raycast = function(...args) { rays++; return raycast.apply(this, args); };
  cue.update(); const initial = received.at(-1);
  assert.ok(initial && rays > 0);
  const count = rays;
  assert.equal(cue.setTarget({ ...anchor, fraction: [...anchor.fraction] }), false);
  cue.update(); cue.update();
  assert.equal(rays, count); assert.equal(received.length, 1);
  cover.position.set(0,0,1); rig.updateMatrixWorld(true); cue.invalidatePose();
  cue.update(); assert.equal(received.at(-1), null);
  cover.visible = false; cue.invalidatePose(); cue.update();
  assert.deepEqual(received.at(-1), initial);
  cue.setTarget(null); cue.update();
  const cleared = received.length;
  const hiddenRays = rays;
  cue.invalidatePose(); cue.update(); cue.update();
  assert.equal(received.at(-1), null);
  assert.equal(received.length, cleared);
  assert.equal(rays, hiddenRays);
});

test('a different anchor can repopulate a new caption at the same screen pixel', () => {
  const { target, camera, cue, received } = fixture();
  const center = target.getWorldPosition(new Vector3());
  camera.position.copy(center); camera.position.z += 4;
  camera.lookAt(center); camera.updateMatrixWorld();
  for (const depth of [.55, .75]) {
    cue.setTarget({ meshName: target.name, fraction: [.5, .5, depth] });
    cue.update();
  }
  assert.equal(received.length, 2);
  assert.ok(received[0]);
  assert.deepEqual(received[0], received[1]);
});
