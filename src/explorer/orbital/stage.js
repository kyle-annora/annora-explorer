import * as THREE from 'three';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { CopyShader } from 'three/addons/shaders/CopyShader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createEngineeringLights } from '../engineering.js';
import { createModelAction } from './model-action.js';
import { createStationOutline } from './station-outline.js';
import { createPoseTransition, readScreenFrame, applyScreenFrame } from './scene-continuity.js';
import { createSpatialOrbit } from './orbit.js';
import { createSurfaceCallout } from './surface-callout.js';

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
function fitCamera(chapter, bounds, camera, width, height, viewPoints, orbitPoints, direction) {
  direction = direction || new THREE.Vector3(...chapter.direction).normalize();
  const points = viewPoints[chapter.id] || corners([bounds.min.toArray(), bounds.max.toArray()]);
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
  const overview = chapter.id === 'overview';
  const [standardX, fillY] = chapter.fill || (overview ? [.71, .84] : [.91, .93]);
  const fillX = overview && portrait ? .88 : standardX;
  const aspect = width / height;
  const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  let radius = .01;
  for (const [x, y, z] of projected) {
    radius = Math.max(radius, Math.abs(x - midX) / (aspect * tangent * fillX) + z, Math.abs(y - midY) / (tangent * fillY) + z);
  }
  if (overview) {
    // Fit the attached navigation to the same camera. Always reserve space
    // for a station at each edge even on a narrow portrait canvas.
    for (const point of orbitPoints) {
      const delta = point.clone().sub(center), z = delta.dot(direction);
      radius = Math.max(radius, Math.abs(delta.dot(right)) / (aspect * tangent * .90) + z,
        Math.abs(delta.dot(up)) / (tangent * .86) + z);
    }
  }
  return { center, spherical: new THREE.Spherical().setFromVector3(direction.multiplyScalar(radius)) };
}

function smooth(t) { return t * t * (3 - 2 * t); }

function createSurfaces(gltf, partsByName, colors = {}) {
  // Materials are shared within each visibility group, so a whole assembly
  // can recede during a camera cut without allocating per-frame materials.
  const variants = new Map();
  gltf.scene.traverse(mesh => {
    if (!mesh.isMesh) return;
    const part = partsByName.get(mesh.name);
    if (!part) return;
    const group = part.group;
    const source = mesh.material;
    const key = group + source.uuid;
    if (!variants.has(key)) {
      const material = source.clone();
      if (colors[source.name] && material.color) material.color.set(colors[source.name]);
      material.forceSinglePass = true;
      variants.set(key, { group, material, meshes: [], from: 1, to: 1, weight: 1,
        opacity: source.opacity, transparent: source.transparent, depthWrite: source.depthWrite });
    }
    const variant = variants.get(key);
    variant.meshes.push(mesh);
    mesh.material = variant.material;
  });
  return {
    dispose() { for (const { material } of variants.values()) material.dispose(); },
    target(chapter) {
      for (const variant of variants.values()) {
        variant.from = variant.weight;
        variant.to = Number(chapter.id === 'overview' || !chapter.groups || chapter.groups.includes(variant.group));
      }
    },
    fade(progress) {
      for (const variant of variants.values()) {
        const weight = THREE.MathUtils.lerp(variant.from, variant.to, progress);
        const fading = weight > 0 && weight < 1;
        const transparent = fading || variant.transparent;
        if (variant.material.transparent !== transparent) {
          variant.material.transparent = transparent;
          variant.material.needsUpdate = true;
        }
        variant.material.depthWrite = fading ? false : variant.depthWrite;
        variant.material.opacity = variant.opacity * weight;
        variant.weight = weight;
        for (const mesh of variant.meshes) mesh.visible = weight > 0;
      }
    },
  };
}

// Bake an assembled-pose contact plate once. Each foot tip is read from the
// source mesh in world space; the moving detail views never show this plate.
function contactFootprint(model, partsByName, config) {
  if (!config) return null;
  const { span, feet = [] } = config, resolution = 512;
  const surface = document.createElement('canvas');
  surface.width = surface.height = resolution;
  const context = surface.getContext('2d');
  if (!context) return null;
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
  patch(...(config.body || [.011, -.011, span * .262, span * .218, .21]));
  const point = new THREE.Vector3(), toe = new THREE.Vector3();
  for (const { tip, hip } of feet) {
    const foot = model.getObjectByName(tip);
    const joint = partsByName.get(hip);
    if (!foot?.geometry || !joint) continue;
    const vertices = foot.geometry.getAttribute('position');
    let minimum = Infinity;
    for (let i = 0; i < vertices.count; i++) {
      point.fromBufferAttribute(vertices, i).applyMatrix4(foot.matrixWorld);
      if (point.y < minimum) { minimum = point.y; toe.copy(point); }
    }
    const anchor = joint.center;
    const angle = Math.atan2(toe.z - anchor[2], toe.x - anchor[0]);
    const spanLeg = Math.hypot(toe.x - anchor[0], toe.z - anchor[2]);
    patch((anchor[0] + toe.x) / 2 + .010, (anchor[2] + toe.z) / 2 - .012,
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
  const rest = poses?.get(source);
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

function mountStage({ explorer, guide, getAccent, onTakeover, onTick, onStation, onEmphasis, onCallout, onExplanation, getCalloutInset, reducedMotion = false }, onDispose, dispose) {
  if (!explorer.ready || !explorer.sourceRoot || explorer.presentationStage) {
    throw new Error('The orbital presentation requires a ready assembly.');
  }
  const { renderer, metadata, mount } = explorer;
  const canvas = renderer.domElement;
  const partsByName = new Map(metadata.parts.map(part => [part.meshName, part]));
  const chapters = new Map(guide.chapters.map(record => [record.id, record]));
  const viewPoints = {};
  for (const record of chapters.values()) {
    if (record.fit === 'action') continue;
    const overview = record.id === 'overview';
    const members = metadata.parts.filter(part => overview || !record.groups || record.groups.includes(part.group));
    if (members.length) viewPoints[record.id] = members.flatMap(part =>
      corners(overview ? part.bounds : (part.cycleBounds || part.bounds)));
  }
  const world = new THREE.Scene();
  world.add(createEngineeringLights());
  world.environment = explorer.scene.environment;
  world.environmentIntensity = .92;
  const span = Math.max(...metadata.bounds[1].map((value, i) => value - metadata.bounds[0][i]), .00001);
  const camera = new THREE.PerspectiveCamera(26, 1, span / 500, span * 24);
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
  let emphasizedStation = null;
  const spatialOrbit = createSpatialOrbit({ camera, canvas, metadata, orbitConfig: guide.orbit, getAccent,
    useLabelLeader: id => Boolean(onCallout && chapters.get(id)?.hint),
    onEmphasis(id) { emphasizedStation = id; onEmphasis?.(id); } });
  onDispose(() => disposeGeometry(spatialOrbit.root));
  world.add(spatialOrbit.root);

  let chapter = 'overview', progress = 0, shot = null, rotating = false, playing = false;
  let disposed = false, started = false, frames = 0, manualView = false;
  let press = null, hovering = false, focused = false;
  let holdTimer, lingerTimer;
  function clearTouchPreview() {
    clearTimeout(holdTimer); clearTimeout(lingerTimer);
    holdTimer = lingerTimer = undefined;
  }
  onDispose(clearTouchPreview);
  const sampler = explorer.operationSampler;
  const source = cloneRestPose(explorer.sourceRoot, sampler?.rest);
  const gltf = { scene: source, animations: sampler?.clip ? [sampler.clip] : [] };
  const modelMeshes = [];
  source.traverse(node => { if (node.isMesh) modelMeshes.push(node); });
  const callout = onCallout && createSurfaceCallout({ camera, canvas, meshes: modelMeshes, partsByName, onPoint: onCallout });
  if (callout) onDispose(() => callout.hide());
  const surfaces = createSurfaces(gltf, partsByName, guide.surface?.colors);
  onDispose(() => surfaces.dispose());
  const footprint = contactFootprint(source, partsByName, guide.surface?.footprint);
  if (footprint) {
    world.add(footprint);
    onDispose(() => disposeGeometry(footprint));
  }
  const action = createModelAction(gltf, metadata, guide, getAccent?.());
  onDispose(() => action.dispose());
  world.add(source);
  const hardware = new Set(modelMeshes), marks = [];
  source.traverse(node => { if (node.material && !hardware.has(node)) marks.push(node); });
  if (footprint) marks.push(footprint);
  const poses = createPoseTransition(source, marks);

  spatialOrbit.blockersFrom(modelMeshes);
  const explanationTargets = guide.chapters.flatMap(chapter => chapter.explanation?.joints.map((joint, index) => ({
    id: chapter.id + ':' + index, anchor: { meshName: joint.highlightMesh },
  })) ?? []);
  const outline = createStationOutline({ scene: world, camera, renderer, meshes: modelMeshes,
    stations: [...guide.orbit.stations, ...explanationTargets], getAccent });
  passes.splice(passes.indexOf(explorer.fxaa), 0, outline.pass);
  onDispose(() => outline.dispose());

  function wake() {
    if (started && !disposed && !document.hidden) explorer.invalidate();
  }
  function takeover() {
    if (!started) return;
    clearTouchPreview();
    press = null;
    rotating = playing = false; manualView = true;
    controls.autoRotate = false;
    if (shot) shot.manualCamera = true;
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
    clearTouchPreview();
    if (!event.isPrimary || event.button !== 0) {
      if (press) takeover();
      return;
    }
    const id = started && spatialOrbit.pick(event);
    press = id ? { id, x: event.clientX, y: event.clientY, pointer: event.pointerId, held: false } : null;
    if (event.pointerType !== 'touch') { setHover(id || null); return; }
    setHover(null);
    if (!press) return;
    setStationFocus(null);
    const finger = press;
    holdTimer = setTimeout(() => {
      if (press === finger && spatialOrbit.pick(event) === id) {
        finger.held = true;
        setHover(id);
      }
    }, 350);
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
    const { id, x, y, held } = press;
    press = null;
    clearTimeout(holdTimer);
    if (held) {
      lingerTimer = setTimeout(() => {
        lingerTimer = undefined;
        setHover(null);
      }, 1800);
      return;
    }
    if (event.pointerType === 'touch') setHover(null);
    if (Math.hypot(event.clientX - x, event.clientY - y) >= (event.pointerType === 'touch' ? 8 : 5)) return;
    if (spatialOrbit.pick(event) === id) queueMicrotask(() => { if (!disposed) onStation?.(id); });
  }, pointerOptions);
  function clearPointer() { clearTouchPreview(); press = null; setHover(null); }
  canvas.addEventListener('contextmenu', event => {
    if (press?.held) event.preventDefault();
  }, pointerOptions);
  canvas.addEventListener('pointercancel', clearPointer, pointerOptions);
  canvas.addEventListener('pointerleave', event => {
    // A touch ends with pointerleave even when its intentional preview lingers.
    if (event.pointerType !== 'touch' || lingerTimer === undefined) clearPointer();
  }, pointerOptions);
  window.addEventListener('blur', clearPointer, { signal: abort.signal });
  document.addEventListener('pointerdown', event => {
    if (event.target !== canvas && lingerTimer !== undefined) clearPointer();
  }, { capture: true, signal: abort.signal });
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

  function calloutInset(width, height) {
    const inset = getCalloutInset?.(width, height) ?? 0;
    return Number.isFinite(inset) ? THREE.MathUtils.clamp(inset, 0, Math.max(0, width - 1)) : 0;
  }

  function destination(width, height, direction) {
    return fitCamera(chapters.get(chapter), action.bounds(chapter), camera, width - calloutInset(width, height), height,
      viewPoints, spatialOrbit.framePoints, direction);
  }

  function projection(width, height) {
    camera.zoom = 1;
    camera.setViewOffset(width, height, -calloutInset(width, height) / 2, height * .02, width, height);
  }

  function frameChapter(immediate, direction, originFrame, duration = 700) {
    const width = mount.clientWidth, height = mount.clientHeight;
    if (!(width && height)) return;
    const start = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    projection(width, height);
    const end = destination(width, height, direction);
    end.spherical.theta = start.theta + Math.atan2(Math.sin(end.spherical.theta - start.theta), Math.cos(end.spherical.theta - start.theta));
    // A user can approach a part much closer than its next preset permits.
    // Include that starting distance until the flight completes.
    controls.minDistance = Math.min(start.radius, Math.max(span * .036, end.spherical.radius * .18));
    controls.maxDistance = Math.max(start.radius, end.spherical.radius * 4, span * 1.6);
    camera.far = Math.max(span * 24, controls.maxDistance + span * 2);
    camera.updateProjectionMatrix();
    shot = { start, end, origin: controls.target.clone(), originFrame, duration,
      started: null, progress: 0, manualCamera: false, pose: Boolean(originFrame) };
    moveCamera(immediate ? 1 : 0);
    wake();
  }

  function moveCamera(fraction) {
    const current = shot;
    const { start, end, origin, originFrame } = current;
    const t = smooth(fraction);
    current.progress = fraction;
    if (!current.manualCamera) {
      if (originFrame) {
        const rect = canvas.getBoundingClientRect();
        applyScreenFrame(camera, rect, originFrame, t, -calloutInset(rect.width, rect.height) / 2, rect.height * .02);
      }
      const angle = new THREE.Spherical(
        t === 1 ? end.spherical.radius : start.radius * Math.pow(end.spherical.radius / start.radius, t),
        THREE.MathUtils.lerp(start.phi, end.spherical.phi, t),
        THREE.MathUtils.lerp(start.theta, end.spherical.theta, t),
      );
      controls.target.lerpVectors(origin, end.center, t);
      camera.position.setFromSpherical(angle).add(controls.target);
      controls.autoRotate = false;
      controls.update();
    }
    if (current.pose) poses.apply(t);
    surfaces.fade(t);
    if (fraction === 1) {
      const radius = camera.position.distanceTo(controls.target);
      controls.minDistance = Math.min(radius, Math.max(span * .036, end.spherical.radius * .18));
      controls.maxDistance = Math.max(radius, end.spherical.radius * 4, span * 1.6);
      shot = null;
    }
  }

  let previousWidth = 0, previousHeight = 0, previousInset = 0;
  function resize() {
    const width = mount.clientWidth, height = mount.clientHeight;
    if (!(width > 0 && height > 0)) return;
    const inset = calloutInset(width, height);
    const changed = width !== previousWidth || height !== previousHeight || inset !== previousInset;
    if (changed && shot && !shot.manualCamera) {
      camera.aspect = width / height;
      const end = destination(width, height);
      end.spherical.theta = shot.start.theta + Math.atan2(Math.sin(end.spherical.theta - shot.start.theta), Math.cos(end.spherical.theta - shot.start.theta));
      shot.end = end;
      moveCamera(shot.progress);
    } else if (changed) {
      projection(width, height);
      if (!manualView && !shot) {
        const direction = previousWidth ? camera.position.clone().sub(controls.target).normalize() : undefined;
        frameChapter(true, direction);
      }
    }
    previousWidth = width;
    previousHeight = height;
    previousInset = inset;
    wake();
  }
  function render(elapsed) {
    const dt = Math.min(.075, elapsed);
    if (shot) {
      // Start at the first drawn frame, not the time since the last gesture.
      const now = performance.now();
      shot.started ??= now;
      moveCamera(Math.min(1, (now - shot.started) / shot.duration));
    } else {
      controls.autoRotate = rotating && chapter === 'overview' && !hovering && !focused && !press;
      if (controls.autoRotate) controls.update(dt);
      if (playing) onTick?.(elapsed);
    }
    spatialOrbit.update(dt, Boolean(shot), !shot || shot.progress >= .75);
    const explanation = action.explanationFrame();
    outline.sync(shot ? null : chapter === 'overview' ? emphasizedStation :
      explanation?.activeIndex >= 0 ? chapter + ':' + explanation.activeIndex : null);
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
      // The renderer has now evaluated the current camera and posed hierarchy.
      callout?.update(Boolean(shot));
      frames++;
    } finally {
      composer.passes = normalPasses;
      explorer.fxaa.enabled = fxaaEnabled;
    }
    return Boolean(shot || spatialOrbit.animating || playing || controls.autoRotate);
  }

  function captureChapterFrame() {
    if (reducedMotion || !mount.clientWidth || !mount.clientHeight) return null;
    return readScreenFrame(camera, canvas.getBoundingClientRect());
  }
  function captureView() {
    return { position: camera.position.toArray(), target: controls.target.toArray() };
  }
  function restoreView(view) {
    if (![view?.position, view?.target].every(value => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite))) return;
    // Complete visibility and projection as well as the camera flight. Otherwise
    // a revisited detail can retain the outgoing chapter's hidden surfaces.
    if (shot) moveCamera(1);
    else { poses.apply(1); surfaces.fade(1); }
    projection(mount.clientWidth, mount.clientHeight);
    camera.position.fromArray(view.position);
    controls.target.fromArray(view.target);
    const radius = camera.position.distanceTo(controls.target);
    controls.minDistance = Math.min(controls.minDistance, radius);
    controls.maxDistance = Math.max(controls.maxDistance, radius);
    manualView = true;
    controls.update();
    camera.updateMatrixWorld();
    callout?.invalidatePose();
    wake();
  }
  function setChapter(value, originFrame = null) {
    if (!chapters.has(value)) return;
    const previous = chapter;
    const travel = originFrame && !reducedMotion;
    if (travel) poses.capture();
    else poses.apply(1);
    chapter = value; progress = 0; manualView = false;
    clearPointer(); setStationFocus(null);
    spatialOrbit.setEnabled(chapter === 'overview', !travel);
    canvas.dataset.chapter = value;
    if (footprint) footprint.visible = chapter === 'overview';
    action.setChapter(chapter);
    onExplanation?.(action.explanationFrame());
    callout?.invalidatePose();
    surfaces.target(chapters.get(chapter));
    if (travel) poses.target();
    const duration = previous === 'overview' || value === 'overview' ? 720 : 660;
    frameChapter(!travel, undefined, travel ? originFrame : null, duration);
  }
  function setProgress(value) {
    if (shot?.pose) {
      // A scrub samples the mechanism immediately. Camera framing and contextual
      // visibility can complete independently while the user moves the slider.
      poses.apply(1);
      shot.pose = false;
    }
    progress = THREE.MathUtils.clamp(value, 0, 1);
    action.setProgress(progress);
    onExplanation?.(action.explanationFrame());
    callout?.invalidatePose();
    wake();
  }
  function setCalloutTarget(anchor) {
    if (!disposed && callout?.setTarget(anchor)) wake();
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
  surfaces.target(chapters.get(chapter));
  spatialOrbit.setEnabled(true, true);
  frameChapter(true);
  wake();
  return {
    reframeView() {
      if(disposed)return;
      manualView=false;
      frameChapter(true,camera.position.clone().sub(controls.target).normalize());
      wake();
    },
    captureChapterFrame, captureView, restoreView, setChapter, setProgress, setPlaying, setRotating, setReducedMotion, setStationFocus, setCalloutTarget, dispose,
    stats: () => ({
      orbit: spatialOrbit.stats(), frames, chapter, playing, rotating, progress, transitioning: Boolean(shot), chapterBlend: shot?.originFrame ? shot.progress : null,
      camera: camera.position.toArray(), target: controls.target.toArray(), pixelRatio: renderer.getPixelRatio(),
      calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
      meshes: modelMeshes.length, visibleMeshes: modelMeshes.filter(mesh => mesh.visible).length,
    }),
  };
}
