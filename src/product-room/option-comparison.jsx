import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { ActionGroup, Button, Field, Notice, Status } from './ui/components.jsx';
import { RequestItemsSummary } from './request-items-view.jsx';
import { requestItemTitle } from './request-items.js';
import { reviewOptionPreference } from './option-scope-domain.js';
import { optionComparisonRows, optionSourceKey, preferenceInput, preferenceReceipt } from './option-comparison-model.js';
import './option-comparison.css';

const date = value => value ? new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value)) : '';
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

export function OptionPreferenceHistory({ optionSet, preferences = [] }) {
  if (!preferences.length) return null;
  return <details className="ar-options-history">
    <summary>Preference history <span>{preferences.length}</span></summary>
    <ol>{[...preferences].reverse().map((preference, index) => {
      const receipt = preferenceReceipt(optionSet, preference);
      return <li key={preference.id}>
        <div><strong>{receipt.title}</strong><small>Preference v{preference.version} · {date(preference.createdAt)}{index === 0 ? ' · Current' : ''}</small></div>
        {preference.notes && <p>{preference.notes}</p>}
        {!receipt.available && <p className="ar-options-error">The original package must be restored to inspect this preference. A newer package has not been substituted.</p>}
        <small>Package version {preference.optionSetVersion} · {preference.id}</small>
      </li>;
    })}</ol>
  </details>;
}

function Source({ optionSet }) {
  return <p className="ar-options-source">{optionSet.context.productTitle}
    {optionSet.context.roomSnapshot?.version && <> · Product version {optionSet.context.roomSnapshot.version}</>}
    {' · '}Package version {optionSet.version}</p>;
}

function RelatedParts({ project, optionSet, onExplore, disabled }) {
  const ids = new Set(optionSet.options.flatMap(option => option.requestItemIds));
  const items = (project.inquiry.requestItems || []).filter(item => ids.has(item.id));
  if (!items.length) return null;
  return <section className="ar-options-parts" aria-label="Referenced parts">
    <h3>Keep the details in view</h3>
    <p>These are the same references saved with your inquiry.</p>
    <ul>{items.map(item => <li key={item.id}>
      <div><strong>{requestItemTitle(item)}</strong><small>{item.notes}</small></div>
      {onExplore && <Button variant="quiet" disabled={disabled} onClick={() => onExplore(item.context)} aria-label={`View ${requestItemTitle(item)} in 3D`} icon="external">View part</Button>}
    </li>)}</ul>
  </section>;
}

/** Selection is local until a full review is explicitly confirmed through the host adapter. */
export function OptionComparison({ project, onConfirmPreference, onExplore, onDirtyChange, onStageChange }) {
  const optionSet = project?.approvedOptionSet, preferences = project?.optionPreferences || [], latest = preferences.at(-1);
  const [stage, setStage] = useState(latest ? 'saved' : 'edit');
  const [input, setInput] = useState(() => preferenceInput(latest));
  const [review, setReview] = useState(null), [error, setError] = useState(null), [busy, setBusy] = useState(false);
  const source = optionSourceKey(project), sourceRef = useRef(source), projectId = useRef(project?.id), saving = useRef(false);
  const root = useRef(null), heading = useRef(null), prefix = useId();
  const dirtyCallback = useRef(onDirtyChange); dirtyCallback.current = onDirtyChange;
  const dirty = stage === 'review' || (stage === 'edit' && !same(input, preferenceInput(latest)));
  useLayoutEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useLayoutEffect(() => { onStageChange?.(stage); }, [stage, onStageChange]);
  useEffect(() => () => dirtyCallback.current?.(false), []);
  useEffect(() => {
    if (!dirty) return;
    const prevent = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', prevent);
    return () => window.removeEventListener('beforeunload', prevent);
  }, [dirty]);
  useEffect(() => {
    if (sourceRef.current === source) return;
    sourceRef.current = source;
    const switchedProject = projectId.current !== project?.id;
    projectId.current = project?.id;
    setReview(null);
    if (!switchedProject && dirty && !saving.current) {
      setStage('edit');
      setError({ message: 'This project changed. Your edits are still here; review them again before confirming.' });
    } else {
      setInput(preferenceInput(latest)); setStage(latest ? 'saved' : 'edit'); setError(null);
    }
  }, [source]);
  if (!optionSet) return null;
  const receipt = preferenceReceipt(optionSet, latest), rows = optionComparisonRows(optionSet);
  const focusHeading = () => requestAnimationFrame(() => heading.current?.focus());
  const edit = () => { setStage('edit'); setReview(null); setError(null); focusHeading(); };
  const cancel = () => { setInput(preferenceInput(latest)); setStage(latest ? 'saved' : 'edit'); setReview(null); setError(null); focusHeading(); };
  const update = values => { setInput(current => ({ ...current, ...values })); setReview(null); setError(null); };
  function prepare(event) {
    event.preventDefault();
    if (busy) return;
    try {
      setReview(reviewOptionPreference(project, input)); setStage('review'); setError(null); focusHeading();
    } catch (nextError) {
      setError(nextError);
      requestAnimationFrame(() => root.current?.querySelector('[data-options-error]')?.focus());
    }
  }
  async function confirm() {
    if (!review || busy || saving.current || !onConfirmPreference) return;
    saving.current = true; setBusy(true); setError(null);
    try {
      await onConfirmPreference(review);
      setStage('saved'); setReview(null); focusHeading();
    } catch (nextError) {
      setError(nextError);
      requestAnimationFrame(() => root.current?.querySelector('[data-options-error]')?.focus());
    } finally { saving.current = false; setBusy(false); }
  }
  const reviewedTitle = review ? preferenceReceipt(optionSet, review).title : '';
  return <section ref={root} className="ar-options" data-option-stage={stage} aria-labelledby={`${prefix}-heading`}>
    <header className="ar-options-heading">
      <div><h2 id={`${prefix}-heading`} ref={heading} tabIndex={-1}>{stage === 'saved' ? 'Current preference' : stage === 'review' ? 'Review your preference' : optionSet.title}</h2>
        <p>{stage === 'saved' ? 'The seller can use this preference to prepare a clear scope.' : stage === 'review' ? 'Confirm this choice and the original details it refers to.' : 'Compare two approaches, then tell the seller what fits your project.'}</p>
      </div>
      {stage === 'saved' && <Status tone="complete">Preference confirmed</Status>}
      {stage === 'review' && <Button variant="quiet" disabled={busy} onClick={cancel} aria-label="Cancel preference changes">Cancel</Button>}
    </header>
    {error && <Notice kind="error" title="Preference needs attention" tabIndex={-1} data-options-error>{error.message || 'The preference could not be saved. Please try again.'}</Notice>}
    {stage === 'saved' ? <>
      <div className="ar-options-receipt"><div><h3>{receipt.title}</h3><p>Preference v{latest?.version} · {date(latest?.createdAt)}</p>{latest?.notes && <p className="ar-options-note">{latest.notes}</p>}</div>
        <Button variant="secondary" onClick={edit}>Change preference</Button></div>
      <p className="ar-options-footnote">A preference informs the seller. It does not place an order or change an issued quotation.</p>
      <OptionPreferenceHistory optionSet={optionSet} preferences={preferences} />
    </> : stage === 'review' && review ? <>
      <Source optionSet={optionSet} />
      <div className="ar-options-review-choice"><span>Your choice</span><h3>{reviewedTitle}</h3>
        {review.choice === 'option' && <p>{optionSet.options.find(option => option.id === review.optionId)?.description}</p>}
        {review.choice === 'help-me-decide' && <p>The seller will help you choose an approach; neither package is selected.</p>}
        {review.notes && <div className="ar-options-review-note"><strong>Your note</strong><p>{review.notes}</p></div>}
      </div>
      <RequestItemsSummary items={project.inquiry.requestItems || []} onOpen={onExplore} title="Original inquiry details" />
      <p className="ar-options-footnote">{latest ? 'This creates a new preference. Earlier preferences, your original inquiry and issued quotations stay unchanged.' : 'Your original inquiry stays unchanged. The seller reviews requested scope before issuing a quotation.'}</p>
      <div className="ar-options-footer"><p>{optionSet.disclaimer}</p><ActionGroup>
        <Button variant="quiet" disabled={busy} onClick={edit}>Edit preference</Button>
        <Button pending={busy} pendingLabel="Confirming…" disabled={!onConfirmPreference} onClick={confirm} icon="arrow">Confirm preference</Button>
      </ActionGroup></div>
    </> : <form onSubmit={prepare}>
      <Source optionSet={optionSet} />
      <fieldset className="ar-options-choices" aria-describedby={`${prefix}-disclaimer`} disabled={busy}>
        <legend className="ar-options-visually-hidden">Preferred approach</legend>
        <div className="ar-options-choice-grid">{optionSet.options.map(option => <label key={option.id} className="ar-options-choice" data-selected={input.choice === 'option' && input.optionId === option.id} data-unavailable={option.status !== 'available'}>
          <input type="radio" name={`${prefix}-choice`} value={option.id} checked={input.choice === 'option' && input.optionId === option.id} disabled={option.status !== 'available'}
            onChange={() => update({ choice: 'option', optionId: option.id })} />
          <span><strong>{option.title}</strong><span>{option.description}</span>{option.status !== 'available' && <small>Currently unavailable</small>}</span>
        </label>)}</div>
        <table className="ar-options-differences"><caption className="ar-options-visually-hidden">Package differences</caption>
          <thead><tr><th scope="col">Compare</th>{optionSet.options.map(option => <th key={option.id} scope="col">{option.title}</th>)}</tr></thead>
          <tbody>{rows.map(row => {
            const shared = row.values.every(value => value.value === row.values[0].value);
            return <tr key={row.label}><th scope="row">{row.label}</th>{shared
              ? <td colSpan={optionSet.options.length}><span className="ar-options-mobile-label" aria-hidden="true">Both packages</span><span>{row.values[0].value}</span></td>
              : row.values.map(value => <td key={value.optionId} data-selected={input.choice === 'option' && input.optionId === value.optionId}>
                <span className="ar-options-mobile-label" aria-hidden="true">{value.optionTitle}</span><span>{value.value}</span>
              </td>)}</tr>;
          })}</tbody>
        </table>
        <label className="ar-options-undecided" data-selected={input.choice === 'help-me-decide'}><input type="radio" name={`${prefix}-choice`} value="help-me-decide" checked={input.choice === 'help-me-decide'} onChange={() => update({ choice: 'help-me-decide', optionId: null })} />
          <span><strong>Help me decide</strong><small>Ask the seller to recommend an approach.</small></span>
        </label>
      </fieldset>
      {(error?.fields?.choice || error?.fields?.optionId) && <p className="ar-options-error" role="alert">{error.fields.choice || error.fields.optionId}</p>}
      <RelatedParts project={project} optionSet={optionSet} onExplore={onExplore} disabled={busy} />
      <Field className="ar-options-notes-field" label="What matters most to you?" optional textarea rows={2} maxLength={2000} value={input.notes} disabled={busy}
        hint="Add a priority or question for the seller." error={error?.fields?.notes} onChange={event => update({ notes: event.target.value })} />
      <div className="ar-options-footer"><p id={`${prefix}-disclaimer`}>{optionSet.disclaimer}</p><ActionGroup>
        {(latest || dirty) && <Button variant="quiet" disabled={busy} onClick={cancel}>{latest ? 'Keep saved preference' : 'Cancel preference'}</Button>}
        <Button type="submit" disabled={busy} icon="arrow">Review preference</Button>
      </ActionGroup></div>
      <OptionPreferenceHistory optionSet={optionSet} preferences={preferences} />
    </form>}
  </section>;
}
