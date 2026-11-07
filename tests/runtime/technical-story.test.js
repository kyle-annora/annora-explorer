import test from 'node:test';
import assert from 'node:assert/strict';
import drawing from '../../content/drawings/sk08/package.json' with { type: 'json' };
import overview from '../../content/drawings/sk08/overview-legacy.json' with { type: 'json' };
import { createDrawingContext } from '../../src/drawing-preview/context.js';
import { createTechnicalStoryReference, normalizeTechnicalStoryReference, technicalStoryReferenceKey } from '../../src/product-room/technical-story.js';
import { copyProductStory, validateProductStory, createStoryController, storyStepIsCurrent } from '../../src/product-room/story.js';

const clone = value => JSON.parse(JSON.stringify(value));
const model = { id: drawing.modelId, revision: drawing.modelRevision, title: 'SK08 shaft support', rootId: 'sk08', parts: [{ id: 'sk08-body', title: 'Shaft support' }] };
const parts = [{ id: 'sk08', title: 'SK08' }, ...model.parts];
const context = createDrawingContext({ drawing, sheetId: 'sheet-1', regionId: 'shaft-bore', modelRevision: model.revision, model, presentationSnapshot: overview });
const technical = createTechnicalStoryReference({ context, pdfPage: 1, viewId: overview.sheets[0].views[0].id });
const choice = { id: 'front-shaft', title: 'Front view · shaft bore', nodeId: 'sk08-body', technical };
const story = { version: 1, title: 'Read the shaft support', steps: [{ id: 'bore', kind: 'technical', nodeId: 'sk08-body', title: 'Locate the shaft bore', caption: 'The highlighted bore is linked to the source drawing.', technical }] };
const options = { model, parts, technicalReferences: [choice] };
const issues = value => validateProductStory(value, options);
function mockViewer() {
  const calls = [], state = { lifecycle: 'ready', model: { id: model.id, revision: model.revision }, navigation: { selectedId: 'sk08' }, tour: { active: false } };
  return { calls, viewer: { state, pause: async () => { calls.push(['pause']); }, request: async (method, params) => {
    calls.push([method, clone(params || {})]);
    if (method === 'focus') state.navigation.selectedId = params.nodeId;
    if (method === 'restoreInspection') state.navigation.selectedId = params.inspection.view.selectedId;
  } } };
}
function inspection() {
  const identity = { id: model.id, revision: model.revision };
  return { version: '1', model: identity, view: { viewVersion: '0.1', model: identity, coordinateFrame: 'normalized-assembly-v1',
    selectedId: 'sk08-body', scopeId: 'sk08', isolated: false, mode: 'explore', renderStyle: 'engineering', separation: 0, operation: null,
    displayOptions: { appearance: 'light', grid: true, ambientOcclusion: true, featureEdges: true, hiddenEdges: false, lineWeight: 'standard' },
    camera: { position: [2, 3, 8], target: [0, 0, 0], up: [0, 1, 0], projection: { kind: 'perspective', verticalFovDegrees: 42, zoom: 1, offsetX: 0, offsetY: 0 }, viewport: { width: 1200, height: 800 } },
  } };
}

test('technical steps reuse exact source pins without retaining a duplicate commercial snapshot', () => {
  assert.deepEqual(issues(story), []);
  assert.equal(technical.context.roomSnapshot, undefined);
  assert.deepEqual(technical.context.drawing, context.drawing);
  assert.equal(technical.pdfPage, 1);
  assert.deepEqual(copyProductStory(story), story);
  assert.equal(model.tour, undefined, 'A static prepared product does not need authored motion.');
});

test('publication rejects changed source, page, part, association and overview identities', () => {
  for (const change of [
    step => { step.technical.context.drawing.assetRevision = 'a'.repeat(64); },
    step => { step.technical.pdfPage = 2; },
    step => { step.technical.rotation = 90; },
    step => { delete step.technical.context.drawing.mappingRevision; },
    step => { step.technical.context.drawing.mappingRevision = 'new-mapping'; },
    step => { step.technical.context.drawing.presentationRevision = 'overview-new'; },
    step => { step.technical.context.drawing.presentationSnapshot = null; },
    step => { step.technical.viewId = overview.sheets[0].views[1].id; },
    step => { step.technical.context.modelRevision = 'other-model'; },
    step => { step.nodeId = 'sk08'; },
    step => { step.tourId = 'invented'; step.chapterId = 'motion'; },
  ]) {
    const changed = clone(story); change(changed.steps[0]);
    assert.ok(issues(changed).length, JSON.stringify(changed.steps[0]));
  }
});

test('original source mode is explicit and old technical stories retain their exact references', () => {
  const sourceOnly = createTechnicalStoryReference({ context: { ...context, drawing: { ...context.drawing, presentationSnapshot: null, presentationRevision: undefined } }, pdfPage: 1 });
  assert.equal(sourceOnly.viewId, null);
  assert.equal(sourceOnly.context.drawing.presentationSnapshot, null);
  const archived = clone(story); archived.steps[0].technical.context.drawing.mappingRevision = 'archived-mapping';
  assert.ok(issues(archived).length);
  assert.deepEqual(validateProductStory(archived, { ...options, historical: true }), []);
  const preserved = JSON.stringify(archived);
  assert.deepEqual(copyProductStory(archived), archived);
  assert.equal(JSON.stringify(archived), preserved);
  assert.notEqual(technicalStoryReferenceKey(archived.steps[0].technical), technicalStoryReferenceKey(technical));
  const malformed = clone(archived); malformed.steps[0].technical.pdfPage = -1;
  assert.ok(validateProductStory(malformed, { ...options, historical: true }).length);
});

test('a paired capture must select the same part and model version', () => {
  const paired = clone(story); paired.steps[0].inspection = inspection();
  assert.deepEqual(issues(paired), []);
  paired.steps[0].inspection.view.selectedId = 'sk08';
  assert.ok(issues(paired).some(issue => issue.path.endsWith('.inspection')));
  paired.steps[0].inspection = inspection(); paired.steps[0].inspection.model.revision = 'new';
  assert.ok(issues(paired).some(issue => issue.path.endsWith('.inspection')));
});

test('technical reference fields reject malformed source versions and unsupported payloads', () => {
  for (const patch of [{ version: 2 }, { rotation: 45 }, { pdfPage: 0 }, { viewId: 'not-published' }]) {
    assert.throws(() => normalizeTechnicalStoryReference({ ...technical, ...patch }));
  }
  const missingOverview = clone(technical); delete missingOverview.context.drawing.presentationSnapshot; delete missingOverview.context.drawing.presentationRevision;
  assert.throws(() => normalizeTechnicalStoryReference(missingOverview));
  assert.ok(validateProductStory(story, { model, parts }).length, 'A reference needs the prepared host capability, not just plausible JSON.');
});

test('technical playback keeps one viewer, exact detail and normal takeover semantics', async () => {
  const { viewer, calls } = mockViewer(); let shown, cleared = 0;
  const player = createStoryController({ viewer, story, ...options,
    showTechnicalReference: async (reference, token) => { shown = reference; assert.equal(token.isCurrent(), true); assert.equal(token.signal.aborted, false); },
    clearTechnicalReference: () => { cleared++; },
  });
  await player.select(0);
  assert.deepEqual(shown, technical);
  assert.deepEqual(calls, [['pause'], ['focus', { nodeId: 'sk08-body' }]]);
  assert.equal(storyStepIsCurrent(story.steps[0], viewer.state, model), true);
  assert.equal(player.state().active, true);
  await player.resume(); assert.equal(calls.length, 2, 'A drawing does not run an invented animation.');
  await assert.rejects(player.seek(.5), { code: 'INVALID_ARGUMENT' });
  player.yieldToExplorer(); assert.equal(player.state().active, false); assert.equal(cleared, 2);
});

test('hosts without technical reading fail before changing the viewer', async () => {
  const { viewer, calls } = mockViewer();
  const player = createStoryController({ viewer, story, ...options });
  await assert.rejects(player.select(0), { code: 'UNSUPPORTED_CAPABILITY' });
  assert.deepEqual(calls, []);
  assert.equal(player.state().busy, false);
  assert.match(player.state().error, /drawing-capable/);
});

test('an unavailable exact file reports an error and does not focus a substitute', async () => {
  const { viewer, calls } = mockViewer();
  const player = createStoryController({ viewer, story, ...options, showTechnicalReference: async () => { throw Object.assign(new Error('Saved file unavailable.'), { code: 'SOURCE_UNAVAILABLE' }); } });
  await assert.rejects(player.select(0), { code: 'SOURCE_UNAVAILABLE' });
  assert.deepEqual(calls, [['pause']]);
  assert.equal(player.state().active, false); assert.equal(player.state().index, -1);
});

test('closing, takeover or disposal aborts pending drawing load and prevents a late camera change', async () => {
  for (const operation of ['close', 'yieldToExplorer', 'dispose']) {
    const { viewer, calls } = mockViewer(); let finish, token, clears = 0;
    const player = createStoryController({ viewer, story, ...options,
      showTechnicalReference: async (_ref, value) => { token = value; await new Promise(resolve => { finish = resolve; }); },
      clearTechnicalReference: () => { clears++; },
    });
    const pending = player.select(0);
    await new Promise(resolve => setImmediate(resolve));
    await player[operation]();
    assert.equal(token.signal.aborted, true); assert.equal(token.isCurrent(), false);
    finish(); await pending;
    assert.equal(calls.filter(([method]) => method === 'focus').length, 0);
    assert.equal(player.state().active, false); assert.ok(clears >= 2);
  }
});

test('a later technical selection aborts the previous load and preserves its own reference', async () => {
  const { viewer, calls } = mockViewer(); let finish, first;
  const second = clone(story); second.steps.push({ ...clone(story.steps[0]), id: 'same-detail-again', title: 'Review the detail' });
  const player = createStoryController({ viewer, story: second, ...options,
    showTechnicalReference: async (_ref, token) => {
      if (token.step.id === 'bore') { first = token; await new Promise(resolve => { finish = resolve; }); }
    },
  });
  const pending = player.select(0); await new Promise(resolve => setImmediate(resolve));
  await player.select(1); finish(); await pending;
  assert.equal(first.signal.aborted, true); assert.equal(player.state().index, 1);
  assert.equal(calls.filter(([method]) => method === 'focus').length, 1);
});
