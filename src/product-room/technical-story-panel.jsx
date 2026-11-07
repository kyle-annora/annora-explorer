import React from 'react';
import { createRoot } from 'react-dom/client';
import { TechnicalStoryPreview } from '../studio/technical-story-preview.jsx';
import { resolveTechnicalStoryPreview } from './technical-story-source.js';
import './technical-story-panel.css';

/** A drawing companion to the already-mounted Explorer; never mounts another 3D scene. */
export function createTechnicalStoryPanel({stage}) {
  const mount = document.createElement('section');
  mount.className = 'room-technical-companion room-ui'; mount.hidden = true;
  mount.setAttribute('aria-label','Story drawing'); stage.append(mount);
  const root = createRoot(mount);
  const switcher = document.createElement('div'); switcher.className = 'room-technical-switch'; switcher.hidden = true;
  switcher.setAttribute('role','group'); switcher.setAttribute('aria-label','Current step view');
  const buttons = ['3D','Drawings'].map((label,index) => {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
    button.className = 'room-button room-button-secondary';
    button.onclick = () => view(index ? 'drawing' : 'model'); switcher.append(button); return button;
  }); stage.prepend(switcher);
  let lease, generation = 0;
  function view(mode) {
    stage.dataset.technicalView = mode;
    buttons.forEach((button,index) => button.setAttribute('aria-pressed',String(mode === (index ? 'drawing' : 'model'))));
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
  }
  function clear() {
    generation++; lease?.dispose?.(); lease = null;
    root.render(null); mount.hidden = true; switcher.hidden = true;
    delete stage.dataset.technical; delete stage.dataset.technicalView;
  }
  return {
    async show(reference, options = {}) {
      clear(); const turn = generation;
      stage.dataset.technical = 'true'; mount.hidden = false; switcher.hidden = false; view('drawing');
      root.render(<p role="status">Opening the recorded drawing…</p>);
      try {
        const resolved = await resolveTechnicalStoryPreview(reference, {...options,isCurrent:()=>turn === generation && (options.isCurrent?.() ?? true)});
        if (turn !== generation || options.signal?.aborted) { resolved.dispose?.(); return; }
        lease = resolved;
        root.render(<TechnicalStoryPreview resolved={resolved}/>);
      } catch (error) { if (turn === generation) clear(); throw error; }
    },
    clear,
    dispose() { clear(); root.unmount(); mount.remove(); switcher.remove(); },
  };
}
