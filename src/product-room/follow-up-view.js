import { createStoryController, storyStepIsCurrent } from './story.js';
import { requestItemTitle, requestItemPurposeLabel } from './request-items.js';
import './story-player.css';
import './follow-up-view.css';

/** A follow-up borrows the existing viewer and action clock. Progress is a saved
 * navigation place, never evidence of reading, agreement or quotation acceptance. */
export function createFollowUpView({ mount, viewer, release, model, parts, progress,
  actionAvailability, onSaveProgress, onReloadProgress, onOpenReference, onNextAction, onBack, preview = false, onError = () => {} }) {
  const doc = mount.ownerDocument, story = release.story;
  let saved = { ...progress }, opened = false, disposed = false, working = false;
  let lastState = viewer.state, failure = '', saveFailure = '', saveConflict = false, saveQueue = Promise.resolve();
  let availability = actionAvailability, controller;
  const make = (tag, cls = '', text = '') => { const node = doc.createElement(tag); node.className = cls; node.textContent = text; return node; };
  const bar = make('div', 'room-story-bar room-follow-up');
  bar.setAttribute('aria-label', 'Project follow-up');
  const intro = make('div', 'room-story-intro'), heading = make('div', 'room-story-heading');
  const headingText = make('div'), status = make('span', 'room-story-status'), title = make('strong');
  status.setAttribute('aria-live', 'polite'); headingText.append(status, title); heading.append(headingText);
  const caption = make('p', 'room-follow-up-caption'); intro.append(heading, caption);
  const controls = make('div', 'room-story-controls');
  async function perform(operation) {
    if (working || disposed) return;
    working = true; failure = ''; render();
    try { await operation(); }
    catch (error) { failure = error.message; onError(error); }
    finally { working = false; render(); }
  }
  const button = (label, operation, cls = 'room-button room-button-secondary') => {
    const node = make('button', cls, label); node.type = 'button';
    node.addEventListener('click', () => void perform(operation)); return node;
  };
  const icon = (node, label, path) => {
    if (node.getAttribute('aria-label') === label) return;
    node.setAttribute('aria-label', label); node.title = label; node.classList.add('room-story-icon');
    const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const line = doc.createElementNS(svg.namespaceURI, 'path');
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true'); line.setAttribute('d', path);
    svg.append(line); node.replaceChildren(svg);
  };
  const savedIndex = () => Math.max(0, story.steps.findIndex(step => step.id === saved.stepId));
  function persist(mode, index = controller.state().index) {
    const stepId = story.steps[index >= 0 ? index : savedIndex()].id;
    if (preview) { saved = { ...saved, revision: saved.revision + 1, stepId, mode }; render(); return Promise.resolve(saved); }
    saveQueue = saveQueue.catch(() => {}).then(async () => {
      try {
        saved = await onSaveProgress({ revision: saved.revision, stepId, mode });
        saveFailure = ''; saveConflict = false;
      } catch (error) { saveFailure = error.message; saveConflict = error.code === 'CONFLICT'; throw error; }
      finally { render(); }
    });
    // Event-driven persistence may finish after a takeover; its rejection still
    // stays visible and blocks a guarded leave until a retry succeeds.
    saveQueue.catch(() => {});
    return saveQueue;
  }
  async function select(index, play = true) {
    opened = true; agenda.open = false;
    await controller.select(index, { play });
    if (!controller.state().active) return;
    await persist('paused', index);
  }
  async function takeOver() {
    await controller.close(); opened = false;
    await persist('exploring'); render();
  }
  const previous = button('Previous step', () => select(controller.state().index - 1, false));
  const replay = button('Replay action', () => controller.replay());
  const pause = button('Pause action', () => lastState?.tour?.status === 'playing' ? controller.pause() : controller.resume());
  icon(previous, 'Previous step', 'M15 5l-7 7 7 7');
  icon(replay, 'Replay action', 'M3 10a9 9 0 1 1 2 8M3 3v7h7');
  const next = button('Start follow-up', async () => {
    if (!opened) return select(savedIndex());
    const state = controller.state();
    if (state.index < story.steps.length - 1) return select(state.index + 1);
    if (preview) { await controller.pause(); return onBack(); }
    if (!availability?.available) return;
    await controller.pause();
    await persist('complete');
    await onNextAction();
  }, 'room-button room-button-primary');
  controls.append(previous, replay, pause, next);
  const explore = button('Explore freely', takeOver, 'room-button room-story-exit'); heading.append(explore);
  const scrub = make('input', 'room-story-seek'); scrub.type = 'range'; scrub.min = '0'; scrub.max = '1'; scrub.step = '0.01'; scrub.value = '0';
  scrub.setAttribute('aria-label', 'Current action progress');
  scrub.addEventListener('change', () => void perform(() => controller.seek(Number(scrub.value))));
  const utility = make('div', 'room-follow-up-utility');
  const agenda = make('details', 'room-follow-up-agenda'), summary = make('summary', '', `${release.agenda.length} referenced request${release.agenda.length === 1 ? '' : 's'}`);
  const list = make('ol');
  for (const item of release.agenda) {
    const row = make('li'), top = make('div', 'room-follow-up-agenda-row'), identity = make('div');
    identity.append(make('strong', '', requestItemTitle(item)), make('small', '', requestItemPurposeLabel(item.purpose)));
    const reference = button(item.context.drawing ? 'View part in 3D' : 'View reference', async () => { await takeOver(); await onOpenReference(item); }, 'room-button room-story-exit');
    top.append(identity, reference); row.append(top, make('p', '', item.notes));
    const context = item.context;
    row.append(make('small', 'room-follow-up-reference', context.drawing
      ? `${context.drawing.title} · ${context.drawing.revisionLabel || context.drawing.revision}`
      : `Product version ${context.roomSnapshot?.version || release.context.roomSnapshot?.version || 'saved'} · ${context.inspection ? 'Saved 3D view' : 'Original request reference'}`));
    if (context.drawing) {
      let source;
      try { source = new URL(context.drawing.sourceURL, doc.baseURI); } catch { /* Preserve the reference without inventing a replacement source. */ }
      if (source && ['https:','http:'].includes(source.protocol)) {
        const original = make('a', 'room-follow-up-original', 'Open original drawing');
        original.href = source.href; original.target = '_blank'; original.rel = 'noopener noreferrer'; row.append(original);
      } else row.append(make('small', 'room-follow-up-reference', 'The original drawing source is unavailable. Its saved version has not changed.'));
    }
    list.append(row);
  }
  agenda.append(summary, list); agenda.hidden = !release.agenda.length;
  const back = button(preview ? 'Return to review' : 'View project', () => onBack(), 'room-button room-story-exit');
  const restart = button('Start again', () => select(0), 'room-button room-story-exit');
  utility.append(agenda, restart, back);
  const notice = make('p', 'room-story-error'); notice.setAttribute('role', 'status');
  const retry = button('Retry saving place', async () => {
    if (saveConflict && onReloadProgress) {
      const current = await onReloadProgress();
      await viewer.pause(); controller.yieldToExplorer(); opened = false; saved = current;
      saveFailure = ''; saveConflict = false; saveQueue = Promise.resolve(); render();
    } else await persist(opened ? 'paused' : saved.mode);
  }, 'room-button room-button-secondary room-follow-up-retry');
  const targetNotice = make('p', 'room-follow-up-target');
  bar.append(intro, controls, scrub, utility, targetNotice, notice, retry); mount.replaceChildren(bar);
  controller = createStoryController({ viewer, story, model, parts, hostedControls: true, onChange: render });
  function render() {
    if (disposed || !controller) return;
    const current = controller.state(), step = current.step;
    const available = lastState?.lifecycle === 'ready' && lastState.model?.id === model.id && lastState.model?.revision === model.revision;
    const busy = working || current.busy;
    const final = opened && current.index === story.steps.length - 1;
    bar.dataset.expanded = String(opened);
    title.textContent = opened && step ? step.title : release.title;
    caption.textContent = opened && step ? step.caption : release.introduction || 'Revisit the referenced details, then continue your project.';
    status.textContent = opened && step ? `Step ${current.index + 1} of ${story.steps.length}`
      : saved.revision > 0 ? `Saved at step ${savedIndex() + 1} of ${story.steps.length}` : `${story.steps.length} steps · ${preview ? 'Preview' : `Follow-up v${release.version}`}`;
    previous.hidden = !opened || current.index <= 0; previous.disabled = busy || !available;
    replay.hidden = !opened || !step; replay.disabled = busy || !available;
    pause.hidden = !opened || step?.kind !== 'chapter'; pause.disabled = busy || !available;
    const playing = lastState?.tour?.status === 'playing';
    icon(pause, playing ? 'Pause action' : 'Resume action', playing ? 'M8 5v14M16 5v14' : 'M8 4l12 8-12 8z');
    next.textContent = !opened ? saved.revision > 0 ? `Resume step ${savedIndex() + 1}` : 'Start follow-up'
      : final ? preview ? 'Finish preview' : availability?.label || 'Next action unavailable' : 'Next step';
    next.disabled = busy || !available || Boolean(final && !preview && !availability?.available) || Boolean(saveFailure);
    explore.hidden = !opened; explore.disabled = busy;
    restart.hidden = opened || saved.revision === 0; restart.disabled = busy || !available || Boolean(saveFailure);
    back.disabled = busy;
    for (const node of list.querySelectorAll('button')) node.disabled = busy || !available;
    scrub.hidden = !opened || step?.kind !== 'chapter'; scrub.disabled = busy || !available;
    if (step?.kind === 'chapter') {
      const chapter = model.tour.chapters.find(item => item.id === step.chapterId);
      if (lastState?.tour?.chapterId === step.chapterId) scrub.value = String(Math.max(0, Math.min(1, (lastState.tour.time - chapter.start) / chapter.duration)));
    }
    targetNotice.textContent = final && !preview && !availability?.available ? availability?.reason || 'The next action is unavailable. View the project for its current status.' : '';
    targetNotice.hidden = !targetNotice.textContent;
    notice.textContent = saveFailure ? `Your place could not be saved. ${saveFailure}` : failure || current.error;
    notice.hidden = !notice.textContent; retry.hidden = !saveFailure; retry.disabled = busy;
    retry.textContent = saveConflict && onReloadProgress ? 'Load saved place' : 'Retry saving place';
  }
  render();
  return {
    update(state) {
      lastState = state;
      const current = controller.state();
      if (opened && current.active && !current.busy && (!storyStepIsCurrent(current.step, state, model)
          || current.step.kind === 'chapter' && state.tour.controls !== 'host')) {
        opened = false; controller.yieldToExplorer();
        void persist('exploring').catch(onError);
      }
      render();
    },
    setActionAvailability(value) { availability = value; render(); },
    async beforeLeave() {
      try {
        await saveQueue;
        if (saveFailure) return false;
        if (opened) {
          await viewer.pause(); opened = false; controller.yieldToExplorer();
          await persist(saved.mode === 'complete' ? 'complete' : 'paused');
        }
        return true;
      } catch (error) { onError(error); return false; }
      finally { render(); }
    },
    suspend() { opened = false; controller.yieldToExplorer(); render(); void viewer.pause().catch(onError); },
    dispose() { disposed = true; controller.dispose(); mount.replaceChildren(); },
  };
}
