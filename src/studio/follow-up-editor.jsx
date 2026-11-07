import React, { useEffect, useId, useState } from 'react';
import { ActionGroup, Button, Field, Glyph, Notice, Section } from '../product-room/ui/components.jsx';
import { requestItemPurposeLabel, requestItemTitle } from '../product-room/request-items.js';
import { RequestItemsSummary } from '../product-room/request-items-view.jsx';
import { STORY_MAX_STEPS } from '../product-room/story.js';
import './follow-up-editor.css';

const sourceLabel = source => source === 'released-story' ? 'Released product story' : 'Saved customer view';
const actionKey = action => !action ? '' : action.kind === 'quotation' ? `quotation:${action.quoteId}` : `clarification:${action.messageId}`;
const actionLabel = action => action?.kind === 'quotation' ? `Review quotation v${action.quoteVersion}`
  : action?.kind === 'clarification' ? 'Reply to the clarification' : 'Choose a next step';
const pending = (busy, action) => busy === action;

function FieldError({ id, children }) {
  return children ? <p id={id} className="studio-follow-up-error" role="alert">{children}</p> : null;
}

function SourceReference({ context }) {
  if (!context) return null;
  return <p className="studio-follow-up-source">{context.productTitle}
    {context.roomSnapshot?.version && <> · Product version {context.roomSnapshot.version}</>}
    {' · '}<span title={`Model revision: ${context.modelRevision}`}>Original model version</span>
  </p>;
}

/** The workspace owns the draft, persistence and navigation guards. No local copy can overwrite a failed save. */
export function FollowUpEditor({ project, draft, catalog = [], targets = [], errors = {}, error = '', busy = '', status = '',
  onChange, onSave, onReview, onPreview, onCancel }) {
  const prefix = useId();
  const [choice, setChoice] = useState(''), [expanded, setExpanded] = useState(null);
  useEffect(() => { setChoice(''); setExpanded(null); }, [draft?.id]);
  if (!draft) return null;
  const locked = Boolean(busy), steps = draft.stepIds || [], agenda = project?.inquiry?.requestItems || [];
  const selectedAgenda = draft.requestItemIds || [];
  const remaining = catalog.filter(entry => !steps.includes(entry.id));
  const selectedSource = remaining.find(entry => entry.id === choice);
  const availableTarget = targets.find(target => target.id === actionKey(draft.nextAction)
    && (draft.nextAction?.kind !== 'quotation' || target.action.quoteVersion === draft.nextAction.quoteVersion));
  const missingAgenda = selectedAgenda.filter(id => !agenda.some(item => item.id === id));
  const update = values => onChange({ ...draft, ...values });
  function addStep() {
    if (!selectedSource?.available || locked || steps.length >= STORY_MAX_STEPS) return;
    update({ stepIds: [...steps, selectedSource.id] }); setExpanded(selectedSource.id); setChoice('');
  }
  function move(index, offset) {
    const next = [...steps], destination = index + offset;
    if (locked || destination < 0 || destination >= next.length) return;
    [next[index], next[destination]] = [next[destination], next[index]];
    update({ stepIds: next });
  }
  function toggleAgenda(id, checked) {
    update({ requestItemIds: checked ? [...selectedAgenda, id] : selectedAgenda.filter(value => value !== id) });
  }
  return <form className="studio-follow-up studio-follow-up-editor" onSubmit={event => { event.preventDefault(); if (!locked) onReview(); }} aria-label="Prepare a project follow-up">
    <header className="studio-follow-up-heading"><div><h2>Prepare a follow-up</h2>
      <p>Guide this customer through the relevant details, then give them one clear next step.</p></div>
      <SourceReference context={draft.context} />
    </header>
    {error && <Notice kind="error" title="Follow-up needs attention" tabIndex={-1} data-follow-up-error>{error}</Notice>}
    <Section title="Opening" description="A short introduction for this customer.">
      <Field label="Follow-up title" name="follow-up-title" value={draft.title} maxLength={100} error={errors.title}
        disabled={locked} onChange={event => update({ title: event.target.value })} />
      <Field label="Introduction" name="follow-up-introduction" textarea rows={3} optional value={draft.introduction} maxLength={1200}
        error={errors.introduction} disabled={locked} onChange={event => update({ introduction: event.target.value })} />
    </Section>
    <Section title="What to show" description="Choose prepared actions or saved views. The customer can pause or explore at any point.">
      <div className="studio-follow-up-list-heading"><span>{steps.length} of {STORY_MAX_STEPS} steps</span><span>Playback order</span></div>
      {steps.length ? <ol className="studio-follow-up-steps" aria-label="Follow-up playback order" aria-describedby={errors.stepIds ? `${prefix}-steps-error` : undefined}>
        {steps.map((id, index) => {
          const entry = catalog.find(item => item.id === id), open = expanded === id, panelId = `${prefix}-step-${index}`;
          return <li key={id} data-source-id={id}>
            <button className="studio-follow-up-step-toggle" type="button" disabled={locked} aria-expanded={open} aria-controls={panelId}
              onClick={() => setExpanded(open ? null : id)}>
              <span className="studio-follow-up-position">{String(index + 1).padStart(2, '0')}</span>
              <span><strong>{entry?.title || 'Unavailable saved step'}</strong><small>{entry ? sourceLabel(entry.source) : 'The original source could not be found'}{entry && !entry.available ? ' · Needs attention' : ''}</small></span>
              <Glyph name={open ? 'close' : 'plus'} />
            </button>
            {open && <div className="studio-follow-up-step-body" id={panelId}>
              {entry?.step?.caption && <p>{entry.step.caption}</p>}
              {!entry?.available && <p className="studio-follow-up-error">{entry?.reason || 'Remove this step or choose another saved source.'}</p>}
              <ActionGroup align="start">
                <Button variant="quiet" disabled={locked || index === 0} onClick={() => move(index, -1)} aria-label={`Move ${entry?.title || 'step'} earlier`}>Move earlier</Button>
                <Button variant="quiet" disabled={locked || index === steps.length - 1} onClick={() => move(index, 1)} aria-label={`Move ${entry?.title || 'step'} later`}>Move later</Button>
                <Button variant="quiet" disabled={locked} onClick={() => { update({ stepIds: steps.filter(value => value !== id) }); setExpanded(null); }}>Remove step</Button>
              </ActionGroup>
            </div>}
          </li>;
        })}
      </ol> : <p className="studio-follow-up-empty">No steps selected yet. Add only the views that help answer this customer’s request.</p>}
      <FieldError id={`${prefix}-steps-error`}>{errors.stepIds}</FieldError>
      {catalog.length > 0 ? <div className="studio-follow-up-add">
        <Field label="Add a prepared step" hint={selectedSource && !selectedSource.available ? selectedSource.reason : undefined}>
          <select value={remaining.some(entry => entry.id === choice) ? choice : ''} disabled={locked || steps.length >= STORY_MAX_STEPS || !remaining.length}
            onChange={event => setChoice(event.target.value)}>
            <option value="">{steps.length >= STORY_MAX_STEPS ? 'Step limit reached' : remaining.length ? 'Choose a step or saved view' : 'All available sources added'}</option>
            {['released-story', 'saved-inspection'].map(source => {
              const entries = remaining.filter(entry => entry.source === source);
              return entries.length > 0 && <optgroup key={source} label={source === 'released-story' ? 'Released product story' : 'Saved customer views'}>
                {entries.map(entry => <option key={entry.id} value={entry.id} disabled={!entry.available}>{entry.title}{!entry.available ? ' — unavailable' : ''}</option>)}
              </optgroup>;
            })}
          </select>
        </Field>
        <Button variant="secondary" icon="plus" disabled={locked || !selectedSource?.available || steps.length >= STORY_MAX_STEPS} onClick={addStep}>Add step</Button>
      </div> : <Notice title="No prepared views in this project">This inquiry’s saved product version has no released story or compatible saved view. Its source version stays unchanged.</Notice>}
      {catalog.length > 0 && !catalog.some(entry => entry.available) && <p className="studio-follow-up-source">The saved sources are unavailable for this model version. A follow-up cannot be reviewed until a compatible source is available.</p>}
    </Section>
    <Section title="Customer requests" description={agenda.length ? 'Choose the original requests this follow-up addresses.' : 'This inquiry has no separate referenced requests.'}>
      {agenda.length > 0 && <div className="studio-follow-up-agenda" role="group" aria-label="Requests included in this follow-up" aria-describedby={errors.requestItemIds ? `${prefix}-agenda-error` : undefined}>
        {agenda.map(item => <label key={item.id} className="studio-follow-up-request">
          <input type="checkbox" checked={selectedAgenda.includes(item.id)} disabled={locked} onChange={event => toggleAgenda(item.id, event.target.checked)} />
          <span><strong>{requestItemTitle(item)}</strong><small>{requestItemPurposeLabel(item.purpose)}</small><span className="studio-follow-up-request-note">{item.notes}</span></span>
        </label>)}
      </div>}
      {missingAgenda.map(id => <div className="studio-follow-up-missing" key={id}><p>A selected request is no longer available in this project.</p>
        <Button variant="quiet" disabled={locked} onClick={() => toggleAgenda(id, false)}>Remove unavailable request</Button></div>)}
      <FieldError id={`${prefix}-agenda-error`}>{errors.requestItemIds}</FieldError>
    </Section>
    <Section title="One next step" description="End at an existing quotation or an open clarification in this project.">
      <Field label="After the follow-up" error={errors.nextAction}>
        <select value={draft.nextAction ? availableTarget?.id || '__unavailable' : ''} disabled={locked}
          onChange={event => update({ nextAction: targets.find(target => target.id === event.target.value)?.action || null })}>
          <option value="">Choose the customer’s next step</option>
          {draft.nextAction && !availableTarget && <option value="__unavailable" disabled>{actionLabel(draft.nextAction)} — unavailable</option>}
          {targets.map(target => <option key={target.id} value={target.id} disabled={!target.available}>{target.label}{!target.available ? ' — unavailable' : ''}</option>)}
        </select>
      </Field>
      {availableTarget?.reason && <p className="studio-follow-up-source">{availableTarget.reason}</p>}
      {!targets.some(target => target.available) && <p className="studio-follow-up-source">Issue a quotation or prepare a clarification in this project first. You can still save this follow-up as a draft.</p>}
      {draft.nextAction?.kind === 'quotation' && <p className="studio-follow-up-source">This follow-up keeps quotation v{draft.nextAction.quoteVersion}, even when a later quotation is issued.</p>}
    </Section>
    <footer className="studio-follow-up-footer">
      <p className="studio-follow-up-status" role="status">{status || 'Demo only. Drafts and confirmed follow-ups stay in this browser.'}</p>
      <ActionGroup align="between">
        <Button variant="quiet" disabled={locked} onClick={onCancel}>Cancel</Button>
        <ActionGroup>
          <Button variant="secondary" disabled={locked} pending={pending(busy, 'save')} onClick={onSave}>Save draft</Button>
          {onPreview && <Button variant="secondary" disabled={locked || !steps.length || steps.some(id => !catalog.find(entry => entry.id === id)?.available)} pending={pending(busy, 'preview')} pendingLabel="Opening…" onClick={onPreview}>Preview</Button>}
          <Button type="submit" disabled={locked} pending={pending(busy, 'review')} pendingLabel="Reviewing…" icon="arrow">Review follow-up</Button>
        </ActionGroup>
      </ActionGroup>
    </footer>
  </form>;
}

/** This renders the sealed review snapshot. The parent confirms only this exact packet. */
export function FollowUpReview({ review, targets = [], busy = '', error = '', confirmed = false, canConfirm = true,
  onConfirmedChange, onEdit, onPreview, onConfirm }) {
  const snapshot = review?.snapshot;
  if (!snapshot) return null;
  const locked = Boolean(busy), action = snapshot.nextAction;
  const exactTarget = targets.find(target => target.id === actionKey(action)
    && (action?.kind !== 'quotation' || target.action.quoteVersion === action.quoteVersion));
  return <section className="studio-follow-up studio-follow-up-review" aria-label="Review project follow-up">
    <header className="studio-follow-up-heading"><div><h2>Review the follow-up</h2><p>Confirm what this customer will see before making it available in their project.</p></div>
      <SourceReference context={snapshot.context} />
    </header>
    {error && <Notice kind="error" title="Follow-up not confirmed" tabIndex={-1} data-follow-up-error>{error}</Notice>}
    <Section title={snapshot.title} className="studio-follow-up-review-opening">
      {snapshot.introduction && <p className="studio-follow-up-introduction">{snapshot.introduction}</p>}
      <ol className="studio-follow-up-review-steps" aria-label="Customer playback order">
        {snapshot.story.steps.map((step, index) => <li key={step.id}>
          <span className="studio-follow-up-position">{String(index + 1).padStart(2, '0')}</span>
          <div><strong>{step.title}</strong><small>{sourceLabel(snapshot.sources[index]?.source)}</small>{step.caption && <p>{step.caption}</p>}</div>
        </li>)}
      </ol>
      {onPreview && <ActionGroup align="start"><Button variant="secondary" disabled={locked} pending={pending(busy, 'preview')} pendingLabel="Opening…" onClick={onPreview}>Preview customer sequence</Button></ActionGroup>}
    </Section>
    <Section title="Customer requests">
      {snapshot.agenda.length ? <RequestItemsSummary items={snapshot.agenda} title="Included requests" />
        : <p className="studio-follow-up-source">No separate referenced requests were part of this inquiry.</p>}
    </Section>
    <Section title="Customer’s next step">
      <p className="studio-follow-up-next"><Glyph name={action?.kind === 'quotation' ? 'document' : 'arrow'} />{exactTarget?.label || actionLabel(action)}</p>
      <p className="studio-follow-up-source">{action?.kind === 'quotation'
        ? `This opens quotation v${action.quoteVersion}. A future quotation does not replace this reference.`
        : 'This opens the original clarification. A resolved clarification remains available as history.'}</p>
    </Section>
    <footer className="studio-follow-up-footer">
      <label className="studio-follow-up-confirm"><input type="checkbox" checked={confirmed} disabled={locked || !canConfirm} onChange={event => onConfirmedChange(event.target.checked)} />
        <span>I have reviewed the sequence, customer requests and next step.</span></label>
      <p className="studio-follow-up-source">Confirming saves a fixed follow-up version in this browser. Nothing is emailed or sent to the customer.</p>
      <ActionGroup align="between"><Button variant="secondary" disabled={locked} onClick={onEdit}>Back to editing</Button>
        <Button disabled={locked || !confirmed || !canConfirm} pending={pending(busy, 'confirm')} pendingLabel="Confirming…" onClick={onConfirm} icon="check">Confirm follow-up</Button></ActionGroup>
    </footer>
  </section>;
}
