import test from 'node:test';
import assert from 'node:assert/strict';
import { createDrawingInquiryHost } from '../../src/drawing-preview/inquiry-host.js';
import { createInquirySession } from '../../src/product-room/inquiry-session.js';
import { createDrawingProjectRepository, DRAWING_PROJECT_STORAGE_KEY } from '../../src/product-room/drawing-inquiry.js';
import { PROJECT_STORAGE_KEY } from '../../src/product-room/project-repository.js';

const reference = {
  productId: 'drawing-fixture', productTitle: 'Housing', modelId: 'drawing-fixture', modelRevision: 'model-A',
  part: { id: 'body', title: 'Housing body' },
  drawing: { id: 'housing-drawing', title: 'Housing reference', revision: 'source-A', assetId: 'pdf-A', assetRevision: 'a'.repeat(64),
    partId: 'body', sheetId: 'sheet-1', sheetTitle: 'Housing views', regionId: 'bore', regionLabel: 'Bearing bore',
    sourceURL: 'https://example.com/housing.pdf', mappingRevision: 'mapping-A' },
};
const otherRegion = { ...reference, drawing: { ...reference.drawing, regionId: 'mount', regionLabel: 'Mounting face' } };
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
function setup({ delayMount, failSave = () => false } = {}) {
  const data = new Map(); let serial = 0, current = reference, available = true, session, options, mounts = 0;
  const base = createDrawingProjectRepository({ storage: { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) },
    locks: null, makeId: prefix => `${prefix}-${++serial}`, now: () => '2026-11-05T18:00:00Z' });
  const repository = { ...base, saveDraft: draft => failSave() ? Promise.reject(new Error('Storage unavailable')) : base.saveDraft(draft) };
  const restored = [], openedProjects = [], openings = [];
  const host = createDrawingInquiryHost({ repository, readContext: () => structuredClone(current), canCapture: () => available,
    onRestore: context => restored.push(context), onProject: project => openedProjects.push(project), onOpening: pending => openings.push(pending),
    async mountPanel(config) {
      mounts++; options = config;
      if (delayMount) await delayMount.promise;
      session = createInquirySession({ repository: config.repository, schedule: () => 1, cancel: () => {} });
      return { open: input => session.open(input), getContext: () => session.getState().draft || session.getState().project ? session.getContext() : null,
        beforeLeave: () => session.beforeLeave(), minimize: () => session.beforeLeave(),
        async dispose() { if (!await session.beforeLeave()) return false; session.dispose(); return true; } };
    },
  });
  return { host, repository, data, restored, openedProjects, openings, get session() { return session; }, get options() { return options; }, get mounts() { return mounts; },
    select: value => { current = value; }, available: value => { available = value; } };
}

test('drawing entry uses its existing repository and freezes the clicked detail during a lazy mount', async () => {
  const gate = deferred(), f = setup({ delayMount: gate });
  const first = f.host.open(), repeated = f.host.open();
  assert.equal(first, repeated);
  f.select(otherRegion); gate.resolve(); await first;
  assert.equal(f.mounts, 1);
  assert.equal(f.options.repository, f.repository);
  assert.deepEqual(f.session.getContext(), reference);
  assert.equal(f.session.getState().draft.values.intent, 'application-review');
  assert.deepEqual(f.openings, [true, false]);
  await f.host.beforeLeave({ release: true });
});

test('same-version exploration resumes the pinned draft and only explicit capture adopts the current detail', async () => {
  const f = setup(); await f.host.open();
  f.session.updateValues({ application: 'Check this bore before deciding quantity.' });
  const id = f.session.getState().draft.id;
  f.select(otherRegion); await f.host.open();
  assert.equal(f.session.getState().draft.id, id);
  assert.equal(f.session.getContext().drawing.regionId, 'bore');
  await f.session.capture(f.options.onCapture);
  assert.equal(f.session.getContext().drawing.regionId, 'mount');
  assert.equal(f.session.getState().draft.values.application, 'Check this bore before deciding quantity.');
  await f.session.restore(f.options.onRestore);
  assert.deepEqual(f.restored[0], otherRegion);
  const project = await f.session.review().then(() => f.session.confirm());
  await f.options.onProject(project);
  assert.equal(f.openedProjects[0].id, project.id);
  assert.deepEqual(project.context, otherRegion);
  assert.ok(f.data.has(DRAWING_PROJECT_STORAGE_KEY));
  assert.equal(f.data.has(PROJECT_STORAGE_KEY), false);
  await f.host.beforeLeave({ release: true });
});

test('unconfirmed current details cannot be attached but cannot block resuming a valid saved reference', async () => {
  const f = setup(); f.available(false);
  await assert.rejects(f.host.open(), /confirmed drawing detail/);
  assert.equal(f.mounts, 0);
  f.available(true); await f.host.open(); f.available(false);
  await f.host.open();
  await assert.rejects(f.session.capture(f.options.onCapture), /confirmed drawing detail/);
  assert.deepEqual(f.session.getContext(), reference);
  await f.host.beforeLeave({ release: true });
});

test('product or history departure waits for initial panel loading and saves its exact reference', async () => {
  const gate = deferred(), f = setup({ delayMount: gate });
  const opening = f.host.open();
  let left = false;
  const departure = f.host.beforeLeave({ release: true }).then(ok => { left = ok; return ok; });
  await tick(); assert.equal(left, false);
  await assert.rejects(f.host.open(), /finish saving/);
  gate.resolve(); await opening;
  assert.equal(await departure, true);
  assert.equal(f.host.getContext(), null);
  const saved = await f.repository.getDraft(reference);
  assert.equal(saved.revision, 1);
  assert.deepEqual(saved.context, reference);
});

test('failed save refuses departure, preserves local input, and allows retry without a duplicate draft', async () => {
  let fail = true; const f = setup({ failSave: () => fail });
  await f.host.open(); f.session.updateValues({ application: 'Preserve this question.' });
  assert.equal(await f.host.beforeLeave({ release: true }), false);
  assert.equal(f.session.getState().draft.values.application, 'Preserve this question.');
  assert.equal(f.session.getState().dirty, true);
  assert.equal(f.mounts, 1);
  fail = false; assert.equal(await f.host.beforeLeave({ release: true }), true);
  assert.equal((await f.repository.listDrafts()).length, 1);
  assert.equal((await f.repository.getDraft(reference)).values.application, 'Preserve this question.');
});

test('leaving for a full-page editor releases its cached session so reopening loads that editor’s newer draft', async () => {
  const f = setup(); await f.host.open(); f.session.updateValues({ application: 'First question.' });
  await f.host.beforeLeave({ release: true });
  const saved = await f.repository.getDraft(reference);
  await f.repository.saveDraft({ ...saved, values: { ...saved.values, application: 'Updated on the full page.' } });
  f.select(otherRegion); await f.host.open();
  assert.equal(f.mounts, 2);
  assert.equal(f.session.getState().draft.values.application, 'Updated on the full page.');
  assert.equal(f.session.getContext().drawing.regionId, 'bore');
  await f.host.beforeLeave({ release: true });
});

test('source-version replacement cannot overwrite a saved draft through the reference-update action', async () => {
  const f = setup(); await f.host.open(); f.session.updateValues({ application: 'Keep source A.' });
  f.select({ ...otherRegion, drawing: { ...otherRegion.drawing, revision: 'source-B', assetRevision: 'b'.repeat(64), mappingRevision: 'mapping-B' } });
  await assert.rejects(f.session.capture(f.options.onCapture), { code: 'INCOMPATIBLE_CONTEXT' });
  assert.deepEqual(f.session.getContext(), reference);
  assert.equal(f.session.getState().draft.values.application, 'Keep source A.');
  await f.host.beforeLeave({ release: true });
});
