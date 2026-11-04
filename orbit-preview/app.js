import { createScene } from './scene.js';
import { createStationLabels } from './station-labels.js';

const chapters = {
  overview: { number: '01', title: 'Whole model', copy: 'Rotate the assembly or select a station on its orbit.' },
  leg: {
    number: '02', title: 'Leg motion',
    copy: 'Watch the three joints move together. The orange trace follows the tip of the foot.',
    phases: [[0, 'Lift the foot'], [.38, 'Reach outward'], [.69, 'Return to rest']],
  },
  electronics: {
    number: '03', title: 'Electronics',
    copy: 'Two upper braces lift first. The board then rises from its mount above the battery.',
    phases: [[0, 'Lift the braces'], [.42, 'Raise the board'], [.90, 'Stack revealed']],
  },
};
const duration = 2.5;
const byId = id => document.getElementById(id);
const canvas = byId('scene');
const orbit = byId('orbit-nav');
const stations = [...orbit.querySelectorAll('button')];
const menu = byId('chapter-menu');
const indexTrigger = byId('index-trigger');
const indexButtons = [...menu.querySelectorAll('[data-index-target]')];
const placeLabels = createStationLabels(canvas, stations, indexTrigger);
const back = byId('back-overview');
const rotation = byId('rotation');
const playback = byId('playback');
const slider = byId('progress');
const status = byId('status');
const preference = matchMedia('(prefers-reduced-motion: reduce)');
const fromUrl = () => Object.hasOwn(chapters, location.hash.slice(1)) ? location.hash.slice(1) : 'overview';
let chapter = fromUrl(), lastStation = 'overview';
let progress = 0, rotating = !preference.matches, playing = false, ready = false, scene;

function updateTransport() {
  const mode = playing ? 'pause' : progress >= 1 ? 'replay' : 'play';
  const label = { pause: 'Pause action', play: progress > 0 ? 'Resume action' : 'Play action', replay: 'Replay action' }[mode];
  playback.dataset.mode = mode;
  playback.querySelector('[data-label]').textContent = label;
  rotation.setAttribute('aria-pressed', String(rotating));
  rotation.querySelector('[data-label]').textContent = rotating ? 'Pause rotation' : 'Start rotation';
}

function updateProgress(value) {
  progress = Math.min(1, Math.max(0, value));
  scene?.setProgress(progress);
  slider.value = String(Math.round(progress * 1000));
  slider.style.setProperty('--progress', (progress * 100) + '%');
  const seconds = (progress * duration).toFixed(1);
  byId('timecode').textContent = seconds + ' s';
  slider.setAttribute('aria-valuetext', seconds + ' of ' + duration + ' seconds');
  const phase = chapters[chapter].phases?.findLast(([start]) => progress >= start)?.[1] || '';
  if (byId('chapter-phase').textContent !== phase) byId('chapter-phase').textContent = phase;
}

function setPlaying(value) {
  playing = Boolean(value && ready && chapter !== 'overview' && !document.hidden);
  scene?.setPlaying(playing);
  updateTransport();
}

function present(next, focus) {
  const previous = chapter;
  chapter = next;
  document.body.dataset.chapter = chapter;
  const detail = chapter !== 'overview';
  const item = chapters[chapter];
  byId('chapter-index').textContent = item.number + ' / 03';
  byId('chapter-heading').textContent = item.title;
  byId('chapter-copy').textContent = item.copy;
  orbit.inert = detail;
  orbit.setAttribute('aria-hidden', String(detail));
  for (const button of [...stations, ...indexButtons]) {
    if ((button.dataset.chapterTarget || button.dataset.indexTarget) === chapter) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
  }
  if (detail) lastStation = chapter;
  scene?.setChapter(chapter);
  updateProgress(0);
  scene?.setRotating(!detail && rotating);
  setPlaying(detail && !preference.matches);
  if (focus) {
    const target = detail ? byId('chapter-heading') : stations.find(button => button.dataset.chapterTarget === (previous === 'overview' ? lastStation : previous));
    (target && !target.hidden ? target : indexTrigger).focus({ preventScroll: true });
  }
}

function takeover() {
  if (chapter === 'overview') rotating = false;
  scene?.setRotating(false);
  setPlaying(false);
}

function openStation(next) {
  if (!ready) return;
  menu.open = false;
  if (next === 'overview' && chapter !== 'overview') { returnToModel(); return; }
  if (next !== chapter) {
    if (chapter === 'overview') history.pushState({ orbitEntry: true }, '', '#' + next);
    else history.replaceState(history.state, '', '#' + next);
  }
  present(next, true);
}
for (const button of stations) {
  const id = button.dataset.chapterTarget;
  button.addEventListener('click', () => openStation(id));
  button.addEventListener('focus', () => scene?.setStationFocus(button.matches(':focus-visible') ? id : null));
  button.addEventListener('blur', () => scene?.setStationFocus(null));
}
for (const button of indexButtons) button.addEventListener('click', () => openStation(button.dataset.indexTarget));
document.addEventListener('pointerdown', e => { if (!menu.contains(e.target)) menu.open = false; });
function returnToModel() {
  if (chapter === 'overview') return;
  if (history.state?.orbitEntry) history.back();
  else {
    history.replaceState(null, '', location.pathname + location.search);
    present('overview', true);
  }
}
back.addEventListener('click', returnToModel);
window.addEventListener('popstate', () => present(fromUrl(), true));
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  if (menu.open) { event.preventDefault(); menu.open = false; indexTrigger.focus(); }
  else if (chapter !== 'overview') { event.preventDefault(); returnToModel(); }
});
rotation.addEventListener('click', () => {
  rotating = !rotating;
  scene.setRotating(rotating);
  updateTransport();
});
playback.addEventListener('click', () => {
  if (progress >= 1) updateProgress(0);
  setPlaying(!playing);
});
slider.addEventListener('pointerdown', () => setPlaying(false));
slider.addEventListener('input', () => {
  const value = Number(slider.value) / 1000;
  updateProgress(value);
  setPlaying(false);
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && playing) setPlaying(false);
});
preference.addEventListener('change', event => {
  if (event.matches) { rotating = false; takeover(); }
  scene?.setReducedMotion(event.matches);
});

function enableControls(value) {
  for (const el of [...stations, ...indexButtons, rotation, slider, playback]) el.disabled = !value;
}
function showError() {
  ready = false;
  document.body.dataset.ready = 'error';
  status.hidden = false;
  status.textContent = 'The 3D view could not load. Check that WebGL is available, then reload the page.';
  enableControls(false);
}
enableControls(false);
present(chapter, false);
try {
  scene = createScene({
    canvas, reducedMotion: preference.matches,
    onReady() {
      ready = true;
      enableControls(true);
      status.hidden = true;
      document.body.dataset.ready = 'true';
      scene.setRotating(chapter === 'overview' && rotating);
      setPlaying(chapter !== 'overview' && !preference.matches);
    },
    onError: showError, onTakeover: takeover, onStation: openStation, onStations: placeLabels,
    onEmphasis(id) {
      orbit.toggleAttribute('data-emphasis', Boolean(id));
      for (const button of stations) button.toggleAttribute('data-emphasis', button.dataset.chapterTarget === id);
    },
    onTick(dt) {
      if (!playing) return;
      updateProgress(progress + dt / duration);
      if (progress >= 1) setPlaying(false);
    },
  });
  scene.setChapter(chapter);
} catch { showError(); }

window.addEventListener('pagehide', event => { if (!event.persisted) scene?.dispose(); });
