import { ancestors } from './model-state.js';

export function createNavigation(rootId) {
  return { scopeId: rootId, selectedId: rootId, expanded: new Set([rootId]), isolated: false };
}
export function selectNode(state, nodes, id) {
  if (!nodes.has(id)) return state;
  const path = ancestors(nodes, id).map(node => node.id);
  // Selection reveals its ancestry without closing branches the visitor opened.
  // Disclosure and the explicit Collapse action remain separate choices.
  const expanded = new Set([...state.expanded, ...path.slice(0, -1)]);
  return { ...state, selectedId: id, expanded };
}
export function enterScope(state, nodes, id) {
  if (!nodes.has(id)) return state;
  return { scopeId: id, selectedId: id, expanded: new Set(ancestors(nodes, id).map(node => node.id)), isolated: false };
}
export function toggleBranch(state, nodes, id) {
  if (!nodes.get(id)?.children.length) return state;
  const expanded = new Set(state.expanded);
  if (expanded.has(id)) expanded.delete(id); else expanded.add(id);
  return { ...state, expanded };
}

/** A contextual Demo exit is authored explicitly; a visible group alone does
 * not authorize changing the visitor's saved inspection workspace. */
export function resolveChapterInspectionTarget(nodes, guide, chapterId) {
  if (!nodes || !Array.isArray(guide?.chapters) || typeof chapterId !== 'string') return null;
  const chapter = guide.chapters.find(item => item?.id === chapterId);
  const nodeId = chapter?.inspectNodeId;
  if (typeof nodeId !== 'string' || !nodes.has(nodeId)) return null;
  return { chapterId, nodeId };
}

/** Close through the existing route owner before focusing the free scene. The
 * route owner retains the paused Demo checkpoint and ordinary Explore restore. */
export function createContextualInspectionHandoff({ resolveTarget, isDemoActive, closeDemo, focusTarget, isDisposed = () => false, onPending } = {}) {
  let pending = false, intent = 0;
  const notify = () => { if (!isDisposed()) onPending?.(pending); };
  return {
    get pending() { return pending; },
    cancel() { intent++; if (pending) { pending = false; notify(); } },
    async inspect() {
      if (pending || isDisposed() || !isDemoActive()) return false;
      const target = resolveTarget(); if (!target) return false;
      const request = ++intent;
      const owns = () => request === intent && !isDisposed() && !isDemoActive();
      pending = true; notify();
      try {
        await closeDemo();
        if (!owns()) return false;
        const result = await focusTarget(target, owns);
        return owns() && result !== false;
      } finally {
        if (request === intent) { pending = false; notify(); }
      }
    }
  };
}
