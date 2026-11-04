import { LEG_POSES } from './leg-poses.js';

export function createLegComparison({ changeTracks, choosePose, focusPose }) {
  const path = document.getElementById('study-path');
  const tracks = document.getElementById('track-comparison');
  const choices = document.getElementById('pose-choices');
  const trackButtons = [...tracks.querySelectorAll('button')];
  let active = false;
  let mode = 'layered';

  function chooseTracks(value) {
    mode = value;
    document.body.dataset.trackMode = mode;
    for (const button of trackButtons) button.setAttribute('aria-pressed', String(button.dataset.trackMode === mode));
    changeTracks(mode === 'layered');
  }
  for (const button of trackButtons) {
    button.addEventListener('click', () => chooseTracks(button.dataset.trackMode));
  }

  function highlightPose() {
    const button = choices.querySelector(':focus-visible') ?? choices.querySelector(':hover');
    focusPose(active && mode === 'layered' ? button?.dataset.poseId ?? null : null);
  }
  const poseButtons = LEG_POSES.map(({ id, label, progress }) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.poseId = id;
    button.textContent = label;
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => choosePose(id));
    button.addEventListener('pointerenter', highlightPose);
    button.addEventListener('pointerleave', highlightPose);
    button.addEventListener('focus', highlightPose);
    button.addEventListener('blur', () => queueMicrotask(highlightPose));
    choices.append(button);
    return { button, progress };
  });
  document.body.dataset.trackMode = mode;
  return {
    setChapter(id) {
      active = id === 'leg';
      for (const el of [path, tracks, choices]) el.hidden = !active;
      if (!active) focusPose(null);
    },
    setReady(ready) {
      for (const button of [...trackButtons, ...choices.children]) button.disabled = !ready;
    },
    highlight(id) {
      for (const { button } of poseButtons) button.toggleAttribute('data-hovered', active && button.dataset.poseId === id);
    },
    setProgress(value) {
      if (!active) return;
      for (const { button, progress } of poseButtons) {
        const pressed = String(Math.abs(progress - value) < .00051);
        if (button.getAttribute('aria-pressed') !== pressed) button.setAttribute('aria-pressed', pressed);
      }
    }
  };
}
