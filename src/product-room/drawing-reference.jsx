import React, { useEffect, useState } from 'react';
import { Button, Comparison, Notice, Status } from './ui/components.jsx';
import { DrawingPreview } from '../drawings/DrawingPreview.jsx';
import { resolveReferencePreview } from '../drawings/reference-preview.js';
import './drawing-reference.css';

/** A record opens its own frozen reference, never the project's latest drawing. */
export function DrawingReference({ context, onOpen, href, label = 'Drawing reference', compact = false }) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const ref = context?.drawing;
  if (!ref) return null;
  return <section className={`drawing-reference${compact ? ' drawing-reference-compact' : ''}`} aria-label={label}>
    <div className="drawing-reference-heading"><span>{label}</span><Status tone="neutral">{ref.revisionLabel || ref.revision}</Status></div>
    <strong>{ref.regionLabel}</strong>
    <p>{ref.sheetTitle} · {context.part?.title}</p>
    {ref.presentationRevision && <p className="drawing-reference-overview" title={ref.presentationRevision} data-overview-revision={ref.presentationRevision}>Saved overview · {ref.presentationRevision.replace(/^overview-/, '').slice(0, 8)}</p>}
    <div className="drawing-reference-actions"><Button variant="quiet" onClick={() => setPreviewOpen(open => !open)} aria-expanded={previewOpen}>{previewOpen ? 'Close preview' : 'Preview drawing'}</Button>
      {onOpen ? <Button variant="quiet" onClick={() => onOpen(context)} icon="external">Open this drawing</Button>
        : href ? <a className="ar-button" data-variant="quiet" href={href} target="_blank" rel="noopener noreferrer">Open this drawing ↗</a> : null}</div>
    {previewOpen && <RecordedDrawingPreview context={context} />}
  </section>;
}

function RecordedDrawingPreview({ context }) {
  const [resolved, setResolved] = useState(null), [error, setError] = useState(null);
  const referenceKey = JSON.stringify([context.modelId, context.modelRevision, context.part?.id, context.drawing]);
  useEffect(() => {
    let active = true, lease;
    setResolved(null); setError(null);
    (async () => {
      const [{ DRAWING_CATALOG, DRAWING_RELEASES, resolveDrawingEntry }, { createDrawingRepository }] = await Promise.all([
        import('../drawings/catalog.js'), import('../studio/drawing-repository.js'),
      ]);
      const packages = DRAWING_CATALOG.filter(entry => entry.model?.revision && entry.package.modelRevision === entry.model.revision);
      const repository = createDrawingRepository({ packages });
      lease = await resolveReferencePreview(context, { catalog: DRAWING_CATALOG, staticReleases: DRAWING_RELEASES,
        listReleases: id => repository.listReleases(id), resolveEntry: resolveDrawingEntry });
      if (!active) { lease.dispose?.(); return; }
      setResolved(lease);
    })().catch(next => { if (active) setError(next.message); });
    return () => { active = false; lease?.dispose?.(); };
  }, [referenceKey]);
  if (error) return <Notice kind="error" title="Recorded preview unavailable">{error}</Notice>;
  if (!resolved) return <p className="drawing-reference-loading" role="status">Opening the recorded drawing version…</p>;
  return <DrawingPreview pkg={resolved.package} sheetId={resolved.previewSheetId} regionId={resolved.previewRegionId}
    presentationSnapshot={resolved.presentationSnapshot} assetsResolved
    caption={resolved.presentationState === 'unavailable' ? 'Showing this record’s original PDF. Its saved overview is unavailable.'
      : resolved.presentationSnapshot ? 'Pinned to this record’s drawing, associations and saved overview.' : 'Pinned to this record’s original drawing and associations.'} />;
}

export function DrawingReferenceComparison({ before, after, onOpen, hrefFor }) {
  if (!before?.drawing || !after?.drawing) return null;
  const rows = [
    ['Drawing version', before.drawing.revisionLabel || before.drawing.revision, after.drawing.revisionLabel || after.drawing.revision],
    ['Association version', before.drawing.mappingRevision || 'Earlier mapping', after.drawing.mappingRevision || 'Earlier mapping'],
    ...(before.drawing.presentationRevision || after.drawing.presentationRevision ? [['Overview version', before.drawing.presentationRevision || 'Original source view', after.drawing.presentationRevision || 'Original source view']] : []),
    ...(before.modelRevision !== after.modelRevision ? [['Model version', before.modelRevision, after.modelRevision]] : []),
    ['Sheet', before.drawing.sheetTitle, after.drawing.sheetTitle],
    ['Selected detail', before.drawing.regionLabel, after.drawing.regionLabel],
    ['Linked part', before.part?.title, after.part?.title],
    ['Source file', before.drawing.assetRevision === after.drawing.assetRevision ? 'Same file' : 'Previous source file', before.drawing.assetRevision === after.drawing.assetRevision ? 'Same file' : 'New source file'],
  ].map(([label, left, right]) => ({ label, before: left, after: right, changed: left !== right }));
  return <div className="drawing-reference-comparison">
    <Comparison rows={rows} beforeLabel="Previous reference" afterLabel="Reviewed reference" />
    <div className="drawing-reference-pair">
      <DrawingReference context={before} label="Previous reference" onOpen={onOpen} href={hrefFor?.(before)} compact />
      <DrawingReference context={after} label="Reviewed reference" onOpen={onOpen} href={hrefFor?.(after)} compact />
    </div>
  </div>;
}
