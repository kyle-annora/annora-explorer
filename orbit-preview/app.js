import { createScene } from './scene.js';

const chapters = {
  overview: { number: '01', title: 'Whole model', copy: 'Choose a point on the orbit to explore the Hexapod.' },
  leg: {
    number: '02', title: 'Leg motion',
    copy: 'Follow the front leg through one reach. Ember traces the tip of the foot.',
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
  for (const button of stations) {
    if (button.dataset.chapterTarget === chapter) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
  }
  if (detail) lastStation = chapter;
  scene?.setChapter(chapter);
  updateProgress(0);
  scene?.setRotating(!detail && rotating);
  setPlaying(detail && !preference.matches);
  if (focus) {
    const target = detail ? byId('chapter-heading') : stations.find(button => button.dataset.chapterTarget === (previous === 'overview' ? lastStation : previous));
    target?.focus({ preventScroll: true });
  }
}

function takeover() {
  if (chapter === 'overview') rotating = false;
  scene?.setRotating(false);
  setPlaying(false);
}

for (const button of stations) {
  button.addEventListener('click', () => {
    const next = button.dataset.chapterTarget;
    if (next !== chapter) history.pushState({ orbitEntry: true }, '', '#' + next);
    present(next, next !== 'overview');
  });
}
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
  if (event.key === 'Escape' && chapter !== 'overview') { event.preventDefault(); returnToModel(); }
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
  for (const el of [...stations, rotation, slider, playback]) el.disabled = !value;
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
    onError: showError, onTakeover: takeover,
    onTick(dt) {
      if (!playing) return;
      updateProgress(progress + dt / duration);
      if (progress >= 1) setPlaying(false);
    },
  });
  scene.setChapter(chapter);
} catch { showError(); }

window.addEventListener('pagehide', event => { if (!event.persisted) scene?.dispose(); });
