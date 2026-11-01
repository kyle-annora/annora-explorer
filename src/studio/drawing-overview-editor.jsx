import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Field, Notice, Status } from '../product-room/ui/components.jsx';
import { DrawingPreview } from '../drawings/DrawingPreview.jsx';
import { overviewAssociationKey, overviewPresentationIssues, reviseOverviewPresentation } from '../drawings/overview-presentation.js';
import './drawing-overview-editor.css';

const copy = value => JSON.parse(JSON.stringify(value));

/** Seller configuration uses the same reader as Product Room. Geometry and
 * source coordinates remain in their prepared/source packages. */
export function DrawingOverviewEditor({ draft, entry, assetStore, disabled = false, onChange, onOpenAssociation }) {
  const pkg = draft.packageSnapshot, snapshot = draft.presentationSnapshot;
  const library = entry.overviewViews || [], preview = useRef(null), drag = useRef(null);
  const [sheetId, setSheetId] = useState(snapshot?.sheets[0]?.sheetId || pkg.sheets[0]?.id);
  const [selectedId, setSelectedId] = useState(snapshot?.sheets[0]?.views[0]?.id || '');
  const [candidate, setCandidate] = useState(''), [mobilePanel, setMobilePanel] = useState('views');
  const [previewKind, setPreviewKind] = useState('overview'), [feedback, setFeedback] = useState('');
  const [previewSelection, setPreviewSelection] = useState(null);
  const [previewContent, setPreviewContent] = useState(() => ({ pkg, snapshot }));
  // Keep typing immediate without rebuilding every SVG reader for each letter.
  // Changes to source, order or links bypass the title-only preview delay.
  const previewStructure = JSON.stringify({ source: snapshot?.sourceKey, mapping: pkg.mappingRevision,
    sheets: snapshot?.sheets.map(item => ({ ...item, views: item.views.map(({ title, ...view }) => view) })) });
  const previousStructure = useRef(previewStructure);
  useEffect(() => {
    if (previousStructure.current !== previewStructure) {
      previousStructure.current = previewStructure;
      setPreviewContent({ pkg, snapshot });
      return;
    }
    const timer = setTimeout(() => setPreviewContent({ pkg, snapshot }), 150);
    return () => clearTimeout(timer);
  }, [pkg, snapshot, previewStructure]);
  const sheet = snapshot?.sheets.find(item => item.sheetId === sheetId) || snapshot?.sheets[0];
  const sourceSheet = pkg.sheets.find(item => item.id === sheet?.sheetId);
  const selected = sheet?.views.find(item => item.id === selectedId) || sheet?.views[0];
  const sourceView = library.find(item => item.id === selected?.id);
  const available = library.filter(item => item.sheetId === sheet?.sheetId && !sheet?.views.some(view => view.id === item.id));
  const issues = useMemo(() => snapshot ? overviewPresentationIssues(snapshot, pkg, library) : [], [snapshot, pkg, library]);
  const previewRegion = previewSelection || selected?.targets.find(target => target.confirmed)?.regionId || sourceView?.defaultRegionId || sourceSheet?.regions[0]?.id;

  useEffect(() => {
    if (!snapshot?.sheets.some(item => item.sheetId === sheetId)) setSheetId(snapshot?.sheets[0]?.sheetId || pkg.sheets[0]?.id);
  }, [snapshot, pkg, sheetId]);
  useEffect(() => {
    if (!sheet?.views.some(item => item.id === selectedId)) setSelectedId(sheet?.views[0]?.id || '');
  }, [sheet, selectedId]);
  useEffect(() => {
    if (previewKind === 'selected' && selected) preview.current?.setPresentation(selected.id);
  }, [selected?.id, previewKind]);

  function changeSheet(next) {
    setSheetId(next); setSelectedId(snapshot.sheets.find(item => item.sheetId === next)?.views[0]?.id || '');
    setCandidate(''); setPreviewSelection(null); setPreviewKind('overview'); setFeedback(''); preview.current?.setPresentation('overview');
  }
  function updateSheet(change, message = '') {
    if (disabled || !snapshot || !sheet) return;
    const sheets = copy(snapshot.sheets), next = sheets.find(item => item.sheetId === sheet.sheetId);
    try { change(next); onChange(reviseOverviewPresentation(snapshot, { sheets })); setFeedback(message); }
    catch (error) { setFeedback(error.message || 'Check the overview configuration before continuing.'); }
  }
  function updateView(change, message = '') {
    updateSheet(next => { const view = next.views.find(item => item.id === selected?.id); if (view) change(view); }, message);
  }
  function selectView(id) { setSelectedId(id); setPreviewSelection(null); setFeedback(''); if (previewKind === 'selected') preview.current?.setPresentation(id); }
  function moveView(id, to) {
    const from = sheet.views.findIndex(view => view.id === id);
    if (from < 0 || to < 0 || to >= sheet.views.length || from === to) return;
    updateSheet(next => { const [moved] = next.views.splice(from, 1); next.views.splice(to, 0, moved); }, `View moved to position ${to + 1}.`);
  }
  function addView() {
    const item = available.find(view => view.id === (candidate || available[0]?.id));
    if (!item || sheet.views.length >= 8) return;
    updateSheet(next => {
      next.views.push({ id: item.id, viewRevision: item.viewRevision, title: item.title,
        targets: item.profile.regions.flatMap(region => {
          const canonical = sourceSheet?.regions.find(target => target.id === region.id);
          return canonical ? [{ targetId: region.id, regionId: region.id,
            associationKey: overviewAssociationKey(pkg, sheet.sheetId, region.id), confirmed: canonical.mappingStatus === 'confirmed' }] : [];
        }) });
      if (!next.defaultViewId) next.defaultViewId = item.id;
    }, 'View added to this draft.');
    setSelectedId(item.id); setCandidate('');
  }
  function removeView() {
    if (!selected) return;
    updateSheet(next => { next.views = next.views.filter(item => item.id !== selected.id); if (next.defaultViewId === selected.id) next.defaultViewId = next.views[0]?.id || null; }, 'View removed from this overview. Earlier releases keep it.');
    setPreviewKind('overview'); preview.current?.setPresentation('overview');
  }
  function setTarget(targetId, values, message = '') {
    updateView(view => {
      let target = view.targets.find(item => item.targetId === targetId);
      if (!target) { target = { targetId, regionId: targetId, confirmed: false, associationKey: overviewAssociationKey(pkg, sheet.sheetId, targetId) }; view.targets.push(target); }
      Object.assign(target, values);
    }, message);
  }

  if (!snapshot) return <div className="so-empty"><Notice title="This source uses its original drawing.">
    <p>A prepared overview is not available for this source version. Its PDF and part associations remain available; views from an earlier drawing will not replace it.</p>
    <Button variant="secondary" onClick={() => onOpenAssociation?.({ sheetId: pkg.sheets[0]?.id, regionId: pkg.sheets[0]?.regions[0]?.id })}>Review source associations</Button>
  </Notice></div>;

  return <section className="so-editor" aria-label="Configure drawing overview" data-mobile-panel={mobilePanel}>
    <div className="so-toolbar"><div><strong>Drawing overview</strong><span>Arrange views, then confirm the details customers can select.</span></div>
      {snapshot.sheets.length > 1 && <Field label="Overview sheet" value={sheet?.sheetId || ''} options={snapshot.sheets.map((item, index) => [item.sheetId, `Sheet ${index + 1} of ${snapshot.sheets.length}`])} onChange={event => changeSheet(event.target.value)} disabled={disabled} />}
    </div>
    <div className="so-mobile-tabs" role="group" aria-label="Overview editor panel">{[['views', 'Views'], ['preview', 'Preview'], ['settings', 'Settings']].map(([id, label]) => <button key={id} type="button" aria-pressed={mobilePanel === id} onClick={() => setMobilePanel(id)}>{label}</button>)}</div>
    <div className="so-layout">
      <aside className="so-views" aria-label="Overview views">
        <div className="so-section-heading"><h3>Views</h3><span>{sheet?.views.length || 0} / 8</span></div>
        <ol className="so-view-list">{sheet?.views.map((view, index) => <li key={view.id} data-selected={selected?.id === view.id || undefined}
          onDragOver={event => { if (drag.current && !disabled) event.preventDefault(); }} onDrop={event => { event.preventDefault(); if (drag.current) moveView(drag.current, index); drag.current = null; }}>
          <button type="button" className="so-view-select" aria-current={selected?.id === view.id ? 'true' : undefined} onClick={() => selectView(view.id)} disabled={disabled}>
            <span className="so-view-number">{String(index + 1).padStart(2, '0')}</span><span><strong>{view.title || 'Untitled view'}</strong><small>{sheet.defaultViewId === view.id ? 'Opens first · ' : ''}{view.targets.length} {view.targets.length === 1 ? 'linked detail' : 'linked details'}</small></span>
          </button>
          <div className="so-order-controls"><span className="so-drag-handle" draggable={!disabled} role="img" aria-label={`Drag ${view.title} to reorder`} title="Drag to reorder" onDragStart={event => { drag.current = view.id; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', view.id); }} onDragEnd={() => { drag.current = null; }}>⠿</span>
            <button type="button" aria-label={`Move ${view.title} up`} disabled={disabled || index === 0} onClick={() => moveView(view.id, index - 1)}>↑</button>
            <button type="button" aria-label={`Move ${view.title} down`} disabled={disabled || index === sheet.views.length - 1} onClick={() => moveView(view.id, index + 1)}>↓</button>
          </div>
        </li>)}</ol>
        {!sheet?.views.length && <p className="so-hint">Add a prepared view to compose this sheet.</p>}
        {!!available.length && <div className="so-add-view"><Field label="Add a prepared view" value={candidate || available[0]?.id || ''} options={available.map(item => [item.id, item.title])} onChange={event => setCandidate(event.target.value)} disabled={disabled || sheet.views.length >= 8} /><Button variant="secondary" icon="plus" onClick={addView} disabled={disabled || sheet.views.length >= 8}>Add view</Button></div>}
        <p className="so-hint">Order applies to the overview. “Opens first” chooses the initial view on smaller screens.</p>
      </aside>
      <div className="so-preview" aria-label="Customer overview preview"><div className="so-preview-toolbar"><strong>Customer preview</strong><div role="group" aria-label="Preview scope"><button type="button" aria-pressed={previewKind === 'overview'} onClick={() => { setPreviewKind('overview'); preview.current?.setPresentation('overview'); }}>Overview</button><button type="button" aria-pressed={previewKind === 'selected'} disabled={!selected} onClick={() => { setPreviewKind('selected'); preview.current?.setPresentation(selected.id); }}>Selected view</button></div></div>
        {!!sheet?.views.length ? <DrawingPreview ref={preview} key={`${draft.id}:${sheet.sheetId}`} pkg={previewContent.pkg} presentationSnapshot={previewContent.snapshot} allowUnconfirmed sheetId={sheet.sheetId} regionId={previewRegion} assetStore={assetStore} onSelect={setPreviewSelection} caption="Draft preview. Test a view or linked detail before reviewing this release." /> : <div className="so-empty-canvas">No views selected for this sheet.</div>}
      </div>
      <aside className="so-settings" aria-label="Selected overview view settings">
        <div className="so-section-heading"><h3>Selected view</h3></div>
        {selected && <><Field label="View title" value={selected.title} maxLength={120} onChange={event => updateView(view => { view.title = event.target.value; })} disabled={disabled} />
          <label className="so-check"><input type="checkbox" checked={sheet.defaultViewId === selected.id} disabled={disabled || sheet.defaultViewId === selected.id} onChange={() => updateSheet(next => { next.defaultViewId = selected.id; }, 'Initial view updated.')} /><span>Open this view first</span></label>
          <p className="so-hint">Titles describe the view. Engineering dimensions remain unchanged.</p>
          <div className="so-targets"><h4>Clickable details</h4>{(sourceView?.profile.regions || []).map(region => {
            const target = selected.targets.find(item => item.targetId === region.id), linked = sourceSheet?.regions.find(item => item.id === target?.regionId);
            const candidates = sourceSheet?.regions.filter(item => !selected.targets.some(other => other.targetId !== region.id && other.regionId === item.id)) || [];
            const defaultTarget = candidates.find(item => item.id === region.id) || candidates[0];
            const currentKey = linked ? overviewAssociationKey(pkg, sheet.sheetId, linked.id) : null;
            const confirmed = target?.confirmed && target.associationKey === currentKey && linked?.mappingStatus === 'confirmed';
            return <div className="so-target" key={region.id}>
              <label className="so-check"><input type="checkbox" checked={!!target} disabled={disabled || !target && !defaultTarget} onChange={event => event.target.checked ? setTarget(region.id, { regionId: defaultTarget.id, associationKey: overviewAssociationKey(pkg, sheet.sheetId, defaultTarget.id), confirmed: false }) : updateView(view => { view.targets = view.targets.filter(item => item.targetId !== region.id); }, 'Clickable detail removed from this draft.')} /><span>{region.label || region.id}</span></label>
              {target && <><Field label={`Source detail for ${region.label || region.id}`} value={target.regionId} options={candidates.map(item => [item.id, `${item.label}${item.mappingStatus !== 'confirmed' ? ' · needs review' : ''}`])} onChange={event => setTarget(region.id, { regionId: event.target.value, associationKey: overviewAssociationKey(pkg, sheet.sheetId, event.target.value), confirmed: false })} disabled={disabled} />
                <div className="so-target-meta"><span>Part</span><strong>{entry.model.parts.find(part => part.id === linked?.partId)?.title || linked?.partId || 'Not linked'}</strong></div>
                <Status tone={confirmed ? 'neutral' : 'active'}>{confirmed ? 'Link confirmed' : 'Confirm this link'}</Status>
                <Button variant="secondary" onClick={() => setTarget(region.id, { confirmed: true, associationKey: currentKey }, `${region.label || region.id} link confirmed.`)} disabled={disabled || confirmed || linked?.mappingStatus !== 'confirmed'} aria-label={`Confirm ${region.label || region.id} link`}>Confirm link</Button>
                <Button variant="quiet" icon="external" disabled={disabled} onClick={() => onOpenAssociation?.({ sheetId: sheet.sheetId, regionId: target.regionId })}>Inspect source association</Button>
              </>}
            </div>;
          })}{!sourceView?.profile.regions.length && <p className="so-hint">This view has no prepared interactive details.</p>}</div>
          <Button variant="quiet" disabled={disabled} onClick={removeView}>Remove from overview</Button>
        </>}
        {!selected && <p className="so-hint">Choose or add a view to edit its settings.</p>}
      </aside>
    </div>
    <div className="so-status" role="status"><span>{feedback || 'Changes remain in the draft until you review and publish.'}</span><span>{issues.filter(item => item.severity === 'error').length ? `${issues.filter(item => item.severity === 'error').length} items need review` : 'Overview ready for review'}</span></div>
    {!!issues.length && <details className="so-issues"><summary>Overview checks ({issues.length})</summary><ul>{issues.map((item, index) => <li key={`${item.path}:${index}`}>{item.message}</li>)}</ul></details>}
  </section>;
}
