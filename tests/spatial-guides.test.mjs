import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadProject } from '../scripts/lib/project-config.mjs';
import { loadSpatialGuides, validateSpatialGuide } from '../scripts/lib/spatial-guides.mjs';
import { resolveReferenceAssets } from '../scripts/lib/spatial-reference-assets.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const { models } = await loadProject(root);
const guides = await loadSpatialGuides(models);
test('optional guides are revision-bound to their own geometry and authored clips', () => {
  assert.deepEqual(guides.map(g => g.modelId).sort(), ['hexapod','open-duck']);
  const duck = guides.find(g => g.modelId === 'open-duck');
  const model = models.find(m => m.manifest.id === duck.modelId);
  const check = edit => {
    const next = structuredClone(duck);
    edit(next);
    // Only a rotation channel actually bound to the GLB joint counts.
    return validateSpatialGuide(next, model, [{ name: model.metadata.operation.clipName,
      rotations: duck.chapters.find(c => c.id === 'leg').action.joints }]);
  };
  assert.throws(() => check(g => { g.modelRevision = 'older'; }), /revision/);
  assert.throws(() => check(g => { g.orbit.stations[1].anchor.meshName = 'missing'; }), /anchor/);
  assert.throws(() => check(g => { g.chapters[2].action.joints = ['unbound']; }), /joint/);
  assert.throws(() => check(g => { g.chapters[0].callouts[0].anchor.meshName = 'unknown'; }), /callout anchor/);
  assert.throws(() => check(g => { g.chapters[1].callouts[0].anchor.meshName = g.chapters[2].action.trace; }), /out-of-scope/);
  assert.throws(() => check(g => { g.chapters[1].callouts[1].at = 0; }), /ordered callouts/);
  assert.throws(() => check(g => { g.chapters[1].action.lifts[0].meshes = [g.chapters[2].action.trace]; }), /out-of-scope/);
  assert.throws(() => check(g => { g.chapters[1].referenceViews.plan = '../other-part.svg'; }), /model’s plates/);
  assert.throws(() => check(g => { g.chapters[1].referenceViews.section = g.chapters[1].referenceViews.plan; }), /distinct drawings/);
  assert.throws(() => check(g => { g.chapters[1].referenceViews.cues.push({ at: 0.1, view: 'plan' }); }), /ordered/);
});

test('a technical view must belong to its model, rest pose, revision and chapter', async () => {
  const duck = guides.find(g => g.modelId === 'open-duck');
  const model = models.find(m => m.manifest.id === duck.modelId);
  const source = await readFile(model.assets.model);
  const resolve = (edit, bytes = source) => {
    const guide = structuredClone(duck);
    edit(guide);
    return resolveReferenceAssets(model, guide, bytes);
  };
  assert.equal((await resolve(() => {})).length, 9);
  await assert.rejects(resolve(g => { g.modelRevision = 'superseded'; }), /does not match/);
  await assert.rejects(resolve(g => { g.modelId = 'other-robot'; }), /does not match/);
  await assert.rejects(resolve(g => { g.chapters[1].referenceViews.section = g.chapters[2].referenceViews.section; }), /does not match/);
  await assert.rejects(resolve(g => { g.chapters[1].referenceViews.plan = g.chapters[1].referenceViews.elevation; }), /does not match/);
  await assert.rejects(resolve(() => {}, Buffer.from('a different mesh')), /does not match/);
});
