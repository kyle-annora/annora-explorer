import React, { useId, useState } from 'react';
import { Button } from '../product-room/ui/components.jsx';
import { EVIDENCE_EVENT_LABELS } from '../product-room/evidence-domain.js';
import './project-evidence.css';

const MODE_LABELS = {
  demo: 'Demo sample',
  presenter: 'Presenter session',
  ordinary: 'Ordinary local use',
  unknown: 'Mode unknown',
};
const ROLE_LABELS = { buyer: 'Buyer', seller: 'Seller', system: 'System', unknown: 'Role unknown' };
const OBSERVATION_LABELS = {
  'reference.opened': 'Reference opened',
  'reference.requested': 'Saved reference requested',
  'quotation.opened': 'Quotation opened',
  'inquiry.reviewed': 'Inquiry review opened',
};
const SOURCE_LABELS = {
  productId: 'Product', modelId: 'Model', modelRevision: 'Model revision',
  roomReleaseId: 'Product release', partId: 'Part', documentId: 'Document', documentRevision: 'Document revision',
  drawingId: 'Drawing', drawingRevision: 'Drawing revision', drawingAssetId: 'Drawing file',
  drawingAssetRevision: 'Drawing file revision', mappingRevision: 'Association revision',
  overviewRevision: 'Overview revision', sheetId: 'Sheet', regionId: 'Detail region',
};
const timeFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const count = value => Number.isInteger(value) && value >= 0 ? value : null;
const modeLabel = value => MODE_LABELS[value] || MODE_LABELS.unknown;
const roleLabel = value => ROLE_LABELS[value] || ROLE_LABELS.unknown;
function timestamp(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return { label: 'Time unavailable', iso: null };
  return { label: timeFormat.format(new Date(value)), iso: new Date(value).toISOString() };
}
function ActionTime({ value }) {
  const time = timestamp(value);
  return time.iso ? <time dateTime={time.iso}>{time.label}</time> : <span>{time.label}</span>;
}
function Chevron() {
  return <svg className="project-evidence-chevron" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="m5 3 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function EventRow({ event, observation = false }) {
  const labels = observation ? OBSERVATION_LABELS : EVIDENCE_EVENT_LABELS;
  const source = Object.entries(SOURCE_LABELS).filter(([key]) => event.source?.[key] != null);
  const quoteVersion = count(event.record?.quoteVersion);
  return <li className="project-evidence-event">
    <div className="project-evidence-event-main">
      <div className="project-evidence-event-title"><strong>{labels[event.type] || (observation ? 'Recorded viewing action' : 'Saved project action')}</strong><span>{roleLabel(event.role)}</span></div>
      <div className="project-evidence-event-meta">
        {quoteVersion !== null && <span>Quotation v{quoteVersion}</span>}
        <ActionTime value={event.occurredAt} />
        {observation && <span>{modeLabel(event.mode)}</span>}
      </div>
    </div>
    {(source.length > 0 || event.record?.id) && <details className="project-evidence-reference">
      <summary>Record details<Chevron /></summary>
      <dl>
        {event.record?.id && <div><dt>Record</dt><dd>{event.record.id}</dd></div>}
        {event.record?.questionId && <div><dt>Question</dt><dd>{event.record.questionId}</dd></div>}
        {event.record?.quoteId && <div><dt>Quotation</dt><dd>{event.record.quoteId}</dd></div>}
        {source.map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{String(event.source[key])}</dd></div>)}
        <div><dt>Record origin</dt><dd>{modeLabel(event.mode)}</dd></div>
      </dl>
    </details>}
  </li>;
}
function ObservationSection({ observations, loading }) {
  const [shown, setShown] = useState(6);
  const available = observations?.status === 'available';
  const events = available && Array.isArray(observations.events) ? observations.events : [];
  const observedCount = available ? events.length : null;
  const notStarted = observations?.status === 'not-started';
  const stateLabel = loading ? 'Loading' : available ? `${observedCount} available` : notStarted ? 'Not collected yet' : 'Unavailable';
  const modeCounts = events.reduce((result, event) => {
    const mode = Object.hasOwn(MODE_LABELS, event.mode) ? event.mode : 'unknown';
    result[mode] = (result[mode] || 0) + 1;
    return result;
  }, {});
  return <details className="project-evidence-observations">
    <summary><span>Local viewing activity</span><small>{stateLabel}</small><Chevron /></summary>
    <div className="project-evidence-observation-body">
      {loading ? <p role="status">Loading the available viewing activity…</p> : !available ? <p>{notStarted ? 'Viewing activity has not been recorded for this project in this browser. Earlier browsing is unknown.' : 'Viewing activity is unavailable. No visits, reviews or customer interest can be inferred from the saved project records.'}</p> : <>
        <p>This is a partial record of explicit viewing actions in this browser. These observations do not confirm that a customer read, agreed to or purchased anything.</p>
        {Object.keys(modeCounts).length > 0 && <dl className="project-evidence-modes" aria-label="Observation session types">{Object.entries(modeCounts).map(([mode, amount]) => <div key={mode}><dt>{modeLabel(mode)}</dt><dd>{amount} recorded</dd></div>)}</dl>}
        {events.length > 0 ? <ol className="project-evidence-events" aria-label="Local viewing activity records">{events.slice(0, shown).map(event => <EventRow key={event.id} event={event} observation />)}</ol> : <p>No observations are available in this browser. This does not establish that no activity occurred.</p>}
        {events.length > shown && <Button variant="quiet" onClick={() => setShown(value => value + 6)}>Show earlier viewing activity</Button>}
      </>}
      {available && count(observations?.omittedCount) > 0 && <p className="project-evidence-limit">Earlier viewing activity is outside this browser’s retained history.</p>}
      <p className="project-evidence-limit">Total visits: unknown. These browser records do not establish unique customers or a conversion rate.</p>
    </div>
  </details>;
}

/** Read-only projection of persisted facts. Optional observations never drive business state. */
export function ProjectEvidence({ report, observations, loading = false, error = false, onRefresh }) {
  const headingId = useId();
  const [shown, setShown] = useState(8);
  const events = Array.isArray(report?.events) ? report.events : [];
  const last = report?.summary?.lastAction || events[0];
  const questions = count(report?.summary?.questionCount);
  const resolved = count(report?.summary?.resolvedQuestions);
  const quotes = count(report?.summary?.availableDenominators?.issuedQuotations);
  const availableCount = count(report?.counts?.available) ?? events.length;
  const unavailable = error || !report || report.coverage?.history === 'unavailable';
  const partial = report?.coverage?.history === 'partial';
  const mode = modeLabel(report?.mode);
  return <section className="project-evidence" aria-labelledby={headingId}>
    <details className="project-evidence-disclosure">
      <summary>
        <span className="project-evidence-summary-title" id={headingId}>Project activity</span>
        <span className="project-evidence-summary-latest">{loading ? 'Loading available records…' : unavailable ? 'History unavailable' : last ? EVIDENCE_EVENT_LABELS[last.type] || 'Saved project action' : 'No saved actions available'}</span>
        {last && !loading && !unavailable && <span className="project-evidence-summary-time"><ActionTime value={last.occurredAt} /></span>}
        <Chevron />
      </summary>
      <div className="project-evidence-body">
        <div className="project-evidence-context"><p>Browser-local demo records <span>· {mode}</span></p>{onRefresh && <Button variant="quiet" pending={loading} pendingLabel="Refreshing…" onClick={onRefresh}>Refresh activity</Button>}</div>
        {loading && !report ? <p role="status">Loading the available project history…</p> : unavailable ? <p className="project-evidence-unavailable">The saved activity could not be read. Your project actions remain available. {onRefresh ? 'Refresh activity' : 'Reopen the project'} to try again.</p> : <>
          <dl className="project-evidence-facts">
            <div><dt>Questions resolved</dt><dd>{questions === null || resolved === null ? 'Unknown' : `${resolved} of ${questions}`}</dd></div>
            <div><dt>Issued quotations</dt><dd>{quotes === null ? 'Unknown' : quotes}</dd></div>
            <div><dt>Available saved actions</dt><dd>{availableCount}</dd></div>
          </dl>
          <div className="project-evidence-list-heading"><h3>Saved project actions</h3><p>Recorded after a successful save.</p></div>
          {partial && <p className="project-evidence-limit">Some history is unavailable. The list contains only the records that can be verified; totals may be incomplete.</p>}
          {events.length > 0 ? <ol className="project-evidence-events" aria-label="Saved project actions">{events.slice(0, shown).map(event => <EventRow key={event.id} event={event} />)}</ol> : <p>No saved actions are available for this project. Earlier activity is unknown.</p>}
          {events.length > shown && <Button variant="quiet" className="project-evidence-earlier" onClick={() => setShown(value => value + 8)}>Show earlier saved actions</Button>}
          {count(report?.coverage?.omittedCount) > 0 && <p className="project-evidence-limit">{report.coverage.omittedCount} earlier actions are outside this bounded activity view. Original project records are unchanged.</p>}
        </>}
        <ObservationSection observations={observations} loading={loading} />
      </div>
    </details>
  </section>;
}
