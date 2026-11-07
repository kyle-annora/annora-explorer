import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ActionGroup, Button, Field, Glyph, Notice, Status } from './ui/components.jsx';
import { requestItemTitle } from './request-items.js';
import { quoteScopeReferenceFacts } from './quote-scope-presentation.js';
import { SCOPE_DISPOSITIONS } from './option-scope-domain.js';
import { questionState, reviewQuestion, reviewQuestionReply, reviewQuestionResolution, reviewQuestionReopen } from './question-domain.js';
import { projectQuestionSourceKey, projectQuestionSummary, questionActionLabels, questionQuoteLinks, questionTimeline } from './project-questions-model.js';
import './project-questions.css';
import { workingImpactReference } from './impact-domain.js';
import { DrawingReference } from './drawing-reference.jsx';
import './impact-scope-summary.css';

const date = value => value && !Number.isNaN(new Date(value).getTime()) ? new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value)) : '';
const eventLabels = { opened: 'Question opened', answer: 'Answer', clarification: 'Clarification requested', 'buyer-reply': 'Reply', resolved: 'Marked resolved', reopened: 'Reopened' };
const statusLabel = state => state.status === 'resolved' ? 'Resolved' : state.status === 'answered' ? 'Answered' : 'Open';
const ownerLabel = state => state.status === 'resolved' ? 'Resolution confirmed' : state.status === 'answered' ? 'Ready to review resolution' : state.ownerRole === 'buyer' ? 'Waiting for customer' : 'Waiting for seller';

function QuestionReference({ item, onExplore, disabled }) {
  if (!item?.context) return <Notice kind="error">The original reference is unavailable.</Notice>;
  const preview = item.context.inspection?.preview;
  return <div className="ar-question-reference">
    <div className="ar-question-reference-heading"><div><span>Original inquiry detail</span><strong>{requestItemTitle(item)}</strong></div>
      {onExplore && <Button variant="quiet" icon="external" disabled={disabled} onClick={() => onExplore(item.context, item)}>View referenced detail</Button>}</div>
    <details><summary>Exact reference</summary>
      {preview && <img src={preview.dataUrl} width={preview.width} height={preview.height} alt={`Saved view of ${requestItemTitle(item)}`} />}
      <dl>{quoteScopeReferenceFacts(item.context).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
        <div><dt>Original request</dt><dd>{item.id}</dd></div></dl>
      {item.notes && <p className="ar-question-original"><strong>Original request</strong>{item.notes}</p>}
    </details>
  </div>;
}

function QuestionScope({ project, question }) {
  const links = questionQuoteLinks(project, question);
  const resolved = questionState(question).status === 'resolved';
  return <section className="ar-question-scope" aria-label="Related quotation scope">
    <h4>Quotation scope</h4>
    <p>{question.blocking ? resolved ? 'Resolution confirmed. This question does not hold a new quotation.' : 'This question must be explicitly resolved before a new quotation can be issued.' : 'This question is for discussion and does not hold a new quotation.'}</p>
    {links.length ? <ul>{links.map(link => <li key={link.quoteId}><strong>Quotation v{link.quoteVersion}</strong>
      <span>{SCOPE_DISPOSITIONS.find(item => item.value === link.disposition)?.label || 'Question reviewed'} · {statusLabel({ status: link.questionStatus })}</span>
      {link.lines.length > 0 && <small>{link.lines.map(line => line.label).join(' · ')}</small>}
      {link.rationale && <p>{link.rationale}</p>}</li>)}</ul>
      : <p className="ar-question-help">Linked to the original detail’s scope. No issued quotation includes this question’s review yet.</p>}
    {links.length > 0 && <p className="ar-question-help">Each issued quotation keeps its reviewed scope. Later replies and resolutions do not change that version.</p>}
  </section>;
}

/** The host persists confirmed review packets; local edits never change project records. */
export function ProjectQuestions({ project, role = 'buyer', onConfirmQuestion, onConfirmReply, onConfirmResolution, onConfirmReopen,
  onExplore, onDirtyChange, onBusyChange, onStageChange, initialQuestionId = null, onQuestionChange, disabled = false }) {
  const questions = project?.questions || [], requestItems = project?.inquiry?.requestItems || [];
  const [expanded, setExpanded] = useState(initialQuestionId), [composer, setComposer] = useState(null), [review, setReview] = useState(null);
  const [error, setError] = useState(null), [busy, setBusy] = useState(false), [receipt, setReceipt] = useState('');
  const root = useRef(null), editorHeading = useRef(null), heading = useRef(null), saving = useRef(false), prefix = useId();
  const source = useMemo(() => projectQuestionSourceKey(project), [project]), sourceRef = useRef(source), projectId = useRef(project?.id);
  const dirty = Boolean(composer), stage = composer ? review ? 'review' : 'edit' : 'list';
  const callbacks = useRef({ onDirtyChange, onBusyChange }); callbacks.current = { onDirtyChange, onBusyChange };
  useLayoutEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useLayoutEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);
  useLayoutEffect(() => { onStageChange?.(stage); }, [stage, onStageChange]);
  useEffect(() => { if (!composer) setExpanded(initialQuestionId); }, [initialQuestionId]);
  useEffect(() => () => { callbacks.current.onDirtyChange?.(false); callbacks.current.onBusyChange?.(false); }, []);
  useEffect(() => {
    if (!dirty) return;
    const prevent = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', prevent);
    return () => window.removeEventListener('beforeunload', prevent);
  }, [dirty]);
  useEffect(() => {
    if (sourceRef.current === source) return;
    sourceRef.current = source;
    const switchedProject = projectId.current !== project?.id;
    projectId.current = project?.id;
    if (switchedProject) {
      setExpanded(null); setComposer(null); setReview(null); setError(null); setReceipt('');
    } else if (composer && !saving.current) {
      setReview(null);
      setError({ message: 'This project changed. Your text is still here; review the latest details before confirming.' });
    }
  }, [source]);
  if (!project || (!requestItems.length && !questions.length)) return null;
  const summary = projectQuestionSummary(questions), locked = disabled || busy;
  const focusEditor = () => requestAnimationFrame(() => editorHeading.current?.focus());
  const focusHeading = () => requestAnimationFrame(() => heading.current?.focus());
  const focusError = () => requestAnimationFrame(() => root.current?.querySelector('[data-question-error]')?.focus());
  const selectQuestion = id => { setExpanded(id); onQuestionChange?.(id); };
  function start(type, question = null) {
    if (locked || composer) return;
    setComposer({ type, questionId: question?.id || null, input: { requestItemId: requestItems[0]?.id || '', body: '', blocking: true, kind: role === 'seller' ? 'answer' : 'buyer-reply' } });
    if (question) selectQuestion(question.id);
    setError(null); setReview(null); setReceipt(''); focusEditor();
  }
  function update(values) { setComposer(current => ({ ...current, input: { ...current.input, ...values } })); setReview(null); setError(null); }
  function cancel() { if (busy) return; setComposer(null); setReview(null); setError(null); focusHeading(); }
  function prepare(event) {
    event.preventDefault();
    if (locked || !composer) return;
    try {
      const input = { ...composer.input, questionId: composer.questionId, authorRole: role };
      const packet = composer.type === 'new' ? reviewQuestion(project, input) : composer.type === 'resolve' ? reviewQuestionResolution(project, input)
        : composer.type === 'reopen' ? reviewQuestionReopen(project, input) : reviewQuestionReply(project, input);
      setReview({ packet, source }); setError(null); focusEditor();
    } catch (nextError) { setError(nextError); focusError(); }
  }
  async function confirm() {
    if (!review || !composer || locked || saving.current) return;
    if (review.source !== source) { setReview(null); setError({ message: 'This project changed. Your text is still here; review it again before confirming.' }); focusError(); return; }
    const callback = { new: onConfirmQuestion, reply: onConfirmReply, resolve: onConfirmResolution, reopen: onConfirmReopen }[composer.type];
    if (!callback) return;
    saving.current = true; setBusy(true); setError(null);
    try {
      const updated = await callback(review.packet);
      if (composer.type === 'new' && updated?.questions?.length) selectQuestion(updated.questions.at(-1).id);
      setReceipt(questionActionLabels(composer.type, role, composer.input.kind).saved);
      setComposer(null); setReview(null); focusHeading();
    } catch (nextError) { setError(nextError); focusError(); }
    finally { saving.current = false; setBusy(false); }
  }
  function editor() {
    if (!composer) return null;
    const question = questions.find(item => item.id === composer.questionId);
    const item = composer.type === 'new' ? requestItems.find(item => item.id === composer.input.requestItemId) : question?.requestItem;
    const labels = questionActionLabels(composer.type, role, composer.input.kind), input = composer.input;
    const callback = { new: onConfirmQuestion, reply: onConfirmReply, resolve: onConfirmResolution, reopen: onConfirmReopen }[composer.type];
    const messageLabel = composer.type === 'new' ? 'Your question' : composer.type === 'resolve' ? 'Resolution note' : composer.type === 'reopen' ? 'What still needs an answer?' : input.kind === 'clarification' ? 'What detail do you need?' : 'Your reply';
    const result = composer.type === 'new' ? input.blocking ? 'Open · Needs answer before quote' : 'Open · For discussion'
      : composer.type === 'resolve' ? 'Resolved · This question no longer holds the quotation'
      : composer.type === 'reopen' ? 'Open · Seller to review again'
      : input.kind === 'answer' ? 'Answered · Resolution still needs confirmation'
      : input.kind === 'clarification' ? 'Open · Waiting for customer' : 'Open · Waiting for seller';
    return <div className="ar-question-editor" data-question-editor={composer.type}>
      <h3 ref={editorHeading} tabIndex={-1}>{review ? labels.review : labels.edit}</h3>
      {review ? <>
        <p className="ar-question-help">Review the detail, message and resulting status before confirming.</p>
        <QuestionReference item={item} />
        {question && <div className="ar-question-review-original"><strong>Question being addressed</strong><p>{question.body}</p></div>}
        <div className="ar-question-review-message"><strong>{messageLabel}</strong><p>{input.body.trim()}</p></div>
        <p className="ar-question-review-result"><span>After confirmation</span><strong>{result}</strong></p>
        <p className="ar-question-help">Saved in this browser’s demo project. Original requests and issued quotations keep their history.</p>
        <ActionGroup><Button variant="quiet" disabled={locked} onClick={cancel}>Cancel</Button>
          <Button variant="secondary" disabled={locked} onClick={() => { setReview(null); setError(null); focusEditor(); }}>Edit {composer.type === 'new' ? 'question' : composer.type === 'reply' ? 'reply' : 'note'}</Button>
          <Button pending={busy} pendingLabel="Confirming…" disabled={disabled || !callback} onClick={confirm} icon="check">{labels.confirm}</Button></ActionGroup>
      </> : <form onSubmit={prepare}>
        {composer.type === 'new' ? <>
          <Field label="Original inquiry detail" value={input.requestItemId} disabled={locked} options={requestItems.map(item => [item.id, requestItemTitle(item)])}
            error={error?.fields?.requestItemId} onChange={event => update({ requestItemId: event.target.value })} />
          <p className="ar-question-help">Keep each question with one of the exact views saved in your inquiry.</p>
        </> : <>
          {composer.type === 'reply' && role === 'seller' && <Field label="Reply type" value={input.kind} disabled={locked} options={[[ 'answer', 'Answer this question' ], [ 'clarification', 'Request customer clarification' ]]}
            onChange={event => update({ kind: event.target.value })} />}
          {composer.type === 'resolve' && <p className="ar-question-help">Confirm that the answer addresses this question. Answered questions remain open for quoting until this separate confirmation.</p>}
          {composer.type === 'reopen' && <p className="ar-question-help">Explain what remains unclear. Previous replies and the resolution stay in this thread.</p>}
        </>}
        <Field label={messageLabel} textarea rows={3} maxLength={4000} value={input.body} required disabled={locked} error={error?.fields?.body}
          onChange={event => update({ body: event.target.value })} />
        {composer.type === 'new' && <label className="ar-question-blocking"><input type="checkbox" checked={input.blocking} disabled={locked} onChange={event => update({ blocking: event.target.checked })} />
          <span><strong>Needs answer before quote</strong><small>The answer must be reviewed and explicitly marked resolved before a new quotation is issued.</small></span></label>}
        <ActionGroup><Button variant="quiet" disabled={locked} onClick={cancel}>Cancel</Button><Button type="submit" disabled={locked || !callback} icon="arrow">{labels.review}</Button></ActionGroup>
      </form>}
    </div>;
  }
  return <section ref={root} className="ar-project-questions" aria-labelledby={`${prefix}-heading`} data-question-stage={stage}>
    <header className="ar-project-questions-heading"><div><h2 id={`${prefix}-heading`} ref={heading} tabIndex={-1}>Project questions</h2>
      <p>{summary.total ? `${summary.total} ${summary.total === 1 ? 'question' : 'questions'} · ${summary.unresolved} unresolved${summary.blocking ? ` · ${summary.blocking} before quote` : ''}` : 'Keep questions, replies and resolution with each original detail.'}</p></div>
      {role === 'buyer' && requestItems.length > 0 && <Button variant="secondary" disabled={locked || dirty || !onConfirmQuestion} icon="plus" onClick={() => start('new')}>Ask a question</Button>}
    </header>
    {error && <Notice kind="error" title="Question needs attention" tabIndex={-1} data-question-error>{error.message || 'The change could not be saved. Your text is still here; please try again.'}</Notice>}
    {receipt && <p className="ar-question-receipt" role="status"><Glyph name="check" />{receipt}</p>}
    {composer?.type === 'new' && editor()}
    {questions.length ? <ol className="ar-question-list">{questions.map((question, index) => {
      const state = questionState(question), open = expanded === question.id, bodyId = `${prefix}-question-${index}`;
      const events = questionTimeline(question), replies = events.filter(event => ['answer', 'clarification', 'buyer-reply'].includes(event.kind)).length;
      const hasEditor = composer?.questionId === question.id, actionsDisabled = locked || dirty;
      const workingReference = workingImpactReference(project, 'question', question.id);
      return <li key={question.id} data-project-question={question.id} data-state={state.status}>
        <button type="button" className="ar-question-toggle" aria-expanded={open} aria-controls={bodyId} disabled={locked || dirty} onClick={() => selectQuestion(open ? null : question.id)}>
          <span className="ar-question-number">{String(index + 1).padStart(2, '0')}</span>
          <span className="ar-question-row-copy"><strong>{requestItemTitle(question.requestItem || { context: question.context })}</strong><span>{question.body}</span>
            <small>{replies} {replies === 1 ? 'reply' : 'replies'} · {ownerLabel(state)}{question.blocking && state.status !== 'resolved' ? ' · Needs answer before quote' : ''}</small></span>
          <Status tone={state.status === 'resolved' ? 'complete' : state.status === 'answered' ? 'neutral' : question.blocking ? 'warning' : 'neutral'}>{statusLabel(state)}</Status>
          <Glyph name={open ? 'close' : 'plus'} />
        </button>
        {open && <div className="ar-question-body" id={bodyId}>
          <QuestionReference item={question.requestItem} onExplore={onExplore} disabled={actionsDisabled} />
          {workingReference && <div className="ar-question-working-reference">
            <strong>Reference for ongoing work</strong>
            <p>{workingReference.reason} Original question history below remains on its saved reference.</p>
            {workingReference.context ? <DrawingReference context={workingReference.context} label={workingReference.decision === 'retained' ? 'Earlier reference retained after review' : 'Seller-confirmed working reference'} compact />
              : <p>This question is excluded from the new quotation scope; its original history is preserved.</p>}
          </div>}
          <ol className="ar-question-thread" aria-label="Question history">{events.map(event => <li key={event.id} data-event-kind={event.kind}>
            <div><strong>{event.authorRole === 'seller' ? 'Seller' : 'Customer'} <span>· {eventLabels[event.kind] || 'Reply'}</span></strong><time dateTime={event.createdAt}>{date(event.createdAt)}</time></div>
            <p>{event.body}</p></li>)}</ol>
          <QuestionScope project={project} question={question} />
          {hasEditor ? editor() : <ActionGroup align="start" className="ar-question-thread-actions">
            {state.status !== 'resolved' && (role === 'seller' || state.ownerRole === 'buyer') && <Button variant="secondary" disabled={actionsDisabled || !onConfirmReply} onClick={() => start('reply', question)}>Reply to question</Button>}
            {state.status === 'answered' && <Button variant="secondary" disabled={actionsDisabled || !onConfirmResolution} onClick={() => start('resolve', question)} icon="check">{role === 'buyer' ? 'Confirm answer resolves this' : 'Mark resolved'}</Button>}
            {state.status === 'resolved' && <Button variant="secondary" disabled={actionsDisabled || !onConfirmReopen} onClick={() => start('reopen', question)} icon="replay">Reopen question</Button>}
          </ActionGroup>}
        </div>}
      </li>;
    })}</ol> : !composer && <p className="ar-question-empty">No follow-up questions yet. {role === 'buyer' ? 'Ask about a saved part or drawing detail to start a separate thread.' : 'New customer questions will appear here with their original references.'}</p>}
    {dirty && <p className="ar-question-help ar-question-draft-note">Finish or cancel this draft before opening another question.</p>}
  </section>;
}
