import { REQUEST_PURPOSES, requestContext, requestDraftKey, createRequestDraft, updateRequestDraft, removeRequestContext, replaceRequestContext, reviewRequest, editRequest, confirmRequest, reopenRequest } from './request-state.js';

/** Accessible demo-only request dialog. The host pauses the Explorer before open.
 * Drafts live in this instance only and are discarded on reload or disposal. */
export function createRequestFlow({ dialog, onClose = () => {} }) {
  if (!dialog?.showModal) throw new TypeError('Provide a native dialog element.');
  const document = dialog.ownerDocument, drafts = new Map(), abort = new AbortController();
  let state = null, currentContext = null, opener = null, restoredContext = false, disposed = false;
  const prefix = dialog.id || 'room-request';
  dialog.classList.add('room-request'); dialog.setAttribute('aria-labelledby', `${prefix}-title`);
  const el = (tag, className, text) => {
    const node = document.createElement(tag); if (className) node.className = className;
    if (text !== undefined) node.textContent = text; return node;
  };
  const button = (label, className, action) => {
    const node = el('button', className, label); node.type = 'button'; node.addEventListener('click', action); return node;
  };
  const persist = () => { if (state) drafts.set(requestDraftKey(state.context), state); };
  const focusTitle = () => dialog.querySelector('h2')?.focus();
  const close = () => { if (dialog.open) dialog.close(); };
  const progress = () => {
    const list = el('ol', 'room-request-progress'); list.setAttribute('aria-label', 'Request progress');
    for (const [index, title] of ['Details', 'Review'].entries()) {
      const item = el('li', '', `${String(index + 1).padStart(2, '0')}  ${title}`);
      if (state.stage === (index ? 'review' : 'draft')) item.setAttribute('aria-current', 'step');
      if (state.stage === 'confirmed' || (state.stage === 'review' && index === 0)) item.dataset.complete = 'true';
      list.append(item);
    }
    return list;
  };
  const contextSection = () => {
    const section = el('section', 'room-request-context'); section.setAttribute('aria-label', 'Attached context');
    section.append(el('p', 'room-request-label', 'About this product'), el('strong', '', state.context.productTitle));
    if (state.context.modelRevision) {
      const details = el('details', 'room-request-revision');
      details.append(el('summary', '', 'Model context'));
      const line = el('p', '', `Model: ${state.context.modelId} · Revision: ${state.context.modelRevision}`);
      details.append(line); section.append(details);
    }
    const list = el('ul', 'room-request-attachments');
    for (const [key, label] of [['part', 'Part'], ['document', 'Document'], ['chapter', 'Explanation']]) {
      const item = state.context[key]; if (!item) continue;
      const row = el('li'); row.append(el('span', '', `${label}: ${item.title}`));
      if (state.stage === 'draft') {
        const remove = button('Remove', 'room-request-text-button', () => { state = removeRequestContext(state, key); persist(); render(); focusTitle(); });
        remove.setAttribute('aria-label', `Remove ${label.toLowerCase()} context`); row.append(remove);
      }
      list.append(row);
    }
    if (list.childElementCount) section.append(list);
    return section;
  };
  const field = (form, key, label, control) => {
    const wrap = el('div', `room-request-field room-request-field-${key}`), caption = el('label', '', label);
    control.id = `${prefix}-${key}`; control.name = key; caption.htmlFor = control.id;
    const error = el('p', 'room-request-field-error', state.errors[key] || ''); error.id = `${control.id}-error`; error.hidden = !state.errors[key];
    if (state.errors[key]) { control.setAttribute('aria-invalid', 'true'); control.setAttribute('aria-describedby', error.id); }
    control.addEventListener('input', () => { state = updateRequestDraft(state, { [key]: control.value }); persist(); error.hidden = true; control.removeAttribute('aria-invalid'); });
    wrap.append(caption, control, error); form.append(wrap); return control;
  };
  const showDraft = main => {
    if (restoredContext) {
      const notice = el('div', 'room-request-restored');
      notice.append(el('p', '', 'Your earlier draft is restored with its attached context.'), button('Use current context', 'room-request-text-button', () => {
        state = replaceRequestContext(state, currentContext); restoredContext = false; persist(); render(); focusTitle();
      })); main.append(notice);
    }
    main.append(contextSection());
    const form = el('form', 'room-request-form'); form.noValidate = true;
    const purpose = el('select');
    for (const item of REQUEST_PURPOSES) { const option = el('option', '', item.label); option.value = item.id; purpose.append(option); }
    purpose.value = state.values.purpose; field(form, 'purpose', 'What would you like to do?', purpose);
    const message = el('textarea'); message.value = state.values.message; message.rows = 4; message.maxLength = 2000; message.required = true;
    message.placeholder = 'For example: Could this guide arrangement suit our application?';
    field(form, 'message', 'Your question or application', message);
    const contact = el('div', 'room-request-contact');
    const name = el('input'); name.type = 'text'; name.value = state.values.name; name.maxLength = 120; name.autocomplete = 'off'; name.placeholder = 'Example visitor';
    field(contact, 'name', 'Name (optional)', name);
    const email = el('input'); email.type = 'email'; email.value = state.values.email; email.maxLength = 254; email.autocomplete = 'off'; email.placeholder = 'visitor@example.com';
    field(contact, 'email', 'Email (optional)', email); form.append(contact);
    form.append(el('p', 'room-request-note', 'Demo only. Use sample details. Nothing will be sent or stored in an account.'));
    const footer = el('footer', 'room-request-footer');
    footer.append(el('p', 'room-request-draft-note', 'Draft kept on this page until you reload.'));
    const review = el('button', 'room-button room-button-primary room-request-primary', 'Review request'); review.type = 'submit'; footer.append(review); form.append(footer);
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (state.stage !== 'draft') return;
      state = reviewRequest(state); persist(); render();
      if (state.stage === 'review') focusTitle(); else dialog.querySelector('[aria-invalid="true"]')?.focus();
    });
    main.append(form);
  };
  const reviewedDetails = () => {
    const section = el('section', 'room-request-review'); section.setAttribute('aria-label', 'Request details');
    const list = el('dl', 'room-request-summary');
    for (const [label, value] of [
      ['Next step', REQUEST_PURPOSES.find(item => item.id === state.values.purpose)?.label],
      ['Name', state.values.name || 'Not provided'], ['Email', state.values.email || 'Not provided']
    ]) list.append(el('dt', '', label), el('dd', '', value));
    section.append(list, el('p', 'room-request-label', 'Your message'), el('p', 'room-request-message', state.values.message)); return section;
  };
  const showReview = main => {
    main.append(contextSection(), reviewedDetails(), el('p', 'room-request-note', 'Check the details above before confirming. This creates a demo receipt on this page; nothing is sent.'));
    const footer = el('footer', 'room-request-footer');
    footer.append(button('Edit details', 'room-button room-button-secondary', () => { state = editRequest(state); persist(); render(); focusTitle(); }));
    footer.append(button('Confirm demo request', 'room-button room-button-primary room-request-primary', event => {
      if (state.stage !== 'review') return;
      event.currentTarget.disabled = true;
      state = confirmRequest(state, { id: `DEMO-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, createdAt: new Date().toISOString() });
      persist(); render(); focusTitle();
    })); main.append(footer);
  };
  const showReceipt = main => {
    const icon = el('span', 'room-request-success', '✓'); icon.setAttribute('aria-hidden', 'true');
    main.append(icon, el('p', 'room-request-confirmation', 'Nothing was sent. This sample receipt is available on this page only.'), contextSection(), reviewedDetails());
    const receipt = el('dl', 'room-request-receipt');
    receipt.append(el('dt', '', 'Demo reference'), el('dd', '', state.receipt.id)); main.append(receipt);
    const footer = el('footer', 'room-request-footer');
    footer.append(button('Start another request', 'room-request-text-button', () => { state = createRequestDraft(currentContext); persist(); render(); focusTitle(); }), button('Return to product', 'room-button room-button-primary room-request-primary', close)); main.append(footer);
  };
  function render() {
    const shell = el('div', 'room-request-shell'), header = el('header', 'room-request-header');
    const intro = el('div'); intro.append(el('p', 'room-request-eyebrow', 'Product conversation'));
    const title = el('h2', '', state.stage === 'draft' ? 'Discuss your application.' : state.stage === 'review' ? 'Review your request.' : 'Demo request recorded.'); title.id = `${prefix}-title`; title.tabIndex = -1; intro.append(title);
    const closeButton = button('×', 'room-request-close', close); closeButton.setAttribute('aria-label', 'Close request'); header.append(intro, closeButton);
    shell.append(header, progress());
    const main = el('div', 'room-request-body');
    if (state.stage === 'draft') showDraft(main); else if (state.stage === 'review') showReview(main); else showReceipt(main);
    shell.append(main); dialog.replaceChildren(shell); dialog.dataset.step = state.stage; dialog.scrollTop = 0;
  }
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); }, { signal: abort.signal });
  dialog.addEventListener('close', () => {
    // Native close events are queued. A host may already have opened a new request.
    if (dialog.open) return;
    persist();
    try { if (!disposed) onClose(); }
    finally { if (opener?.isConnected) opener.focus({ preventScroll: true }); }
  }, { signal: abort.signal });
  return {
    open(context) {
      if (disposed) throw new Error('This request flow has been disposed.');
      currentContext = requestContext(context);
      const saved = drafts.get(requestDraftKey(currentContext));
      state = reopenRequest(saved, currentContext);
      restoredContext = Boolean(state.values.message.trim() && JSON.stringify(currentContext) !== JSON.stringify(state.context));
      persist(); if (!dialog.open) opener = document.activeElement; render(); if (!dialog.open) dialog.showModal(); focusTitle();
    },
    close,
    dispose() { disposed = true; close(); abort.abort(); drafts.clear(); dialog.replaceChildren(); }
  };
}
