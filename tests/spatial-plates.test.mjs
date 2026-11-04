import test from 'node:test';
import assert from 'node:assert/strict';
import { BoxGeometry, TorusGeometry } from 'three';
import { renderSpatialPlate } from '../scripts/lib/spatial-plate-render.mjs';

const spec = {
  modelId: 'fixture',
  modelRevision: 'sha256:' + 'a'.repeat(64),
  sourceSha256: 'b'.repeat(64),
  chapterId: 'housing',
  elevation: 'z',
  section: { axis: 'z', fraction: 0.5 },
};
function box(width, height, thickness, cx, cy, cz) {
  const g = new BoxGeometry(width, height, thickness).translate(cx, cy, cz);
  return { positions: g.attributes.position.array, indices: g.index.array };
}
function group(svg, id) {
  return svg.match(new RegExp('<g id="' + id + '"[^>]*>(.*?)</g>'))?.[1];
}
function metadata(svg) {
  return JSON.parse(svg.match(/<metadata>(.*?)<\/metadata>/)[1]);
}

test('an entirely occluded component adds no lines to an elevation', () => {
  const front = box(2, 2, 0.25, 0, 0, 1);
  const hidden = box(0.7, 0.7, 0.25, -0.12, 0.19, -1);
  const exposed = box(0.85, 0.55, 0.25, 0, 0, 1.4);
  const render = (m) => renderSpatialPlate(m, { ...spec, view: 'elevation' });
  const original = render([front]),
    withHidden = render([front, hidden]),
    withExposed = render([front, exposed]);
  assert.equal(group(withHidden, 'profiles'), group(original, 'profiles'));
  assert.equal(group(withHidden, 'features'), group(original, 'features'));
  assert.notEqual(
    group(withExposed, 'features'),
    group(original, 'features'),
    'visible component boundaries survive'
  );
  assert.equal(render([front, hidden]), withHidden, 'repeatable SVG bytes');
});

test('section A–A slices a tapered mesh at the requested depth, not at its projected profile', () => {
  // Square pyramid with a full-width 2-unit base at z=0, 0-unit apex at z=1.
  const pyramid = {
    positions: [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0, 0, 0, 1],
    indices: [0, 1, 4, 1, 2, 4, 2, 3, 4, 3, 0, 4, 0, 3, 2, 0, 2, 1],
  };
  for (const [fraction, expectedSpan] of [
    [0.25, 126],
    [0.5, 84],
    [0.75, 42],
  ]) {
    const shared = { ...spec, section: { axis: 'z', fraction } };
    const svg = renderSpatialPlate([pyramid], { ...shared, view: 'section' });
    const plan = renderSpatialPlate([pyramid], { ...shared, view: 'plan' });
    assert.equal(metadata(svg).section.coordinate, fraction);
    assert.deepEqual(metadata(svg).section, metadata(plan).section);
    assert.ok(group(plan, 'cut-trace') && !group(svg, 'cut-trace'));
    const cut = group(svg, 'cut');
    assert.match(cut, /fill="url\(#section-hatch\)"/);
    const path = cut.match(/ d="([^"]+)"/)[1];
    assert.match(path, /Z$/);
    const pairs = [...path.matchAll(/[ML]([\d.-]+) ([\d.-]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
    for (const axis of [0, 1]) {
      const values = pairs.map((pair) => pair[axis]);
      assert.ok(Math.abs(Math.max(...values) - Math.min(...values) - expectedSpan) < 0.15);
    }
  }
});

test('a sliced open shell produces an open line, never a fictitious hatched solid', () => {
  const sheet = { positions: [-1, -1, -1, 1, -1, 1, 1, 1, 1], indices: null };
  const result = renderSpatialPlate([sheet], { ...spec, view: 'section' });
  assert.match(group(result, 'cut'), /<path fill="none" d="M[^"]*L/);
  assert.doesNotMatch(group(result, 'cut'), /section-hatch/);
});

test('a through-hole stays open inside the hatched area of a closed section', () => {
  const torus = new TorusGeometry(1, 0.25, 24, 60);
  const mesh = { positions: torus.attributes.position.array, indices: torus.index.array };
  const result = renderSpatialPlate([mesh], {
    ...spec,
    view: 'section',
    section: { axis: 'z', fraction: 0.53 },
  });
  const cut = group(result, 'cut');
  assert.match(cut, /fill-rule="evenodd"/);
  const paths = cut.match(/ d="([^"]+)"/)[1];
  assert.equal(paths.split('M').length - 1, 2, 'inner and outer cut boundaries');
  assert.equal(paths.split('Z').length - 1, 2);
});
