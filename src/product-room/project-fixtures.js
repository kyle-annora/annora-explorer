/** Invented commercial illustration. Not a manufacturer offer or a pricing engine. */
export const SAMPLE_PRODUCT_ID = 'kinetic-01';
export function sampleInquiryValues(context) {
  if (context?.drawing) return {
    intent: 'quotation',
    name: 'Alex Morgan', email: 'alex@example.com', company: 'Example Engineering Co.',
    application: `Please review ${context.drawing.regionLabel.toLowerCase()} on ${context.productTitle}. The selected part and drawing revision are attached for reference.`,
    quantity: '20', targetWeeks: '6', stroke: '', load: '',
    notes: 'Please confirm the required dimensions, tolerances and material before preparing a quotation. Viewed geometry is reference context only.',
  };
  return {
    intent: 'quotation',
    name: 'Alex Morgan', email: 'alex@example.com', company: 'Example Automation Co.',
    application: 'Explore a crank-slider mechanism for a compact inspection fixture. We need to understand the guide arrangement and mounting interfaces.',
    quantity: '20', targetWeeks: '6', stroke: '70', load: 'To discuss after reviewing the fixture layout',
    notes: 'Please review load, cycle rate and mounting before confirming suitability.'
  };
}

const noteIdentity = value => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return `customer-note-${(hash >>> 0).toString(16)}`;
};
const openItems = (values, additionalQuestions = []) => [
  { id: 'load-cycle', label: 'Confirm application load and required cycle rate.', owner: 'Customer / engineering', status: 'Open' },
  { id: 'mounting', label: 'Review mounting interfaces, tolerances and application fit.', owner: 'Engineering', status: 'Open' },
  { id: 'timing', label: 'Confirm achievable lead time after technical review.', owner: 'Sales', status: 'Open' },
  { id: 'shipping', label: 'Confirm freight, tax and any application-specific work.', owner: 'Sales / customer', status: 'Unpriced' },
  ...[...new Set([values.notes, ...additionalQuestions].filter(Boolean))].map(note => ({ id: noteIdentity(note), label: note, owner: 'Sales / engineering', status: 'Unanswered' }))
];

export function sampleQuote({ id, version, createdAt, values, previousQuoteId = null, changeId = null, replyId = null, additionalQuestions = [] }) {
  const quantity = Number(values.quantity), unitPrice = quantity >= 30 ? 175 : 185;
  const lineItems = [
    { label: 'Illustrative crank-slider assembly', quantity, unitPrice, amount: quantity * unitPrice },
    { label: 'Example setup allowance', quantity: 1, unitPrice: 250, amount: 250 },
    { label: 'Freight and applicable tax', quantity: null, unitPrice: null, amount: null },
    { label: 'Application-specific engineering', quantity: null, unitPrice: null, amount: null }
  ];
  return {
    id, version, createdAt, quantity, unitPrice, currency: 'USD', lineItems,
    subtotal: quantity * unitPrice + 250, total: null,
    requestedWeeks: values.targetWeeks ? Number(values.targetWeeks) : null,
    proposedLeadTime: '6–8 weeks after technical review',
    scope: 'Illustrative crank-slider assembly; application-specific work is not priced.',
    assumptions: [
      'Invented example prices: $185 per unit, or $175 at 30 units or more, plus a $250 setup allowance.',
      'This mechanism study is not a manufactured product offer. Geometry and visual finishes do not establish application suitability.',
      'Requested timing is not approved. Freight, tax and application-specific engineering remain unpriced.'
    ],
    openItems: openItems(values, additionalQuestions), source: 'sample', previousQuoteId, changeId, replyId
  };
}

export function sampleSupplierReply({ id, createdAt, change, quote, inquiry }) {
  const quantity = Number(change.values.quantity), unitPrice = quantity >= 30 ? 175 : 185;
  const topics = [
    { label: 'Quantity and sample price', requested: `${quantity} units`, response: `${quantity} units at $${unitPrice.toFixed(2)} each in the revised example. This is an invented allowance, not a supplier offer.`, status: 'Included in example' },
    { label: 'Delivery timing', requested: change.values.targetWeeks ? `${change.values.targetWeeks} weeks` : 'To discuss', response: 'Planning alternative: 6–8 weeks after technical review. Requested timing and expedite availability are not confirmed.', status: 'Alternative proposed' },
    ...(change.values.notes ? [{ label: 'Your question', requested: change.values.notes, response: 'Preserved for sales and engineering review. The demonstration does not answer free-text questions.', status: 'Unanswered' }] : [])
  ];
  return { id, changeId: change.id, quoteId: quote.id, quoteVersion: quote.version, createdAt, topics, openItems: openItems(inquiry.values, [change.values.notes]), source: 'sample' };
}
