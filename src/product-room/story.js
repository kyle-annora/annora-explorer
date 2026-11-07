import { normalizeInspectionReference } from '../explorer/inspection-reference.js';
import { validateTechnicalStoryReference } from './technical-story.js';

export const STORY_VERSION = 1;
export const STORY_MAX_STEPS = 8;
const copy = value => JSON.parse(JSON.stringify(value));
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const text = (value, max, required = true) => typeof value === 'string' && value.length <= max && (!required || Boolean(value.trim()));
const failure = (code, message) => Object.assign(new Error(message), { code });

/** Prepared actions, held views and pinned technical references; never executable animation data. */
export function validateProductStory(story, { model, parts = [], technicalReferences = [], historical = false } = {}) {
  if (story === undefined) return [];
  const issues = [];
  const add = (path, message) => issues.push({ path: `presentation.story${path}`, section: 'presentation', message, severity: 'error' });
  if (!object(story) || story.version !== STORY_VERSION || !Array.isArray(story.steps)) { add('', 'This story has an unsupported structure.'); return issues; }
  if (!text(story.title, 100)) add('.title', 'Give the product story a title within 100 characters.');
  if (story.steps.length < 1 || story.steps.length > STORY_MAX_STEPS) add('.steps', `Use one to ${STORY_MAX_STEPS} story steps.`);
  if (new Set(story.steps.map(step => step?.id)).size !== story.steps.length) add('.steps', 'Each story step needs a unique identity.');
  const ids = new Set(parts.map(part => part.id));
  for (const [index, step] of story.steps.entries()) {
    const path = `.steps.${index}`;
    if (!object(step)) { add(path, 'This story step is missing.'); continue; }
    if (!text(step.id, 160) || !text(step.title, 100) || !text(step.caption, 320)) add(path, 'Add a short title and explanation to this step.');
    if (!text(step.nodeId, 256)) add(path, 'A story step needs a bounded part identity.');
    else if (!historical && !ids.has(step.nodeId)) add(`${path}.nodeId`, 'Choose a part from this prepared model.');
    if (step.kind === 'technical') {
      try { validateTechnicalStoryReference(step.technical, { model, nodeId: step.nodeId, technicalReferences, historical }); }
      catch (error) { add(`${path}.technical`, error.message); }
      if (step.tourId !== undefined || step.chapterId !== undefined) add(path, 'A technical reference cannot also start a prepared action.');
    } else if (step.technical !== undefined) add(path, 'Only a technical step can contain a drawing reference.');
    if (step.kind === 'chapter') {
      const chapter = model?.tour?.chapters?.find(item => item.id === step.chapterId);
      if (!text(step.tourId, 256) || !text(step.chapterId, 256)) add(path, 'An action needs its original tour and chapter identities.');
      else if (!historical && (step.tourId !== model?.tour?.id || !chapter || chapter.duration < 2 || chapter.duration > 3)) add(`${path}.chapterId`, 'Choose an approved 2–3 second action from this model.');
      if (!historical && chapter && ![chapter.selectedId, ...(chapter.highlightIds || [])].includes(step.nodeId)) add(`${path}.nodeId`, 'Choose a subject shown by this prepared action.');
      if (step.inspection !== undefined) add(path, 'An authored action uses its prepared camera; remove the unrelated saved view.');
    } else if (step.kind === 'inspection' || (step.kind === 'technical' && step.inspection !== undefined)) {
      try {
        const inspection = normalizeInspectionReference(step.inspection, { model: { id: model.id, revision: model.revision } });
        if (!inspection.view || inspection.preview || inspection.view.selectedId !== step.nodeId)
          throw new Error();
        if (!historical && (!ids.has(inspection.view.selectedId) || !ids.has(inspection.view.scopeId))) throw new Error();
        if (!historical && inspection.view.mode === 'operate' && inspection.view.operation.clipId !== model.operationClipId) throw new Error();
      } catch { add(`${path}.inspection`, 'Capture a settled view of the selected part in this model revision.'); }
      if (step.tourId !== undefined || step.chapterId !== undefined) add(path, 'A held view cannot also refer to an action.');
    } else if (step.kind !== 'technical') add(`${path}.kind`, 'Choose a held view, prepared action or technical reference.');
  }
  return issues;
}

export function copyProductStory(story) {
  if (story === undefined) return undefined;
  const serialized = JSON.stringify(story);
  if (!serialized || serialized.length > 64000) throw failure('VALIDATION', 'Keep the product story within the supported size.');
  const value = JSON.parse(serialized);
  // Drafts may have unfinished text or captures, but must remain safe to edit.
  if (!object(value) || value.version !== STORY_VERSION || !text(value.title, 100, false)
      || !Array.isArray(value.steps) || value.steps.length > STORY_MAX_STEPS
      || value.steps.some(step => !object(step) || !text(step.id, 160)
        || !text(step.title, 100, false) || !text(step.caption, 320, false)
        || !text(step.nodeId, 256, false) || !['inspection', 'chapter', 'technical'].includes(step.kind))
      || new Set(value.steps.map(step => step.id)).size !== value.steps.length)
    throw failure('VALIDATION', 'The product story needs editable steps, titles and part identities.');
  return value;
}

/** Orbiting or pausing keeps a step; another source chapter belongs to Explorer. */
export function storyStepIsCurrent(step, state, model) {
  if (!step || state?.lifecycle !== 'ready' || state.model?.id !== model.id || state.model?.revision !== model.revision) return false;
  if (step.kind === 'chapter') return Boolean(state.tour?.active && state.tour.tourId === step.tourId && state.tour.chapterId === step.chapterId);
  return state.navigation?.selectedId === step.nodeId && !state.tour?.active;
}

/** One command adapter. The existing Explorer owns motion, clock and interruption. */
export function createStoryController({ viewer, story, model, parts, technicalReferences = [],
  showTechnicalReference, clearTechnicalReference, hostedControls = false, onChange = () => {} }) {
  const issues = validateProductStory(story, { model, parts, technicalReferences });
  if (issues.length) throw failure('INVALID_STORY', issues[0].message);
  const source = copy(story);
  let index = -1, requestId = 0, busy = false, disposed = false, error = '', active = false, technicalLoad = null;
  const clearTechnical = () => {
    technicalLoad?.abort(); technicalLoad = null;
    try { clearTechnicalReference?.(); } catch { /* Optional host UI cleanup cannot change viewer state. */ }
  };
  const snapshot = () => ({ index, step: index >= 0 ? copy(source.steps[index]) : null, count: source.steps.length, busy, active, error });
  const publish = () => { if (!disposed) onChange(snapshot()); };
  const ensure = () => {
    const state = viewer.state;
    if (disposed) throw failure('DISPOSED', 'This product story has closed.');
    if (state?.lifecycle !== 'ready') throw failure('NOT_READY', 'Wait for the product model to finish loading.');
    if (state.model?.id !== model.id || state.model?.revision !== model.revision) throw failure('INCOMPATIBLE_VIEW', 'This story belongs to another model version.');
  };
  async function select(nextIndex, { play = false } = {}) {
    ensure();
    if (!Number.isInteger(nextIndex) || nextIndex < 0 || nextIndex >= source.steps.length) throw failure('INVALID_ARGUMENT', 'Choose a story step.');
    const turn = ++requestId, step = source.steps[nextIndex];
    busy = true; error = ''; publish();
    const current = () => !disposed && turn === requestId;
    try {
      if (step.kind === 'technical' && typeof showTechnicalReference !== 'function')
        throw failure('UNSUPPORTED_CAPABILITY', 'This host cannot show technical drawing steps. Open a drawing-capable Product Room.');
      clearTechnical();
      await viewer.pause(); if (!current()) return;
      if (viewer.state?.tour?.active) { await viewer.request('exitTour', { restore: false }); if (!current()) return; }
      if (step.kind === 'technical') {
        technicalLoad = new AbortController();
        await showTechnicalReference(copy(step.technical), { signal: technicalLoad.signal, isCurrent: current, step: copy(step) });
        if (!current()) return;
        if (step.inspection) await viewer.request('restoreInspection', { inspection: copy(step.inspection) });
        else await viewer.request('focus', { nodeId: step.nodeId });
      } else if (step.kind === 'inspection') await viewer.request('restoreInspection', { inspection: copy(step.inspection) });
      else {
        await viewer.request('startTour', { tourId: step.tourId, ...(hostedControls ? { controls: 'host' } : {}) }); if (!current()) return;
        await viewer.request('goToTourChapter', { chapterId: step.chapterId }); if (!current()) return;
        if (play) await viewer.request('resumeTour');
      }
      if (!current()) return;
      index = nextIndex; active = true;
    } catch (cause) { if (current()) { if (step.kind === 'technical') clearTechnical(); error = cause.message; throw cause; } }
    finally { if (current()) { busy = false; publish(); } }
  }
  async function pause() { ensure(); await viewer.pause(); publish(); }
  async function resume() { ensure(); if (source.steps[index]?.kind !== 'chapter') return; await viewer.request('resumeTour'); publish(); }
  async function replay() { if (index >= 0) await select(index, { play: true }); }
  async function seek(progress) {
    ensure(); const step = source.steps[index];
    if (step?.kind !== 'chapter' || !Number.isFinite(progress) || progress < 0 || progress > 1) throw failure('INVALID_ARGUMENT', 'Choose a position in the current action.');
    const chapter = model.tour.chapters.find(item => item.id === step.chapterId);
    await viewer.request('seekTour', { seconds: chapter.start + progress * chapter.duration, chapterId: chapter.id }); publish();
  }
  async function close() {
    ++requestId; busy = false; active = false; error = '';
    clearTechnical();
    await viewer.pause();
    if (viewer.state?.tour?.active) await viewer.request('exitTour', { restore: false });
    publish();
  }
  const restoreControls = () => { if (hostedControls && viewer.state?.tour?.active) void viewer.request('setTourControls', { controls: 'explorer' }).catch(() => {}); };
  return { select, pause, resume, replay, seek, close, state: snapshot,
    yieldToExplorer() { ++requestId; busy = false; active = false; error = ''; clearTechnical(); restoreControls(); publish(); },
    dispose() { disposed = true; ++requestId; clearTechnical(); restoreControls(); },
  };
}
