import test from 'node:test';
import assert from 'node:assert/strict';
import { createInquirySession, prepareInquirySubmission, confirmInquirySubmission } from '../../src/product-room/inquiry-session.js';
import { createDemoProjectRepository, PROJECT_STORAGE_KEY } from '../../src/product-room/project-repository.js';
import { reviewInquiry, reviewRevision, reviewNextStep, createInquiryDraft } from '../../src/product-room/project-domain.js';
import { reviewQuote, reviewReply, reviewCustomerReply } from '../../src/product-room/seller-domain.js';
import { sampleInquiryValues } from '../../src/product-room/project-fixtures.js';
import { createHostInquiryRepository } from '../../src/integration-kit/templates/repository-adapter.js';

const reference = { version: '1', adapter: { id: 'independent-viewer', version: '1', coordinateFrame: 'source-metres-v1' },
  product: { id: 'kinetic-01', revision: 'product-a' }, model: { id: 'kinetic-01', revision: 'geometry-1' },
  snapshot: { selectedPartId: 'rod', camera: { position: [2, 3, 8], target: [0, 0, 0] } } };
const context = { productId: 'kinetic-01', productTitle: 'Crank-slider mechanism', productRevision: 'product-a', modelId: 'kinetic-01', modelRevision: 'geometry-1', part: { id: 'rod', title: 'Connecting rod' }, viewerReference: reference };
const nextContext = () => { const next = structuredClone(context); next.viewerReference.snapshot.camera.position[0] = 99; return next; };
function setup(wrap = value => value) {
  const data = new Map(); let serial = 0;
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  const repository = createDemoProjectRepository({ storage, locks: null, makeId: prefix => `${prefix}-${++serial}`, now: () => '2026-11-06T12:00:00.000Z' });
  const session = createInquirySession({ repository: wrap(repository), schedule: () => 1, cancel: () => {} });
  return { storage, repository, session };
}
const withoutReference = context => { const result = structuredClone(context); delete result.viewerReference; return result; };

test('external view survives save, reload, review and confirmation without adopting a newer camera', async () => {
  const { repository, session } = setup();
  await session.open({ context, suggestedIntent: 'application-review', suggestedScope: 'part' });
  session.updateValues({ application: 'Review this mounting plate in its assembly.' });
  await session.save(); await session.open({ context: nextContext() });
  assert.deepEqual(session.getContext(), context);
  const review = await session.review();
  assert.deepEqual(review.draft.context, context);
  const project = await session.confirm();
  assert.deepEqual(project.context, context);
  assert.deepEqual((await repository.getProject(project.id)).context, context);
  assert.deepEqual(await session.confirm(), project);
  assert.equal((await repository.listProjects()).length, 1);
  session.dispose();
});

test('unsupported host repositories reject external references before a write', async () => {
  let writes = 0;
  const { session } = setup(repository => ({ ...repository, supportedViewerReferenceVersions: [], saveDraft: async value => { writes++; return repository.saveDraft(value); } }));
  await assert.rejects(session.open({ context }), { code: 'UNSUPPORTED_VIEWER_REFERENCE' });
  assert.equal(writes, 0);
  session.dispose();
});

test('an adapter declaration cannot hide lossy saves or silently advance review', async () => {
  const { session } = setup(repository => ({ ...repository, saveDraft: async value => ({ ...await repository.saveDraft(value), context: withoutReference(value.context) }) }));
  await session.open({ context, suggestedIntent: 'application-review' });
  session.updateValues({ application: 'Keep my exact camera.' });
  await assert.rejects(session.review(), { code: 'UNSUPPORTED_VIEWER_REFERENCE' });
  assert.equal(session.getState().stage, 'details');
  assert.equal(session.getState().draft.values.application, 'Keep my exact camera.');
  assert.deepEqual(session.getContext(), context);
  assert.equal(await session.beforeLeave(), false);
  session.dispose();
});

test('lossy confirmation remains in review and never reports verified success', async () => {
  const { session } = setup(repository => ({ ...repository, submitInquiry: async review => ({ ...await repository.submitInquiry(review), context: withoutReference(review.draft.context) }) }));
  await session.open({ context, suggestedIntent: 'application-review' });
  session.updateValues({ application: 'Check the guide.' }); await session.review();
  await assert.rejects(session.confirm(), { code: 'INVALID_CONFIRMATION' });
  assert.equal(session.getState().stage, 'review');
  assert.deepEqual(session.getContext(), context);
  session.dispose();
});

test('direct review/confirm helpers enforce the same external reference boundary', async () => {
  const { repository } = setup();
  const draft = await repository.getDraft(context); draft.values = sampleInquiryValues();
  await assert.rejects(prepareInquirySubmission({ repository: { ...repository, supportedViewerReferenceVersions: [] }, draft }), { code: 'UNSUPPORTED_VIEWER_REFERENCE' });
  await assert.rejects(prepareInquirySubmission({ repository, draft, saveDraft: async value => ({ ...await repository.saveDraft(value), context: withoutReference(value.context) }) }), { code: 'UNSUPPORTED_VIEWER_REFERENCE' });
  const saved = await repository.getDraft(context), review = reviewInquiry(saved);
  await assert.rejects(confirmInquirySubmission({ repository: { ...repository, submitInquiry: async () => ({ context: withoutReference(context) }) }, review }), { code: 'INVALID_CONFIRMATION' });
});

test('lossy or unknown-version loaded records reject without replacing existing input', async () => {
  let broken = false;
  const { session } = setup(repository => ({ ...repository, getDraft: async incoming => {
    const draft = await repository.getDraft(incoming);
    if (broken) draft.context.viewerReference.version = '2';
    return draft;
  } }));
  await session.open({ context, suggestedIntent: 'application-review' });
  session.updateValues({ application: 'Keep the old adapter view.' }); await session.save();
  broken = true;
  await assert.rejects(session.loadSavedDraft(), { code: 'UNSUPPORTED_VIEWER_REFERENCE' });
  assert.deepEqual(session.getContext(), context);
  session.dispose();
  const other = setup(repository => ({ ...repository, getDraft: async incoming => ({ ...await repository.getDraft(incoming), context: withoutReference(incoming) }) }));
  await assert.rejects(other.session.open({ context }), { code: 'INCOMPATIBLE_CONTEXT' });
  other.session.dispose();
});

test('independently referenced questions preserve each captured host view', async () => {
  const { session, repository } = setup();
  await session.open({ context, suggestedIntent: 'application-review' });
  session.updateValues({ application: 'Two views of the same part.' });
  await session.addRequestItem({ context, notes: 'Check this mounting face.' });
  await session.addRequestItem({ context: nextContext(), notes: 'Check this second angle.' });
  const review = await session.review(), project = await session.confirm();
  assert.equal(project.inquiry.requestItems.length, 2);
  assert.deepEqual(project.inquiry.requestItems, review.draft.requestItems);
  assert.equal(project.inquiry.requestItems[1].context.viewerReference.snapshot.camera.position[0], 99);
  assert.deepEqual((await repository.getProject(project.id)).inquiry.requestItems, review.draft.requestItems);
  session.dispose();
});

test('external references remain pinned across seller quotation v1/v2, discussions and next step', async () => {
  const { repository, storage } = setup();
  const draft = await repository.saveDraft({ ...await repository.getDraft(context), values: { ...sampleInquiryValues(), quoteScope: 'part' } });
  let project = await repository.submitInquiry(reviewInquiry(draft));
  const original = structuredClone(project.inquiry);
  let quote = await repository.getQuoteDraft(project.id);
  assert.deepEqual(quote.context, context);
  const changed = structuredClone(quote); changed.context = nextContext();
  await assert.rejects(repository.saveQuoteDraft(changed), { code: 'VALIDATION' });
  quote = await repository.saveQuoteDraft(quote); project = await repository.issueQuote(reviewQuote(project, quote));
  const first = structuredClone(project.quotes[0]);
  quote = await repository.getQuoteDraft(project.id); quote.values.scope = 'Updated mounting scope for review.';
  quote = await repository.saveQuoteDraft(quote); project = await repository.issueQuote(reviewQuote(project, quote));
  assert.deepEqual(project.quotes[0], first); assert.deepEqual(project.inquiry, original);
  project = await repository.sendReply(reviewReply(project, { kind: 'clarification', body: 'Confirm the available mounting space.' }));
  project = await repository.sendCustomerReply(reviewCustomerReply(project, { replyTo: project.messages.at(-1).id, body: 'Allow 100 mm for discussion.' }));
  project = await repository.confirmNextStep(reviewNextStep(project, project.quotes.at(-1).id, { intent: 'engineering-review', message: 'Review this mounting face.' }));
  for (const record of [...project.quotes, ...project.messages, ...project.nextSteps]) assert.deepEqual(record.context, context);
  const raw = JSON.parse(storage.getItem(PROJECT_STORAGE_KEY));
  raw.projects[0].quotes[0].context.viewerReference.snapshot.camera.position[0] = 40;
  storage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(raw));
  await assert.rejects(repository.getProject(project.id), { code: 'STORAGE_CORRUPT' });
});

test('sample quotation revisions, supplier replies and old records retain external references', async () => {
  const { repository } = setup();
  const draft = await repository.saveDraft({ ...await repository.getDraft(context), values: sampleInquiryValues() });
  let project = await repository.submitInquiry(reviewInquiry(draft));
  project = await repository.createSampleQuote(project.id);
  project = await repository.requestRevision(reviewRevision(project, project.quotes[0].id, { quantity: '30', targetWeeks: '4', notes: 'Review mounting.' }));
  project = await repository.simulateReply(project.id, project.changes[0].id);
  assert.equal(project.quotes.length, 2);
  for (const record of [...project.quotes, ...project.changes, ...project.replies]) assert.deepEqual(record.context, context);
  assert.deepEqual((await repository.getProject(project.id)).context, context);
});

test('unknown saved reference schema is held intact instead of migrated or reset', async () => {
  const { repository, storage } = setup();
  await repository.saveDraft({ ...createInquiryDraft(context, 'unknown-test'), values: sampleInquiryValues() });
  const raw = JSON.parse(storage.getItem(PROJECT_STORAGE_KEY)); raw.drafts[0].context.viewerReference.version = '2';
  const original = JSON.stringify(raw); storage.setItem(PROJECT_STORAGE_KEY, original);
  await assert.rejects(repository.listDrafts(), { code: 'STORAGE_CORRUPT' });
  assert.equal(storage.getItem(PROJECT_STORAGE_KEY), original);
});

test('repository template makes host ownership and supported versions explicit', () => {
  const getDraft = async () => {}, saveDraft = async () => {}, submitInquiry = async () => {};
  const adapter = createHostInquiryRepository({ getDraft, saveDraft, submitInquiry, supportedViewerReferenceVersions: ['1'] });
  assert.equal(adapter.getDraft, getDraft); assert.equal(adapter.supportsRequestItems, false);
  assert.deepEqual(adapter.supportedViewerReferenceVersions, ['1']);
  assert.equal(Object.isFrozen(adapter.supportedViewerReferenceVersions), true);
  assert.throws(() => createHostInquiryRepository({ getDraft, saveDraft }), /submitInquiry/);
  assert.throws(() => createHostInquiryRepository({ getDraft, saveDraft, submitInquiry, supportedViewerReferenceVersions: ['2'] }), /version 1/);
});
