import React, { useEffect, useId, useRef, useState } from 'react';
import { ActionGroup, Button, Field, Glyph, Notice, Section, Status } from '../product-room/ui/components.jsx';
import { DrawingReference, DrawingReferenceComparison } from '../product-room/drawing-reference.jsx';
import { projectDrawingContext } from '../product-room/drawing-context.js';
import { createDrawingContext } from '../drawing-preview/context.js';
import { assertDrawingImpactRepository, assertDrawingImpactRoundTrip } from '../product-room/impact-repository.js';
import './project-change-impact.css';

const copy = value => JSON.parse(JSON.stringify(value));
const label = context => context?.drawing?.revisionLabel || context?.drawing?.revision || 'No drawing';
const contextKey = context => context ? JSON.stringify(context) : '';
const decisionLabel = decision => ({ confirmed: 'Use reviewed detail', retained: 'Keep previous reference', omitted: 'Omit from next quotation' })[decision] || 'Needs review';
const classificationLabel = value => ({ changed: 'Source changed', ambiguous: 'Choose a matching detail', missing: 'Detail no longer available', unavailable: 'Source unavailable' })[value] || 'Review required';

/** The renderer stays in the existing drawing reader. This section owns only a reviewed
 * working-reference change; inquiry sources and issued quotation evidence stay immutable. */
export function ProjectChangeImpact({ project, repository, packages, releasesRepository,
  staticReleases = [], resolveEntry, hrefFor, onChanged, onEditing, onWorking, disabled = false }) {
  const prefix = useId();
  const [records, setRecords] = useState([]), [releaseId, setReleaseId] = useState('');
  const [entry, setEntry] = useState(null), [detail, setDetail] = useState('');
  const [editing, setEditing] = useState(false), [proposal, setProposal] = useState(null), [review, setReview] = useState(null);
  const [decisions, setDecisions] = useState({}), [expanded, setExpanded] = useState(null), [note, setNote] = useState('');
  const [confirmed, setConfirmed] = useState(false), [busy, setBusy] = useState(''), [error, setError] = useState(''), [stale, setStale] = useState(false);
  const lease = useRef(null), generation = useRef(0), running = useRef(false);
  const current = projectDrawingContext(project);
  const selected = records.find(record => record.id === releaseId);
  const choices = entry?.package.sheets.flatMap(sheet => sheet.regions.filter(region => region.mappingStatus === 'confirmed').map(region => ({ sheet, region, key: `${sheet.id}:${region.id}` }))) || [];
  const picked = choices.find(choice => choice.key === detail);
  const context = picked ? createDrawingContext({ drawing: entry.package, sheetId: picked.sheet.id, regionId: picked.region.id,
    modelRevision: entry.model.revision, model: entry.model, presentationSnapshot: selected?.presentationSnapshot }) : null;
  const findings = proposal?.findings || [];
  const complete = finding => {
    const item = decisions[finding.id];
    return Boolean(item?.decision && item.reason?.trim() && (item.decision !== 'confirmed' || item.context)
      && (finding.kind !== 'scope' || item.decision === 'omitted' || item.lineIds?.length));
  };
  const reviewedCount = findings.filter(complete).length;
  const revision = project.revision;
  const draftIdentity = JSON.stringify(project.quoteDraft || null);

  useEffect(() => {
    let alive = true;
    releasesRepository.listReleases(project.context.modelId).then(local => {
      if (!alive) return;
      const unique = new Map([...local, ...staticReleases].filter(record => record.productId === project.context.modelId
        && ['demo', 'bundled'].includes(record.source)).map(record => [record.id, record]));
      setRecords([...unique.values()].filter(record => project.impactPolicy || record.sourceRevision !== current.drawing.revision
        || record.mappingRevision !== current.drawing.mappingRevision
        || !record.packageSnapshot.assets.some(asset => asset.id === current.drawing.assetId && asset.sha256 === current.drawing.assetRevision)));
    }).catch(problem => alive && setError(problem.message));
    return () => { alive = false; };
  }, [project.id, revision, releasesRepository]);

  useEffect(() => {
    const turn = ++generation.current;
    lease.current?.dispose?.(); lease.current = null;
    setEntry(null); setDetail(''); setProposal(null); setReview(null); setConfirmed(false); setDecisions({}); setStale(false);
    if (!selected) return;
    setBusy('source');
    resolveEntry(packages.find(item => item.id === selected.productId), selected.packageSnapshot).then(next => {
      if (generation.current !== turn) { next.dispose?.(); return; }
      lease.current = next; setEntry(next);
      const sameDetail = next.package.sheets.flatMap(sheet => sheet.regions.map(region => ({ sheet, region })))
        .find(item => item.region.id === current.drawing.regionId && item.region.mappingStatus === 'confirmed');
      if (sameDetail) setDetail(`${sameDetail.sheet.id}:${sameDetail.region.id}`);
    }).catch(problem => generation.current === turn && setError(problem.message)).finally(() => generation.current === turn && setBusy(''));
    return () => { generation.current++; lease.current?.dispose?.(); lease.current = null; };
  }, [releaseId]);

  useEffect(() => {
    if (!proposal) return;
    if (proposal.projectRevision !== revision || JSON.stringify(proposal.quoteDraft || null) !== draftIdentity) {
      setReview(null); setConfirmed(false); setStale(true);
    }
  }, [revision, draftIdentity]);
  useEffect(() => { onEditing?.(editing || Boolean(busy)); return () => onEditing?.(false); }, [editing, busy]);
  useEffect(() => { onWorking?.(Boolean(busy)); return () => onWorking?.(false); }, [busy]);

  async function run(name, action) {
    if (running.current || busy || disabled) return;
    running.current = true; setBusy(name); setError('');
    try { await action(); } catch (problem) { setError(problem.message); }
    finally { running.current = false; setBusy(''); }
  }
  function close() {
    setEditing(false); setReleaseId(''); setProposal(null); setReview(null); setDecisions({}); setExpanded(null);
    setNote(''); setConfirmed(false); setStale(false); setError('');
  }
  function changeDecision(id, values) {
    setDecisions(previous => ({ ...previous, [id]: { ...previous[id], ...values } }));
    setReview(null); setConfirmed(false);
  }
  async function inspect() {
    assertDrawingImpactRepository(repository);
    const next = await repository.proposeDrawingImpact(project.id, { releaseId, context });
    setProposal(next); setReview(null); setConfirmed(false); setStale(false);
    setExpanded(next.findings[0]?.id || null);
    setDecisions(previous => Object.fromEntries(next.findings.map(finding => {
      const prior = previous[finding.id];
      const valid = prior?.decision !== 'confirmed' || finding.candidates.some(candidate => contextKey(candidate) === contextKey(prior.context));
      return [finding.id, valid ? prior || {} : { reason: prior.reason || '' }];
    })));
  }
  const locked = Boolean(busy) || disabled;
  return <Section className="project-change-impact" title="Drawing change impact"
    description="Check which questions and quotation scope depend on the new drawing. Earlier records retain their original evidence.">
    <DrawingReference context={current} label="Current working drawing" href={hrefFor?.(current)} compact />
    {error && <Notice title="The change was not applied" tone="error">{error} Your pending decisions are kept here.</Notice>}
    {!project.quoteDraft && <p className="drawing-impact-help">Prepare and save the next quotation draft first. Its lines will be available when reviewing affected scope.</p>}
    {!editing ? <ActionGroup align="start"><Button variant="secondary" disabled={disabled || !project.quoteDraft} onClick={() => setEditing(true)}>Check a drawing change</Button></ActionGroup>
      : <div className="drawing-impact-editor">
        {review ? <>
          <h3>Review the drawing change</h3>
          <DrawingReferenceComparison before={proposal.fromContext} after={proposal.context} hrefFor={hrefFor} />
          <ol className="drawing-impact-review-list">{findings.map(finding => {
            const item = decisions[finding.id];
            return <li key={finding.id}><div><strong>{finding.label}</strong><span>{finding.kind === 'question' ? 'Question' : 'Quotation scope'}</span></div>
              <div><strong>{decisionLabel(item.decision)}</strong><span>{item.decision === 'omitted' ? 'Not carried into the next quotation' : label(item.context || finding.fromContext)}</span><p>{item.reason}</p>{finding.kind === 'scope' && item.lineIds?.length > 0 && <p>Quotation lines: {item.lineIds.map(id => proposal.quoteDraft.values.lineItems.find(line => line.id === id)?.label || id).join('; ')}</p>}</div></li>;
          })}</ol>
          <p className="drawing-impact-note">{note}</p>
          <p className="drawing-impact-help">Only the working project and its seller draft change. The original inquiry, question history and issued quotations remain on their saved references.</p>
          <label className="drawing-impact-check"><input type="checkbox" checked={confirmed} disabled={locked} onChange={event => setConfirmed(event.target.checked)} />I checked each affected reference and the decisions above. Apply them to the next quotation draft.</label>
          <ActionGroup><Button variant="quiet" disabled={locked} onClick={() => { setReview(null); setConfirmed(false); }}>Back to impact decisions</Button>
            <Button disabled={!confirmed || locked || stale} pending={busy === 'confirm'} onClick={() => run('confirm', async () => {
              const saved = await repository.confirmDrawingImpact(review, { confirmed: true });
              assertDrawingImpactRoundTrip(review, saved);
              await onChanged(saved); close();
            })}>Confirm drawing impact</Button></ActionGroup>
        </> : <>
          <Field label="Published drawing version"><select value={releaseId} disabled={locked} onChange={event => { setReleaseId(event.target.value); setError(''); }}>
            <option value="">Choose a version to compare</option>{records.map(record => <option key={record.id} value={record.id}>{record.packageSnapshot.revisionLabel || record.sourceRevision} · release {record.version}</option>)}
          </select></Field>
          {!records.length && <p className="drawing-impact-help">No different published version is available. Existing review history remains below.</p>}
          {entry && <Field label="Primary detail for the next quotation" hint="Individual questions and scope may retain a different reference after your review."><select value={detail} disabled={locked || Boolean(proposal)} onChange={event => { setDetail(event.target.value); setReview(null); setConfirmed(false); }}>
            <option value="">Choose a confirmed detail</option>{choices.map(choice => <option key={choice.key} value={choice.key}>{choice.sheet.title} · {choice.region.label}</option>)}
          </select></Field>}
          {!proposal && context && <ActionGroup align="start"><Button variant="secondary" disabled={locked} pending={busy === 'inspect'} onClick={() => run('inspect', inspect)}>Check affected work</Button></ActionGroup>}
          {proposal && <>
            <div className="drawing-impact-count"><strong>{findings.length} affected {findings.length === 1 ? 'record' : 'records'}</strong><span>{reviewedCount} of {findings.length} decisions prepared</span></div>
            <p className="drawing-impact-help">Only work that depends on this drawing is listed. A matching detail name does not confirm that the new reference is suitable.</p>
            {stale && <Notice title="The project changed">Your decisions are kept. Check the latest project and draft again before applying them.<Button variant="quiet" disabled={locked} onClick={() => run('inspect', inspect)}>Recheck affected work</Button></Notice>}
            <ol className="drawing-impact-list">{findings.map((finding, index) => {
              const item = decisions[finding.id] || {}, open = expanded === finding.id;
              const target = item.context || finding.candidateContext;
              const bodyId = `${prefix}-finding-${index}`;
              return <li key={finding.id} data-impact-finding={finding.id}>
                <button type="button" className="drawing-impact-toggle" aria-expanded={open} aria-controls={bodyId} disabled={locked}
                  onClick={() => setExpanded(open ? null : finding.id)}>
                  <span><strong>{finding.label}</strong><small>{finding.kind === 'question' ? 'Question' : 'Quotation scope'} · {classificationLabel(finding.classification)}</small></span>
                  <Status tone={complete(finding) ? 'neutral' : 'warning'}>{complete(finding) ? decisionLabel(item.decision) : 'Needs review'}</Status><Glyph name={open ? 'close' : 'plus'} />
                </button>
                {open && <div className="drawing-impact-body" id={bodyId}>
                  <p className="drawing-impact-reason">{finding.reason}</p>
                  <div className="drawing-impact-reference-pair">
                    <DrawingReference context={finding.fromContext} label="Previous working reference" href={hrefFor?.(finding.fromContext)} compact />
                    {target ? <DrawingReference context={target} label="Candidate reference — not confirmed" href={hrefFor?.(target)} compact />
                      : <p className="drawing-impact-help">No single matching detail is confirmed. Choose a reviewed detail below, or keep the previous reference.</p>}
                  </div>
                  <Field label="Decision for this record"><select value={item.decision || ''} disabled={locked} onChange={event => changeDecision(finding.id, { decision: event.target.value,
                    context: event.target.value === 'confirmed' ? item.context || finding.candidateContext || null : undefined,
                    lineIds: event.target.value === 'omitted' ? [] : item.lineIds || [] })}>
                    <option value="">Choose after inspecting the references</option><option value="confirmed">Use a reviewed detail from the new drawing</option><option value="retained">Keep the previous drawing reference</option>
                    {finding.kind === 'scope' && <option value="omitted">Omit this scope from the next quotation</option>}
                  </select></Field>
                  {item.decision === 'confirmed' && <Field label="Confirmed detail in the new drawing"><select value={contextKey(item.context)} disabled={locked} onChange={event => changeDecision(finding.id, { context: finding.candidates.find(candidate => contextKey(candidate) === event.target.value) || null })}>
                    <option value="">Choose the detail you inspected</option>{finding.candidates.map(candidate => <option key={contextKey(candidate)} value={contextKey(candidate)}>{candidate.drawing.sheetTitle} · {candidate.drawing.regionLabel}</option>)}
                  </select></Field>}
                  {item.decision === 'retained' && <p className="drawing-impact-help">This record will keep {label(finding.fromContext)}. The new quotation will name that retained reference explicitly.</p>}
                  {item.decision === 'omitted' && <p className="drawing-impact-help">This scope remains in the historical inquiry but will not be included in the new quotation’s working references.</p>}
                  {finding.kind === 'scope' && ['confirmed', 'retained'].includes(item.decision) && <fieldset className="drawing-impact-lines" disabled={locked}><legend>Quotation lines covering this scope</legend>
                    <p className="drawing-impact-help">Choose the lines whose scope you checked against this drawing reference.</p>
                    {(proposal.quoteDraft?.values.lineItems || []).map((line, lineIndex) => <label key={line.id} className="drawing-impact-check"><input type="checkbox" checked={item.lineIds?.includes(line.id) || false}
                      onChange={event => changeDecision(finding.id, { lineIds: event.target.checked ? [...(item.lineIds || []), line.id] : item.lineIds.filter(id => id !== line.id) })} /><span>{line.label || `Untitled line ${lineIndex + 1}`}</span></label>)}
                  </fieldset>}
                  <Field label="What did you check?" textarea rows={3} maxLength={2000} value={item.reason || ''} disabled={locked}
                    placeholder="Explain the matching detail, retained version, or omission." onChange={event => changeDecision(finding.id, { reason: event.target.value })} />
                  {complete(finding) && <Button variant="quiet" disabled={locked} onClick={() => { const next = findings.find(other => other.id !== finding.id && !complete(other)); setExpanded(next?.id || null); }}>{findings.some(other => other.id !== finding.id && !complete(other)) ? 'Review next affected record' : 'Finish checking records'}</Button>}
                </div>}
              </li>;
            })}</ol>
            {!findings.length && <p className="drawing-impact-help">No current questions or quotation scope depend on this source. Review the primary reference change below.</p>}
            <Field label="Reason for the project change" textarea rows={3} maxLength={2000} value={note} disabled={locked} onChange={event => { setNote(event.target.value); setReview(null); setConfirmed(false); }} />
          </>}
          <ActionGroup><Button variant="quiet" disabled={locked} onClick={close}>Cancel change review</Button>
            {proposal && <Button disabled={locked || stale || reviewedCount !== findings.length || !note.trim()} pending={busy === 'review'} onClick={() => run('review', async () => {
              const packet = await repository.reviewDrawingImpact(project.id, { releaseId, context: proposal.context, note, projectRevision: proposal.projectRevision, quoteDraft: proposal.quoteDraft,
                decisions: findings.map(finding => ({ id: finding.id, lineIds: [], ...copy(decisions[finding.id]) })) });
              setReview(packet); setConfirmed(false);
            })}>Review drawing impact</Button>}
          </ActionGroup>
        </>}
      </div>}
    {!!project.impactReviews?.length && <details className="customer-disclosure drawing-impact-history"><summary>Drawing impact history<span>{project.impactReviews.length} {project.impactReviews.length === 1 ? 'review' : 'reviews'}</span></summary>
      <ol>{[...project.impactReviews].reverse().map(record => <li key={record.id}><strong>{label(record.review.fromContext)} → {label(record.review.context)}</strong><p>{record.review.note}</p><small>Human reviewed · {new Date(record.createdAt).toLocaleDateString('en-US')}</small>
        {record.review.decisions?.length > 0 && <ul>{record.review.decisions.map(item => <li key={item.id}>{decisionLabel(item.decision)} · {item.reason}</li>)}</ul>}
      </li>)}</ol>
    </details>}
  </Section>;
}
