import React, { useEffect, useId, useRef, useState } from 'react';
import { ROOM_CONTENT } from '../product-room/content.js';
import './studio-inspector.css';

const documents = ROOM_CONTENT['kinetic-01'].documents;
const titles = { product: 'Product details', part: 'Part information', inquiry: 'Inquiry preferences' };

function ExternalArrow() {
  return <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 12 12 4M4 4h8v8" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

/** This inspector edits only the host's in-memory design-preview draft. */
export function StudioInspector({ section = 'product', draft, onChange, selectedPart, onPreview }) {
  const fieldId = useId();
  const edit = patch => onChange?.({ ...draft, ...patch });
  const partId = selectedPart?.id;
  const linkedIds = draft.documentLinks?.[partId] || [];
  const changeDocument = (documentId, checked) => {
    if (!partId) return;
    const next = checked ? [...new Set([...linkedIds, documentId])] : linkedIds.filter(id => id !== documentId);
    edit({ documentLinks: { ...draft.documentLinks, [partId]: next } });
  };

  return <section className="ds-inspector" aria-label={titles[section] || titles.product}>
    <header className="ds-inspector-heading"><h2>{titles[section] || titles.product}</h2><span>Draft</span></header>

    {section === 'product' && <div className="ds-inspector-fields">
      <label className="ds-inspector-field" htmlFor={`${fieldId}-title`}><span>Product name</span>
        <input id={`${fieldId}-title`} value={draft.title || ''} maxLength={70} onChange={event => edit({ title: event.target.value })} autoComplete="off" />
      </label>
      <label className="ds-inspector-field" htmlFor={`${fieldId}-subtitle`}><span>Short introduction</span>
        <textarea id={`${fieldId}-subtitle`} rows={2} value={draft.subtitle || ''} maxLength={140} onChange={event => edit({ subtitle: event.target.value })} />
      </label>
      <label className="ds-inspector-field" htmlFor={`${fieldId}-description`}><span>Description</span>
        <textarea id={`${fieldId}-description`} rows={4} value={draft.description || ''} maxLength={600} onChange={event => edit({ description: event.target.value })} />
      </label>
      <p className="ds-inspector-hint">Description appears in the full-assembly information.</p>
    </div>}

    {section === 'part' && (partId ? <div className="ds-inspector-fields">
      <div className="ds-inspector-selection"><span>Selected part</span><strong>{selectedPart.title}</strong></div>
      <label className="ds-inspector-field" htmlFor={`${fieldId}-note`}><span>Customer note</span>
        <textarea id={`${fieldId}-note`} rows={4} value={draft.partNotes?.[partId] || ''} maxLength={600}
          placeholder={selectedPart.description || 'Explain what this part does.'}
          onChange={event => edit({ partNotes: { ...draft.partNotes, [partId]: event.target.value } })} />
      </label>
      <fieldset className="ds-inspector-documents"><legend>Linked documents</legend>
        {documents.map(document => <div className="ds-inspector-document" key={document.id}>
          <label htmlFor={`${fieldId}-${document.id}`}><input id={`${fieldId}-${document.id}`} type="checkbox" checked={linkedIds.includes(document.id)} onChange={event => changeDocument(document.id, event.target.checked)} />
            <span><strong>{document.title}</strong><small>{document.type} · {document.revision}</small></span>
          </label>
          <a href={document.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${document.title} in a new tab`} title="Open document"><ExternalArrow /></a>
        </div>)}
      </fieldset>
      <p className="ds-inspector-hint">Available from this part in the customer view.</p>
    </div> : <p className="ds-inspector-empty">Select a part in the model or the list to edit its note and documents.</p>)}

    {section === 'inquiry' && <div className="ds-inspector-fields">
      <label className="ds-inspector-field" htmlFor={`${fieldId}-prompt`}><span>Opening question</span>
        <textarea id={`${fieldId}-prompt`} rows={3} value={draft.inquiryPrompt || ''} maxLength={200} onChange={event => edit({ inquiryPrompt: event.target.value })} />
      </label>
      <label className="ds-inspector-toggle" htmlFor={`${fieldId}-technical`}>
        <span><strong>Technical details optional</strong><small>Customers can start with what they know.</small></span>
        <input id={`${fieldId}-technical`} type="checkbox" role="switch" checked={draft.technicalOptional !== false} onChange={event => edit({ technicalOptional: event.target.checked })} />
      </label>
      <div className="ds-inspector-readonly"><span>Contact details</span><span>Required</span></div>
      <div className="ds-inspector-readonly"><span>Review before sending</span><span>Always on</span></div>
    </div>}

    <footer className="ds-inspector-footer">
      {onPreview && <button type="button" className="ds-inspector-preview" onClick={onPreview}>Preview as buyer <ExternalArrow /></button>}
      <p>Changes stay in this design preview.</p>
    </footer>
  </section>;
}

/** Optional host review: opening the buyer preview does not publish anything. */
export function ReviewChangesDialog({ draft, onClose, onPreview }) {
  const dialog = useRef(null), titleId = useId();
  useEffect(() => {
    const element = dialog.current, previousFocus = document.activeElement;
    element.showModal();
    return () => { element.close(); if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true }); };
  }, []);
  return <dialog ref={dialog} className="ds-inspector-review" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose?.(); }}>
    <div className="ds-inspector-review-heading"><h2 id={titleId}>Preview your changes</h2><button type="button" onClick={onClose} aria-label="Close review">×</button></div>
    <p className="ds-inspector-review-intro">See this draft in the customer view.</p>
    <dl><div><dt>Product</dt><dd>{draft.title || 'Untitled product'}</dd></div>
      <div><dt>Introduction</dt><dd>{draft.subtitle || 'Not added'}</dd></div>
      <div><dt>Inquiry prompt</dt><dd>{draft.inquiryPrompt || 'Not added'}</dd></div>
    </dl>
    <p className="ds-inspector-hint">This opens an isolated design preview. Your published product and customer projects stay unchanged.</p>
    <div className="ds-inspector-review-actions"><button type="button" className="ds-inspector-review-back" onClick={onClose}>Keep editing</button>
      <button type="button" className="ds-inspector-review-open" onClick={() => { onClose?.(); onPreview?.(); }}>Open buyer preview <ExternalArrow /></button></div>
  </dialog>;
}

/** An isolated customer inquiry rehearsal; no request or persistence is performed. */
export function InquiryPreviewDialog({ draft, onClose }) {
  const dialog = useRef(null), reviewHeading = useRef(null), nameInput = useRef(null), previouslyReviewing = useRef(false), fieldId = useId();
  const [reviewing, setReviewing] = useState(false);
  const [values, setValues] = useState({ name: '', email: '', application: '', technical: '' });
  const technicalOptional = draft.technicalOptional !== false;
  const edit = key => event => setValues(current => ({ ...current, [key]: event.target.value }));
  useEffect(() => {
    const element = dialog.current, previousFocus = document.activeElement;
    element.showModal();
    return () => { element.close(); if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true }); };
  }, []);
  useEffect(() => {
    if (reviewing) reviewHeading.current?.focus();
    else if (previouslyReviewing.current) nameInput.current?.focus();
    previouslyReviewing.current = reviewing;
  }, [reviewing]);

  return <dialog ref={dialog} className="ds-inspector-review ds-inspector-inquiry" aria-labelledby={`${fieldId}-heading`} onCancel={event => { event.preventDefault(); onClose?.(); }}>
    <div className="ds-inspector-review-heading"><h2 id={`${fieldId}-heading`} ref={reviewHeading} tabIndex={-1}>{reviewing ? 'Review your details' : 'Inquiry preview'}</h2><button type="button" onClick={onClose} aria-label="Close inquiry preview">×</button></div>
    <p className="ds-inspector-review-intro">{draft.title || 'Untitled product'}</p>
    <div className="ds-inspector-inquiry-steps" aria-label="Inquiry progress"><span aria-current={!reviewing ? 'step' : undefined}>1 · Your inquiry</span><span aria-hidden="true">/</span><span aria-current={reviewing ? 'step' : undefined}>2 · Review</span></div>
    {!reviewing ? <form onSubmit={event => { event.preventDefault(); setReviewing(true); }}>
      <div className="ds-inspector-fields">
        <div className="ds-inspector-inquiry-contact">
          <label className="ds-inspector-field" htmlFor={`${fieldId}-name`}><span>Your name</span><input ref={nameInput} id={`${fieldId}-name`} value={values.name} onChange={edit('name')} autoComplete="off" required maxLength={100}/></label>
          <label className="ds-inspector-field" htmlFor={`${fieldId}-email`}><span>Email</span><input id={`${fieldId}-email`} type="email" value={values.email} onChange={edit('email')} autoComplete="off" required maxLength={200}/></label>
        </div>
        <label className="ds-inspector-field" htmlFor={`${fieldId}-application`}><span>{draft.inquiryPrompt || 'Tell us what your application needs.'}</span><textarea id={`${fieldId}-application`} rows={3} value={values.application} onChange={edit('application')} required maxLength={1200}/></label>
        <label className="ds-inspector-field" htmlFor={`${fieldId}-technical`}><span>Technical details <small>{technicalOptional ? 'Optional' : 'Required'}</small></span><textarea id={`${fieldId}-technical`} rows={2} value={values.technical} onChange={edit('technical')} required={!technicalOptional} maxLength={1200} placeholder="Dimensions, materials or operating requirements"/></label>
      </div>
      <p className="ds-inspector-inquiry-note">Preview only. No inquiry will be sent or saved.</p>
      <div className="ds-inspector-review-actions"><button type="submit" className="ds-inspector-review-open">Review details <ExternalArrow/></button></div>
    </form> : <>
      <dl><div><dt>Contact</dt><dd>{values.name}<br/>{values.email}</dd></div><div><dt>{draft.inquiryPrompt || 'Application'}</dt><dd>{values.application}</dd></div><div><dt>Technical details</dt><dd>{values.technical || 'To discuss'}</dd></div></dl>
      <p className="ds-inspector-inquiry-note">This is the review step a customer sees before confirming. This design preview ends here.</p>
      <div className="ds-inspector-review-actions"><button type="button" className="ds-inspector-review-back" onClick={() => setReviewing(false)}>Edit details</button><button type="button" className="ds-inspector-review-open" onClick={onClose}>Close preview</button></div>
    </>}
  </dialog>;
}
