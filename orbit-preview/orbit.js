import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import metadata from '../content/models/hexapod/metadata.json' with { type: 'json' };

const stationAngles = { overview: 177, leg: 301, electronics: 83 };
const graphite = 0x93978f, ink = 0x454b48, ember = 0xd9542e;
// The front-right station follows the corresponding leg; the forward station
// faces the exposed edge of the board stack. A short leader only appears on
// focus, so inspecting the product leaves the normal overview clear.
const pivot = metadata.parts.find(part => part.meshName === 'Hex_leg_1_tibia_bracket_B_1');
const board = metadata.parts.find(part => part.meshName === 'Hex_electronics_1');
const detailAnchors = {
  leg: new THREE.Vector3(...pivot.center),
  electronics: new THREE.Vector3(board.center[0], board.center[1], board.bounds[1][2]),
};
const radians = THREE.MathUtils.degToRad;

function ringPoint(degrees) {
  const angle = radians(degrees);
  const x = Math.cos(angle), z = Math.sin(angle);
  return new THREE.Vector3(.333 * x, .085 + .042 * x - .052 * z, .304 * z);
}
const nearArc = (angle, station) => THREE.MathUtils.euclideanModulo(angle - station + 180, 360) - 180;
const segments = [];
let orbitLength = 0;
for (let i = 0; i < 240; i++) {
  const start = i * 1.5, end = start + 1.5;
  const a = ringPoint(start), b = ringPoint(end);
  const from = orbitLength;
  orbitLength += a.distanceTo(b);
  const station = Object.entries(stationAngles).find(([, angle]) => Math.abs(nearArc((start + end) / 2, angle)) < 18);
  const gap = station && Math.abs(nearArc((start + end) / 2, station[1])) < 3;
  if (!gap) segments.push({ a, b, from, to: orbitLength, id: station?.[0] || null });
}
export const orbitFramePoints = Array.from({ length: 72 }, (_, i) => ringPoint(i * 5));

// Reserve only a small portion of the assembly orbit in the detail study.
export const legContextPoints = [-7, 0, 7].map(offset => ringPoint(stationAngles.leg + offset));

function makeArc(records, width) {
  const positions = records.flatMap(({ a, b }) => [...a.toArray(), ...b.toArray()]);
  const geometry = new LineSegmentsGeometry().setPositions(positions);
  const material = new LineMaterial({ color: graphite, linewidth: width, transparent: true, depthTest: true, depthWrite: false, toneMapped: false });
  const arc = new LineSegments2(geometry, material);
  arc.renderOrder = 2;
  return arc;
}

function makeTrack(records, width) {
  const arc = makeArc(records, width);
  // A single distance around the ellipse keeps dashes aligned across the seam,
  // bead clearances and independently colored station arcs as the camera turns.
  for (const [attribute, key] of [['instanceDistanceStart', 'from'], ['instanceDistanceEnd', 'to']]) {
    arc.geometry.setAttribute(attribute, new THREE.InstancedBufferAttribute(Float32Array.from(records, segment => segment[key]), 1));
  }
  const period = orbitLength / 72;
  arc.material.dashed = true;
  arc.material.dashSize = period * .63;
  arc.material.gapSize = period - arc.material.dashSize;
  return arc;
}

function createOrbitGeometry() {
  const root = new THREE.Group();
  root.name = 'Orbital chapter navigation';
  const base = makeTrack(segments.filter(segment => segment.id === null), 1);
  root.add(base);
  const sphere = new THREE.SphereGeometry(.0058, 16, 10);
  const stations = Object.entries(stationAngles).map(([id, angle]) => {
    const point = ringPoint(angle);
    const hitArc = segments.filter(segment => segment.id === id);
    const arc = makeTrack(hitArc, 1.25);
    const beadMaterial = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false });
    const bead = new THREE.Mesh(sphere, beadMaterial);
    bead.position.copy(point);
    bead.renderOrder = 3;
    root.add(arc, bead);
    let leader;
    if (detailAnchors[id]) {
      leader = makeArc([{ a: point, b: detailAnchors[id] }], 1);
      leader.material.color.set(ember);
      leader.material.dashed = true;
      leader.material.dashSize = 0.008;
      leader.material.gapSize = 0.0055;
      leader.computeLineDistances();
      leader.visible = false;
      root.add(leader);
    }
    return { id, point, arc, hitArc, beadMaterial, bead, leader };
  });
  return { root, stations, base };
}

export function createSpatialOrbit({ camera, canvas, onEmphasis }) {
  const { root, stations, base } = createOrbitGeometry();
  let blockers = [], enabled = false, pickable = false, alpha = 0, focusId = null, hoverId = null;
  let lastEmphasis = null, contextId = null;
  const raycaster = new THREE.Raycaster();
  const screenRay = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const projected = new THREE.Vector3();
  const clipPoint = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const delta = new THREE.Vector3();
  const closestRay = new THREE.Vector3(), closestSegment = new THREE.Vector3();
  const intersections = [];
  const cameraDirection = new THREE.Vector3();
  root.visible = false;

  function paint() {
    const emphasis = contextId || focusId || hoverId;
    const inputEmphasis = contextId ? null : emphasis;
    if (inputEmphasis !== lastEmphasis) { lastEmphasis = inputEmphasis; onEmphasis?.(inputEmphasis); }
    base.material.opacity = alpha * (contextId ? .43 : .82);
    for (const station of stations) {
      const highlighted = station.id === emphasis;
      station.arc.material.color.set(highlighted ? ember : graphite);
      station.arc.material.linewidth = highlighted ? 1.35 : 1;
      station.arc.material.opacity = alpha * (contextId ? (highlighted ? .48 : .43) : (highlighted ? .95 : .82));
      station.beadMaterial.color.set(highlighted || (!emphasis && station.id === 'overview') ? ember : ink);
      station.bead.scale.setScalar(contextId ? .46 : highlighted ? 1.16 : 1);
      station.beadMaterial.opacity = alpha * (contextId ? (highlighted ? .72 : .22) : 1);
      if (station.leader) {
        station.leader.visible = Boolean(!contextId && (focusId || hoverId) === station.id);
        station.leader.material.opacity = .52 * alpha;
      }
    }
    root.visible = alpha > 0;
  }
  function setFocus(id) {
    if (focusId === id) return false;
    focusId = id; paint(); return true;
  }
  function setHover(id) {
    if (hoverId === id) return false;
    hoverId = id; paint(); return true;
  }
  function setEnabled(next, immediate = false, context = null) {
    if (next || immediate || alpha === 0) contextId = context;
    enabled = next; pickable = false; hoverId = null; focusId = null;
    if (immediate) alpha = Number(enabled);
    paint();
  }
  function blockersFrom(meshes) {
    blockers = meshes.map(mesh => {
      mesh.geometry.computeBoundingBox();
      return { mesh, box: mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld) };
    });
  }
  function occluded(point) {
    const distance = camera.position.distanceTo(point);
    raycaster.set(camera.position, forward.copy(point).sub(camera.position).normalize());
    raycaster.near = camera.near; raycaster.far = distance - .002;
    for (const { mesh, box } of blockers) {
      if (!mesh.visible || !raycaster.ray.intersectBox(box, clipPoint)) continue;
      if (clipPoint.distanceToSquared(camera.position) > distance * distance) continue;
      intersections.length = 0;
      mesh.raycast(raycaster, intersections);
      if (intersections.length > 0) return true;
    }
    return false;
  }
  function update(dt, settling) {
    if (alpha !== Number(enabled)) {
      alpha = THREE.MathUtils.clamp(alpha + (enabled ? 1 : -1) * dt / .22, 0, 1);
      if (!enabled && alpha === 0) contextId = null;
      paint();
    }
    pickable = enabled && !contextId && alpha === 1 && !settling;
  }
  function inView(point) {
    projected.copy(point).project(camera);
    return Math.abs(projected.x) <= 1 && Math.abs(projected.y) <= 1 && Math.abs(projected.z) <= 1;
  }
  function pick(event) {
    if (!pickable) return null;
    const rect = canvas.getBoundingClientRect();
    ndc.set(2 * (event.clientX - rect.left) / rect.width - 1, 1 - 2 * (event.clientY - rect.top) / rect.height);
    camera.updateMatrixWorld();
    screenRay.setFromCamera(ndc, camera);
    camera.getWorldDirection(cameraDirection);
    const tangent = 2 * Math.tan(radians(camera.fov / 2)) / rect.height;
    const worldPixel = point => Math.max(.000001, tangent * cameraDirection.dot(delta.copy(point).sub(camera.position)));
    const hitRadius = event.pointerType === 'touch' ? 22 : 13;
    let best = null, closest = Infinity;
    for (const station of stations) {
      if (!inView(station.point)) continue;
      const px = screenRay.ray.distanceToPoint(station.point) / worldPixel(station.point);
      if (px < hitRadius && px < closest && !occluded(station.point)) {
        best = station.id; closest = px;
      }
    }
    if (best) return best;
    const band = event.pointerType === 'touch' ? 7 : 4;
    for (const station of stations) {
      if (!inView(station.point)) continue;
      for (const { a, b } of station.hitArc) {
        const squared = screenRay.ray.distanceSqToSegment(a, b, closestRay, closestSegment);
        const px = Math.sqrt(squared) / worldPixel(closestSegment);
        if (px < band && px < closest && !occluded(closestSegment) && !occluded(station.point)) {
          best = station.id; closest = px;
        }
      }
    }
    return best;
  }
  return {
    root, blockersFrom, setEnabled, setFocus, setHover, update, pick,
    get animating() { return alpha !== Number(enabled); },
    stats: () => ({
      alpha, hoverId, focusId, contextId,
      stations: !pickable ? [] : stations.map(({ id, point }) => {
        const inFrame = inView(point), blocked = inFrame && occluded(point);
        return { id, x: (projected.x+1)*canvas.clientWidth/2, y: (1-projected.y)*canvas.clientHeight/2,
          visible: inFrame && !blocked, occluded: blocked };
      }),
    }),
  };
}
