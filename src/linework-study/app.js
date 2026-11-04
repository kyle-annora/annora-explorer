import * as THREE from 'three';
import { StudyScene } from './study-scene.js';
import { STUDY_MODEL, STUDY_VIEWS, STUDY_VARIANTS } from './study-model.js';
import { buildHierarchy } from '../explorer/model-state.js';
import { validatePackage } from '../explorer/model-validation.js';
import { resolveTheme, themeRoles } from '../explorer/themes.js';
import './study.css';

const $ = id => document.getElementById(id);
const lifetime = new AbortController();
const listen = (node, type, fn) => node.addEventListener(type, fn, { signal: lifetime.signal });
const params = new URLSearchParams(location.search);
let variant = Object.hasOwn(STUDY_VARIANTS, params.get('variant')) ? params.get('variant') : 'combined';
let scope = Object.hasOwn(STUDY_VIEWS, params.get('view')) ? params.get('view') : 'overview';
let appearance = params.get('appearance') === 'dark' ? 'dark' : 'light';
let scene, busy = true, motion = null, measurements = [], lastReport, initialCamera, activeSequence = 0;
const yAxis = new THREE.Vector3(0, 1, 0);

function status(message) { $('status').textContent = message; }
function setBusy(value) {
  busy = value; document.body.dataset.busy = String(value);
  for (const button of document.querySelectorAll('button[data-variant],button[data-scope],#reset-view,#rotate-toggle,#measure-run,#appearance-toggle')) button.disabled = value;
}
function updateURL() {
  const url = new URL(location.href);
  url.searchParams.set('variant', variant); url.searchParams.set('view', scope); url.searchParams.set('appearance', appearance);
  history.replaceState(null, '', url);
}
function updateLabels() {
  for (const button of document.querySelectorAll('button[data-variant]')) button.setAttribute('aria-pressed', String(button.dataset.variant === variant));
  for (const button of document.querySelectorAll('button[data-scope]')) button.setAttribute('aria-pressed', String(button.dataset.scope === scope));
  $('variant-title').textContent = STUDY_VARIANTS[variant].title;
  $('variant-description').textContent = STUDY_VARIANTS[variant].description;
  const stats = scene?.getStudyStats();
  if (stats) $('render-summary').textContent = `${stats.bufferWidth} × ${stats.bufferHeight} · ${stats.samples || 0}× MSAA`;
  $('rotate-toggle').setAttribute('aria-pressed', String(Boolean(motion && !motion.measure)));
  const label = $('rotate-toggle').querySelector('span');
  if (label) label.textContent = motion && !motion.measure ? 'Pause rotation' : 'Slow rotation';
  $('rotate-toggle').setAttribute('aria-label', motion && !motion.measure ? 'Pause rotation' : 'Start slow rotation');
  $('rotate-toggle').title = motion && !motion.measure ? 'Pause rotation' : 'Start slow rotation';
  $('appearance-toggle').setAttribute('aria-label', appearance === 'light' ? 'Switch to dark background' : 'Switch to light background');
  $('appearance-toggle').setAttribute('aria-pressed', String(appearance === 'dark'));
  $('appearance-toggle').title = appearance === 'light' ? 'Switch to dark background' : 'Switch to light background';
  $('measure-run').textContent = motion?.measure ? 'Measuring…' : 'Run check';
  document.body.dataset.variant = variant; document.body.dataset.view = scope; document.body.dataset.appearance = appearance;
}
function syncAppearance() {
  document.documentElement.dataset.appearance = appearance;
  scene?.setDisplayOptions({ appearance, grid: false, hiddenEdges: false });
  scene?.setTheme(themeRoles(resolveTheme('ember'), appearance));
  updateLabels(); updateURL();
}
function fail(error) {
  if (lifetime.signal.aborted) return;
  console.error(error); status('The preview could not finish this action. Please reload to try again.');
  $('loading-label').textContent = 'The preview could not load. Please reload to try again.';
  document.body.dataset.error = error.message;
  setBusy(false);
}
function stopMotion({ restore = false, cancel = false } = {}) {
  if (!motion || !scene) return;
  const previous = motion; motion = null;
  if (restore) scene.restoreCameraView(previous.camera, { animate: false });
  scene.controls.enableDamping = true;
  if (previous.measure && cancel) { setBusy(false); status('Motion check cancelled.'); }
  updateLabels(); scene.invalidate();
}
function startMotion(measure = false) {
  if (!scene?.ready || busy) return;
  stopMotion(); scene.pauseCamera(); scene.controls.enableDamping = false;
  const camera = scene.captureCameraView();
  motion = { measure, camera, vector: new THREE.Vector3().fromArray(camera.position).sub(new THREE.Vector3().fromArray(camera.target)), elapsed: 0, last: null, intervals: [], frameCount: 0, stats: scene.getStudyStats(), started: performance.now() };
  if (measure) { setBusy(true); status('Measuring a 12-second camera sweep…'); }
  else status('Drag the model to take control.');
  updateLabels(); scene.invalidate();
}
// Called from the existing scene animation clock; this preview adds no RAF loop.
function tick(time) {
  if (!motion || document.hidden) return false;
  const elapsed = motion.last === null ? 0 : Math.min(100, Math.max(0, time - motion.last));
  motion.last = time; motion.elapsed += elapsed;
  const angle = motion.measure ? .42 * Math.sin(Math.min(1, motion.elapsed / 12000) * Math.PI * 2) : motion.elapsed / 1000 * .13;
  scene.camera.position.copy(motion.vector).applyAxisAngle(yAxis, angle).add(scene.controls.target);
  scene.camera.lookAt(scene.controls.target); scene.invalidate();
  if (motion.measure && motion.elapsed >= 12000) motion.finished = true;
  return true;
}
function onFrame() {
  if (!motion) return;
  const now = performance.now();
  if (motion.renderedAt) motion.intervals.push(now - motion.renderedAt);
  motion.renderedAt = now; motion.frameCount++;
  if (motion.finished) {
    const sample = motion, sorted = sample.intervals.slice().sort((a,b) => a-b);
    const percentile = p => sorted[Math.min(sorted.length-1, Math.floor(sorted.length*p))] || 0;
    lastReport = { model: STUDY_MODEL.id, view: scope, variant, appearance, recordedAt: new Date().toISOString(), viewport: [innerWidth, innerHeight], devicePixelRatio, durationMs: now - sample.started, renderedFrames: sample.frameCount, frameIntervalMs: { median: percentile(.5), p95: percentile(.95) }, medianFps: percentile(.5) ? 1000 / percentile(.5) : 0, framesOver50ms: sorted.filter(v => v > 50).length, render: sample.stats, camera: sample.camera, deviceQualification: 'This browser only. CPU throttling does not emulate an ordinary GPU.' };
    measurements.push(lastReport); stopMotion({ restore: true }); setBusy(false);
    const output = document.createElement('p'); output.textContent = `${STUDY_VARIANTS[variant].title} · ${lastReport.medianFps.toFixed(1)} fps median · ${lastReport.frameIntervalMs.p95.toFixed(1)} ms p95`;
    $('measure-results').append(output); $('export-report').disabled = false;
    status('Motion check complete. Result saved for download.');
    document.body.dataset.measurement = 'complete';
  }
}
async function setView(next) {
  if (!scene?.ready || !Object.hasOwn(STUDY_VIEWS, next)) return;
  const sequence = ++activeSequence; stopMotion({ cancel: true }); setBusy(true); scope = next;
  const view = STUDY_VIEWS[next]; scene.pauseCamera(); scene.setScope(view.scope); scene.setIsolated(true); scene.explode(view.explosion, false);
  const included = new Set(view.meshes || scene.nodes.get(view.scope).meshNames);
  scene.active = [...scene.meshes.values()].filter(mesh => included.has(mesh.name)); scene.contextMeshes = [];
  for (const mesh of scene.meshes.values()) { const visible = included.has(mesh.name); mesh.userData.visibility.to([visible ? 1 : 0], true); mesh.visible = visible; }
  // Presets describe source subjects; selection remains neutral for a fair comparison.
  scene.setSelected(STUDY_MODEL.rootId); scene.hideHover();
  scene.fitMeshes(scene.active, false, new THREE.Vector3(...view.direction).normalize());
  scene.syncEdges(); scene.invalidate();
  await scene.whenSettled({ signal: lifetime.signal });
  if (sequence !== activeSequence || lifetime.signal.aborted) return;
  initialCamera = scene.captureCameraView(); setBusy(false); updateLabels(); updateURL();
  status(`${view.title} · Drag to orbit. Scroll or pinch to zoom.`);
}
function setVariant(next) {
  if (busy || !scene?.ready || !Object.hasOwn(STUDY_VARIANTS,next)) return;
  stopMotion({ cancel: true }); scene.hideHover(); variant = next;
  scene.setStudyVariant(next); updateLabels(); updateURL();
  status('Comparison changed. Camera and model pose retained.');
}
for (const button of document.querySelectorAll('[data-variant]')) listen(button, 'click', () => setVariant(button.dataset.variant));
for (const button of document.querySelectorAll('[data-scope]')) listen(button, 'click', () => { if (!busy) void setView(button.dataset.scope).catch(fail); });
listen($('reset-view'), 'click', () => { stopMotion({ cancel: true }); if (initialCamera) scene.restoreCameraView(initialCamera, { animate: false }); status('Reference camera restored.'); });
listen($('rotate-toggle'), 'click', () => motion ? stopMotion({ cancel: true }) : startMotion());
listen($('appearance-toggle'), 'click', () => { appearance = appearance === 'light' ? 'dark' : 'light'; syncAppearance(); });
listen($('measure-toggle'), 'click', () => { const open = $('measure-panel').hidden; $('measure-panel').hidden = !open; $('measure-toggle').setAttribute('aria-expanded', String(open)); if (open) { updateLabels(); $('measure-close').focus(); } else if (motion?.measure) stopMotion({cancel:true}); });
listen($('measure-close'), 'click', () => { if (motion?.measure) stopMotion({cancel:true}); $('measure-panel').hidden = true; $('measure-toggle').setAttribute('aria-expanded','false'); $('measure-toggle').focus(); });
listen($('measure-run'), 'click', () => { document.body.dataset.measurement = 'running'; startMotion(true); });
listen($('export-report'), 'click', () => {
  if (!measurements.length) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify({ study: 'Hexapod linework', measurements }, null, 2)],{type:'application/json'}));
  const link = document.createElement('a'); link.href=url; link.download='hexapod-linework-measurements.json'; link.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
});
listen(document, 'keydown', event => {
  if (event.key === 'Escape') { if (!$('measure-panel').hidden) $('measure-close').click(); else stopMotion({ cancel: true }); }
});
listen(document, 'visibilitychange', () => { if (document.hidden) stopMotion({ cancel: true }); });
listen(window, 'pagehide', event => { stopMotion({ cancel: true }); if (!event.persisted) { lifetime.abort(); scene?.dispose(); } });
listen(window, 'pageshow', event => { if (event.persisted) scene?.invalidate(); });

async function start() {
  setBusy(true); updateLabels();
  const response = await fetch(STUDY_MODEL.metadataUrl,{signal:lifetime.signal}); if(!response.ok)throw new Error('Model metadata unavailable');
  const metadata = await response.json(); validatePackage(metadata,STUDY_MODEL);
  const hierarchy = buildHierarchy(metadata,STUDY_MODEL.presentationPolicy);
  scene = new StudyScene($('scene'),metadata,hierarchy,{
    axisElements: [], insets: () => ({left:24,right:24,top:32,bottom:40}),
    theme: themeRoles(resolveTheme('ember'),appearance), tourTick: tick, frame: onFrame,
    interact: () => { stopMotion({ cancel: true }); $('hover-label').hidden = true; },
    select: () => {}, inspect: () => {},
    hover: () => {},
    edgeProgress: state => { $('loading-label').textContent = `${state.phase || 'Preparing linework'}…`; },
  },STUDY_MODEL);
  await scene.load(STUDY_MODEL.modelUrl, progress => { $('loading-label').textContent=`Loading Hexapod · ${Math.round(progress*100)}%`; });
  scene.setStudyVariant(variant); await scene.setRenderStyle('linework'); syncAppearance();
  // An inspectable, preview-only surface for reproducible comparison and measurements.
  window.lineworkStudy = Object.freeze({
    getState: () => ({variant,view:scope,appearance,busy,moving:Boolean(motion),camera:scene.captureCameraView(),stats:scene.getStudyStats(),lastReport,sourceHash:metadata.source.sha256,activeMeshes:scene.active.map(mesh=>mesh.name)}),
    setVariant, setView, resetCamera: () => initialCamera && scene.restoreCameraView(initialCamera,{animate:false}),
    startMotion, stopMotion, setQuality: value => { scene.setQuality(value); updateLabels(); },
    restoreCamera: camera => { stopMotion({cancel:true}); return scene.restoreCameraView(camera,{animate:false}); },
  });
  await setView(scope); $('loading').hidden=true; document.body.dataset.ready='true';
}
void start().catch(fail);
