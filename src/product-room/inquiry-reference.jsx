import React from 'react';
import { Button, Glyph } from './ui/components.jsx';
import { ProjectDetails } from './ui/project-frame.jsx';

const swallow = promise => { void Promise.resolve(promise).catch(() => {}); };

/** Present the attached snapshot, never the host's currently selected detail. */
export function InquiryReference({ context, editable, busy, onCapture, onRestore, session, compact = false }) {
  const preview = context.inspection?.preview, drawing = context.drawing;
  const title = drawing?.regionLabel || context.part?.title || context.productTitle;
  const description = drawing
    ? `${drawing.sheetTitle} · ${drawing.revisionLabel || drawing.revision}`
    : context.chapter?.title;
  const facts = <dl className={compact ? 'ei-reference-facts' : undefined}><div><dt>Product</dt><dd>{context.productTitle}</dd></div>
        {context.productRevision && <div><dt>Product version</dt><dd>{context.productRevision}</dd></div>}
        {context.part && <div><dt>Component</dt><dd>{context.part.title}</dd></div>}
        {context.chapter && <div><dt>Explanation</dt><dd>{context.chapter.title}</dd></div>}
        {context.document && <div><dt>Document</dt><dd>{context.document.title} · {context.document.revision}</dd></div>}
        {drawing ? <>
          <div><dt>Drawing</dt><dd>{drawing.title}</dd></div>
          <div><dt>Source version</dt><dd>{drawing.revisionLabel || drawing.revision}</dd></div>
          <div><dt>Sheet</dt><dd>{drawing.sheetTitle}</dd></div>
          <div><dt>Detail</dt><dd>{drawing.regionLabel}</dd></div>
          {drawing.mappingRevision && <div><dt>Associations</dt><dd>{drawing.mappingRevision}</dd></div>}
          <div><dt>Overview</dt><dd>{drawing.presentationRevision || 'Original source reference'}</dd></div>
          <div><dt>Model version</dt><dd>{context.modelRevision}</dd></div>
        </> : <div><dt>Version</dt><dd>{context.roomSnapshot ? `Product version ${context.roomSnapshot.version}` : context.modelRevision}</dd></div>}
      </dl>;
  const note = <p className={compact ? 'ei-hint' : undefined}>{drawing ? 'The saved source and detail remain attached. Viewed dimensions are not automatically requirements.' : 'Viewing context does not confirm a requirement or engineering suitability.'}</p>;
  const update = editable && onCapture && <div className="ei-reference-update"><span>{drawing ? 'This detail stays attached while you explore.' : 'This view stays attached while you explore.'}</span><Button variant="quiet" disabled={busy} pending={session.getState().pending === 'capture'} pendingLabel="Attaching…" onClick={() => swallow(session.capture(onCapture))}>{drawing ? 'Use current detail' : 'Use current view'}</Button></div>;
  if (compact) return <ProjectDetails className="ei-reference ei-reference-compact" title="Reference details"
    meta={drawing ? 'Saved drawing detail' : context.inspection || context.viewerReference ? 'Saved 3D view' : 'Product reference'}>
    {preview && <img className="ei-reference-preview" src={preview.dataUrl} width={preview.width} height={preview.height} alt={`Saved view of ${context.part?.title || context.productTitle}`} />}
    {facts}{note}
    {onRestore && <Button variant="quiet" className="ei-view" disabled={busy} onClick={() => swallow(onRestore())}>View</Button>}
    {update}
  </ProjectDetails>;
  return <section className="ei-reference" aria-label="Attached product reference">
    <div className="ei-reference-summary">
      {preview ? <img src={preview.dataUrl} width={preview.width} height={preview.height} alt={`Saved view of ${context.part?.title || context.productTitle}`} /> : <span className="ei-reference-placeholder"><Glyph name="document" /></span>}
      <div><small>{drawing ? 'Saved drawing detail' : context.inspection || context.viewerReference ? 'Saved 3D view' : 'Product reference'}</small><strong>{title}</strong>{description && <span>{description}</span>}</div>
      {onRestore && <Button variant="quiet" className="ei-view" disabled={busy} onClick={() => swallow(onRestore())}>View</Button>}
    </div>
    <details className="ei-reference-details"><summary>Reference details</summary>{facts}{note}</details>
    {update}
  </section>;
}
