import nodeTest from 'node:test';
import assert from 'node:assert/strict';
import { createStudioRepository, STUDIO_STORAGE_KEY, parseStudioStore } from '../../src/studio/repository.js';
import { validateStudioDraft, validateRelease, validateReleasePackage, copyStudioValue, studioChanges } from '../../src/studio/domain.js';
import { BUNDLED_RELEASE, STUDIO_MODEL, STUDIO_ASSETS, resolveStudioContent } from '../../src/studio/seed.js';

const test = (name, body) => nodeTest(name, { skip: !STUDIO_MODEL && 'Crank-slider is not configured in this project.' }, body);

function fixture() {
  const entries = new Map(); let index = 0, fail = false;
  const storage = { getItem: key => entries.get(key) ?? null, setItem(key, value) { if (fail) throw new Error('Quota exceeded'); entries.set(key, value); } };
  const options = { storage, locks: null, now: () => '2026-11-01T15:00:00.000Z', makeId: prefix => `${prefix}-TEST-${++index}` };
  return { repo: createStudioRepository(options), other: () => createStudioRepository(options), entries, storage, fail: value => { fail = value; } };
}
const errorCode = code => error => error.code === code;
const onlyErrors = issues => issues.filter(issue => issue.severity === 'error');
async function saved(repo) { return repo.saveDraft(await repo.getDraft()); }

test('Studio previews and demo releases preserve the earlier buyer release', async () => {
  const { repo } = fixture(), original = await repo.getPublished(), originalJSON = JSON.stringify(original);
  let draft = await repo.getDraft();
  draft.content.tagline = 'Follow the motion from crank to carriage.';
  draft.content.partContent.find(part => part.nodeId === 'rod').description = 'Two pivots connect the rotary input to the guided carriage.';
  const asset = STUDIO_ASSETS.find(item => item.id === 'kinetic-application-checklist');
  draft.content.documents.push({ id: 'application-guide', title: asset.title, description: 'Bring your installation requirements.',
    assetId: asset.id, revision: asset.revision, date: asset.date, type: asset.type, fileName: asset.fileName, nodeId: 'rod', sample: true });
  draft.content.partContent.find(part => part.nodeId === 'rod').documentIds.push('application-guide');
  draft.inquiryProfile.fields.find(field => field.id === 'load').hint = 'State the working load and its unit.';
  draft = await repo.saveDraft(draft);
  assert.equal(draft.content.documents.at(-1).assetRevision, 'Sample 02');
  const preview = await repo.createPreview(draft);
  assert.equal(preview.source, 'preview'); assert.equal(preview.draftRevision, draft.revision);
  assert.equal((await repo.getPublished()).id, original.id);
  const review = await repo.reviewRelease(draft);
  assert.ok(review.changes.some(row => row.label === 'Opening headline'));
  const release = await repo.publishDemo(review);
  assert.equal(release.version, original.version + 1); assert.equal(release.source, 'demo');
  assert.equal((await repo.getPublished()).id, release.id);
  assert.equal(JSON.stringify(await repo.getRelease(original.id)), originalJSON);
  assert.equal((await repo.getPreview(preview.id)).content.partContent.find(part => part.nodeId === 'rod').description, 'Two pivots connect the rotary input to the guided carriage.');
  const packet = await repo.exportRelease(release.id);
  assert.deepEqual(onlyErrors(validateReleasePackage(packet)), []);
  assert.equal(packet.assetManifest.length, 2); assert.equal('reviewToken' in packet.release, false);
  assert.ok(packet.release.content.documents.every(doc => !('url' in doc)));
  assert.ok(resolveStudioContent(packet.release.content).documents.every(doc => typeof doc.url === 'string'));
});

test('Incomplete text can be saved without creating a buyer preview or release', async () => {
  const { repo } = fixture(); const draft = await repo.getDraft(); draft.content.title = '';
  const incomplete = await repo.saveDraft(draft);
  assert.equal((await repo.getDraft()).content.title, '');
  await assert.rejects(repo.createPreview(incomplete), errorCode('VALIDATION'));
  await assert.rejects(repo.reviewRelease(incomplete), errorCode('VALIDATION'));
  assert.equal((await repo.getPublished()).id, BUNDLED_RELEASE.id);
});

test('Release confirmation rejects tampered review packets and later edits', async () => {
  const { repo } = fixture(); const draft = await saved(repo), review = await repo.reviewRelease(draft);
  const tampered = copyStudioValue(review); tampered.draft.content.title = 'Changed after review';
  await assert.rejects(repo.publishDemo(tampered), errorCode('STALE_REVIEW'));
  draft.content.title = 'A newer draft'; await repo.saveDraft(draft);
  await assert.rejects(repo.publishDemo(review), errorCode('STALE_REVIEW'));
  assert.equal((await repo.getPublished()).id, BUNDLED_RELEASE.id);
});

test('Repeated confirmation is idempotent and cannot reactivate an earlier release', async () => {
  const { repo } = fixture(); let draft = await saved(repo);
  const firstReview = await repo.reviewRelease(draft), first = await repo.publishDemo(firstReview);
  assert.deepEqual(await repo.publishDemo(firstReview), first);
  draft.content.tagline = 'A second reviewed explanation.'; draft = await repo.saveDraft(draft);
  const second = await repo.publishDemo(await repo.reviewRelease(draft));
  assert.equal((await repo.publishDemo(firstReview)).id, first.id);
  assert.equal((await repo.getPublished()).id, second.id);
  assert.equal((await repo.listReleases()).filter(release => release.source === 'demo').length, 2);
});

test('Two editors cannot silently overwrite each other’s drafts', async () => {
  const { repo, other } = fixture(), second = other();
  const one = await repo.getDraft(), two = await second.getDraft();
  const first = await repo.saveDraft(one);
  await assert.rejects(second.saveDraft(two), errorCode('CONFLICT'));
  const stale = await second.getDraft(); first.content.title = 'Latest edit'; await repo.saveDraft(first);
  stale.content.title = 'Old edit'; await assert.rejects(second.saveDraft(stale), errorCode('CONFLICT'));
  assert.equal((await second.getDraft()).content.title, 'Latest edit');
});

test('A failed release write retains the published version and can be retried', async () => {
  const { repo, fail } = fixture(); const draft = await saved(repo), review = await repo.reviewRelease(draft);
  fail(true); await assert.rejects(repo.publishDemo(review), errorCode('STORAGE_UNAVAILABLE'));
  assert.equal((await repo.getPublished()).id, BUNDLED_RELEASE.id);
  assert.equal((await repo.getDraft()).revision, draft.revision);
  fail(false); const release = await repo.publishDemo(review);
  assert.equal((await repo.getPublished()).id, release.id);
});

test('Unknown or corrupt storage is not erased by attempting to save', async () => {
  const { repo, entries } = fixture(), broken = '{"schemaVersion":999,"customer":"do not erase"}';
  entries.set(STUDIO_STORAGE_KEY, broken);
  await assert.rejects(repo.getDraft(), errorCode('STORAGE_CORRUPT'));
  assert.equal(entries.get(STUDIO_STORAGE_KEY), broken);
  assert.throws(() => parseStudioStore('{broken'), errorCode('STORAGE_CORRUPT'));
});

test('References, provenance and inquiry guardrails are validated before release', async () => {
  const { repo } = fixture(); const draft = await repo.getDraft();
  draft.content.partContent[0].nodeId = 'missing-part';
  draft.content.partContent[1].documentIds.push('missing-document');
  draft.content.source.url = 'javascript:alert(1)';
  draft.content.documents[0].assetId = 'external-file';
  draft.inquiryProfile.fields.find(field => field.id === 'application').enabled = false;
  draft.presentation.defaultRenderStyle = 'unsupported';
  const issues = onlyErrors(validateStudioDraft(draft));
  for (const path of ['content.partContent.0.nodeId', 'content.partContent.1.documentIds', 'content.source.url', 'content.documents.0.assetId', 'inquiryProfile', 'presentation.defaultRenderStyle']) assert.ok(issues.some(issue => issue.path === path), path);
  const current = await repo.saveDraft(draft);
  await assert.rejects(repo.reviewRelease(current), errorCode('VALIDATION'));
});

test('Unverified numeric claims block release while open questions remain explicit', async () => {
  const { repo } = fixture(), draft = await repo.getDraft();
  const fact = draft.content.specGroups[2].facts[0];
  assert.ok(validateStudioDraft(draft).some(issue => issue.severity === 'warning'));
  fact.value = '500 kg';
  assert.ok(onlyErrors(validateStudioDraft(draft)).some(issue => issue.path.endsWith('.status')));
  fact.status = 'illustrative'; fact.source = 'Illustrative test assumption';
  assert.deepEqual(onlyErrors(validateStudioDraft(draft)), []);
});

test('Profile fingerprints follow field edits and earlier releases keep their original profile', async () => {
  const { repo } = fixture(); let draft = await saved(repo);
  const first = await repo.publishDemo(await repo.reviewRelease(draft));
  draft.inquiryProfile.fields.find(field => field.id === 'load').enabled = false;
  draft = await repo.saveDraft(draft);
  assert.notEqual(draft.inquiryProfile.version, first.inquiryProfile.version);
  const second = await repo.publishDemo(await repo.reviewRelease(draft));
  assert.equal((await repo.getRelease(first.id)).inquiryProfile.fields.find(field => field.id === 'load').enabled, true);
  assert.equal(second.inquiryProfile.fields.find(field => field.id === 'load').enabled, false);
  const forged = copyStudioValue(second); forged.inquiryProfile.version = first.inquiryProfile.version;
  assert.ok(onlyErrors(validateRelease(forged)).some(issue => issue.path === 'inquiryProfile.version'));
});

test('A preview is pinned to a saved draft and cannot be changed by a later save', async () => {
  const { repo } = fixture(); let draft = await saved(repo);
  const preview = await repo.createPreview(draft), copy = await repo.getPreview(preview.id);
  assert.equal((await repo.createPreview(draft)).id, preview.id);
  draft.content.tagline = 'New draft explanation'; draft = await repo.saveDraft(draft);
  assert.deepEqual(await repo.getPreview(preview.id), copy);
  assert.notEqual((await repo.createPreview(draft)).id, preview.id);
  const published = await repo.getPublished(); published.content.title = 'Mutated return value';
  assert.notEqual((await repo.getPublished()).content.title, published.content.title);
});

test('Malformed release packages yield actionable issues without throwing raw shape errors', () => {
  for (const value of [null, {}, { release: {} }, { release: { content: { documents: { map: 'broken' } } }, assetManifest: [] }]) {
    let issues; assert.doesNotThrow(() => { issues = validateReleasePackage(value); }); assert.ok(onlyErrors(issues).length > 0);
  }
  const packet = { schemaVersion: 1, kind: 'annora-room-release', release: copyStudioValue(BUNDLED_RELEASE), assetManifest: [] };
  assert.ok(onlyErrors(validateReleasePackage(packet)).some(issue => issue.path === 'assetManifest'));
  packet.release.content.documents[0].url = 'data:text/html,untrusted';
  assert.ok(onlyErrors(validateReleasePackage(packet)).some(issue => issue.path.endsWith('.url')));
});

test('A model replacement requires explicit reference review before publication', async () => {
  const { repo } = fixture(); const draft = await repo.getDraft(); draft.modelRevision = 'sha256:other-model';
  const savedDraft = await repo.saveDraft(draft);
  await assert.rejects(repo.reviewRelease(savedDraft), error => error.code === 'VALIDATION' && error.issues.some(issue => issue.path === 'modelRevision'));
  assert.equal((await repo.getPublished()).modelRevision, BUNDLED_RELEASE.modelRevision);
});

test('Release review summarizes an added or removed document once without technical asset properties', () => {
  const after = copyStudioValue(BUNDLED_RELEASE), asset = STUDIO_ASSETS.find(item => item.id === 'kinetic-application-checklist');
  after.content.documents.push({ id: 'application-checklist', title: asset.title, description: 'Application questions',
    assetId: asset.id, assetRevision: asset.revision, revision: 'Sample 02', date: asset.date,
    fileName: asset.fileName, type: asset.type, nodeId: 'rod', sample: true });
  const rows = studioChanges(BUNDLED_RELEASE, after);
  assert.deepEqual(rows, [{ label: 'Document added', before: '—', after: 'Application discussion checklist · Sample 02 · Connecting rod', changed: true }]);
  const removed = studioChanges(after, BUNDLED_RELEASE);
  assert.deepEqual(removed, [{ label: 'Document removed', before: rows[0].after, after: '—', changed: true }]);
  assert.equal(JSON.stringify(rows).includes('assetId'), false);
  assert.equal(JSON.stringify(rows).includes('application-checklist'), false);
});

test('Release review matches stable entities when reordered instead of showing swapped field edits', () => {
  const after = copyStudioValue(BUNDLED_RELEASE);
  after.content.questions.reverse();
  after.content.partContent.reverse();
  after.inquiryProfile.fields.reverse();
  after.content.specGroups[0].facts.reverse();
  const rows = studioChanges(BUNDLED_RELEASE, after);
  assert.deepEqual(rows.map(row => row.label).sort(), ['Component information order', 'Customer question order', 'Inquiry field order', 'Mechanism geometry · Fact order'].sort());
  assert.ok(rows.every(row => row.before.includes(' → ') && row.after.includes(' → ')));
  assert.ok(rows.every(row => !row.label.includes('added') && !row.label.includes('removed')));
});

test('Release review uses part and field names and keeps document associations readable', () => {
  const after = copyStudioValue(BUNDLED_RELEASE);
  const part = after.content.partContent.find(item => item.nodeId === 'rod');
  part.description = 'Transfers motion through two pivot joints.';
  part.documentIds = [];
  const field = after.inquiryProfile.fields.find(item => item.id === 'load');
  field.label = 'Operating load'; field.hint = 'Include the operating load and unit.'; field.enabled = false;
  after.presentation.defaultRenderStyle = 'flat';
  const rows = studioChanges(BUNDLED_RELEASE, after);
  assert.ok(rows.some(row => row.label === 'Connecting rod · Explanation' && row.after === part.description));
  assert.ok(rows.some(row => row.label === 'Connecting rod · Related documents' && row.before === 'Crank-slider mechanism brief · Sample 01' && row.after === 'No documents linked'));
  assert.ok(rows.some(row => row.label === 'Operating load · Field label' && row.before === 'Required load'));
  assert.ok(rows.some(row => row.label === 'Operating load · Helpful guidance'));
  assert.ok(rows.some(row => row.label === 'Operating load · Visibility' && row.after === 'Hidden from new inquiries'));
  assert.ok(rows.some(row => row.label === 'Default rendering' && row.after === 'Linework + Ember'));
});

test('Every currently editable content group changes the semantic release review', () => {
  const mutations = [
    ['product name', value => { value.content.title = 'New product name'; }],
    ['short name', value => { value.content.shortTitle = 'New short name'; }],
    ['headline', value => { value.content.tagline = 'New opening headline'; }],
    ['introduction', value => { value.content.description = 'New product introduction'; }],
    ['fact label', value => { value.content.specGroups[0].facts[0].label = 'New fact label'; }],
    ['fact value', value => { value.content.specGroups[0].facts[0].value = '90 mm'; }],
    ['fact status', value => { value.content.specGroups[0].facts[0].status = 'verified'; }],
    ['fact source', value => { value.content.specGroups[0].facts[0].source = 'Updated evidence'; }],
    ['fact qualification', value => { value.content.specGroups[0].facts[0].note = 'New qualification'; }],
    ['part title', value => { value.content.partContent[0].title = 'New customer-facing part name'; }],
    ['part explanation', value => { value.content.partContent[0].description = 'New part explanation'; }],
    ['part document link', value => { value.content.partContent[0].documentIds = ['kinetic-brief']; }],
    ['document title', value => { value.content.documents[0].title = 'New document title'; }],
    ['document description', value => { value.content.documents[0].description = 'New document introduction'; }],
    ['document revision', value => { value.content.documents[0].revision = 'Sample 03'; }],
    ['document date', value => { value.content.documents[0].date = '2026-11-02'; }],
    ['document association', value => { value.content.documents[0].nodeId = 'guide'; }],
    ['reference asset', value => { value.content.documents[0].assetId = 'kinetic-application-checklist'; }],
    ['question', value => { value.content.questions[0].title = 'New buyer question?'; }],
    ['question explanation', value => { value.content.questions[0].description = 'New explanation'; }],
    ['question link label', value => { value.content.questions[0].actionLabel = 'View this relationship'; }],
    ['question destination', value => { value.content.questions[0].target = { kind: 'part', nodeId: 'rod' }; }],
    ['field label', value => { value.inquiryProfile.fields[0].label = 'Your application'; }],
    ['field help', value => { value.inquiryProfile.fields[0].hint = 'Tell us about the installation'; }],
    ['field visibility', value => { value.inquiryProfile.fields[2].enabled = false; }],
    ['display mode', value => { value.presentation.defaultRenderStyle = 'linework'; }],
  ];
  for (const [name, edit] of mutations) {
    const after = copyStudioValue(BUNDLED_RELEASE); edit(after);
    assert.ok(studioChanges(BUNDLED_RELEASE, after).length > 0, name);
  }
});

test('Semantic comparisons tolerate incomplete drafts and ignore release bookkeeping', () => {
  for (const draft of [{}, { content: null }, { content: { documents: [null], partContent: [], questions: undefined }, inquiryProfile: { fields: null } }]) {
    assert.doesNotThrow(() => studioChanges(BUNDLED_RELEASE, draft));
  }
  const after = copyStudioValue(BUNDLED_RELEASE);
  after.id = 'new-release'; after.version++; after.content.roomRevision = 'new-release'; after.createdAt = '2026-11-02T15:00:00.000Z';
  after.inquiryProfile.version = 'record-only-change';
  assert.deepEqual(studioChanges(BUNDLED_RELEASE, after), []);
});

nodeTest('Studio reports an unavailable prepared model without initializing a draft', { skip: Boolean(STUDIO_MODEL) }, async () => {
  const { repo } = fixture();
  await assert.rejects(repo.getDraft(), error => error.code === 'INCOMPATIBLE_RELEASE' && error.issues.some(issue => issue.path === 'modelRevision'));
});

test('an edited fact stays consistent between the overview highlight and specification table', async () => {
  const { repo } = fixture(), before = await repo.getPublished();
  let draft = await repo.getDraft();
  draft.content.specGroups.find(group => group.id === 'geometry').facts.find(fact => fact.id === 'geometry-1').value = '72 mm';
  draft = await repo.saveDraft(draft);
  const preview = resolveStudioContent((await repo.createPreview(draft)).content);
  assert.equal(preview.highlights.find(item => item.factId === 'geometry-1').value, '72 mm');
  assert.equal(preview.specGroups[0].facts[0].value, '72 mm');
  assert.equal(resolveStudioContent(before.content).highlights[0].value, '70 mm');
  draft.content.highlights[0].factId = 'missing-fact';
  assert(onlyErrors(validateStudioDraft(draft)).some(issue => issue.path.endsWith('factId')));
});
