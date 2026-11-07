import React from 'react';
import { Button, Status } from './ui/components.jsx';
import { SCOPE_DISPOSITIONS } from './option-scope-domain.js';
import { requestItemTitle } from './request-items.js';
import { quoteScopeChoice, quoteScopeReferenceFacts, quoteScopeRow } from './quote-scope-presentation.js';
import './quote-scope-summary.css';

export function QuoteScopeReference({ entry, selection, requestItems = [], children }) {
  const row = quoteScopeRow(entry, selection, requestItems);
  return <details className="ar-quote-scope-reference">
    <summary>Exact reference</summary>
    <dl className="ar-quote-scope-facts">
      {quoteScopeReferenceFacts(entry.context).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      {entry.requestItemId && <div><dt>Original request</dt><dd>{entry.requestItemId}</dd></div>}
      {entry.id === 'preference' && <>
        <div><dt>Option set</dt><dd>{selection.optionSet.title} · Version {selection.optionSet.version}</dd></div>
        <div><dt>Option set ID</dt><dd>{selection.optionSet.id}</dd></div>
        {selection.preference && <>
          <div><dt>Confirmed preference</dt><dd>Version {selection.preference.version}</dd></div>
          <div><dt>Preference ID</dt><dd>{selection.preference.id}</dd></div>
        </>}
      </>}
    </dl>
    {row.relevantRequests.length > 0 && <div className="ar-quote-scope-related"><strong>Related original requests</strong><ul>{row.relevantRequests.map(item => <li key={item.id}>{requestItemTitle(item)}<small>{item.id}</small></li>)}</ul></div>}
    {children}
  </details>;
}

/** Issued and review views use the quote's own scope snapshot, including its original preference. */
export function QuoteScopeSummary({ selection, lineItems = [], project, onExplore, title = 'How your requests are covered' }) {
  if (!selection?.entries?.length) return null;
  const requestItems = project?.inquiry?.requestItems || [];
  return <section className="ar-quote-scope-summary" aria-label={title}>
    <header className="ar-quote-scope-heading"><h3>{title}</h3>
      <p>Preference: <strong>{quoteScopeChoice(selection)}</strong>{selection.preference && <> · Version {selection.preference.version}</>}</p>
    </header>
    <ol className="ar-quote-scope-list">{selection.entries.map(entry => {
      const row = quoteScopeRow(entry, selection, requestItems, lineItems);
      const disposition = SCOPE_DISPOSITIONS.find(item => item.value === entry.disposition)?.label || 'Needs review';
      return <li key={entry.id} data-quote-scope-entry={entry.id}>
        <div className="ar-quote-scope-row"><div><strong>{row.title}</strong><small>{row.kind}</small></div><Status tone={entry.disposition === 'needs-clarification' ? 'warning' : 'neutral'}>{disposition}</Status></div>
        {row.notes && <p className="ar-quote-scope-request">{row.notes}</p>}
        <div className="ar-quote-scope-coverage"><span>Quotation lines</span>{row.lines.length ? <ul>{row.lines.map(line => <li key={line.id} data-missing={!line.available || undefined}>{line.label}<small>{line.id}</small></li>)}</ul> : <p>None linked</p>}</div>
        {entry.rationale && <p className="ar-quote-scope-rationale"><strong>Seller’s explanation</strong>{entry.rationale}</p>}
        <QuoteScopeReference entry={entry} selection={selection} requestItems={requestItems} />
        {onExplore && <Button variant="quiet" onClick={() => onExplore(entry.context, entry)}>View referenced detail</Button>}
      </li>;
    })}</ol>
    <p className="ar-quote-scope-footnote">This scope and preference belong to this quotation version. Later choices do not replace them.</p>
  </section>;
}
