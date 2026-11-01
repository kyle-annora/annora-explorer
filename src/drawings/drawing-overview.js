import { createTechnicalDrawingView } from '../drawing-preview/technical-view.js';

const COMPACT_WIDTH = 600;
const MOVE_THRESHOLD = 5;
let overviewNumber = 0;

/** A source-linked sheet composition over the existing vector reader.
 * The host owns which prepared entries belong to a sheet and what opening a
 * view does. This surface never writes a source association or project record.
 * Import drawing-overview.css in the host alongside this module. */
export function createDrawingOverview({ mount, entries = [], selectedId = null, lockedRegionId = null,
  onOpen = () => {}, onError = () => {}, createView = createTechnicalDrawingView,
  document: doc = globalThis.document, window: win = globalThis.window,
  ResizeObserver: Observer = globalThis.ResizeObserver } = {}) {
  if (!mount?.replaceChildren || !doc?.createElement) throw new TypeError('A drawing overview needs a mount and browser document.');
  if (!Array.isArray(entries) || new Set(entries.map(entry => entry.id)).size !== entries.length)
    throw new TypeError('Drawing overview entries must have unique IDs.');
  const sourceEntries = entries.slice(), prefix = `drawing-overview-${++overviewNumber}`;
  let disposed = false, compact = null, generation = 0, selection = lockedRegionId || selectedId;
  const selectedEntries = sourceEntries.filter(entry => entry.regionIds?.includes(selection));
  // Recorded mobile previews give their pinned feature the largest useful
  // composition first. The selector still exposes the complete source sheet.
  if (lockedRegionId) selectedEntries.sort((a, b) => a.regionIds.length - b.regionIds.length);
  let activeId = selectedEntries[0]?.id || sourceEntries[0]?.id;
  let viewers = [], tileRemovers = [], pendingActivation = null, ready = Promise.resolve();
  const removers = [];
  const html = (tag, className, text) => {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const listen = (target, name, handler, options, collection = removers) => {
    target.addEventListener(name, handler, options);
    collection.push(() => target.removeEventListener(name, handler, options));
  };
  const icon = () => {
    const node = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    for (const [key, value] of Object.entries({ viewBox: '0 0 24 24', width: '18', height: '18', 'aria-hidden': 'true', focusable: 'false' })) node.setAttribute(key, value);
    const path = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
    for (const [key, value] of Object.entries({ d: 'M8 3H3v5m0-5 6 6m7 12h5v-5m0 5-6-6', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })) path.setAttribute(key, value);
    node.append(path); return node;
  };
  const root = html('section', 'drawing-overview');
  root.setAttribute('aria-label', 'Drawing overview');
  root.setAttribute('data-count', String(sourceEntries.length));
  const chooser = html('label', 'drawing-overview-chooser');
  chooser.append(html('span', 'drawing-overview-chooser-label', 'View'));
  const select = html('select', 'drawing-overview-select');
  select.setAttribute('aria-label', 'Overview view');
  for (const entry of sourceEntries) {
    const option = html('option', '', entry.title || entry.profile?.title || 'Drawing view');
    option.value = entry.id; select.append(option);
  }
  select.value = activeId || '';
  chooser.append(select);
  const grid = html('div', 'drawing-overview-grid');
  root.append(chooser, grid);
  mount.replaceChildren(root);

  function chooseRegion(entry, id) {
    if (lockedRegionId) return lockedRegionId;
    if (id && entry.regionIds?.includes(id)) return id;
    if (selection && entry.regionIds?.includes(selection)) return selection;
    return entry.defaultRegionId || entry.regionIds?.[0] || null;
  }
  function open(entry, regionId, focus) {
    if (disposed) return;
    const id = chooseRegion(entry, regionId);
    if (pendingActivation) pendingActivation.handled = true;
    onOpen({ entryId: entry.id, regionId: id, focus: Boolean(focus && entry.regionIds?.includes(id)) });
  }
  function clearViews() {
    pendingActivation = null;
    tileRemovers.forEach(remove => remove()); tileRemovers = [];
    viewers.forEach(({ viewer }) => viewer.dispose()); viewers = [];
    grid.replaceChildren();
  }
  function tile(entry, index, turn) {
    const article = html('article', 'drawing-overview-tile');
    article.setAttribute('data-overview-entry', entry.id);
    article.setAttribute('aria-labelledby', `${prefix}-view-${index}`);
    const heading = html('h3', 'drawing-overview-heading');
    const button = html('button', 'drawing-overview-open');
    button.type = 'button'; button.id = `${prefix}-view-${index}`;
    button.setAttribute('aria-label', `Open ${entry.title || entry.profile?.title || 'drawing view'}`);
    const number = html('span', 'drawing-overview-index', String(index + 1).padStart(2, '0'));
    number.setAttribute('aria-hidden', 'true');
    button.append(number, html('span', 'drawing-overview-title', entry.title || entry.profile?.title || 'Drawing view'),
      html('span', 'drawing-overview-mobile-open-label', 'Enlarge view'), icon());
    heading.append(button);
    const canvas = html('div', 'drawing-overview-canvas');
    canvas.setAttribute('aria-label', `${entry.title || entry.profile?.title || 'Drawing view'}. Select a detail or open this view.`);
    article.append(heading, canvas); grid.append(article);
    listen(button, 'click', () => open(entry, null, false), undefined, tileRemovers);

    // The reader handles feature hit-testing and keyboard activation. Track a
    // separate tap only to open non-feature artwork. The canvas bubble handler
    // runs after the reader's pointerup, so one tap cannot open twice.
    const pointers = new Set();
    let gesture = null, completedTap = null;
    listen(canvas, 'pointerdown', event => {
      if (event.button !== undefined && event.button !== 0) return;
      pointers.add(event.pointerId);
      if (pointers.size === 1) gesture = { x: event.clientX, y: event.clientY, moved: false, multiple: false, handled: false };
      else if (gesture) gesture.multiple = true;
    }, true, tileRemovers);
    listen(canvas, 'pointermove', event => {
      if (gesture && pointers.has(event.pointerId) && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > MOVE_THRESHOLD) gesture.moved = true;
    }, true, tileRemovers);
    listen(canvas, 'pointerup', event => {
      if (!pointers.has(event.pointerId)) return;
      pointers.delete(event.pointerId);
      if (pointers.size || !gesture) return;
      const completed = gesture; gesture = null;
      if (completed.moved || completed.multiple) return;
      completedTap = pendingActivation = completed;
    }, true, tileRemovers);
    listen(canvas, 'pointerup', () => {
      const completed = completedTap; completedTap = null;
      if (!completed) return;
      if (!disposed && turn === generation && !completed.handled) open(entry, null, false);
      if (pendingActivation === completed) pendingActivation = null;
    }, false, tileRemovers);
    const cancel = event => { pointers.delete(event.pointerId); if (gesture) gesture.multiple = true; if (!pointers.size) gesture = null; };
    listen(canvas, 'pointercancel', cancel, true, tileRemovers);
    // A pointer can leave the viewport while dragging. The shared reader owns
    // capture; clearing this tracker never opens a view on a later stray click.
    listen(canvas, 'lostpointercapture', event => { if (pointers.has(event.pointerId)) cancel(event); }, true, tileRemovers);
    let failed = false;
    const fail = error => {
      if (disposed || turn !== generation || failed) return;
      failed = true; button.disabled = true;
      canvas.replaceChildren(html('p', 'drawing-overview-error', 'This view is unavailable. Open the source PDF to inspect its drawing.'));
      onError(error);
    };
    try {
      const profile = lockedRegionId ? { ...entry.profile, regions: entry.profile.regions.filter(region => region.id === lockedRegionId) } : entry.profile;
      const viewer = createView({ mount: canvas, profile, artwork: entry.artwork, document: doc, window: win, ResizeObserver: Observer,
        onSelect: id => { if (!disposed && turn === generation) open(entry, id, true); }, onError: fail });
      const target = profile.regions.some(region => region.id === selection) ? selection : null;
      viewer.select(target);
      // Overview instruction differs from the full reader's pan/zoom hint.
      const title = viewer.element?.querySelector?.('title');
      if (title) title.textContent = `${entry.title || entry.profile.title}. Select a linked detail to enlarge it. Use the view heading to open the whole view.`;
      for (const region of viewer.element?.querySelectorAll?.('.drawing-region[role="button"]') || []) {
        const id = region.getAttribute('data-region-id'), label = profile.regions.find(item => item.id === id)?.label || 'Drawing detail';
        region.setAttribute('aria-label', `Enlarge ${label}`);
      }
      viewers.push({ entry, viewer });
      return Promise.resolve(viewer.ready).catch(fail);
    } catch (error) { fail(error); return Promise.resolve(); }
  }
  function render() {
    if (disposed) return;
    const turn = ++generation;
    clearViews();
    root.setAttribute('data-layout', compact ? 'single' : 'grid');
    chooser.hidden = !compact || sourceEntries.length < 2;
    select.value = activeId || '';
    if (!sourceEntries.length) {
      grid.append(html('p', 'drawing-overview-error', 'A prepared overview is not available for this source version.'));
      ready = Promise.resolve(); return;
    }
    const visible = compact ? sourceEntries.filter(entry => entry.id === activeId) : sourceEntries;
    ready = Promise.all(visible.map(entry => tile(entry, sourceEntries.indexOf(entry), turn))).then(() => undefined);
  }
  function resize() {
    if (disposed) return;
    const width = mount.getBoundingClientRect().width;
    const next = width > 0 ? width <= COMPACT_WIDTH : (win?.innerWidth || 1024) <= COMPACT_WIDTH;
    if (next !== compact) { compact = next; render(); }
    else viewers.forEach(({ viewer }) => viewer.resize());
  }
  listen(select, 'change', () => {
    if (disposed || !sourceEntries.some(entry => entry.id === select.value)) return;
    activeId = select.value; render();
  });
  const observer = Observer ? new Observer(resize) : null;
  if (observer) observer.observe(mount);
  else if (win?.addEventListener) listen(win, 'resize', resize);
  resize();
  return {
    get ready() { return ready; },
    get element() { return root; },
    get activeEntryId() { return activeId; },
    get selectedId() { return selection; },
    select(id) {
      if (disposed || (lockedRegionId && id !== lockedRegionId) || (id !== null && !sourceEntries.some(entry => entry.regionIds?.includes(id)))) return false;
      selection = id;
      if (compact && id && !sourceEntries.find(entry => entry.id === activeId)?.regionIds?.includes(id)) {
        activeId = sourceEntries.find(entry => entry.regionIds?.includes(id)).id; render();
      } else viewers.forEach(({ entry, viewer }) => viewer.select(entry.regionIds?.includes(id) ? id : null));
      return true;
    },
    focusRegion(id) {
      if (disposed || (lockedRegionId && id !== lockedRegionId)) return false;
      const entry = sourceEntries.find(item => item.id === activeId && item.regionIds?.includes(id)) || sourceEntries.find(item => item.regionIds?.includes(id));
      if (!entry) return false;
      open(entry, id, true); return true;
    },
    fit() { if (!disposed) viewers.forEach(({ viewer }) => viewer.fit?.()); },
    resize,
    dispose() {
      if (disposed) return;
      disposed = true; ++generation; observer?.disconnect();
      removers.forEach(remove => remove()); clearViews(); root.remove();
    },
  };
}
