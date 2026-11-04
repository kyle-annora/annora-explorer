import { Box3, MathUtils, Matrix4, Raycaster, Vector3 } from 'three';

const center = [.5, .5, .5];
// An assembly-space bounding box may enclose air (e.g. a ring or bracket).
// Only try nearby anchors when the ray misses the target geometry. A nearer
// occluder hides an established leader instead of making it hop to another face.
const offsets = [[0,0,0], [.16,0,0], [-.16,0,0], [0,.16,0], [0,-.16,0], [0,0,.16], [0,0,-.16]];

function visible(mesh) {
  for (let node = mesh; node; node = node.parent) if (!node.visible) return false;
  return mesh.material.visible && mesh.material.opacity > 0;
}

export function createSurfaceCallout({ camera, canvas, meshes, partsByName, onPoint }) {
  const records = new Map();
  for (const mesh of meshes) {
    const part = partsByName.get(mesh.name);
    if (!part) continue;
    mesh.updateWorldMatrix(true, false);
    records.set(mesh.name, { mesh, part, restInverse: mesh.matrixWorld.clone().invert(), box: new Box3() });
  }
  const ray = new Raycaster(), eye = new Vector3(), aim = new Vector3(), point = new Vector3(), boxHit = new Vector3();
  const view = new Matrix4(), projection = new Matrix4(), hits = [];
  const local = offsets.map(() => new Vector3());
  let target = null, fx, fy, fz, preferred = 0;
  let dirty = true, poseChanged = true, width = 0, height = 0, lastX = null, lastY = null;

  function setTarget(anchor) {
    const next = records.get(anchor?.meshName) ?? null;
    const [x, y, z] = anchor?.fraction ?? center;
    if (next === target && x === fx && y === fy && z === fz) return false;
    target = next; fx = x; fy = y; fz = z; preferred = 0; dirty = true;
    // The caption may have replaced its DOM path, even if the new part happens
    // to project to the previous point. Publish its first result afresh.
    lastX = lastY = undefined;
    if (target) {
      const [min, max] = target.part.bounds;
      for (let i = 0; i < offsets.length; i++) {
        const [dx, dy, dz] = offsets[i];
        local[i].set(
          MathUtils.lerp(min[0], max[0], MathUtils.clamp(x + dx, 0, 1)),
          MathUtils.lerp(min[1], max[1], MathUtils.clamp(y + dy, 0, 1)),
          MathUtils.lerp(min[2], max[2], MathUtils.clamp(z + dz, 0, 1)),
        ).applyMatrix4(target.restInverse);
      }
    }
    return true;
  }

  function hide() {
    if (lastX === null) return;
    lastX = lastY = null;
    onPoint(null);
  }

  function refreshBoxes() {
    for (const record of records.values()) {
      if (!visible(record.mesh)) { record.box.makeEmpty(); continue; }
      const mesh = record.mesh;
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      record.box.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld);
    }
    poseChanged = false;
  }

  function obstructed(distance) {
    const epsilon = distance * 1e-6;
    ray.far = distance - epsilon;
    for (const record of records.values()) {
      if (record === target || record.box.isEmpty()) continue;
      if (!ray.ray.intersectBox(record.box, boxHit)) continue;
      if (!record.box.containsPoint(eye) && eye.distanceTo(boxHit) > ray.far) continue;
      hits.length = 0;
      record.mesh.raycast(ray, hits);
      if (hits.length) return true;
    }
    return false;
  }

  function project(index) {
    aim.copy(local[index]).applyMatrix4(target.mesh.matrixWorld);
    point.copy(aim).project(camera);
    if (Math.abs(point.x) > 1 || Math.abs(point.y) > 1 || Math.abs(point.z) > 1) return 'miss';
    ray.set(eye, aim.sub(eye).normalize());
    ray.far = Infinity;
    hits.length = 0;
    target.mesh.raycast(ray, hits);
    if (!hits.length) return 'miss';
    let nearest = hits[0];
    for (const hit of hits) if (hit.distance < nearest.distance) nearest = hit;
    point.copy(nearest.point).project(camera);
    if (Math.abs(point.z) > 1 || obstructed(nearest.distance)) return 'hidden';

    // Emit canvas-local CSS pixels. Quarter-pixel precision avoids touching the
    // DOM again for jitter smaller than the stroke width.
    const x = Math.round((point.x + 1) * width * 2) / 4;
    const y = Math.round((1 - point.y) * height * 2) / 4;
    if (x !== lastX || y !== lastY) {
      lastX = x; lastY = y;
      onPoint({ x, y });
    }
    return 'visible';
  }

  function update(suppressed = false) {
    if (suppressed || !target || !canvas.clientWidth || !canvas.clientHeight) {
      dirty = true; hide(); return;
    }
    if (!dirty && !poseChanged && width === canvas.clientWidth && height === canvas.clientHeight &&
        view.equals(camera.matrixWorld) && projection.equals(camera.projectionMatrix)) return;
    width = canvas.clientWidth; height = canvas.clientHeight;
    view.copy(camera.matrixWorld); projection.copy(camera.projectionMatrix);
    dirty = false;
    if (!visible(target.mesh)) { hide(); return; }
    if (poseChanged) refreshBoxes();
    eye.setFromMatrixPosition(camera.matrixWorld);
    for (let step = 0; step < local.length; step++) {
      const index = (preferred + step) % local.length;
      const result = project(index);
      if (result === 'miss') continue;
      if (result === 'visible') { preferred = index; return; }
      break;
    }
    hide();
  }
  return { setTarget, update, invalidatePose() { poseChanged = true; }, hide };
}
