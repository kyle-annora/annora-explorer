import React, { useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Button, Field, Glyph, Notice } from '../product-room/ui/components.jsx';
import { DrawingPreview } from '../drawings/DrawingPreview.jsx';
import { StudioModelStage } from './model-stage.jsx';
import { UnsavedDialog } from './ui.jsx';
import { onboardingDrawingParts, validateOnboardingDraft } from './onboarding-domain.js';
import { createOnboardingRepository } from './onboarding-repository.js';
import './onboarding-workspace.css';

const STAGES = [
  { id: 'sources', title: 'Check sources' },
  { id: 'associations', title: 'Link details' },
  { id: 'preview', title: 'Preview' },
  { id: 'review', title: 'Review' },
];
const clone = value => JSON.parse(JSON.stringify(value));
const regionKey = (sheetId, regionId) => `${sheetId}:${regionId}`;
const regionsFor = pkg => (pkg?.sheets || []).flatMap(sheet => sheet.regions.map(region => ({ sheet, region, key: regionKey(sheet.id, region.id) })));
const defaultFactory = candidate => createOnboardingRepository({ candidate });
const titleFor = candidate => candidate.bundledRelease?.content?.title || candidate.model?.title || candidate.id;
const formatDate = value => value ? new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '';

/** Attach only the exact prepared files for reading. Portable snapshots never store build URLs. */
function readablePackage(pkg, candidate) {
  if (!pkg) return null;
  return { ...pkg, assets: pkg.assets.map(asset => {
    const prepared = candidate.assets.find(item => item.id === asset.id && item.sha256 === asset.sha256);
    return { ...asset, ...(prepared?.url ? { url: prepared.url } : {}) };
  }) };
}

function saveFile(packet) {
  const fileName = `${packet.productId}-reviewed-package.json`;
  const url = URL.createObjectURL(new Blob([`${JSON.stringify(packet, null, 2)}\n`], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url; link.download = fileName; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return fileName;
}

function SourceFiles({ candidate }) {
  return <div className="onboard-source-files">
    <h3>Prepared files</h3>
    <ul>{candidate.assets.map(asset => <li key={asset.id}>
      <Glyph name="document" />
      <div><strong>{asset.title || asset.fileName}</strong><span>{asset.type} · {asset.revision}</span></div>
      {asset.url && <a href={asset.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${asset.title || asset.fileName}`}>Open <Glyph name="external" /></a>}
    </li>)}</ul>
    <details className="onboard-file-identities"><summary>File identities</summary>
      <p>These recorded identities keep the model and original drawing attached to this exact source.</p>
      <dl>{candidate.assets.map(asset => <React.Fragment key={asset.id}><dt>{asset.fileName}</dt><dd>{asset.sha256 || `Revision ${asset.revision}`}</dd></React.Fragment>)}</dl>
    </details>
  </div>;
}

function SourceChecks({ candidate, draft, onChange, issues, disabled }) {
  const errorFor = path => issues.find(issue => issue.path === path && issue.severity === 'error')?.message;
  return <div className="onboard-source-layout">
    <section className="onboard-product-fields" aria-labelledby="onboard-product-title">
      <h2 id="onboard-product-title">Product information</h2>
      <p className="onboard-muted">Start with the prepared product. Update the names buyers will see.</p>
      <Field label="Product title" value={draft.content.title} disabled={disabled} error={errorFor('content.title')} onChange={event => onChange({ content: { ...draft.content, title: event.target.value } })} />
      <Field label="Short title" value={draft.content.shortTitle} disabled={disabled} error={errorFor('content.shortTitle')} onChange={event => onChange({ content: { ...draft.content, shortTitle: event.target.value } })} />
      <Field label="Summary" textarea rows={3} value={draft.content.summary} disabled={disabled} error={errorFor('content.summary')} onChange={event => onChange({ content: { ...draft.content, summary: event.target.value } })} />
      <SourceFiles candidate={candidate} />
    </section>
    <section className="onboard-source-review" aria-labelledby="onboard-source-title">
      <h2 id="onboard-source-title">Source & units</h2>
      <dl className="onboard-facts">
        <dt>Source</dt><dd>{candidate.source.author}<a href={candidate.source.url} target="_blank" rel="noopener noreferrer">View source <Glyph name="external" /></a></dd>
        <dt>License</dt><dd>{candidate.source.license}</dd>
        <dt>Source units</dt><dd>{candidate.units.source}</dd>
        <dt>Viewer units</dt><dd>{candidate.units.display}</dd>
        <dt>Model version</dt><dd>{candidate.model.revision}</dd>
        {draft.drawingPackage && <><dt>Drawing version</dt><dd>{draft.drawingPackage.revisionLabel || draft.drawingPackage.revision}</dd></>}
      </dl>
      <p className="onboard-evidence">{candidate.units.evidence}</p>
      {(candidate.source.note || candidate.source.description) && <p className="onboard-muted">{candidate.source.note || candidate.source.description}</p>}
      <div className="onboard-checks">
        <label className="onboard-check"><input type="checkbox" checked={draft.checks.source} disabled={disabled} onChange={event => onChange({ checks: { ...draft.checks, source: event.target.checked } })} /><span>I checked the source, license and prepared files.</span></label>
        <label className="onboard-check"><input type="checkbox" checked={draft.checks.units} disabled={disabled} onChange={event => onChange({ checks: { ...draft.checks, units: event.target.checked } })} /><span>I checked the source units and the conversion shown above.</span></label>
      </div>
      <p className="onboard-footnote">This setup uses prepared assets. New CAD files are prepared and checked before they appear here.</p>
    </section>
  </div>;
}

function AssociationList({ candidate, entries, active, inspectedPart, onChoose, onMap, onConfirm, disabled }) {
  const drawingParts = onboardingDrawingParts(candidate);
  const canLink = id => drawingParts.some(part => part.id === id);
  const confirmed = entries.filter(item => item.region.mappingStatus === 'confirmed' && canLink(item.region.partId)).length;
  return <section className="onboard-associations" aria-labelledby="onboard-association-title">
    <div className="onboard-section-heading"><h2 id="onboard-association-title">Link drawing details</h2><span>{confirmed} of {entries.length} confirmed</span></div>
    <p className="onboard-muted">Check each marked detail against the model, then confirm its part.</p>
    <div className="onboard-mappings">{entries.map(item => {
      const selected = active?.key === item.key, eligible = canLink(item.region.partId);
      const confirmed = item.region.mappingStatus === 'confirmed' && eligible;
      return <div key={item.key} className="onboard-mapping" data-active={selected} data-confirmed={confirmed}>
        <button type="button" className="onboard-mapping-select" aria-expanded={selected} aria-controls={`onboard-map-${item.key}`} disabled={disabled} onClick={() => onChoose(item.key)}>
          <span><strong>{item.region.label}</strong><small>{item.sheet.title}</small></span>
          <span className="onboard-link-state">{confirmed ? <><Glyph name="check" /><span>Confirmed</span></> : 'Review link'}</span>
        </button>
        {selected && <div id={`onboard-map-${item.key}`} className="onboard-mapping-edit">
          <Field label="Linked model part" value={item.region.partId || ''} disabled={disabled} error={item.region.partId && !eligible ? 'Choose an individual model part. Assembly groups cannot identify source geometry.' : undefined} options={[
            ['', 'Choose a part'], ...(!eligible && item.region.partId ? [[item.region.partId, 'Previous link needs review']] : []), ...drawingParts.map(part => [part.id, part.title]),
          ]} onChange={event => onMap(item.key, event.target.value)} />
          {canLink(inspectedPart) && inspectedPart !== item.region.partId && <Button variant="quiet" disabled={disabled} onClick={() => onMap(item.key, inspectedPart)}>Use selected model part</Button>}
          <Button variant="secondary" icon={confirmed ? 'check' : undefined} disabled={disabled || !eligible || confirmed} onClick={() => onConfirm(item.key)}>{confirmed ? 'Link confirmed' : 'Confirm this link'}</Button>
        </div>}
      </div>;
    })}</div>
    {!entries.length && <Notice title="No drawing supplied">The product can still open in 3D. Drawing links will remain unavailable until a prepared drawing is added.</Notice>}
  </section>;
}

function ProductPreview({ preview, candidate, entries, active, onChoose }) {
  return <section className="onboard-preview-copy" aria-labelledby="onboard-preview-title">
    <h2 id="onboard-preview-title">{preview.content.title}</h2>
    <p className="onboard-preview-summary">{preview.content.summary}</p>
    <p className="onboard-muted">{preview.content.description}</p>
    {!!entries.length && <><h3>Check a linked detail</h3><div className="onboard-preview-links">{entries.map(item => <button key={item.key} type="button" aria-pressed={active?.key === item.key} onClick={() => onChoose(item.key)}><span>{item.region.label}</span><Glyph name="arrow" /></button>)}</div></>}
    <details className="onboard-file-identities"><summary>Included with this product</summary>
      <dl className="onboard-facts"><dt>Model version</dt><dd>{preview.modelRevision}</dd><dt>Drawing version</dt><dd>{preview.drawingPackage?.revisionLabel || preview.drawingPackage?.revision || 'Not supplied'}</dd><dt>Confirmed details</dt><dd>{entries.length}</dd><dt>Inquiry fields</dt><dd>{preview.inquiryProfile.fields.length}</dd></dl>
      <p className="onboard-muted">The existing inquiry flow uses this prepared configuration after deployment.</p>
    </details>
    <p className="onboard-footnote">Saved preview · draft {preview.draftRevision}. Later edits require a new preview and review.</p>
  </section>;
}

/** A bounded preparation workspace. All publishing and commercial stores remain outside this component. */
export function OnboardingWorkspace({ candidates = [], repositoryFactory = defaultFactory, onOpenProduct, onBack, deploymentCommand, guardRef }) {
  const [candidateId, setCandidateId] = useState(candidates[0]?.id || '');
  const candidate = candidates.find(item => item.id === candidateId) || candidates[0];
  const [draft, setDraft] = useState(null), [dirty, setDirty] = useState(false), [stage, setStage] = useState('sources');
  const [preview, setPreview] = useState(null), [review, setReview] = useState(null), [exported, setExported] = useState(null);
  const [busy, setBusy] = useState('loading'), [error, setError] = useState(''), [issues, setIssues] = useState([]), [message, setMessage] = useState('');
  const [selection, setSelection] = useState(''), [inspectedPart, setInspectedPart] = useState(''), [view, setView] = useState('drawing');
  const [modelStarted, setModelStarted] = useState(false), [reload, setReload] = useState(0), [drawError, setDrawError] = useState('');
  const [leaving, setLeaving] = useState(false);
  const repository = useRef(null), feedback = useRef(null), heading = useRef(null), reader = useRef(null);
  const savedDraft = useRef(null), leaveRequest = useRef(null), current = useRef({});
  current.current = { busy, dirty };
  const stageIndex = stage === 'ready' ? STAGES.length - 1 : STAGES.findIndex(item => item.id === stage);
  const packageSnapshot = preview && ['preview', 'review', 'ready'].includes(stage) ? preview.drawingPackage : draft?.drawingPackage;
  const entries = useMemo(() => regionsFor(packageSnapshot), [packageSnapshot]);
  const active = entries.find(item => item.key === selection) || entries[0];
  const pkg = useMemo(() => readablePackage(packageSnapshot, candidate), [packageSnapshot, candidate]);
  const showViewer = ['associations', 'preview'].includes(stage);

  useEffect(() => {
    let live = true;
    setBusy('loading'); setDraft(null); setDirty(false); setPreview(null); setReview(null); setExported(null);
    setError(''); setIssues([]); setMessage(''); setStage('sources'); setView('drawing'); setModelStarted(false); setSelection(''); setInspectedPart(''); setDrawError('');
    if (!candidate) { setBusy(''); return; }
    (async () => {
      const next = repositoryFactory(candidate); repository.current = next;
      const saved = await next.getDraft();
      if (live) { savedDraft.current = saved; setDraft(saved); setBusy(''); }
    })().catch(cause => { if (live) { setError(cause.message || 'This product setup could not be opened.'); setBusy(''); } });
    return () => { live = false; repository.current = null; };
  }, [candidate, repositoryFactory, reload]);
  useEffect(() => { if (error || issues.some(item => item.severity === 'error')) feedback.current?.focus(); }, [error, issues]);
  useEffect(() => { if (draft && stage !== 'sources') heading.current?.focus(); }, [stage]);
  useEffect(() => {
    const leave = event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', leave);
    return () => window.removeEventListener('beforeunload', leave);
  }, [dirty]);
  function beforeLeave() {
    if (current.current.busy) return Promise.resolve(false);
    if (!current.current.dirty) return Promise.resolve(true);
    if (leaveRequest.current) return leaveRequest.current.promise;
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    leaveRequest.current = { promise, resolve }; setLeaving(true); return promise;
  }
  function finishLeave(allowed) { leaveRequest.current?.resolve(allowed); leaveRequest.current = null; setLeaving(false); }
  useImperativeHandle(guardRef, () => ({ beforeLeave }), []);
  useEffect(() => () => { leaveRequest.current?.resolve(false); leaveRequest.current = null; }, []);

  const update = patch => { setDraft(value => ({ ...value, ...patch })); setDirty(true); setPreview(null); setReview(null); setExported(null); setMessage(''); setError(''); setIssues([]); };
  const choose = key => {
    setSelection(key);
    const selected = entries.find(item => item.key === key);
    if (selected?.region.partId) setInspectedPart(selected.region.partId);
    setDrawError('');
  };
  const mapRegion = (key, partId, confirmed = false) => {
    if (partId && !onboardingDrawingParts(candidate).some(part => part.id === partId)) return;
    const next = clone(draft.drawingPackage);
    for (const sheet of next.sheets) for (const region of sheet.regions) if (regionKey(sheet.id, region.id) === key) {
      region.partId = partId; region.mappingStatus = confirmed ? 'confirmed' : 'needs-review';
    }
    update({ drawingPackage: next });
    if (partId) setInspectedPart(partId);
  };
  async function run(label, action) {
    if (busy) return;
    setBusy(label); setError(''); setIssues([]); setMessage('');
    try { await action(); }
    catch (cause) { setError(cause.message || 'This action could not be completed. Try again.'); setIssues(cause.issues || []); }
    finally { setBusy(''); }
  }
  async function saveCurrent() {
    const saved = await repository.current.saveDraft(draft);
    savedDraft.current = saved; current.current.dirty = false; setDraft(saved); setDirty(false); return saved;
  }
  function saveAndContinue() {
    void run('continue', async () => {
      const saved = await saveCurrent();
      const found = validateOnboardingDraft(saved, candidate).filter(item => item.severity === 'error' && (stage !== 'sources' || item.section === 'sources'));
      if (found.length) { setIssues(found); setError('Check the highlighted items before continuing.'); return; }
      if (stage === 'sources') { setStage('associations'); return; }
      const next = await repository.current.createPreview(saved);
      setPreview(next); setReview(null); setStage('preview'); setView(pkg ? 'drawing' : 'model');
      if (!pkg) setModelStarted(true);
    });
  }
  function backTo(next) {
    setStage(next); setError(''); setIssues([]); setMessage('');
    if (['sources', 'associations'].includes(next)) { setPreview(null); setReview(null); setExported(null); }
  }
  const reviewWarnings = draft && candidate ? validateOnboardingDraft(draft, candidate).filter(item => item.severity === 'warning') : [];
  const disabled = Boolean(busy);
  if (!candidate) return <section className="studio-onboarding"><h1>Set up a product</h1><Notice title="No prepared products yet">Add a checked model and its source package to the template to begin.</Notice>{onBack && <Button variant="secondary" onClick={onBack}>Back to products</Button>}</section>;

  return <div className="studio-onboarding" data-stage={stage}>
    <header className="onboard-header">
      <div>{onBack && <Button variant="quiet" icon="back" disabled={disabled} onClick={() => { void beforeLeave().then(allowed => { if (allowed) onBack(); }); }}>Products</Button>}<h1 ref={heading} tabIndex={-1}>{stage === 'ready' ? 'Ready for deployment' : 'Set up a product'}</h1><p>{stage === 'ready' ? 'This exact preview is reviewed. Export it for the next build.' : 'Check the files, connect drawing details, then review your product.'}</p></div>
      <div className="onboard-save-status" role="status">{draft ? dirty ? 'Unsaved changes' : draft.revision ? `Draft saved · revision ${draft.revision}` : 'New setup' : 'Opening setup…'}</div>
    </header>
    <ol className="onboard-progress" aria-label="Product setup progress">{STAGES.map((item, index) => <li key={item.id} aria-current={stageIndex === index ? 'step' : undefined} data-complete={stageIndex > index || stage === 'ready'}><span aria-hidden="true">{stageIndex > index || stage === 'ready' ? <Glyph name="check" /> : index + 1}</span>{index < stageIndex && stage !== 'ready' ? <button type="button" disabled={disabled} onClick={() => backTo(item.id)}>{item.title}</button> : <strong>{item.title}</strong>}</li>)}</ol>
    {(error || issues.length > 0) && <div className="onboard-feedback" tabIndex={-1} ref={feedback}><Notice kind="error" title={error || 'Check these items'}>{issues.length > 0 && <ul>{issues.map((issue, index) => <li key={`${issue.path}-${index}`}>{issue.message}</li>)}</ul>}</Notice>{!draft && <Button variant="secondary" disabled={disabled} onClick={() => setReload(value => value + 1)}>Reopen saved setup</Button>}</div>}
    {message && <p className="onboard-message" role="status">{message}</p>}
    {busy === 'loading' && <p className="onboard-loading" role="status"><span className="ar-spinner" /> Opening prepared product…</p>}
    {draft && <>
      {stage === 'sources' && <>
        {candidates.length > 1 && <Field className="onboard-candidate" label="Prepared product" value={candidate.id} options={candidates.map(item => [item.id, titleFor(item)])} disabled={disabled} onChange={event => { const id = event.target.value; void beforeLeave().then(allowed => { if (allowed) setCandidateId(id); }); }} />}
        <SourceChecks candidate={candidate} draft={draft} onChange={update} issues={issues} disabled={disabled} />
      </>}
      {showViewer && <div className="onboard-link-layout">
        {stage === 'associations' ? <AssociationList candidate={candidate} entries={entries} active={active} inspectedPart={inspectedPart} onChoose={choose} disabled={disabled} onMap={mapRegion} onConfirm={key => { const entry = entries.find(item => item.key === key); if (entry) mapRegion(key, entry.region.partId, true); }} />
          : <ProductPreview preview={preview} candidate={candidate} entries={entries} active={active} onChoose={choose} />}
        <div className="onboard-reader">
          <div className="onboard-reader-heading"><div className="onboard-view-switch" role="group" aria-label="Preview type"><button type="button" aria-pressed={view === 'drawing'} disabled={!pkg} onClick={() => setView('drawing')}>Drawing</button><button type="button" aria-pressed={view === 'model'} onClick={() => { setModelStarted(true); setView('model'); }}>3D model</button></div><span>{active?.region.label || 'Whole product'}</span></div>
          <div hidden={view !== 'drawing'}>{pkg && <DrawingPreview ref={reader} pkg={pkg} sheetId={active?.sheet.id || pkg.sheets[0]?.id} regionId={active?.region.id} sourceOnly assetsResolved allowUnconfirmed onSelect={id => choose(regionKey(active?.sheet.id || pkg.sheets[0]?.id, id))} onError={cause => setDrawError(cause.message)} caption="Original source file. Selecting a detail does not change its source coordinates." />}</div>
          {modelStarted && <div hidden={view !== 'model'}><StudioModelStage productId={candidate.id} modelRevision={candidate.model.revision} parts={candidate.parts} selectedId={inspectedPart || active?.region.partId} visible={view === 'model'} onSelection={setInspectedPart} onEdit={() => setView('drawing')} editLabel="Return to drawing" /></div>}
          {drawError && <p className="onboard-footnote" role="alert">Reopen the original source above or return to source checks. This setup cannot be reviewed until its drawing is available.</p>}
          <p className="onboard-reader-note">{stage === 'associations' ? 'Check the marked source region and its model part before confirming the link.' : 'Review the product and its exact source details. Your existing products remain unchanged.'}</p>
        </div>
      </div>}
      {stage === 'review' && <section className="onboard-review" aria-labelledby="onboard-review-title"><div className="onboard-review-intro"><h2 id="onboard-review-title">Confirm the prepared product</h2><p>This review covers the saved preview, source files and confirmed links below.</p><h3>{preview.content.title}</h3><p>{preview.content.summary}</p></div><dl className="onboard-facts"><dt>Model version</dt><dd>{preview.modelRevision}</dd><dt>Drawing version</dt><dd>{preview.drawingPackage?.revisionLabel || preview.drawingPackage?.revision || 'Not supplied'}</dd><dt>Saved preview</dt><dd>Draft {preview.draftRevision}</dd><dt>Source checks</dt><dd>Source, license and units checked</dd></dl>
        {!!entries.length && <div className="onboard-review-links"><h3>Confirmed drawing links</h3><ul>{entries.map(item => <li key={item.key}><strong>{item.region.label}</strong><span>{candidate.parts.find(part => part.id === item.region.partId)?.title}</span><Glyph name="check" /></li>)}</ul></div>}
        {reviewWarnings.length > 0 && <Notice title="Reference status"><ul>{reviewWarnings.map((item, index) => <li key={index}>{item.message}</li>)}</ul></Notice>}
        <p className="onboard-footnote">Confirming review prepares a configuration export. Deployment to the public site is a separate, verified build step.</p>
      </section>}
      {stage === 'ready' && <section className="onboard-ready" aria-labelledby="onboard-ready-title"><div className="onboard-ready-mark"><Glyph name="check" /></div><h2 id="onboard-ready-title">{review.draft.content.title}</h2><p>The model, original files and {entries.length} confirmed drawing {entries.length === 1 ? 'link are' : 'links are'} included in one reviewed package.</p><Button variant="primary" icon="document" pending={busy === 'export'} pendingLabel="Preparing export…" disabled={disabled && busy !== 'export'} onClick={() => { void run('export', async () => { const record = await repository.current.exportReviewed(review); const fileName = saveFile(record); setExported(record); setMessage(`${fileName} downloaded. This has not published a website.`); }); }}>{exported ? 'Download reviewed package again' : 'Export reviewed package'}</Button>
        {exported && <dl className="onboard-facts"><dt>Exported</dt><dd>{formatDate(exported.createdAt)}</dd><dt>Package</dt><dd>{exported.id}</dd></dl>}
        <div className="onboard-deployment"><h3>Next: apply & deploy</h3><p>Pass the exported JSON to the deployment owner. They apply it to the template, run the checks and deploy the build. The original PDF and exact model version stay attached.</p>{deploymentCommand && <pre><code>{deploymentCommand}</code></pre>}<p className="onboard-footnote">This demo stores preparation records in this browser. It does not upload files or send data to a server.</p></div>
        <div className="onboard-ready-actions"><Button variant="secondary" disabled={disabled} onClick={() => backTo('sources')}>Edit this setup</Button>{candidate.readiness?.published === true && onOpenProduct && <Button variant="secondary" icon="arrow" onClick={() => onOpenProduct(candidate.id)}>Open product workspace</Button>}</div>
      </section>}
      {stage !== 'ready' && <footer className="onboard-actions"><div>{stage !== 'sources' && <Button variant="quiet" icon="back" disabled={disabled} onClick={() => backTo(STAGES[stageIndex - 1].id)}>Back</Button>}<span>{dirty ? 'Save to keep your changes.' : draft.revision ? 'Saved in this browser.' : 'Existing products are unchanged.'}</span></div><div><Button variant="secondary" pending={busy === 'save'} pendingLabel="Saving…" disabled={!dirty || disabled && busy !== 'save'} onClick={() => { void run('save', async () => { await saveCurrent(); setMessage('Setup saved in this browser.'); }); }}>Save draft</Button>{['sources', 'associations'].includes(stage) ? <Button variant="primary" icon="arrow" pending={busy === 'continue'} pendingLabel="Saving…" disabled={disabled && busy !== 'continue' || stage === 'associations' && Boolean(drawError)} onClick={saveAndContinue}>{stage === 'sources' ? 'Continue to details' : 'Save and preview'}</Button>
        : stage === 'preview' ? <Button variant="primary" icon="arrow" disabled={disabled || Boolean(drawError)} onClick={() => { setStage('review'); }}>Review this package</Button>
          : <Button variant="primary" icon="check" pending={busy === 'review'} pendingLabel="Confirming…" disabled={disabled && busy !== 'review'} onClick={() => { void run('review', async () => { const confirmed = await repository.current.review(draft, preview.id); setReview(confirmed); setStage('ready'); }); }}>Confirm review</Button>}</div></footer>}
    </>}
    <UnsavedDialog open={leaving} pending={busy === 'leave'} title="Keep this product setup?" description="Save the draft before leaving, or discard only your unsaved edits. Existing products and reviewed exports stay unchanged."
      onKeep={() => finishLeave(false)}
      onDiscard={() => { setDraft(clone(savedDraft.current)); current.current.dirty = false; setDirty(false); setPreview(null); setReview(null); setExported(null); setStage('sources'); finishLeave(true); }}
      onSave={async () => { setBusy('leave'); setError(''); setIssues([]); try { await saveCurrent(); finishLeave(true); } catch (cause) { setError(cause.message || 'The draft could not be saved. Your edits remain open.'); setIssues(cause.issues || []); finishLeave(false); } finally { current.current.busy = ''; setBusy(''); } }} />
  </div>;
}
