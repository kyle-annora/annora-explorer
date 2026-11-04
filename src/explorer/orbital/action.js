import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';

const BRACE_LIFT = 0.085;
const BOARD_LIFT = 0.044;
const TRACE_SAMPLES = 90;
const TRACE_COLOR = 0xe05c34;
const vertical = new THREE.Vector3(0, 1, 0);

function sourceBox([low, high]) {
  return new THREE.Box3(new THREE.Vector3(...low), new THREE.Vector3(...high));
}

function frameBounds(metadata) {
  const leg = new THREE.Box3();
  const electronics = new THREE.Box3();
  for (const part of metadata.parts) {
    if (part.group === 'hex-leg-1') leg.union(sourceBox(part.cycleBounds));
    if (part.group !== 'hex-body') continue;
    const box = sourceBox(part.bounds);
    if (part.meshName === 'Hex_top_stiffeners_1') box.max.y += BRACE_LIFT;
    if (part.meshName.startsWith('Hex_electronics_1')) box.max.y += BOARD_LIFT;
    electronics.union(box);
  }
  return { overview: sourceBox(metadata.bounds), leg, electronics };
}

function firstLegSampler(gltf) {
  const clip = gltf.animations.find(({ name }) => name === 'HexapodLegReach');
  const tracks = ['coxa', 'femur', 'tibia'].map((name) => {
    const jointName = 'HexJoint_leg_1_' + name;
    const node = gltf.scene.getObjectByName(jointName);
    const track = clip.tracks.find(({ name: path }) => path === jointName + '.quaternion');
    return { node, rest: node.quaternion.clone(), interpolant: track.createInterpolant() };
  });
  return (progress) => {
    for (const { node, rest, interpolant } of tracks) {
      if (progress === 0 || progress === 1) node.quaternion.copy(rest);
      else node.quaternion.fromArray(interpolant.evaluate(progress * clip.duration));
    }
  };
}

function lowestVertex(mesh) {
  const vertices = mesh.geometry.attributes.position;
  const local = new THREE.Vector3();
  const model = new THREE.Vector3();
  const lowest = new THREE.Vector3();
  let minY = Infinity;
  for (let i = 0; i < vertices.count; i++) {
    local.fromBufferAttribute(vertices, i);
    model.copy(local).applyMatrix4(mesh.matrixWorld);
    if (model.y >= minY) continue;
    minY = model.y;
    lowest.copy(local);
  }
  return lowest;
}

function createFootTrace(gltf, pose, guides) {
  const foot = gltf.scene.getObjectByName('Hex_leg_1_tibia_1');
  gltf.scene.updateWorldMatrix(true, true);
  const vertex = lowestVertex(foot);
  const intoModel = gltf.scene.matrixWorld.clone().invert();
  const point = new THREE.Vector3();
  function sampleToe() {
    foot.updateWorldMatrix(true, false);
    return point.copy(vertex).applyMatrix4(foot.matrixWorld).applyMatrix4(intoModel);
  }

  // Sample the same material point through the imported clip. This is a pose
  // illustration, so the trace describes the shown motion, not measured gait.
  const points = [];
  for (let i = 0; i <= TRACE_SAMPLES; i++) {
    pose(i / TRACE_SAMPLES);
    points.push(...sampleToe().toArray());
  }
  pose(0);

  const geometry = new LineGeometry().setPositions(points);
  const material = new LineMaterial({ color: TRACE_COLOR, linewidth: 2, depthWrite: false, toneMapped: false });
  const trail = new Line2(geometry, material);
  const marker = new THREE.Mesh(new THREE.SphereGeometry(0.0018, 12, 8), new THREE.MeshBasicMaterial({ color: TRACE_COLOR, toneMapped: false }));
  trail.name = 'Toe path';
  marker.name = 'Tracked toe';
  for (const node of [trail, marker]) {
    node.userData.chapterGuide = true;
    guides.add(node);
  }
  return (active, progress) => {
    trail.visible = active && progress > 0;
    marker.visible = active;
    if (!active) return;
    geometry.instanceCount = Math.floor(TRACE_SAMPLES * progress);
    marker.position.copy(sampleToe());
  };
}

function liftAlongModelY(root, meshName) {
  const mesh = root.getObjectByName(meshName);
  const rest = mesh.position.clone();
  const intoParent = mesh.parent.matrixWorld.clone().invert().multiply(root.matrixWorld);
  const step = vertical.clone().applyMatrix4(intoParent).sub(new THREE.Vector3().applyMatrix4(intoParent));
  return (distance) => mesh.position.copy(rest).addScaledVector(step, distance);
}

function makeLiftGuides(guides, metadata) {
  const part = metadata.parts.find(({ meshName }) => meshName === 'Hex_top_stiffeners_1');
  const box = sourceBox(part.bounds);
  const marks = new THREE.Group();
  marks.position.y = box.max.y;
  const pairs = [];
  for (const [x, z] of [[box.min.x, box.min.z], [box.max.x, box.max.z]]) {
    for (let y = 0; y < BRACE_LIFT; y += 0.007) {
      pairs.push(x, y, z, x, Math.min(BRACE_LIFT, y + 0.003), z);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pairs, 3));
  const line = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({
    color: 0x788080, transparent: true, opacity: 0.65, depthWrite: false, toneMapped: false
  }));
  line.name = 'Separation axis guides';
  line.userData.chapterGuide = true;
  marks.add(line);
  guides.add(marks);
  return (active, lift) => {
    marks.visible = active && lift > 0.002;
    if (marks.visible) marks.scale.y = lift / BRACE_LIFT;
  };
}

export function createChapterAction(gltf, metadata) {
  const root = gltf.scene;
  root.updateWorldMatrix(true, true);
  const guides = new THREE.Group();
  guides.name = 'OrbitChapterGuides';
  root.add(guides);
  const boxes = frameBounds(metadata);
  const pose = firstLegSampler(gltf);
  const trace = createFootTrace(gltf, pose, guides);
  const liftGuides = makeLiftGuides(guides, metadata);
  const liftBraces = liftAlongModelY(root, 'Hex_top_stiffeners_1');
  const board = metadata.parts.filter(({ meshName }) => meshName.startsWith('Hex_electronics_1'))
    .map(({ meshName }) => liftAlongModelY(root, meshName));
  let chapter = 'overview';

  function setProgress(value) {
    const progress = THREE.MathUtils.clamp(value, 0, 1);
    if (chapter === 'leg') {
      pose(progress);
      trace(true, progress);
    } else if (chapter === 'electronics') {
      const braces = BRACE_LIFT * THREE.MathUtils.smootherstep(progress, 0.03, 0.53);
      const pcb = BOARD_LIFT * THREE.MathUtils.smootherstep(progress, 0.42, 0.90);
      liftBraces(braces);
      for (const setLift of board) setLift(pcb);
      liftGuides(true, braces);
    }
  }

  function setChapter(id) {
    pose(0);
    trace(false, 0);
    liftGuides(false, 0);
    liftBraces(0);
    for (const setLift of board) setLift(0);
    chapter = id;
    setProgress(0);
  }
  setChapter(chapter);

  return {
    setChapter,
    setProgress,
    bounds: (id) => boxes[id].clone(),
    dispose() {
      setChapter('overview');
      guides.removeFromParent();
      guides.traverse((node) => { node.geometry?.dispose(); node.material?.dispose(); });
    }
  };
}
