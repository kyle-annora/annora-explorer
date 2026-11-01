import { createDrawingView } from './drawing-view.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
let instanceNumber = 0;

function viewBox(value, label) {
  if (!Array.isArray(value) || value.length !== 4 || !value.every(Number.isFinite) || value[2] <= 0 || value[3] <= 0)
    throw new TypeError(`${label} must contain finite x, y, width and height values.`);
  return value.slice();
}

function technicalRegions(profile, paper) {
  const result = [], ids = new Set();
  if (!(profile.regions || []).some(region => region.id === 'overview' && region.geometry)) {
    result.push({ id: 'overview', role: 'overview', label: profile.title || 'Part overview', bounds: paper.slice() });
    ids.add('overview');
  }
  for (const region of profile.regions || []) {
    if (!region.geometry || region.mappingStatus === 'missing') continue;
    if (typeof region.id !== 'string' || !region.id || ids.has(region.id)) throw new TypeError('Technical region IDs must be unique.');
    const shape = region.geometry;
    let box;
    if (shape.type === 'circle') {
      if (![shape.cx, shape.cy, shape.r].every(Number.isFinite) || shape.r <= 0) throw new TypeError(`Technical region ${region.id} needs a finite, positive circle.`);
      box = [shape.cx - shape.r, shape.cy - shape.r, shape.r * 2, shape.r * 2];
    } else if (['path', 'compound'].includes(shape.type)) {
      box = viewBox(shape.bounds || region.bounds, `Technical region ${region.id}`);
      if (!region.outlinePathIds?.length) throw new TypeError(`Technical region ${region.id} needs exact prepared outline paths.`);
    } else throw new TypeError(`Technical region ${region.id} has an unsupported geometry type.`);
    if (box[0] < paper[0] - .001 || box[1] < paper[1] - .001 || box[0] + box[2] > paper[0] + paper[2] + .001 || box[1] + box[3] > paper[1] + paper[3] + .001)
      throw new TypeError(`Technical region ${region.id} must stay inside its prepared view.`);
    const cx = Number.isFinite(shape.cx) ? shape.cx : box[0] + box[2] / 2;
    const cy = Number.isFinite(shape.cy) ? shape.cy : box[1] + box[3] / 2;
    ids.add(region.id);
    result.push({ ...region, bounds: box, interactive: true, role: 'feature', geometry: { ...shape, cx, cy } });
  }
  return result;
}

function inlineArtwork(artwork, { doc, Parser, prefix, annotationVariant }) {
  if (typeof artwork !== 'string' || !artwork.trim() || artwork.length > 2_000_000)
    throw new TypeError('A prepared vector SVG is required.');
  if (!Parser || /<!DOCTYPE|<!ENTITY/i.test(artwork)) throw new TypeError('Prepared artwork must be a standalone SVG without external entities.');
  const parsed = new Parser().parseFromString(artwork, 'image/svg+xml');
  const source = parsed.documentElement;
  if (!source || source.localName !== 'svg' || source.namespaceURI !== SVG_NS || parsed.querySelector?.('parsererror'))
    throw new TypeError('Prepared artwork could not be read as SVG.');
  const original = viewBox((source.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number), 'Artwork viewBox');
  const elements = [source, ...source.querySelectorAll('*')];
  // This boundary accepts reviewed repository artwork, not customer uploads.
  // Keep the inline surface vector-only and prevent an asset from affecting the host.
  const allowed = new Set(['svg', 'g', 'path', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'rect', 'text', 'tspan', 'defs', 'clipPath', 'marker', 'use', 'title', 'desc']);
  for (const element of elements) {
    if (!allowed.has(element.localName)) throw new TypeError(`Prepared artwork contains an unsupported ${element.localName} element.`);
    for (const attribute of element.attributes) {
      if (/^on/i.test(attribute.name) || attribute.name === 'style') throw new TypeError('Prepared artwork must use presentation attributes without scripts or inline styles.');
      const externalPaint = [...attribute.value.matchAll(/url\(([^)]*)\)/gi)].some(([, target]) => !target.trim().replace(/^["']|["']$/g, '').startsWith('#'));
      if ((attribute.localName === 'href' && !attribute.value.startsWith('#')) || externalPaint)
        throw new TypeError('Prepared artwork cannot load external resources.');
    }
  }
  const element = doc.importNode ? doc.importNode(source, true) : source.cloneNode(true);
  const imported = [element, ...element.querySelectorAll('*')];
  const ids = new Map(imported.filter(node => node.hasAttribute('id')).map(node => [node.getAttribute('id'), `${prefix}-${node.getAttribute('id')}`]));
  for (const node of imported) {
    for (const attribute of [...node.attributes]) {
      let value = attribute.value;
      if (attribute.name === 'id') value = ids.get(value);
      else if (attribute.localName === 'href' && value.startsWith('#') && ids.has(value.slice(1))) value = `#${ids.get(value.slice(1))}`;
      else if (['aria-labelledby', 'aria-describedby'].includes(attribute.name)) value = value.split(/\s+/).map(id => ids.get(id) || id).join(' ');
      else value = value.replace(/url\(\s*["']?#([^)'"\s]+)["']?\s*\)/g, (match, id) => ids.has(id) ? `url(#${ids.get(id)})` : match);
      if (value !== attribute.value) node.setAttribute(attribute.name, value);
    }
    const groupPresentation = node.getAttribute('data-presentation');
    if (groupPresentation)
      node.setAttribute('display', groupPresentation.split(/\s+/).includes(annotationVariant) ? 'inline' : 'none');
  }
  // The SVG viewport has the same size and origin as its original viewBox.
  // Cropping is outside this node, so all paths, text and feature circles retain
  // their authored coordinates in either the front or the bore-detail view.
  for (const [name, value] of Object.entries({ x: original[0], y: original[1], width: original[2], height: original[3], 'aria-hidden': 'true', focusable: 'false', 'pointer-events': 'none' }))
    element.setAttribute(name, String(value));
  return { element, ids };
}

/** Prepared, source-derived technical artwork over the shared drawing controls.
 * `profile.viewBox` chooses a prepared crop; artwork always keeps its original
 * frame. Canonical region IDs remain unchanged. No business snapshot is edited,
 * and a programmatic selection never emits a second selection event.
 */
export function createTechnicalDrawingView({ mount, profile, artwork, onSelect = () => {}, onViewChange = () => {}, onError = () => {},
  document: doc = globalThis.document, window: win = globalThis.window, ResizeObserver: Observer = globalThis.ResizeObserver,
  DOMParser: Parser = globalThis.DOMParser, URL: URLs = globalThis.URL, Blob: BlobClass = globalThis.Blob } = {}) {
  let viewer, placeholder;
  try {
    const paper = viewBox(profile?.viewBox, 'Technical viewBox');
    const presentation = profile.presentation || 'front';
    if (typeof presentation !== 'string' || !/^[a-zA-Z0-9._:-]{1,160}$/.test(presentation)) throw new TypeError('Choose a prepared technical presentation.');
    const annotationVariant = profile.annotationVariant || (presentation === 'bore' ? 'detail' : 'front');
    const regions = technicalRegions(profile, paper), prefix = `technical-${++instanceNumber}`;
    const { element: vector, ids: artworkIds } = inlineArtwork(artwork, { doc, Parser, prefix, annotationVariant });
    const svg = (tag, attributes = {}) => {
      const node = doc.createElementNS(SVG_NS, tag);
      for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value));
      return node;
    };
    // The shared reader requires an image URL during construction. Its inert,
    // local placeholder is replaced synchronously and immediately revoked.
    placeholder = URLs.createObjectURL(new BlobClass([`<svg xmlns="${SVG_NS}"/>`], { type: 'image/svg+xml' }));
    viewer = createDrawingView({ mount, assetURL: placeholder, sheet: { id: profile.sheetId, title: profile.title || 'Technical front view', viewBox: paper, regions },
      onSelect, onViewChange, document: doc, window: win, ResizeObserver: Observer });
    const root = viewer.element;
    root.setAttribute('class', `${root.getAttribute('class')} technical-drawing-view`);
    root.setAttribute('data-presentation', presentation);
    root.setAttribute('data-sheet-id', profile.sheetId || '');
    const image = root.querySelector('image'), clipId = `${prefix}-crop`;
    const clip = svg('clipPath', { id: clipId, clipPathUnits: 'userSpaceOnUse' });
    clip.append(svg('rect', { x: paper[0], y: paper[1], width: paper[2], height: paper[3] }));
    const defs = svg('defs'); defs.append(clip);
    const inline = svg('g', { class: 'technical-vector-artwork', 'clip-path': `url(#${clipId})`, 'pointer-events': 'none', 'aria-hidden': 'true' });
    inline.append(defs, vector);
    image.replaceWith(inline);
    const styles = svg('style');
    styles.textContent = `
      .technical-drawing-view .drawing-region-corners,
      .technical-drawing-view .drawing-region-fill { display: none; }
      .technical-drawing-view .technical-region-outline {
        fill: none;
        stroke: var(--accent, #ff6840); stroke-width: 2px;
        opacity: 0; pointer-events: none; vector-effect: non-scaling-stroke;
      }
      .technical-drawing-view .drawing-region[data-hover="true"] .technical-region-outline { opacity: 1; }
      .technical-drawing-view .drawing-region[data-selected="true"] .technical-region-outline { opacity: 1; }
      .technical-drawing-view .drawing-region[data-selected="true"] circle.technical-region-outline { fill: var(--accent, #ff6840); fill-opacity: .055; }
      .technical-drawing-view .drawing-region:focus-visible .technical-region-outline { opacity: 1; stroke-dasharray: 3 3; }
    `;
    root.append(styles);
    const sourcePaths = new Map([...vector.querySelectorAll('path')].map(path => [path.getAttribute('id'), path]));
    for (const group of root.querySelectorAll('.drawing-region')) {
      const region = regions.find(item => item.id === group.getAttribute('data-region-id'));
      if (!region?.geometry) continue;
      const outlineIds = region.outlinePathIds || (regions.length === 2 ? profile.featureOutlinePathIds : null);
      const common = { class: 'technical-region-outline', 'stroke-width': '2', 'vector-effect': 'non-scaling-stroke', 'pointer-events': 'none', 'aria-hidden': 'true' };
      if (outlineIds?.length) {
        for (const id of outlineIds) {
          const path = sourcePaths.get(artworkIds.get(id));
          if (!path) throw new TypeError(`Prepared feature outline ${id} is missing from the artwork.`);
          const contour = path.cloneNode(true), transforms = [];
          for (let ancestor = path.parentNode; ancestor && ancestor !== vector; ancestor = ancestor.parentNode)
            if (ancestor.hasAttribute('transform')) transforms.unshift(ancestor.getAttribute('transform'));
          if (path.hasAttribute('transform')) transforms.push(path.getAttribute('transform'));
          contour.removeAttribute('id');
          for (const [name, value] of Object.entries(common)) contour.setAttribute(name, value);
          if (transforms.length) contour.setAttribute('transform', transforms.join(' '));
          contour.setAttribute('data-outline-source', id);
          group.append(contour);
        }
      } else {
        const { cx, cy, r } = region.geometry;
        group.append(svg('circle', { ...common, cx, cy, r }));
      }
    }
    let disposed = false;
    const available = id => id === null || regions.some(region => region.id === id);
    const controller = {
      select(id, { focus = false } = {}) {
        if (disposed || !available(id)) return false;
        const result = viewer.select(id);
        if (focus && id !== null) viewer.fit();
        return result;
      },
      // The host's explicit Front / Bore control chooses the composition. A
      // linked selection should not unexpectedly magnify that view again.
      focusRegion(id) { if (disposed || id === null || !available(id)) return false; viewer.fit(); return true; },
      fit() { if (!disposed) viewer.fit(); },
      zoomBy(factor) { if (!disposed) viewer.zoomBy(factor); },
      setZoom(zoom) {
        if (disposed || ![1, 2, 4].includes(zoom)) return false;
        if (zoom === 1) { viewer.fit(); return true; }
        const feature = regions.find(region => region.id === viewer.selectedId)?.geometry;
        if (feature) return viewer.zoomTo(zoom, { x: feature.cx, y: feature.cy });
        viewer.zoomBy(zoom / viewer.zoom); return true;
      },
      resize() { if (!disposed) viewer.resize(); },
      get selectedId() { return viewer.selectedId; },
      get element() { return root; },
      get zoom() { return viewer.zoom; },
      dispose() { if (disposed) return; disposed = true; viewer.dispose(); },
    };
    controller.ready = Promise.resolve(controller);
    return controller;
  } catch (error) {
    viewer?.dispose();
    onError(error);
    throw error;
  } finally {
    if (placeholder) URLs.revokeObjectURL(placeholder);
  }
}
