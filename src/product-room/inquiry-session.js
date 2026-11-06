import {
  ProjectError, cloneProjectValue, normalizeProjectContext, projectContextKey,
  reviewInquiry, sameProjectValue,
} from './project-domain.js';

/** The same persistence/review boundary is used by page and embedded inquiries. */
export async function prepareInquirySubmission({ repository, draft, saveDraft = value => repository.saveDraft(value) }) {
  const saved = await saveDraft(draft);
  return { draft: saved, review: reviewInquiry(saved) };
}

export function confirmInquirySubmission({ repository, review }) {
  return repository.submitInquiry(review);
}

const copy = cloneProjectValue;
const errorValue = error => ({ code: error?.code || 'INQUIRY_ERROR', message: error?.message || 'Your request could not be saved. Your input is still here. Please try again.', fields: copy(error?.fields || {}) });
const editableValue = draft => draft && ({ context: draft.context, values: draft.values, requirements: draft.requirements, inquiryRulesVersion: draft.inquiryRulesVersion || null });
const emptyDraft = draft => draft.revision === 0 && !draft.requirements.length && !Object.entries(draft.values).some(([key, value]) => !['intent', 'quoteScope'].includes(key) && String(value).trim());

/** One draft session, independent of routes, DOM, viewer internals and transport. */
export function createInquirySession({ repository, autosaveDelay = 500, schedule = setTimeout, cancel = clearTimeout } = {}) {
  if (!repository?.getDraft || !repository?.saveDraft || !repository?.submitInquiry) throw new TypeError('An inquiry needs a project repository.');
  let state = { draft: null, review: null, project: null, stage: 'details', loading: false, pending: '', saving: false, dirty: false, error: null, notice: '' };
  let savedDraft = null, timer = null, saveQueue = Promise.resolve(), activeAction = null, loadingOperation = null, generation = 0, leaving = 0, disposed = false;
  const listeners = new Set();
  const assertActive = () => { if (disposed) throw new ProjectError('DISPOSED', 'This inquiry has been closed.'); };
  const snapshot = () => copy(state);
  function publish(patch = {}) {
    if (disposed) return;
    state = { ...state, ...patch };
    state.dirty = Boolean(state.draft && (!savedDraft || !sameProjectValue(editableValue(state.draft), editableValue(savedDraft))));
    for (const listener of listeners) { try { listener(snapshot()); } catch { /* A host callback cannot break persistence. */ } }
  }
  function report(error) { publish({ error: errorValue(error) }); return error; }
  function clearTimer() { if (timer !== null) cancel(timer); timer = null; }
  function editable() {
    assertActive();
    if (!state.draft || state.loading || state.pending || leaving) throw new ProjectError('BUSY_STATE', 'Wait for the current inquiry action to finish.');
    if (state.stage !== 'details') throw new ProjectError('STALE_REVIEW', 'Choose Edit details before changing this reviewed inquiry.');
  }
  function queueSave() {
    clearTimer();
    const operation = saveQueue.catch(() => {}).then(async () => {
      if (disposed || !state.draft || state.stage === 'confirmed') return null;
      const source = copy(state.draft), turn = generation;
      if (savedDraft && sameProjectValue(source, savedDraft)) return copy(savedDraft);
      publish({ saving: true });
      try {
        const saved = await repository.saveDraft(source);
        if (!disposed && turn === generation && state.draft?.id === saved.id) {
          const editedDuringSave = !sameProjectValue(editableValue(state.draft), editableValue(source));
          savedDraft = copy(saved);
          // Typing during an autosave keeps the current values and adopts only
          // the persisted revision. The next queued save writes those edits.
          publish({ draft: editedDuringSave ? { ...state.draft, revision: saved.revision, updatedAt: saved.updatedAt } : copy(saved), error: null });
        }
        return saved;
      } catch (error) {
        if (!disposed && turn === generation) report(error);
        throw error;
      } finally { if (!disposed && turn === generation) publish({ saving: false }); }
    });
    saveQueue = operation;
    return operation;
  }
  function scheduleSave() {
    clearTimer();
    timer = schedule(() => { timer = null; void queueSave().catch(() => {}); }, autosaveDelay);
  }
  function run(label, task) {
    assertActive();
    if (activeAction || state.loading || leaving) return Promise.reject(new ProjectError('BUSY_STATE', 'Wait for the current inquiry action to finish.'));
    publish({ pending: label, error: null });
    const operation = Promise.resolve().then(task).catch(error => { report(error); throw error; }).finally(() => {
      if (activeAction === operation) activeAction = null;
      publish({ pending: '' });
    });
    activeAction = operation;
    return operation;
  }
  async function beforeLeave() {
    assertActive();
    clearTimer();
    leaving++;
    try {
      if (loadingOperation) await loadingOperation.catch(() => {});
      if (activeAction) await activeAction.catch(() => {});
      await queueSave(); return true;
    }
    catch { return false; }
    finally { leaving--; }
  }
  function applyContext(context) {
    const next = normalizeProjectContext(context), current = state.draft;
    if (projectContextKey(current.context) !== projectContextKey(next)) throw new ProjectError('INCOMPATIBLE_CONTEXT', 'This view belongs to another product or version. Your existing draft and saved view are unchanged.');
    const changedPart = !sameProjectValue(current.context.part, next.part);
    const requirements = current.requirements.filter(item => !(item.id === 'stroke-confirmed' && item.part && changedPart));
    const scopeCleared = changedPart && current.values.quoteScope === 'part';
    publish({ draft: { ...current, context: copy(next), requirements, values: scopeCleared ? { ...current.values, quoteScope: 'discuss' } : current.values }, review: null,
      notice: scopeCleared ? 'View updated. Choose the requested scope again for this component.' : requirements.length !== current.requirements.length ? 'View updated. Confirm the stroke requirement again for this component.' : 'Current view attached. Your entered details are unchanged.' });
  }
  function openDraft(draft, incoming, { suggestedIntent, suggestedScope } = {}) {
    savedDraft = draft.revision ? copy(draft) : null;
    if (emptyDraft(draft)) {
      if (['quotation', 'application-review'].includes(suggestedIntent)) draft.values.intent = suggestedIntent;
      if (['product', 'discuss'].includes(suggestedScope) || suggestedScope === 'part' && draft.context.part) draft.values.quoteScope = suggestedScope;
    }
    publish({ draft, project: null, review: null, stage: 'details', notice: draft.revision && !sameProjectValue(draft.context, incoming) ? 'Your saved draft keeps its original view. Choose Use current view to replace it.' : draft.revision ? 'Your saved draft is ready to continue.' : '' });
    // Persist even a reference-only draft so dismiss/reopen keeps the exact
    // capture, and every contextual entry resumes the same draft identity.
    if (!draft.revision) scheduleSave();
    return snapshot();
  }
  const api = {
    getState: snapshot,
    subscribe(listener) { assertActive(); listeners.add(listener); return () => listeners.delete(listener); },
    async open({ context, suggestedIntent, suggestedScope } = {}) {
      assertActive();
      const incoming = normalizeProjectContext(context);
      if (state.draft && projectContextKey(state.draft.context) === projectContextKey(incoming)) {
        if (!sameProjectValue(state.draft.context, incoming)) publish({ notice: 'Your draft keeps its saved view. Choose Use current view to replace it.' });
        return snapshot();
      }
      if (state.project && projectContextKey(state.project.context) === projectContextKey(incoming)) return snapshot();
      if (!(await beforeLeave())) throw new ProjectError(state.error?.code || 'STORAGE_UNAVAILABLE', state.error?.message || 'Save this draft before opening another product.');
      const turn = ++generation;
      publish({ loading: true, error: null, notice: '' });
      const loading = Promise.resolve().then(() => repository.getDraft(incoming));
      loadingOperation = loading;
      try {
        const draft = await loading;
        if (disposed || turn !== generation) return snapshot();
        return openDraft(draft, incoming, { suggestedIntent, suggestedScope });
      } catch (error) { if (!disposed && turn === generation) report(error); throw error; }
      finally {
        if (loadingOperation === loading) loadingOperation = null;
        if (!disposed && turn === generation) publish({ loading: false });
      }
    },
    updateValues(values) {
      editable();
      const next = { ...state.draft.values, ...values };
      const requirements = Object.hasOwn(values, 'stroke') && values.stroke !== state.draft.values.stroke ? state.draft.requirements.filter(item => item.id !== 'stroke-confirmed') : state.draft.requirements;
      publish({ draft: { ...state.draft, values: next, requirements }, review: null, error: null, notice: '' });
      scheduleSave();
    },
    updateRequirements(requirements) {
      editable(); publish({ draft: { ...state.draft, requirements: copy(requirements) }, review: null, error: null }); scheduleSave();
    },
    edit() {
      assertActive();
      if (state.pending || state.stage !== 'review') return;
      publish({ stage: 'details', review: null, error: null });
    },
    loadSavedDraft() {
      return run('reload', async () => {
        if (!state.draft) throw new ProjectError('NOT_READY', 'Open a draft before loading its saved version.');
        clearTimer();
        // A caller must explicitly choose to replace local input. Do not try
        // to save a stale draft or replace its values until the read succeeds.
        await saveQueue.catch(() => {});
        let saved;
        try { saved = await repository.getDraft(state.draft.context); }
        catch (error) { throw new ProjectError('RELOAD_FAILED', `The saved draft could not be loaded. Your current entries are still here. ${error?.message || 'Please try again.'}`); }
        if (!saved?.revision) throw new ProjectError('DRAFT_UNAVAILABLE', 'This draft was submitted or removed in another tab. Your current entries are still here; check the saved project before starting another inquiry.');
        savedDraft = copy(saved);
        publish({ draft: copy(saved), review: null, project: null, stage: 'details', error: null, notice: 'Latest saved draft loaded. Review these details again before confirming.' });
        return copy(saved);
      });
    },
    save: queueSave,
    review() {
      return run('review', async () => {
        if (!state.draft || state.stage !== 'details') throw new ProjectError('STALE_REVIEW', 'Open your inquiry details before reviewing.');
        const prepared = await prepareInquirySubmission({ repository, draft: state.draft, saveDraft: queueSave });
        publish({ draft: prepared.draft, review: prepared.review, stage: 'review', notice: '' });
        return copy(prepared.review);
      });
    },
    confirm() {
      if (state.stage === 'confirmed' && state.project) return Promise.resolve(copy(state.project));
      if (state.pending === 'confirm' && activeAction) return activeAction;
      return run('confirm', async () => {
        if (state.stage !== 'review' || !state.review) throw new ProjectError('STALE_REVIEW', 'Review the complete inquiry before confirming it.');
        const project = await confirmInquirySubmission({ repository, review: state.review });
        savedDraft = null;
        clearTimer();
        publish({ project, draft: null, review: null, stage: 'confirmed', notice: '' });
        return copy(project);
      });
    },
    startAnother({ capture, context, suggestedIntent = 'quotation', suggestedScope = 'discuss' } = {}) {
      return run('new', async () => {
        if (state.stage !== 'confirmed' || !state.project) throw new ProjectError('NOT_READY', 'Confirm the current inquiry before starting another one.');
        const turn = generation;
        // Keep the confirmed receipt available until both capture and opening
        // the next draft succeed. This never changes the confirmed project.
        const incoming = normalizeProjectContext(capture ? await capture() : context || state.project.context);
        const draft = await repository.getDraft(incoming);
        if (disposed || turn !== generation) throw new ProjectError('SUPERSEDED', 'The inquiry changed before the new draft could open.');
        return openDraft(draft, incoming, { suggestedIntent, suggestedScope });
      });
    },
    adopt(context) {
      editable();
      return run('capture', async () => { applyContext(context); await queueSave(); return api.getContext(); });
    },
    capture(capture) {
      editable();
      return run('capture', async () => { const context = await capture(); applyContext(context); await queueSave(); return api.getContext(); });
    },
    restore(restore) {
      return run('restore', () => restore(api.getContext()));
    },
    getContext() {
      assertActive();
      const context = state.draft?.context || state.project?.context;
      if (state.loading || !context) throw new ProjectError('NOT_READY', 'Wait for the saved inquiry reference to finish loading.');
      return copy(context);
    },
    beforeLeave,
    hasUnsavedChanges() { return state.dirty || state.saving; },
    dispose() { clearTimer(); ++generation; disposed = true; listeners.clear(); },
  };
  return api;
}
