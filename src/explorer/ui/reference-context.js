/** Whether a validated spatial guide opts into the shared reference workspace.
 * Hosts still apply their existing top-level/embed and asset-availability guards.
 */
export function canUseReferenceWorkspace(guide) {
  return guide?.referenceWorkspace === true;
}

/** Resolve a selected/focused node to an authored reference chapter.
 *
 * guide: the current model revision's validated spatial-guide object.
 * hierarchy: buildHierarchy()'s { root, nodes: Map<nodeId, node> } result.
 * nodeId: the selected node, or the current scope when nothing is selected.
 * Returns the original chapter descriptor, or null if no overview is authored.
 *
 * A named inspection target wins through real parent ancestry. Otherwise every
 * mesh of the selected node must belong to a chapter's authored groups. A name,
 * sibling, partial overlap or a similar leg never invents a reference mapping.
 */
export function referenceChapterForNode(guide, hierarchy, nodeId) {
  const chapters = Array.isArray(guide?.chapters) ? guide.chapters : [];
  const overview = chapters.find(chapter => chapter.id === 'overview') || null;
  const nodes = hierarchy?.nodes;
  if (!nodes?.get || !nodes.has(nodeId)) return overview;
  const node = nodes.get(nodeId);
  if (node.id === hierarchy.root?.id) return overview;
  const lineage = new Map(); let ancestor = node;
  while (ancestor && !lineage.has(ancestor.id)) {
    lineage.set(ancestor.id, lineage.size);
    ancestor = nodes.get(ancestor.parent);
  }
  const detail = chapters.filter(chapter => chapter.id !== 'overview');
  const explicit = detail.filter(chapter => typeof chapter.inspectNodeId === 'string' && lineage.has(chapter.inspectNodeId));
  if (explicit.length) {
    explicit.sort((a, b) => lineage.get(a.inspectNodeId) - lineage.get(b.inspectNodeId));
    return explicit[0];
  }
  if (!Array.isArray(node.meshNames) || !node.meshNames.length) return overview;
  const covering = [];
  for (const chapter of detail) {
    if (!Array.isArray(chapter.groups) || !chapter.groups.length) continue;
    const meshNames = new Set(chapter.groups.flatMap(id => nodes.get(id)?.meshNames || []));
    if (node.meshNames.every(name => meshNames.has(name))) covering.push({ chapter, size:meshNames.size });
  }
  // Prefer the most specific authored coverage. Equal coverage retains the
  // package's chapter order, so the product author chooses the default story.
  covering.sort((a, b) => a.size - b.size);
  return covering[0]?.chapter || overview;
}
