import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LEG_POSES, currentLegPhase } from './leg-poses.js';

const graphite = 0x636965, ember = 0xd9542e;
// The arc runs below the first leg, in its radial / vertical plane. It is a
// row of pose bookmarks, deliberately offset from the physical toe trace.
function onArc(t) {
  const angle = THREE.MathUtils.degToRad(200 + t * 132);
  const radial = .100 * Math.cos(angle) * Math.SQRT1_2;
  return new THREE.Vector3(.141 + radial, .062 + .071 * Math.sin(angle), -.116 - radial);
}
export const poseFramePoints = [0, .25, .5, .75, 1].map(onArc);

export function createLegMotionOrbit({ camera, canvas, onPoseHover }) {
  const root = new THREE.Group();
  root.name = 'First leg · motion stops';
  const lineMaterial = new LineMaterial({ color: graphite, linewidth: 1.15, transparent: true,
    depthTest: true, depthWrite: false, toneMapped: false });
  const points = Array.from({ length: 49 }, (_, index) => onArc(index / 48));
  const line = new Line2(new LineGeometry().setPositions(points.flatMap(point => point.toArray())), lineMaterial);
  line.renderOrder = 2;
  root.add(line);
  const sphere = new THREE.SphereGeometry(.00265, 16, 10);
  const nodes = LEG_POSES.map(({ id }, i) => {
    const material = new THREE.MeshBasicMaterial({ transparent: true, depthTest: true, depthWrite: false, toneMapped: false });
    const bead = new THREE.Mesh(sphere, material);
    bead.name = 'Pose · ' + id;
    bead.position.copy(onArc([.04, .51, .96][i]));
    bead.renderOrder = 3;
    root.add(bead);
    return { id, bead };
  });
  let enabled = false, alpha = 0, pickable = false, focusId = null, hoverId = null, activeId = null;
  let blockers = [];
  const ray = new THREE.Raycaster(), projected = new THREE.Vector3(), direction = new THREE.Vector3();
  const hits = [];
  root.visible = false;

  function paint() {
    root.visible = alpha > 0;
    lineMaterial.opacity = alpha * .79;
    for (const { id, bead } of nodes) {
      const active = id === activeId;
      const emphasis = id === hoverId || id === focusId;
      bead.material.color.set(active ? ember : emphasis ? 0x292f2d : graphite);
      bead.scale.setScalar(emphasis ? 1.8 : active ? 1.29 : 1);
      bead.material.opacity = alpha;
    }
  }
  function setFocus(id) {
    if (id === focusId) return false;
    focusId = id; paint(); return true;
  }
  function setHover(id) {
    if (id === hoverId) return false;
    hoverId = id; paint(); onPoseHover?.(id); return true;
  }
  function setProgress(value) {
    const id = currentLegPhase(value).id;
    if (activeId !== id) { activeId = id; paint(); }
  }
  function setEnabled(next, immediate) {
    enabled = next; pickable = false; focusId = null; setHover(null);
    if (immediate) alpha = Number(next);
    paint();
  }
  function update(dt, settling) {
    if (alpha !== Number(enabled)) {
      alpha = THREE.MathUtils.clamp(alpha + (enabled ? 1 : -1) * dt / .22, 0, 1);
      paint();
    }
    pickable = enabled && !settling && alpha === 1;
  }

  // Visible nodes have a larger input target than their ink. Test against the
  // live joint transforms only on an input event, never once per animation frame.
  function occluded(point) {
    ray.set(camera.position, direction.copy(point).sub(camera.position).normalize());
    ray.near = camera.near; ray.far = camera.position.distanceTo(point) - .001;
    hits.length = 0;
    for (const mesh of blockers) {
      if (!mesh.visible) continue;
      mesh.updateWorldMatrix(true, false);
      mesh.raycast(ray, hits);
      if (hits.length) return true;
    }
    return false;
  }
  function coords(point) {
    projected.copy(point).project(camera);
    return {
      x: (projected.x + 1) * canvas.clientWidth / 2, y: (1 - projected.y) * canvas.clientHeight / 2,
      inFrame: Math.abs(projected.x) <= 1 && Math.abs(projected.y) <= 1 && Math.abs(projected.z) <= 1,
    };
  }
  function pick(event) {
    if (!pickable) return null;
    camera.updateMatrixWorld();
    const rect = canvas.getBoundingClientRect();
    let nearest = null, threshold = event.pointerType === 'touch' ? 24 : 14;
    for (const { id, bead } of nodes) {
      const screen = coords(bead.position);
      if (!screen.inFrame) continue;
      const dist = Math.hypot(screen.x - event.clientX + rect.left, screen.y - event.clientY + rect.top);
      if (dist > threshold || occluded(bead.position)) continue;
      nearest = id; threshold = dist;
    }
    return nearest;
  }
  return {
    root, setEnabled, setFocus, setHover, setProgress, update, pick,
    blockersFrom(meshes) { blockers = meshes; },
    get animating() { return alpha !== Number(enabled); },
    stats: () => ({ alpha, activeId, focusId, hoverId, stations: !pickable ? [] : nodes.map(({ id, bead }) => {
      const { x, y, inFrame } = coords(bead.position);
      const blocked = inFrame && occluded(bead.position);
      return { id, x, y, visible: inFrame && !blocked, occluded: blocked };
    }) }),
  };
}
