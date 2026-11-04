// Orthographic engineering illustrations from a rigid triangle mesh. A fine
// software depth buffer removes hidden surfaces before any lines are traced.
// The final SVG contains paths only; the reader never runs this renderer.
const W = 320,
  H = 200,
  samples = 3;
const rw = W * samples,
  rh = H * samples;
const basis = {
  y: { right: [0, 1], up: [2, -1], depth: 1 }, // plan; -Z is at the top
  z: { right: [0, 1], up: [1, 1], depth: 2 },
  x: { right: [2, -1], up: [1, 1], depth: 0 },
};
const axes = ['x', 'y', 'z'];
const number = (n) => String(Math.round(n * 10) / 10);
const xml = (s) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

function visitTriangles(mesh, visit) {
  const indices = mesh.indices,
    count = indices ? indices.length : mesh.positions.length / 3;
  for (let i = 0; i < count; i += 3)
    visit(
      (indices ? indices[i] : i) * 3,
      (indices ? indices[i + 1] : i + 1) * 3,
      (indices ? indices[i + 2] : i + 2) * 3
    );
}

function fit(meshes, axis) {
  const {
    right: [u, us],
    up: [v, vs],
    depth,
  } = basis[axis];
  let left = Infinity,
    right = -Infinity,
    top = -Infinity,
    bottom = Infinity;
  let near = -Infinity,
    far = Infinity;
  for (const { positions: p } of meshes)
    for (let i = 0; i < p.length; i += 3) {
      const x = p[i + u] * us,
        y = p[i + v] * vs,
        z = p[i + depth];
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.max(top, y);
      bottom = Math.min(bottom, y);
      near = Math.max(near, z);
      far = Math.min(far, z);
    }
  const scale = Math.min((W - 44) / Math.max(right - left, 1e-10), (H - 32) / Math.max(top - bottom, 1e-10));
  return {
    u,
    us,
    v,
    vs,
    depth,
    scale,
    far,
    near,
    projectX: (x) => W / 2 + (x * us - (left + right) / 2) * scale,
    projectY: (y) => H / 2 - (y * vs - (top + bottom) / 2) * scale,
  };
}

// Draw each surface once into the common orthographic depth attachment.
// For a section, removing fragments in front of the plane is the exact
// half-space clipping test because depth interpolates linearly in this view.
function depthImage(meshes, frame, plane) {
  const size = rw * rh,
    depths = new Float32Array(size).fill(-Infinity);
  const ids = new Uint16Array(size),
    normals = new Int32Array(size),
    faceNormals = [];
  const { u, v, depth, scale, projectX, projectY } = frame;
  for (const [part, mesh] of meshes.entries()) {
    const p = mesh.positions,
      projected = new Float64Array(p.length);
    for (let i = 0; i < p.length; i += 3) {
      projected[i] = projectX(p[i + u]) * samples;
      projected[i + 1] = projectY(p[i + v]) * samples;
      projected[i + 2] = (p[i + depth] - frame.far) * scale * samples;
    }
    const cut = plane === null ? Infinity : (plane - frame.far) * scale * samples;
    visitTriangles(mesh, (a, b, c) => {
      const ax = projected[a],
        ay = projected[a + 1],
        az = projected[a + 2];
      const dx1 = projected[b] - ax,
        dy1 = projected[b + 1] - ay,
        dz1 = projected[b + 2] - az;
      const dx2 = projected[c] - ax,
        dy2 = projected[c + 1] - ay,
        dz2 = projected[c + 2] - az;
      const area = dx1 * dy2 - dx2 * dy1;
      if (Math.abs(area) < 1e-8 || Math.min(az, az + dz1, az + dz2) > cut) return;
      const x0 = Math.max(0, Math.ceil(Math.min(ax, ax + dx1, ax + dx2) - 0.5));
      const x1 = Math.min(rw - 1, Math.floor(Math.max(ax, ax + dx1, ax + dx2) - 0.5));
      const y0 = Math.max(0, Math.ceil(Math.min(ay, ay + dy1, ay + dy2) - 0.5));
      const y1 = Math.min(rh - 1, Math.floor(Math.max(ay, ay + dy1, ay + dy2) - 0.5));
      if (x0 > x1 || y0 > y1) return;
      const nx = dy1 * dz2 - dz1 * dy2,
        ny = dz1 * dx2 - dx1 * dz2,
        mag = Math.hypot(nx, ny, area);
      const face = faceNormals.length;
      faceNormals.push(nx / mag, ny / mag, area / mag);
      const inv = 1 / area;
      for (let y = y0; y <= y1; y++) {
        let w1 = ((x0 + 0.5 - ax) * dy2 - (y + 0.5 - ay) * dx2) * inv;
        let w2 = ((y + 0.5 - ay) * dx1 - (x0 + 0.5 - ax) * dy1) * inv;
        for (let x = x0; x <= x1; x++, w1 += dy2 * inv, w2 -= dy1 * inv) {
          if (w1 < 0 || w2 < 0 || w1 + w2 > 1) continue;
          const z = az + w1 * dz1 + w2 * dz2,
            pixel = y * rw + x;
          if (z > cut || z <= depths[pixel]) continue;
          depths[pixel] = z;
          ids[pixel] = part + 1;
          normals[pixel] = face;
        }
      }
    });
  }
  return { depths, ids, normals, faceNormals };
}

function simplify(path, tolerance) {
  if (path.length < 3) return path;
  const result = [path[0]],
    threshold = tolerance * tolerance;
  function retain(first, last) {
    const [ax, ay] = path[first],
      [bx, by] = path[last],
      dx = bx - ax,
      dy = by - ay,
      len = dx * dx + dy * dy;
    let high = threshold,
      split = -1;
    for (let i = first + 1; i < last; i++) {
      const [x, y] = path[i],
        t = len ? Math.min(1, Math.max(0, ((x - ax) * dx + (y - ay) * dy) / len)) : 0;
      const d = (x - ax - t * dx) ** 2 + (y - ay - t * dy) ** 2;
      if (d > high) {
        high = d;
        split = i;
      }
    }
    if (split !== -1) {
      retain(first, split);
      retain(split, last);
    } else result.push(path[last]);
  }
  retain(0, path.length - 1);
  return result;
}

// Trace undirected paths between junctions. Closed loops stay closed for the
// even-odd fill of a section. An open source contour is drawn without a hatch.
function lineGraph() {
  const nodes = new Map();
  function vertex(key, x, y) {
    let node = nodes.get(key);
    if (!node) {
      node = { point: [x, y], next: new Set() };
      nodes.set(key, node);
    }
    return node;
  }
  return {
    connect(a, ax, ay, b, bx, by) {
      if (a === b) return;
      const va = vertex(a, ax, ay),
        vb = vertex(b, bx, by);
      va.next.add(vb);
      vb.next.add(va);
    },
    paths(tolerance, minLength) {
      const out = [],
        junctions = new Set([...nodes.values()].filter((n) => n.next.size !== 2));
      function follow(start) {
        while (start.next.size) {
          let now = start,
            length = 0;
          const chain = [start.point];
          do {
            const other = now.next.values().next().value;
            now.next.delete(other);
            other.next.delete(now);
            length += Math.hypot(now.point[0] - other.point[0], now.point[1] - other.point[1]);
            chain.push(other.point);
            now = other;
          } while (now !== start && !junctions.has(now) && now.next.size);
          if (length < minLength) continue;
          const closed = now === start;
          const pts = simplify(chain, tolerance);
          if (closed && pts.length < 4) continue;
          const d =
            'M' +
            (closed ? pts.slice(0, -1) : pts).map(([x, y]) => number(x) + ' ' + number(y)).join('L') +
            (closed ? 'Z' : '');
          out.push({ d, closed });
        }
      }
      for (const n of junctions) follow(n);
      for (const n of nodes.values()) follow(n);
      return out;
    },
  };
}

function traceImage(image) {
  const { ids, depths, normals, faceNormals: n } = image;
  const outline = lineGraph(),
    seams = lineGraph(),
    creases = lineGraph();
  const stride = rw + 1;
  function inspect(a, b, x, y, dx, dy) {
    const id = ids[a],
      other = ids[b];
    if (!id && !other) return;
    let lines;
    if (!id || !other) lines = outline;
    else if (id !== other) lines = seams;
    else {
      const i = normals[a],
        j = normals[b];
      if (i === j) return;
      const dot = Math.abs(n[i] * n[j] + n[i + 1] * n[j + 1] + n[i + 2] * n[j + 2]);
      // A steep continuous face also changes depth quickly. Subtract each
      // face's expected slope before calling an internal edge a depth jump.
      const dz = depths[b] - depths[a],
        k = dy ? 0 : 1;
      const discontinuous =
        Math.abs(dz * n[i + 2] + n[i + k]) > 1.8 && Math.abs(dz * n[j + 2] + n[j + k]) > 1.8;
      if (dot > 0.66 && !discontinuous) return;
      lines = creases;
    }
    const key = y * stride + x,
      otherKey = (y + dy) * stride + x + dx;
    lines.connect(key, x / samples, y / samples, otherKey, (x + dx) / samples, (y + dy) / samples);
  }
  for (let y = 1; y < rh - 1; y++)
    for (let x = 1; x < rw - 1; x++) {
      const k = y * rw + x;
      if (!ids[k] && !ids[k + 1] && !ids[k + rw]) continue;
      inspect(k, k + 1, x + 1, y, 0, 1);
      inspect(k, k + rw, x, y + 1, 1, 0);
    }
  return {
    profile: outline
      .paths(0.3, 2.4)
      .map((p) => p.d)
      .join(''),
    boundary: seams
      .paths(0.36, 4.6)
      .map((p) => p.d)
      .join(''),
    detail: creases
      .paths(0.4, 6.8)
      .map((p) => p.d)
      .join(''),
  };
}

// Intersect actual model-space triangle edges with the plane. This is not a
// projected silhouette or a crop. Independent solids retain independent fills.
function cutPaths(mesh, frame, plane) {
  const { u, v, depth, projectX, projectY } = frame,
    p = mesh.positions,
    graph = lineGraph();
  visitTriangles(mesh, (a, b, c) => {
    const z0 = p[a + depth] - plane,
      z1 = p[b + depth] - plane,
      z2 = p[c + depth] - plane;
    if (Math.min(z0, z1, z2) >= 0 || Math.max(z0, z1, z2) < 0) return;
    const hit = [];
    for (const [i, j, zi, zj] of [
      [a, b, z0, z1],
      [b, c, z1, z2],
      [c, a, z2, z0],
    ]) {
      if (zi < 0 === zj < 0) continue;
      const t = zi / (zi - zj);
      hit.push([
        projectX(p[i + u] + t * (p[j + u] - p[i + u])),
        projectY(p[i + v] + t * (p[j + v] - p[i + v])),
      ]);
    }
    if (hit.length !== 2) return;
    const [[x, y], [x2, y2]] = hit;
    const key = (a, b) => Math.round(a * 1e4) + ',' + Math.round(b * 1e4);
    graph.connect(key(x, y), x, y, key(x2, y2), x2, y2);
  });
  return graph.paths(0.12, 0.8);
}

function cutTrace(frame, axis, plane, meshes) {
  const axisIndex = axes.indexOf(axis);
  if (axisIndex === frame.depth) return '';
  const vertical = axisIndex === frame.u;
  const fixed = vertical ? frame.projectX(plane) : frame.projectY(plane);
  let low = Infinity,
    high = -Infinity;
  for (const { positions: p } of meshes)
    for (let i = 0; i < p.length; i += 3) {
      const value = vertical ? frame.projectY(p[i + frame.v]) : frame.projectX(p[i + frame.u]);
      low = Math.min(low, value);
      high = Math.max(high, value);
    }
  const at = (q, s = 0) => (vertical ? [fixed + s, q] : [q, fixed + s]);
  const coord = ([x, y]) => number(x) + ' ' + number(y);
  // Arrows point toward the retained half of the model. Both marks refer to A–A.
  const sign = vertical ? -frame.us : frame.vs;
  const ends = [low - 5, high + 5];
  const line = 'M' + coord(at(ends[0])) + 'L' + coord(at(ends[1]));
  let arrows = '',
    labels = '';
  for (const q of ends) {
    arrows += 'M' + coord(at(q, -6 * sign)) + 'L' + coord(at(q, 1 * sign));
    const tip = at(q, sign),
      l = at(q - 1.4, -2 * sign),
      r = at(q + 1.4, -2 * sign);
    arrows += 'M' + coord(l) + 'L' + coord(tip) + 'L' + coord(r);
    const [x, y] = at(q, -10 * sign);
    labels += '<text x="' + number(x) + '" y="' + number(y) + '">A</text>';
  }
  return (
    `<g id="cut-trace" fill="none" stroke="#858781" stroke-width=".8"><path stroke-dasharray="8 2 1 2" d="${line}"/><path d="${arrows}"/></g>
` +
    `<g fill="#62635f" font-family="monospace" font-size="9.5" text-anchor="middle" dominant-baseline="central">${labels}</g>
`
  );
}

export function renderSpatialPlate(meshes, spec) {
  if (!meshes.length) throw new Error('A plate requires a nonempty assembly scope.');
  const axis = spec.view === 'plan' ? 'y' : spec.view === 'elevation' ? spec.elevation : spec.section.axis;
  if (!basis[axis]) throw new Error('Unknown projection axis: ' + axis);
  const frame = fit(meshes, axis),
    cutFrame = fit(meshes, spec.section.axis);
  const plane = cutFrame.far + (cutFrame.near - cutFrame.far) * spec.section.fraction;
  const section = spec.view === 'section';
  const lines = traceImage(depthImage(meshes, frame, section ? plane : null));
  const cut = [];
  if (section)
    for (const mesh of meshes) {
      const paths = cutPaths(mesh, frame, plane);
      const closed = paths
        .filter((p) => p.closed)
        .map((p) => p.d)
        .join('');
      const open = paths
        .filter((p) => !p.closed)
        .map((p) => p.d)
        .join('');
      if (closed) cut.push('<path fill="url(#section-hatch)" fill-rule="evenodd" d="' + closed + '"/>');
      if (open) cut.push('<path fill="none" d="' + open + '"/>');
    }
  const metadata = {
    modelId: spec.modelId,
    modelRevision: spec.modelRevision,
    sourceSha256: spec.sourceSha256,
    chapterId: spec.chapterId,
    view: spec.view,
    pose: 'rest',
    meshCount: meshes.length,
    projection: 'orthographic',
    projectionFrom: '+' + axis.toUpperCase(),
    elevationFrom: '+' + spec.elevation.toUpperCase(),
    section: {
      id: 'A-A',
      axis: spec.section.axis,
      coordinate: plane,
      fraction: spec.section.fraction,
      retained: 'less-than-or-equal',
    },
  };
  const hatch =
    '<defs><pattern id="section-hatch" patternUnits="userSpaceOnUse" width="5" height="5"><rect width="5" height="5" fill="#e4e5e0"/><path d="M-1 1L1 -1M0 5L5 0M4 6L6 4" fill="none" stroke="#a6a7a1" stroke-width=".7"/></pattern></defs>';
  const title = xml(spec.chapterId + ' / ' + spec.view);
  return (
    [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200" role="img">',
      `<title>${title}</title>`,
      '<desc>Reference projection of the prepared assembly at rest. Section A–A intersects the original mesh. No manufacturing dimensions are inferred.</desc>',
      `<metadata>${xml(JSON.stringify(metadata))}</metadata>`,
      section && hatch,
      '<g fill="none" stroke-linejoin="round" stroke-linecap="round">',
      `<g id="features" stroke="${section ? '#9a9e98' : '#767874'}"><path stroke-width=".8" d="${lines.detail}"/><path stroke-width="1.15" d="${lines.boundary}"/></g>`,
      `<g id="profiles" stroke="${section ? '#7c837b' : '#3e403e'}" stroke-width="1.65"><path d="${lines.profile}"/></g>`,
      `<g id="cut" stroke="#393c39" stroke-width="1.55">${cut.join('')}</g>`,
      '</g>',
      spec.view === 'plan' && cutTrace(frame, spec.section.axis, plane, meshes).trimEnd(),
      '</svg>',
    ]
      .filter(Boolean)
      .join('\n') + '\n'
  );
}
