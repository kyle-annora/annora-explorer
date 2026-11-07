const money = value => value == null
  ? 'Pending review'
  : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(value);

const lineKey = (item, index) => `line-${item.id || `line-${index + 1}`}`;
const factsFor = item => ({
  quantity: item ? String(item.quantity ?? 'To discuss') : 'Not included',
  unitPrice: item ? money(item.unitPrice) : 'Not included',
  amount: item ? money(item.amount) : 'Not included',
});

/**
 * Add display cells to domain comparison rows without replacing their facts or
 * change flags. Read line items by the same explicit identity as compareQuotes;
 * labels and the domain's formatted description are never parsed.
 */
export function quotationComparisonRows(rows, before, after) {
  if (!before || !after) return rows;
  const previous = new Map(before.lineItems.map((item, index) => [lineKey(item, index), item]));
  const current = new Map(after.lineItems.map((item, index) => [lineKey(item, index), item]));

  return rows.map(row => {
    const left = previous.get(row.key), right = current.get(row.key);
    if (!left && !right) return row;
    const leftFacts = factsFor(left), rightFacts = factsFor(right);
    const renamed = left && right && left.label !== right.label;
    const fields = [
      ...(renamed ? [{ key: 'name', label: 'Item', before: left.label, after: right.label }] : []),
      ...[['quantity', 'Quantity'], ['unitPrice', 'Unit price'], ['amount', 'Amount']].map(([key, label]) => ({
        key, label, before: leftFacts[key], after: rightFacts[key],
      })),
    ];
    const display = (item, side) => !item ? 'Not included' : {
      kind: 'line-item',
      facts: fields.map(field => ({
        key: field.key,
        label: field.label,
        value: field[side],
        changed: field.before !== field.after,
      })),
    };
    return {
      ...row,
      ...(renamed ? { labelDisplay: 'Line item' } : {}),
      beforeDisplay: display(left, 'before'),
      afterDisplay: display(right, 'after'),
    };
  });
}
