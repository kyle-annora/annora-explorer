import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Button, Notice } from '../product-room/ui/components.jsx';
import { createDrawingReader } from './reader.js';
import { technicalEntriesFor } from '../drawing-preview/technical-catalog.js';
import { createTechnicalDrawingView } from '../drawing-preview/technical-view.js';
import { resolveDrawingAssets } from '../studio/drawing-asset-store.js';
import './drawing-preview.css';

/** Read-only presentation surface. It never authors source regions or changes
 * a recorded reference. Editing belongs to the original-coordinate reader. */
export const DrawingPreview = forwardRef(function DrawingPreview({ pkg, sheetId, regionId, onSelect, onError,
  assetStore, assetsResolved = false, sourceOnly = false, unavailable = false, className = '', caption }, ref) {
  const mount = useRef(null), viewer = useRef(null), callbacks = useRef({});
  const [requested, setRequested] = useState(null), [state, setState] = useState({ loading: true, zoom: 1 }), [error, setError] = useState(null);
  callbacks.current = { onSelect, onError, regionId };
  const entries = useMemo(() => sourceOnly ? [] : technicalEntriesFor(pkg, { sheetId, regionId, unavailable }), [pkg, sheetId, regionId, unavailable, sourceOnly]);
  const prepared = requested === 'source' ? null : entries.find(entry => entry.id === requested) || entries[0] || null;
  const presentation = prepared?.id || 'source';
  const sheet = pkg?.sheets.find(item => item.id === sheetId);
  const lockedRegion = onSelect ? null : regionId;
  useImperativeHandle(ref, () => ({
    setPresentation(id) { setRequested(id); },
    select(id, options) { return viewer.current?.select(id, options) ?? false; },
    focusRegion(id) { return viewer.current?.focusRegion(id) ?? false; },
    fit() { viewer.current?.fit(); },
    resize() { viewer.current?.resize(); },
  }), []);
  useEffect(() => {
    let active = true, lease, instance;
    setError(null); setState({ loading: true, zoom: 1 });
    const fail = failure => {
      if (!active) return;
      setError(failure.message || 'This drawing reference could not be opened.');
      setState(previous => ({ ...previous, loading: false }));
      callbacks.current.onError?.(failure);
    };
    (async () => {
      let resolved = pkg;
      if (!prepared && !assetsResolved) {
        lease = await resolveDrawingAssets(pkg, { assetStore });
        if (!active) { lease.dispose(); return; }
        resolved = lease.package;
      }
      const options = { mount: mount.current,
        onSelect: id => {
          if (!active) return;
          if (callbacks.current.onSelect) callbacks.current.onSelect(id);
          else instance?.select(callbacks.current.regionId);
        },
        onViewChange: next => { if (active) setState(previous => ({ ...previous, ...next })); },
        onError: fail,
      };
      // Frozen record cards expose only their pinned detail as a target. Other
      // source geometry remains visible without implying the record changed.
      if (!callbacks.current.onSelect) resolved = { ...resolved, sheets: resolved.sheets.map(sheet => sheet.id === sheetId
        ? { ...sheet, regions: sheet.regions.filter(region => region.id === callbacks.current.regionId) } : sheet) };
      instance = prepared
        ? createTechnicalDrawingView({ ...options, profile: prepared.profile, artwork: prepared.artwork })
        : createDrawingReader({ ...options, package: resolved, sheetId, showOverview: true });
      viewer.current = instance;
      instance.select(callbacks.current.regionId);
      await instance.ready;
      if (!active) return;
      instance.select(callbacks.current.regionId);
      setState(previous => ({ ...previous, loading: false }));
    })().catch(fail);
    return () => { active = false; viewer.current = null; instance?.dispose(); lease?.dispose(); };
  }, [pkg, sheetId, prepared, assetStore, assetsResolved, lockedRegion]);
  useEffect(() => { viewer.current?.select(regionId); }, [regionId]);
  const pending = state.loading || Boolean(error);
  const zoom = value => {
    const instance = viewer.current;
    if (!instance || pending) return;
    if (value === 1) instance.fit();
    else if (instance.setZoom) instance.setZoom(value);
    else instance.zoomBy(value / (instance.zoom || state.zoom || 1));
  };
  return <section className={`drawing-preview-surface ${className}`} data-presentation={presentation} aria-label="Drawing preview">
    {entries.length > 0 && <div className="drawing-preview-modes" role="group" aria-label="Drawing presentation">
      <button type="button" aria-pressed={Boolean(prepared)} onClick={() => setRequested(entries[0].id)}>Technical view</button>
      <button type="button" aria-pressed={!prepared} onClick={() => setRequested('source')}>Original sheet</button>
    </div>}
    <div className="drawing-preview-toolbar">
      {prepared ? <label className="drawing-preview-presentation"><span>View</span><select aria-label="Drawing view" value={presentation} onChange={event => setRequested(event.target.value)}>
        {entries.map(entry => <option key={entry.id} value={entry.id}>{entry.title || entry.profile.title}</option>)}
      </select></label> : <span className="drawing-preview-source-label">Original sheet</span>}
      <div className="drawing-preview-zoom" role="group" aria-label="Drawing zoom">
        {[1, 2, 4].map(value => <button type="button" key={value} aria-label={`${value} times zoom`} aria-pressed={Math.abs((state.zoom || 1) - value) < .01} disabled={pending} onClick={() => zoom(value)}>{value}×</button>)}
      </div>
      {!prepared && <div className="drawing-preview-source-controls">
        <Button variant="quiet" pendingLabel="" onClick={() => viewer.current?.fit()} disabled={pending}>Fit page</Button>
        {sheet?.format === 'pdf' && <Button variant="quiet" pendingLabel="" aria-label="Rotate original sheet clockwise" onClick={() => viewer.current?.rotateBy?.(90)} disabled={pending}>↻</Button>}
      </div>}
    </div>
    <div className="drawing-preview-canvas" ref={mount} aria-label={prepared ? `${prepared.title || prepared.profile.title}, linked to the original drawing` : 'Original drawing with its recorded detail'} />
    {state.loading && <p className="drawing-preview-loading" role="status">Opening drawing…</p>}
    {error && <Notice kind="error" title="Drawing unavailable">{error}</Notice>}
    <p className="drawing-preview-caption">{caption || (prepared ? 'Prepared source view. The original sheet and recorded reference stay unchanged.' : 'Original source coordinates. Drag to pan or pinch to zoom.')}</p>
  </section>;
});
