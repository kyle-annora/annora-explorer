import React from 'react';
import { Button, Comparison, Status } from './ui/components.jsx';
import './drawing-reference.css';

/** A record opens its own frozen reference, never the project's latest drawing. */
export function DrawingReference({ context, onOpen, href, label = 'Drawing reference', compact = false }) {
  const ref = context?.drawing;
  if (!ref) return null;
  return <section className={`drawing-reference${compact ? ' drawing-reference-compact' : ''}`} aria-label={label}>
    <div className="drawing-reference-heading"><span>{label}</span><Status tone="neutral">{ref.revisionLabel || ref.revision}</Status></div>
    <strong>{ref.regionLabel}</strong>
    <p>{ref.sheetTitle} · {context.part?.title}</p>
    {onOpen ? <Button variant="quiet" onClick={() => onOpen(context)} icon="external">Open this drawing</Button>
      : href ? <a className="ar-button" data-variant="quiet" href={href} target="_blank" rel="noopener noreferrer">Open this drawing ↗</a> : null}
  </section>;
}

export function DrawingReferenceComparison({ before, after, onOpen, hrefFor }) {
  if (!before?.drawing || !after?.drawing) return null;
  const rows = [
    ['Drawing version', before.drawing.revisionLabel || before.drawing.revision, after.drawing.revisionLabel || after.drawing.revision],
    ['Association version', before.drawing.mappingRevision || 'Earlier mapping', after.drawing.mappingRevision || 'Earlier mapping'],
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
