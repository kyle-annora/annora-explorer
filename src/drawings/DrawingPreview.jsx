import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Button, Notice } from '../product-room/ui/components.jsx';
import { createDrawingReader } from './reader.js';
import { sourceAssetFor } from './package.js';
import { overviewEntriesFor, technicalEntriesFor } from '../drawing-preview/technical-catalog.js';
import { createTechnicalDrawingView } from '../drawing-preview/technical-view.js';
import { createDrawingOverview } from './drawing-overview.js';
import { resolveDrawingAssets } from '../studio/drawing-asset-store.js';
import './drawing-overview.css';
import './drawing-preview.css';

/** A display choice never changes a source reference. Studio authors original
 * coordinates; recorded buyer previews keep their selected detail locked. */
export const DrawingPreview = forwardRef(function DrawingPreview({ pkg, sheetId, regionId, onSelect, onError,
  assetStore, assetsResolved = false, sourceOnly = false, unavailable = false, className = '', caption }, ref) {
  const mount = useRef(null), viewer = useRef(null), callbacks = useRef({}), focusIntent = useRef(false);
  const focusDestination = useRef(null), lastOpened = useRef(null), viewSelect = useRef(null), backButton = useRef(null), sourceLink = useRef(null);
  const [requested, setRequested] = useState('overview');
  const [state, setState] = useState({ loading: true, zoom: 1 }), [error, setError] = useState(null), [sourceURL, setSourceURL] = useState(null);
  callbacks.current = { onSelect, onError, regionId };
  const lockedRegion = onSelect ? null : regionId;
  const entries = useMemo(() => sourceOnly ? [] : technicalEntriesFor(pkg, { sheetId, unavailable }), [pkg, sheetId, unavailable, sourceOnly]);
  const pinnedPrepared = !lockedRegion || entries.some(entry => entry.regionIds.includes(lockedRegion));
  const overviewEntries = useMemo(() => sourceOnly || !pinnedPrepared ? [] : overviewEntriesFor(pkg, { sheetId, unavailable }), [pkg, sheetId, unavailable, sourceOnly, pinnedPrepared]);
  const choices = useMemo(() => pinnedPrepared ? [...new Map([...entries, ...overviewEntries].map(entry => [entry.id, entry])).values()] : [], [entries, overviewEntries, pinnedPrepared]);
  const candidate = choices.find(entry => entry.id === requested);
  const prepared = candidate && (onSelect && !candidate.regionIds.includes(regionId)
    ? choices.find(entry => entry.regionIds.includes(regionId)) || candidate : candidate);
  const mode = requested === 'overview' && overviewEntries.length ? 'overview' : prepared && !sourceOnly ? 'detail' : 'source';
  const sheet = pkg?.sheets.find(item => item.id === sheetId);
  const sourceLabel = sheet?.format === 'pdf' ? 'Source PDF' : 'Source drawing';
  const presentation = mode === 'detail' ? prepared.id : mode;
  useImperativeHandle(ref, () => ({
    setPresentation(id) { focusIntent.current = false; setRequested(id); },
    select(id, options) { return viewer.current?.select(id, options) ?? false; },
    focusRegion(id) { return viewer.current?.focusRegion?.(id) ?? false; },
    fit() { viewer.current?.fit?.(); },
    resize() { viewer.current?.resize(); },
  }), []);

  useEffect(() => {
    let active = true, lease, instance;
    setError(null); setSourceURL(null); setState({ loading: true, zoom: 1 });
    const fail = failure => {
      if (!active) return;
      setError(failure.message || 'This drawing reference could not be opened.');
      setState(previous => ({ ...previous, loading: false }));
      callbacks.current.onError?.(failure);
    };
    (async () => {
      let resolved = pkg;
      if (mode === 'source' && !assetsResolved) {
        lease = await resolveDrawingAssets(pkg, { assetStore });
        if (!active) { lease.dispose(); return; }
        resolved = lease.package;
      }
      const options = { mount: mount.current,
        onSelect: id => {
          if (!active) return;
          if (callbacks.current.onSelect) callbacks.current.onSelect(id);
          else instance?.select(callbacks.current.regionId);
          if (mode === 'detail' && id !== 'overview') { instance?.select(id); instance?.setZoom?.(2); }
        },
        onViewChange: next => { if (active) setState(previous => ({ ...previous, ...next })); },
        onError: fail,
      };
      if (mode === 'overview') {
        instance = createDrawingOverview({ ...options, entries: overviewEntries,
          selectedId: callbacks.current.regionId, lockedRegionId: lockedRegion,
          onOpen: ({ entryId, regionId: openedRegion, focus }) => {
            if (!active) return;
            if (callbacks.current.onSelect && openedRegion !== callbacks.current.regionId) callbacks.current.onSelect(openedRegion);
            focusIntent.current = Boolean(focus && openedRegion !== 'overview');
            focusDestination.current = 'detail'; lastOpened.current = entryId;
            setRequested(entryId);
          },
        });
      } else if (mode === 'detail') {
        const profile = lockedRegion ? { ...prepared.profile, regions: prepared.profile.regions.filter(region => region.id === lockedRegion) } : prepared.profile;
        instance = createTechnicalDrawingView({ ...options, profile, artwork: prepared.artwork });
      } else {
        const source = sourceAssetFor(resolved, resolved.sheets.find(item => item.id === sheetId)?.assetId);
        setSourceURL(source?.url || null);
        // A recorded source PDF exposes only the pinned detail as a target.
        if (lockedRegion) resolved = { ...resolved, sheets: resolved.sheets.map(sheet => sheet.id === sheetId
          ? { ...sheet, regions: sheet.regions.filter(region => region.id === lockedRegion) } : sheet) };
        instance = createDrawingReader({ ...options, package: resolved, sheetId, showOverview: true });
      }
      viewer.current = instance;
      instance.select(callbacks.current.regionId);
      await instance.ready;
      if (!active) return;
      instance.select(callbacks.current.regionId);
      if (mode === 'detail' && focusIntent.current) instance.setZoom?.(2);
      focusIntent.current = false;
      setState(previous => ({ ...previous, loading: false }));
      const destination = focusDestination.current;
      focusDestination.current = null;
      if (destination) requestAnimationFrame(() => {
        if (!active) return;
        if (destination === 'detail') viewSelect.current?.focus();
        else if (destination === 'source') (backButton.current || sourceLink.current)?.focus();
        else {
          const tile = [...(instance.element?.querySelectorAll('[data-overview-entry]') || [])].find(node => node.dataset.overviewEntry === lastOpened.current);
          (tile?.querySelector('button') || instance.element?.querySelector('select,button'))?.focus();
        }
      });
    })().catch(fail);
    return () => { active = false; viewer.current = null; instance?.dispose(); lease?.dispose(); };
  }, [pkg, sheetId, prepared, mode, overviewEntries, assetStore, assetsResolved, lockedRegion]);
  useEffect(() => { viewer.current?.select(regionId); }, [regionId]);

  const pending = state.loading || Boolean(error);
  const zoom = value => {
    const instance = viewer.current;
    if (!instance || pending) return;
    if (value === 1) instance.fit();
    else if (instance.setZoom) instance.setZoom(value);
    else instance.zoomBy(value / (instance.zoom || state.zoom || 1));
  };
  function openComposition(id) {
    const next = choices.find(entry => entry.id === id);
    if (!next) return;
    if (onSelect && !next.regionIds.includes(regionId)) onSelect(next.defaultRegionId);
    focusIntent.current = false; setRequested(id);
  }
  const overviewAvailable = overviewEntries.length > 0;
  return <section className={`drawing-preview-surface ${className}`} data-presentation={presentation} data-mode={mode} aria-label="Drawing preview">
    <div className="drawing-preview-heading">
      {mode === 'overview' ? <strong>Drawing overview</strong>
        : overviewAvailable ? <button ref={backButton} type="button" className="drawing-preview-back" onClick={() => { focusIntent.current = false; focusDestination.current = 'overview'; setRequested('overview'); }}>← Back to overview</button>
          : <strong>{sourceLabel}</strong>}
      {mode !== 'source' ? <button type="button" className="drawing-preview-source-link" onClick={() => { focusIntent.current = false; focusDestination.current = 'source'; setRequested('source'); }}>{sourceLabel}</button>
        : sourceURL ? <a ref={sourceLink} className="drawing-preview-source-link" href={sourceURL} target="_blank" rel="noopener noreferrer">Open {sheet?.format === 'pdf' ? 'PDF' : 'source'} <span aria-hidden="true">↗</span></a> : null}
    </div>
    {mode !== 'overview' && <div className="drawing-preview-toolbar">
      {mode === 'detail' ? <label className="drawing-preview-presentation"><span>View</span><select ref={viewSelect} aria-label="Drawing view" value={prepared.id} onChange={event => openComposition(event.target.value)}>
        {choices.map(entry => <option key={entry.id} value={entry.id}>{entry.title || entry.profile.title}</option>)}
      </select></label> : <span className="drawing-preview-source-label">{sourceLabel}</span>}
      <div className="drawing-preview-zoom" role="group" aria-label="Drawing zoom">
        {[1, 2, 4].map(value => <button type="button" key={value} aria-label={`${value} times zoom`} aria-pressed={Math.abs((state.zoom || 1) - value) < .01} disabled={pending} onClick={() => zoom(value)}>{value}×</button>)}
      </div>
      {mode === 'source' && <div className="drawing-preview-source-controls">
        <Button variant="quiet" pendingLabel="" onClick={() => viewer.current?.fit()} disabled={pending}>Fit page</Button>
        {sheet?.format === 'pdf' && <Button variant="quiet" pendingLabel="" aria-label="Rotate source PDF clockwise" onClick={() => viewer.current?.rotateBy?.(90)} disabled={pending}>↻</Button>}
      </div>}
    </div>}
    {mode === 'source' && !overviewAvailable && !sourceOnly && <p className="drawing-preview-source-note">This version is shown from its source file.</p>}
    <div className={`drawing-preview-canvas${mode === 'overview' ? ' drawing-preview-overview' : ''}`} ref={mount} aria-label={mode === 'overview' ? 'Drawing overview, choose a view or detail to enlarge' : mode === 'detail' ? `${prepared.title || prepared.profile.title}, linked to the source drawing` : 'Source drawing with its recorded detail'} />
    {state.loading && <p className="drawing-preview-loading" role="status">Opening drawing…</p>}
    {error && <Notice kind="error" title="Drawing unavailable">{error}</Notice>}
    <p className="drawing-preview-caption">{caption || (mode === 'overview' ? 'Select a view or highlighted feature to inspect it. Dimensions follow the source drawing.' : mode === 'detail' ? 'Source-derived view. Drag to pan or pinch to zoom.' : 'Original source coordinates. Drag to pan or pinch to zoom.')}</p>
  </section>;
});
