import test from 'node:test';
import assert from 'node:assert/strict';
import { projectQuestionSourceKey, projectQuestionSummary, questionQuoteLinks, questionTimeline } from '../../src/product-room/project-questions-model.js';

const question = { id: 'q-guide', requestItemId: 'guide', scopeEntryId: 'request:guide', body: 'Does the mounting need review?', blocking: true, createdAt: '2026-11-06T12:00:00Z', events: [{ id: 'open', kind: 'opened', authorRole: 'buyer', body: 'Does the mounting need review?', createdAt: '2026-11-06T12:00:00Z' }] };
const answered = { ...question, events: [...question.events, { id: 'answer', kind: 'answer', authorRole: 'seller', body: 'Review is included.' }] };
const resolved = { ...answered, events: [...answered.events, { id: 'resolve', kind: 'resolved', authorRole: 'seller', body: 'Reviewed with the customer.' }] };
const quote = { id: 'qt-1', version: 1, questionScope: { questions: [resolved] }, scopeSelection: { entries: [{ id: 'request:guide', requestItemId: 'guide', disposition: 'included', lineIds: ['review', 'removed'], rationale: 'Mounting review included.' }] }, lineItems: [{ id: 'review', label: 'Original engineering review' }] };

test('answered questions remain blockers until an explicit resolution, and informational questions do not block', () => {
  assert.deepEqual(projectQuestionSummary([answered, { ...question, id: 'q-info', blocking: false }]), { total: 2, unresolved: 2, blocking: 1 });
  assert.deepEqual(projectQuestionSummary([resolved]), { total: 1, unresolved: 0, blocking: 0 });
  assert.deepEqual(projectQuestionSummary(), { total: 0, unresolved: 0, blocking: 0 });
});

test('quotation links require that exact question in issued evidence, even when an older quote covers the same detail', () => {
  const older = { ...quote, id: 'old', questionScope: undefined };
  const unrelated = { ...quote, id: 'other', questionScope: { questions: [{ ...resolved, id: 'another-question' }] } };
  assert.deepEqual(questionQuoteLinks({ quotes: [older, unrelated, quote] }, question), [{ quoteId: 'qt-1', quoteVersion: 1, questionStatus: 'resolved', disposition: 'included', rationale: 'Mounting review included.', lines: [{ id: 'review', label: 'Original engineering review' }, { id: 'removed', label: 'Unavailable quotation line' }] }]);
});

test('reopening a question does not rewrite an earlier quotation’s resolved evidence or use newer line labels', () => {
  const reopened = { ...resolved, events: [...resolved.events, { id: 'reopen', kind: 'reopened' }] };
  const revised = { ...quote, id: 'qt-2', version: 2, lineItems: [{ id: 'review', label: 'Revised review and report' }] };
  const links = questionQuoteLinks({ quotes: [quote, revised] }, reopened);
  assert.equal(links[0].questionStatus, 'resolved');
  assert.equal(links[0].lines[0].label, 'Original engineering review');
  assert.equal(links[1].lines[0].label, 'Revised review and report');
});

test('a question-only quotation still displays reviewed evidence without inventing scope lines', () => {
  const links = questionQuoteLinks({ quotes: [{ ...quote, scopeSelection: undefined }] }, question);
  assert.equal(links[0].disposition, null);
  assert.deepEqual(links[0].lines, []);
});

test('the timeline preserves ordered reply history and displays the opening text exactly once', () => {
  assert.deepEqual(questionTimeline(answered), answered.events);
  const fallback = questionTimeline({ ...question, events: answered.events.slice(1) });
  assert.equal(fallback.length, 2);
  assert.equal(fallback[0].body, question.body);
  assert.equal(fallback[1].kind, 'answer');
});

test('review sources invalidate on a project revision, a changed reference, or changed question evidence', () => {
  const project = { id: 'project', revision: 2, inquiry: { requestItems: [{ id: 'guide', context: { modelRevision: 'A' } }] }, questions: [question], quotes: [] };
  const source = projectQuestionSourceKey(project);
  assert.notEqual(projectQuestionSourceKey({ ...project, revision: 3 }), source);
  assert.notEqual(projectQuestionSourceKey({ ...project, questions: [answered] }), source);
  assert.notEqual(projectQuestionSourceKey({ ...project, inquiry: { requestItems: [{ id: 'guide', context: { modelRevision: 'B' } }] } }), source);
  assert.equal(projectQuestionSourceKey(structuredClone(project)), source);
});
