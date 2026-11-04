import { createDrawingPlate } from './drawing-plate.js';
import { createCallout } from './callout.js';
import { createOrbitalStage } from './stage.js';
import './style.css';

const defaultHint = matchMedia('(hover: none)').matches
  ? 'Tap a point to open. Hold to preview.' : 'Select a point on the orbit.';
const icon = name => '<svg aria-hidden="true"><use href="#i-' + name + '"/></svg>';

function makeControls(model, chapters) {
  const header = document.createElement('header');
  header.className = 'orbital-head';
  header.innerHTML = `
    <div class="orbital-identity"><span></span><h1 tabindex="-1"></h1></div>
    <nav class="orbital-nav" aria-label="Presentation navigation">
      <details id="orbit-menu"><summary>Chapters ${icon('chevron')}</summary>
        <div class="orbital-choices">
          <a class="orbital-credits" target="_blank" rel="noopener">Credits ${icon('external')}</a>
        </div>
      </details>
      <button type="button" id="orbit-exit">Explore freely ${icon('arrow')}</button>
    </nav>`;
  const creditsLink = header.querySelector('.orbital-credits');
  header.querySelector('.orbital-choices').classList.toggle('orbital-long-index', chapters.length > 3);
  for (const chapter of chapters) {
    const button = document.createElement('button');
    button.type = 'button'; button.dataset.orbitTarget = chapter.id;
    button.textContent = chapter.label; creditsLink.before(button);
  }
  header.querySelector('.orbital-identity span').textContent = document.getElementById('brand-name').textContent;
  header.querySelector('h1').textContent = model.title;
  const credits = header.querySelector('.orbital-credits');
  credits.href = model.licenseUrl || './LICENSES.txt';
  credits.title = model.attribution;
  credits.setAttribute('aria-label', 'Model credits: ' + model.attribution);
  const footer = document.createElement('section');
  footer.className = 'orbital-dock';
  footer.setAttribute('aria-label', 'Presentation controls');
  footer.innerHTML = `
    <div class="orbital-story">
      <button type="button" id="orbit-back">${icon('back')}Whole model</button>
      <h2 id="orbit-title" tabindex="-1"></h2><p id="orbit-copy"></p>
    </div>
    <div class="orbital-overview">
      <span id="orbit-caption">${defaultHint}</span>
      <button type="button" id="orbit-rotation" class="orbital-transport">
        <span class="orbital-disc">${icon('play')}</span><span class="orbital-label">Start rotation</span>
      </button>
    </div>
    <div class="orbital-action">
      <div class="orbital-playrow">
        <button type="button" id="orbit-play" class="orbital-transport">
          <span class="orbital-disc">${icon('play')}</span><span class="orbital-label">Play action</span>
        </button><span id="orbit-phase"></span>
      </div>
      <div class="orbital-scrub"><input type="range" id="orbit-progress" min="0" max="1000" step="1" value="0" aria-label="Action progress"><output id="orbit-time" aria-live="off" for="orbit-progress">0.0 s</output></div>
    </div>
    <button type="button" id="orbit-next"><span></span>${icon('arrow')}</button>`;
  return { header, footer };
}

export function mountOrbitalUI({ explorer, guide, assets, getAccent, chapter: initial = 'overview', navigate, exit }) {
  const chapters = Object.fromEntries(guide.chapters.map((chapter, i, list) =>
    [chapter.id, { ...chapter, next: list[(i + 1) % list.length].id }]));
  const shell = document.querySelector('.app-shell');
  const main = shell.querySelector('#main-content');
  const mount = main.querySelector('#scene');
  const oldLabel = mount.getAttribute('aria-label');
  const { header, footer } = makeControls(explorer.model, guide.chapters);
  const abort = new AbortController();
  const listen = (node, type, handler, options = {}) =>
    node.addEventListener(type, handler, { ...options, signal: abort.signal });
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const find = id => footer.querySelector('#orbit-' + id) || header.querySelector('#orbit-' + id);
  const menu = find('menu');
  const summary = menu.querySelector('summary');
  const choices = [...menu.querySelectorAll('button')];
  const next = find('next'), slider = find('progress'), caption = find('caption');
  const time = find('time'), phase = find('phase');
  const play = find('play'), rotation = find('rotation'), back = find('back');
  const supportsCallouts = guide.chapters.some(record => record.callouts?.length);
  const callout = supportsCallouts ? createCallout({ main, mount, getAccent }) : null;
  const drawing = createDrawingPlate({ main, guide, assets });
  const previews = new Map(guide.orbit.stations.filter(s => s.anchor && chapters[s.id].hint)
    .map(s => [s.id, { title: chapters[s.id].label, text: chapters[s.id].hint, anchor: s.anchor }]));
  let previewId = null, displayedCue;
  function syncCallout() {
    if (!callout || !stage) return;
    const record = chapters[chapter];
    const cue = (chapter === 'overview' && previews.get(previewId)) ||
      record?.callouts?.findLast(c => progress >= c.at) || null;
    if (cue === displayedCue) return;
    displayedCue = cue;
    document.body.classList.toggle('orbit-has-cue', Boolean(cue));
    callout.setCue(cue);
    stage.setCalloutTarget(cue?.anchor ?? null);
  }
  let stage, chapter, progress = 0, playing = false, rotating = !media.matches, disposed = false;

  function setTransport(button, glyph, label) {
    button.querySelector('use').setAttribute('href', '#i-' + glyph);
    button.querySelector('.orbital-label').textContent = label;
  }
  function setPlaying(value) {
    playing = Boolean(value && chapter !== 'overview' && !document.hidden);
    stage?.setPlaying(playing);
    const label = playing ? 'Pause action' : progress >= 1 ? 'Replay action' : progress > 0 ? 'Resume action' : 'Play action';
    setTransport(play, playing ? 'pause' : progress >= 1 ? 'reset' : 'play', label);
  }
  function setRotating(value) {
    rotating = value;
    stage?.setRotating(chapter === 'overview' && rotating);
    rotation.setAttribute('aria-pressed', String(rotating));
    setTransport(rotation, rotating ? 'pause' : 'play', rotating ? 'Pause rotation' : 'Start rotation');
  }
  function setProgress(value, sample = true) {
    progress = Math.max(0, Math.min(1, value));
    if (sample) stage?.setProgress(progress);
    drawing.setProgress(progress);
    slider.value = String(Math.round(progress * 1000));
    slider.style.setProperty('--position', (progress * 100) + '%');
    const actionDuration = chapters[chapter].duration ?? 0;
    const seconds = (progress * actionDuration).toFixed(1);
    const output = seconds + ' s';
    if (time.value !== output || !slider.hasAttribute('aria-valuetext')) {
      time.value = output;
      slider.setAttribute('aria-valuetext', seconds + ' of ' + actionDuration + ' seconds');
    }
    const currentPhase = chapters[chapter]?.phases?.findLast(([at]) => progress >= at)?.[1] || '';
    if (phase.textContent !== currentPhase) phase.textContent = currentPhase;
    syncCallout();
  }
  const captionAnimations = [];
  function stopWords() {
    while (captionAnimations.length) captionAnimations.pop().cancel();
  }
  function emphasize(id) {
    previewId = id;
    syncCallout();
    const current = chapters[id];
    caption.textContent = current ? [current.label, current.hint].filter(Boolean).join(' · ') : defaultHint;
    caption.toggleAttribute('data-active', Boolean(id));
  }
  function takeover() {
    if (chapter === 'overview') setRotating(false);
    setPlaying(false);
  }
  function setChapter(id) {
    if (disposed || !Object.hasOwn(chapters, id)) return;
    if (id === chapter) return;
    previewId = null;
    const initialMount = chapter === undefined;
    const frame = initialMount ? null : stage.captureChapterFrame();
    menu.open = false;
    chapter = id; progress = 0;
    const record = chapters[chapter];
    main.toggleAttribute('data-callout-room', Boolean(callout && (record.callouts?.length || (id === 'overview' && previews.size))));
    document.body.dataset.orbitChapter = chapter;
    for (const button of choices) {
      if (button.dataset.orbitTarget === id) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    }
    find('title').textContent = record.label;
    find('copy').textContent = record.copy || '';
    next.querySelector('span').textContent = record.next === 'overview' ? 'Whole model' : 'Next: ' + chapters[record.next].label;
    emphasize(null);
    stage.setStationFocus(null);
    drawing.setChapter(id);
    stage.setChapter(id, frame);
    setProgress(0, false);
    setRotating(rotating);
    setPlaying(id !== 'overview' && !media.matches);
    const focusTarget = id === 'overview' ? initialMount ? header.querySelector('h1') : summary : find('title');
    focusTarget.focus({ preventScroll: true });
    stopWords();
    if (frame) {
      const words = id === 'overview' ? [caption] : [find('title'), find('copy')];
      for (const [index,node] of words.entries()) captionAnimations.push(node.animate(
        [{ opacity: 0 }, { opacity: 1 }], { duration: 220, delay: index ? 140 : 50, easing: 'ease-out', fill: 'backwards' }
      ));
    }
  }
  function requestChapter(id) {
    if (!Object.hasOwn(chapters, id)) return;
    if (id === chapter) { menu.open = false; summary.focus({ preventScroll: true }); return; }
    navigate(id);
  }
  function focusStation() {
    if (!stage) return;
    const focused = menu.querySelector('button:focus-visible') || menu.querySelector('button:hover');
    stage.setStationFocus(menu.open && chapter === 'overview' ? focused?.dataset.orbitTarget || null : null);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    stopWords();
    abort.abort();
    header.remove();
    footer.remove();
    document.body.classList.remove('orbital-demo','orbital-annotated','orbit-has-cue');
    main.removeAttribute('data-callout-room');
    drawing.dispose();
    callout?.dispose();
    delete document.body.dataset.orbitChapter;
    if (oldLabel === null) mount.removeAttribute('aria-label');
    else mount.setAttribute('aria-label', oldLabel);
    stage?.dispose();
  }

  document.body.classList.add('orbital-demo');
  if (callout) document.body.classList.add('orbital-annotated');
  main.before(header);
  main.after(footer);
  mount.setAttribute('aria-label', explorer.model.title + ' presentation. Drag or use the arrow keys to orbit. Select a point or choose a chapter.');
  try {
    stage = createOrbitalStage({
      explorer, guide, getAccent, reducedMotion: media.matches,
      onCallout: callout?.setPoint,
      getCalloutInset: width => Math.max(callout?.getInset(width) ?? 0, drawing.getInset(width)),
      onTakeover: takeover, onEmphasis: emphasize, onStation: requestChapter,
      onTick(seconds) {
        if (!playing) return;
        setProgress(progress + seconds / chapters[chapter].duration);
        if (progress >= 1) setPlaying(false);
      },
    });
    setChapter(Object.hasOwn(chapters, initial) ? initial : 'overview');
  } catch (error) {
    dispose();
    throw error;
  }

  listen(find('exit'), 'click', exit);
  listen(back, 'click', () => requestChapter('overview'));
  listen(next, 'click', () => requestChapter(chapters[chapter].next));
  listen(rotation, 'click', () => setRotating(!rotating));
  listen(play, 'click', () => {
    if (progress >= 1) setProgress(0);
    setPlaying(!playing);
  });
  listen(slider, 'pointerdown', () => setPlaying(false));
  listen(slider, 'input', () => { setProgress(Number(slider.value) / 1000); setPlaying(false); });
  listen(menu, 'toggle', focusStation);
  for (const button of choices) {
    listen(button, 'click', () => requestChapter(button.dataset.orbitTarget));
    for (const type of ['pointerenter', 'pointerleave', 'focus', 'blur']) {
      listen(button, type, () => queueMicrotask(() => { if (!disposed) focusStation(); }));
    }
  }
  listen(document, 'pointerdown', event => {
    if (menu.open && !menu.contains(event.target) && !mount.contains(event.target)) menu.open = false;
  });
  // Closing the in-flow index resizes the stage. Finish the 3D hit first so
  // a tap on a visible station still lands where the finger went down.
  listen(mount, 'pointerup', () => {
    if (menu.open) menu.open = false;
  });
  listen(window, 'keydown', event => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (menu.open) { menu.open = false; summary.focus({ preventScroll: true }); }
    else if (chapter !== 'overview') requestChapter('overview');
    else exit();
  }, { capture: true });
  listen(media, 'change', event => {
    stage.setReducedMotion(event.matches);
    if (event.matches) { stopWords(); setRotating(false); setPlaying(false); }
  });
  listen(document, 'visibilitychange', () => { if (document.hidden && playing) setPlaying(false); });
  return { setChapter, dispose };
}
