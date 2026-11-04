import { calloutCurve } from './callout-curve.js';
import './callout.css';

const ns = 'http://www.w3.org/2000/svg';
const svgNode = name => document.createElementNS(ns, name);
const rectRelativeTo = (rect, host, bleed = 0) => ({
  left: rect.left - host.left - bleed, right: rect.right - host.left + bleed,
  top: rect.top - host.top - bleed, bottom: rect.bottom - host.top + bleed,
});

export function createCallout({ main, mount, getAccent }) {
  const layer = document.createElement('div');
  layer.className = 'orbit-callout-layer';
  const ink = svgNode('svg');
  ink.setAttribute('aria-hidden', 'true');
  const line = svgNode('path'), terminal = svgNode('circle');
  line.classList.add('orbit-callout-line');
  terminal.classList.add('orbit-callout-terminal');
  terminal.setAttribute('r', '2.15');
  ink.append(line, terminal);

  const copy = document.createElement('div');
  copy.className = 'orbit-callout-copy';
  copy.setAttribute('role', 'note');
  copy.setAttribute('aria-label', 'Part annotation');
  const title = document.createElement('strong'), text = document.createElement('span');
  title.className = 'orbit-callout-title'; text.className = 'orbit-callout-text';
  copy.append(title, text);
  layer.append(ink, copy);
  main.append(layer);
  const stackedLayout = matchMedia('(max-width: 700px)');
  let cue, point, layout;
  function measure() {
    if (!cue) return;
    const panel = layer.getBoundingClientRect(), canvas = mount.getBoundingClientRect();
    const heading = title.getBoundingClientRect(), note = copy.getBoundingClientRect();
    const stacked = stackedLayout.matches;
    const start = stacked ?
      { x: note.left - panel.left + 3, y: note.bottom - panel.top + 6 } :
      { x: heading.right - panel.left + 9, y: (heading.top + heading.bottom) / 2 - panel.top };
    const protectedText = [rectRelativeTo(heading, panel, 2)];
    // Protect only the printed text. The white space to its right is available
    // to a shallow leader, even when the explanation wraps onto two lines.
    const range = document.createRange();
    range.selectNodeContents(text);
    for (const rect of range.getClientRects()) protectedText.push(rectRelativeTo(rect, panel, 2));
    layout = { start, placement: stacked ? 'down' : 'right', protectedText,
      x: canvas.left - panel.left, y: canvas.top - panel.top };
    draw();
  }

  function draw() {
    const end = point && layout && { x: layout.x + point.x, y: layout.y + point.y };
    const path = cue && end && calloutCurve(layout.start, end, layout.placement, layout.protectedText,
      stackedLayout.matches ? 42 : 72);
    layer.toggleAttribute('data-anchor-visible', Boolean(path));
    if (!path) {
      ink.style.visibility = 'hidden';
      line.removeAttribute('d');
      return;
    }
    line.setAttribute('d', path);
    terminal.setAttribute('cx', end.x);
    terminal.setAttribute('cy', end.y);
    ink.style.visibility = 'visible';
  }

  let disposed = false;
  const observer = new ResizeObserver(measure);
  [layer, mount, copy].forEach(el => observer.observe(el));
  document.fonts?.ready.then(() => { if (!disposed) measure(); });
  layer.hidden = true;
  return {
    setCue(next) {
      if (cue === next) return;
      const a = cue?.anchor, b = next?.anchor;
      const sameAnchor = a && b && a.meshName === b.meshName &&
        [0, 1, 2].every(i => (a.fraction?.[i] ?? .5) === (b.fraction?.[i] ?? .5));
      cue = next;
      if (!sameAnchor) point = null;
      layer.hidden = !cue;
      if (!cue) { layout = null; draw(); return; }
      title.textContent = cue.title;
      text.textContent = cue.text;
      layer.style.setProperty('--callout-accent', getAccent());
      measure();
    },
    setPoint(next) { point = next; draw(); },
    getInset(width) {
      // The stage uses this width for optical framing only. The canvas and
      // pointer surface still reach the left edge of the presentation.
      if (stackedLayout.matches || !main.hasAttribute('data-callout-room')) return 0;
      return Math.min(width * .24, 284);
    },
    dispose() { disposed = true; observer.disconnect(); layer.remove(); },
  };
}
