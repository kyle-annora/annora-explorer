import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ActionGroup, Button, Comparison, Field, Glyph, Notice, Section, Status } from '../product-room/ui/components.jsx';
import { createRoomViewer } from '../product-room/viewer.js';
import { createDrawingReader } from '../drawings/reader.js';
import { DrawingPreview } from '../drawings/DrawingPreview.jsx';
import { DrawingOverviewEditor } from './drawing-overview-editor.jsx';
import { compareOverviewPresentations, overviewPresentationIssues } from '../drawings/overview-presentation.js';
import { DRAWING_IMPORT_EXAMPLES } from '../drawings/demo-sources.js';
import { importDrawingPDF } from './drawing-source-import.js';
import { resolveDrawingAssets } from './drawing-asset-store.js';
import { createDrawingRepository } from './drawing-repository.js';
import { allDrawingMappings, compareDrawingPackages, confirmDrawingPairing, copyDrawingValue, drawingMappingIssues, drawingMappingSummary,
  drawingPartIds, sameDrawingValue, updateDrawingMapping, addDrawingMapping, removeDrawingMapping, removeUnplacedDrawingMapping } from './drawing-domain.js';
import './drawing-workspace.css';

const labels = { confirmed: 'Confirmed', 'needs-review': 'Needs review', missing: 'Not linked' };
const regionForm = region => ({ label: region?.label || '', partId: region?.partId || '', note: region?.note || '', bounds: (region?.bounds || ['', '', '', '']).map(String) });
const formPatch = form => ({ ...form, bounds: form.bounds.every(value => value.trim() === '') ? null : form.bounds.map(value => value.trim() === '' ? null : Number(value)) });
const authoredBounds = (bounds, sheet) => {
  const round = value => Number(value.toFixed(3)), [px, py, width, height] = sheet.viewBox;
  const x = Math.max(px, Math.min(px + width, round(bounds[0]))), y = Math.max(py, Math.min(py + height, round(bounds[1])));
  const right = Math.min(px + width, round(bounds[0] + bounds[2])), bottom = Math.min(py + height, round(bounds[1] + bounds[3]));
  return [x, y, Number((right - x).toFixed(4)), Number((bottom - y).toFixed(4))];
};
const firstRegion = pkg => { const sheet = pkg?.sheets[0]; return { sheetId: sheet?.id, regionId: sheet?.regions[0]?.id }; };
const dateLabel = value => value ? new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Not saved yet';
// A missing historical presentation predates seller configuration. It may use
// only the fixed legacy baseline for this exact source and association set.
const recordedOverview = (entry, record) => {
  if (record?.presentationSnapshot !== undefined) return record.presentationSnapshot;
  const baseline = entry?.legacyOverviewPresentation, pkg = record?.packageSnapshot;
  return baseline && pkg && !overviewPresentationIssues(baseline, pkg).length ? baseline : null;
};
const precedingOverview = (entry, record, history) => {
  const previous = history.find(item => item.id === record.baseReleaseId);
  if (record.previousPresentationSnapshot !== undefined)
    return record.previousPresentationSnapshot;
  return recordedOverview(entry, previous || { packageSnapshot: record.previousPackageSnapshot || (!record.baseReleaseId ? entry.package : null) });
};

function SourceDrawingEditor({ pkg, sheetId, regionId, onSelect, readonly = false, assetStore, drawIntent, onDraw, onCancelDraw, draftBounds }) {
  const mount = useRef(null), viewer = useRef(null), callbacks = useRef({});
  const [state, setState] = useState({ loading: true, zoom: 1 }), [error, setError] = useState(null);
  callbacks.current = { onSelect, onDraw, onCancelDraw, drawIntent, draftBounds };
  useEffect(() => {
    let active = true, lease, view;
    setError(null); setState({ loading: true, zoom: 1 });
    (async () => {
      lease = await resolveDrawingAssets(pkg, { assetStore });
      if (!active) { lease.dispose(); return; }
      view = createDrawingReader({ mount: mount.current, package: lease.package, sheetId, showOverview: true,
        interactionMode: callbacks.current.drawIntent ? 'draw-region' : 'inspect',
        onRegionDraw: bounds => callbacks.current.onDraw?.(bounds), onRegionDrawCancel: () => callbacks.current.onCancelDraw?.(),
        onSelect: id => callbacks.current.onSelect?.(id), onViewChange: next => { if (active) setState(next); },
        onError: next => { if (active) setError(next.message || 'The original drawing could not be opened.'); } });
      viewer.current = view; view.select(regionId);
      if (callbacks.current.draftBounds) view.setDraftBounds(callbacks.current.draftBounds);
      await view.ready;
      if (active) setState(next => ({ ...next, loading: false }));
    })().catch(next => { if (active) setError(next.message); });
    return () => { active = false; viewer.current = null; view?.dispose(); lease?.dispose(); };
  }, [pkg, sheetId, assetStore]);
  useEffect(() => { viewer.current?.select(regionId); }, [regionId]);
  useEffect(() => { viewer.current?.setInteractionMode(drawIntent ? 'draw-region' : 'inspect'); }, [drawIntent]);
  useEffect(() => { try { viewer.current?.setDraftBounds(draftBounds || null); } catch { viewer.current?.setDraftBounds(null); } }, [draftBounds]);
  const pending = state.loading || !!error;
  return <div className="sd-drawing-preview">
    <div className="sd-preview-controls" aria-label="Drawing controls">
      <span>{state.loading ? 'Opening…' : `${Math.round((state.zoom || 1) * 100)}%`}</span>
      <ActionGroup><Button variant="quiet" pendingLabel="" onClick={() => viewer.current?.zoomBy(1 / 1.3)} disabled={pending || state.canZoomOut === false} aria-label="Zoom out">−</Button>
        <Button variant="quiet" pendingLabel="" onClick={() => viewer.current?.zoomBy(1.3)} disabled={pending || state.canZoomIn === false} aria-label="Zoom in">+</Button>
        <Button variant="quiet" pendingLabel="" onClick={() => viewer.current?.fit()} disabled={pending}>Fit page</Button>
        <Button variant="quiet" pendingLabel="" onClick={() => viewer.current?.focusRegion(regionId)} disabled={pending || !regionId}>Fit detail</Button>
        <Button variant="quiet" pendingLabel="" onClick={() => viewer.current?.rotateBy?.(90)} disabled={pending || pkg.sheets.find(item => item.id === sheetId)?.format !== 'pdf'} aria-label="Rotate page clockwise">↻</Button>
      </ActionGroup>
    </div>
    <div className="sd-drawing-mount" ref={mount} aria-label="Original drawing with linked detail regions" />
    {error && <Notice kind="error" title="Drawing unavailable">{error}</Notice>}
    <p className="sd-preview-caption" role="status">{drawIntent ? 'Drag a rectangle around the detail. Pinch to zoom. Escape or Cancel exits drawing.' : readonly ? 'Published source and associations.' : draftBounds ? 'Drag a corner to resize. Link the part and confirm the association.' : 'Select a detail or drag to pan. Use the controls or pinch to zoom.'}</p>
  </div>;
}

function ReviewDrawing({ pkg, presentationSnapshot, assetStore, initialSelection }) {
  const choices = allDrawingMappings(pkg);
  const initial = choices.find(({ sheet, region }) => sheet.id === initialSelection?.sheetId && region.id === initialSelection?.regionId) || choices[0];
  const [selection, setSelection] = useState(initial ? `${initial.sheet.id}:${initial.region.id}` : '');
  const active = choices.find(({ sheet, region }) => `${sheet.id}:${region.id}` === selection) || choices[0];
  if (!active) return null;
  return <div className="sd-review-drawing">
    <Field label="Inspect drawing detail" value={`${active.sheet.id}:${active.region.id}`} options={choices.map(({ sheet, region }) => [`${sheet.id}:${region.id}`, `${region.label} · ${sheet.title}`])} onChange={event => setSelection(event.target.value)} />
    <DrawingPreview pkg={pkg} presentationSnapshot={presentationSnapshot} sheetId={active.sheet.id} regionId={active.region.id} assetStore={assetStore} onSelect={id => setSelection(`${active.sheet.id}:${id}`)} />
  </div>;
}

function ModelPreview({ entry, partId, explorerURL, onPartSelect }) {
  const mount = useRef(null), viewer = useRef(null), select = useRef(onPartSelect), selected = useRef(partId);
  const [ready, setReady] = useState(false), [error, setError] = useState(null);
  select.current = onPartSelect; selected.current = partId;
  useEffect(() => {
    let active = true, initial = true, lastId = null;
    setReady(false); setError(null);
    const host = createRoomViewer({ mount: mount.current, explorerURL,
      onState(state) {
        if (!active || state.lifecycle !== 'ready' || initial) return;
        if (state.model?.id !== entry.model.id || state.model?.revision !== entry.model.revision) {
          setError('The Explorer is showing a different model version. Return to the drawing and reopen this preview.'); return;
        }
        const id = state.navigation?.selectedId;
        if (id !== lastId && drawingPartIds(entry).includes(id)) { lastId = id; select.current?.(id); }
      }, onError: next => { if (active) setError(next.message); } });
    viewer.current = host;
    host.mountModel(entry.model.id).then(async () => {
      if (!active) return;
      const state = host.state;
      if (state.model?.revision !== entry.model.revision) throw new Error('This model revision is not available. The original drawing remains accessible.');
      if (selected.current) { lastId = selected.current; await host.request('select', { nodeId: selected.current }); }
      if (active) { initial = false; setReady(true); }
    }).catch(next => { if (active) setError(next.message); });
    const observer = new IntersectionObserver(entries => { if (entries[0] && !entries[0].isIntersecting) void host.pause().catch(() => {}); });
    observer.observe(mount.current);
    const pauseWhenHidden = () => { if (document.hidden) void host.pause().catch(() => {}); };
    document.addEventListener('visibilitychange', pauseWhenHidden);
    return () => { active = false; observer.disconnect(); document.removeEventListener('visibilitychange', pauseWhenHidden); viewer.current = null; void host.dispose(); };
  }, [entry, explorerURL]);
  useEffect(() => { if (ready && partId && viewer.current?.state?.navigation?.selectedId !== partId) void viewer.current.request('select', { nodeId: partId }).catch(next => setError(next.message)); }, [partId, ready]);
  return <div className="sd-model-preview"><div className="sd-model-mount" ref={mount} />
    {!ready && !error && <p className="sd-model-loading" role="status">Opening the exact model version…</p>}
    {error && <Notice kind="error" title="Model preview unavailable">{error}</Notice>}
    <p className="sd-preview-caption">Select a part in the model or use the part menu. Confirm its drawing association separately.</p>
  </div>;
}

function MappingTable({ pkg, entry }) {
  return <div className="sd-mapping-table" role="table" aria-label="Drawing associations">
    <div role="row" className="sd-mapping-head"><span role="columnheader">Drawing detail</span><span role="columnheader">Linked part</span><span role="columnheader">Status</span></div>
    {allDrawingMappings(pkg).map(({ sheet, region }) => <div role="row" key={`${sheet.id}:${region.id}`}>
      <span role="cell"><strong>{region.label}</strong><small>{sheet.title}</small></span>
      <span role="cell">{entry.model.parts.find(part => part.id === region.partId)?.title || region.partId || 'Not linked'}</span>
      <span role="cell"><Status tone={region.mappingStatus === 'confirmed' ? 'neutral' : 'active'}>{labels[region.mappingStatus] || 'Needs review'}</Status></span>
    </div>)}
  </div>;
}

function MappingComparison({ before, after, entry, beforeLabel = 'Previous release', afterLabel = 'This release' }) {
  const comparison = compareDrawingPackages(before, after, { parts: entry.model.parts });
  if (!comparison.available) return <p className="sd-hint">A comparison baseline is not available for this older release.</p>;
  return <div className="sd-release-comparison">
    <h3>What changed</h3>
    <p>{comparison.sourceFilesUnchanged ? 'Source files unchanged.' : 'Source files changed.'} {comparison.associationCount} {comparison.associationCount === 1 ? 'association changed' : 'associations changed'}.</p>
    <p className="sd-hint">Drawing and association versions are separate from quotation versions. Existing inquiries keep their original references.</p>
    {comparison.sourceChanges.length > 0 && <><h4>Document and model references</h4><Comparison rows={comparison.sourceChanges} beforeLabel={beforeLabel} afterLabel={afterLabel} caption="Document and model version comparison" /></>}
    {comparison.associationChanges.length > 0 && <><h4>Part and drawing associations</h4><Comparison rows={comparison.associationChanges} beforeLabel={beforeLabel} afterLabel={afterLabel} caption="Drawing association comparison" /></>}
    {!comparison.sourceChanges.length && !comparison.associationChanges.length && <p className="sd-hint">No changes to document references or associations.</p>}
  </div>;
}

function OverviewComparison({ before, after, beforeLabel = 'Previous release' }) {
  const comparison = compareOverviewPresentations(before, after);
  return <div className="sd-release-comparison"><h3>Overview changes</h3>
    <p className="sd-hint">View order, titles and clickable details have their own presentation version. Drawing and quotation versions remain separate.</p>
    {comparison.rows?.length ? <Comparison rows={comparison.rows} beforeLabel={beforeLabel} afterLabel="This release" caption="Drawing overview comparison" />
      : <p className="sd-hint">{after ? 'No overview configuration changes.' : 'This source is presented through its original drawing.'}</p>}
  </div>;
}

export const DrawingWorkspace = forwardRef(function DrawingWorkspace({ packages = [], initialPackageId, repository: suppliedRepository,
  explorerURL = new URL('../', globalThis.location?.href || 'http://localhost/studio/').href,
  onPackageChange, onPreview, onPublish, onBack }, ref) {
  const repository = useMemo(() => suppliedRepository || createDrawingRepository({ packages }), [suppliedRepository, packages]);
  const [productId, setProductId] = useState(() => packages.some(item => item.id === initialPackageId) ? initialPackageId : packages[0]?.id);
  const entry = packages.find(item => item.id === productId);
  const [draft, setDraft] = useState(null), [saved, setSaved] = useState(null), [selection, setSelection] = useState({}), [form, setForm] = useState(regionForm());
  const [stage, setStage] = useState('edit'), [mode, setMode] = useState('drawings'), [previewPackage, setPreviewPackage] = useState(null);
  const [workspaceSection, setWorkspaceSection] = useState('overview');
  const [sourceOptionsOpen, setSourceOptionsOpen] = useState(false);
  const [associationPanel, setAssociationPanel] = useState('preview');
  const [busy, setBusy] = useState(null), [error, setError] = useState(null), [message, setMessage] = useState(null), [review, setReview] = useState(null);
  const [history, setHistory] = useState([]), [release, setRelease] = useState(null), [confirmed, setConfirmed] = useState(false), [evidence, setEvidence] = useState('');
  const [sourceVersions, setSourceVersions] = useState([]), [importOpen, setImportOpen] = useState(false), [importFile, setImportFile] = useState(null), [revisionLabel, setRevisionLabel] = useState('');
  const [drawIntent, setDrawIntent] = useState(null), [removeIntent, setRemoveIntent] = useState(null);
  const [authoring, setAuthoring] = useState(false);
  const [leave, setLeave] = useState(null), leaveRef = useRef(null), lifecycle = useRef(0), heading = useRef(null), dialog = useRef(null), drawingStage = useRef(null);
  const pkg = draft?.packageSnapshot, sheet = pkg?.sheets.find(item => item.id === selection.sheetId), region = sheet?.regions.find(item => item.id === selection.regionId);
  const formChanged = !!region && !sameDrawingValue(form, regionForm(region));
  const dirty = !!draft && (!sameDrawingValue(draft, saved) || formChanged), dirtyRef = useRef(false), busyRef = useRef(null);
  dirtyRef.current = dirty; busyRef.current = busy;
  const current = useRef({}); current.current = { draft, entry, selection, form, formChanged };
  const summary = pkg ? drawingMappingSummary(pkg) : null;
  const partOptions = [['', 'Choose a part'], ...(entry?.model.parts || []).map(part => [part.id, part.title])];
  const guard = () => {
    if (busyRef.current) return Promise.resolve(false);
    if (!dirtyRef.current) return Promise.resolve(true);
    if (leaveRef.current) return leaveRef.current.promise;
    let resolve; const promise = new Promise(done => { resolve = done; });
    leaveRef.current = { resolve, promise }; setError(null); setLeave(true); return promise;
  };
  const finishLeave = result => { leaveRef.current?.resolve(result); leaveRef.current = null; setLeave(null); };
  useImperativeHandle(ref, () => ({ beforeLeave: guard }), []);
  useEffect(() => {
    const beforeUnload = event => { if (dirtyRef.current) { event.preventDefault(); event.returnValue = ''; } };
    globalThis.addEventListener?.('beforeunload', beforeUnload);
    return () => { lifecycle.current++; finishLeave(false); globalThis.removeEventListener?.('beforeunload', beforeUnload); };
  }, []);
  useEffect(() => {
    const turn = ++lifecycle.current; setBusy('load'); setError(null); setDraft(null);
    Promise.all([repository.getDraft(productId), repository.listReleases(productId), repository.listSourceVersions(productId)]).then(([next, releases, versions]) => {
      if (turn !== lifecycle.current) return;
      setDraft(next); setSaved(copyDrawingValue(next)); setHistory(releases); setSourceVersions(versions); setDrawIntent(null); setImportOpen(false); const first = firstRegion(next.packageSnapshot); setSelection(first);
      setForm(regionForm(next.packageSnapshot.sheets[0]?.regions[0])); setPreviewPackage(null); setStage('edit'); setReview(null); setRelease(null); setMode('drawings'); setWorkspaceSection('overview'); setAssociationPanel('preview'); setAuthoring(false); setMessage(null);
    }).catch(next => { if (turn === lifecycle.current) setError(next); }).finally(() => { if (turn === lifecycle.current) setBusy(null); });
  }, [productId, repository]);
  useEffect(() => { if (stage !== 'edit') heading.current?.focus(); }, [stage]);
  useEffect(() => {
    if (!leave) return;
    const previous = document.activeElement, box = dialog.current;
    const controls = () => [...box.querySelectorAll('button:not(:disabled), input:not(:disabled), [tabindex="0"]')];
    (controls()[0] || box).focus();
    const keyboard = event => {
      if (event.key === 'Escape' && !busyRef.current) { event.preventDefault(); finishLeave(false); }
      if (event.key !== 'Tab') return;
      const items = controls(), first = items[0] || box, last = items.at(-1) || box;
      if (event.shiftKey && (document.activeElement === first || document.activeElement === box)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === box)) { event.preventDefault(); first.focus(); }
    };
    box.addEventListener('keydown', keyboard);
    return () => { box.removeEventListener('keydown', keyboard); if (previous?.isConnected) previous.focus(); };
  }, [leave]);


  function staged() {
    const value = current.current;
    return value.formChanged ? updateDrawingMapping(value.draft, value.entry, value.selection.sheetId, value.selection.regionId, formPatch(value.form)) : value.draft;
  }
  function choose(nextSelection) {
    try {
      const next = staged(), target = next.packageSnapshot.sheets.find(item => item.id === nextSelection.sheetId)?.regions.find(item => item.id === nextSelection.regionId);
      setDraft(next); setSelection(nextSelection); setForm(regionForm(target)); setPreviewPackage(null); setDrawIntent(null); setRemoveIntent(null); setError(null);
    } catch (next) { setError(next); }
  }
  function edit(key, value) { setAuthoring(true); setForm(previous => ({ ...previous, [key]: value })); setPreviewPackage(null); setError(null); setMessage(null); }
  function changeWorkspaceSection(nextSection) {
    try { setDraft(staged()); setWorkspaceSection(nextSection); setDrawIntent(null); setError(null); }
    catch (next) { setError(next); }
  }
  function changeOverview(presentationSnapshot) {
    try { setDraft({ ...staged(), presentationSnapshot }); setPreviewPackage(null); setError(null); setMessage(null); }
    catch (next) { setError(next); }
  }
  function openSourceAssociation(nextSelection) {
    choose(nextSelection); setWorkspaceSection('associations'); setMode('drawings'); setAuthoring(true); setAssociationPanel('preview');
    requestAnimationFrame(() => drawingStage.current?.scrollIntoView({ block: 'start', behavior: 'auto' }));
  }
  async function run(name, action) {
    if (busyRef.current) return;
    busyRef.current = name; setBusy(name); setError(null); setMessage(null);
    try { await action(); } catch (next) { setError(next); } finally { busyRef.current = null; setBusy(null); }
  }
  async function saveCurrent() {
    const next = await repository.saveDraft(staged());
    setDraft(next); setSaved(copyDrawingValue(next));
    const selected = next.packageSnapshot.sheets.find(item => item.id === current.current.selection.sheetId)?.regions.find(item => item.id === current.current.selection.regionId);
    setForm(regionForm(selected)); setPreviewPackage(null); return next;
  }
  async function changeProduct(id) {
    if (id === productId || !(await guard())) return;
    setProductId(id); onPackageChange?.(id);
  }
  function loadSourceDraft(next) {
    setDraft(next); setSaved(copyDrawingValue(next)); const first = firstRegion(next.packageSnapshot);
    setSelection(first); setForm(regionForm(next.packageSnapshot.sheets[0]?.regions[0])); setPreviewPackage(null);
    setStage('edit'); setReview(null); setDrawIntent(null); setRemoveIntent(null); setMode('drawings'); setWorkspaceSection('overview'); setAssociationPanel('preview'); setAuthoring(false);
  }
  const changeSourceVersion = async id => {
    if (id === draft.sourceVersionId || !(await guard())) return;
    await run('source', async () => { const next = await repository.getDraft(productId, { sourceVersionId: id }); await repository.selectDraft(next.id); loadSourceDraft(next); });
  };
  const importPDF = () => run('import', async () => {
    const base = await saveCurrent();
    const next = await importDrawingPDF({ productId, file: importFile, revisionLabel, repository, baseDraftId: base.id });
    loadSourceDraft(next); setSourceVersions(await repository.listSourceVersions(productId)); setImportOpen(false); setImportFile(null); setRevisionLabel('');
    setMessage('New PDF version imported. Check each region and confirm its part before publishing. Earlier releases remain unchanged.');
  });
  function startDraw(intent) {
    try { setDraft(staged()); setWorkspaceSection('associations'); setMode('drawings'); setAuthoring(true); setAssociationPanel('preview'); setDrawIntent(intent); setRemoveIntent(null); setError(null); setMessage(null);
      requestAnimationFrame(() => drawingStage.current?.scrollIntoView({ block: 'center', behavior: 'auto' })); }
    catch (next) { setError(next); }
  }
  function finishDraw(rawBounds) {
    try {
      const bounds = authoredBounds(rawBounds, sheet);
      if (drawIntent?.kind === 'new') {
        const next = addDrawingMapping(staged(), entry, selection.sheetId, { label: drawIntent.label || 'New detail', bounds, partId: '', ...(drawIntent.fromUnplacedId ? { fromUnplacedId: drawIntent.fromUnplacedId } : {}) });
        const targetSheet = next.packageSnapshot.sheets.find(item => item.id === selection.sheetId), added = targetSheet.regions.at(-1);
        setDraft(next); setSelection({ sheetId: targetSheet.id, regionId: added.id }); setForm(regionForm(added));
        setMessage('Region drawn. Name the detail, choose its model part, then confirm the mapping.');
      } else {
        edit('bounds', bounds.map(String));
      }
      setDrawIntent(null); setPreviewPackage(null); setAssociationPanel('settings');
    } catch (next) { setError(next); }
  }
  const removeRegion = () => run('remove', async () => {
    const next = removeIntent.unplacedId ? removeUnplacedDrawingMapping(staged(), entry, removeIntent.unplacedId) : removeDrawingMapping(staged(), entry, selection.sheetId, selection.regionId);
    setDraft(next); const targetSheet = next.packageSnapshot.sheets.find(item => item.id === selection.sheetId);
    const target = targetSheet?.regions[0]; setSelection({ sheetId: targetSheet?.id, regionId: target?.id }); setForm(regionForm(target));
    setRemoveIntent(null); setDrawIntent(null); setMessage('Region removed from this draft. Existing releases and customer projects are unchanged.');
  });
  const confirmMapping = () => run('confirm', async () => {
    const next = updateDrawingMapping(draft, entry, selection.sheetId, selection.regionId, formPatch(form), { confirm: true });
    setDraft(next); setForm(regionForm(next.packageSnapshot.sheets.find(item => item.id === selection.sheetId).regions.find(item => item.id === selection.regionId))); setPreviewPackage(null);
    setMessage('Association confirmed in this draft. Save and review before publishing.');
  });
  const previewRegion = () => {
    try {
      const next = staged(), candidate = next.packageSnapshot.sheets.find(item => item.id === selection.sheetId).regions.find(item => item.id === selection.regionId);
      const issues = drawingMappingIssues(next.packageSnapshot, selection.sheetId, candidate, drawingPartIds(entry));
      if (issues.length) throw Object.assign(new Error('Check the linked part and region before previewing.'), { issues });
      setAuthoring(true); setPreviewPackage(next.packageSnapshot); setMode('drawings'); setAssociationPanel('preview'); setMessage('Previewing the edited region on the original sheet. Confirm it to update the association.'); setError(null);
    } catch (next) { setError(next); }
  };
  const beginReview = () => run('review', async () => { const next = await saveCurrent(); const packet = await repository.reviewDraft(next); setReview(packet); setConfirmed(false); setStage('review'); });
  const previewBuyer = (record = null) => run('preview', async () => { const next = record || await repository.createPreview(await saveCurrent()); await onPreview?.(next); });
  const publish = () => run('publish', async () => {
    const next = await repository.publishReviewed(review, { confirmed }); setRelease(next); setHistory(await repository.listReleases(productId)); setStage('published'); await onPublish?.(next);
  });
  const downloadRelease = () => run('export', async () => {
    const packet = await repository.exportRelease(release.id), url = URL.createObjectURL(new Blob([JSON.stringify(packet, null, 2) + '\n'], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `${release.id}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage('Release exported. Your deployment can validate and apply this fixed mapping package.');
  });
  const importExample = DRAWING_IMPORT_EXAMPLES[productId];
  const errors = error?.issues || [];
  const draftBounds = useMemo(() => {
    if (!sheet || !region || !(formChanged || region.mappingStatus !== 'confirmed')) return null;
    const rect = formPatch(form).bounds;
    return rect?.every(Number.isFinite) && rect[2] > 0 && rect[3] > 0 && rect[0] >= 0 && rect[1] >= 0 && rect[0] + rect[2] <= sheet.viewBox[2] + 1e-7 && rect[1] + rect[3] <= sheet.viewBox[3] + 1e-7 ? rect : null;
  }, [sheet, region, form, formChanged]);
  const removalPrompt = removeIntent && <Notice title={`Remove “${removeIntent.label}” from this draft?`}><p>Earlier versions keep their original details.</p><ActionGroup><Button variant="secondary" onClick={() => setRemoveIntent(null)} disabled={!!busy}>Keep detail</Button><Button variant="secondary" onClick={removeRegion} pending={busy === 'remove'} disabled={!!busy && busy !== 'remove'}>Remove from draft</Button></ActionGroup></Notice>;
  const workspaceControl = <label className="sd-workspace-choice"><span className="sd-sr-only">Drawing workspace</span><select aria-label="Drawing workspace" value={workspaceSection} disabled={!!busy} onChange={event => changeWorkspaceSection(event.target.value)}><option value="overview">Drawing overview</option><option value="associations">Source associations</option></select></label>;
  return <section className="room-ui sd-workspace" data-stage={stage} data-section={workspaceSection} data-association-panel={associationPanel} aria-busy={busy === 'load' || undefined}>
    <header className="sd-header">
      <div><p className="ar-eyebrow">STUDIO / DRAWINGS</p><h1 ref={heading} tabIndex="-1">{stage === 'review' ? 'Review this release.' : stage === 'published' ? 'Drawing release ready.' : stage === 'history' ? `Release ${release?.version}` : 'Drawing workspace'}</h1>
        <p>{stage === 'edit' ? dirty ? 'Unsaved changes' : draft?.revision ? `Draft saved · ${dateLabel(draft.updatedAt)}` : 'New draft · Not published' : 'The overview, source drawing and confirmed associations stay together in this release.'}</p></div>
      {draft && stage === 'edit' ? <ActionGroup className="sd-document-actions">
        <Button variant="quiet" onClick={() => run('save', async () => { await saveCurrent(); setMessage('Drawing draft saved in this browser.'); })} pending={busy === 'save'} disabled={!!busy && busy !== 'save'}>Save draft</Button>
        {onPreview && <Button variant="secondary" onClick={() => previewBuyer()} pending={busy === 'preview'} disabled={!!busy && busy !== 'preview'}>Buyer preview</Button>}
        <Button icon="arrow" onClick={beginReview} pending={busy === 'review'} pendingLabel="Checking…" disabled={!!busy && busy !== 'review'}>Review release</Button>
      </ActionGroup> : onBack && <Button variant="quiet" icon="back" disabled={!!busy} onClick={async () => { if (await guard()) onBack(); }}>Back to Studio</Button>}
    </header>
    {error && !leave && <Notice kind="error" title={error.message || 'This action could not be completed.'}>{errors.length > 0 && <ul>{errors.map((item, index) => <li key={`${item.path}:${index}`}>{item.message}</li>)}</ul>}</Notice>}
    {message && <Notice role="status">{message}</Notice>}
    {!draft && !error && <p role="status">Opening the prepared product…</p>}
    {draft && stage === 'edit' && <>
      <details className="sd-source-options" open={sourceOptionsOpen} onToggle={event => setSourceOptionsOpen(event.currentTarget.open)}><summary><span className="sd-source-context"><strong>{entry.title}</strong><span>{sourceVersions.find(item => item.id === draft.sourceVersionId)?.label || pkg.revision}</span></span><span className="sd-source-summary"><span>{summary.confirmed - (formChanged && region?.mappingStatus === 'confirmed' ? 1 : 0)} / {summary.total} linked</span><span>Source & version <Glyph name="arrow" className="sd-disclosure-icon"/></span></span></summary><div className="sd-source-bar">
        <Field label="Product" value={productId} options={packages.map(item => [item.id, item.title])} onChange={event => void changeProduct(event.target.value)} disabled={!!busy} />
        <Field label="Source version" value={draft.sourceVersionId || sourceVersions[0]?.id || ''} options={sourceVersions.map(item => [item.id, `${item.label || item.revision}${item.kind === 'local-pdf' ? ' · imported PDF' : ' · prepared source'}`])} onChange={event => void changeSourceVersion(event.target.value)} disabled={!!busy} />
        <Button variant="secondary" onClick={() => setImportOpen(value => !value)} disabled={!!busy} aria-expanded={importOpen}>Import new PDF</Button>
        <a href={pkg.sourceURL} target="_blank" rel="noreferrer">{pkg.sourceOrigin?.kind === "local-pdf" ? "Prepared model source" : "Source provenance"} <Glyph name="external" /></a>
      </div></details>
      {importOpen && <Section className="sd-import-panel" title="Introduce a new source version" description="Import the actual PDF. Page sizes are read from the file; every copied association will need human review.">
        {importExample && <a className="sd-import-example" href={importExample.url} download={importExample.fileName}>{importExample.title} <Glyph name="external" /></a>}
        {importExample && <p className="sd-hint">{importExample.description}</p>}
        <div className="sd-import-fields"><label className="ar-field"><span>PDF file</span><input aria-label="PDF file" type="file" accept="application/pdf,.pdf" onChange={event => setImportFile(event.target.files?.[0] || null)} disabled={!!busy} /></label>
          <Field label="Drawing revision" value={revisionLabel} onChange={event => setRevisionLabel(event.target.value)} placeholder="For example, Rev B" maxLength={100} disabled={!!busy} /></div>
        <p className="sd-hint">The current draft is saved first. Earlier PDFs, associations and published releases keep their original versions.</p>
        <ActionGroup><Button variant="quiet" disabled={!!busy} onClick={() => setImportOpen(false)}>Cancel import</Button><Button variant="secondary" onClick={importPDF} pending={busy === 'import'} pendingLabel="Reading PDF…" disabled={!importFile || !revisionLabel.trim() || !!busy && busy !== 'import'}>Create source draft</Button></ActionGroup>
      </Section>}
      {!!draft.importWarnings?.length && <details className="sd-import-notes"><summary>PDF import review notes ({draft.importWarnings.length})</summary><ul>{draft.importWarnings.map((item, index) => <li key={index}>{typeof item === 'string' ? item : item.message}</li>)}</ul></details>}
      {!!pkg.unplacedMappings?.length && <Section className="sd-unplaced" title="Details needing a page" description="These details belonged to pages that are not in this PDF. Place them on the selected sheet or explicitly remove them before publishing.">{pkg.unplacedMappings.map(item => <div className="sd-unplaced-row" key={item.id}><div><strong>{item.region.label}</strong><small>{item.sheetTitle}</small></div><ActionGroup><Button variant="secondary" disabled={!!busy} onClick={() => startDraw({ kind: 'new', fromUnplacedId: item.id, label: item.region.label })}>Place on selected sheet</Button><Button variant="quiet" disabled={!!busy} onClick={() => setRemoveIntent({ unplacedId: item.id, label: item.region.label })}>Remove detail</Button></ActionGroup></div>)}</Section>}
      {removeIntent?.unplacedId && removalPrompt}
      {workspaceSection === 'overview' && <DrawingOverviewEditor key={`${draft.id}:${draft.sourceSignature}`} draft={draft} entry={entry} assetStore={repository.assetStore} disabled={!!busy} onChange={changeOverview} onOpenAssociation={openSourceAssociation} workspaceControl={workspaceControl} />}
      {workspaceSection === 'associations' && <><div className="sd-association-bar">{workspaceControl}<div className="sd-association-actions">{associationPanel === 'preview' ? <><Button variant="quiet" onClick={() => setAssociationPanel('details')}>Choose detail</Button><Button variant="secondary" onClick={() => setAssociationPanel('settings')}>Edit link</Button></> : <Button variant="quiet" icon="back" onClick={() => setAssociationPanel('preview')}>Back to drawing</Button>}</div></div><div className="sd-editor-grid">
        <aside className="sd-region-nav" aria-label="Drawing details">
          <Field label="Drawing sheet" value={selection.sheetId || ''} options={pkg.sheets.map(item => [item.id, item.title])} onChange={event => { const target = pkg.sheets.find(item => item.id === event.target.value); choose({ sheetId: target.id, regionId: target.regions[0]?.id }); }} disabled={!!busy} />
          <div className="sd-region-list">{(sheet?.regions || []).map(item => <button type="button" key={item.id} aria-current={selection.regionId === item.id ? 'true' : undefined} onClick={() => { choose({ sheetId: sheet.id, regionId: item.id }); setAssociationPanel('preview'); }} disabled={!!busy}>
            <span>{item.label}</span><small><i data-state={item.mappingStatus} />{labels[item.mappingStatus] || 'Needs review'}</small>
          </button>)}</div>
          {!sheet?.regions.length && <p className="sd-hint">No regions yet. Draw a detail on this page to link it to a part.</p>}
        </aside>
        <section ref={drawingStage} className="sd-stage" aria-label="Association preview">
          <div className="sd-stage-tabs" role="group" aria-label="Preview view">
            <button type="button" aria-pressed={mode === 'drawings'} onClick={() => setMode('drawings')}>Drawing</button>
            <button type="button" aria-pressed={mode === '3d'} onClick={() => setMode('3d')}>3D part</button>
            <span>{previewPackage ? 'Unsaved region preview' : sheet?.title}</span>
          </div>
          {mode === 'drawings' && <div className="sd-authoring-tools" role="group" aria-label="Drawing interaction mode">
            <Button variant="quiet" aria-pressed={!authoring && !drawIntent && !formChanged} disabled={!!busy || !!drawIntent || formChanged} onClick={() => setAuthoring(false)}>Inspect views</Button>
            <Button variant="quiet" aria-pressed={authoring && !drawIntent} disabled={!!busy} onClick={() => { setAuthoring(true); setDrawIntent(null); }}>Edit source regions</Button>
            <Button variant="secondary" aria-pressed={!!drawIntent} disabled={!!busy} onClick={() => startDraw({ kind: 'new' })}>Draw region</Button>
            {drawIntent && <Button variant="quiet" disabled={!!busy} onClick={() => setDrawIntent(null)}>Cancel drawing</Button>}
          </div>}
          {mode === 'drawings' && (authoring || drawIntent || formChanged
            ? <SourceDrawingEditor assetStore={repository.assetStore} drawIntent={drawIntent} onDraw={finishDraw} onCancelDraw={() => setDrawIntent(null)} draftBounds={draftBounds} pkg={previewPackage || pkg} sheetId={selection.sheetId} regionId={selection.regionId} onSelect={id => choose({ sheetId: selection.sheetId, regionId: id })} />
            : <DrawingPreview assetStore={repository.assetStore} pkg={pkg} presentationSnapshot={draft.presentationSnapshot} sheetId={selection.sheetId} regionId={selection.regionId} onSelect={id => choose({ sheetId: selection.sheetId, regionId: id })} />)}
          {mode === '3d' && <ModelPreview entry={entry} partId={form.partId} explorerURL={explorerURL} onPartSelect={id => { if (id !== current.current.form.partId) edit('partId', id); }} />}
        </section>
        <form className="sd-region-editor" onSubmit={event => event.preventDefault()} aria-label="Edit drawing association">
          <div className="sd-editor-title"><p className="ar-eyebrow">SELECTED DETAIL</p><Status tone={formChanged || region?.mappingStatus !== 'confirmed' ? 'active' : 'neutral'}>{formChanged ? 'Edited · not confirmed' : labels[region?.mappingStatus] || 'Not linked'}</Status></div>
          <Field label="Detail name" value={form.label} onChange={event => edit('label', event.target.value)} disabled={!!busy || !region} maxLength={160} />
          <Field label="Linked model part" value={form.partId} options={partOptions} onChange={event => edit('partId', event.target.value)} disabled={!!busy || !region} />
          <Button variant="secondary" disabled={!!busy || !region} onClick={() => startDraw({ kind: 'redraw' })}>Redraw selected region</Button>
          <details className="sd-coordinate-details"><summary>Region coordinates</summary><fieldset className="sd-bounds"><legend>Region on the source page</legend><p>Page units from the upper-left corner. These are drawing coordinates, not part dimensions.</p>
            {['Left', 'Top', 'Width', 'Height'].map((label, index) => <Field key={label} label={label} type="number" inputMode="decimal" step="any" value={form.bounds[index]} onChange={event => { const values = [...form.bounds]; values[index] = event.target.value; edit('bounds', values); }} disabled={!!busy || !region} />)}
          </fieldset></details>
          <Field label="Association note" textarea optional value={form.note} onChange={event => edit('note', event.target.value)} disabled={!!busy || !region} maxLength={1000} rows={2} />
          {!removeIntent?.unplacedId && removalPrompt}
          <Button variant="quiet" onClick={() => setRemoveIntent({ label: region.label })} disabled={!!busy || !region}>Remove region</Button>
          <Button variant="secondary" onClick={previewRegion} disabled={!!busy || !region}>Preview region</Button>
          <ActionGroup><Button variant="quiet" onClick={() => { setForm(regionForm(region)); setPreviewPackage(null); setError(null); }} disabled={!!busy || !formChanged}>Cancel edit</Button>
            <Button variant="secondary" icon="check" onClick={confirmMapping} pending={busy === 'confirm'} disabled={!!busy && busy !== 'confirm' || !region}>Confirm mapping</Button></ActionGroup>
        </form>
      </div></>}
      {pkg.pairing.status === 'unverified' && <Section className="sd-pairing" title="Confirm the source pairing" description="Record why this drawing and model belong to the same source version. This confirms the association, not manufacturing approval.">
        <Field label="Pairing evidence" textarea value={evidence} onChange={event => setEvidence(event.target.value)} rows={2} placeholder="For example, both source files came from the same pinned engineering package." />
        <Button variant="secondary" disabled={!!busy} onClick={() => run('pairing', async () => { setDraft(confirmDrawingPairing(staged(), entry, evidence)); setMessage('Source pairing confirmed in this draft.'); })}>Confirm source pairing</Button>
      </Section>}
      <details className="sd-history"><summary>Release history <span>{history.length} local {history.length === 1 ? 'release' : 'releases'}</span></summary>
        {!history.length ? <p>No releases yet. Review and publish the current draft to create the first fixed version.</p> : history.map(item => <div className="sd-history-row" key={item.id}><div><strong>Release {item.version}</strong><span>{item.packageSnapshot.revisionLabel || item.sourceRevision} · {dateLabel(item.createdAt)}</span></div><Button variant="quiet" icon="arrow" onClick={async () => { if (await guard()) { setRelease(item); setStage('history'); } }}>View release</Button></div>)}
      </details>
    </>}
    {draft && stage === 'review' && review && <>
      <Section title="The customer will receive this exact version." description="Check the views, clickable details, linked parts and original source before publishing.">
        <div className="sd-review-meta"><div><span>Product</span><strong>{entry.title}</strong></div><div><span>Source drawing</span><strong>{review.draft.packageSnapshot.revisionLabel || review.draft.packageSnapshot.revision}</strong></div><div><span>Associations</span><strong>{summary.total} confirmed</strong></div><div><span>Overview</span><strong>{review.draft.presentationSnapshot ? `${review.draft.presentationSnapshot.sheets.reduce((sum, item) => sum + item.views.length, 0)} prepared views` : 'Original source'}</strong></div></div>
        <ReviewDrawing pkg={review.draft.packageSnapshot} presentationSnapshot={review.draft.presentationSnapshot} assetStore={repository.assetStore} initialSelection={selection} />
        <OverviewComparison before={precedingOverview(entry, review, history)} after={review.draft.presentationSnapshot} beforeLabel={review.baseReleaseId ? 'Previous release' : 'Prepared overview'} />
        <MappingTable pkg={review.draft.packageSnapshot} entry={entry} />
        <MappingComparison before={history.find(item => item.id === review.baseReleaseId)?.packageSnapshot || entry.package} after={review.draft.packageSnapshot} entry={entry} beforeLabel={review.baseReleaseId ? "Previous release" : "Prepared package"} />
        <p className="sd-hint">{review.draft.packageSnapshot.pairing.evidence}</p>
        {review.issues.filter(item => item.severity === 'warning').map((item, index) => <Notice key={index}>{item.message}</Notice>)}
      </Section>
      <label className="sd-confirm"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} disabled={!!busy} /><span>I checked the overview, clickable details and source versions. Publish this fixed release.</span></label>
      <div className="sd-action-bar"><p>Publishing creates a browser-local demo release. It does not replace a drawing or update an existing customer project.</p><ActionGroup>
        <Button variant="secondary" icon="back" disabled={!!busy} onClick={() => { setStage('edit'); setReview(null); }}>Back to draft</Button>
        <Button icon="arrow" onClick={publish} pending={busy === 'publish'} pendingLabel="Publishing…" disabled={!confirmed || !!busy && busy !== 'publish'}>Publish local release</Button>
      </ActionGroup></div>
    </>}
    {draft && ['published', 'history'].includes(stage) && release && <>
      {stage === 'published' && <Notice title={`Release ${release.version} is ready.`} role="status">The overview, original drawing and associations are preserved. New inquiries can use this release; existing projects keep their saved versions.</Notice>}
      <Section title={entry.title} description={`${release.packageSnapshot.revisionLabel || release.sourceRevision} · Published ${dateLabel(release.createdAt)}`}>
        <ReviewDrawing key={release.id} pkg={release.packageSnapshot} presentationSnapshot={recordedOverview(entry, release)} assetStore={repository.assetStore} initialSelection={selection} />
        <OverviewComparison before={precedingOverview(entry, release, history)} after={recordedOverview(entry, release)} beforeLabel={release.baseReleaseId ? 'Previous release' : 'Prepared overview'} />
        <MappingTable pkg={release.packageSnapshot} entry={entry} />
        <MappingComparison before={release.previousPackageSnapshot || history.find(item => item.id === release.baseReleaseId)?.packageSnapshot} after={release.packageSnapshot} entry={entry} beforeLabel={release.baseReleaseId ? "Previous release" : "Prepared package"} />
        <details className="sd-version-details"><summary>Version and source details</summary><dl><dt>Release</dt><dd>{release.id}</dd><dt>Overview version</dt><dd>{release.presentationRevision || release.presentationSnapshot?.revision || 'Original source / earlier presentation'}</dd><dt>Model version</dt><dd>{release.modelRevision}</dd><dt>Mapping version</dt><dd>{release.mappingRevision}</dd><dt>Source pairing</dt><dd>{release.packageSnapshot.pairing.evidence}</dd></dl></details>
      </Section>
      <div className="sd-action-bar"><p>This release is read-only. Further edits create a new reviewed version.</p><ActionGroup><Button variant="secondary" icon="back" disabled={!!busy} onClick={() => { setStage('edit'); setError(null); }}>Back to draft</Button><Button variant="secondary" onClick={downloadRelease} pending={busy === 'export'} disabled={!!busy && busy !== 'export'}>Export release</Button>{onPreview && <Button icon="arrow" onClick={() => previewBuyer(release)} pending={busy === 'preview'} disabled={!!busy && busy !== 'preview'}>Open buyer preview</Button>}</ActionGroup></div>
    </>}
    <p className="sd-demo-note">Local demo · Saved in this browser. Existing customer projects keep their published versions.</p>
    {leave && <div className="sd-dialog-backdrop"><div ref={dialog} tabIndex="-1" className="sd-leave-dialog" role="dialog" aria-modal="true" aria-labelledby="sd-leave-title"><h2 id="sd-leave-title">Keep your drawing edits?</h2><p>Save the draft to continue later, or discard the edits since the last save.</p>{error && <Notice kind="error" title="Draft not saved">{error.message}</Notice>}<ActionGroup>
      <Button variant="quiet" onClick={() => finishLeave(false)} disabled={!!busy}>Keep editing</Button>
      <Button variant="secondary" onClick={() => { setDraft(copyDrawingValue(saved)); const target = saved.packageSnapshot.sheets.find(item => item.id === selection.sheetId)?.regions.find(item => item.id === selection.regionId); setForm(regionForm(target)); finishLeave(true); }} disabled={!!busy}>Discard edits</Button>
      <Button onClick={() => run('leave', async () => { await saveCurrent(); finishLeave(true); })} pending={busy === 'leave'} disabled={!!busy && busy !== 'leave'}>Save and continue</Button>
    </ActionGroup></div></div>}
  </section>;
});

export function mountDrawingWorkspace(element, options = {}) {
  const root = createRoot(element), ref = React.createRef();
  root.render(<DrawingWorkspace {...options} ref={ref} />);
  return { beforeLeave: () => ref.current?.beforeLeave() ?? Promise.resolve(true), dispose() { root.unmount(); } };
}
