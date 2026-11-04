// The last control point lies on the line from the first handle to the anchor.
// The stroke leaves the caption in a chosen direction, then straightens as it
// arrives. In the perpendicular direction it is monotone, so it cannot loop.
const tail = .28;
const axes = { right: [1, 0], left: [-1, 0], down: [0, 1] };
const finitePoint = p => Number.isFinite(p?.x) && Number.isFinite(p?.y);
const mix = (a, b, t) => a + (b - a) * t;

// Fraction of the perpendicular distance already covered at cubic parameter t.
function across(t) {
  return t * t * (3 * (1 - tail) * (1 - t) + t);
}

function parameterAt(fraction) {
  let low = 0, high = 1;
  for (let i = 0; i < 18; i++) {
    const t = (low + high) / 2;
    if (across(t) < fraction) low = t;
    else high = t;
  }
  return (low + high) / 2;
}

function outletRect(rect, start, ux, uy) {
  const left = rect?.left ?? rect?.x, top = rect?.top ?? rect?.y;
  const right = rect?.right ?? left + rect?.width, bottom = rect?.bottom ?? top + rect?.height;
  if (![left, top, right, bottom].every(Number.isFinite) || left >= right || top >= bottom) return null;
  const x0 = left - start.x, x1 = right - start.x, y0 = top - start.y, y1 = bottom - start.y;
  const us = [x0 * ux + y0 * uy, x1 * ux + y1 * uy];
  const vs = [y0 * ux - x0 * uy, y1 * ux - x1 * uy];
  return { u0: Math.min(...us), u1: Math.max(...us), v0: Math.min(...vs), v1: Math.max(...vs) };
}

function forwardAt(t, handle, forward) {
  const r = 1 - t;
  return handle * 3 * t * r * (r + tail * t) + forward * across(t);
}

function peakParameter(handle, forward) {
  // With the controls [0, h, (1-k)u+kh, u], the forward derivative
  // changes sign at most once. The other coordinate never changes direction.
  if (forward >= handle) return 1;
  let low = 0, high = 1;
  for (let i = 0; i < 18; i++) {
    const t = (low + high) / 2, r = 1 - t;
    const slope = handle * r * r + (forward - handle) * (2 * (1 - tail) * r * t + tail * t * t);
    if (slope > 0) low = t;
    else high = t;
  }
  return (low + high) / 2;
}

// Because across(t) is monotone, only one continuous section of the curve
// shares the box's perpendicular range. Find its forward range exactly up to
// the inversion tolerance, including the shoulder if it lies in this section.
function entersBox(box, handle, forward, lateral, peak) {
  let from = 0, to = 1;
  if (lateral === 0) {
    if (box.v0 >= 0 || box.v1 <= 0) return false;
  } else {
    const a = box.v0 / lateral, b = box.v1 / lateral;
    const low = Math.max(0, Math.min(a, b)), high = Math.min(1, Math.max(a, b));
    if (low >= high) return false;
    from = low === 0 ? 0 : parameterAt(low);
    to = high === 1 ? 1 : parameterAt(high);
  }
  const start = forwardAt(from, handle, forward), end = forwardAt(to, handle, forward);
  const high = forwardAt(Math.min(to, Math.max(from, peak)), handle, forward);
  return Math.min(start, end) < box.u1 && high > box.u0;
}

/**
 * Build a leader in SVG/CSS pixels. Place start at (or outside) the caption
 * edge. 'right' and 'left' are horizontal outlets; 'down' is a bottom outlet.
 * Exclusions are optional local rectangles, usually the caption and header.
 * An invisible anchor or a target behind the copy needs no leader.
 */
export function calloutCurve(start, end, placement = 'right', exclusion = null) {
  if (!finitePoint(start) || !finitePoint(end) || !Object.hasOwn(axes, placement)) return null;
  const [ux, uy] = axes[placement];
  const dx = end.x - start.x, dy = end.y - start.y, span = Math.hypot(dx, dy);
  const forward = dx * ux + dy * uy, lateral = dy * ux - dx * uy;
  if (!Number.isFinite(span) || span < 8 || (forward < 0 && Math.abs(lateral) < 6)) return null;

  let handle = Math.min(108, .36 * span);
  if (forward < 0) handle *= Math.min(1, Math.abs(lateral) / (.66 * span));
  const rects = Array.isArray(exclusion) ? exclusion : exclusion ? [exclusion] : [];
  const boxes = rects.map(rect => outletRect(rect, start, ux, uy)).filter(Boolean);
  let runway = 0;

  // A short heading often has a wider explanation underneath. At the first
  // line of copy, the stroke must already be beyond the printed words. Grow
  // its shoulder only as needed; any remaining clearance becomes a tangent
  // lead-in. As the anchor rotates both lengths change continuously from zero.
  if (placement !== 'down' && forward > 0 && lateral !== 0) {
    const crossings = [];
    for (const box of boxes) {
      if (box.u0 > 0 || box.u1 <= 0 || box.u1 >= forward) continue;
      const fraction = (lateral > 0 ? box.v0 : box.v1) / lateral;
      if (fraction <= 0 || fraction >= 1) continue;
      const t = parameterAt(fraction), r = 1 - t;
      const influence = 3 * t * r * (r + tail * t);
      const clearance = Math.min(forward, box.u1 + 1) - forward * fraction;
      if (clearance > handle * influence) crossings.push({ fraction, influence, clearance });
    }
    for (const { clearance, influence } of crossings) {
      handle = Math.max(handle, Math.min(140, .55 * span, clearance / influence));
    }
    // An outlet with a runway L advances by L(1−fraction) at this crossing.
    for (const { fraction, influence, clearance } of crossings) {
      runway = Math.max(runway, (clearance - handle * influence) / (1 - fraction));
    }
    if (runway < .001) runway = 0;
  }

  // If the point rotates behind the caption but clears its upper/lower edge,
  // let the shoulder travel just far enough out to round that corner. Bound
  // this adjustment; a destination directly behind text is better left quiet.
  for (const box of boxes) {
    if (box.u1 > 0 || box.v0 > 0 || box.v1 < 0 || forward >= box.u1 || lateral === 0) continue;
    const fraction = (lateral > 0 ? box.v1 : box.v0) / lateral;
    if (fraction >= 1) return null;
    if (fraction <= 0) continue;
    const t = parameterAt(fraction), r = 1 - t;
    const influence = 3 * t * r * (r + tail * t);
    const needed = (box.u1 - forward * fraction) / influence;
    if (needed > Math.min(140, .68 * span)) return null;
    if (needed > 0) handle = Math.max(handle, needed + .75);
  }

  if (boxes.length) {
    const peak = peakParameter(handle, forward - runway);
    for (const box of boxes) {
      if (runway > 0 && box.v0 < 0 && box.v1 > 0 && box.u1 > 0 && box.u0 < runway) return null;
      const shifted = runway ? { ...box, u0: box.u0 - runway, u1: box.u1 - runway } : box;
      if (entersBox(shifted, handle, forward - runway, lateral, peak)) return null;
    }
  }
  const rx = start.x + ux * runway, ry = start.y + uy * runway;
  const hx = rx + ux * handle, hy = ry + uy * handle;
  const tx = mix(end.x, hx, tail), ty = mix(end.y, hy, tail);
  const lead = runway ? ` L ${rx} ${ry}` : '';
  return `M ${start.x} ${start.y}${lead} C ${hx} ${hy}, ${tx} ${ty}, ${end.x} ${end.y}`;
}
