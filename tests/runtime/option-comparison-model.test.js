import test from 'node:test';
import assert from 'node:assert/strict';
import { optionComparisonRows, preferenceReceipt } from '../../src/product-room/option-comparison-model.js';

const optionSet = { id: 'packages', version: 1, options: [
  { id: 'motion', title: 'Motion review', facts: [{ label: 'Approach', value: 'Review the motion' }, { label: 'Price', value: 'To discuss' }] },
  { id: 'mounting', title: 'Motion and mounting review', facts: [{ label: 'Approach', value: 'Review the mounting too' }, { label: 'Next step', value: 'Engineering discussion' }] },
] };

test('mobile and desktop comparisons share authored facts and explicit unknown values', () => {
  const rows = optionComparisonRows(optionSet);
  assert.deepEqual(rows.map(row => row.label), ['Approach', 'Price', 'Next step']);
  assert.deepEqual(rows[1].values.map(cell => cell.value), ['To discuss', 'Not specified']);
  assert.deepEqual(rows[2].values.map(cell => cell.value), ['Not specified', 'Engineering discussion']);
  assert.equal(rows[0].values[1].optionTitle, 'Motion and mounting review');
});

test('a preference receipt never substitutes an option from a newer package version', () => {
  const preference = { optionSetId: 'packages', optionSetVersion: 1, choice: 'option', optionId: 'motion' };
  assert.equal(preferenceReceipt(optionSet, preference).title, 'Motion review');
  assert.deepEqual(preferenceReceipt({ ...optionSet, version: 2 }, preference), { title: 'Original package reference unavailable', available: false });
  assert.equal(preferenceReceipt({ ...optionSet, options: optionSet.options.slice(1) }, preference).available, false);
  assert.equal(preferenceReceipt(optionSet, { ...preference, choice: 'help-me-decide', optionId: null }).title, 'Help me decide');
});
