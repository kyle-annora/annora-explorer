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
for (let i = 0; i < 240; i++) {
  const start = i * 1.5, end = start + 1.5;
  const station = Object.entries(stationAngles).find(([, angle]) => Math.abs(nearArc((start + end) / 2, angle)) < 18);
  const gap = station && Math.abs(nearArc((start + end) / 2, station[1])) < 3;
  if (!gap) segments.push({ a: ringPoint(start), b: ringPoint(end), id: station?.[0] || null });
}
export const orbitFramePoints = Array.from({ length: 72 }, (_, i) => ringPoint(i * 5));

function makeArc(records, width) {
  const positions = records.flatMap(({ a, b }) => [...a.toArray(), ...b.toArray()]);
  const geometry = new LineSegmentsGeometry().setPositions(positions);
  const material = new LineMaterial({ color: graphite, linewidth: width, transparent: true, depthTest: true, depthWrite: false, toneMapped: false });
  const arc = new LineSegments2(geometry, material);
  arc.renderOrder = 2;
  return arc;
}

function createOrbitGeometry() {
  const root = new THREE.Group();
  root.name = 'Orbital chapter navigation';
  const ticks = [];
  for (let i = 0; i < 36; i++) {
    if (Object.values(stationAngles).some(angle => Math.abs(nearArc(i * 10, angle)) < 7)) continue;
    const a = ringPoint(i * 10), b = a.clone();
    const factor = i % 3 === 0 ? 1.027 : 1.013;
    b.x *= factor; b.z *= factor;
    ticks.push({ a, b });
  }
  const base = makeArc([...segments.filter(segment => segment.id === null), ...ticks], 1);
  root.add(base);
  const sphere = new THREE.SphereGeometry(.005, 16, 10);
  const torus = new THREE.TorusGeometry(.0102, .00085, 5, 36);
  const stations = Object.entries(stationAngles).map(([id, angle]) => {
    const point = ringPoint(angle);
    const hitArc = segments.filter(segment => segment.id === id);
    const arc = makeArc(hitArc, 1.25);
    const beadMaterial = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false });
    const bead = new THREE.Mesh(sphere, beadMaterial);
    const halo = new THREE.Mesh(torus, beadMaterial);
    bead.position.copy(point); halo.position.copy(point);
    halo.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(-.126, 1, .171).normalize());
    bead.renderOrder = halo.renderOrder = 3;
    root.add(arc, bead, halo);
    let leader;
    if (detailAnchors[id]) {
      leader = makeArc([{ a: point, b: detailAnchors[id] }], 1);
      leader.material.color.set(ember);
      leader.visible = false;
      root.add(leader);
    }
    return { id, point, arc, hitArc, beadMaterial, leader, occluded: false };
  });
  return { root, stations, base };
}

export function createSpatialOrbit({ camera, canvas, onStations, onEmphasis }) {
  const { root, stations, base } = createOrbitGeometry();
  let blockers = [], enabled = false, alpha = 0, focusId = null, hoverId = null, lastOcclusion = -Infinity, lastPoints = [];
  let published = '', lastEmphasis = null;
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
  const cameraAtOcclusion = new THREE.Matrix4();
  root.visible = false;

  function paint() {
    const emphasis = focusId || hoverId;
    if (emphasis !== lastEmphasis) { lastEmphasis = emphasis; onEmphasis?.(emphasis); }
    base.material.opacity = alpha * .88;
    for (const station of stations) {
      const highlighted = station.id === (focusId || hoverId || 'overview');
      station.arc.material.color.set(highlighted ? ember : graphite);
      station.arc.material.linewidth = highlighted ? 1.65 : 1;
      station.arc.material.opacity = alpha * (highlighted ? .98 : .88);
      station.beadMaterial.color.set(highlighted ? ember : ink);
      station.beadMaterial.opacity = alpha;
      if (station.leader) {
        station.leader.visible = Boolean((focusId || hoverId) === station.id);
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
  function publish(points) {
    lastPoints = points;
    const next = points.map(p => [p.id, p.x, p.y, p.visible, p.occluded].join(',')).join('|');
    if (next !== published) { published = next; onStations?.(points); }
  }
  function setEnabled(next, immediate = false) {
    enabled = next; hoverId = null; focusId = null;
    if (immediate) alpha = Number(enabled);
    if (!next) publish([]);
    lastOcclusion = -Infinity;
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
  function update(dt, now, moving, settling) {
    if (alpha !== Number(enabled)) {
      alpha = THREE.MathUtils.clamp(alpha + (enabled ? 1 : -1) * dt / .22, 0, 1);
      paint();
    }
    if (!enabled || alpha < 1 || settling) { publish([]); return; }
    camera.updateMatrixWorld();
    const width = canvas.clientWidth, height = canvas.clientHeight;
    const checkDepth = lastOcclusion === -Infinity || ((!moving || now - lastOcclusion >= 80) && !camera.matrixWorld.equals(cameraAtOcclusion));
    if (checkDepth) {
      lastOcclusion = now; cameraAtOcclusion.copy(camera.matrixWorld);
    }
    const points = stations.map(station => {
      projected.copy(station.point).project(camera);
      const x = Math.round((projected.x + 1) * width * 2) / 4;
      const y = Math.round((1 - projected.y) * height * 2) / 4;
      const inFrame = projected.z >= -1 && projected.z <= 1 && x >= 3 && x <= width - 3 && y >= 3 && y <= height - 3;
      if (inFrame && checkDepth) station.occluded = occluded(station.point);
      return { id: station.id, x, y, visible: inFrame && !station.occluded, occluded: inFrame && station.occluded };
    });
    publish(points);
  }
  function pick(event) {
    if (!enabled || alpha < 1 || !lastPoints.length) return null;
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
      if (!lastPoints.find(point => point.id === station.id)?.visible) continue;
      const px = screenRay.ray.distanceToPoint(station.point) / worldPixel(station.point);
      if (px < hitRadius && px < closest && !occluded(station.point)) {
        best = station.id; closest = px;
      }
    }
    if (best) return best;
    const band = event.pointerType === 'touch' ? 7 : 4;
    for (const station of stations) {
      if (!lastPoints.find(point => point.id === station.id)?.visible) continue;
      for (const { a, b } of station.hitArc) {
        const squared = screenRay.ray.distanceSqToSegment(a, b, closestRay, closestSegment);
        const px = Math.sqrt(squared) / worldPixel(closestSegment);
        if (px < band && px < closest && !occluded(closestSegment)) {
          best = station.id; closest = px;
        }
      }
    }
    return best;
  }
  return {
    root, blockersFrom, setEnabled, setFocus, setHover, update, pick,
    get animating() { return alpha !== Number(enabled); },
    stats: () => ({ alpha, stations: lastPoints, hoverId, focusId }),
  };
}
