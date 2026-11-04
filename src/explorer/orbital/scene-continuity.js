import { MathUtils, Quaternion, Vector3 } from 'three';

function transform() {
  return { position: new Vector3(), quaternion: new Quaternion(), scale: new Vector3() };
}

function sample(node, out) {
  out.position.copy(node.position);
  out.quaternion.copy(node.quaternion);
  out.scale.copy(node.scale);
}

function same(a, b) {
  return a.position.equals(b.position) && a.quaternion.equals(b.quaternion) && a.scale.equals(b.scale);
}

function visible(node) {
  for (let parent = node; parent; parent = parent.parent) if (!parent.visible) return false;
  return true;
}

// Sample local transforms throughout the hierarchy. A moving joint may be a
// Group even when all of its child meshes keep their authored local transform.
export function createPoseTransition(root, marks = []) {
  const parts = [];
  root.traverse(node => parts.push({ node, from: transform(), to: transform() }));
  // Marks belong to this presentation. Their geometry/materials are never
  // shared with another viewer. Their parent may own the visible flag.
  const marksState = marks.map(node => ({
    node, material: node.material, opacity: node.material.opacity,
    transparent: node.material.transparent, depthWrite: node.material.depthWrite,
    from: 0, to: 0, visible: false,
  }));
  const markParents = new Map();
  for (const mark of marks) {
    for (let p = mark.parent; p && p !== root && !p.isScene; p = p.parent) markParents.set(p, true);
  }
  let moving = [], active = false;

  function capture() {
    for (const { node, from } of parts) sample(node, from);
    for (const mark of marksState) {
      mark.from = visible(mark.node) ? mark.material.opacity : 0;
      mark.fromCount = mark.node.geometry?.instanceCount;
    }
    active = false;
  }

  function target() {
    moving = parts.filter(({ node, from, to }) => {
      sample(node, to);
      return !same(from, to);
    });
    for (const parent of markParents.keys()) markParents.set(parent, parent.visible);
    for (const mark of marksState) {
      mark.to = visible(mark.node) ? mark.opacity : 0;
      mark.visible = mark.node.visible;
      mark.toCount = mark.node.geometry?.instanceCount;
    }
    active = true;
    apply(0);
  }

  function apply(t) {
    if (!active) return;
    const done = t >= 1;
    for (const { node, from, to } of moving) {
      if (t <= 0 || done) {
        const pose = done ? to : from;
        node.position.copy(pose.position);
        node.quaternion.copy(pose.quaternion);
        node.scale.copy(pose.scale);
      } else {
        node.position.lerpVectors(from.position, to.position, t);
        node.quaternion.slerpQuaternions(from.quaternion, to.quaternion, t);
        node.scale.lerpVectors(from.scale, to.scale, t);
      }
      if (!node.matrixAutoUpdate) node.updateMatrix();
    }
    for (const [parent, shown] of markParents) parent.visible = done ? shown : true;
    for (const mark of marksState) {
      const { node, material } = mark;
      const opacity = MathUtils.lerp(mark.from, mark.to, t);
      const fading = !done && opacity > 0 && opacity < mark.opacity;
      material.opacity = done ? mark.opacity : opacity;
      material.depthWrite = fading ? false : mark.depthWrite;
      const transparent = fading || mark.transparent;
      if (material.transparent !== transparent) {
        material.transparent = transparent;
        material.needsUpdate = true;
      }
      node.visible = done ? mark.visible : opacity > 0;
      if (mark.toCount !== undefined) {
        node.geometry.instanceCount = !done && mark.to === 0 ? mark.fromCount : mark.toCount;
      }
    }
    root.updateMatrixWorld(true);
    active = !done;
  }
  return { capture, target, apply };
}

// Record the perspective projection in CSS pixels before a different header or
// dock changes the canvas rectangle. This also captures a mid-flight projection.
export function readScreenFrame(camera, rect) {
  const view = camera.view?.enabled ? camera.view : null;
  return {
    x: rect.left + rect.width / 2 - (view ? view.offsetX / view.width * rect.width : 0),
    y: rect.top + rect.height / 2 - (view ? view.offsetY / view.height * rect.height : 0),
    scale: rect.height * camera.zoom,
  };
}

// Restore the exact outgoing screen position at t=0, then compose the final
// scene around its own optical centre. Offsets are in the new canvas' pixels.
export function applyScreenFrame(camera, rect, origin, t, offsetX = 0, offsetY = 0) {
  const { width, height } = rect;
  if (!width || !height) return;
  const x = rect.left + width / 2, y = rect.top + height / 2;
  camera.zoom = MathUtils.lerp(origin.scale / height, 1, t);
  camera.setViewOffset(width, height,
    MathUtils.lerp(x - origin.x, offsetX, t), MathUtils.lerp(y - origin.y, offsetY, t),
    width, height);
}
