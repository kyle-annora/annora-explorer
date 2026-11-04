import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { loadBinary } from '../src/explorer/asset-load.js';
import { createEngineeringEnvironment, createEngineeringLights } from '../src/explorer/engineering.js';
import metadata from '../content/models/hexapod/metadata.json' with { type: 'json' };
import { createChapterAction } from './action.js';

const modelUrl = new URL('../content/models/hexapod/model.glb', import.meta.url);
const gzipUrl = new URL('../content/models/hexapod/model.glb.gz', import.meta.url);
const angles = {
  overview: [.46, 1.03, 1.6],
  leg: [1.25, .48, 1.68],
  electronics: [1.3, .72, 1.77],
};

function corners(pair) {
  const [low, high] = pair;
  const result = [];
  for (const x of [low[0], high[0]]) for (const y of [low[1], high[1]]) for (const z of [low[2], high[2]]) {
    result.push(new THREE.Vector3(x, y, z));
  }
  return result;
}

const partsByName = new Map(metadata.parts.map(part => [part.meshName, part]));
const viewPoints = {
  overview: metadata.parts.flatMap(part => corners(part.bounds)),
  leg: metadata.parts.filter(part => part.group === 'hex-leg-1').flatMap(part => corners(part.cycleBounds)),
};

// The assembly is in native model coordinates. Fit the visible geometry to a
// fraction of the actual canvas, leaving room for the fixed orbit labels.
function fitCamera(chapter, bounds, camera, width, height) {
  const points = viewPoints[chapter] || corners([bounds.min.toArray(), bounds.max.toArray()]);
  const center = bounds.getCenter(new THREE.Vector3());
  const direction = new THREE.Vector3(...angles[chapter]).normalize();
  const right = new THREE.Vector3().crossVectors(camera.up, direction).normalize();
  const up = new THREE.Vector3().crossVectors(direction, right);
  const projected = points.map(point => {
    const delta = point.clone().sub(center);
    return [delta.dot(right), delta.dot(up), delta.dot(direction)];
  });
  const offset = axis => (Math.min(...projected.map(point => point[axis])) + Math.max(...projected.map(point => point[axis]))) / 2;
  const midX = offset(0), midY = offset(1);
  center.addScaledVector(right, midX).addScaledVector(up, midY);
  const portrait = width < height;
  // Each bound also encloses the empty corners of an angled part. These
  // margins keep the actual silhouette large while allowing the full motion.
  const fillX = chapter === 'overview' ? (portrait ? .88 : .71) : (chapter === 'electronics' ? 1.03 : .91);
  const fillY = chapter === 'overview' ? .84 : (chapter === 'electronics' ? 1.12 : .93);
  const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  let radius = .01;
  for (const [x, y, z] of projected) {
    radius = Math.max(radius, Math.abs(x - midX) / (camera.aspect * tangent * fillX) + z, Math.abs(y - midY) / (tangent * fillY) + z);
  }
  return { center, spherical: new THREE.Spherical().setFromVector3(direction.multiplyScalar(radius)) };
}

function smooth(t) { return t * t * (3 - 2 * t); }

function createSurfaces(gltf) {
  // Materials are shared within each visibility group, so a whole assembly
  // can recede during a camera cut without allocating per-frame materials.
  const variants = new Map(), originals = new Set();
  gltf.scene.traverse(mesh => {
    if (!mesh.isMesh) return;
    const part = partsByName.get(mesh.name);
    if (!part) return;
    const group = part.group === 'hex-body' ? 'electronics' : part.group === 'hex-leg-1' ? 'leg' : 'other';
    const source = mesh.material;
    const key = group + source.uuid;
    if (!variants.has(key)) {
      const material = source.clone();
      if (source.name === 'Printed white') material.color.set('#aaafac');
      if (source.name === 'Graphite mechanism') material.color.set('#3b3d41');
      variants.set(key, { group, material, meshes: [], from: 1, to: 1 });
    }
    const variant = variants.get(key);
    variant.meshes.push(mesh);
    mesh.material = variant.material;
    originals.add(source);
  });
  originals.forEach(material => material.dispose());
  return {
    target(chapter) {
      for (const variant of variants.values()) {
        variant.from = variant.material.opacity;
        variant.to = Number(chapter === 'overview' || chapter === variant.group);
      }
    },
    fade(progress) {
      for (const variant of variants.values()) {
        const opacity = THREE.MathUtils.lerp(variant.from, variant.to, progress);
        const isTranslucent = opacity > 0 && opacity < 1;
        if (variant.material.transparent !== isTranslucent) {
          variant.material.transparent = isTranslucent;
          variant.material.depthWrite = !isTranslucent;
          variant.material.needsUpdate = true;
        }
        variant.material.opacity = opacity;
        for (const mesh of variant.meshes) mesh.visible = opacity > .001;
      }
    },
  };
}

// A single textured disc gives the assembly a quiet contact footprint without
// a shadow-map render pass. The close-ups float clear of the ground plane.
function contactFootprint() {
  const surface = document.createElement('canvas');
  surface.width = surface.height = 128;
  const context = surface.getContext('2d');
  const shadow = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  shadow.addColorStop(0, 'rgba(28,31,35,.30)');
  shadow.addColorStop(.6, 'rgba(28,31,35,.15)');
  shadow.addColorStop(1, 'rgba(28,31,35,0)');
  context.fillStyle = shadow; context.fillRect(0, 0, 128, 128);
  const map = new THREE.CanvasTexture(surface);
  map.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(.57, .47), new THREE.MeshBasicMaterial({
    map, transparent: true, opacity: .65, depthWrite: false, toneMapped: false,
  }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -.0015;
  return mesh;
}

function disposeGeometry(root) {
  const geometries = new Set(), materials = new Set();
  root.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    if (object.material) for (const mat of [].concat(object.material)) materials.add(mat);
  });
  geometries.forEach(geometry => geometry.dispose());
  materials.forEach(material => { material.map?.dispose(); material.dispose(); });
}

export function createScene({ canvas, onTakeover, onReady, onError, onTick, reducedMotion = false }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'default' });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.NeutralToneMapping;
  const world = new THREE.Scene();
  world.add(createEngineeringLights());
  const environment = createEngineeringEnvironment(renderer);
  world.environment = environment.texture;
  const footprint = contactFootprint();
  world.add(footprint);
  const camera = new THREE.PerspectiveCamera(26, 1, .001, 7);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = false;
  controls.enablePan = false;
  controls.rotateSpeed = .72;
  controls.zoomSpeed = .82;
  controls.minPolarAngle = .06;
  controls.maxPolarAngle = Math.PI * .94;
  controls.minDistance = .035;
  controls.maxDistance = 3;
  controls.autoRotateSpeed = .66;
  const abort = new AbortController();

  let action, surfaces, chapter = 'overview', progress = 0, shot = null, rotating = false, playing = false;
  let raf = 0, previous = null, disposed = false, ready = false, frames = 0, manualView = false;
  let modelMeshes = [];

  function wake() {
    if (!disposed && !document.hidden && !raf) raf = requestAnimationFrame(render);
  }
  function cancelClock() {
    cancelAnimationFrame(raf); raf = 0; previous = null;
  }
  function takeover() {
    if (!ready) return;
    rotating = playing = false; manualView = true;
    controls.autoRotate = false;
    if (shot) { shot = null; surfaces.fade(1); }
    onTakeover?.();
    wake();
  }
  controls.addEventListener('start', takeover);
  controls.addEventListener('change', wake);
  canvas.addEventListener('keydown', event => {
    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', '_'];
    if (!ready || !keys.includes(event.key) || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    takeover();
    const offset = camera.position.clone().sub(controls.target);
    if (event.shiftKey && event.key.startsWith('Arrow')) {
      const axes = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowDown: [0, -1], ArrowUp: [0, 1] };
      const [x, y] = axes[event.key];
      const delta = new THREE.Vector3(x, y, 0).applyQuaternion(camera.quaternion).multiplyScalar(offset.length() * .03);
      controls.target.add(delta); camera.position.add(delta);
    } else {
      const pose = new THREE.Spherical().setFromVector3(offset);
      if (event.key === 'ArrowLeft') pose.theta -= Math.PI / 24;
      if (event.key === 'ArrowRight') pose.theta += Math.PI / 24;
      if (event.key === 'ArrowUp') pose.phi -= Math.PI / 24;
      if (event.key === 'ArrowDown') pose.phi += Math.PI / 24;
      if (['+', '='].includes(event.key)) pose.radius *= .90;
      if (['-', '_'].includes(event.key)) pose.radius /= .90;
      pose.phi = THREE.MathUtils.clamp(pose.phi, controls.minPolarAngle, controls.maxPolarAngle);
      pose.radius = THREE.MathUtils.clamp(pose.radius, controls.minDistance, controls.maxDistance);
      camera.position.setFromSpherical(pose).add(controls.target);
    }
    controls.update();
  }, { signal: abort.signal });

  function frameChapter(immediate) {
    if (!action) return;
    const width = canvas.clientWidth, height = canvas.clientHeight;
    if (!(width && height)) return;
    const end = fitCamera(chapter, action.bounds(chapter), camera, width, height);
    controls.minDistance = Math.max(.018, end.spherical.radius * .18);
    controls.maxDistance = Math.max(end.spherical.radius * 4, .8);
    const start = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    end.spherical.theta = start.theta + Math.atan2(Math.sin(end.spherical.theta - start.theta), Math.cos(end.spherical.theta - start.theta));
    shot = { elapsed: 0, start, end, origin: controls.target.clone() };
    if (immediate) moveCamera(1);
    wake();
  }

  function moveCamera(fraction) {
    const { start, end, origin } = shot;
    const t = smooth(fraction);
    const pose = new THREE.Spherical(
      THREE.MathUtils.lerp(start.radius, end.spherical.radius, t),
      THREE.MathUtils.lerp(start.phi, end.spherical.phi, t),
      THREE.MathUtils.lerp(start.theta, end.spherical.theta, t),
    );
    controls.target.lerpVectors(origin, end.center, t);
    camera.position.setFromSpherical(pose).add(controls.target);
    controls.autoRotate = false;
    controls.update();
    surfaces.fade(smooth(Math.min(1, fraction * 1.9)));
    if (fraction === 1) shot = null;
  }

  function resize() {
    const width = canvas.clientWidth, height = canvas.clientHeight;
    if (!(width > 0 && height > 0)) return;
    camera.aspect = width / height;
    camera.setViewOffset(width, height, 0, height * .02, width, height);
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, width < 650 ? 1.75 : 1.5, Math.sqrt(2000000 / (width * height))));
    renderer.setSize(width, height, false);
    if (!manualView) frameChapter(true);
    wake();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();

  function render(now) {
    raf = 0;
    const elapsed = previous === null ? 0 : Math.max(0, (now - previous) / 1000);
    const dt = Math.min(.075, elapsed);
    previous = now;
    if (shot) {
      shot.elapsed += dt;
      moveCamera(Math.min(1, shot.elapsed / .55));
    } else if (ready) {
      controls.autoRotate = rotating && chapter === 'overview';
      if (controls.autoRotate) controls.update(dt);
      if (playing) onTick?.(elapsed);
    }
    renderer.render(world, camera); frames++;
    if (ready && !canvas.dataset.ready) {
      canvas.dataset.ready = 'true';
      onReady?.();
    }
    if (shot || (ready && (playing || (rotating && chapter === 'overview')))) wake();
    if (!raf) previous = null;
  }

  function setChapter(value) {
    if (!Object.hasOwn(angles, value)) return;
    chapter = value; progress = 0; manualView = false;
    canvas.dataset.chapter = value;
    footprint.visible = chapter === 'overview';
    if (action) {
      action.setChapter(chapter);
      surfaces.target(chapter);
      frameChapter(reducedMotion);
    }
  }
  function setProgress(value) {
    progress = THREE.MathUtils.clamp(value, 0, 1);
    action?.setProgress(progress);
    wake();
  }
  function setRotating(value) {
    rotating = Boolean(value); controls.autoRotate = false;
    wake();
  }
  function setPlaying(value) { playing = Boolean(value); wake(); }
  function setReducedMotion(value) {
    reducedMotion = Boolean(value);
    if (reducedMotion) {
      setRotating(false); setPlaying(false);
      if (shot) moveCamera(1);
    }
    wake();
  }

  async function load() {
    const bytes = await loadBinary(modelUrl, gzipUrl, undefined, { signal: abort.signal });
    const gltf = await new GLTFLoader().parseAsync(bytes, '');
    if (disposed) { disposeGeometry(gltf.scene); return; }
    gltf.scene.traverse(object => { if (object.isMesh) modelMeshes.push(object); });
    surfaces = createSurfaces(gltf);
    world.add(gltf.scene);
    action = createChapterAction(gltf);
    action.setChapter(chapter); action.setProgress(progress);
    surfaces.target(chapter);
    frameChapter(true);
    ready = true; wake();
  }
  load().catch(error => { if (!disposed) onError?.(error); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelClock();
    else wake();
  }, { signal: abort.signal });
  return {
    setChapter, setProgress, setRotating, setPlaying, setReducedMotion,
    stats: () => ({
      frames, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
      meshes: modelMeshes.length, visibleMeshes: modelMeshes.filter(mesh => mesh.visible).length,
      camera: camera.position.toArray(), target: controls.target.toArray(), progress,
      ready, chapter, rotating, playing, transitioning: Boolean(shot), pixelRatio: renderer.getPixelRatio(),
    }),
    dispose() {
      if (disposed) return;
      disposed = true; abort.abort(); cancelClock();
      observer.disconnect(); controls.dispose(); action?.dispose(); modelMeshes = [];
      disposeGeometry(world); environment.dispose(); renderer.dispose();
    },
  };
}
