import React from 'react';
import { Button, Status } from './ui/components.jsx';
import { DrawingReference } from './drawing-reference.jsx';
import { impactReferenceRows } from './impact-scope-presentation.js';
import './impact-scope-summary.css';

/** Render only the evidence frozen into this quotation, never the latest project. */
export function ImpactScopeSummary({ snapshot, lineItems = [], onExplore, title = 'Reviewed drawing references' }) {
  const rows = impactReferenceRows(snapshot, lineItems);
  if (!rows.length) return null;
  return <section className="ar-impact-summary" aria-label={title} data-impact-snapshot={snapshot.reviewId}>
    <h3>{title}</h3>
    <p className="ar-impact-summary-intro">Each item keeps its own reviewed reference. Earlier quotations and original discussions keep their saved versions.</p>
    <ul>{rows.map(row => <li key={row.id} data-impact-reference={row.id}>
      <div className="ar-impact-summary-row"><div><strong>{row.label}</strong><span>{row.kindLabel} · {row.versionLabel}</span></div>
        <Status tone="neutral">{row.decisionLabel}</Status></div>
      <p className="ar-impact-summary-reason">{row.reason}</p>
      {row.kind === 'scope' && <p className="ar-impact-summary-lines"><span>Quotation scope</span>{row.lines.length ? row.lines.map(line => line.label).join(' · ') : 'Not included in this quotation'}</p>}
      <details className="ar-impact-reference-details"><summary>Review decision and exact drawing</summary>
        <dl><div><dt>Reviewed by</dt><dd>Seller · Project revision {row.reviewedProjectRevision}</dd></div>
          <div><dt>Review reference</dt><dd>{row.reviewId}</dd></div></dl>
        <DrawingReference context={row.originalContext} label="Original request reference" compact />
        {row.context && <DrawingReference context={row.context} label="Reference used by this quotation" compact />}
        {onExplore && row.context && <Button variant="quiet" onClick={() => onExplore(row.context, { id: row.id, requestItemId: row.kind === 'scope' ? row.recordId : undefined })}>View part in 3D</Button>}
      </details>
    </li>)}</ul>
  </section>;
}
