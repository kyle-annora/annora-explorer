import test from 'node:test';
import assert from 'node:assert/strict';
import { quoteScopeChoice, quoteScopeReferenceFacts, quoteScopeRow } from '../src/product-room/quote-scope-presentation.js';

const context = { productTitle: 'Crank-slider mechanism', modelId: 'crank', modelRevision: 'model-A', roomSnapshot: { version: 3 }, part: { id: 'guide', title: 'Linear guide' }, drawing: { title: 'Guide drawing', revision: 'drawing-A-hash', revisionLabel: 'A', sheetTitle: 'Sheet 1', regionLabel: 'Mounting holes', mappingRevision: 'mapping-A', presentationRevision: 'overview-1' } };
const request = { id: 'guide-request', purpose: 'quote', context, notes: 'Please review the mounting holes.' };
const selection = { optionSet: { id: 'options', version: 1, options: [{ id: 'focused', title: 'Focused engineering review', requestItemIds: ['guide-request'] }, { id: 'full', title: 'Complete review', requestItemIds: [] }] }, preference: { id: 'preference-1', version: 1, choice: 'option', optionId: 'focused', notes: 'Keep the original hole pattern.' } };

test('quotation choice is projected from its frozen preference, including help and unavailable states', () => {
  assert.equal(quoteScopeChoice(selection), 'Focused engineering review');
  assert.equal(quoteScopeChoice({ ...selection, preference: { ...selection.preference, choice: 'help-me-decide', optionId: null } }), 'Help me decide');
  assert.equal(quoteScopeChoice({ ...selection, preference: null }), 'No preference recorded');
  assert.equal(quoteScopeChoice({ ...selection, preference: { ...selection.preference, optionId: 'removed' } }), 'Unavailable package');
  assert.equal(quoteScopeChoice(selection), 'Focused engineering review');
});

test('one request can display two stable lines and identifies a removed line without relabeling it', () => {
  const entry = { id: 'request:guide-request', requestItemId: request.id, context, lineIds: ['engineering', 'report', 'removed'] };
  const result = quoteScopeRow(entry, selection, [request], [{ id: 'report', label: 'Review report' }, { id: 'engineering', label: 'Engineering time' }]);
  assert.equal(result.title, 'Mounting holes');
  assert.equal(result.notes, request.notes);
  assert.deepEqual(result.lines, [{ id: 'engineering', label: 'Engineering time', available: true }, { id: 'report', label: 'Review report', available: true }, { id: 'removed', label: 'Unavailable quotation line', available: false }]);
});

test('preference row keeps selected package requests and original detail references', () => {
  const entry = { id: 'preference', requestItemId: null, context, lineIds: [] };
  const result = quoteScopeRow(entry, selection, [request]);
  assert.equal(result.title, 'Focused engineering review');
  assert.equal(result.notes, 'Keep the original hole pattern.');
  assert.equal(result.relevantRequests[0].context.drawing.revision, 'drawing-A-hash');
  assert.deepEqual(result.lines, []);
});

test('exact-reference facts include engineering, drawing and overview versions without a latest-context fallback', () => {
  const facts = Object.fromEntries(quoteScopeReferenceFacts(context));
  assert.equal(facts['Component ID'], 'guide');
  assert.equal(facts['Model version'], 'model-A');
  assert.equal(facts['Drawing version'], 'A');
  assert.equal(facts['Drawing revision ID'], 'drawing-A-hash');
  assert.equal(facts['Overview version'], 'overview-1');
  assert.equal(facts['Product version'], 3);
  assert.deepEqual(quoteScopeReferenceFacts(), []);
});
