import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Field, Glyph, Notice } from '../product-room/ui/components.jsx';
import { DrawingPreview } from '../drawings/DrawingPreview.jsx';
import { overviewAssociationKey, overviewPresentationIssues, reviseOverviewPresentation } from '../drawings/overview-presentation.js';
import './drawing-overview-editor.css';

const copy = value => JSON.parse(JSON.stringify(value));

/** Seller configuration uses the same reader as Product Room. Geometry and
 * source coordinates remain in their prepared/source packages. */
export function DrawingOverviewEditor({ draft, entry, assetStore, disabled = false, onChange, onOpenAssociation, workspaceControl }) {
  const pkg = draft.packageSnapshot, snapshot = draft.presentationSnapshot;
  const library = entry.overviewViews || [], preview = useRef(null), drag = useRef(null), arrangeDialog = useRef(null), editor = useRef(null), focusOpenedView = useRef(false);
  const [sheetId, setSheetId] = useState(snapshot?.sheets[0]?.sheetId || pkg.sheets[0]?.id);
  const [selectedId, setSelectedId] = useState(snapshot?.sheets[0]?.views[0]?.id || '');
  const [candidate, setCandidate] = useState(''), [mobilePanel, setMobilePanel] = useState('preview');
  const [arranging, setArranging] = useState(false), [presentation, setPresentation] = useState('overview'), [feedback, setFeedback] = useState('');
  const [previewSelection, setPreviewSelection] = useState(null);
  const [expandedTarget, setExpandedTarget] = useState(''), [addViewOpen, setAddViewOpen] = useState(false);
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
  const editingView = !!selected && presentation === selected.id;
  useEffect(() => {
    const dialog = arrangeDialog.current;
    if (!dialog) return;
    if (arranging && !dialog.open) dialog.showModal();
    else if (!arranging && dialog.open) dialog.close();
  }, [arranging]);

  useEffect(() => { setExpandedTarget(''); }, [selected?.id, sheet?.sheetId]);
  useEffect(() => {
    if (arranging || !editingView || !focusOpenedView.current) return;
    focusOpenedView.current = false;
    const frame = requestAnimationFrame(() => {
      const editButton = editor.current?.querySelector('.so-edit-trigger');
      const target = editButton?.getClientRects().length ? editButton : editor.current?.querySelector('[aria-label="Drawing view"]');
      target?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [arranging, editingView, presentation]);

  function changeSheet(next) {
    setSheetId(next); setSelectedId(snapshot.sheets.find(item => item.sheetId === next)?.views[0]?.id || '');
    setCandidate(''); setAddViewOpen(false); setPreviewSelection(null); setPresentation('overview'); setMobilePanel('preview'); setFeedback(''); preview.current?.setPresentation('overview');
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
  function selectView(id) { focusOpenedView.current = true; setSelectedId(id); setPreviewSelection(null); setFeedback(''); setArranging(false); setMobilePanel('preview'); preview.current?.setPresentation(id); }
  function followPresentation(id) {
    setPresentation(id);
    if (sheet?.views.some(view => view.id === id)) setSelectedId(id);
    else setMobilePanel('preview');
  }
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
    setCandidate(''); setAddViewOpen(false);
  }
  function removeView() {
    if (!selected) return;
    updateSheet(next => { next.views = next.views.filter(item => item.id !== selected.id); if (next.defaultViewId === selected.id) next.defaultViewId = next.views[0]?.id || null; }, 'View removed from this overview. Earlier releases keep it.');
    setPresentation('overview'); setMobilePanel('preview'); preview.current?.setPresentation('overview');
  }
  function setTarget(targetId, values, message = '') {
    updateView(view => {
      let target = view.targets.find(item => item.targetId === targetId);
      if (!target) { target = { targetId, regionId: targetId, confirmed: false, associationKey: overviewAssociationKey(pkg, sheet.sheetId, targetId) }; view.targets.push(target); }
      Object.assign(target, values);
    }, message);
  }

  if (!snapshot) return <div className="so-empty"><div className="so-toolbar">{workspaceControl}</div><Notice title="This source uses its original drawing.">
    <p>A prepared overview is not available for this source version. Its PDF and part associations remain available; views from an earlier drawing will not replace it.</p>
    <Button variant="secondary" onClick={() => onOpenAssociation?.({ sheetId: pkg.sheets[0]?.id, regionId: pkg.sheets[0]?.regions[0]?.id })}>Review source associations</Button>
  </Notice></div>;

  return <section ref={editor} className="so-editor" aria-label="Configure drawing overview" data-mobile-panel={mobilePanel} data-editing-view={editingView || undefined}>
    <div className="so-toolbar">
      {workspaceControl}
      {snapshot.sheets.length > 1 && <label className="so-sheet-select"><span>Sheet</span><select aria-label="Overview sheet" value={sheet?.sheetId || ''} onChange={event => changeSheet(event.target.value)} disabled={disabled}>{snapshot.sheets.map((item, index) => <option key={item.sheetId} value={item.sheetId}>{index + 1} of {snapshot.sheets.length}</option>)}</select></label>}
      <div className="so-toolbar-actions">
        <Button className="so-arrange-trigger" variant="quiet" onClick={() => setArranging(true)} disabled={disabled} aria-haspopup="dialog">Arrange views</Button>
        {editingView && <Button className="so-edit-trigger" variant="secondary" onClick={() => setMobilePanel(mobilePanel === 'settings' ? 'preview' : 'settings')}>{mobilePanel === 'settings' ? 'Back to drawing' : 'Edit view'}</Button>}
      </div>
    </div>
    <div className="so-layout">
      <div className="so-preview" aria-label="Customer overview preview">
        {!!sheet?.views.length ? <DrawingPreview ref={preview} key={`${draft.id}:${sheet.sheetId}`} pkg={previewContent.pkg} presentationSnapshot={previewContent.snapshot} allowUnconfirmed sheetId={sheet.sheetId} regionId={previewRegion} assetStore={assetStore} onSelect={setPreviewSelection} onPresentationChange={followPresentation} caption={editingView ? "Changes stay in the draft until reviewed and published." : "Open a view to edit its title and linked details."} /> : <div className="so-empty-canvas"><p>No views selected for this sheet.</p><Button variant="secondary" onClick={() => setArranging(true)}>Add views</Button></div>}
      </div>
      {editingView && <aside className="so-settings" aria-label="Selected overview view settings">
        <div className="so-inspector-heading"><span>View settings</span><h3>{selected?.title || 'No view selected'}</h3></div>
        {selected && <><div className="so-view-fields"><Field label="View title" value={selected.title} maxLength={120} onChange={event => updateView(view => { view.title = event.target.value; })} disabled={disabled} />
          <label className="so-check"><input type="checkbox" checked={sheet.defaultViewId === selected.id} disabled={disabled || sheet.defaultViewId === selected.id} onChange={() => updateSheet(next => { next.defaultViewId = selected.id; }, 'Initial view updated.')} /><span>Open this view first<small>Initial view on smaller screens.</small></span></label></div>
          <div className="so-targets"><div className="so-section-heading"><h4>Clickable details</h4><span>{selected.targets.length}</span></div>{(sourceView?.profile.regions || []).map(region => {
            const target = selected.targets.find(item => item.targetId === region.id), linked = sourceSheet?.regions.find(item => item.id === target?.regionId);
            const candidates = sourceSheet?.regions.filter(item => !selected.targets.some(other => other.targetId !== region.id && other.regionId === item.id)) || [];
            const defaultTarget = candidates.find(item => item.id === region.id) || candidates[0];
            const currentKey = linked ? overviewAssociationKey(pkg, sheet.sheetId, linked.id) : null;
            const confirmed = target?.confirmed && target.associationKey === currentKey && linked?.mappingStatus === 'confirmed';
            const expanded = !!target && expandedTarget === region.id;
            const label = region.label || region.id, panelId = `overview-link-${selected.id}-${region.id}`;
            return <div className="so-target" key={region.id} data-expanded={expanded || undefined}>
              <div className="so-target-row"><label className="so-target-include"><input type="checkbox" aria-label={label} checked={!!target} disabled={disabled || !target && !defaultTarget} onChange={event => {
                if (event.target.checked) { setTarget(region.id, { regionId: defaultTarget.id, associationKey: overviewAssociationKey(pkg, sheet.sheetId, defaultTarget.id), confirmed: false }); setExpandedTarget(region.id); }
                else { updateView(view => { view.targets = view.targets.filter(item => item.targetId !== region.id); }, 'Clickable detail removed from this draft.'); if (expandedTarget === region.id) setExpandedTarget(''); }
              }} /></label>
                <button type="button" className="so-target-toggle" aria-label={`${label} link details`} aria-expanded={expanded} aria-controls={panelId} disabled={disabled || !target} onClick={() => setExpandedTarget(expanded ? '' : region.id)}><span><strong>{label}</strong><small data-state={target ? confirmed ? 'confirmed' : 'review' : 'excluded'}>{target ? confirmed ? 'Link confirmed' : 'Needs review' : 'Not included'}</small></span><Glyph name="plus" /></button>
              </div>
              {target && <div id={panelId} className="so-target-detail" hidden={!expanded}><Field label={`Source detail for ${label}`} value={target.regionId} options={candidates.map(item => [item.id, `${item.label}${item.mappingStatus !== 'confirmed' ? ' · needs review' : ''}`])} onChange={event => setTarget(region.id, { regionId: event.target.value, associationKey: overviewAssociationKey(pkg, sheet.sheetId, event.target.value), confirmed: false })} disabled={disabled} />
                <div className="so-target-meta"><span>Linked part</span><strong>{entry.model.parts.find(part => part.id === linked?.partId)?.title || linked?.partId || 'Not linked'}</strong></div>
                {!confirmed && <><Button variant="secondary" onClick={() => setTarget(region.id, { confirmed: true, associationKey: currentKey }, `${label} link confirmed.`)} disabled={disabled || linked?.mappingStatus !== 'confirmed'} aria-label={`Confirm ${label} link`}>Confirm link</Button>{linked?.mappingStatus !== 'confirmed' && <p className="so-hint">Confirm the source association before confirming this link.</p>}</>}
                <Button variant="quiet" icon="external" disabled={disabled} onClick={() => onOpenAssociation?.({ sheetId: sheet.sheetId, regionId: target.regionId })}>Inspect source association</Button>
              </div>}
            </div>;
          })}{!sourceView?.profile.regions.length && <p className="so-hint">This view has no prepared interactive details.</p>}</div>
          <Button className="so-remove-view" variant="quiet" disabled={disabled} onClick={removeView}>Remove from overview</Button>
        </>}
        {!selected && <p className="so-hint">Choose or add a view to edit its settings.</p>}
      </aside>}
    </div>
    <dialog ref={arrangeDialog} className="so-arrange-dialog" aria-labelledby="so-arrange-title" onCancel={event => { event.preventDefault(); setArranging(false); }} onClose={() => setArranging(false)}>
      <header><div><h2 id="so-arrange-title">Arrange views</h2><p>Set the order customers see. Open a view to edit it.</p></div><Button variant="quiet" aria-label="Close view arrangement" onClick={() => setArranging(false)}>×</Button></header>
      <ol className="so-view-list">{sheet?.views.map((view, index) => <li key={view.id}
        onDragOver={event => { if (drag.current && !disabled) event.preventDefault(); }} onDrop={event => { event.preventDefault(); if (drag.current) moveView(drag.current, index); drag.current = null; }}>
        <span className="so-drag-handle" draggable={!disabled} role="img" aria-label={`Drag ${view.title} to reorder`} title="Drag to reorder" onDragStart={event => { drag.current = view.id; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', view.id); }} onDragEnd={() => { drag.current = null; }}>⠿</span>
        <button type="button" className="so-view-select" aria-label={`Edit ${view.title}`} onClick={() => selectView(view.id)} disabled={disabled}><span className="so-view-number">{String(index + 1).padStart(2, '0')}</span><strong>{view.title || 'Untitled view'}</strong>{sheet.defaultViewId === view.id && <small>First</small>}</button>
        <div className="so-order-controls"><button type="button" aria-label={`Move ${view.title} up`} disabled={disabled || index === 0} onClick={() => moveView(view.id, index - 1)}>↑</button><button type="button" aria-label={`Move ${view.title} down`} disabled={disabled || index === sheet.views.length - 1} onClick={() => moveView(view.id, index + 1)}>↓</button></div>
      </li>)}</ol>
      {!!available.length && <details className="so-add-view" open={addViewOpen} onToggle={event => setAddViewOpen(event.currentTarget.open)}><summary>Add view <Glyph name="plus" /></summary><div><Field label="Add a prepared view" value={candidate || available[0]?.id || ''} options={available.map(item => [item.id, item.title])} onChange={event => setCandidate(event.target.value)} disabled={disabled || sheet.views.length >= 8} /><Button variant="secondary" icon="plus" onClick={addView} disabled={disabled || sheet.views.length >= 8}>Add view</Button></div></details>}
      <footer><span role="status">{feedback || `${sheet?.views.length || 0} views`}</span><Button variant="secondary" onClick={() => setArranging(false)}>Done</Button></footer>
    </dialog>
    {(feedback || issues.length > 0) && <div className="so-status" role="status"><span>{feedback}</span>{issues.filter(item => item.severity === 'error').length > 0 && <span>{issues.filter(item => item.severity === 'error').length} items need review</span>}</div>}
    {!!issues.length && <details className="so-issues"><summary>Overview checks ({issues.length})</summary><ul>{issues.map((item, index) => <li key={`${item.path}:${index}`}>{item.message}</li>)}</ul></details>}
  </section>;
}
