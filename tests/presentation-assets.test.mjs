import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadPresentationAssets, presentationAssetModule } from '../scripts/lib/presentation-assets.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const json = async relative => JSON.parse(await readFile(new URL(`../${relative}`, import.meta.url), 'utf8'));
const registry = await json('content/presentations/registry.json');
const provenance = await json('content/presentations/provenance.json');
const models = await Promise.all(registry.items.map(async record => ({
  manifest:await json(`content/models/${record.modelId}/manifest.json`),
  tour:await json(`content/models/${record.modelId}/tour.json`),
  revision:record.modelRevision,
})));

test('integrated robot packages and matching derivative media preserve the reviewed source bytes', async () => {
  assert.equal(provenance.sourceRevision, '3005c25a040c488397c1f487a507aa3b7b6827fb');
  assert.deepEqual(Object.keys(provenance.models), ['open-duck','hexapod','dropbear']);
  for (const files of Object.values(provenance.models)) for (const [relative, expected] of Object.entries(files)) {
    const bytes = await readFile(new URL(`../${relative}`, import.meta.url));
    assert.equal(bytes.length, expected.bytes, relative);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected.sha256, relative);
  }
  const project = await json('project.config.json');
  assert.equal(project.id, 'annora-explorer'); assert.equal(project.defaultModel, 'kinetic-01');
  const preserved = ['kinetic-01','apollo','linkrods','sk08','open-duck','hexapod','dropbear'].map(id => `content/models/${id}/manifest.json`);
  // New prepared products may be added through data. Existing examples and
  // their ordering remain stable without a test-code edit for each intake.
  assert.deepEqual(project.models.map(item => item.manifest).filter(path => preserved.includes(path)), preserved);
});

test('a project only bundles media belonging to its configured model and exact authored tour', async () => {
  const selected = await loadPresentationAssets(root, [models[0]]);
  assert.deepEqual(selected.map(item => item.modelId), ['open-duck']);
  const module = presentationAssetModule(root, selected);
  assert.match(module, /open-duck\/film\.mp4\?url/);
  assert.doesNotMatch(module, /hexapod|dropbear/);
  assert.deepEqual(await loadPresentationAssets(root, []), []);
  const wrongTour = [{...models[0],tour:{id:'a-different-tour'}}];
  await assert.rejects(loadPresentationAssets(root, wrongTour), /different authored tour/);
  const wrongRevision = [{...models[0],revision:`sha256:${'0'.repeat(64)}`}];
  await assert.rejects(loadPresentationAssets(root, wrongRevision), /different model package revision/);
});

test('registered presentations have source attribution and complete matching film and keyframe sets', async () => {
  const records = await loadPresentationAssets(root, models);
  assert.equal(records.length, 3);
  for (const record of records) {
    assert.equal(models.find(model => model.manifest.id === record.modelId).tour.id, record.tourId);
    assert.deepEqual(Object.keys(record.media), ['film','gif','hero','exploded','detail']);
    assert.match(record.preparationUrl, /annora-duck-showcase\/tree\/3005c25/);
    assert.ok(record.attribution.includes(record.modelId === 'hexapod' ? 'CERN-OHL-W-2.0' : record.modelId === 'dropbear' ? 'MIT' : 'Apache-2.0'));
  }
});
