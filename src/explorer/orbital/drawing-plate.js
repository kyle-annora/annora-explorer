import './drawing-plate.css';

const views = new Map([['plan', 'Plan'], ['elevation', 'Elevation'], ['section', 'Section A–A']]);
const pinnedByGuide = new WeakMap();
let nextPlateId = 0;

function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function urlFor(assets, file) {
  if (!file || !assets) return null;
  const url = assets instanceof Map ? assets.get(file) : Object.hasOwn(assets, file) ? assets[file] : null;
  return url instanceof URL ? url.href : typeof url === 'string' && url.length ? url : null;
}

/** One rest-pose reference per chapter. Scrubbing the assembly never re-requests its drawing. */
export function createDrawingPlate({ main, guide, assets }) {
  const chapters = new Map();
  for (const chapter of guide.chapters) {
    if (!chapter.referenceViews) continue;
    const files = new Map();
    for (const view of views.keys()) {
      const url = urlFor(assets, chapter.referenceViews[view]);
      if (url) files.set(view, url);
    }
    if (files.size) {
      const cues = (chapter.referenceViews.cues || []).filter(cue => Number.isFinite(cue.at) &&
        cue.at >= 0 && cue.at <= 1 && files.has(cue.view)).sort((a,b) => a.at - b.at);
      const initial = files.has(chapter.referenceViews.initial) ? chapter.referenceViews.initial : files.keys().next().value;
      chapters.set(chapter.id, { label: chapter.label, initial, cues, files });
    }
  }
  if (!chapters.size) return { setChapter() {}, setProgress() {}, setSuppressed() {}, getInset() { return 0; }, dispose() {} };

  const root = element('aside', 'orbit-drawing-plate');
  root.setAttribute('aria-label', 'Model reference');
  root.hidden = true;
  const legend = element('div', 'orbit-drawing-legend');
  legend.append(element('span', 'orbit-drawing-kicker', 'Model reference'), element('span', 'orbit-drawing-pose', 'At rest'));

  const sheet = element('div', 'orbit-drawing-sheet');
  sheet.id = 'orbit-drawing-sheet-' + ++nextPlateId;
  const image = element('img', 'orbit-drawing-image');
  image.decoding = 'async';
  image.draggable = false;
  const unavailable = element('span', 'orbit-drawing-error', 'View unavailable.');
  unavailable.hidden = true;
  const enlarge = element('button', 'orbit-drawing-enlarge');
  enlarge.type = 'button';
  enlarge.setAttribute('aria-controls', sheet.id);
  enlarge.innerHTML = '<svg aria-hidden="true" viewBox="0 0 16 16"><path d="M5 2H2v3m9-3h3v3M2 11v3h3m9-3v3h-3"/></svg>';
  sheet.append(image, unavailable, enlarge);

  const switches = element('div', 'orbit-drawing-switches');
  switches.setAttribute('role', 'group');
  switches.setAttribute('aria-label', 'Reference view');
  const picker = element('label', 'orbit-drawing-picker');
  const select = element('select', 'orbit-drawing-select');
  select.setAttribute('aria-label', 'Reference view');
  const arrow = element('span', 'orbit-drawing-caret');
  arrow.setAttribute('aria-hidden', 'true');
  picker.append(select, arrow);
  const buttons = new Map(), options = new Map();
  const controller = new AbortController();
  const listen = (node, event, callback) => node.addEventListener(event, callback, { signal: controller.signal });
  for (const [key, name] of views) {
    const button = element('button', 'orbit-drawing-choice', name);
    button.type = 'button';
    button.dataset.view = key;
    listen(button, 'click', () => chooseManual(key));
    switches.append(button); buttons.set(key, button);
    const option = element('option', '', name);
    option.value = key;
    select.append(option); options.set(key, option);
  }
  const follow = element('button', 'orbit-drawing-follow', 'Follow chapter');
  follow.type = 'button';
  follow.hidden = true;
  root.append(legend, sheet, switches, picker, follow);
  main.append(root);

  const mobile = matchMedia('(max-width: 700px)');
  const remembered = pinnedByGuide.get(guide) || new Map();
  pinnedByGuide.set(guide, remembered);
  for (const [id, view] of remembered) {
    if (!chapters.get(id)?.files.has(view)) remembered.delete(id);
  }
  let chapterId = null, progress = 0, expanded = false, suppressed = false;
  const caption = main.querySelector('.orbit-callout-copy');
  function measure() {
    const height = mobile.matches && !root.hidden ? Math.ceil(root.getBoundingClientRect().height) : 0;
    const value = height + 'px';
    if (main.style.getPropertyValue('--drawing-strip') !== value) main.style.setProperty('--drawing-strip', value);
    if (!mobile.matches && !root.hidden && caption) {
      const box = root.getBoundingClientRect(), note = caption.getBoundingClientRect();
      if (note.height > 0) {
        // The figure may shrink when wrapped copy shares a short landscape stage.
        const chrome = box.height - sheet.getBoundingClientRect().height;
        const limit = Math.max(0, Math.floor(box.bottom - note.bottom - 12 - chrome)) + 'px';
        if (root.style.getPropertyValue('--drawing-height-limit') !== limit) root.style.setProperty('--drawing-height-limit', limit);
      } else root.style.removeProperty('--drawing-height-limit');
    }
  }
  function setExpanded(next) {
    expanded = next;
    root.toggleAttribute('data-expanded', expanded);
    enlarge.setAttribute('aria-expanded', String(expanded));
    const name = expanded ? 'Reduce reference drawing' : 'Enlarge reference drawing';
    enlarge.setAttribute('aria-label', name);
    enlarge.title = name;
    measure();
  }
  function showView(view) {
    const chapter = chapters.get(chapterId);
    if (!chapter?.files.has(view)) return;
    root.dataset.view = view;
    for (const [key, button] of buttons) button.setAttribute('aria-pressed', String(key === view));
    select.value = view;
    image.alt = chapter.label + ', ' + views.get(view) + ' view at rest';
    const url = chapter.files.get(view);
    if (image.getAttribute('src') !== url) {
      unavailable.hidden = true;
      image.hidden = false;
      image.src = url;
    }
  }
  function activeView(chapter) {
    return remembered.get(chapterId) || chapter.cues.findLast(cue => cue.at <= progress)?.view || chapter.initial;
  }
  function updateFollow(chapter) {
    const pinned = Boolean(chapter?.cues.length && remembered.has(chapterId));
    follow.hidden = !pinned;
    root.toggleAttribute('data-pinned', pinned);
  }
  function chooseManual(view) {
    const chapter = chapters.get(chapterId);
    if (!chapter?.files.has(view)) return;
    remembered.set(chapterId, view);
    updateFollow(chapter);
    showView(view);
    measure();
  }
  function setProgress(value) {
    progress = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
    const chapter = chapters.get(chapterId);
    if (!chapter || !chapter.cues.length || remembered.has(chapterId)) return;
    const view = activeView(chapter);
    if (root.dataset.view !== view) showView(view);
  }
  function setChapter(id) {
    const chapter = chapters.get(id);
    if (chapterId === id) return;
    chapterId = id;
    progress = 0;
    updateFollow(chapter);
    root.hidden = !chapter || suppressed;
    main.toggleAttribute('data-has-drawing-plate', Boolean(chapter && !suppressed));
    if (chapter) {
      root.dataset.chapter = id;
      for (const key of views.keys()) {
        buttons.get(key).hidden = !chapter.files.has(key);
        options.get(key).disabled = !chapter.files.has(key);
        options.get(key).hidden = !chapter.files.has(key);
      }
      showView(activeView(chapter));
    } else {
      delete root.dataset.chapter;
      delete root.dataset.view;
    }
    measure();
  }
  listen(select, 'change', () => chooseManual(select.value));
  listen(follow, 'click', () => {
    const chapter = chapters.get(chapterId);
    if (!chapter) return;
    remembered.delete(chapterId);
    const view = activeView(chapter);
    showView(view);
    // This action leaves the tab order when following resumes.
    const focus = mobile.matches ? select : buttons.get(view);
    focus.focus({ preventScroll: true });
    updateFollow(chapter);
    measure();
  });
  listen(enlarge, 'click', () => setExpanded(!expanded));
  // Let Escape reduce the enlarged reference before the guide handles it as
  // chapter navigation. Outside this figure, the normal guide key still wins.
  window.addEventListener('keydown', event => {
    if (event.key === 'Escape' && expanded && mobile.matches && root.contains(document.activeElement)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      setExpanded(false);
      enlarge.focus({ preventScroll: true });
    }
  }, { capture: true, signal: controller.signal });
  listen(image, 'error', () => { image.hidden = true; unavailable.hidden = false; });
  listen(image, 'load', () => { image.hidden = false; unavailable.hidden = true; });
  listen(mobile, 'change', measure);
  const observer = new ResizeObserver(measure);
  observer.observe(root);
  observer.observe(main);
  if (caption) observer.observe(caption);
  setExpanded(false);
  return {
    setChapter, setProgress,
    setSuppressed(value) {
      suppressed = Boolean(value);
      root.hidden = suppressed || !chapters.has(chapterId);
      main.toggleAttribute('data-has-drawing-plate', !root.hidden);
      measure();
    },
    getInset(width) { return root.hidden || mobile.matches ? 0 : Math.min(width * .24, 284); },
    dispose() {
      controller.abort();
      observer.disconnect();
      root.remove();
      main.removeAttribute('data-has-drawing-plate');
      main.style.removeProperty('--drawing-strip');
    },
  };
}
