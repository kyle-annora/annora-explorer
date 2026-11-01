import test from 'node:test';
import assert from 'node:assert/strict';
import { createInquiryDraft, reviewInquiry, reviewRevision, reviewNextStep, compareQuotes, projectStatus } from '../../src/product-room/project-domain.js';
import { createDemoProjectRepository, parseProjectStore, PROJECT_STORAGE_KEY } from '../../src/product-room/project-repository.js';
import { sampleInquiryValues } from '../../src/product-room/project-fixtures.js';

const context = { productId: 'kinetic-01', productTitle: 'Crank-slider mechanism', modelId: 'kinetic-01', modelRevision: 'kinetic-r1', part: { id: 'guide', title: 'Linear guide' } };
function memoryStorage() {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), data };
}
function setup(storage = memoryStorage()) {
  let serial = 0, time = 0;
  const options = { storage, locks: null, makeId: prefix => `${prefix}-${++serial}`, now: () => new Date(Date.UTC(2026, 10, 1, 12, 0, time++)).toISOString() };
  return { storage, options, repository: createDemoProjectRepository(options) };
}
async function savedDraft(repository) {
  const draft = await repository.getDraft(context); draft.values = sampleInquiryValues();
  return repository.saveDraft(draft);
}
async function savedProject(repository) { return repository.submitInquiry(reviewInquiry(await savedDraft(repository))); }
async function quotedProject(repository) { const project = await savedProject(repository); return repository.createSampleQuote(project.id); }
const changedValues = { quantity: '30', targetWeeks: '4', notes: 'Please review a more compact mounting arrangement.' };
const nextValues = { intent: 'engineering-review', message: 'Please review mounting and load before confirming suitability.' };

test('viewing a part remains context, while only explicitly confirmed requirements enter the RFQ', async () => {
  const { repository } = setup();
  let draft = await savedDraft(repository);
  assert.equal(draft.context.part.id, 'guide'); assert.deepEqual(draft.requirements, []);
  draft.requirements.push({ id: 'guide-review', label: 'Guide clearance', value: 'Review installation space', unit: '', source: 'customer', confirmed: false, part: context.part });
  draft = await repository.saveDraft(draft);
  assert.throws(() => reviewInquiry(draft), error => error.code === 'VALIDATION' && !!error.fields.requirements);
  draft.requirements[0].confirmed = true; draft = await repository.saveDraft(draft);
  const project = await repository.submitInquiry(reviewInquiry(draft));
  assert.deepEqual(project.inquiry.requirements, draft.requirements);
  assert.equal(project.context.modelRevision, 'kinetic-r1');
  assert.equal(project.inquiry.requirements[0].source, 'customer');
});

test('incomplete drafts save and reopen, but final review validates fields', async () => {
  const { repository } = setup();
  const draft = await repository.saveDraft(await repository.getDraft(context));
  assert.deepEqual(await repository.getDraft(context), draft);
  assert.throws(() => reviewInquiry(draft), error => !!(error.fields.application && error.fields.quantity));
  assert.throws(() => reviewInquiry({ ...draft, values: { ...sampleInquiryValues(), email: 'invalid', quantity: '0', targetWeeks: '200', stroke: '-2' } }), error => error.code === 'VALIDATION' && ['email', 'quantity', 'targetWeeks', 'stroke'].every(key => error.fields[key]));
  const valid = { ...draft, values: { ...sampleInquiryValues(), email: '', name: '', targetWeeks: '', stroke: '' } };
  assert.equal(reviewInquiry(valid).kind, 'inquiry');
});

test('submission requires a saved, reviewed, unmodified snapshot and deduplicates retries', async () => {
  const { repository } = setup(), draft = await savedDraft(repository);
  await assert.rejects(repository.submitInquiry(draft), { code: 'STALE_REVIEW' });
  const review = reviewInquiry(draft), changedReview = structuredClone(review); changedReview.draft.values.quantity = '90';
  await assert.rejects(repository.submitInquiry(changedReview), { code: 'STALE_REVIEW' });
  const project = await repository.submitInquiry(review);
  assert.deepEqual(await repository.submitInquiry(review), project);
  assert.equal((await repository.listProjects()).length, 1);
  assert.equal((await repository.listDrafts()).length, 0);
  assert.equal((await repository.getDraft(context)).values.application, '');
});

test('editing a draft after review rejects its old submission and preserves the edited input', async () => {
  const { repository } = setup(), draft = await savedDraft(repository), review = reviewInquiry(draft);
  const saved = await repository.saveDraft({ ...draft, values: { ...draft.values, quantity: '40' } });
  await assert.rejects(repository.submitInquiry(review), { code: 'STALE_REVIEW' });
  assert.equal((await repository.getDraft(context)).values.quantity, '40');
  const project = await repository.submitInquiry(reviewInquiry(saved)); assert.equal(project.inquiry.values.quantity, '40');
});

test('inquiry and quotation snapshots do not change when returned objects or a new draft change', async () => {
  const { repository } = setup(), project = await quotedProject(repository), snapshot = JSON.stringify(project);
  project.inquiry.values.quantity = '999'; project.context.part.title = 'Changed'; project.quotes[0].lineItems[0].amount = 1;
  assert.equal(JSON.stringify(await repository.getProject(project.id)), snapshot);
  const draft = await savedDraft(repository); await repository.saveDraft({ ...draft, values: { ...draft.values, quantity: '100' } });
  assert.equal(JSON.stringify(await repository.getProject(project.id)), snapshot);
});

test('saved draft identity is scoped to exact model revision and product', async () => {
  const { repository } = setup(); await savedDraft(repository);
  const newer = await repository.getDraft({ ...context, modelRevision: 'kinetic-r2' });
  assert.equal(newer.revision, 0); assert.equal(newer.values.quantity, '');
  const another = await repository.getDraft({ ...context, productId: 'other' });
  assert.equal(another.revision, 0); assert.equal((await repository.listDrafts()).length, 1);
  assert.throws(() => createInquiryDraft({ ...context, modelRevision: '' }), { code: 'VALIDATION' });
});

test('browser persistence survives a fresh repository without creating supplier replies on view', async () => {
  const { repository, options } = setup(), project = await quotedProject(repository);
  const reopened = createDemoProjectRepository(options);
  assert.deepEqual(await reopened.getProject(project.id), project);
  assert.equal((await reopened.listProjects())[0].replies.length, 0);
  assert.deepEqual(await reopened.createSampleQuote(project.id), project);
});

test('sample pricing keeps unpriced items and final total pending; timing remains a proposal', async () => {
  const { repository } = setup(), project = await quotedProject(repository), quote = project.quotes[0];
  assert.equal(quote.source, 'sample'); assert.equal(quote.quantity, 20); assert.equal(quote.subtotal, 3950);
  assert.equal(quote.total, null); assert.ok(quote.lineItems.some(item => item.amount === null));
  assert.equal(quote.requestedWeeks, 6); assert.match(quote.proposedLeadTime, /6–8 weeks after technical review/);
  assert.ok(quote.assumptions.some(item => /not approved/.test(item)));
  assert.ok(quote.openItems.some(item => item.owner === 'Engineering' && item.status === 'Open'));
});

test('an explicit revision and simulated reply append v2 while keeping all original records intact', async () => {
  const { repository } = setup(), original = await quotedProject(repository), quote = original.quotes[0];
  const review = reviewRevision(original, quote.id, changedValues);
  const changed = await repository.requestRevision(review);
  assert.equal(changed.changes.length, 1); assert.equal(changed.quotes.length, 1); assert.equal(changed.replies.length, 0);
  assert.deepEqual(await repository.requestRevision(review), changed);
  const updated = await repository.simulateReply(original.id, changed.changes[0].id);
  assert.equal(updated.quotes.length, 2); assert.equal(updated.replies.length, 1);
  assert.deepEqual(updated.inquiry, original.inquiry); assert.deepEqual(updated.quotes[0], quote);
  const revised = updated.quotes[1]; assert.equal(revised.version, 2); assert.equal(revised.quantity, 30); assert.equal(revised.unitPrice, 175); assert.equal(revised.total, null);
  assert.equal(revised.previousQuoteId, quote.id); assert.equal(revised.changeId, changed.changes[0].id); assert.equal(revised.replyId, updated.replies[0].id);
  assert.equal(updated.replies[0].topics.find(item => item.label === 'Your question').status, 'Unanswered');
  assert.equal(updated.replies[0].topics.find(item => item.label === 'Delivery timing').status, 'Alternative proposed');
  for (const record of [updated.replies[0], revised]) {
    assert.ok(record.openItems.some(item => item.label === original.inquiry.values.notes));
    assert.ok(record.openItems.some(item => item.label === changedValues.notes));
  }
  assert.deepEqual(await repository.simulateReply(original.id, changed.changes[0].id), updated);
  const comparisons = compareQuotes(quote, revised);
  assert.equal(comparisons.find(row => row.key === 'quantity').changed, true);
  assert.equal(comparisons.find(row => row.key === 'proposedLeadTime').changed, false);
  assert.equal(comparisons.find(row => row.key === 'total').after, 'Pending review');
});

test('revision requests preserve exact versions and reject obsolete reviews or duplicate pending changes', async () => {
  const { repository } = setup(), project = await quotedProject(repository), quote = project.quotes[0];
  const firstReview = reviewRevision(project, quote.id, changedValues), staleReview = reviewRevision(project, quote.id, { ...changedValues, quantity: '40' });
  const changed = await repository.requestRevision(firstReview);
  await assert.rejects(repository.requestRevision(staleReview), { code: 'STALE_REVIEW' });
  await assert.rejects(repository.requestRevision(reviewRevision(changed, quote.id, { ...changedValues, quantity: '40' })), { code: 'CONFLICT' });
  const revised = await repository.simulateReply(project.id, changed.changes[0].id);
  assert.throws(() => reviewRevision(revised, quote.id, changedValues), { code: 'STALE_REVIEW' });
  assert.equal(revised.changes[0].quoteVersion, 1);
  assert.throws(() => reviewRevision(revised, revised.quotes[1].id, { quantity: '30', targetWeeks: '4', notes: '' }), error => !!error.fields.notes);
});

test('next-step requests require review, exact current quote and no outstanding revision; remain nonbinding', async () => {
  const { repository } = setup(), project = await quotedProject(repository), quote = project.quotes[0];
  await assert.rejects(repository.confirmNextStep({ projectId: project.id, ...nextValues }), { code: 'STALE_REVIEW' });
  const reviewed = reviewNextStep(project, quote.id, nextValues);
  const changed = await repository.requestRevision(reviewRevision(project, quote.id, changedValues));
  await assert.rejects(repository.confirmNextStep(reviewed), { code: 'STALE_REVIEW' });
  await assert.rejects(repository.confirmNextStep(reviewNextStep(changed, quote.id, nextValues)), { code: 'CONFLICT' });
  const revised = await repository.simulateReply(project.id, changed.changes[0].id), latest = revised.quotes.at(-1);
  assert.throws(() => reviewNextStep(revised, quote.id, nextValues), { code: 'STALE_REVIEW' });
  const finalReview = reviewNextStep(revised, latest.id, nextValues), done = await repository.confirmNextStep(finalReview);
  assert.equal(done.nextSteps[0].delivery, 'demo-only'); assert.equal(done.nextSteps[0].quoteVersion, 2);
  assert.equal(done.nextSteps[0].intent, 'engineering-review'); assert.equal(done.quotes[1].total, null);
  assert.deepEqual(await repository.confirmNextStep(finalReview), done);
  assert.equal(projectStatus(done).label, 'Next step requested');
});

test('saving failure cannot report a successful draft or create an inquiry', async () => {
  const { repository, storage } = setup(), draft = await savedDraft(repository), before = storage.getItem(PROJECT_STORAGE_KEY);
  storage.setItem = () => { throw new Error('Quota exceeded'); };
  await assert.rejects(repository.submitInquiry(reviewInquiry(draft)), { code: 'STORAGE_UNAVAILABLE' });
  assert.equal(storage.getItem(PROJECT_STORAGE_KEY), before); assert.equal((await repository.listProjects()).length, 0);
  assert.deepEqual(await repository.getDraft(context), draft);
});

test('read failure is actionable and never silently creates a fresh store', async () => {
  const { repository } = setup({ getItem() { throw new Error('Blocked'); }, setItem() { throw new Error('Unexpected write'); } });
  await assert.rejects(repository.listProjects(), { code: 'STORAGE_UNAVAILABLE' });
  await assert.rejects(repository.getDraft(context), { code: 'STORAGE_UNAVAILABLE' });
});

test('invalid JSON, unsupported schema and corrupt lineage stay untouched', async () => {
  const { repository, storage } = setup();
  for (const raw of ['not-json', JSON.stringify({ schemaVersion: 2, revision: 0, drafts: [], projects: [] }), JSON.stringify({ schemaVersion: 1, revision: 0, drafts: {}, projects: [] })]) {
    storage.setItem(PROJECT_STORAGE_KEY, raw);
    await assert.rejects(repository.listProjects(), { code: 'STORAGE_CORRUPT' });
    assert.equal(storage.getItem(PROJECT_STORAGE_KEY), raw);
  }
  storage.data.clear();
  const project = await quotedProject(repository), changed = await repository.requestRevision(reviewRevision(project, project.quotes[0].id, changedValues));
  await repository.simulateReply(project.id, changed.changes[0].id);
  const store = JSON.parse(storage.getItem(PROJECT_STORAGE_KEY)); store.projects[0].quotes[1].previousQuoteId = 'NOT-THIS-PROJECT';
  const corrupted = JSON.stringify(store); storage.setItem(PROJECT_STORAGE_KEY, corrupted);
  await assert.rejects(repository.getProject(project.id), { code: 'STORAGE_CORRUPT' });
  assert.equal(storage.getItem(PROJECT_STORAGE_KEY), corrupted);
});

test('parallel tabs cannot overwrite a newer draft revision', async () => {
  const { repository, options } = setup(), draft = await savedDraft(repository), other = createDemoProjectRepository(options);
  const secondCopy = await other.getDraft(context);
  await repository.saveDraft({ ...draft, values: { ...draft.values, quantity: '31' } });
  await assert.rejects(other.saveDraft({ ...secondCopy, values: { ...secondCopy.values, quantity: '90' } }), { code: 'CONFLICT' });
  assert.equal((await repository.getDraft(context)).values.quantity, '31');
});

test('storage changes between read and commit fail instead of overwriting another writer', async () => {
  const { repository, storage } = setup(), draft = await savedDraft(repository), raw = storage.getItem(PROJECT_STORAGE_KEY);
  const originalGet = storage.getItem; let calls = 0;
  storage.getItem = key => {
    calls++;
    if (calls === 2) { const next = JSON.parse(raw); next.revision++; storage.data.set(key, JSON.stringify(next)); }
    return originalGet(key);
  };
  await assert.rejects(repository.submitInquiry(reviewInquiry(draft)), { code: 'CONFLICT' });
  storage.getItem = originalGet;
  assert.equal(parseProjectStore(storage.getItem(PROJECT_STORAGE_KEY)).projects.length, 0);
});

test('sample supplier operations are bounded to the crank model', async () => {
  const { repository } = setup();
  let draft = await repository.getDraft({ ...context, productId: 'apollo', modelId: 'apollo', modelRevision: 'apollo-r1' });
  draft.values = sampleInquiryValues(); draft = await repository.saveDraft(draft);
  const project = await repository.submitInquiry(reviewInquiry(draft));
  await assert.rejects(repository.createSampleQuote(project.id), { code: 'UNSUPPORTED_PRODUCT' });
  assert.equal((await repository.getProject(project.id)).quotes.length, 0);
});

test('unknown projects and changes do not create records as a side effect', async () => {
  const { repository } = setup();
  await assert.rejects(repository.getProject('missing'), { code: 'NOT_FOUND' });
  const project = await quotedProject(repository);
  await assert.rejects(repository.simulateReply(project.id, 'missing'), { code: 'NOT_FOUND' });
  assert.deepEqual(await repository.getProject(project.id), project);
});

test('older next-step receipts do not hide later changes or a revised quote', async () => {
  const { repository } = setup(), project = await quotedProject(repository), quote = project.quotes[0];
  const next = await repository.confirmNextStep(reviewNextStep(project, quote.id, nextValues));
  const changed = await repository.requestRevision(reviewRevision(next, quote.id, changedValues));
  assert.equal(projectStatus(changed).label, 'Changes requested');
  const revised = await repository.simulateReply(project.id, changed.changes[0].id);
  assert.equal(projectStatus(revised).label, 'Revised quotation');
  assert.equal(revised.nextSteps[0].quoteId, quote.id);
});

test('stored draft field types and confirmed inquiry semantics cannot bypass validation', async () => {
  const { repository, storage } = setup(), draft = await savedDraft(repository);
  let state = JSON.parse(storage.getItem(PROJECT_STORAGE_KEY)); state.drafts[0].values.quantity = 20;
  storage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(state));
  await assert.rejects(repository.listDrafts(), { code: 'STORAGE_CORRUPT' });
  state.drafts[0] = draft; storage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(state));
  const project = await repository.submitInquiry(reviewInquiry(draft));
  const raw = storage.getItem(PROJECT_STORAGE_KEY);
  for (const mutate of [
    p => { p.inquiry.values.application = ''; },
    p => { p.inquiry.values.quantity = 20; },
    p => { p.inquiry.requirements.push({ id: 'unreviewed', label: 'Guide', value: 'Review', unit: '', source: 'customer', confirmed: false }); }
  ]) {
    state = JSON.parse(raw); mutate(state.projects[0]); storage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(state));
    await assert.rejects(repository.getProject(project.id), { code: 'STORAGE_CORRUPT' });
  }
});
