import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProductStory, createStoryController, storyStepIsCurrent } from '../../src/product-room/story.js';
import { createStudioRepository, parseStudioStore } from '../../src/studio/repository.js';
import { studioChanges, validateRelease } from '../../src/studio/domain.js';
import { STUDIO_MODEL as model, STUDIO_PARTS as parts } from '../../src/studio/seed.js';

const clone = value => JSON.parse(JSON.stringify(value));
const identity = { id: model.id, revision: model.revision };
const view = { version: '1', model: identity, view: { viewVersion: '0.1', model: identity,
  coordinateFrame: 'normalized-assembly-v1', selectedId: 'rod', scopeId: model.rootId, isolated: false,
  mode: 'explore', renderStyle: 'engineering', separation: 0, operation: null,
  displayOptions: { appearance: 'light', grid: true, ambientOcclusion: true, featureEdges: true, hiddenEdges: false, lineWeight: 'standard' },
  camera: { position: [2,3,8], target: [0,0,0], up: [0,1,0], projection: { kind: 'perspective', verticalFovDegrees: 42, zoom: 1, offsetX: 0, offsetY: 0 }, viewport: { width: 1200, height: 800 } },
} };
const story = { version: 1, title: 'Follow the linkage', steps: [
  { id: 'close', title: 'The connecting rod', caption: 'Two pivots connect rotary input and linear output.', kind: 'inspection', nodeId: 'rod', inspection: view },
  { id: 'move', title: 'Follow one cycle', caption: 'The guide keeps the slider straight.', kind: 'chapter', nodeId: 'crank', tourId: model.tour.id, chapterId: 'motion' },
] };
function repository() {
  const data = new Map(); let id = 0;
  return createStudioRepository({ storage: { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }, locks: null,
    makeId: prefix => `${prefix}-${++id}`, now: () => '2026-11-06T12:00:00.000Z' });
}
function mockViewer() {
  const calls = [], state = { lifecycle: 'ready', model: identity, tour: { active: false } };
  const viewer = { state,
    pause: async () => { calls.push(['pause']); state.tour.status = 'paused'; },
    request: async (method, params = {}) => {
      calls.push([method, clone(params)]);
      if (method === 'startTour') Object.assign(state.tour, { active: true, tourId: params.tourId, status: 'paused' });
      if (method === 'exitTour') state.tour.active = false;
      if (method === 'goToTourChapter') state.tour.chapterId = params.chapterId;
      if (method === 'resumeTour') state.tour.status = 'playing';
    },
  };
  return { viewer, calls };
}

test('story supports a captured view and only approved short action references', () => {
  assert.deepEqual(validateProductStory(story, { model, parts }), []);
  assert.deepEqual(validateProductStory(undefined, { model, parts }), []);
  for (const alter of [
    value => { value.steps[0].inspection.model.revision = 'other'; },
    value => { value.steps[0].inspection.view.camera.position = [0,0,0]; },
    value => { value.steps[0].nodeId = 'guide'; },
    value => { value.steps[1].chapterId = 'invented-motion'; },
    value => { value.steps[1].nodeId = 'guide'; },
    value => { value.steps[1].inspection = view; },
    value => { value.steps.push(clone(value.steps[0])); },
    value => { value.steps[0].caption = ''; },
  ]) { const changed = clone(story); alter(changed); assert.ok(validateProductStory(changed, { model, parts }).length); }
  const longModel = clone(model); longModel.tour.chapters[0].duration = 10;
  assert.ok(validateProductStory(story, { model: longModel, parts }).length);
});

test('story preview and reviewed release retain camera, action, order and old release', async () => {
  const repo = repository(), original = await repo.getPublished();
  let draft = await repo.getDraft(); draft.presentation.story = clone(story);
  draft = await repo.saveDraft(draft);
  const preview = await repo.createPreview(draft);
  assert.deepEqual(preview.presentation.story, story);
  const reviewed = await repo.reviewRelease(draft);
  assert.ok(reviewed.changes.some(row => row.label === 'Story step added' && row.after.includes('Two pivots')));
  const release = await repo.publishDemo(reviewed);
  assert.deepEqual(release.presentation.story, story);
  assert.equal((await repo.getRelease(original.id)).presentation.story, undefined);
  const first = JSON.stringify(release);
  draft.presentation.story.steps.reverse(); draft.presentation.story.steps[0].caption = 'A revised explanation.';
  draft = await repo.saveDraft(draft);
  const next = await repo.reviewRelease(draft);
  assert.ok(next.changes.some(row => row.label === 'Story step order'));
  const version2 = await repo.publishDemo(next);
  assert.equal(version2.version, release.version + 1);
  assert.equal(JSON.stringify(await repo.getRelease(release.id)), first);
  assert.deepEqual((await repo.getPreview(preview.id)).presentation.story, story);
});

test('story edits invalidate release review and invalid capture blocks publication', async () => {
  const repo = repository(); let draft = await repo.getDraft(); draft.presentation.story = clone(story);
  draft = await repo.saveDraft(draft); const review = await repo.reviewRelease(draft);
  review.draft.presentation.story.steps[0].caption = 'Changed after review';
  await assert.rejects(repo.publishDemo(review), { code: 'STALE_REVIEW' });
  draft.presentation.story.steps[0].inspection.view.model.revision = 'other';
  draft = await repo.saveDraft(draft);
  await assert.rejects(repo.createPreview(draft), { code: 'VALIDATION' });
  await assert.rejects(repo.reviewRelease(draft), { code: 'VALIDATION' });
});

test('drafts allow incomplete story fields but reject a structure that cannot be edited', async () => {
  const repo = repository(); let draft = await repo.getDraft(); draft.presentation.story = clone(story);
  draft.presentation.story.steps[0].caption = '';
  draft = await repo.saveDraft(draft);
  assert.equal((await repo.getDraft()).presentation.story.steps[0].caption, '');
  await assert.rejects(repo.reviewRelease(draft), { code: 'VALIDATION' });
  for (const invalid of [
    { version: 1, title: 'Missing steps' },
    { version: 1, title: 'Invalid step', steps: [null] },
    { version: 1, title: 'Invalid text', steps: [{ ...story.steps[0], title: {} }] },
  ]) {
    const changed = clone(draft); changed.presentation.story = invalid;
    await assert.rejects(repo.saveDraft(changed), { code: 'VALIDATION' });
    assert.deepEqual(await repo.getDraft(), draft);
  }
});

test('story adapter uses only the existing capture and tour controller, including seek and exit', async () => {
  const { viewer, calls } = mockViewer();
  const player = createStoryController({ viewer, story, model, parts });
  await player.select(0);
  assert.deepEqual(calls.map(call => call[0]), ['pause', 'restoreInspection']);
  assert.deepEqual(calls[1][1].inspection, view);
  calls.length = 0;
  await player.select(1, { play: true });
  assert.deepEqual(calls.map(call => call[0]), ['pause', 'startTour', 'goToTourChapter', 'resumeTour']);
  assert.equal(player.state().index, 1);
  await player.pause(); assert.equal(viewer.state.tour.status, 'paused');
  await player.resume(); assert.equal(viewer.state.tour.status, 'playing');
  await player.seek(.5); assert.deepEqual(calls.at(-1), ['seekTour', { seconds: 1.25, chapterId: 'motion' }]);
  await player.replay(); assert.equal(calls.at(-1)[0], 'resumeTour');
  await player.close(); assert.equal(player.state().active, false); assert.equal(viewer.state.tour.active, false);
});

test('story adapter refuses another model revision before mutating the viewer', async () => {
  const { viewer, calls } = mockViewer(); viewer.state.model = { ...identity, revision: 'other' };
  const player = createStoryController({ viewer, story, model, parts });
  await assert.rejects(player.select(0), { code: 'INCOMPATIBLE_VIEW' });
  assert.deepEqual(calls, []);
});

test('native takeover releases story ownership without changing the new Explorer state', async () => {
  const { viewer, calls } = mockViewer(), player = createStoryController({ viewer, story, model, parts });
  await player.select(1, { play: true });
  assert.equal(storyStepIsCurrent(story.steps[1], viewer.state, model), true);
  viewer.state.tour.status = 'paused';
  assert.equal(storyStepIsCurrent(story.steps[1], viewer.state, model), true);
  viewer.state.tour.chapterId = 'inside';
  assert.equal(storyStepIsCurrent(story.steps[1], viewer.state, model), false);
  const before = calls.length; player.yieldToExplorer();
  assert.equal(player.state().active, false); assert.equal(calls.length, before);
  assert.equal(viewer.state.tour.chapterId, 'inside');
  viewer.state.tour.active = false;
  assert.equal(storyStepIsCurrent(story.steps[1], viewer.state, model), false);
  viewer.state.navigation = { selectedId: 'rod' };
  assert.equal(storyStepIsCurrent(story.steps[0], viewer.state, model), true);
  viewer.state.navigation.selectedId = 'guide';
  assert.equal(storyStepIsCurrent(story.steps[0], viewer.state, model), false);
});

test('buyer story owns one transport while editor previews retain native controls', async () => {
  const { viewer, calls } = mockViewer();
  const editor = createStoryController({ viewer, story, model, parts });
  await editor.select(1); assert.deepEqual(calls.find(call => call[0] === 'startTour')[1], { tourId: model.tour.id });
  await editor.close(); calls.length = 0;
  const buyer = createStoryController({ viewer, story, model, parts, hostedControls: true });
  await buyer.select(1); assert.deepEqual(calls.find(call => call[0] === 'startTour')[1], { tourId: model.tour.id, controls: 'host' });
  buyer.yieldToExplorer(); assert.deepEqual(calls.at(-1), ['setTourControls', { controls: 'explorer' }]);
  await buyer.select(1); buyer.dispose(); assert.deepEqual(calls.at(-1), ['setTourControls', { controls: 'explorer' }]);
});

test('a failed action retains the previous step and reports a retryable visual state', async () => {
  const { viewer } = mockViewer(); const player = createStoryController({ viewer, story, model, parts });
  await player.select(0);
  viewer.request = async () => { throw Object.assign(new Error('Action unavailable. Try again.'), { code: 'ASSET_LOAD_FAILED' }); };
  await assert.rejects(player.select(1), { code: 'ASSET_LOAD_FAILED' });
  assert.equal(player.state().index, 0); assert.equal(player.state().busy, false); assert.match(player.state().error, /Try again/);
});

test('disposed or superseded story preparation cannot start a late action', async () => {
  const { viewer, calls } = mockViewer(); let release;
  viewer.pause = () => new Promise(resolve => { release = resolve; });
  const player = createStoryController({ viewer, story, model, parts });
  const pending = player.select(1, { play: true }); player.dispose(); release(); await pending;
  assert.deepEqual(calls, []);
});

test('release review explicitly reports camera replacement', () => {
  const before = { presentation: { story } }, after = clone(before);
  after.presentation.story.steps[0].inspection.view.camera.position[0] = 9;
  assert.ok(studioChanges(before, after).some(row => row.label.endsWith('Saved camera') && row.after.includes('check buyer preview')));
});

test('archived stories retain old source identities without accepting malformed captures', async () => {
  const repo = repository(); let draft = await repo.getDraft(); draft.presentation.story = clone(story);
  draft = await repo.saveDraft(draft);
  const release = await repo.publishDemo(await repo.reviewRelease(draft));
  const archived = clone(release);
  archived.modelRevision = 'archived-model-revision';
  const steps = archived.presentation.story.steps;
  steps[0].nodeId = steps[0].inspection.view.selectedId = 'archived-rod';
  steps[0].inspection.view.scopeId = 'archived-assembly';
  steps[0].inspection.model.revision = steps[0].inspection.view.model.revision = archived.modelRevision;
  steps[1].nodeId = 'archived-crank';
  steps[1].tourId = 'archived-tour'; steps[1].chapterId = 'archived-action';
  const store = { schemaVersion: 1, revision: 1, drafts: [], releases: [archived], previews: [], publishedId: archived.id };
  assert.deepEqual(parseStudioStore(JSON.stringify(store)).releases[0], archived);
  assert.ok(validateRelease(archived).some(issue => issue.path === 'modelRevision'));
  assert.ok(validateRelease(archived).some(issue => issue.path.endsWith('.inspection')));
  for (const alter of [
    value => { value.steps[0].inspection.view.camera.position = [0, 0, 0]; },
    value => { value.steps[0].inspection.model.revision = model.revision; },
    value => { value.steps[0].nodeId = 'different-subject'; },
    value => { value.steps[1].tourId = ''; },
    value => { value.steps[1].nodeId = 7; },
  ]) {
    const invalid = clone(store); alter(invalid.releases[0].presentation.story);
    assert.throws(() => parseStudioStore(JSON.stringify(invalid)), { code: 'STORAGE_CORRUPT' });
  }
});
