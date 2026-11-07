import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { compareQuotes } from '../../src/product-room/project-domain.js';
import { quotationComparisonRows } from '../../src/product-room/ui/quotation-comparison.js';

let server, Comparison, QuotationPricing;
before(async () => {
  server = await createServer({
    root: fileURLToPath(new URL('../..', import.meta.url)),
    configFile: false,
    publicDir: false,
    appType: 'custom',
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, watch: null },
  });
  ({ Comparison } = await server.ssrLoadModule('/src/product-room/ui/components.jsx'));
  ({ QuotationPricing } = await server.ssrLoadModule('/src/product-room/ui/quotation-document.jsx'));
});
after(async () => { await server?.close(); });

const quote = (lineItems, values = {}) => ({
  quantity: 20, unitPrice: 185, requestedWeeks: 6, proposedLeadTime: 'After review',
  scope: 'Mechanism', subtotal: 3700, total: null, assumptions: [], lineItems, ...values,
});
const line = (values = {}) => ({ id: 'mechanism', label: 'Mechanism: A × B · allowance', quantity: 20, unitPrice: 185, amount: 3700, ...values });
const render = (rows, props = {}) => renderToStaticMarkup(createElement(Comparison, { rows, ...props }));
const lineRows = (left, right) => quotationComparisonRows(compareQuotes(left, right), left, right).filter(row => row.key.startsWith('line-'));

test('line-item display uses explicit source identity, preserves domain facts, and names the product once', () => {
  const previous = quote([line()]), current = quote([line({ quantity: 30, unitPrice: 175, amount: 5250 })]);
  const source = compareQuotes(previous, current), snapshot = JSON.stringify({ previous, current, source });
  const rows = quotationComparisonRows(source, previous, current);
  const shown = rows.find(row => row.key === 'line-mechanism');
  assert.equal(JSON.stringify({ previous, current, source }), snapshot);
  assert.deepEqual(
    { key: shown.key, label: shown.label, before: shown.before, after: shown.after, changed: shown.changed },
    source.find(row => row.key === 'line-mechanism'),
  );
  assert.strictEqual(rows[0], source[0]);
  const html = render([shown], { changedOnly: true, beforeLabel: 'v1 · previous', afterLabel: 'v2 · current' });
  assert.equal(html.split(line().label).length - 1, 1);
  assert.match(html, /<dt>Quantity<\/dt><dd>20<\/dd>/);
  assert.match(html, /<dt>Unit price<\/dt><dd>\$175\.00<\/dd>/);
  assert.match(html, /<dt>Amount<\/dt><dd>\$5,250\.00<\/dd>/);
  assert.match(html, /data-column="v1 · previous"/);
  assert.match(html, /data-column="v2 · current"/);
  assert.match(html, /class="ar-sr-only"> Changed<\/span>/);
  assert.doesNotMatch(html, /class="ar-change-label"/);
});

test('changed-only line items show the changed facts while the full view retains unchanged values', () => {
  const rows = lineRows(quote([line()]), quote([line({ quantity: 30 })]));
  const changed = render(rows, { changedOnly: true });
  assert.match(changed, /<dt>Quantity<\/dt><dd>30<\/dd>/);
  assert.doesNotMatch(changed, /<dt>Unit price<\/dt>/);
  assert.doesNotMatch(changed, /<dt>Amount<\/dt>/);
  const full = render(rows);
  assert.match(full, /class="ar-change-label"> Changed<\/span>/);
  assert.match(full, /<dt>Unit price<\/dt><dd>\$185\.00<\/dd>/);
  assert.match(full, /<dt>Amount<\/dt><dd>\$3,700\.00<\/dd>/);
});

test('renamed, added and removed lines keep their actual identities and absence semantics', () => {
  const previous = quote([line(), line({ id: 'removed', label: 'Review fee', quantity: 1, amount: null, unitPrice: null })]);
  const current = quote([line({ label: 'Revised mechanism' }), line({ id: 'added', label: 'Tooling', quantity: null, unitPrice: null, amount: null })]);
  const rows = lineRows(previous, current), html = render(rows, { changedOnly: true });
  assert.match(html, /<th scope="row">Line item/);
  assert.match(html, /<dt>Item<\/dt><dd>Mechanism: A × B · allowance<\/dd>/);
  assert.match(html, /<dt>Item<\/dt><dd>Revised mechanism<\/dd>/);
  assert.equal(html.split('Not included').length - 1, 2);
  assert.match(html, /<dt>Quantity<\/dt><dd>To discuss<\/dd>/);
  assert.match(html, /<dt>Unit price<\/dt><dd>Pending review<\/dd>/);
  assert.match(html, /<dt>Amount<\/dt><dd>Pending review<\/dd>/);
  assert.doesNotMatch(html, /\$0\.00/);
});

test('legacy lines without ids use the domain index key and unrelated comparison rows stay untouched', () => {
  const previous = quote([line({ id: undefined })]), current = quote([line({ id: undefined, amount: 3900 })]);
  const source = compareQuotes(previous, current), rows = quotationComparisonRows(source, previous, current);
  assert.equal(rows.find(row => row.key === 'line-line-1').afterDisplay.facts.find(fact => fact.key === 'amount').value, '$3,900.00');
  const unrelated = { key: 'scope-mechanism', label: 'Scope', before: 'Original', after: 'Updated', changed: true };
  assert.strictEqual(quotationComparisonRows([unrelated], previous, current)[0], unrelated);
  assert.strictEqual(quotationComparisonRows(source, null, current), source);
});

test('plain tuple and object comparisons retain fallback values and explicit change flags', () => {
  const html = render([
    ['Quantity', '20 units', '30 units'],
    { label: 'Reference', before: 'First', after: 'Second', changed: false },
    { label: 'Final total', before: null, after: null, changed: false },
  ]);
  assert.equal((html.match(/<tr data-changed="true">/g) || []).length, 1);
  assert.equal((html.match(/To confirm/g) || []).length, 2);
  assert.match(html, /<table role="table">/);
  assert.match(html, /<caption class="ar-sr-only">Version comparison<\/caption>/);
  assert.match(html, /<th scope="col">Previous<\/th>/);
  assert.match(html, /<th scope="row">Reference<\/th>/);
});


test('pricing preserves explicitly unknown and zero amounts; legacy undefined first-line values retain their documented fallback', () => {
  for (const [value, expectedQuantity, expectedPrice] of [[null, 'To confirm', 'To confirm'], [0, '0', '$0.00'], [undefined, '20', '$185.00']]) {
    const data = quote([line({ quantity:value, unitPrice:value, amount:value })]);
    const before = JSON.stringify(data);
    const html = renderToStaticMarkup(createElement(QuotationPricing, { quote:data }));
    assert.ok(html.includes(`<td data-label="Quantity">${expectedQuantity}</td>`));
    assert.ok(html.includes(`<td data-label="Unit price">${expectedPrice}</td>`));
    assert.ok(html.includes(`<td data-label="Amount">${value === 0 ? '$0.00' : 'To confirm'}</td>`));
    assert.equal(JSON.stringify(data), before);
  }
});
