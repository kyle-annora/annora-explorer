import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VIEWER_CAPABILITIES, VIEWER_COORDINATE_FRAME, assertNotAborted, normalizeViewerSnapshot, resolveFixtureParts } from './viewer-state.js';

const EMBER = 0xff6840;
const FINISHES = {
  structure: [0x69747d, 0.34, 0.27], satin: [0xb7bdc1, 0.3, 0.4],
  machined: [0x8c969c, 0.34, 0.3], polished: [0xc8ced1, 0.2, 0.5],
  indicator: [0xebe7df, 0.5, 0.1],
  bronze: [0xb89b72, 0.36, 0.35], coated: [0x777c7e, 0.48, 0.16],
  fastener: [0x525b61, 0.3, 0.42], polymer: [0x32383c, 0.7, 0.02],
};

function disposeTree(root) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  root?.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    for (const material of (Array.isArray(object.material) ? object.material : [object.material])) {
      if (!material) continue;
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  textures.forEach(texture => texture.dispose());
  materials.forEach(material => material.dispose());
  geometries.forEach(geometry => geometry.dispose());
}

async function fetchChecked(url, signal, type) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`The example model could not load (${response.status}).`);
  return type === 'json' ? response.json() : response.arrayBuffer();
}

/** A standalone Three.js viewer. No Annora renderer, controller, iframe or model runtime. */
export async function createExistingViewer({ element, modelUrl, fixtureUrl = './fixture.json', onSelection, signal } = {}) {
  assertNotAborted(signal);
  if (!element || !modelUrl) throw new TypeError('Provide a viewer element and model URL.');
  const abortController = new AbortController();
  const abort = () => abortController.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const ownsCanvas = element.tagName !== 'CANVAS';
  const canvas = ownsCanvas ? document.createElement('canvas') : element;
  const host = ownsCanvas ? element : canvas.parentElement;
  const removers = [], listeners = new Set(), edgeCache = new Map(), activePointers = new Set();
  let renderer, controls, scene, model, resizeObserver, frame = 0;
  let disposed = false, selectedId = null, hoverId = null, pointerStart = null, pendingPointer = null;
  let parts, fixture, meshes = [], selectedOutline, hoverOutline, camera, rootBounds;
  let lastWidth = 0, lastHeight = 0, renderCount = 0;

  function listen(target, type, fn, options) {
    target.addEventListener(type, fn, options);
    removers.push(() => target.removeEventListener(type, fn, options));
  }
  function assertLive(operationSignal) {
    assertNotAborted(operationSignal);
    assertNotAborted(abortController.signal);
    if (disposed) throw new Error('The independent viewer has been disposed.');
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    abortController.abort();
    signal?.removeEventListener('abort', abort);
    cancelAnimationFrame(frame);
    frame = 0;
    resizeObserver?.disconnect();
    removers.splice(0).forEach(remove => remove());
    controls?.dispose();
    listeners.clear();
    edgeCache.forEach(geometry => geometry.dispose());
    edgeCache.clear();
    selectedOutline?.material.dispose();
    hoverOutline?.material.dispose();
    selectedOutline?.removeFromParent();
    hoverOutline?.removeFromParent();
    disposeTree(scene || model);
    renderer?.dispose();
    renderer?.forceContextLoss();
    if (ownsCanvas) canvas.remove();
  }

  try {
    const [loadedFixture, buffer] = await Promise.all([
      fetchChecked(fixtureUrl, abortController.signal, 'json'),
      fetchChecked(modelUrl, abortController.signal, 'buffer'),
    ]);
    assertLive(signal);
    fixture = loadedFixture;
    if (!globalThis.crypto?.subtle) throw new Error('A secure browser context is required to verify the example model.');
    const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', buffer))].map(n => n.toString(16).padStart(2, '0')).join('');
    if (digest !== fixture.source.sha256) throw new Error('The loaded model differs from the pinned example revision.');
    assertLive(signal);
    const gltf = await new GLTFLoader().parseAsync(buffer, new URL('.', new URL(modelUrl, location.href)).href);
    model = gltf.scene;
    assertLive(signal);
    model.updateMatrixWorld(true);
    model.traverse(object => { if (object.isMesh) meshes.push(object); });
    parts = resolveFixtureParts(fixture, meshes);
    const originalMaterials = new Set();
    const finishMaterials = new Map();
    for (const { part, mesh } of parts.values()) {
      for (const material of (Array.isArray(mesh.material) ? mesh.material : [mesh.material])) originalMaterials.add(material);
      const family = part.finishFamily in FINISHES ? part.finishFamily : 'satin';
      if (!finishMaterials.has(family)) {
        const [color, roughness, metalness] = FINISHES[family];
        finishMaterials.set(family, new THREE.MeshStandardMaterial({ color, roughness, metalness }));
      }
      mesh.material = finishMaterials.get(family);
      mesh.userData.fixturePartId = part.id;
    }
    originalMaterials.forEach(material => material?.dispose());

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, matchMedia('(pointer: coarse)').matches || innerWidth < 760 ? 1.5 : 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf3f3f1);
    scene.add(model);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x707880, 3.1));
    const key = new THREE.DirectionalLight(0xfff7e9, 3.6);
    key.position.set(0.7, 1.5, 1.2);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xc6d8ec, 2.1);
    fill.position.set(-1, 0.8, -0.6);
    scene.add(fill);
    rootBounds = new THREE.Box3().setFromObject(model, true);
    camera = new THREE.PerspectiveCamera(35, 1, 0.0001, 20);
    camera.up.set(0, 1, 0);
    controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    controls.minDistance = 0.003;
    controls.maxDistance = 10;
    controls.screenSpacePanning = true;
    controls.rotateSpeed = 0.65;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.setAttribute('aria-label', 'Interactive crank-slider model. Drag to rotate, scroll or pinch to zoom, and select a component.');
    canvas.tabIndex = 0;
    if (ownsCanvas) element.append(canvas);

    const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
    function pick(pointer) {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      ndc.set((pointer.clientX - rect.left) / rect.width * 2 - 1, -(pointer.clientY - rect.top) / rect.height * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      return raycaster.intersectObjects(meshes, false)[0]?.object.userData.fixturePartId || null;
    }
    function outline(id, previous, opacity) {
      if (previous) { previous.removeFromParent(); previous.material.dispose(); }
      if (!id) return null;
      const mesh = parts.get(id).mesh;
      if (!edgeCache.has(id)) edgeCache.set(id, new THREE.EdgesGeometry(mesh.geometry, 30));
      const line = new THREE.LineSegments(edgeCache.get(id), new THREE.LineBasicMaterial({ color: EMBER, transparent: true, opacity, depthTest: true, depthWrite: false }));
      line.raycast = () => {};
      line.renderOrder = 2;
      mesh.add(line);
      return line;
    }
    function setHover(id) {
      const next = id === selectedId ? null : id;
      if (hoverId === next) return;
      hoverId = next;
      hoverOutline = outline(next, hoverOutline, 0.8);
      canvas.style.cursor = id ? 'pointer' : 'grab';
      invalidate();
    }
    function state() {
      const part = selectedId ? parts.get(selectedId).part : null;
      return {
        ready: !disposed, modelId: fixture.modelId, modelRevision: fixture.modelRevision,
        selectedPart: part ? { id: part.id, title: part.title, group: part.group } : null,
        capabilities: { ...VIEWER_CAPABILITIES },
      };
    }
    function emit() { const current = state(); listeners.forEach(listener => listener(current)); }
    function selectPart(id) {
      assertLive();
      if (id !== null && !parts.has(id)) throw new TypeError('Unknown component in the pinned model.');
      if (id === selectedId) return;
      selectedId = id;
      selectedOutline = outline(id, selectedOutline, 1);
      setHover(null);
      invalidate();
      emit();
      onSelection?.(state().selectedPart);
    }
    function frameBounds(bounds, direction) {
      const center = bounds.getCenter(new THREE.Vector3());
      const radius = bounds.getSize(new THREE.Vector3()).length() / 2;
      const vertical = THREE.MathUtils.degToRad(camera.fov) / 2;
      const halfAngle = Math.min(vertical, Math.atan(Math.tan(vertical) * camera.aspect));
      const distance = Math.max(0.018, radius / Math.sin(halfAngle) * 1.15);
      controls.target.copy(center);
      camera.position.copy(center).addScaledVector(direction.clone().normalize(), distance);
      camera.lookAt(center);
      controls.update();
      invalidate();
      emit();
    }
    function reset() {
      assertLive();
      camera.fov = 35;
      camera.zoom = 1;
      camera.updateProjectionMatrix();
      frameBounds(rootBounds, new THREE.Vector3(...fixture.defaultDirection));
    }
    function fitSelection() {
      assertLive();
      const bounds = selectedId ? new THREE.Box3().setFromObject(parts.get(selectedId).mesh, true) : rootBounds;
      frameBounds(bounds, camera.position.clone().sub(controls.target));
    }
    function resize() {
      if (disposed) return;
      const rect = (host || canvas).getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width)), height = Math.max(1, Math.round(rect.height));
      if (width === lastWidth && height === lastHeight) return;
      const first = !lastWidth || !lastHeight;
      lastWidth = width; lastHeight = height;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      if (first) reset();
      invalidate();
    }
    function invalidate() {
      if (!disposed && !frame && !document.hidden) frame = requestAnimationFrame(render);
    }
    function render() {
      frame = 0;
      if (disposed || document.hidden) return;
      if (pendingPointer) { setHover(pick(pendingPointer)); pendingPointer = null; }
      controls.update();
      renderer.render(scene, camera);
      renderCount++;
    }
    controls.addEventListener('change', invalidate);
    controls.addEventListener('end', emit);
    removers.push(() => { controls.removeEventListener('change', invalidate); controls.removeEventListener('end', emit); });
    listen(canvas, 'pointerdown', event => {
      activePointers.add(event.pointerId);
      pointerStart = activePointers.size === 1 ? { x: event.clientX, y: event.clientY, id: event.pointerId } : null;
      pendingPointer = null;
      setHover(null);
    });
    listen(canvas, 'pointermove', event => {
      if (activePointers.size || event.pointerType === 'touch') return;
      pendingPointer = { clientX: event.clientX, clientY: event.clientY };
      invalidate();
    });
    listen(canvas, 'pointerup', event => {
      if (activePointers.size === 1 && pointerStart?.id === event.pointerId && Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) < 5) selectPart(pick(event));
      pointerStart = null;
    });
    listen(canvas, 'pointercancel', event => { activePointers.delete(event.pointerId); pointerStart = null; setHover(null); });
    listen(canvas, 'pointerleave', () => { pendingPointer = null; setHover(null); });
    listen(window, 'pointerup', event => { activePointers.delete(event.pointerId); pointerStart = null; });
    listen(document, 'visibilitychange', () => {
      if (document.hidden) { cancelAnimationFrame(frame); frame = 0; }
      else invalidate();
    });
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host || canvas);
    resize();

    return {
      version: '1', id: 'annora-example-three-viewer', adapterVersion: '1',
      coordinateFrame: VIEWER_COORDINATE_FRAME, capabilities: VIEWER_CAPABILITIES,
      getState: state,
      getParts: () => fixture.parts.map(({ id, title, group }) => ({ id, title, group })),
      subscribe(listener) { assertLive(); if (typeof listener !== 'function') throw new TypeError('Provide a state listener.'); listeners.add(listener); listener(state()); return () => listeners.delete(listener); },
      selectPart, fitSelection, reset,
      async capture({ signal: operationSignal } = {}) {
        assertLive(operationSignal);
        const snapshot = normalizeViewerSnapshot({
          schemaVersion: 1, modelId: fixture.modelId, modelRevision: fixture.modelRevision,
          coordinateFrame: VIEWER_COORDINATE_FRAME, selectedPartId: selectedId,
          camera: {
            position: camera.position.toArray(), target: controls.target.toArray(), up: camera.up.toArray(),
            projection: { fov: camera.fov, zoom: camera.zoom, near: camera.near, far: camera.far },
          },
        }, fixture);
        const part = selectedId ? parts.get(selectedId).part : null;
        return { ...(part ? { part: { id: part.id, title: part.title } } : {}), snapshot };
      },
      async restore(snapshot, { signal: operationSignal } = {}) {
        assertLive(operationSignal);
        const checked = normalizeViewerSnapshot(snapshot, fixture);
        assertLive(operationSignal);
        // Reset controller inertia before atomically applying an explicitly reviewed view.
        controls.enableDamping = false;
        controls.update();
        camera.position.fromArray(checked.camera.position);
        camera.up.fromArray(checked.camera.up);
        Object.assign(camera, checked.camera.projection);
        controls.target.fromArray(checked.camera.target);
        camera.updateProjectionMatrix();
        camera.lookAt(controls.target);
        controls.update();
        controls.enableDamping = true;
        selectPart(checked.selectedPartId);
        invalidate();
        emit();
      },
      getDiagnostics: () => ({
        renderCount, canvases: 1, drawingBufferDpr: renderer.getPixelRatio(),
        meshes: meshes.length, triangles: fixture.stats.triangles,
        idleLoop: 'on-demand', motion: 'static source pose',
        camera: {
          position: camera.position.toArray(), target: controls.target.toArray(), up: camera.up.toArray(),
          projection: { fov: camera.fov, zoom: camera.zoom, near: camera.near, far: camera.far },
        },
      }),
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
