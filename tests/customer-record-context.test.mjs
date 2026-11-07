import test from 'node:test';
import assert from 'node:assert/strict';
import { customerRecordContext } from '../src/studio/customer-record-context.js';

const original = { productTitle: 'SK08', drawing: { revision: 'A' } };
const revised = { productTitle: 'SK08', drawing: { revision: 'B' } };
const active = { productTitle: 'SK08', drawing: { revision: 'C' } };
const quoteV1 = { id: 'q1', version: 1, context: original };
const quoteV2 = { id: 'q2', version: 2, context: revised };
const project = {
  context: original, activeDrawingContext: active,
  quotes: [quoteV1, quoteV2],
  changes: [
    { id: 'change-v1', quoteId: 'q1', quoteVersion: 1, context: original },
    { id: 'change-v2', quoteId: 'q2', quoteVersion: 2, context: revised },
  ],
  nextSteps: [
    { id: 'next-v1', quoteId: 'q1', quoteVersion: 1, context: original },
    { id: 'next-v2', quoteId: 'q2', quoteVersion: 2, context: revised },
  ],
};
// Every response scenario starts with the historical v1 selector still selected.
const view = { project, tab: 'quotation', quote: quoteV1 };

test('historical quotation detail keeps its own reference', () => {
  const result = customerRecordContext({ ...view, mode: 'detail' });
  assert.equal(result.context, original);
  assert.equal(result.label, 'Quotation v1');
});

test('quotation editing uses the draft, while review uses the sealed draft', () => {
  const draft = { context: active };
  assert.equal(customerRecordContext({ ...view, mode: 'edit', draft }).context, active);
  const result = customerRecordContext({ ...view, mode: 'quote-review', draft, review: { draft: { context: revised } } });
  assert.equal(result.context, revised);
  assert.equal(result.label, 'Quotation v3 · Review');
});

test('response to v2 changes never inherits the selected historical v1', () => {
  const result = customerRecordContext({ ...view, mode: 'reply', response: { kind: 'change-response', changeId: 'change-v2' } });
  assert.equal(result.context, revised);
  assert.equal(result.label, 'Change response · Quotation v2 · Draft');
});

test('reviewed response uses its sealed request identity rather than mutable editing state', () => {
  const result = customerRecordContext({ ...view, mode: 'reply-review',
    response: { kind: 'change-response', changeId: 'change-v1' },
    review: { values: { kind: 'change-response', changeId: 'change-v2' } } });
  assert.equal(result.context, revised);
  assert.equal(result.label, 'Change response · Quotation v2 · Review');
});

test('next-step preparation and review stay tied to the requested v2', () => {
  const preparing = customerRecordContext({ ...view, mode: 'ack', response: { nextStepId: 'next-v2' } });
  assert.equal(preparing.context, revised);
  assert.equal(preparing.label, 'Next-step confirmation · Quotation v2 · Draft');
  const reviewing = customerRecordContext({ ...view, mode: 'ack-review',
    response: { nextStepId: 'next-v1' }, review: { nextStepId: 'next-v2' } });
  assert.equal(reviewing.context, revised);
  assert.equal(reviewing.label, 'Next-step confirmation · Quotation v2 · Review');
});

test('unlinked replies use the active reference, matching persisted message context', () => {
  const result = customerRecordContext({ ...view, mode: 'reply', response: { kind: 'clarification', changeId: null } });
  assert.equal(result.context, active);
  assert.equal(result.label, 'Clarification · Draft');
});
