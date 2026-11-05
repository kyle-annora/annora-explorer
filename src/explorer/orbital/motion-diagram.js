import './motion-diagram.css';

const namespace = 'http://www.w3.org/2000/svg';
let nextId = 0;
const vector = value => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
const normalized = (value, fallback) => {
  if (!vector(value)) return fallback;
  const length = Math.hypot(...value);
  return length > 1e-9 ? value.map(number => number / length) : fallback;
};
const dot = (point, axis) => point.reduce((sum, coordinate, index) => sum + coordinate * axis[index], 0);
function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function svgElement(tag, className, attributes = {}) {
  const node = document.createElementNS(namespace, tag);
  node.setAttribute('class', className);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  return node;
}
const pathFor = points => points.map(([x,y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`).join(' ');

/** A single SVG projection of the exact sampled mechanism; no independent clock. */
export function createMotionDiagram({ main, mount = main, getAccent, onTakeover, onReference }) {
  const root = element('aside', 'orbit-motion-diagram');
  root.setAttribute('aria-label', 'Motion diagram');
  root.hidden = true;
  const toggle = element('button', 'orbit-motion-toggle', 'View motion diagram');
  toggle.type = 'button';
  const panel = element('div', 'orbit-motion-panel');
  panel.id = 'orbit-motion-panel-' + ++nextId;
  toggle.setAttribute('aria-controls', panel.id);
  toggle.setAttribute('aria-expanded', 'false');
  const heading = element('div', 'orbit-motion-heading');
  heading.append(element('span', 'orbit-motion-kicker', 'Motion diagram'),
    element('span', 'orbit-motion-projection', 'Side view'));
  const figure = element('figure', 'orbit-motion-figure');
  const svg = svgElement('svg', 'orbit-motion-svg', { viewBox: '0 0 320 180', role: 'img' });
  const title = svgElement('title', '');
  const description = svgElement('desc', '');
  title.id = 'orbit-motion-title-' + nextId;
  description.id = 'orbit-motion-description-' + nextId;
  svg.setAttribute('aria-labelledby', `${title.id} ${description.id}`);
  const rest = svgElement('path', 'orbit-motion-rest');
  const trace = svgElement('path', 'orbit-motion-path');
  const travelled = svgElement('path', 'orbit-motion-travelled');
  const segments = [0,1].map(() => svgElement('path', 'orbit-motion-link'));
  const joints = [0,1].map(() => svgElement('circle', 'orbit-motion-joint', { r: 3.5 }));
  const numbers = [0,1].map((index) => {
    const node = svgElement('text', 'orbit-motion-number');
    node.textContent = String(index + 1).padStart(2, '0');
    return node;
  });
  const foot = svgElement('circle', 'orbit-motion-foot', { r: 3.5 });
  svg.append(title, description, trace, rest, ...segments, travelled, ...joints, ...numbers, foot);
  const labels = element('div', 'orbit-motion-joints');
  const jointLabels = [0,1].map((index) => {
    const label = element('span', 'orbit-motion-joint-label');
    label.append(element('span', 'orbit-motion-index', String(index + 1).padStart(2, '0')),
      element('span', 'orbit-motion-joint-name'));
    labels.append(label);
    return label;
  });
  const caption = element('figcaption', 'orbit-motion-caption');
  caption.append(element('span', 'orbit-motion-key-rest', 'At rest'),
    element('span', 'orbit-motion-key-path', 'Foot path'));
  figure.append(svg, labels, caption);
  const footer = element('div', 'orbit-motion-footer');
  footer.append(element('span', 'orbit-motion-note', 'Illustrative motion'));
  const reference = element('button', 'orbit-motion-reference', 'Reference drawings');
  reference.type = 'button';
  reference.hidden = typeof onReference !== 'function';
  footer.append(reference);
  panel.append(heading, figure, footer);
  root.append(toggle, panel);
  main.append(root);

  const abort = new AbortController();
  const compact = matchMedia('(max-width: 700px), (max-height: 520px)');
  let chapterId = null, config = null, frame = null, bounds = null;
  let expanded = false, hidden = false, disposed = false;
  let horizontal = [1,0,0], vertical = [0,1,0];
  const project = point => [dot(point, horizontal), dot(point, vertical)];

  function syncVisibility() {
    root.hidden = !config || hidden;
    main.toggleAttribute('data-motion-diagram', Boolean(config && !hidden));
    main.toggleAttribute('data-motion-diagram-open', Boolean(config && !hidden && compact.matches && expanded));
    root.toggleAttribute('data-expanded', expanded);
    toggle.setAttribute('aria-expanded', String(expanded));
    toggle.textContent = expanded ? 'Hide motion diagram' : 'View motion diagram';
    panel.hidden = compact.matches && !expanded;
    if (!panel.hidden) draw();
  }
  function draw() {
    if (!frame || !config || root.hidden || panel.hidden) return;
    const points = frame.points.map(project);
    const restPoints = frame.restPoints.map(project);
    const allTrace = frame.trace.map(project);
    if (!bounds) {
      // Fit once per chapter from the complete path and rest pose. A rotating
      // camera and a moving joint cannot make this comparison reframe itself.
      const all = [...restPoints, ...allTrace];
      const xs = all.map(point => point[0]), ys = all.map(point => point[1]);
      const left = Math.min(...xs), right = Math.max(...xs);
      const bottom = Math.min(...ys), top = Math.max(...ys);
      const span = Math.max(right - left, top - bottom, 1e-6);
      bounds = { left: left - span * .20, right: right + span * .20,
        bottom: bottom - span * .12, top: top + span * .26 };
    }
    const width = bounds.right - bounds.left, height = bounds.top - bounds.bottom;
    const scale = Math.min(290 / width, 160 / height);
    const left = (320 - width * scale) / 2, top = (180 - height * scale) / 2;
    const map = ([x,y]) => [left + (x - bounds.left) * scale, top + (bounds.top - y) * scale];
    const current = points.map(map);
    rest.setAttribute('d', pathFor(restPoints.map(map)));
    trace.setAttribute('d', pathFor(allTrace.map(map)));
    const progress = Math.max(0, Math.min(1, frame.progress));
    const count = Math.floor((allTrace.length - 1) * progress) + 1;
    travelled.setAttribute('d', pathFor([...allTrace.slice(0, count).map(map), current[2]]));
    travelled.style.visibility = progress > 0 ? 'visible' : 'hidden';
    for (let index = 0; index < 2; index++) {
      segments[index].setAttribute('d', pathFor(current.slice(index, index + 2)));
      const active = index === frame.activeIndex;
      segments[index].toggleAttribute('data-active', active);
      joints[index].toggleAttribute('data-active', active);
      jointLabels[index].toggleAttribute('data-active', active);
      const [x,y] = current[index];
      joints[index].setAttribute('cx', x);
      joints[index].setAttribute('cy', y);
      numbers[index].setAttribute('x', x + (index === 0 ? -9 : 9));
      numbers[index].setAttribute('y', y - 10);
      numbers[index].setAttribute('text-anchor', index === 0 ? 'end' : 'start');
    }
    foot.setAttribute('cx', current[2][0]);
    foot.setAttribute('cy', current[2][1]);
    root.dataset.progress = String(progress);
    root.dataset.activeIndex = String(frame.activeIndex);
    const accent = getAccent?.();
    if (typeof accent === 'string' && accent) root.style.setProperty('--motion-accent', accent);
  }
  function setChapter(chapter) {
    const nextConfig = chapter?.explanation;
    if (chapterId === chapter?.id && config === nextConfig) return;
    chapterId = chapter?.id ?? null;
    config = nextConfig?.joints?.length >= 2 && nextConfig.diagram ? nextConfig : null;
    frame = bounds = null;
    hidden = expanded = false;
    if (config) {
      horizontal = normalized(config.diagram.horizontal, [1,0,0]);
      vertical = normalized(config.diagram.vertical, [0,1,0]);
      root.dataset.chapter = chapterId;
      title.textContent = config.title || 'Two joints and the foot path';
      description.textContent = 'Side projection of the current pose. Dashed links mark the starting pose. The colored path follows one point on the foot.';
      jointLabels.forEach((label, index) => {
        label.querySelector('.orbit-motion-joint-name').textContent = config.joints[index].label || `Joint ${index + 1}`;
      });
    } else delete root.dataset.chapter;
    svg.style.visibility = 'hidden';
    syncVisibility();
  }
  function setFrame(next) {
    if (disposed || !config || !next || !Array.isArray(next.points) || next.points.length !== 3 ||
        !next.points.every(vector) || !Array.isArray(next.trace) || next.trace.length < 2 || !next.trace.every(vector)) return;
    const restPoints = next.restPoints?.length === 3 && next.restPoints.every(vector) ? next.restPoints : frame?.restPoints;
    // Waiting for the actual start pose avoids labelling a restored mid-action
    // checkpoint as the resting mechanism.
    if (!restPoints) return;
    frame = { points: next.points, trace: next.trace, restPoints,
      progress: Number.isFinite(next.progress) ? next.progress : 0,
      activeIndex: next.activeIndex === 0 || next.activeIndex === 1 ? next.activeIndex : -1 };
    svg.style.visibility = 'visible';
    draw();
  }
  toggle.addEventListener('click', () => {
    expanded = !expanded;
    if (expanded) onTakeover?.();
    syncVisibility();
  }, { signal: abort.signal });
  reference.addEventListener('click', () => {
    onTakeover?.();
    onReference?.();
  }, { signal: abort.signal });
  root.addEventListener('pointerdown', event => event.stopPropagation(), { signal: abort.signal });
  window.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !expanded || !compact.matches || root.hidden) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    expanded = false;
    syncVisibility();
    toggle.focus({ preventScroll: true });
  }, { capture: true, signal: abort.signal });
  compact.addEventListener('change', syncVisibility, { signal: abort.signal });
  return {
    setChapter, setFrame,
    setHidden(value) {
      hidden = Boolean(value);
      syncVisibility();
      if (hidden && root.contains(document.activeElement)) mount.focus?.({ preventScroll: true });
    },
    dispose() {
      disposed = true;
      abort.abort();
      root.remove();
      main.removeAttribute('data-motion-diagram');
      main.removeAttribute('data-motion-diagram-open');
    },
  };
}
