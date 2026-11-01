import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildHierarchy } from '../../src/explorer/model-state.js';
import { createNavigation, selectNode } from '../../src/explorer/navigation-state.js';
import { createAssemblySearch, inspectionState, inspectionFacts } from '../../src/explorer/inspection-ui.js';

for (const id of ['kinetic-01', 'apollo', 'bench-vise']) {
  const read = name => JSON.parse(readFileSync(new URL(`../../content/models/${id}/${name}.json`, import.meta.url)));
  const manifest = read('manifest'), metadata = read('metadata');
  const {root,nodes} = buildHierarchy(metadata,manifest.presentationPolicy);
  const group = nodes.get(root.children[0]), other = nodes.get(root.children[1]);
  test(`${id}: selection stays distinct from viewing scope, including outside-branch selection`, () => {
    const initial=createNavigation(root.id), chosen=selectNode(initial,nodes,group.id);
    assert.equal(chosen.scopeId,root.id);
    const state=inspectionState(nodes,chosen.selectedId,chosen.scopeId);
    assert.equal(state.canInspect,true);assert.equal(state.action,'Inspect assembly');
    assert.equal(state.parent.id,root.id);assert.equal(state.within,true);
    const entered=inspectionState(nodes,group.id,group.id);
    assert.equal(entered.action,'Fit in view');assert.equal(entered.scopeParent.id,root.id);
    if(other){const outside=inspectionState(nodes,other.id,group.id);assert.equal(outside.within,false);assert.equal(outside.canInspect,true);assert.match(outside.context,/Outside/);}
    const part=[...nodes.values()].find(node=>node.type==='component'&&node.group===group.id);
    const leaf=inspectionState(nodes,part.id,group.id);assert.equal(leaf.kind,'Part');assert.equal(leaf.canInspect,false);
  });
  test(`${id}: customer facts never turn mesh counts or hierarchy depth into product claims`, () => {
    const model={rootId:root.id,facts:manifest.view.facts};
    assert.deepEqual(inspectionFacts(inspectionState(nodes,root.id,root.id),model),(model.facts||[]).map(f=>[f.label,f.value]));
    assert.deepEqual(inspectionFacts(inspectionState(nodes,group.id,root.id),model),[['Part of',root.title]]);
  });
  test(`${id}: search includes ancestor paths, has bounded results and does not mutate navigation`, () => {
    const search=createAssemblySearch(nodes), state=createNavigation(root.id), before=[...state.expanded];
    assert.equal(search('   '),null);
    const result=search(group.title);
    assert.ok(result.matches.has(group.id));assert.ok(result.visible.has(root.id));assert.ok(result.expanded.has(root.id));
    assert.equal(search('no-such-part-8de145').total,0);
    const bounded=search('a',2);assert.ok(bounded.shown<=2);assert.ok(bounded.total>=bounded.shown);
    assert.deepEqual([...state.expanded],before);assert.equal(state.selectedId,root.id);assert.equal(state.scopeId,root.id);
    const bySource=[...nodes.values()].find(node=>node.sourceName);
    if(bySource)assert.ok(search(bySource.sourceName,1000).matches.has(bySource.id));
  });
}
