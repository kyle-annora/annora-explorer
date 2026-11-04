import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';

const TRACE_SAMPLES = 90;

function sourceBox([low, high]) {
  return new THREE.Box3(new THREE.Vector3(...low), new THREE.Vector3(...high));
}

function jointSampler(gltf, action) {
  const clip = gltf.animations.find(clip => clip.name === action.clip);
  const tracks = action.joints.map(name => {
    const node = gltf.scene.getObjectByName(name);
    const track = clip.tracks.find(track => {
      const binding = THREE.PropertyBinding.parseTrackName(track.name);
      return binding.nodeName === node.name && binding.propertyName === 'quaternion';
    });
    return { node, rest: node.quaternion.clone(), interpolant: track.createInterpolant() };
  });
  const [start, end] = action.window ?? [0, 1];
  return {
    reset() { for (const {node, rest} of tracks) node.quaternion.copy(rest); },
    sample(progress) {
      const time = THREE.MathUtils.lerp(start, end, progress) * clip.duration;
      for (const {node, interpolant} of tracks) node.quaternion.fromArray(interpolant.evaluate(time)).normalize();
    },
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

function createPointTrace(gltf, meshName, pose, guides, accent, span) {
  const foot = gltf.scene.getObjectByName(meshName);
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
  const material = new LineMaterial({ color: accent, linewidth: 2, depthWrite: false, toneMapped: false });
  const trail = new Line2(geometry, material);
  const marker = new THREE.Mesh(new THREE.SphereGeometry(span * .0033, 12, 8), new THREE.MeshBasicMaterial({ color: accent, toneMapped: false }));
  trail.name = 'Motion path';
  marker.name = 'Tracked point';
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

function liftInModelSpace(root, meshName, vector) {
  const mesh = root.getObjectByName(meshName);
  const rest = mesh.position.clone();
  const intoParent = mesh.parent.matrixWorld.clone().invert().multiply(root.matrixWorld);
  const step = new THREE.Vector3(...vector).applyMatrix4(intoParent).sub(new THREE.Vector3().applyMatrix4(intoParent));
  return (distance) => mesh.position.copy(rest).addScaledVector(step, distance);
}

function makeLiftGuides(guides, part, height) {
  const box = sourceBox(part.bounds);
  const marks = new THREE.Group();
  marks.position.y = box.max.y;
  const pairs = [];
  for (const [x, z] of [[box.min.x, box.min.z], [box.max.x, box.max.z]]) {
    for (let y = 0; y < height; y += height / 12) {
      pairs.push(x, y, z, x, Math.min(height, y + height / 26), z);
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
    marks.visible = active && lift > .02;
    if (marks.visible) marks.scale.y = lift;
  };
}

// Each chapter samples absolute authored poses. Its model package owns the
// names, axes and timing. A material point is traced on the presented clip.
export function createModelAction(gltf, metadata, guide, accent) {
  const root = gltf.scene;
  root.updateWorldMatrix(true, true);
  const guides = new THREE.Group();
  guides.name = 'OrbitChapterGuides';
  root.add(guides);
  const parts = new Map(metadata.parts.map(part => [part.meshName, part]));
  const bounds = new Map([['overview', sourceBox(metadata.bounds)]]);
  const span = sourceBox(metadata.bounds).getSize(new THREE.Vector3()).length();
  const actions = new Map();
  for (const chapter of guide.chapters.slice(1)) {
    const config = chapter.action;
    const box = new THREE.Box3();
    for (const part of parts.values()) {
      if (chapter.groups.includes(part.group)) box.union(sourceBox(
        config.type === 'motion' ? part.cycleBounds || part.bounds : part.bounds
      ));
    }
    bounds.set(chapter.id, box);
    if (config.type === 'motion') {
      const joints = jointSampler(gltf, config);
      const trace = config.trace && createPointTrace(gltf, config.trace, p => joints.sample(p), guides, accent, span);
      const reset = () => { joints.reset(); if (trace) trace(false, 0); };
      reset();
      actions.set(chapter.id, { reset, sample(p) { joints.sample(p); if (trace) trace(true, p); } });
    } else {
      const lifts = config.lifts.map(({meshes, vector, window}) => {
        const move = meshes.map(name => liftInModelSpace(root, name, vector));
        for (const name of meshes) box.union(sourceBox(parts.get(name).bounds).translate(new THREE.Vector3(...vector)));
        const marks = meshes.includes(config.guideMesh) && makeLiftGuides(guides, parts.get(config.guideMesh), vector[1]);
        return p => {
          const amount = THREE.MathUtils.smootherstep(p, ...window);
          for (const apply of move) apply(amount);
          if (marks) marks(true, amount);
        };
      });
      const sample = p => lifts.forEach(apply => apply(p));
      sample(0);
      actions.set(chapter.id, { sample, reset: () => sample(0) });
    }
  }
  let current;
  return {
    setChapter(id) {
      for (const action of actions.values()) action.reset();
      current = actions.get(id);
      current?.sample(0);
    },
    setProgress(value) { current?.sample(THREE.MathUtils.clamp(value, 0, 1)); },
    bounds: id => bounds.get(id).clone(),
    dispose() {
      current?.reset();
      guides.removeFromParent();
      guides.traverse(node => { node.geometry?.dispose(); node.material?.dispose(); });
    },
  };
}
