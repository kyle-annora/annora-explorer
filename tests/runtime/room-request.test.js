import test from 'node:test';
import assert from 'node:assert/strict';
import { requestContext, createRequestDraft, updateRequestDraft, removeRequestContext, replaceRequestContext, reviewRequest, editRequest, confirmRequest, requestDraftKey, reopenRequest } from '../../src/product-room/request-state.js';

const context = { productId: 'kinetic-01', productTitle: 'Crank-slider mechanism', modelId: 'kinetic-01', modelRevision: 'r1', part: { id: 'guide', title: 'Linear guide' }, document: { id: 'data', title: 'Sample technical brief' }, chapter: { tourId: 'working-cycle', id: 'motion', title: 'How it works' } };
const receipt = { id: 'DEMO-1234', createdAt: '2026-11-01T12:00:00.000Z' };
const validDraft = () => updateRequestDraft(createRequestDraft(context), { message: ' Could this guide suit our application? ', name: ' Example visitor ', email: 'visitor@example.com' });

test('a request cannot be confirmed before valid details have been reviewed', () => {
  const draft = createRequestDraft(context);
  assert.throws(() => confirmRequest(draft, receipt), /Review/);
  const invalid = reviewRequest(draft);
  assert.equal(invalid.stage, 'draft'); assert.ok(invalid.errors.message);
  assert.throws(() => confirmRequest(invalid, receipt), /Review/);
  const reviewed = reviewRequest(validDraft());
  assert.equal(reviewed.stage, 'review'); assert.equal(reviewed.values.message, 'Could this guide suit our application?');
  const confirmed = confirmRequest(reviewed, receipt);
  assert.equal(confirmed.stage, 'confirmed'); assert.equal(confirmed.receipt.delivery, 'demo-only');
  assert.deepEqual(confirmed.context, reviewed.context);
  assert.deepEqual(confirmed.values, reviewed.values);
});

test('review is immutable until explicit Edit and preserves all entered content', () => {
  const reviewed = reviewRequest(validDraft()), before = JSON.stringify(reviewed);
  assert.throws(() => updateRequestDraft(reviewed, { message: 'Changed' }), /Return to details/);
  assert.throws(() => removeRequestContext(reviewed, 'part'), /draft/);
  const edited = editRequest(reviewed);
  assert.equal(edited.stage, 'draft'); assert.deepEqual(edited.values, reviewed.values);
  const changed = updateRequestDraft(edited, { message: 'Please review this guide instead.' });
  assert.equal(reviewRequest(changed).values.message, 'Please review this guide instead.');
  assert.equal(JSON.stringify(reviewed), before);
});

test('optional contact details are optional but entered invalid values do not pass review', () => {
  const base = updateRequestDraft(createRequestDraft(context), { message: 'Question' });
  assert.equal(reviewRequest(base).stage, 'review');
  for (const email of ['not-an-email', 'a b@example.com', 'name@', 'x'.repeat(255) + '@example.com']) assert.ok(reviewRequest(updateRequestDraft(base, { email })).errors.email);
  assert.ok(reviewRequest(updateRequestDraft(base, { purpose: 'purchase-contract' })).errors.purpose);
  assert.ok(reviewRequest(updateRequestDraft(base, { message: 'a'.repeat(2001) })).errors.message);
});

test('optional context is removable without silently losing product and revision', () => {
  let draft = validDraft();
  for (const key of ['part', 'document', 'chapter']) draft = removeRequestContext(draft, key);
  assert.equal(draft.context.productId, context.productId); assert.equal(draft.context.modelRevision, 'r1');
  assert.equal(draft.context.part, undefined); assert.equal(draft.context.document, undefined); assert.equal(draft.context.chapter, undefined);
  assert.throws(() => removeRequestContext(draft, 'productId'), /optional/);
  assert.deepEqual(validDraft().context, context);
});

test('changing selection requires explicit context replacement and never crosses products or revisions', () => {
  const draft = validDraft(), replacement = { ...context, part: { id: 'crank', title: 'Crank drive' } };
  const changed = replaceRequestContext(draft, replacement);
  assert.deepEqual(changed.values, draft.values); assert.equal(changed.context.part.id, 'crank'); assert.equal(draft.context.part.id, 'guide');
  for (const patch of [{ productId: 'apollo' }, { modelId: 'different' }, { modelRevision: 'r2' }]) assert.throws(() => replaceRequestContext(draft, { ...context, ...patch }), /own draft/);
  assert.notEqual(requestDraftKey(context), requestDraftKey({ ...context, modelRevision: 'r2' }));
});

test('component and chapter attachment cannot invent context without an exact model revision', () => {
  assert.throws(() => requestContext({ ...context, modelRevision: '' }), /exact model revision/);
  assert.throws(() => requestContext({ ...context, chapter: { id: 'motion', title: 'Motion' } }), /tour identity/);
  const generic = requestContext({ productId: 'demo', productTitle: 'Demo product' });
  assert.equal(generic.modelRevision, ''); assert.equal(generic.part, undefined);
  const supplied = structuredClone(context), normalized = requestContext(supplied);
  supplied.part.title = 'Mutated'; assert.equal(normalized.part.title, 'Linear guide');
});

test('confirmation is idempotent and cannot become an editable or repeated submission', () => {
  const confirmed = confirmRequest(reviewRequest(validDraft()), receipt);
  assert.equal(confirmRequest(confirmed, { ...receipt, id: 'DEMO-SECOND' }), confirmed);
  assert.equal(confirmed.receipt.id, receipt.id);
  assert.throws(() => editRequest(confirmed), /reviewed/);
  assert.throws(() => confirmRequest(reviewRequest(validDraft()), { id: 'broken', createdAt: 'yesterday' }), /reference and time/);
});

test('reopening a reviewed request for another selection requires editable context review', () => {
  const reviewed = reviewRequest(validDraft()), nextContext = { ...context, part: { id: 'crank', title: 'Crank drive' } };
  assert.equal(reopenRequest(reviewed, context).stage, 'review');
  const reopened = reopenRequest(reviewed, nextContext);
  assert.equal(reopened.stage, 'draft');
  assert.equal(reopened.context.part.id, 'guide', 'the old message keeps its old context until explicit replacement');
  assert.deepEqual(reopened.values, reviewed.values);
  assert.equal(reviewed.stage, 'review', 'saved snapshot was not mutated');
  assert.throws(() => confirmRequest(reopened, receipt), /Review/);
});

test('new products, revisions and confirmed requests start distinct clean drafts', () => {
  const old = validDraft();
  for (const nextContext of [{ ...context, modelRevision: 'r2' }, { ...context, productId: 'new-product' }]) {
    const next = reopenRequest(old, nextContext);
    assert.equal(next.stage, 'draft'); assert.equal(next.values.message, ''); assert.deepEqual(next.context, nextContext);
  }
  const next = reopenRequest(confirmRequest(reviewRequest(old), receipt), context);
  assert.equal(next.stage, 'draft'); assert.equal(next.receipt, null); assert.equal(next.values.message, '');
  const empty = reopenRequest(createRequestDraft(context), { ...context, part: { id: 'crank', title: 'Crank drive' } });
  assert.equal(empty.context.part.id, 'crank');
});
