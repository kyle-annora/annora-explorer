import test from 'node:test';
import assert from 'node:assert/strict';
import { calloutCurve } from '../../src/explorer/orbital/callout-curve.js';

// Read the emitted SVG path as a browser would: one move followed by a cubic.
function controlPoints(path) {
  assert.match(path, /^M [^A-Z]* C [^A-Z]*$/);
  const values = path.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi).map(Number);
  assert.equal(values.length, 8);
  assert.ok(values.every(Number.isFinite));
  return [0, 2, 4, 6].map(i => ({ x: values[i], y: values[i + 1] }));
}

function at(points, t) {
  const [a, b, c, d] = points, s = 1 - t;
  const axis = k => s ** 3 * a[k] + 3 * s * s * t * b[k] + 3 * s * t * t * c[k] + t ** 3 * d[k];
  return { x: axis('x'), y: axis('y') };
}

test('uses the requested outlet, finishes on the exact projection with no extra terminal segment', () => {
  const start = { x: 36.25, y: 42.625 }, end = { x: 341.125, y: 180.875 };
  for (const [direction, dx, dy] of [['right', 1, 0], ['left', -1, 0], ['down', 0, 1]]) {
    const points = controlPoints(calloutCurve(start, end, direction));
    const [a, b, c, d] = points;
    assert.deepEqual(a, start); assert.deepEqual(d, end);
    assert.equal(Math.sign(b.x - a.x), dx);
    assert.equal(Math.sign(b.y - a.y), dy);
    // The final tangent meets the end of a straightening curve.
    assert.ok(Math.abs((c.x - b.x) * (d.y - c.y) - (c.y - b.y) * (d.x - c.x)) < 1e-8);
  }
});

test('straight, short and long strokes retain a bounded shoulder', () => {
  const start = { x: 10, y: 30 };
  assert.equal(calloutCurve(start, { x: 13, y: 31 }), null);
  for (const span of [9, 90, 2400]) {
    const points = controlPoints(calloutCurve(start, { x: start.x + span, y: start.y }));
    assert.ok(points[1].x - start.x <= 108);
    let previous = start.x;
    for (let i = 1; i <= 40; i++) {
      const p = at(points, i / 40);
      assert.ok(p.x >= previous); assert.ok(Math.abs(p.y - start.y) < 1e-12);
      previous = p.x;
    }
  }
});

test('a reversed but clear target rounds the caption corner without entering it or forming a loop', () => {
  const start = { x: 130, y: 20 }, end = { x: -20, y: 160 };
  const caption = { left: 0, top: 0, right: 125, bottom: 80 };
  const points = controlPoints(calloutCurve(start, end, 'right', caption));
  let previous = start.y;
  for (let i = 1; i <= 1000; i++) {
    const p = at(points, i / 1000);
    assert.ok(p.y > previous);
    assert.ok(p.x >= caption.right || p.y >= caption.bottom);
    previous = p.y;
  }
  assert.equal(calloutCurve(start, { x: 105, y: 39 }, 'right', caption), null);
  assert.equal(calloutCurve(start, { x: 0, y: 20 }), null);
  assert.equal(calloutCurve(start, { x: 50, y: 95 }, 'right', caption), null);
});

test('a bottom outlet can touch its own label; a detached thin obstruction cannot be crossed', () => {
  const start = { x: 68, y: 76 }, end = { x: 68, y: 190 };
  const caption = { x: 6, y: 15, width: 188, height: 61 };
  const points = controlPoints(calloutCurve(start, end, 'down', caption));
  assert.ok(points.every(p => p.x === 68 && p.y >= 76));
  const obstruction = { left: 67.5, right: 68.5, top: 122.435, bottom: 122.452 };
  assert.equal(calloutCurve(start, end, 'down', [caption, obstruction]), null);
});

test('a moving anchor does not flip routes as it crosses the outlet axis', () => {
  const start = { x: 100, y: 30 }, caption = { left: 0, top: 0, right: 92, bottom: 60 };
  let previous = null;
  for (let i = -30; i <= 30; i++) {
    const end = { x: start.x + i / 10, y: 180 };
    const points = controlPoints(calloutCurve(start, end, 'right', caption));
    if (previous) for (let k = 0; k < points.length; k++) {
      assert.ok(Math.hypot(points[k].x - previous[k].x, points[k].y - previous[k].y) < .15);
    }
    previous = points;
  }
  assert.equal(calloutCurve(start, { x: NaN, y: 80 }), null);
});

function readSegments(path) {
  assert.ok(path);
  const values = path.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi).map(Number);
  const points = [];
  for (let i = 0; i < values.length; i += 2) points.push({ x: values[i], y: values[i + 1] });
  if (points.length === 4) points.splice(1, 0, points[0]);
  return points;
}

// Actual 1440 × 900 'Lower leg' layout. The first line of the explanation
// extends well beyond the heading, but the mesh is well outside the caption.
const wideOutlet = { x: 148.828125, y: 95.5859375 };
const wrappedCopy = [
  { left: 52.71875, right: 141.828125, top: 82.3125, bottom: 108.859375 },
  { left: 52.71875, right: 269.90625, top: 111.859375, bottom: 132.859375 },
  { left: 52.71875, right: 116.546875, top: 132.859375, bottom: 153.859375 },
];

test('a projected point ahead of wrapped copy draws with a tangent lead-in and no text crossing', () => {
  const target = { x: 1067, y: 473.25 };
  const segments = readSegments(calloutCurve(wideOutlet, target, 'right', wrappedCopy));
  const [start, join, first, , end] = segments;
  assert.deepEqual(start, wideOutlet);
  assert.deepEqual(end, target);
  assert.ok(join.x > start.x && join.x < wrappedCopy[1].right);
  assert.ok(first.x > join.x);
  assert.equal(start.y, join.y);
  assert.equal(join.y, first.y);
  for (let i = 0; i <= 1000; i++) {
    const points = [
      { x: start.x + i / 1000 * (join.x - start.x), y: join.y },
      at(segments.slice(1), i / 1000),
    ];
    for (const p of points) for (const b of wrappedCopy) {
      assert.ok(p.x <= b.left || p.x >= b.right || p.y <= b.top || p.y >= b.bottom);
    }
  }
});

test('the lead-in grows continuously under rotation and a blocked runway stays hidden', () => {
  let previous = null, extended = false;
  for (let y = 216; y <= 631; y++) {
    const points = readSegments(calloutCurve(wideOutlet, { x: 1067, y }, 'right', wrappedCopy));
    if (previous) for (let i = 1; i <= 3; i++) {
      assert.ok(Math.hypot(points[i].x - previous[i].x, points[i].y - previous[i].y) < 2);
    }
    extended ||= points[1].x > wideOutlet.x + 20;
    previous = points;
  }
  assert.ok(extended);
  const blocked = [...wrappedCopy, { left: 161, right: 170, top: 92, bottom: 101 }];
  assert.equal(calloutCurve(wideOutlet, { x: 1067, y: 473.25 }, 'right', blocked), null);
});

test('compact pointers keep their exact anchor and a fixed length on wide and narrow stages', () => {
  for (const limit of [42, 72]) for (const target of [
    { x: 270, y: 180 }, { x: 1067, y: 473.25 }, { x: 2810, y: 615 },
  ]) {
    const points = controlPoints(calloutCurve(wideOutlet, target, 'right', wrappedCopy, limit));
    assert.deepEqual(points[3], target);
    const bound = points.slice(1).reduce((sum, p, i) =>
      sum + Math.hypot(p.x - points[i].x, p.y - points[i].y), 0);
    assert.ok(bound <= limit + 1e-8);
    assert.ok(bound >= limit - .2);
    const full = readSegments(calloutCurve(wideOutlet, target, 'right', wrappedCopy));
    const tangent = full[full.length - 2];
    const cross = (target.x - tangent.x) * (target.y - points[2].y) -
      (target.y - tangent.y) * (target.x - points[2].x);
    assert.ok(Math.abs(cross) < 1e-7);
  }
  assert.equal(calloutCurve(wideOutlet, { x: NaN, y: 70 }, 'right', wrappedCopy, 72), null);
  assert.equal(calloutCurve(wideOutlet, { x: 900, y: 70 }, 'right', wrappedCopy, -1), null);
});

test('a compact pointer moves continuously during a small camera rotation', () => {
  let previous;
  for (let y = 216; y <= 631; y++) {
    const points = controlPoints(calloutCurve(wideOutlet, { x: 1067, y }, 'right', wrappedCopy, 72));
    if (previous) for (let i = 0; i < 4; i++) {
      assert.ok(Math.hypot(points[i].x - previous[i].x, points[i].y - previous[i].y) < 1.2);
    }
    previous = points;
  }
});
