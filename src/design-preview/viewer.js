import { Vector3 } from 'three';
import { AssemblyScene } from '../explorer/scene.js';
import { ExplorerController } from '../explorer/controller.js';
import { resolveModel, validatePackage } from '../explorer/model-catalog.js';
import { buildHierarchy } from '../explorer/model-state.js';
import { resolveTheme, themeRoles } from '../explorer/themes.js';

const problem = (code, message) => Object.assign(new Error(message), { code });
const notify = (callback, value) => { try { callback?.(value); } catch { /* A preview host cannot interrupt the renderer. */ } };
const clone = value => JSON.parse(JSON.stringify(value));

/**
 * Private preview boundary: this alternate shell shares the existing scene,
 * controller and demand-rendered clock, but exposes only JSON and commands.
 * Its neutral stage is instance-local; the production Explorer is untouched.
 */
export function createDesignViewer({ mount, onState, onReady, onError, onProgress, onHotspots, insets } = {}) {
  if (!mount?.appendChild) throw new TypeError('A design preview mount element is required.');
  const model = resolveModel('kinetic-01');
  const abort = new AbortController();
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let scene, hierarchy, controller, disposed = false, sequence = 0;
  let theme = resolveTheme('ember'), hotspotIds = [], anchors = new Map(), hotspotKey = '', stageStyle = '';
  let resolveReady, rejectReady, readySettled = false;
  const ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  ready.catch(() => {}); // Leaving the prototype while loading is an expected cancellation.

  function settleReady(value, error) {
    if (readySettled) return;
    readySettled = true;
    if (error) rejectReady(error); else resolveReady(value);
  }

  function syncStage() {
    if (!scene || disposed || stageStyle === scene.renderStyle) return;
    stageStyle = scene.renderStyle;
    scene.scene.background.set(stageStyle === 'engineering' ? '#f3f3f1' : '#414141');
    scene.invalidate();
  }

  // Convert source-authored centers to each mesh's local frame once. Projecting
  // these anchors then follows the existing operation/explosion transforms and
  // camera without DOM measurement, geometry traversal, or a second RAF.
  function prepareAnchors(metadata) {
    const parts = new Map();
    for (const part of metadata.parts) {
      const mesh = scene.meshes.get(part.meshName);
      if (!mesh?.userData.source) continue;
      const local = new Vector3().fromArray(part.center)
        .applyMatrix4(mesh.userData.source.matrixWorld.clone().invert());
      parts.set(part.meshName, { mesh, local });
    }
    anchors = new Map([...hierarchy.nodes].map(([id, node]) => [id, {
      title: node.title,
      parts: node.meshNames.map(name => parts.get(name)).filter(Boolean),
    }]));
  }

  const anchorPoint = new Vector3(), partPoint = new Vector3();
  function publishHotspots() {
    if (!scene?.ready || disposed) return;
    const width = mount.clientWidth, height = mount.clientHeight;
    const moving = mount.dataset.motion === 'moving';
    scene.camera.updateMatrixWorld(true);
    const values = hotspotIds.flatMap(id => {
      const anchor = anchors.get(id);
      if (!anchor) return [];
      anchorPoint.set(0, 0, 0);
      let count = 0;
      for (const { mesh, local } of anchor.parts) {
        if (!scene.active.includes(mesh) || !mesh.visible || mesh.userData.visibility.values[0] < .9) continue;
        mesh.updateMatrixWorld();
        anchorPoint.add(partPoint.copy(local).applyMatrix4(mesh.matrixWorld));
        count++;
      }
      if (count) anchorPoint.divideScalar(count).project(scene.camera);
      const visible = count > 0 && !moving && width > 0 && height > 0 &&
        anchorPoint.z >= -1 && anchorPoint.z <= 1 && Math.abs(anchorPoint.x) <= 1 && Math.abs(anchorPoint.y) <= 1;
      return [{ id, title: anchor.title, x: Math.round((anchorPoint.x + 1) * width) / 2,
        y: Math.round((1 - anchorPoint.y) * height) / 2, visible }];
    });
    const key = JSON.stringify(values);
    if (key !== hotspotKey) { hotspotKey = key; notify(onHotspots, values); }
  }

  function release() {
    if (disposed) return;
    disposed = true;
    abort.abort();
    scene?.dispose();
    anchors.clear();
    notify(onHotspots, []);
    settleReady(null, problem('DISPOSED', 'The design preview was closed.'));
  }

  controller = new ExplorerController({
    model,
    enabled: { tours: [], themes: ['ember'] },
    port: {
      getScene: () => scene,
      getHierarchy: () => hierarchy,
      getTheme: () => ({ id: theme.id, revision: theme.accent }),
      setTheme: id => { theme = resolveTheme(id); scene?.setTheme(themeRoles(theme)); },
      sync: syncStage,
      dispose: release,
    },
  });
  controller.subscribe(event => {
    if (disposed) return;
    if (event.type === 'stateChanged') {
      syncStage();
      notify(onState, event.payload);
    }
  });

  async function request(method, params = {}) {
    const event = await controller.request({ requestId: `design-preview-${++sequence}`, method, params });
    const payload = event?.payload;
    if (payload?.status === 'completed') return payload.result;
    if (payload?.status === 'cancelled') throw problem('CANCELLED', `The ${method} action was interrupted.`);
    throw problem(payload?.error?.code || 'EXPLORER_ERROR', payload?.error?.message || 'The preview action could not be completed.');
  }

  function picked(method, id) {
    if (disposed || !controller.ready) return;
    request(method, { nodeId: id }).catch(error => {
      if (!disposed && error.code !== 'CANCELLED') notify(onError, error);
    });
  }

  function syncEnvironment({ pause = false } = {}) {
    if (disposed) return;
    if (pause || document.hidden) {
      controller.takeover('preview-paused');
      scene?.pausePresentation();
    }
    scene?.operationPlayer.setVisibility(document.hidden);
    if (scene) scene.lastFrame = null;
    controller.setEnvironment({ visible: !document.hidden, reducedMotion: motion.matches });
    if (!document.hidden) scene?.invalidate();
  }

  document.addEventListener('visibilitychange', () => syncEnvironment(), { signal: abort.signal });
  motion.addEventListener('change', () => syncEnvironment({ pause: motion.matches }), { signal: abort.signal });
  window.addEventListener('pagehide', event => {
    if (event.persisted) syncEnvironment({ pause: true }); else controller.dispose();
  }, { signal: abort.signal });
  window.addEventListener('pageshow', event => { if (event.persisted) syncEnvironment(); }, { signal: abort.signal });

  queueMicrotask(async () => {
    if (disposed) return;
    try {
      controller.setLifecycle('loading');
      syncEnvironment();
      notify(onProgress, 0);
      const response = await fetch(model.metadataUrl, { signal: abort.signal });
      if (!response.ok) throw new Error(`The model package could not be loaded (${response.status}).`);
      const metadata = await response.json();
      if (disposed) return;
      validatePackage(metadata, model);
      hierarchy = buildHierarchy(metadata, model.presentationPolicy);
      const config = { ...model, operation: metadata.operation ? { ...metadata.operation, cameraDirection: model.defaultDirection } : null };
      scene = new AssemblyScene(mount, metadata, hierarchy, {
        theme: themeRoles(theme),
        axisElements: [],
        insets: () => insets?.() || {},
        select: id => picked('select', id),
        inspect: id => picked('focus', id),
        interact: () => controller.takeover(),
        operation: () => controller.notify(),
        explosion: () => controller.notify(),
        quality: () => controller.notify(),
        frame: () => { controller.notify(); publishHotspots(); },
      }, config);
      syncStage();
      await scene.load(model.modelUrl, value => notify(onProgress, value * .95));
      if (disposed) return;
      prepareAnchors(metadata);
      controller.setLifecycle('ready');
      syncEnvironment();
      const payload = { state: controller.getState(), capabilities: controller.getCapabilities() };
      settleReady(clone(payload));
      notify(onProgress, 1);
      notify(onReady, clone(payload));
      scene.invalidate();
    } catch (cause) {
      if (disposed || abort.signal.aborted) return;
      const error = problem('ASSET_LOAD_FAILED', cause?.message || 'The preview model could not be loaded.');
      controller.setLifecycle('error', error);
      settleReady(null, error);
      notify(onError, error);
      scene?.dispose();
    }
  });

  return {
    ready,
    request,
    dispose: () => controller.dispose(),
    refit: () => { if (scene?.ready && !disposed) { scene.refitLayout(); scene.invalidate(); } },
    setHotspotIds(ids) {
      hotspotIds = [...new Set(Array.isArray(ids) ? ids.filter(id => typeof id === 'string') : [])].slice(0, 12);
      hotspotKey = '';
      if (!hotspotIds.length) notify(onHotspots, []);
      scene?.invalidate();
    },
  };
}
