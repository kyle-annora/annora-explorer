import React from "react";
import "./quotation-document.css";

const money = value => value == null ? "To confirm" : new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD", maximumFractionDigits: 2,
}).format(value);

/** Commercial facts only. Issuing, revisions and source references stay with the host. */
export function QuotationMasthead({ quote, requestedScope, children }) {
  return <div className="ar-quotation-masthead">
    <section className="ar-quotation-scope" aria-label="Quoted scope">
      <h2>Quoted scope</h2>
      <p>{quote.scope}</p>
      {requestedScope && <p className="ar-quotation-requested">Requested scope: {requestedScope}.</p>}
      {children}
    </section>
    <dl className="ar-quotation-subtotal">
      <div><dt>Priced subtotal · USD</dt><dd>{money(quote.subtotal)}</dd></div>
      <div><dt>Final total</dt><dd>To confirm</dd></div>
    </dl>
  </div>;
}

export function QuotationPricing({ quote }) {
  return <section className="ar-quotation-pricing" aria-label="Quotation pricing">
    <h3>Pricing</h3>
    <table role="table">
      <caption className="ar-sr-only">Quotation line items in US dollars</caption>
      <thead><tr><th scope="col">Item</th><th scope="col">Quantity</th><th scope="col">Unit price</th><th scope="col">Amount</th></tr></thead>
      <tbody>{quote.lineItems.map((item, index) => <tr key={item.id || index}>
        <th scope="row">{item.label}</th>
        <td data-label="Quantity">{item.quantity !== undefined ? (item.quantity ?? "To confirm") : index === 0 ? (quote.quantity ?? "To confirm") : "To confirm"}</td>
        <td data-label="Unit price">{money(item.unitPrice !== undefined ? item.unitPrice : index === 0 ? quote.unitPrice : null)}</td>
        <td data-label="Amount">{money(item.amount)}</td>
      </tr>)}</tbody>
    </table>
    <p className="ar-quotation-pricing-note">Unpriced items are excluded from the subtotal. Freight, tax and any unpriced engineering work remain to confirm.</p>
  </section>;
}
