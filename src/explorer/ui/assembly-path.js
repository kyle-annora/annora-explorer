// Navigation reads the same authored hierarchy as the tree. Only an explicit
// click inspects a node, so selecting a part can reveal its path without moving the camera.
import { ancestors } from '../model-state.js';

export function createAssemblyPath({ document, overlays, signal, inspect, beforeOpen }) {
  const get = id => document.getElementById(id);
  const trail = get('breadcrumbs');
  const trigger = get('path-toggle');
  const panel = get('path-panel');
  let nodes, state, path;

  function label(tag, text, className) {
    const element = document.createElement(tag);
    element.textContent = text;
    if (className) element.className = className;
    return element;
  }

  function nodeButton(node, className) {
    const button = label('button', node.title, className);
    button.type = 'button';
    button.dataset.pathNode = node.id;
    button.setAttribute('aria-label', 'Inspect ' + node.title);
    return button;
  }

  function renderPanel() {
    const offPathView = get('path-viewing');
    offPathView.hidden = state.within;
    if (!state.within) {
      offPathView.textContent = 'Viewing · ' + state.scope.title;
      offPathView.dataset.pathNode = state.scope.id;
    }
    get('path-levels').replaceChildren(...path.map(node => {
      const row = document.createElement('li');
      const current = node.id === state.selected.id;
      const viewing = node.id === state.scope.id;
      const item = current && viewing ? label('span', node.title, 'path-node') : nodeButton(node, 'path-node');
      if (current) item.setAttribute('aria-current', 'location');
      row.append(item);
      if (current || viewing) row.append(label('small', viewing ? 'Viewing' : 'Selected', 'path-state'));
      return row;
    }));
    const children = state.selected.children;
    get('path-children').hidden = !children.length;
    get('path-children-title').textContent = 'Inside this assembly (' + children.length + ')';
    get('path-options').replaceChildren(...children.map(id => {
      const row = document.createElement('li');
      row.append(nodeButton(nodes.get(id)));
      return row;
    }));
  }

  function sync(nextNodes, nextState) {
    if (state?.selected.id === nextState.selected.id && state.scope.id === nextState.scope.id && nodes === nextNodes) return;
    if (!panel.hidden) overlays.close('path', panel.contains(document.activeElement));
    nodes = nextNodes;
    state = nextState;
    path = ancestors(nodes, state.selected.id);
    const crumbs = [];
    for (const node of path) {
      if (crumbs.length) {
        const divider = label('span', '/', 'separator');
        divider.setAttribute('aria-hidden', 'true');
        crumbs.push(divider);
      }
      const current = node.id === state.selected.id;
      const crumb = current ? label('span', node.title) : nodeButton(node);
      crumb.title = node.title;
      if (current) {
        crumb.setAttribute('aria-current', 'location');
        if (node.id !== state.scope.id) crumb.append(label('small', 'Selected', 'path-state'));
      }
      crumbs.push(crumb);
    }
    trail.replaceChildren(...crumbs);
    trail.scrollLeft = trail.scrollWidth;
    trigger.disabled = false;
  }

  trigger.closest('.scope-context').addEventListener('click', event => {
    const button = event.target.closest('button[data-path-node]');
    if (!button) return;
    if (panel.contains(button)) overlays.close('path', true);
    inspect(button.dataset.pathNode);
  }, { signal });

  overlays.register('path', {
    panel, trigger, closeButton: get('path-close'), initialFocus: () => get('path-close'),
    beforeToggle: opening => { if (opening) beforeOpen(); },
    onOpen: renderPanel,
  });
  return { sync };
}
