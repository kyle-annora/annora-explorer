import React, { useEffect, useRef, useState } from 'react';
import { ActionGroup, Button, Field, Glyph, Section } from '../product-room/ui/components.jsx';
import { createStoryController, validateProductStory, STORY_MAX_STEPS } from '../product-room/story.js';
import { STUDIO_MODEL, STUDIO_PARTS } from './seed.js';
import { technicalStoryReferenceKey, validateTechnicalStoryReference } from '../product-room/technical-story.js';
import { resolveTechnicalStoryPreview } from '../product-room/technical-story-source.js';
import { TechnicalStoryPreview } from './technical-story-preview.jsx';
import './story-editor.css';

const clone = value => JSON.parse(JSON.stringify(value));
const referenceKey = value => { try { return technicalStoryReferenceKey(value); } catch { return ''; } };

export function StoryEditor({ draft, change, viewer, onOpenModel, onRequestCapture, prepared }) {
  const story = draft.presentation.story;
  const model = prepared?.model || STUDIO_MODEL, parts = prepared?.parts || STUDIO_PARTS;
  const actions = prepared?.actions || model?.tour?.chapters?.filter(step => step.duration >= 2 && step.duration <= 3) || [];
  const references = (prepared?.technicalReferences || []).filter(item => item.available !== false);
  const [opened, setOpened] = useState(null), [busy, setBusy] = useState(''), [message, setMessage] = useState(''), [technicalPreview, setTechnicalPreview] = useState(null);
  const lease = useRef(null), previewGeneration = useRef(0);
  const controller = useRef(null), active = useRef(true), latest = useRef(draft), currentViewer = useRef(viewer);
  latest.current = draft; currentViewer.current = viewer;
  const clearPreview = () => { previewGeneration.current++; lease.current?.dispose?.(); lease.current = null; if (active.current) setTechnicalPreview(null); };
  useEffect(() => { active.current = true; return () => { active.current = false; previewGeneration.current++; controller.current?.dispose(); lease.current?.dispose?.(); }; }, []);
  const modify = update => { controller.current?.dispose(); controller.current = null; clearPreview(); change(next => update(next.presentation.story)); };
  function add() {
    const source = actions[0], technical = !source && references[0];
    const id = `step-${globalThis.crypto?.randomUUID?.() || Date.now()}`;
    change(next => {
      next.presentation.story ||= { version: 1, title: 'How this product works', steps: [] };
      next.presentation.story.steps.push({ id, title: source?.title || technical?.title || 'A closer look', caption: source?.caption || 'Explain the selected detail.',
        nodeId: source?.highlightIds?.[0] || source?.selectedId || technical?.nodeId || model.rootId,
        ...(source ? { kind: 'chapter', tourId: model.tour.id, chapterId: source.id } : technical ? { kind: 'technical', technical: clone(technical.technical) } : { kind: 'inspection' }) });
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
    if (!currentStep || !['inspection', 'technical'].includes(currentStep.kind) || currentStep.kind !== step.kind || currentStep.nodeId !== view.selectedId) throw new Error('This story step changed while the view was being captured. Arrange the selected part and try again.');
    update(step.id, value => { value.inspection = { version: '1', model: clone(view.model), view: clone(view) }; });
    setMessage('View captured. Preview this step before releasing the story.');
  }
  async function preview(step) {
    controller.current?.dispose(); clearPreview();
    if (step.kind === 'technical' && (!viewer || onRequestCapture)) {
      const issues = validateProductStory({ version: 1, title: story.title || 'Product story', steps: [step] }, { model, parts, technicalReferences: references });
      if (issues.length) throw new Error(issues[0].message);
      const reference = validateTechnicalStoryReference(step.technical, { model, nodeId: step.nodeId, technicalReferences: references });
      const generation = previewGeneration.current;
      const isCurrent = () => active.current && generation === previewGeneration.current;
      const resolved = await resolveTechnicalStoryPreview(reference, { isCurrent });
      if (!isCurrent()) { resolved.dispose?.(); return; }
      lease.current = resolved; setTechnicalPreview({ stepId: step.id, resolved });
      setMessage(`Previewing “${step.title}”. Open the model to inspect its linked part in 3D.`);
      return;
    }
    if (!viewer) throw new Error('Open the product model and wait for it to load.');
    controller.current = createStoryController({ viewer, model, parts, technicalReferences: references,
      showTechnicalReference: async (reference, options) => {
        const resolved = await resolveTechnicalStoryPreview(reference, options);
        if (!active.current || options.signal?.aborted || !options.isCurrent()) { resolved.dispose?.(); return; }
        lease.current?.dispose?.(); lease.current = resolved; setTechnicalPreview({ stepId: step.id, resolved });
      }, clearTechnicalReference: clearPreview,
      story: { version: 1, title: story.title || 'Product story', steps: [clone(step)] } });
    if (step.kind !== 'technical') onOpenModel?.();
    await controller.current.select(0, { play: true });
    if (active.current) setMessage(`Previewing “${step.title}”. Use the Explorer controls to pause, replay or take over.`);
  }
  return <Section className="studio-separated studio-story" title="Product story"
    description="Arrange a short explanation from the product’s prepared views, drawing details and available actions.">
    {!actions.length && <p className="studio-story-source">This product has no prepared movement. Use a saved 3D view{references.length ? ' or a linked drawing detail' : ''}.</p>}
    {!story && <><p className="studio-story-empty">Build a sequence from the existing model. Your published Room stays unchanged until you review and release it.</p><Button variant="secondary" onClick={add}>Add first step</Button></>}
    {story && <>
      {!viewer && <div className="studio-story-capture"><p>{references.length ? 'Drawing details can be previewed here. Open the model to arrange a 3D view.' : 'Open the model to prepare and preview your steps.'}</p><Button variant="secondary" onClick={onOpenModel}>Open model</Button></div>}
      <Field label="Story title" value={story.title} maxLength={100} onChange={event => modify(value => { value.title = event.target.value; })}/>
      <ol className="studio-story-list">
        {story.steps.map((step, index) => <li key={step.id} data-issue-path={`presentation.story.steps.${index}`}>
          <button type="button" className="studio-story-summary" aria-expanded={opened === step.id}
            aria-controls={`story-fields-${step.id}`} onClick={() => setOpened(opened === step.id ? null : step.id)}>
            <span className="studio-story-position">{index + 1}</span><span><strong>{step.title || 'Untitled step'}</strong><small>{step.kind === 'chapter' ? `${actions.find(item => item.id === step.chapterId)?.duration || '—'} second prepared action` : step.kind === 'technical' ? 'Linked drawing detail' : step.inspection ? 'Captured view' : 'View needed'}</small></span><Glyph name={opened === step.id ? 'close' : 'plus'}/>
          </button>
          {opened === step.id && <div id={`story-fields-${step.id}`} className="studio-story-fields">
            <Field label="Step title" value={step.title} maxLength={100} onChange={event => update(step.id, value => { value.title = event.target.value; })}/>
            <Field label="Short explanation" textarea value={step.caption} maxLength={320} onChange={event => update(step.id, value => { value.caption = event.target.value; })}/>
            {step.kind !== 'technical' && <Field label="Part to discuss" value={step.nodeId} options={parts.filter(part => step.kind !== 'chapter' || (() => { const action = actions.find(item => item.id === step.chapterId); return [action?.selectedId, ...(action?.highlightIds || [])].includes(part.id); })()).map(part => [part.id, part.title])} onChange={event => update(step.id, value => { value.nodeId = event.target.value; if (value.kind === 'inspection') delete value.inspection; })}/>}
            <Field label="Show" value={step.kind === 'chapter' ? `chapter:${step.chapterId}` : step.kind}
              options={[["inspection", "A captured view"], ...(references.length || step.kind === 'technical' ? [["technical", "A linked drawing detail"]] : []), ...actions.map(item => [`chapter:${item.id}`, `${item.label || item.title} · ${item.duration} seconds`])]}
              onChange={event => update(step.id, value => {
                delete value.inspection; delete value.tourId; delete value.chapterId; delete value.technical;
                value.kind = event.target.value === 'inspection' ? 'inspection' : event.target.value === 'technical' ? 'technical' : 'chapter';
                if (value.kind === 'chapter') { value.tourId = model.tour.id; value.chapterId = event.target.value.slice(8); const action = actions.find(item => item.id === value.chapterId); value.nodeId = action?.highlightIds?.[0] || action?.selectedId || model.rootId; }
                if (value.kind === 'technical' && references[0]) { value.technical = clone(references[0].technical); value.nodeId = references[0].nodeId; }
              })}/>
            {step.kind === 'technical' && <>
              <Field label="Drawing detail" value={references.find(item => referenceKey(item.technical) === referenceKey(step.technical))?.id || ''}
                options={[["", "Choose an available drawing detail"], ...references.map(item => [item.id, item.title])]}
                onChange={event => { const selected = references.find(item => item.id === event.target.value); if (selected) update(step.id, value => { value.technical = clone(selected.technical); value.nodeId = selected.nodeId; delete value.inspection; }); }}/>
              <p className="studio-story-source">{step.technical?.context?.drawing.regionLabel || 'Select a detail'} · {parts.find(part => part.id === step.nodeId)?.title || step.nodeId}<br/>{step.technical?.context?.drawing.revisionLabel || step.technical?.context?.drawing.revision}<br/>The source file, page and confirmed association stay with this step.</p>
              <ActionGroup align="start"><Button variant="secondary" disabled={!viewer || Boolean(busy)} onClick={() => { onOpenModel?.(); void run('focus', () => viewer.request('focus', { nodeId: step.nodeId })); }}>Show part in 3D</Button>
                <Button variant="quiet" disabled={(!viewer && !onRequestCapture) || Boolean(busy)} onClick={() => onRequestCapture ? onRequestCapture(() => capture(step)) : run(`capture-${step.id}`, () => capture(step))}>{step.inspection ? 'Update paired 3D view' : 'Pair current 3D view'}</Button>
                {step.inspection && <Button variant="quiet" onClick={() => update(step.id, value => { delete value.inspection; })}>Use automatic part view</Button>}</ActionGroup>
            </>}
            {step.kind === 'inspection' ? <div className="studio-story-capture">
              <p>Arrange the model in free exploration, then save that exact view. Changing the part requires a new capture.</p>
              <ActionGroup align="start"><Button variant="secondary" onClick={() => {
                if (onRequestCapture) onRequestCapture(() => capture(step)); else onOpenModel?.();
                if (viewer) void run('focus', async () => {
                  await viewer.pause(); if (viewer.state?.tour?.active) await viewer.request('exitTour', { restore: false });
                  await viewer.request('focus', { nodeId: step.nodeId });
                });
              }}>Adjust view in 3D</Button><Button variant="secondary" disabled={(!viewer && !onRequestCapture) || Boolean(busy)} pending={busy === `capture-${step.id}`} onClick={() => onRequestCapture ? onRequestCapture(() => capture(step)) : run(`capture-${step.id}`, () => capture(step))}>{onRequestCapture ? (step.inspection ? 'Recapture in 3D' : 'Capture in 3D') : (step.inspection ? 'Recapture view' : 'Capture current view')}</Button></ActionGroup>
            </div> : step.kind === 'chapter' ? <p className="studio-story-source">The prepared action owns its camera, motion and timing. “Part to discuss” records the subject without changing the source action.</p> : null}
            <ActionGroup align="start"><Button variant="secondary" disabled={(!viewer && step.kind !== 'technical') || Boolean(busy) || (step.kind === 'inspection' && !step.inspection)} pending={busy === `preview-${step.id}`} pendingLabel="Opening…" onClick={() => run(`preview-${step.id}`, () => preview(step))}>Preview step</Button></ActionGroup>
            {technicalPreview?.stepId === step.id && <TechnicalStoryPreview resolved={technicalPreview.resolved} />}
            <div className="studio-story-order"><Button variant="quiet" disabled={index === 0 || Boolean(busy)} onClick={() => modify(value => { [value.steps[index - 1], value.steps[index]] = [value.steps[index], value.steps[index - 1]]; })}>Move earlier</Button><Button variant="quiet" disabled={index === story.steps.length - 1 || Boolean(busy)} onClick={() => modify(value => { [value.steps[index + 1], value.steps[index]] = [value.steps[index], value.steps[index + 1]]; })}>Move later</Button><Button variant="quiet" disabled={Boolean(busy)} onClick={() => modify(value => { value.steps = value.steps.filter(item => item.id !== step.id); })}>Remove step</Button></div>
          </div>}
        </li>)}
      </ol>
      <ActionGroup align="start"><Button variant="secondary" disabled={story.steps.length >= STORY_MAX_STEPS || Boolean(busy)} onClick={add}>Add step</Button><Button variant="quiet" disabled={Boolean(busy)} onClick={() => { controller.current?.dispose(); controller.current = null; clearPreview(); change(next => { delete next.presentation.story; }); }}>Remove story</Button></ActionGroup>
      <p className="studio-story-source">Save the draft, then use Preview to review the complete buyer experience before publishing.</p>
    </>}
    {message && <p role="status" className="studio-story-feedback">{message}</p>}
  </Section>;
}
