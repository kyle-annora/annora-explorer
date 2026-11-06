import React, { useEffect, useId, useRef, useState } from 'react';
import { Button, Field, Glyph } from './ui/components.jsx';
import { REQUEST_ITEM_LIMIT, REQUEST_ITEM_PURPOSES, requestItemPurposeLabel, requestItemTitle } from './request-items.js';
import './request-items-view.css';

const quietly = operation => { void Promise.resolve(operation).catch(() => {}); };

function ReferenceFacts({ context }) {
  const drawing = context.drawing;
  return <dl className="ar-request-facts">
    <div><dt>Product</dt><dd>{context.productTitle}</dd></div>
    {context.part && <div><dt>Component</dt><dd>{context.part.title}</dd></div>}
    <div><dt>Model version</dt><dd>{context.modelRevision}</dd></div>
    {context.roomSnapshot && <div><dt>Product version</dt><dd>{context.roomSnapshot.version}</dd></div>}
    {context.chapter && <div><dt>Explanation</dt><dd>{context.chapter.title}</dd></div>}
    {context.document && <div><dt>Document</dt><dd>{context.document.title} · {context.document.revision}</dd></div>}
    {drawing && <>
      <div><dt>Drawing</dt><dd>{drawing.title}</dd></div>
      <div><dt>Source version</dt><dd>{drawing.revisionLabel || drawing.revision}</dd></div>
      <div><dt>Sheet</dt><dd>{drawing.sheetTitle}</dd></div>
      <div><dt>Detail</dt><dd>{drawing.regionLabel}</dd></div>
      <div><dt>Associations</dt><dd>{drawing.mappingRevision || 'Original associations'}</dd></div>
      <div><dt>Overview</dt><dd>{drawing.presentationRevision || 'Original source reference'}</dd></div>
    </>}
  </dl>;
}

function ReferenceDescription({ item }) {
  const { context } = item;
  return <small className="ar-request-origin">{context.drawing
    ? `${context.drawing.sheetTitle} · ${context.drawing.revisionLabel || context.drawing.revision}`
    : context.inspection ? 'Saved 3D view' : context.part ? 'Component reference' : 'Product reference'}</small>;
}

/** Every listed item is displayed during confirmation, including custom host reviews. */
export function RequestItemsSummary({ items = [], onOpen, hrefFor, title = 'Referenced requests' }) {
  if (!items.length) return null;
  return <section className="ar-request-items ar-request-summary" aria-label={title}>
    <div className="ar-request-heading"><h3>{title}</h3><span>{items.length}</span></div>
    <ol className="ar-request-list">{items.map(item => <li key={item.id} data-request-item={item.id}>
      <div className="ar-request-row"><div><strong>{requestItemTitle(item)}</strong><ReferenceDescription item={item} /></div>
        {onOpen ? <Button variant="quiet" onClick={() => onOpen(item.context, item)}>View reference</Button>
          : hrefFor && <a className="ar-button" data-variant="quiet" href={hrefFor(item)}>View reference <Glyph name="external" /></a>}
      </div>
      <span className="ar-request-purpose">{requestItemPurposeLabel(item.purpose)}</span>
      <p className="ar-request-notes">{item.notes}</p>
      <details className="ar-request-reference"><summary>Exact reference</summary>
        {item.context.inspection?.preview && <img className="ar-request-preview" src={item.context.inspection.preview.dataUrl}
          width={item.context.inspection.preview.width} height={item.context.inspection.preview.height} alt={`Saved view of ${requestItemTitle(item)}`} />}
        <ReferenceFacts context={item.context} />
      </details>
    </li>)}</ol>
    <p className="ar-request-footnote">These are customer requests for discussion. Inclusion in a quotation requires seller review.</p>
  </section>;
}

/** One editor at a time; keystrokes enter the existing guarded draft lifecycle. */
export function RequestItemsEditor({ state, session, busy, onCapture, onRestore }) {
  const items = state.draft?.requestItems || [], errors = state.error?.fields || {};
  const [expanded, setExpanded] = useState(null);
  const section = useRef(null), addButton = useRef(null);
  const prefix = useId();
  useEffect(() => { setExpanded(null); }, [state.draft?.id]);
  useEffect(() => {
    const invalid = items.find(item => errors[`requestItem-${item.id}`]);
    if (invalid) setExpanded(invalid.id);
  }, [state.error]);
  if (!state.supportsRequestItems) return null;
  async function add() {
    const item = await session.addRequestItem(onCapture ? { capture: onCapture } : {});
    setExpanded(item.id);
    requestAnimationFrame(() => section.current?.querySelector(`[data-request-item="${item.id}"] textarea`)?.focus());
  }
  async function remove(id) {
    await session.removeRequestItem(id);
    setExpanded(current => current === id ? null : current);
    requestAnimationFrame(() => addButton.current?.focus());
  }
  return <section ref={section} className="ar-request-items ar-request-editor" aria-label="Requests about details">
    <div className="ar-request-heading"><h3>Requests about details</h3>{items.length > 0 && <span>{items.length}</span>}</div>
    <p className="ar-request-intro">Keep a separate question with each view. Continue exploring to add another.</p>
    {items.length > 0 && <ol className="ar-request-list">{items.map(item => {
      const open = expanded === item.id, bodyId = `${prefix}-${item.id}`, error = errors[`requestItem-${item.id}`];
      return <li key={item.id} data-request-item={item.id}>
        <button type="button" className="ar-request-toggle" aria-expanded={open} aria-controls={bodyId}
          onClick={() => setExpanded(open ? null : item.id)}>
          <span><strong>{requestItemTitle(item)}</strong><ReferenceDescription item={item} />
            {!open && <small>{item.notes || 'Add your question'}</small>}</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d={open ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'} /></svg>
        </button>
        {open && <div id={bodyId} className="ar-request-edit-fields">
          <Field label="Purpose" name={`request-purpose-${item.id}`} value={item.purpose} disabled={busy}
            options={REQUEST_ITEM_PURPOSES.map(purpose => [purpose.value, purpose.label])}
            onChange={event => session.editRequestItem(item.id, { purpose: event.target.value })} />
          <Field label="Your request" name={`request-notes-${item.id}`} textarea rows={3} maxLength={2000} required
            value={item.notes} error={error} disabled={busy} placeholder="What should we ask, change or review here?"
            onChange={event => session.editRequestItem(item.id, { notes: event.target.value })} />
          <div className="ar-request-item-actions">
            {onRestore && <Button variant="quiet" disabled={busy} onClick={() => quietly(onRestore(item.id))}>View reference</Button>}
            <Button variant="quiet" disabled={busy} onClick={() => quietly(remove(item.id))}>Remove request</Button>
          </div>
        </div>}
      </li>;
    })}</ol>}
    {errors.requestItems && <p className="ar-request-error" role="alert">{errors.requestItems}</p>}
    <Button ref={addButton} variant="secondary" disabled={busy || items.length >= REQUEST_ITEM_LIMIT} pending={state.pending === 'add-request'} pendingLabel="Attaching view…"
      className="ar-request-add" onClick={() => quietly(add())} icon="plus">
      {onCapture ? state.draft.context.drawing ? 'Add current detail' : 'Add current view' : 'Add referenced request'}
    </Button>
    {items.length >= REQUEST_ITEM_LIMIT && <p className="ar-request-footnote">This inquiry holds up to {REQUEST_ITEM_LIMIT} referenced requests.</p>}
  </section>;
}
