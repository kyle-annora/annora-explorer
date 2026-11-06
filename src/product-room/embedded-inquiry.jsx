import React, { useEffect, useId, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Button, Field, Glyph } from './ui/components.jsx';
import { INQUIRY_INTENTS, QUOTE_SCOPES, inquiryIntentLabel, quoteScopeLabel } from './project-domain.js';
import { inquiryField } from './inquiry-profile.js';
import { createInquirySession } from './inquiry-session.js';
import { createDemoProjectRepository } from './project-repository.js';
import './embedded-inquiry.css';

const swallow = promise => { void Promise.resolve(promise).catch(() => {}); };
const announce = (callback, value) => { try { callback?.(value); } catch { /* Host presentation cannot interrupt the inquiry. */ } };
const titleFor = state => state.stage === 'confirmed' ? 'Inquiry saved.' : state.stage === 'review' ? 'Review your request.' : 'Tell us what you need.';
const saveLabel = state => state.loading ? 'Opening draft…' : state.saving ? 'Saving…' : state.error && state.dirty ? 'Draft not saved' : state.dirty ? 'Unsaved changes' : state.draft?.updatedAt ? 'Saved in this browser' : state.stage === 'confirmed' ? 'Saved in this browser' : 'Saves as you type';

function Reference({ context, editable, busy, onCapture, onRestore, session }) {
  const preview = context.inspection?.preview;
  return <section className="ei-reference" aria-label="Attached product reference">
    <div className="ei-reference-summary">
      {preview ? <img src={preview.dataUrl} width={preview.width} height={preview.height} alt={`Saved view of ${context.part?.title || context.productTitle}`} /> : <span className="ei-reference-placeholder"><Glyph name="document" /></span>}
      <div><small>{context.inspection ? 'Saved 3D view' : context.drawing ? 'Saved drawing reference' : 'Product reference'}</small><strong>{context.part?.title || context.productTitle}</strong>{context.chapter && <span>{context.chapter.title}</span>}</div>
      {onRestore && <Button variant="quiet" className="ei-view" disabled={busy} onClick={() => swallow(onRestore())}>View</Button>}
    </div>
    <details className="ei-reference-details">
      <summary>Reference details</summary>
      <dl><div><dt>Product</dt><dd>{context.productTitle}</dd></div>
        {context.part && <div><dt>Component</dt><dd>{context.part.title}</dd></div>}
        {context.chapter && <div><dt>Explanation</dt><dd>{context.chapter.title}</dd></div>}
        {context.document && <div><dt>Document</dt><dd>{context.document.title} · {context.document.revision}</dd></div>}
        {context.drawing && <div><dt>Drawing detail</dt><dd>{context.drawing.regionLabel} · {context.drawing.revisionLabel || context.drawing.revision}</dd></div>}
        <div><dt>Version</dt><dd>{context.roomSnapshot ? `Product version ${context.roomSnapshot.version}` : context.modelRevision}</dd></div>
      </dl>
      <p>Viewing context does not confirm a requirement or engineering suitability.</p>
    </details>
    {editable && onCapture && <div className="ei-reference-update"><span>This view stays attached while you explore.</span><Button variant="quiet" disabled={busy} pending={session.getState().pending === 'capture'} pendingLabel="Attaching…" onClick={() => swallow(session.capture(onCapture))}>Use current view</Button></div>}
  </section>;
}

function DraftFields({ state, session, formId, disabled }) {
  const { draft, error, pending } = state, values = draft.values, context = draft.context, errors = error?.fields || {};
  const consultation = values.intent === 'application-review';
  const field = (id, props = {}) => {
    const config = inquiryField(context, id, values);
    if (!config?.enabled) return null;
    return <Field key={id} {...props} name={id} label={config.label} hint={config.hint || undefined} unit={config.unit || undefined}
      required={config.required} optional={!config.required} error={errors[id]} value={values[id] || ''}
      onChange={event => session.updateValues({ [id]: event.target.value })} />;
  };
  const commercialFields = <div className="ei-field-pair">
    {field('quantity', { type: 'number', min: 1, max: 100000, step: 1, inputMode: 'numeric', placeholder: consultation ? 'To discuss' : 'e.g. 20' })}
    {field('targetWeeks', { type: 'number', min: 1, max: 104, step: 1, inputMode: 'numeric', placeholder: 'To discuss' })}
  </div>;
  const technical = ['stroke', 'load', 'notes'].some(id => inquiryField(context, id, values)?.enabled) || draft.requirements.length > 0;
  return <form id={formId} className="ei-form" noValidate onSubmit={event => { event.preventDefault(); swallow(session.review()); }}>
    <fieldset disabled={disabled || Boolean(pending)}>
      <Field label="I want to" name="intent" value={values.intent || ''} error={errors.intent}
        options={[...(values.intent ? [] : [["", "Not specified"]]), ...INQUIRY_INTENTS.map(item => [item.value, item.label])]}
        onChange={event => session.updateValues({ intent: event.target.value })} />
      {field('application', { textarea: true, rows: 3, maxLength: 2000, placeholder: consultation ? 'Describe your application or question…' : 'Describe the application you need quoted…' })}
      <Field label={consultation ? 'Scope to discuss' : 'Requested quote scope'} name="quoteScope" value={values.quoteScope || ''} error={errors.quoteScope}
        options={[["", "Not specified"], ...QUOTE_SCOPES.filter(item => item.value !== 'part' || context.part).map(item => [item.value, item.value === 'part' ? `Selected component · ${context.part.title}` : item.label])]}
        onChange={event => session.updateValues({ quoteScope: event.target.value })}
        hint="A viewed component is a reference. Choose the scope separately." />
      {!consultation && commercialFields}
      {technical && <Disclosure title="Technical details" note="Optional" openForError={Boolean(errors.stroke || errors.load || errors.notes || errors.requirements)} defaultOpen={Boolean(values.stroke || values.load || values.notes || draft.requirements.length)}>
        <div className="ei-field-pair">{field('stroke', { type: 'number', min: 0, step: 'any', inputMode: 'decimal', maxLength: 100, placeholder: 'To discuss' })}{field('load', { maxLength: 200, placeholder: 'Include the unit…' })}</div>
        {field('notes', { textarea: true, rows: 3, maxLength: 2000 })}
        {inquiryField(context, 'stroke', values)?.enabled && values.stroke?.trim() && <label className="ei-requirement-check"><input type="checkbox" checked={draft.requirements.some(item => item.id === 'stroke-confirmed')}
          onChange={event => session.updateRequirements(event.target.checked ? [...draft.requirements.filter(item => item.id !== 'stroke-confirmed'), { id: 'stroke-confirmed', label: 'Required carriage stroke', value: values.stroke, unit: 'mm', source: 'customer', confirmed: true, ...(context.part ? { part: context.part } : {}) }] : draft.requirements.filter(item => item.id !== 'stroke-confirmed'))} />
          <span>Include my stroke requirement for engineering review<small>Editing the stroke or attached component clears this confirmation.</small></span></label>}
        {draft.requirements.filter(item => item.id !== 'stroke-confirmed').map(item => <div key={item.id} className="ei-requirement-row"><label><input type="checkbox" checked={item.confirmed} onChange={event => session.updateRequirements(draft.requirements.map(value => value.id === item.id ? { ...value, confirmed: event.target.checked } : value))} /><span>{item.label}: {item.value} {item.unit}</span></label><Button variant="quiet" onClick={() => session.updateRequirements(draft.requirements.filter(value => value.id !== item.id))}>Remove</Button></div>)}
        {errors.requirements && <p className="ei-field-error" role="alert">{errors.requirements}</p>}
      </Disclosure>}
      {consultation && <Disclosure title="Quantity & timing" note="Optional" openForError={Boolean(errors.quantity || errors.targetWeeks)} defaultOpen={Boolean(values.quantity || values.targetWeeks)}>{commercialFields}<p className="ei-hint">Leave unknown quantities open for discussion.</p></Disclosure>}
      {['name', 'company', 'email'].some(id => inquiryField(context, id, values)?.enabled) && <Disclosure title="Contact details" note="Optional in this demo" openForError={Boolean(errors.name || errors.company || errors.email)} defaultOpen={Boolean(values.name || values.company || values.email)}>
        {field('name', { maxLength: 120, autoComplete: 'name' })}{field('company', { maxLength: 160, autoComplete: 'organization' })}{field('email', { type: 'email', inputMode: 'email', maxLength: 254, autoComplete: 'email', spellCheck: false })}
      </Disclosure>}
    </fieldset>
  </form>;
}

function Disclosure({ title, note, children, defaultOpen, openForError }) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  useEffect(() => { if (openForError) setOpen(true); }, [openForError]);
  return <details className="ei-disclosure" open={open} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary><strong>{title}</strong><small>{note}</small><span aria-hidden="true">{open ? '−' : '+'}</span></summary><div>{children}</div>
  </details>;
}

function Review({ draft }) {
  const { values, context } = draft;
  const facts = ['quantity', 'targetWeeks', 'stroke', 'load'].filter(id => inquiryField(context, id, values)?.enabled || values[id]);
  return <div className="ei-review" aria-label="Reviewed inquiry">
    <dl className="ei-facts"><div><dt>Purpose</dt><dd>{inquiryIntentLabel(values)}</dd></div><div><dt>Requested scope</dt><dd>{quoteScopeLabel(values, context)}</dd></div></dl>
    <section><h3>{inquiryField(context, 'application', values)?.label || 'Application'}</h3><p>{values.application}</p></section>
    <dl className="ei-facts">{facts.map(id => <div key={id}><dt>{inquiryField(context, id, values)?.label || id}</dt><dd>{values[id] ? `${values[id]}${id === 'quantity' ? ' units' : id === 'targetWeeks' ? ' weeks requested' : id === 'stroke' ? ' mm' : ''}` : 'To discuss'}</dd></div>)}</dl>
    {values.notes && <section><h3>{inquiryField(context, 'notes', values)?.label || 'Notes'}</h3><p>{values.notes}</p></section>}
    {draft.requirements.length > 0 && <section><h3>Confirmed requirements</h3><ul>{draft.requirements.map(item => <li key={item.id}>{item.label}: {item.value} {item.unit}{item.part && <small>{item.part.title}</small>}</li>)}</ul></section>}
    {['name', 'company', 'email'].some(id => values[id]) && <section><h3>Contact</h3><dl className="ei-facts">{['name', 'company', 'email'].filter(id => values[id]).map(id => <div key={id}><dt>{inquiryField(context, id, values)?.label || id}</dt><dd>{values[id]}</dd></div>)}</dl></section>}
    <p className="ei-confirm-note">Confirmation saves these exact details and this reference as one project. Engineering suitability remains subject to review.</p>
  </div>;
}

function EmbeddedInquiry({ state, ui, session, controls, callbacks }) {
  const heading = useRef(null), pane = useRef(null), scroll = useRef(null);
  const [replacePrompt, setReplacePrompt] = useState(false);
  const titleId = useId(), formId = useId();
  const context = state.draft?.context || state.project?.context;
  const busy = state.loading || Boolean(state.pending) || ui.leaving;
  const canReload = ['CONFLICT', 'STALE_REVIEW', 'RELOAD_FAILED', 'DRAFT_UNAVAILABLE'].includes(state.error?.code);
  useEffect(() => { setReplacePrompt(false); }, [state.draft?.id, state.draft?.revision, state.stage, Boolean(state.error)]);
  useEffect(() => {
    if (!replacePrompt) return;
    const frame = requestAnimationFrame(() => pane.current?.querySelector('[data-reload-warning]')?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [replacePrompt]);
  useEffect(() => {
    if (!ui.open || !ui.expanded) return;
    const frame = requestAnimationFrame(() => {
      heading.current?.focus({ preventScroll: true });
      if (scroll.current) scroll.current.scrollTop = 0;
    });
    return () => cancelAnimationFrame(frame);
  }, [ui.open, ui.expanded, state.stage]);
  useEffect(() => {
    if (!ui.open || !ui.expanded || !state.error) return;
    const frame = requestAnimationFrame(() => {
      const target = pane.current?.querySelector('[aria-invalid="true"], [role="alert"]');
      if (!target) return;
      if (!target.matches('input,select,textarea,button')) target.tabIndex = -1;
      target.focus({ preventScroll: true });
      if (scroll.current) {
        const rect = target.getBoundingClientRect(), container = scroll.current.getBoundingClientRect();
        scroll.current.scrollTop += rect.top - container.top - 24;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [state.error, ui.open, ui.expanded]);
  if (!ui.open) return null;
  if (!ui.expanded) return <div className="room-ui ei-minimized" aria-label="Saved inquiry draft"><button type="button" className="ei-resume" onClick={controls.expand}>
    <span className="ei-resume-mark"><Glyph name={state.stage === 'confirmed' ? 'check' : 'document'} /></span><span><strong>{state.stage === 'confirmed' ? 'Inquiry saved' : 'Continue your inquiry'}</strong><small>{context?.part?.title || context?.productTitle || 'Product inquiry'}</small></span><span aria-hidden="true">↑</span></button></div>;
  return <section ref={pane} className="room-ui ei-panel" role="dialog" aria-modal="false" aria-labelledby={titleId} aria-busy={state.loading || undefined} data-stage={state.stage}>
    <header className="ei-header"><div><span className="ei-eyebrow">YOUR INQUIRY</span><h2 id={titleId} ref={heading} tabIndex={-1}>{titleFor(state)}</h2></div><div className="ei-window-actions">
      <button type="button" className="ei-icon-button" aria-label="Minimize inquiry" disabled={busy} onClick={() => swallow(controls.minimize())}>−</button>
      <button type="button" className="ei-icon-button" aria-label="Close inquiry and keep draft" disabled={busy} onClick={() => swallow(controls.close())}>×</button>
    </div></header>
    {state.stage !== 'confirmed' && <ol className="ei-progress" aria-label="Inquiry steps"><li aria-current={state.stage === 'details' ? 'step' : undefined} data-complete={state.stage === 'review'}><span>{state.stage === 'review' ? '✓' : '1'}</span>Requirements</li><li aria-current={state.stage === 'review' ? 'step' : undefined}><span>2</span>Review & confirm</li></ol>}
    <div ref={scroll} className="ei-scroll">
      {state.error && <div className="ei-message ei-error" role="alert"><strong>Check your inquiry</strong><p>{state.error.message}</p>
        {canReload && !replacePrompt && <Button variant="quiet" disabled={busy} data-load-saved onClick={() => setReplacePrompt(true)}>Load saved draft</Button>}
        {canReload && replacePrompt && <div className="ei-reload-choice"><p data-reload-warning tabIndex={-1}>Your current entries will be replaced by the latest saved draft. Keep your edits here until you are ready to replace them.</p><div><Button variant="quiet" disabled={busy} onClick={() => { setReplacePrompt(false); requestAnimationFrame(() => pane.current?.querySelector('[data-load-saved]')?.focus({ preventScroll: true })); }}>Keep my edits</Button><Button variant="secondary" disabled={busy} onClick={() => swallow(session.loadSavedDraft())}>Replace with saved draft</Button></div></div>}
        {!canReload && state.dirty && !Object.keys(state.error.fields || {}).length && <Button variant="quiet" disabled={busy} onClick={() => swallow(session.save())}>Retry saving draft</Button>}
      </div>}
      {state.notice && <p className="ei-message" role="status">{state.notice}</p>}
      {state.loading ? <p className="ei-loading" role="status">Opening your saved inquiry…</p> : <>
        {context && <Reference context={context} editable={state.stage === 'details'} busy={busy} onCapture={callbacks.onCapture} onRestore={callbacks.onRestore ? controls.restore : undefined} session={session} />}
        {state.draft && (state.stage === 'review' ? <Review draft={state.review?.draft || state.draft} /> : <DraftFields state={state} session={session} formId={formId} disabled={busy} />)}
        {state.stage === 'confirmed' && state.project && <div className="ei-receipt"><span className="ei-receipt-mark"><Glyph name="check" /></span><h3>Your inquiry and saved view are together.</h3><p>You can continue exploring or open the project to follow the quotation and conversation.</p><dl className="ei-facts"><div><dt>Project</dt><dd>{state.project.id}</dd></div><div><dt>Purpose</dt><dd>{inquiryIntentLabel(state.project.inquiry.values)}</dd></div></dl><p className="ei-hint">This fictional inquiry is saved in this browser. Nothing has been sent.</p><Button variant="secondary" disabled={busy} pending={state.pending === 'new'} pendingLabel="Attaching current view…" onClick={() => swallow(session.startAnother({ capture: callbacks.onCapture }))}>Start another inquiry</Button></div>}
      </>}
    </div>
    <footer className="ei-footer"><div className="ei-save-state" role="status" aria-live="polite"><span>{saveLabel(state)}</span><small>Demo only · Nothing is sent</small></div><div className="ei-actions">
      {state.stage === 'confirmed' ? <><Button variant="secondary" disabled={busy} onClick={() => swallow(controls.minimize())}>Keep exploring</Button>{callbacks.onProject && <Button disabled={busy} onClick={() => swallow(controls.openProject())}>Open project <span aria-hidden="true">→</span></Button>}</>
        : state.stage === 'review' ? <><Button variant="secondary" disabled={busy} onClick={() => session.edit()}>Edit details</Button><Button disabled={busy} pending={state.pending === 'confirm'} pendingLabel="Saving…" onClick={() => swallow(session.confirm())}>Confirm demo inquiry</Button></>
          : <><Button variant="quiet" disabled={busy} onClick={() => swallow(controls.minimize())}>Keep exploring</Button><Button type="submit" form={formId} disabled={busy || !state.draft} pending={state.pending === 'review'} pendingLabel="Preparing…">Review inquiry <span aria-hidden="true">→</span></Button></>}
    </div></footer>
  </section>;
}

/** Host-owned floating presentation; shares business records with Product Room. */
export async function mountEmbeddedInquiry(element, { repository = createDemoProjectRepository(), context, onCapture, onRestore, onProject, onState, onClose } = {}) {
  if (!element?.ownerDocument) throw new TypeError('Provide an inquiry mount element.');
  const doc = element.ownerDocument, win = doc.defaultView;
  const session = createInquirySession({ repository });
  const root = createRoot(element), callbacks = { onCapture, onRestore, onProject };
  let state = session.getState(), ui = { open: false, expanded: false, leaving: false }, disposed = false, opener = null;
  const abort = new AbortController();
  element.classList.add('embedded-inquiry-host');
  const render = () => {
    if (disposed) return;
    root.render(<EmbeddedInquiry state={state} ui={ui} session={session} controls={controls} callbacks={callbacks} />);
    announce(onState, { open: ui.open, expanded: ui.expanded, busy: state.loading || Boolean(state.pending) || ui.leaving,
      draftId: state.draft?.id || null, hasDraft: Boolean(state.draft), stage: state.stage, status: saveLabel(state), projectId: state.project?.id || null });
  };
  const updateUI = patch => { ui = { ...ui, ...patch }; render(); };
  const restoreFocus = () => {
    if (opener?.isConnected && !opener.matches(':disabled, [aria-disabled="true"]') && !opener.closest('[inert]')
      && opener.getClientRects().length && win.getComputedStyle(opener).visibility !== 'hidden') opener.focus({ preventScroll: true });
  };
  async function saveAndHide(close = false) {
    if (disposed || ui.leaving || !ui.open) return false;
    updateUI({ leaving: true });
    const saved = await session.beforeLeave();
    if (disposed) return false;
    updateUI(saved ? { leaving: false, expanded: false, ...(close ? { open: false } : {}) } : { leaving: false, expanded: true });
    if (saved) { restoreFocus(); if (close) announce(onClose); }
    return saved;
  }
  const controls = {
    minimize: () => saveAndHide(false),
    close: () => saveAndHide(true),
    expand: () => updateUI({ open: true, expanded: true }),
    async restore() {
      await session.restore(onRestore);
      // The compact screen is for the model after a successful restore. Its
      // nonmodal sheet never makes the viewer inert or traps keyboard focus.
      if (win.matchMedia('(max-width: 760px)').matches) await controls.minimize();
    },
    async openProject() {
      if (!state.project || !(await session.beforeLeave())) return;
      await onProject?.(state.project);
    },
  };
  const unsubscribe = session.subscribe(next => { state = next; render(); });
  const resize = () => {
    const viewport = win.visualViewport;
    element.style.setProperty('--ei-viewport-height', `${viewport?.height || win.innerHeight}px`);
    element.style.setProperty('--ei-viewport-offset', `${viewport?.offsetTop || 0}px`);
  };
  win.addEventListener('resize', resize, { signal: abort.signal });
  win.visualViewport?.addEventListener('resize', resize, { signal: abort.signal });
  win.visualViewport?.addEventListener('scroll', resize, { signal: abort.signal });
  win.addEventListener('beforeunload', event => { if (session.hasUnsavedChanges()) { event.preventDefault(); event.returnValue = ''; } }, { signal: abort.signal });
  // The host owns global Escape precedence. Only events from this surface are
  // consumed here, so typing and dismissal cannot trigger viewer shortcuts.
  element.addEventListener('keydown', event => {
    event.stopPropagation();
    if (event.key === 'Escape' && ui.expanded) { event.preventDefault(); swallow(controls.minimize()); }
  }, { signal: abort.signal });
  resize(); render();
  return {
    async open(options = {}) {
      if (disposed) throw new Error('This inquiry surface has been disposed.');
      const { opener: requestedOpener, ...request } = options;
      const explicitOpener = requestedOpener?.ownerDocument === doc && typeof requestedOpener.focus === 'function' ? requestedOpener : null;
      if (explicitOpener || !ui.open || !ui.expanded) opener = explicitOpener || doc.activeElement;
      updateUI({ open: true, expanded: true });
      return session.open({ ...request, context: request.context || context });
    },
    async beforeLeave() {
      if (disposed) return true;
      updateUI({ leaving: true });
      const saved = await session.beforeLeave();
      updateUI({ leaving: false, ...(!saved ? { open: true, expanded: true } : {}) });
      return saved;
    },
    getContext: () => state.draft || state.project ? session.getContext() : null,
    minimize: controls.minimize,
    async dispose() {
      if (disposed) return true;
      if (!(await session.beforeLeave())) { updateUI({ open: true, expanded: true }); return false; }
      disposed = true; abort.abort(); unsubscribe(); session.dispose(); root.unmount();
      element.classList.remove('embedded-inquiry-host');
      element.style.removeProperty('--ei-viewport-height'); element.style.removeProperty('--ei-viewport-offset');
      announce(onState, { open: false, expanded: false, busy: false, draftId: null });
      return true;
    },
  };
}
