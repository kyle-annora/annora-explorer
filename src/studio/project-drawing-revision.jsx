import React, { useEffect, useRef, useState } from 'react';
import { ActionGroup, Button, Field, Notice, Section } from '../product-room/ui/components.jsx';
import { DrawingReference, DrawingReferenceComparison } from '../product-room/drawing-reference.jsx';
import { projectDrawingContext, recordContext } from '../product-room/drawing-revision.js';
import { drawingReferenceKey } from "../product-room/drawing-context.js";
import { createDrawingContext } from '../drawing-preview/context.js';

/** Host-injected catalogs and repositories keep this workflow independent of assets. */
export function ProjectDrawingRevision({ project, repository, packages, releasesRepository,
  staticReleases = [], resolveEntry, hrefFor, onChanged, onEditing, onWorking, disabled = false }) {
  const [records, setRecords] = useState([]), [recordId, setRecordId] = useState('');
  const [entry, setEntry] = useState(null), [detail, setDetail] = useState('');
  const [editing, setEditing] = useState(false), [review, setReview] = useState(null);
  const [note, setNote] = useState(''), [confirmed, setConfirmed] = useState(false), [replaceDraft, setReplaceDraft] = useState(false);
  const [busy, setBusy] = useState(''), [error, setError] = useState('');
  const lease = useRef(null), generation = useRef(0);
  const current = projectDrawingContext(project);
  const comparisonBefore = replaceDraft && project.quoteDraft ? recordContext(project, project.quoteDraft) : current;
  const selected = records.find(record => record.id === recordId);
  const choices = entry?.package.sheets.flatMap(sheet => sheet.regions.filter(region => region.mappingStatus === 'confirmed').map(region => ({ sheet, region, key: `${sheet.id}:${region.id}` }))) || [];
  const picked = choices.find(choice => choice.key === detail);
  const context = picked ? createDrawingContext({ drawing: entry.package, sheetId: picked.sheet.id, regionId: picked.region.id, modelRevision: entry.model.revision, model: entry.model,
    presentationSnapshot: selected?.presentationSnapshot }) : null;
  useEffect(() => {
    let alive = true;
    releasesRepository.listReleases(project.context.modelId).then(local => {
      if (alive) setRecords([...local, ...staticReleases.filter(record => record.productId === project.context.modelId)].filter(record => record.source !== 'preview' && (record.sourceRevision !== current.drawing.revision || record.modelRevision !== current.modelRevision || record.mappingRevision !== current.drawing.mappingRevision || !record.packageSnapshot.assets.some(asset => asset.id === current.drawing.assetId && asset.sha256 === current.drawing.assetRevision) || (project.quoteDraft && drawingReferenceKey(recordContext(project, project.quoteDraft)) !== drawingReferenceKey(current)))));
    }).catch(problem => alive && setError(problem.message));
    return () => { alive = false; };
  }, [project.id, project.revision, releasesRepository, editing]);
  useEffect(() => {
    const turn = ++generation.current;
    lease.current?.dispose?.(); lease.current = null;
    setEntry(null); setDetail(''); setReview(null); setConfirmed(false);
    if (!selected) return;
    setBusy('source');
    resolveEntry(packages.find(item => item.id === selected.productId), selected.packageSnapshot).then(next => {
      if (generation.current !== turn) { next.dispose?.(); return; }
      lease.current = next; setEntry(next);
    }).catch(problem => generation.current === turn && setError(problem.message)).finally(() => generation.current === turn && setBusy(''));
    return () => { generation.current++; lease.current?.dispose?.(); lease.current = null; };
  }, [recordId]);
  useEffect(() => { onEditing?.(editing || Boolean(busy)); return () => onEditing?.(false); }, [editing, busy]);
  useEffect(() => { onWorking?.(Boolean(busy)); return () => onWorking?.(false); }, [busy]);
  async function run(name, operation) {
    if (busy || disabled) return;
    setBusy(name); setError('');
    try { await operation(); } catch (problem) { setError(problem.message); } finally { setBusy(''); }
  }
  const close = () => { setEditing(false); setReview(null); setConfirmed(false); setRecordId(''); setNote(''); setReplaceDraft(false); setError(''); };
  return <Section className="project-drawing-revision" title="Project drawing versions" description="Review a new drawing for the same project. Earlier quotations and discussions keep their original references.">
    <DrawingReference context={current} label="Reference for the next quotation" href={hrefFor(current)} compact />
    {error && <Notice title="Review needed" tone="error">{error}</Notice>}
    {!editing ? <ActionGroup align="start">
      <Button variant="secondary" disabled={disabled} onClick={() => setEditing(true)}>Review a new drawing version</Button>
    </ActionGroup> : review ? <div>
      <h3>Confirm the project reference change.</h3>
      <DrawingReferenceComparison before={comparisonBefore} after={context} hrefFor={hrefFor} />
      <p>{note}</p>
      {project.quoteDraft && <Notice title="Quotation draft">{replaceDraft ? 'The existing seller draft will be replaced with a new draft for this drawing. Issued quotations remain unchanged.' : 'The current seller draft keeps its earlier reference. It cannot be issued until it is explicitly replaced for the current reference.'}</Notice>}
      <label className="drawing-revision-check"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />I reviewed the source version, selected detail and linked part. Use this reference for the next quotation.</label>
      <ActionGroup>
        <Button variant="quiet" disabled={Boolean(busy)} onClick={() => { setReview(null); setConfirmed(false); }}>Back to selection</Button>
        <Button disabled={!confirmed || Boolean(busy) || disabled} pending={busy === 'confirm'} onClick={() => run('confirm', async () => {
          const next = await repository.confirmDrawingRevision(review, { confirmed: true });
          await onChanged(next); close();
        })}>Confirm project drawing</Button>
      </ActionGroup>
    </div> : <div>
      <a className="ar-button" data-variant="quiet" href={`#drawings?product=${encodeURIComponent(project.context.modelId)}`}>Manage drawing files →</a>
      {!records.length && <Notice title="Publish a drawing version first">Open Manage drawing files, import the new PDF, mark and confirm its associations, then review and publish the local release. Return to this project to review its use.</Notice>}
      <Field label="Published drawing version"><select value={recordId} disabled={Boolean(busy)} onChange={event => { setRecordId(event.target.value); setError(''); }}>
        <option value="">Choose a published version</option>{records.map(record => <option key={record.id} value={record.id}>{record.packageSnapshot.revisionLabel || record.sourceRevision} · release {record.version}</option>)}
      </select></Field>
      {entry && <>
        <Field label="Confirmed drawing detail"><select value={detail} onChange={event => setDetail(event.target.value)}><option value="">Choose and review the detail</option>{choices.map(choice => <option key={choice.key} value={choice.key}>{choice.sheet.title} · {choice.region.label}</option>)}</select></Field>
        {context && <DrawingReferenceComparison before={comparisonBefore} after={context} hrefFor={hrefFor} />}
        <Field label="Reason for the drawing change"><textarea rows="3" value={note} maxLength="2000" onChange={event => setNote(event.target.value)} placeholder="Describe what changed and what you checked." /></Field>
        {project.quoteDraft && <label className="drawing-revision-check"><input type="checkbox" checked={replaceDraft} onChange={event => setReplaceDraft(event.target.checked)} />Replace the existing seller draft with a new draft for this drawing. Issued quotations remain unchanged.</label>}
      </>}
      <ActionGroup>
        <Button variant="quiet" onClick={close} disabled={Boolean(busy)}>Cancel</Button>
        <Button disabled={!context || !note.trim() || Boolean(busy) || disabled} pending={busy === 'review'} onClick={() => run('review', async () => {
          setReview(await repository.reviewDrawingRevision(project.id, { context, releaseId: selected.id, note, quoteDraftAction: replaceDraft ? 'replace' : 'keep' }));
        })}>Review project drawing</Button>
      </ActionGroup>
    </div>}
    {!!project.drawingRevisions?.length && <details className="customer-disclosure"><summary>Drawing review history<span>{project.drawingRevisions.length} reviews</span></summary><ol className="drawing-revision-history">{[...project.drawingRevisions].reverse().map(change => <li key={change.id}>
      <h4>{change.fromContext?.drawing?.revision === change.context?.drawing?.revision ? `Association update · ${change.context.drawing.revisionLabel || change.context.drawing.revision}` : `${change.fromContext?.drawing?.revisionLabel || change.fromContext?.drawing?.revision} → ${change.context?.drawing?.revisionLabel || change.context?.drawing?.revision}`}</h4>
      <p>{change.note}</p><small>Human reviewed · {new Date(change.createdAt).toLocaleDateString('en-US')}</small>
    </li>)}</ol></details>}
  </Section>;
}
