import React, { useEffect, useRef, useState } from 'react';
import { ActionGroup, Button, Field, Glyph, Section } from '../product-room/ui/components.jsx';
import { createStoryController, STORY_MAX_STEPS } from '../product-room/story.js';
import { STUDIO_MODEL, STUDIO_PARTS } from './seed.js';
import './story-editor.css';

const clone = value => JSON.parse(JSON.stringify(value));
const actions = STUDIO_MODEL?.tour?.chapters?.filter(step => step.duration >= 2 && step.duration <= 3) || [];

export function StoryEditor({ draft, change, viewer, onOpenModel, onRequestCapture }) {
  const story = draft.presentation.story;
  const [opened, setOpened] = useState(null), [busy, setBusy] = useState(''), [message, setMessage] = useState('');
  const controller = useRef(null), active = useRef(true), latest = useRef(draft), currentViewer = useRef(viewer);
  latest.current = draft; currentViewer.current = viewer;
  useEffect(() => { active.current = true; return () => { active.current = false; controller.current?.dispose(); }; }, []);
  const modify = update => change(next => update(next.presentation.story));
  function add() {
    const source = actions[0];
    const id = `step-${globalThis.crypto?.randomUUID?.() || Date.now()}`;
    change(next => {
      next.presentation.story ||= { version: 1, title: 'How this product works', steps: [] };
      next.presentation.story.steps.push({ id, title: source?.title || 'A closer look', caption: source?.caption || 'Explain the selected detail.',
        nodeId: source?.highlightIds?.[0] || STUDIO_MODEL.rootId,
        ...(source ? { kind: 'chapter', tourId: STUDIO_MODEL.tour.id, chapterId: source.id } : { kind: 'inspection' }) });
    });
    setOpened(id); setMessage('');
  }
  function update(id, fn) { modify(value => { const step = value.steps.find(item => item.id === id); if (step) fn(step); }); }
  async function run(label, task) {
    setBusy(label); setMessage('');
    try { await task(); }
    catch (error) { if (active.current) setMessage(error.message); }
    finally { if (active.current) setBusy(''); }
  }
  async function capture(step) {
    const viewer = currentViewer.current;
    if (!viewer) throw new Error('Open the product model and wait for it to load, then capture its view.');
    if (viewer.state?.tour?.active) throw new Error('Leave the guided tour and arrange a free exploration view before capturing.');
    await viewer.pause();
    await viewer.request('select', { nodeId: step.nodeId });
    const deadline = Date.now() + 1800;
    let view;
    for (;;) {
      try { view = await viewer.request('captureView'); break; }
      catch (error) { if (error.code !== 'BUSY_STATE' || Date.now() >= deadline) throw error; await new Promise(resolve => setTimeout(resolve, 80)); }
    }
    if (!active.current || latest.current.modelRevision !== view.model.revision) return;
    const currentStep = latest.current.presentation.story?.steps.find(item => item.id === step.id);
    if (!currentStep || currentStep.kind !== 'inspection' || currentStep.nodeId !== view.selectedId) throw new Error('This story step changed while the view was being captured. Arrange the selected part and try again.');
    update(step.id, value => { value.inspection = { version: '1', model: clone(view.model), view: clone(view) }; });
    setMessage('View captured. Preview this step before releasing the story.');
  }
  async function preview(step) {
    if (!viewer) throw new Error('Open the product model and wait for it to load.');
    controller.current?.dispose();
    controller.current = createStoryController({ viewer, model: STUDIO_MODEL, parts: STUDIO_PARTS,
      story: { version: 1, title: story.title || 'Product story', steps: [clone(step)] } });
    onOpenModel?.();
    await controller.current.select(0, { play: true });
    if (active.current) setMessage(`Previewing “${step.title}”. Use the Explorer controls to pause, replay or take over.`);
  }
  return <Section className="studio-separated studio-story" title="Product story"
    description="Arrange a short explanation using this model’s prepared actions and your saved views. Customers keep control of playback.">
    {!story && <><p className="studio-story-empty">Build a sequence from the existing model. Your published Room stays unchanged until you review and release it.</p><Button variant="secondary" onClick={add}>Add first step</Button></>}
    {story && <>
      {!viewer && <div className="studio-story-capture"><p>Open the model to prepare and preview your steps.</p><Button variant="secondary" onClick={onOpenModel}>Open model</Button></div>}
      <Field label="Story title" value={story.title} maxLength={100} onChange={event => modify(value => { value.title = event.target.value; })}/>
      <ol className="studio-story-list">
        {story.steps.map((step, index) => <li key={step.id} data-issue-path={`presentation.story.steps.${index}`}>
          <button type="button" className="studio-story-summary" aria-expanded={opened === step.id}
            aria-controls={`story-fields-${step.id}`} onClick={() => setOpened(opened === step.id ? null : step.id)}>
            <span className="studio-story-position">{index + 1}</span><span><strong>{step.title || 'Untitled step'}</strong><small>{step.kind === 'chapter' ? `${actions.find(item => item.id === step.chapterId)?.duration || '—'} second prepared action` : step.inspection ? 'Captured view' : 'View needed'}</small></span><Glyph name={opened === step.id ? 'close' : 'plus'}/>
          </button>
          {opened === step.id && <div id={`story-fields-${step.id}`} className="studio-story-fields">
            <Field label="Step title" value={step.title} maxLength={100} onChange={event => update(step.id, value => { value.title = event.target.value; })}/>
            <Field label="Short explanation" textarea value={step.caption} maxLength={320} onChange={event => update(step.id, value => { value.caption = event.target.value; })}/>
            <Field label="Part to discuss" value={step.nodeId} options={STUDIO_PARTS.filter(part => step.kind !== 'chapter' || (() => { const action = actions.find(item => item.id === step.chapterId); return [action?.selectedId, ...(action?.highlightIds || [])].includes(part.id); })()).map(part => [part.id, part.title])} onChange={event => update(step.id, value => { value.nodeId = event.target.value; if (value.kind === 'inspection') delete value.inspection; })}/>
            <Field label="Show" value={step.kind === 'chapter' ? `chapter:${step.chapterId}` : 'inspection'}
              options={[["inspection", "A captured view"], ...actions.map(item => [`chapter:${item.id}`, `${item.label || item.title} · ${item.duration} seconds`])]}
              onChange={event => update(step.id, value => {
                delete value.inspection; delete value.tourId; delete value.chapterId;
                value.kind = event.target.value === 'inspection' ? 'inspection' : 'chapter';
                if (value.kind === 'chapter') { value.tourId = STUDIO_MODEL.tour.id; value.chapterId = event.target.value.slice(8); const action = actions.find(item => item.id === value.chapterId); value.nodeId = action?.highlightIds?.[0] || action?.selectedId || STUDIO_MODEL.rootId; }
              })}/>
            {step.kind === 'inspection' ? <div className="studio-story-capture">
              <p>Arrange the model in free exploration, then save that exact view. Changing the part requires a new capture.</p>
              <ActionGroup align="start"><Button variant="secondary" onClick={() => {
                if (onRequestCapture) onRequestCapture(() => capture(step)); else onOpenModel?.();
                if (viewer) void run('focus', async () => {
                  await viewer.pause(); if (viewer.state?.tour?.active) await viewer.request('exitTour', { restore: false });
                  await viewer.request('focus', { nodeId: step.nodeId });
                });
              }}>Adjust view in 3D</Button><Button variant="secondary" disabled={(!viewer && !onRequestCapture) || Boolean(busy)} pending={busy === `capture-${step.id}`} onClick={() => onRequestCapture ? onRequestCapture(() => capture(step)) : run(`capture-${step.id}`, () => capture(step))}>{onRequestCapture ? (step.inspection ? 'Recapture in 3D' : 'Capture in 3D') : (step.inspection ? 'Recapture view' : 'Capture current view')}</Button></ActionGroup>
            </div> : <p className="studio-story-source">The prepared action owns its camera, motion and timing. “Part to discuss” records the subject without changing the source action.</p>}
            <ActionGroup align="start"><Button variant="secondary" disabled={!viewer || Boolean(busy) || (step.kind === 'inspection' && !step.inspection)} pending={busy === `preview-${step.id}`} pendingLabel="Opening…" onClick={() => run(`preview-${step.id}`, () => preview(step))}>Preview step</Button></ActionGroup>
            <div className="studio-story-order"><Button variant="quiet" disabled={index === 0 || Boolean(busy)} onClick={() => modify(value => { [value.steps[index - 1], value.steps[index]] = [value.steps[index], value.steps[index - 1]]; })}>Move earlier</Button><Button variant="quiet" disabled={index === story.steps.length - 1 || Boolean(busy)} onClick={() => modify(value => { [value.steps[index + 1], value.steps[index]] = [value.steps[index], value.steps[index + 1]]; })}>Move later</Button><Button variant="quiet" disabled={Boolean(busy)} onClick={() => modify(value => { value.steps = value.steps.filter(item => item.id !== step.id); })}>Remove step</Button></div>
          </div>}
        </li>)}
      </ol>
      <ActionGroup align="start"><Button variant="secondary" disabled={story.steps.length >= STORY_MAX_STEPS || Boolean(busy)} onClick={add}>Add step</Button><Button variant="quiet" disabled={Boolean(busy)} onClick={() => change(next => { delete next.presentation.story; })}>Remove story</Button></ActionGroup>
      <p className="studio-story-source">Save the draft, then use Preview to review the complete buyer experience before publishing.</p>
    </>}
    {message && <p role="status" className="studio-story-feedback">{message}</p>}
  </Section>;
}
