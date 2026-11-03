/** Pure assembly state. Geometry is always derived from the immutable source pose. */
export function buildHierarchy(metadata, policy = {}) {
  const nodes = new Map();
  const root = { ...policy.root, ...metadata.root, type: 'assembly', parent: null, children: [], meshNames: metadata.parts.map(p => p.meshName) };
  if (!root.id) throw new Error('A model package must provide its root identity.');
  nodes.set(root.id, root);
  const add = (node, parent) => { node.parent = parent.id; nodes.set(node.id, node); parent.children.push(node.id); return node; };
  for (const group of metadata.groups) {
    const g = add({ ...group, type: 'system', children: [] }, root);
    const subgroups = (group.children || []).filter(c => c.id !== group.id);
    for (const sub of subgroups) add({ ...sub, type: 'subassembly', description: sub.description || policy.subassemblyDescription || 'Explore the components in this source assembly.', children: [] }, g);
    // Larger, unlabelled source collections are organized by position, not invented BOM names.
    const split = policy.spatialGrouping;
    if (split && !subgroups.length && group.meshNames.length > split.minimumParts) {
      for (const [side, { id, title }] of [['upper', split.upper], ['lower', split.lower]]) {
        const parts = metadata.parts.filter(p => p.group === g.id && (side === 'upper' ? p.center[split.axis] >= split.splitAt : p.center[split.axis] < split.splitAt));
        if (parts.length) add({ id: `${g.id}-${id}`, title, description: split.description, type: 'subassembly', meshNames: parts.map(p => p.meshName), children: [] }, g);
      }
    }
    for (const part of metadata.parts.filter(p => p.group === g.id)) {
      const parent = g.children.map(id => nodes.get(id)).find(n => n.meshNames.includes(part.meshName)) || g;
      const index = parent.children.filter(id => nodes.get(id).type === 'component').length + 1;
      add({ ...part, title: part.title || `Part ${String(index).padStart(2, '0')} · ${part.sourceName || part.meshName}`, description: part.description || 'An individual source component. Its geometry and assembled position are retained; the finish is illustrative.', type: 'component', meshNames: [part.meshName], children: [] }, parent);
    }
  }
  return { root, nodes };
}

export function ancestors(nodes, id) {
  const path = [];
  while (id && nodes.has(id)) { const node = nodes.get(id); path.unshift(node); id = node.parent; }
  return path;
}

export function childForMesh(nodes, scopeId, meshName) {
  const scope = nodes.get(scopeId);
  return scope.children.map(id => nodes.get(id)).find(n => n.meshNames.includes(meshName)) || scope;
}

/** A root presentation may reveal groups in order. Exact reverse seeks retrace
 * the same function; no per-part clock or accumulated translation is involved. */
export function separationProgress(fraction, interval) {
  const value = Math.max(0, Math.min(1, fraction));
  // A full-range/default profile retains the pre-profile interpolation exactly.
  if (!interval || interval[0] === 0 && interval[1] === 1) return value;
  const local = Math.max(0, Math.min(1, (value - interval[0]) / (interval[1] - interval[0])));
  return local * local * (3 - 2 * local);
}

export function positionAt(base, offset, fraction, interval) {
  const t = separationProgress(fraction, interval);
  return base.map((n, i) => n + offset[i] * t);
}

/** Resolve once per scope change. A leaf overrides its nearest authored parent.
 * Inside an inspected branch, its own separation uses the full local range:
 * timing from siblings outside that branch must not create an unresponsive gap. */
export function createSeparationProfiles(parts, nodes, scopeId, policy = {}) {
  const profiles = policy.explosion?.separationProfiles;
  if (!profiles || nodes.get(scopeId)?.parent !== null) return new Map();
  return new Map(parts.flatMap(part => {
    const owner = ancestors(nodes, part.id).reverse().find(node => Object.hasOwn(profiles, node.id));
    return owner ? [[part.meshName, Object.freeze([...profiles[owner.id]])]] : [];
  }));
}

export function createOffsets(parts, nodes, scopeId, scale, policy = {}) {
  const scope = nodes.get(scopeId);
  const { rootVectors, radial, scopeFactors } = policy.explosion || {};
  const selected = parts.filter(p => scope.meshNames.includes(p.meshName));
  const center = selected.reduce((sum,p) => sum.map((v,i) => v + p.center[i] / selected.length), [0,0,0]);
  return new Map(parts.map((p, index) => {
    let offset;
    if (!scope.meshNames.includes(p.meshName)) return [p.meshName, [0,0,0]];
    if (!scope.parent && rootVectors?.[p.group]) {
      offset = [...rootVectors[p.group]];
      if (p.group === radial?.group) offset = offset.map((v, i) => v + (p.center[i] - radial.origin[i]) * scale * radial.factors[i]);
    } else if (scope.type === 'component') offset = [0,0,0];
    else if (!scope.parent && Array.isArray(p.explode)) offset = p.explode.map(v => v * scale);
    else {
      const relative = p.center.map((v,i) => (v - center[i]) * scale);
      offset = [relative[0] * .38, relative[1] * .38, relative[2] * .55 + (index % 5 - 2) * .065];
      if (scopeFactors?.[scopeId]) offset = offset.map((v, i) => v * scopeFactors[scopeId][i]);
    }
    return [p.meshName, offset];
  }));
}
