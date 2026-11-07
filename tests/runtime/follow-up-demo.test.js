import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFollowUpDemo, loadFollowUpDemo, followUpURL, FOLLOW_UP_DEMO_ID, FOLLOW_UP_DEMO_KEY } from '../../src/product-room/follow-up-demo.js';
import { createDemoProjectRepository, PROJECT_STORAGE_KEY } from '../../src/product-room/project-repository.js';
import { projectReturnURL, readBuyerRoute, buyerRouteHash } from '../../src/product-room/navigation.js';

const parameters = values => new URLSearchParams({ followUpDemo: FOLLOW_UP_DEMO_ID, ...values });

test('exact clarification identity survives review routing and a null return route stays usable', () => {
  const route = { view: 'project', projectId: 'P1', tab: 'activity', mode: 'message', messageId: 'M1', stage: 'review' };
  assert.deepEqual(readBuyerRoute(buyerRouteHash(route)), route);
  const url = projectReturnURL({ base: 'https://example.org/annora/product-room/?followUp=F1', projectId: 'P1', returnView: null });
  assert.equal(url.hash, '#project&project=P1');
  assert.equal(buyerRouteHash({ ...route, mode: undefined }).includes('message='), false);
});
function memory() {
  const data = new Map(); let writes = 0;
  return { data, get writes() { return writes; }, storage: {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => { writes++; data.set(key, value); },
  } };
}

test('fresh browser opens a deterministic fictional fixture in a separate namespace without changing ordinary projects', async () => {
  const first = memory(), second = memory(); first.data.set(PROJECT_STORAGE_KEY, 'ordinary projects remain untouched');
  const a = await loadFollowUpDemo(parameters(), { storage: first.storage, locks: null });
  const b = await loadFollowUpDemo(parameters(), { storage: second.storage, locks: null });
  assert.equal(a.repository.mode, 'follow-up-demo');
  assert.equal(a.projectId, b.projectId); assert.equal(a.followUpId, b.followUpId);
  assert.deepEqual(await a.repository.getFollowUp(a.followUpId), await b.repository.getFollowUp(b.followUpId));
  assert.equal(first.data.get(PROJECT_STORAGE_KEY), 'ordinary projects remain untouched');
  assert.equal(first.writes, 1);
  const project = await a.repository.getProject(a.projectId);
  assert.equal(project.inquiry.values.email, 'alex@example.com');
  assert.equal(project.inquiry.requestItems.length, 2);
  assert.equal(project.quotes.length, 1);
  assert.equal(project.messages[0].kind, 'clarification');
  assert.equal((await buildFollowUpDemo()).classification, 'public-fictional-example');
});

test('ordinary follow-up links never import the public example or expose browser-local records elsewhere', async () => {
  const source = memory(), destination = memory();
  const fixture = await loadFollowUpDemo(parameters(), { storage: source.storage, locks: null });
  const release = await fixture.repository.getFollowUp(fixture.followUpId);
  const url = new URL(followUpURL(release, 'https://example.org/annora/studio/?unrelated=private#project'));
  assert.equal(url.searchParams.has('followUpDemo'), false);
  assert.equal(url.searchParams.has('unrelated'), false);
  assert.equal(await loadFollowUpDemo(url.searchParams, { storage: destination.storage, locks: null }), null);
  const ordinary = createDemoProjectRepository({ storage: destination.storage, locks: null });
  await assert.rejects(ordinary.getFollowUp(release.id), { code: 'NOT_FOUND' });
  assert.equal(destination.writes, 0);
});

test('opening the example again preserves explicit progress and exact locally published version B', async () => {
  const local = memory(), a = await loadFollowUpDemo(parameters(), { storage: local.storage, locks: null });
  const original = await a.repository.getFollowUp(a.followUpId);
  const position = await a.repository.getFollowUpProgress(a.followUpId);
  const saved = await a.repository.saveFollowUpProgress(a.followUpId, { ...position, stepId: original.story.steps[1].id, mode: 'exploring' });
  let draft = await a.repository.getFollowUpDraft(a.projectId);
  draft.title = 'A second local version'; draft.stepIds.reverse();
  await a.repository.saveFollowUpDraft(draft);
  const next = await a.repository.publishFollowUp(await a.repository.reviewFollowUp(a.projectId), { confirmed: true });
  const url = new URL(followUpURL(next, `https://example.org/annora/studio/?followUpDemo=${FOLLOW_UP_DEMO_ID}`));
  const writes = local.writes;
  const reopened = await loadFollowUpDemo(url.searchParams, { storage: local.storage, locks: null });
  assert.equal(reopened.followUpId, next.id); assert.equal(next.version, 2);
  assert.equal(local.writes, writes);
  assert.deepEqual(await reopened.repository.getFollowUpProgress(original.id), saved);
  assert.deepEqual(await reopened.repository.getFollowUp(original.id), original);
  assert.deepEqual(await reopened.repository.getFollowUp(next.id), next);
  const elsewhere = memory();
  await assert.rejects(loadFollowUpDemo(url.searchParams, { storage: elsewhere.storage, locks: null }), { code: 'FOLLOW_UP_DEMO_UNAVAILABLE' });
  assert.equal(elsewhere.writes, 0, 'A local revision is not silently replaced by public v1.');
});

test('malformed or conflicting identities never fall back to ordinary projects or initialize the fixture', async () => {
  const invalid = [
    `followUpDemo=unknown`, `followUpDemo=${FOLLOW_UP_DEMO_ID}&followUpDemo=${FOLLOW_UP_DEMO_ID}`,
    `${parameters()}&project=ordinary-project`, `${parameters()}&model=apollo`, `${parameters()}&followUp=missing`,
    `${parameters()}&followUp=`, `${parameters()}&model=kinetic-01&model=kinetic-01`,
    `${parameters()}&walkthrough=sample`, `${parameters()}&studioPreview=draft`, `${parameters()}&release=another-release`,
  ];
  for (const query of invalid) {
    const local = memory(); local.data.set(PROJECT_STORAGE_KEY, 'leave me unchanged');
    await assert.rejects(loadFollowUpDemo(new URLSearchParams(query), { storage: local.storage, locks: null }), { code: 'FOLLOW_UP_DEMO_UNAVAILABLE' });
    assert.equal(local.writes, 0, query);
    assert.equal(local.data.get(PROJECT_STORAGE_KEY), 'leave me unchanged');
  }
});

test('unrelated or corrupt records in the fixture namespace are reported and never overwritten', async () => {
  const local = memory();
  const empty = JSON.stringify({ schemaVersion: 2, revision: 0, drafts: [], projects: [], quoteDrafts: [] });
  local.data.set(FOLLOW_UP_DEMO_KEY, empty);
  await assert.rejects(loadFollowUpDemo(parameters(), { storage: local.storage, locks: null }), { code: 'FOLLOW_UP_DEMO_UNAVAILABLE' });
  assert.equal(local.data.get(FOLLOW_UP_DEMO_KEY), empty); assert.equal(local.writes, 0);
  local.data.set(FOLLOW_UP_DEMO_KEY, 'broken');
  await assert.rejects(loadFollowUpDemo(parameters(), { storage: local.storage, locks: null }), { code: 'STORAGE_CORRUPT' });
  assert.equal(local.data.get(FOLLOW_UP_DEMO_KEY), 'broken');
});

test('storage read/write failures and silent write loss never report an open example', async () => {
  for (const storage of [
    { getItem() { throw new Error('Denied'); }, setItem() {} },
    { getItem() { return null; }, setItem() { throw new Error('Full'); } },
    { getItem() { return null; }, setItem() {} },
  ]) await assert.rejects(loadFollowUpDemo(parameters(), { storage, locks: null }), { code: 'FOLLOW_UP_DEMO_UNAVAILABLE' });
});

test('concurrent initialization shares the repository lock and installs only once', async () => {
  const local = memory(), keys = []; let queue = Promise.resolve();
  const locks = { request(key, operation) { keys.push(key); const next = queue.then(operation); queue = next.catch(() => {}); return next; } };
  const [first, second] = await Promise.all([
    loadFollowUpDemo(parameters(), { storage: local.storage, locks }),
    loadFollowUpDemo(parameters(), { storage: local.storage, locks }),
  ]);
  assert.equal(first.followUpId, second.followUpId); assert.equal(local.writes, 1);
  const progress = await first.repository.getFollowUpProgress(first.followUpId);
  await first.repository.saveFollowUpProgress(first.followUpId, { ...progress, mode: 'exploring' });
  assert.deepEqual(new Set(keys), new Set([`annora:${FOLLOW_UP_DEMO_KEY}`]));
});

test('buyer and seller links retain fictional namespace, exact project, quote and follow-up identities only', async () => {
  const fixture = await buildFollowUpDemo(), release = fixture.store.followUps[0], quote = fixture.store.projects[0].quotes[0];
  const base = `https://example.org/annora/studio/?followUpDemo=${FOLLOW_UP_DEMO_ID}&name=PRIVATE&email=private%40example.org#project?id=${fixture.projectId}`;
  const url = new URL(followUpURL(release, base));
  assert.equal(url.pathname, '/annora/product-room/');
  assert.equal(url.searchParams.get('project'), fixture.projectId);
  assert.equal(url.searchParams.get('followUp'), fixture.followUpId);
  assert.equal(url.searchParams.get('followUpDemo'), FOLLOW_UP_DEMO_ID);
  assert.equal(url.searchParams.get('model'), release.context.modelId);
  assert.equal(url.hash, '#explore');
  assert.equal(url.href.includes('PRIVATE'), false); assert.equal(url.href.includes('email'), false);
  const buyer = projectReturnURL({ base: url.href, projectId: fixture.projectId,
    returnView: `#project&project=${fixture.projectId}&tab=quotation&quote=${quote.id}` });
  assert.equal(buyer.searchParams.get('followUpDemo'), FOLLOW_UP_DEMO_ID);
  assert.equal(readBuyerRoute(buyer.hash).quoteId, quote.id);
  assert.equal(readBuyerRoute(buyer.hash).projectId, fixture.projectId);
  const seller = projectReturnURL({ base: url.href, projectId: fixture.projectId, role: 'seller' });
  assert.equal(seller.searchParams.get('followUpDemo'), FOLLOW_UP_DEMO_ID);
  assert.equal(seller.hash, `#project?id=${fixture.projectId}`);
  assert.throws(() => followUpURL(release, 'https://example.org/annora/studio/?followUpDemo=another'), { code: 'FOLLOW_UP_DEMO_UNAVAILABLE' });
});
