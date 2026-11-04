import * as THREE from 'three';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { CopyShader } from 'three/addons/shaders/CopyShader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createEngineeringLights } from '../engineering.js';
import { createChapterAction } from './action.js';
import { createSpatialOrbit, orbitFramePoints } from './orbit.js';

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

// The assembly is in native model coordinates. Fit the visible geometry to a
// fraction of the actual canvas, leaving room for the orbital navigation around the assembly.
function fitCamera(chapter, bounds, camera, width, height, viewPoints, direction = new THREE.Vector3(...angles[chapter]).normalize()) {
  const points = viewPoints[chapter] || corners([bounds.min.toArray(), bounds.max.toArray()]);
  const center = bounds.getCenter(new THREE.Vector3());
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
  if (chapter === 'overview') {
    // Fit the attached navigation to the same camera. Always reserve space
    // for a station at each edge even on a narrow portrait canvas.
    for (const point of orbitFramePoints) {
      const delta = point.clone().sub(center), z = delta.dot(direction);
      radius = Math.max(radius, Math.abs(delta.dot(right)) / (camera.aspect * tangent * .90) + z,
        Math.abs(delta.dot(up)) / (tangent * .86) + z);
    }
  }
  return { center, spherical: new THREE.Spherical().setFromVector3(direction.multiplyScalar(radius)) };
}

function smooth(t) { return t * t * (3 - 2 * t); }

function createSurfaces(gltf, partsByName) {
  // Materials are shared within each visibility group, so a whole assembly
  // can recede during a camera cut without allocating per-frame materials.
  const variants = new Map();
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
  });
  return {
    dispose() { for (const { material } of variants.values()) material.dispose(); },
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

// Bake an assembled-pose contact plate once. Each foot tip is read from the
// source mesh in world space; the moving detail views never show this plate.
function contactFootprint(model, partsByName) {
  const span = .68, resolution = 512;
  const surface = document.createElement('canvas');
  surface.width = surface.height = resolution;
  const context = surface.getContext('2d');
  const pixel = value => (value / span + .5) * resolution;
  function patch(x, z, rx, rz, opacity, angle = 0) {
    context.save();
    context.translate(pixel(x), pixel(z));
    context.rotate(angle);
    context.scale(rx / span * resolution, rz / span * resolution);
    const shadow = context.createRadialGradient(0, 0, 0, 0, 0, 1);
    shadow.addColorStop(0, `rgba(41,36,31,${opacity})`);
    shadow.addColorStop(.48, `rgba(41,36,31,${opacity * .61})`);
    shadow.addColorStop(1, 'rgba(41,36,31,0)');
    context.fillStyle = shadow;
    context.fillRect(-1, -1, 2, 2);
    context.restore();
  }
  model.updateWorldMatrix(true, true);
  patch(.011, -.011, .178, .148, .21);
  const point = new THREE.Vector3(), toe = new THREE.Vector3();
  for (let leg = 1; leg <= 6; leg++) {
    const tibia = model.getObjectByName(`Hex_leg_${leg}_tibia_1`);
    const vertices = tibia.geometry.getAttribute('position');
    let minimum = Infinity;
    for (let i = 0; i < vertices.count; i++) {
      point.fromBufferAttribute(vertices, i).applyMatrix4(tibia.matrixWorld);
      if (point.y < minimum) { minimum = point.y; toe.copy(point); }
    }
    const coxa = partsByName.get(`Hex_leg_${leg}_coxa_motor_1`).center;
    const angle = Math.atan2(toe.z - coxa[2], toe.x - coxa[0]);
    const spanLeg = Math.hypot(toe.x - coxa[0], toe.z - coxa[2]);
    patch((coxa[0] + toe.x) / 2 + .010, (coxa[2] + toe.z) / 2 - .012,
      spanLeg * .65, .044, .13, angle);
    patch(toe.x + .002, toe.z - .002, .028, .018, .22, angle);
    patch(toe.x, toe.z, .010, .0065, .48, angle);
  }
  const map = new THREE.CanvasTexture(surface);
  map.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(span, span), new THREE.MeshBasicMaterial({
    map, transparent: true, depthWrite: false, toneMapped: false,
  }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -.0004;
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

// A private transform hierarchy lets the presentation move the original hardware
// even if free exploration is paused partway through a different pose. Geometry,
// source textures, the studio environment and the render targets remain shared.
function cloneRestPose(source, poses) {
  const node = source.clone(false);
  const rest = poses.get(source);
  if (rest) {
    node.position.copy(rest.position);
    node.quaternion.copy(rest.quaternion);
    node.scale.copy(rest.scale);
    node.matrix.copy(rest.matrix);
    node.matrixAutoUpdate = rest.matrixAutoUpdate;
  }
  for (const child of source.children) node.add(cloneRestPose(child, poses));
  return node;
}

// Place the paper behind the tone-mapped artwork, like the independent stage's
// transparent canvas. Mixing ink into an HDR background before tone mapping
// would wash out the dashed leaders and contact shadows.
function makePaperPass() {
  return new ShaderPass({
    uniforms: { tDiffuse: { value: null }, toneMappingExposure: { value: 1 } },
    vertexShader: CopyShader.vertexShader,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      varying vec2 vUv;
      #include <tonemapping_pars_fragment>
      void main() {
        vec4 sampleColor = texture2D(tDiffuse, vUv);
        vec3 surface = sampleColor.rgb / max(sampleColor.a, 0.0001);
        vec3 ink = sRGBTransferOETF(vec4(NeutralToneMapping(surface), 1.)).rgb;
        vec3 paper = vec3(242., 241., 237.) / 255.;
        gl_FragColor = vec4(mix(paper, ink, sampleColor.a), 1.);
      }`
  });
}

export function createOrbitalStage(options) {
  const releases = [];
  function dispose() {
    while (releases.length) releases.pop()();
  }
  try {
    return mountStage(options, fn => releases.push(fn), dispose);
  } catch (error) {
    dispose();
    throw error;
  }
}

function mountStage({ explorer, onTakeover, onTick, onStation, onEmphasis, reducedMotion = false }, onDispose, dispose) {
  if (!explorer.ready || !explorer.operationSampler?.clip || explorer.presentationStage) {
    throw new Error('The orbital presentation requires a ready assembly and its authored motion.');
  }
  const { renderer, metadata, mount } = explorer;
  const canvas = renderer.domElement;
  const partsByName = new Map(metadata.parts.map(part => [part.meshName, part]));
  const viewPoints = {
    overview: metadata.parts.flatMap(part => corners(part.bounds)),
    leg: metadata.parts.filter(part => part.group === 'hex-leg-1').flatMap(part => corners(part.cycleBounds)),
  };
  const world = new THREE.Scene();
  world.add(createEngineeringLights());
  world.environment = explorer.scene.environment;
  world.environmentIntensity = .92;
  const camera = new THREE.PerspectiveCamera(26, 1, .001, 7);
  const viewPass = new RenderPass(world, camera);
  viewPass.clearColor = new THREE.Color(0);
  viewPass.clearAlpha = 0;
  const paperPass = makePaperPass();
  onDispose(() => viewPass.dispose());
  onDispose(() => paperPass.dispose());
  const passes = [viewPass, paperPass, explorer.fxaa];
  const oldTouchAction = canvas.style.touchAction;
  const oldCursor = canvas.style.cursor;
  const controls = new OrbitControls(camera, canvas);
  onDispose(() => {
    controls.dispose();
    canvas.style.touchAction = oldTouchAction;
    canvas.style.cursor = oldCursor;
    delete canvas.dataset.chapter;
  });
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
  onDispose(() => abort.abort());
  const spatialOrbit = createSpatialOrbit({ camera, canvas, metadata, onEmphasis });
  onDispose(() => disposeGeometry(spatialOrbit.root));
  world.add(spatialOrbit.root);

  let chapter = 'overview', progress = 0, shot = null, rotating = false, playing = false;
  let disposed = false, started = false, frames = 0, manualView = false;
  let press = null, hovering = false, focused = false;
  const source = cloneRestPose(explorer.sourceRoot, explorer.operationSampler.rest);
  const gltf = { scene: source, animations: [explorer.operationSampler.clip] };
  const modelMeshes = [];
  source.traverse(node => { if (node.isMesh) modelMeshes.push(node); });
  const surfaces = createSurfaces(gltf, partsByName);
  onDispose(() => surfaces.dispose());
  const footprint = contactFootprint(source, partsByName);
  onDispose(() => disposeGeometry(footprint));
  const action = createChapterAction(gltf, metadata);
  onDispose(() => action.dispose());
  world.add(source, footprint);
  spatialOrbit.blockersFrom(modelMeshes);

  function wake() {
    if (started && !disposed && !document.hidden) explorer.invalidate();
  }
  function takeover() {
    if (!started) return;
    rotating = playing = false; manualView = true;
    controls.autoRotate = false;
    if (shot) { shot = null; surfaces.fade(1); }
    setHover(null);
    onTakeover?.();
    wake();
  }
  controls.addEventListener('start', () => {
    if (!press) takeover();
  });
  controls.addEventListener('end', wake);
  function setHover(id) {
    hovering = Boolean(id);
    canvas.style.cursor = id ? 'pointer' : '';
    if (spatialOrbit.setHover(id)) wake();
  }
  function setStationFocus(id) {
    focused = Boolean(id);
    if (spatialOrbit.setFocus(id)) wake();
  }
  // A stationary hit opens a chapter. Dragging or a second finger takes
  // control of the camera, including when the gesture starts on a bead.
  const pointerOptions = { capture: true, signal: abort.signal };
  canvas.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) {
      if (press) { press = null; takeover(); }
      return;
    }
    const id = started && spatialOrbit.pick(event);
    press = id ? { id, x: event.clientX, y: event.clientY, pointer: event.pointerId } : null;
    if (press) setHover(id);
  }, pointerOptions);
  canvas.addEventListener('pointermove', event => {
    if (press && event.pointerId === press.pointer &&
        Math.hypot(event.clientX - press.x, event.clientY - press.y) > (event.pointerType === 'touch' ? 8 : 5)) {
      press = null; takeover();
    }
    if (!event.buttons && event.pointerType !== 'touch') setHover(started ? spatialOrbit.pick(event) : null);
  }, pointerOptions);
  canvas.addEventListener('pointerup', event => {
    if (!press || press.pointer !== event.pointerId) return;
    const { id, x, y } = press;
    press = null;
    if (event.pointerType === 'touch') setHover(null);
    if (Math.hypot(event.clientX - x, event.clientY - y) >= (event.pointerType === 'touch' ? 8 : 5)) return;
    if (spatialOrbit.pick(event) === id) queueMicrotask(() => { if (!disposed) onStation?.(id); });
  }, pointerOptions);
  canvas.addEventListener('pointercancel', () => { press = null; setHover(null); }, pointerOptions);
  canvas.addEventListener('pointerleave', () => setHover(null), pointerOptions);
  controls.addEventListener('change', wake);
  mount.addEventListener('keydown', event => {
    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', '_'];
    if (!started || !keys.includes(event.key) || event.altKey || event.ctrlKey || event.metaKey) return;
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

  function frameChapter(immediate, direction) {
    const width = mount.clientWidth, height = mount.clientHeight;
    if (!(width && height)) return;
    camera.aspect = width / height;
    camera.setViewOffset(width, height, 0, height * .02, width, height);
    const end = fitCamera(chapter, action.bounds(chapter), camera, width, height, viewPoints, direction);
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

  let previousWidth = 0, previousHeight = 0;
  function resize() {
    const width = mount.clientWidth, height = mount.clientHeight;
    if (!(width > 0 && height > 0)) return;
    camera.aspect = width / height;
    camera.setViewOffset(width, height, 0, height * .02, width, height);
    camera.updateProjectionMatrix();
    // A drawer, caption or phone rotation can change just the height. Fit the
    // track to the new rectangle while preserving the current orbit direction.
    if (!manualView && (width !== previousWidth || height !== previousHeight)) {
      if (!shot) {
        const direction = previousWidth ? camera.position.clone().sub(controls.target).normalize() : undefined;
        frameChapter(true, direction);
      } else {
        const end = fitCamera(chapter, action.bounds(chapter), camera, width, height, viewPoints);
        end.spherical.theta = shot.start.theta + Math.atan2(Math.sin(end.spherical.theta - shot.start.theta), Math.cos(end.spherical.theta - shot.start.theta));
        shot.end = end;
      }
    }
    previousWidth = width;
    previousHeight = height;
    wake();
  }
  function render(elapsed) {
    const dt = Math.min(.075, elapsed);
    if (shot) {
      shot.elapsed += dt;
      moveCamera(Math.min(1, shot.elapsed / .55));
    } else {
      controls.autoRotate = rotating && chapter === 'overview' && !hovering && !focused && !press;
      if (controls.autoRotate) controls.update(dt);
      if (playing) onTick?.(elapsed);
    }
    spatialOrbit.update(dt, Boolean(shot));
    // Reuse the Explorer's full-size buffers and edge smoothing, including
    // when the free view was left in a linework style.
    const composer = explorer.composer;
    const normalPasses = composer.passes;
    const fxaaEnabled = explorer.fxaa.enabled;
    try {
      composer.passes = passes;
      explorer.fxaa.enabled = true;
      renderer.info.reset();
      composer.render(dt);
      frames++;
    } finally {
      composer.passes = normalPasses;
      explorer.fxaa.enabled = fxaaEnabled;
    }
    return Boolean(shot || spatialOrbit.animating || playing || controls.autoRotate);
  }

  function setChapter(value) {
    if (!Object.hasOwn(angles, value)) return;
    chapter = value; progress = 0; manualView = false;
    press = null; setHover(null); setStationFocus(null);
    spatialOrbit.setEnabled(chapter === 'overview', reducedMotion);
    canvas.dataset.chapter = value;
    footprint.visible = chapter === 'overview';
    action.setChapter(chapter);
    surfaces.target(chapter);
    frameChapter(reducedMotion);
  }
  function setProgress(value) {
    progress = THREE.MathUtils.clamp(value, 0, 1);
    action.setProgress(progress);
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
      spatialOrbit.setEnabled(chapter === 'overview', true);
    }
    wake();
  }

  const detach = explorer.attachPresentationStage({ render, resize, dispose });
  onDispose(() => {
    disposed = true;
    detach();
    world.clear();
  });
  started = true;
  resize();
  action.setChapter(chapter);
  surfaces.target(chapter);
  spatialOrbit.setEnabled(true, true);
  frameChapter(true);
  wake();
  return {
    setChapter, setProgress, setPlaying, setRotating, setReducedMotion, setStationFocus, dispose,
    stats: () => ({
      orbit: spatialOrbit.stats(), frames, chapter, playing, rotating, progress, transitioning: Boolean(shot),
      camera: camera.position.toArray(), target: controls.target.toArray(), pixelRatio: renderer.getPixelRatio(),
      calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
      meshes: modelMeshes.length, visibleMeshes: modelMeshes.filter(mesh => mesh.visible).length,
    }),
  };
}
