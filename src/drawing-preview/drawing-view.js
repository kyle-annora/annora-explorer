const SVG_NS = 'http://www.w3.org/2000/svg';
const MAX_ZOOM = 8;
const PAPER_MARGIN = 20;
const MIN_TARGET = 44;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function bounds(value, label) {
  if (!Array.isArray(value) || value.length !== 4 || !value.every(Number.isFinite) || value[2] <= 0 || value[3] <= 0)
    throw new TypeError(`${label} must contain finite x, y, width and height values.`);
  return value.slice();
}

/** Screen-sized hit targets, clipped to the actual drawing paper. */
export function drawingHitBounds(regionBounds, scale, paperBounds, targetSize = MIN_TARGET) {
  const [x, y, width, height] = regionBounds;
  const [px, py, pw, ph] = paperBounds;
  const w = Math.min(pw, Math.max(width, targetSize / scale));
  const h = Math.min(ph, Math.max(height, targetSize / scale));
  return [clamp(x + width / 2 - w / 2, px, px + pw - w), clamp(y + height / 2 - h / 2, py, py + ph - h), w, h];
}

const contains = ([x, y, width, height], point) => point.x >= x && point.x <= x + width && point.y >= y && point.y <= y + height;

/** Actual geometry bounds win over enlarged neighbouring targets. This keeps
 * a small bore reachable even when its 44px target overlaps the web target. */
export function drawingRegionAtPoint(regions, point, scale, paperBounds) {
  if (!contains(paperBounds, point)) return null;
  const actual = regions.filter(region => contains(region.bounds, point));
  const candidates = actual.length ? actual : regions.filter(region => contains(drawingHitBounds(region.bounds, scale, paperBounds), point));
  return candidates.slice().sort((a, b) => {
    if (actual.length) return a.bounds[2] * a.bounds[3] - b.bounds[2] * b.bounds[3];
    const distance = region => Math.hypot(point.x - region.bounds[0] - region.bounds[2] / 2, point.y - region.bounds[1] - region.bounds[3] / 2);
    return distance(a) - distance(b);
  })[0] || null;
}

function cornerPath([x, y, width, height], scale) {
  const length = Math.min(8 / scale, width / 3, height / 3);
  return `M${x},${y + length}V${y}H${x + length} M${x + width - length},${y}H${x + width}V${y + length} M${x + width},${y + height - length}V${y + height}H${x + width - length} M${x + length},${y + height}H${x}V${y + height - length}`;
}

/** A single, event-driven SVG sheet. The host owns navigation and toolbar UI;
 * this module owns only document pan, zoom and accessible linked regions.
 * Programmatic selection does not call onSelect, avoiding a 3D/2D echo loop. */
export function createDrawingView({ mount, assetURL, sheet, showOverview = false, interactionMode = 'inspect', onRegionDraw = () => {}, onRegionDrawCancel = () => {}, onSelect = () => {}, onViewChange = () => {}, onError = () => {},
  document: doc = globalThis.document, window: win = globalThis.window, ResizeObserver: Observer = globalThis.ResizeObserver } = {}) {
  if (!mount?.replaceChildren || !doc?.createElementNS) throw new TypeError('A drawing mount and browser document are required.');
  const paper = bounds(sheet?.viewBox, 'Sheet viewBox');
  const regions = (sheet.regions || []).filter(region => !(region.bounds === null && region.mappingStatus === 'missing')).map(region => ({ ...region, bounds: bounds(region.bounds, `Region ${region.id}`) }));
  if (new Set(regions.map(region => region.id)).size !== regions.length) throw new TypeError('Drawing region IDs must be unique.');
  if (regions.some(({ bounds: [x, y, w, h] }) => x < paper[0] || y < paper[1] || x + w > paper[0] + paper[2] || y + h > paper[1] + paper[3]))
    throw new TypeError('Linked drawing regions must stay inside the paper.');
  const interactiveRegions = regions.filter(region => region.interactive === true || (region.role !== 'overview' && region.id !== 'overview'));
  const source = new URL(assetURL, doc.baseURI || win?.location?.href || 'http://localhost/');
  if (!['http:', 'https:', 'blob:'].includes(source.protocol)) throw new TypeError('A drawing must use a local or HTTP image URL.');
  let disposed = false, selectedId = null, width = 1, height = 1, fitScale = 1, scale = 1, tx = 0, ty = 0, initialized = false;
  let tool = interactionMode, draftBounds = null, drawGesture = null;
  let gestureMoved = false, gestureHadPinch = false, downPoint = null;
  const pointers = new Map(), removers = [], regionElements = new Map();
  const svg = (tag, attributes = {}) => {
    const element = doc.createElementNS(SVG_NS, tag);
    for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value));
    return element;
  };
  const listen = (target, type, listener, options) => {
    target.addEventListener(type, listener, options);
    removers.push(() => target.removeEventListener(type, listener, options));
  };
  const root = svg('svg', { class: 'drawing-sheet-view', role: 'group', 'aria-label': sheet.title || 'Linked engineering drawing', width: '100%', height: '100%', preserveAspectRatio: 'none' });
  const originalMountPosition = mount.style?.position;
  const positionedMount = win?.getComputedStyle?.(mount).position === 'static';
  if (positionedMount) mount.style.position = 'relative';
  // An SVG in normal flow can contribute an intrinsic aspect-ratio height to
  // an otherwise bounded grid/flex pane, growing both the sheet and observer.
  Object.assign(root.style, { position: 'absolute', inset: '0', display: 'block', width: '100%', height: '100%', overflow: 'hidden', touchAction: 'none', background: 'var(--drawing-canvas, #e9e9e7)', cursor: 'grab', userSelect: 'none' });
  const styles = svg('style');
  styles.textContent = `
    .drawing-sheet-view:focus { outline: none; }
    .drawing-sheet-view:focus-visible { outline: 2px solid var(--accent, #ff6840); outline-offset: -2px; }
    .drawing-region { -webkit-tap-highlight-color: transparent; }
    .drawing-region-corners { stroke: #73777b; opacity: .35; transition: opacity 100ms ease; }
    .drawing-region-fill { fill: var(--accent, #ff6840); opacity: 0; }
    .drawing-region[data-hover="true"] .drawing-region-corners { opacity: .8; }
    .drawing-region[data-selected="true"] .drawing-region-corners { stroke: var(--accent, #ff6840); opacity: 1; }
    .drawing-region[data-selected="true"] .drawing-region-fill { opacity: .09; }
    .drawing-region:focus { outline: none; }
    .drawing-region:focus-visible .drawing-region-corners { stroke: #292b2e; stroke-width: 2; opacity: 1; }
    @media (prefers-reduced-motion: reduce) { .drawing-region-corners { transition: none; } }
  `;
  const title = svg('title'); title.textContent = `${sheet.title || 'Engineering drawing'}. Drag to pan. Use the zoom controls or pinch to zoom. Tab to a linked detail, then press Enter.`;
  const stage = svg('g');
  const paperRect = svg('rect', { x: paper[0], y: paper[1], width: paper[2], height: paper[3], fill: '#fff', 'pointer-events': 'none' });
  const artwork = svg('image', { href: source.href, x: paper[0], y: paper[1], width: paper[2], height: paper[3], preserveAspectRatio: 'none', 'pointer-events': 'none', 'aria-hidden': 'true' });
  stage.append(paperRect, artwork);
  for (const region of showOverview ? regions : interactiveRegions) {
    const interactive = interactiveRegions.includes(region);
    const group = svg('g', { class: 'drawing-region', 'data-region-id': region.id,
      ...(interactive ? { role: 'button', tabindex: '0', 'aria-label': `${region.label}. Locate this detail in 3D.`, 'aria-pressed': 'false' }
        : { role: 'presentation', 'aria-hidden': 'true', 'pointer-events': 'none' }) });
    if (interactive) group.style.cursor = 'pointer';
    const hit = interactive ? svg('rect', { fill: 'transparent', 'pointer-events': 'all' }) : null;
    const fill = svg('rect', { class: 'drawing-region-fill', x: region.bounds[0], y: region.bounds[1], width: region.bounds[2], height: region.bounds[3], 'pointer-events': 'none' });
    const corners = svg('path', { class: 'drawing-region-corners', fill: 'none', 'stroke-width': '1.5', 'vector-effect': 'non-scaling-stroke', 'pointer-events': 'none' });
    if (interactive) group.append(hit, fill, corners);
    else group.append(corners); // Authoring-only overview outline never covers or captures a detail target.
    stage.append(group);
    regionElements.set(region.id, { group, hit, corners, region, interactive });
    if (!interactive) continue;
    listen(group, 'keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault(); event.stopPropagation();
      choose(region);
    });
    // Assistive technology can activate role=button without pointer events.
    listen(group, 'click', event => { if (event.detail === 0) { event.preventDefault(); choose(region); } });
    listen(group, 'focus', () => {
      const [x, y, w, h] = region.bounds;
      if (tx + x * scale < 0 || ty + y * scale < 0 || tx + (x + w) * scale > width || ty + (y + h) * scale > height) focusRegion(region.id);
    });
  }
  const draftLayer = svg('g', { 'data-drawing-draft': 'true', 'aria-hidden': 'true', 'pointer-events': 'none' });
  const draftRect = svg('rect', { fill: 'var(--accent, #ff6840)', 'fill-opacity': '.08', stroke: 'var(--accent, #ff6840)', 'stroke-width': '1.5', 'vector-effect': 'non-scaling-stroke' });
  const handles = Array.from({ length: 4 }, () => svg('rect', { fill: '#fff', stroke: 'var(--accent, #ff6840)', 'stroke-width': '1.5', 'vector-effect': 'non-scaling-stroke' }));
  draftLayer.append(draftRect, ...handles); stage.append(draftLayer);
  root.append(styles, title, stage);
  mount.replaceChildren(root);

  function constrain() {
    const [x, y, w, h] = paper;
    tx = w * scale <= width - PAPER_MARGIN * 2 ? (width - w * scale) / 2 - x * scale : clamp(tx, width - PAPER_MARGIN - (x + w) * scale, PAPER_MARGIN - x * scale);
    ty = h * scale <= height - PAPER_MARGIN * 2 ? (height - h * scale) / 2 - y * scale : clamp(ty, height - PAPER_MARGIN - (y + h) * scale, PAPER_MARGIN - y * scale);
  }
  function render() {
    if (disposed) return;
    constrain();
    root.setAttribute('viewBox', `0 0 ${width} ${height}`);
    stage.setAttribute('transform', `translate(${tx} ${ty}) scale(${scale})`);
    for (const { hit, corners, region } of regionElements.values()) {
      const [x, y, w, h] = drawingHitBounds(region.bounds, scale, paper);
      if (hit) for (const [name, value] of Object.entries({ x, y, width: w, height: h })) hit.setAttribute(name, String(value));
      corners.setAttribute('d', cornerPath(region.bounds, scale));
    }
    draftLayer.setAttribute('display', draftBounds ? 'inline' : 'none');
    if (draftBounds) {
      const [x, y, w, h] = draftBounds;
      for (const [key, value] of Object.entries({ x, y, width: w, height: h })) draftRect.setAttribute(key, value);
      [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].forEach(([hx, hy], index) => {
        for (const [key, value] of Object.entries({ x: hx - 5 / scale, y: hy - 5 / scale, width: 10 / scale, height: 10 / scale })) handles[index].setAttribute(key, value);
      });
    }
    onViewChange({ zoom: scale / fitScale, canZoomIn: scale / fitScale < MAX_ZOOM - .001, canZoomOut: scale / fitScale > 1.001 });
  }
  function fit() {
    if (disposed) return;
    scale = fitScale; tx = (width - paper[2] * scale) / 2 - paper[0] * scale; ty = (height - paper[3] * scale) / 2 - paper[1] * scale;
    render();
  }
  function resize() {
    if (disposed) return;
    const rect = mount.getBoundingClientRect();
    if (!(rect.width > 0 && rect.height > 0)) return;
    const center = { x: (width / 2 - tx) / scale, y: (height / 2 - ty) / scale }, zoom = scale / fitScale;
    width = rect.width; height = rect.height;
    fitScale = Math.min(Math.max(1, width - PAPER_MARGIN * 2) / paper[2], Math.max(1, height - PAPER_MARGIN * 2) / paper[3]);
    if (!initialized) { initialized = true; fit(); return; }
    scale = fitScale * zoom; tx = width / 2 - center.x * scale; ty = height / 2 - center.y * scale;
    render();
  }
  function zoomAt(factor, point, shift = { x: 0, y: 0 }) {
    const next = clamp(scale * factor, fitScale, fitScale * MAX_ZOOM);
    tx = point.x - (point.x - tx) * next / scale + shift.x;
    ty = point.y - (point.y - ty) * next / scale + shift.y;
    scale = next; render();
  }
  function zoomBy(factor) {
    if (disposed || !Number.isFinite(factor) || factor <= 0) return;
    zoomAt(factor, { x: width / 2, y: height / 2 });
  }
  /** An explicit preset can keep a selected feature centered. Ordinary pinch,
   * wheel and relative zoom retain their existing viewport anchors. */
  function zoomTo(zoom, center) {
    if (disposed || !Number.isFinite(zoom) || zoom <= 0 || !center ||
      !Number.isFinite(center.x) || !Number.isFinite(center.y) || !contains(paper, center)) return false;
    scale = fitScale * clamp(zoom, 1, MAX_ZOOM);
    tx = width / 2 - center.x * scale; ty = height / 2 - center.y * scale;
    render(); return true;
  }
  function focusRegion(id) {
    if (disposed) return false;
    const region = regions.find(item => item.id === id);
    if (!region) return false;
    const [x, y, w, h] = region.bounds;
    // Keep neighbouring geometry and dimension leaders visible. A bore should
    // arrive as an inspectable detail, not a huge isolated ring. Manual zoom
    // remains available up to 8x after this contextual 4x focus.
    scale = clamp(Math.min(width * .82 / Math.max(w * 1.6, 150), height * .82 / Math.max(h * 1.8, 120)), fitScale, fitScale * 4);
    tx = width / 2 - (x + w / 2) * scale; ty = height / 2 - (y + h / 2) * scale;
    render(); return true;
  }
  function select(id, { focus = false } = {}) {
    if (disposed || (id !== null && !regions.some(region => region.id === id))) return false;
    selectedId = id;
    for (const [regionId, { group, interactive }] of regionElements) {
      group.setAttribute('data-selected', String(regionId === id));
      if (interactive) group.setAttribute('aria-pressed', String(regionId === id));
    }
    if (focus && id !== null) focusRegion(id);
    return true;
  }
  function choose(region) {
    if (disposed || tool !== 'inspect' || drawGesture) return;
    select(region.id); onSelect(region.id, region);
  }
  function localPoint(event) {
    const rect = root.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * width / (rect.width || width), y: (event.clientY - rect.top) * height / (rect.height || height) };
  }
  const paperPoint = point => ({ x: clamp((point.x - tx) / scale, paper[0], paper[0] + paper[2]), y: clamp((point.y - ty) / scale, paper[1], paper[1] + paper[3]) });
  const rectBetween = (a, b) => [Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(a.x - b.x), Math.abs(a.y - b.y)];
  function cancelRegionDraw() {
    if (drawGesture) draftBounds = drawGesture.previous;
    drawGesture = null; render();
  }
  function setDraftBounds(value) {
    if (disposed) return;
    if (value !== null) {
      bounds(value, 'Draft region');
      if (!contains(paper, { x: value[0], y: value[1] }) || value[0] + value[2] > paper[0] + paper[2] + 1e-7 || value[1] + value[3] > paper[1] + paper[3] + 1e-7) throw new TypeError('The draft region must stay inside its source page.');
    }
    draftBounds = value?.slice() || null; render();
  }
  function setInteractionMode(value) {
    if (!['inspect', 'draw-region'].includes(value)) throw new TypeError('Choose inspect or draw-region mode.');
    if (disposed) return;
    cancelRegionDraw(); tool = value; root.style.cursor = tool === 'draw-region' ? 'crosshair' : 'grab';
    root.setAttribute('data-interaction-mode', tool);
    root.setAttribute('tabindex', tool === 'draw-region' ? '0' : '-1');
  }
  function draftCorner(point) {
    if (!draftBounds) return null;
    const [x, y, w, h] = draftBounds;
    const points = [[x, y], [x + w, y], [x, y + h], [x + w, y + h]];
    const nearest = points.map(([hx, hy], index) => ({ index, distance: Math.hypot(tx + hx * scale - point.x, ty + hy * scale - point.y) })).sort((a, b) => a.distance - b.distance)[0];
    return nearest.distance > 22 ? null : { x: points[3 - nearest.index][0], y: points[3 - nearest.index][1] };
  }
  const midpoint = ([a, b]) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const separation = ([a, b]) => Math.hypot(a.x - b.x, a.y - b.y);
  function hoverAt(point) {
    const hovered = tool === 'inspect' && point && drawingRegionAtPoint(interactiveRegions, { x: (point.x - tx) / scale, y: (point.y - ty) / scale }, scale, paper);
    for (const [id, { group }] of regionElements) group.setAttribute('data-hover', String(id === hovered?.id));
  }
  listen(root, 'pointerdown', event => {
    if (event.button !== 0 || disposed) return;
    const point = localPoint(event);
    if (!pointers.size) { gestureMoved = false; gestureHadPinch = false; downPoint = point; }
    pointers.set(event.pointerId, point);
    if (pointers.size > 1) { gestureHadPinch = true; cancelRegionDraw(); }
    else {
      const anchor = tool === 'inspect' ? draftCorner(point) : null;
      const inside = contains(paper, { x: (point.x - tx) / scale, y: (point.y - ty) / scale });
      if (anchor || (tool === 'draw-region' && inside)) { drawGesture = { anchor: anchor || paperPoint(point), previous: draftBounds?.slice() || null }; root.focus?.({ preventScroll: true }); }
    }
    root.setPointerCapture?.(event.pointerId); root.style.cursor = drawGesture ? 'crosshair' : 'grabbing';
  });
  listen(root, 'pointermove', event => {
    if (disposed) return;
    if (!pointers.has(event.pointerId)) { hoverAt(event.pointerType === 'touch' ? null : localPoint(event)); return; }
    hoverAt(null);
    const point = localPoint(event), before = [...pointers.values()], previous = pointers.get(event.pointerId);
    pointers.set(event.pointerId, point);
    if (downPoint && Math.hypot(point.x - downPoint.x, point.y - downPoint.y) > 5) gestureMoved = true;
    if (pointers.size >= 2) {
      const after = [...pointers.values()], oldMid = midpoint(before), nextMid = midpoint(after), distance = separation(before);
      if (distance > 0) zoomAt(separation(after) / distance, oldMid, { x: nextMid.x - oldMid.x, y: nextMid.y - oldMid.y });
    } else if (drawGesture) {
      draftBounds = rectBetween(drawGesture.anchor, paperPoint(point)); render();
    } else if (gestureMoved && tool === 'inspect') {
      tx += point.x - previous.x; ty += point.y - previous.y; render();
    }
  });
  function finishPointer(event, cancelled = false) {
    if (!pointers.has(event.pointerId)) return;
    const point = localPoint(event);
    const drawing = drawGesture;
    const activate = tool === 'inspect' && !drawing && !cancelled && pointers.size === 1 && !gestureMoved && !gestureHadPinch;
    if (drawing && pointers.size === 1) {
      const result = rectBetween(drawing.anchor, paperPoint(point));
      drawGesture = null;
      if (!cancelled && !gestureHadPinch && result[2] * scale >= 6 && result[3] * scale >= 6) {
        draftBounds = result; onRegionDraw(result.slice());
      } else draftBounds = drawing.previous;
      render();
    }
    pointers.delete(event.pointerId);
    if (root.hasPointerCapture?.(event.pointerId)) root.releasePointerCapture(event.pointerId);
    if (!pointers.size) root.style.cursor = tool === 'draw-region' ? 'crosshair' : 'grab';
    if (activate) {
      const region = drawingRegionAtPoint(interactiveRegions, { x: (point.x - tx) / scale, y: (point.y - ty) / scale }, scale, paper);
      if (region) choose(region);
    }
  }
  listen(root, 'pointerup', event => finishPointer(event));
  listen(root, 'pointerleave', () => hoverAt(null));
  listen(root, 'pointercancel', event => finishPointer(event, true));
  listen(root, 'lostpointercapture', event => { if (pointers.has(event.pointerId)) cancelRegionDraw(); pointers.delete(event.pointerId); if (!pointers.size) root.style.cursor = tool === 'draw-region' ? 'crosshair' : 'grab'; });
  listen(root, 'keydown', event => { if (event.key === 'Escape' && (drawGesture || tool === 'draw-region')) { event.preventDefault(); cancelRegionDraw(); setInteractionMode('inspect'); onRegionDrawCancel(); } });
  listen(root, 'wheel', event => {
    // Ordinary wheel scrolling belongs to the page. Trackpad pinch/Ctrl+wheel
    // opts into document zoom; the host provides explicit zoom buttons too.
    if (!event.ctrlKey || disposed) return;
    event.preventDefault(); cancelRegionDraw(); zoomAt(Math.exp(-clamp(event.deltaY, -100, 100) * .01), localPoint(event));
  }, { passive: false });
  listen(artwork, 'error', () => { if (!disposed) onError(new Error('The drawing could not be loaded. Reload the page or open the original PDF.')); });
  const observer = Observer ? new Observer(resize) : null;
  if (observer) observer.observe(mount);
  else if (win?.addEventListener) listen(win, 'resize', resize);
  resize(); setInteractionMode(interactionMode);

  return { setInteractionMode, setDraftBounds, cancelRegionDraw, select, focusRegion, fit, zoomBy, zoomTo, resize,
    get selectedId() { return selectedId; },
    get element() { return root; },
    get zoom() { return scale / fitScale; },
    dispose() {
      if (disposed) return;
      disposed = true; observer?.disconnect(); removers.forEach(remove => remove()); pointers.clear();
      root.remove();
      if (positionedMount && mount.style.position === 'relative') mount.style.position = originalMountPosition;
    },
  };
}
