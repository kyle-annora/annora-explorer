import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildHierarchy } from '../../src/explorer/model-state.js';
import { canUseReferenceWorkspace, referenceChapterForNode } from '../../src/explorer/ui/reference-context.js';

const json = async relative => JSON.parse(await readFile(new URL(relative, import.meta.url), 'utf8'));
const guide = await json('../../content/models/hexapod/spatial-guide.json');
const metadata = await json('../../content/models/hexapod/metadata.json');
const hierarchy = buildHierarchy(metadata);
const overview = guide.chapters.find(c => c.id === 'overview'), leg = guide.chapters.find(c => c.id === 'leg'), electronics = guide.chapters.find(c => c.id === 'electronics');

test('the reference workspace is explicit opt-in and remains unavailable to other existing guides', async () => {
  assert.equal(canUseReferenceWorkspace(guide), true);
  const duck = await json('../../content/models/open-duck/spatial-guide.json');
  for (const candidate of [duck, undefined, null, {}, { referenceWorkspace:false }, { referenceWorkspace:'true' }, { referenceWorkspace:1 }]) assert.equal(canUseReferenceWorkspace(candidate), false);
});

test('the authored front-right-leg assembly, its subassemblies and physical parts resolve to the same leg chapter', () => {
  assert.equal(referenceChapterForNode(guide, hierarchy, 'hex-leg-1'), leg);
  for (const node of hierarchy.nodes.values()) {
    if (node.id === 'hex-leg-1' || node.parent === 'hex-leg-1' || hierarchy.nodes.get(node.parent)?.parent === 'hex-leg-1') {
      assert.equal(referenceChapterForNode(guide, hierarchy, node.id), leg, node.id);
    }
  }
  assert.equal(referenceChapterForNode(guide, hierarchy, 'hex-leg-1-femur'), leg);
});

test('body groups and their descendants map by full mesh membership when no inspection target is authored', () => {
  const source = structuredClone(guide); delete source.chapters.find(c => c.id === 'electronics').inspectNodeId;
  const chapter = source.chapters.find(c => c.id === 'electronics');
  for (const node of hierarchy.nodes.values()) {
    if (node.id === 'hex-body' || node.parent === 'hex-body' || hierarchy.nodes.get(node.parent)?.parent === 'hex-body') {
      assert.equal(referenceChapterForNode(source, hierarchy, node.id), chapter, node.id);
    }
  }
  assert.equal(referenceChapterForNode(guide, hierarchy, 'hex-body'), electronics);
});

test('the five other legs never borrow the front-right-leg drawing or a semantically similar chapter', () => {
  const unrelated = [...hierarchy.nodes.values()].filter(node => {
    let current = node;
    while (current) { if (/^hex-leg-[2-6]$/.test(current.id)) return true; current = hierarchy.nodes.get(current.parent); }
    return false;
  });
  assert.ok(unrelated.length > 50);
  for (const node of unrelated) assert.equal(referenceChapterForNode(guide, hierarchy, node.id), overview, node.id);
  assert.equal(referenceChapterForNode(guide, hierarchy, 'hex-leg-1-copy'), overview, 'a matching name prefix is not an identity');
});

test('root, unknown selection and unavailable hierarchy use the authored overview rather than an arbitrary detail', () => {
  for (const id of [hierarchy.root.id, undefined, null, '', 'missing']) assert.equal(referenceChapterForNode(guide, hierarchy, id), overview);
  assert.equal(referenceChapterForNode(guide, null, 'hex-leg-1'), overview);
  assert.equal(referenceChapterForNode(null, hierarchy, 'hex-leg-1'), null);
  assert.equal(referenceChapterForNode({ chapters:[] }, hierarchy, 'hex-leg-1'), null);
});

test('nearest explicit ancestry wins; partial overlap and mixed selections do not fabricate mappings', () => {
  const nodes = new Map([
    ['root', { id:'root', parent:null, meshNames:['a','b','c'] }],
    ['arm', { id:'arm', parent:'root', meshNames:['a','b'] }],
    ['joint', { id:'joint', parent:'arm', meshNames:['a'] }],
    ['part', { id:'part', parent:'joint', meshNames:['a'] }],
    ['mixed', { id:'mixed', parent:'root', meshNames:['a','c'] }]
  ]);
  const whole = { id:'overview' }, broad = { id:'arm-story', inspectNodeId:'arm', groups:['arm'] }, narrow = { id:'joint-story', inspectNodeId:'joint', groups:['joint'] };
  const source = { chapters:[whole,broad,narrow] }, h = { root:nodes.get('root'), nodes };
  assert.equal(referenceChapterForNode(source, h, 'part'), narrow);
  assert.equal(referenceChapterForNode(source, h, 'mixed'), whole);
  const groupOnly = { chapters:[whole, { id:'broad', groups:['arm'] }, { id:'narrow', groups:['joint'] }] };
  assert.equal(referenceChapterForNode(groupOnly, h, 'part'), groupOnly.chapters[2], 'smallest complete authored group coverage is preferred');
});
