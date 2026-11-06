import { createStoryController, storyStepIsCurrent } from './story.js';
import './story-player.css';

/** Compact host controls; time and all 3D animation remain in Explorer. */
export function createProductStoryPlayer({ mount, viewer, story, model, parts, onError = () => {}, onDiscuss }) {
  let opened = false, disposed = false, lastState = null;
  const doc = mount.ownerDocument;
  const make = (tag, className, text) => { const element = doc.createElement(tag); element.className = className; if (text) element.textContent = text; return element; };
  const bar = make('div', 'room-story-bar');
  const intro = make('div', 'room-story-intro');
  const title = make('strong', '', story.title), caption = make('p', ''), status = make('span', 'room-story-status');
  const heading = make('div', 'room-story-heading'), headingText = make('div', '');
  headingText.append(status, title); heading.append(headingText); intro.append(heading, caption);
  const controls = make('div', 'room-story-controls');
  const button = (text, action, primary = false) => {
    const element = make('button', primary ? 'room-button room-button-primary' : 'room-button room-button-secondary', text);
    element.type = 'button'; element.addEventListener('click', () => void Promise.resolve().then(action).catch(onError)); controls.append(element); return element;
  };
  let controller;
  const previous = button('Previous', () => controller.select(controller.state().index - 1));
  const replay = button('Replay', () => controller.replay());
  const pause = button('Pause', () => lastState?.tour?.status === 'playing' ? controller.pause() : controller.resume());
  const next = button('Start story', () => {
    const nextIndex = opened ? controller.state().index + 1 : 0;
    opened = true;
    return controller.select(nextIndex, { play: true });
  }, true);
  const discuss = button('Ask about this step', () => onDiscuss?.(controller.state().step));
  const close = button('Explore freely', async () => { await controller.close(); opened = false; render(); });
  close.className = 'room-button room-story-exit'; heading.append(close);
  const iconButton = (element, label, path) => {
    if (element.getAttribute('aria-label') === label && element.firstElementChild?.tagName.toLowerCase() === 'svg') return;
    element.setAttribute('aria-label', label); element.title = label; element.classList.add('room-story-icon');
    const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg'), shape = doc.createElementNS(svg.namespaceURI, 'path');
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true'); shape.setAttribute('d', path); svg.append(shape); element.replaceChildren(svg);
  };
  iconButton(previous, 'Previous', 'M15 5l-7 7 7 7');
  iconButton(replay, 'Replay', 'M3 10a9 9 0 1 1 2 8M3 3v7h7');
  discuss.textContent = 'Ask about this'; discuss.setAttribute('aria-label', 'Ask about this step');
  const scrub = make('input', 'room-story-seek'); scrub.type = 'range'; scrub.min = '0'; scrub.max = '1'; scrub.step = '0.01'; scrub.value = '0'; scrub.setAttribute('aria-label', 'Story action progress');
  scrub.addEventListener('change', () => void controller.seek(Number(scrub.value)).catch(onError));
  const notice = make('p', 'room-story-error'); notice.setAttribute('role', 'status');
  bar.append(intro, controls, scrub, notice); mount.replaceChildren(bar);
  controller = createStoryController({ viewer, story, model, parts, hostedControls: true, onChange: render });
  function render() {
    if (disposed) return;
    const state = controller.state(), step = state.step;
    const available = viewer.state?.lifecycle === 'ready' && viewer.state.model?.id === model.id && viewer.state.model?.revision === model.revision;
    bar.dataset.expanded = String(opened);
    title.textContent = opened && step ? step.title : story.title;
    caption.textContent = opened && step ? step.caption : `${story.steps.length} short steps through the product.`;
    status.textContent = opened && step ? `Step ${state.index + 1} of ${state.count}` : '';
    status.hidden = !status.textContent;
    previous.hidden = !opened || state.index <= 0; previous.disabled = state.busy || state.index <= 0;
    replay.hidden = !opened || !step; replay.disabled = state.busy || !available;
    pause.hidden = !opened || step?.kind !== 'chapter'; pause.disabled = state.busy || !available;
    const playing = lastState?.tour?.status === 'playing';
    iconButton(pause, playing ? 'Pause' : 'Resume', playing ? 'M8 5v14M16 5v14' : 'M8 4l12 8-12 8z');
    next.hidden = opened && state.index === state.count - 1;
    next.textContent = opened ? 'Next step' : 'Start story'; next.disabled = state.busy || !available;
    close.hidden = !opened; close.disabled = state.busy;
    discuss.hidden = !opened || !step || !onDiscuss; discuss.disabled = state.busy || !available;
    scrub.hidden = !opened || step?.kind !== 'chapter'; scrub.disabled = state.busy || !available;
    notice.textContent = state.error; notice.hidden = !state.error;
    if (step?.kind === 'chapter') {
      const chapter = model.tour.chapters.find(item => item.id === step.chapterId);
      if (lastState?.tour?.chapterId === step.chapterId) scrub.value = String(Math.max(0, Math.min(1, (lastState.tour.time - chapter.start) / chapter.duration)));
    }
  }
  render();
  return {
    update(state) {
      lastState = state;
      const current = controller.state();
      if (opened && current.active && !current.busy && (!storyStepIsCurrent(current.step, state, model) || current.step.kind === 'chapter' && state.tour.controls !== 'host')) {
        opened = false; controller.yieldToExplorer();
      }
      render();
    },
    suspend() { void viewer.pause().catch(onError); },
    dispose() { disposed = true; controller.dispose(); mount.replaceChildren(); },
  };
}
