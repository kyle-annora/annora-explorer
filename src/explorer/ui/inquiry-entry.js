import './inquiry-entry.css';

/** A host action in the shared shell. It never owns or reads scene objects. */
export function createInquiryEntry({ navigation, label = 'Request a quote', onRequest, document: doc = globalThis.document }) {
  const abort = new AbortController();
  const button = doc.createElement('button');
  button.type = 'button'; button.className = 'viewer-quote'; button.id = 'viewer-request-quote';
  const text = doc.createElement('span'); text.textContent = label;
  const arrow = doc.createElement('span'); arrow.textContent = '→'; arrow.setAttribute('aria-hidden', 'true');
  button.append(text, arrow);
  const message = doc.createElement('div'); message.className = 'viewer-quote-message'; message.hidden = true;
  message.setAttribute('role', 'status'); message.setAttribute('aria-live', 'polite');
  const body = doc.createElement('p');
  const dismiss = doc.createElement('button'); dismiss.type = 'button'; dismiss.textContent = 'Keep exploring';
  message.append(body, dismiss);
  navigation.header.querySelector('.viewer-navigation-actions').append(button);
  navigation.header.append(message);
  doc.body.dataset.quoteEntry = 'true';
  let busy = false, ready = false;
  function sync() { button.disabled = busy || !ready; button.setAttribute('aria-busy', String(busy)); text.textContent = busy ? 'Attaching view…' : label; }
  function showError(error) { body.textContent = error?.message || 'Your view could not be attached. Keep exploring, then try again.'; message.hidden = false; }
  button.addEventListener('click', async () => {
    if (busy || !ready) return;
    busy = true; message.hidden = true; sync();
    try { await onRequest(); } catch (error) { showError(error); }
    finally { if (!abort.signal.aborted) { busy = false; sync(); } }
  }, { signal: abort.signal });
  dismiss.addEventListener('click', () => { message.hidden = true; button.focus(); }, { signal: abort.signal });
  sync();
  return {
    setReady(value) { ready = value; sync(); },
    showError,
    dispose() { abort.abort(); button.remove(); message.remove(); delete doc.body.dataset.quoteEntry; },
  };
}
