import React, { useEffect, useId, useState } from 'react';
import { ActionGroup, Button, Field, Glyph, Status } from '../product-room/ui/components.jsx';
import { adoptCurrentOptionPreference, SCOPE_DISPOSITIONS } from '../product-room/option-scope-domain.js';
import { QuoteScopeReference, QuoteQuestionEvidence } from '../product-room/quote-scope-summary.jsx';
import { quoteScopeChoice, quoteScopeRow, quoteScopeQuestions } from '../product-room/quote-scope-presentation.js';
import { adoptCurrentQuestions, pendingBlockingQuestions, questionStatusLabel } from '../product-room/question-domain.js';
import './quote-scope-editor.css';

/** Editing remains inside the host quotation draft, including its existing save/review guards. */
export function QuoteScopeEditor({ project, draft, onChange, errors = {}, disabled = false, onExplore, onQuestions }) {
  const prefix = useId();
  const [expanded, setExpanded] = useState(null);
  const [reviewingPreference, setReviewingPreference] = useState(false);
  const [reviewingQuestions, setReviewingQuestions] = useState(false);
  const selection = draft?.scopeSelection;
  const hasSelection = Boolean(selection?.entries?.length);
  const latest = project?.optionPreferences?.at(-1) || null;
  const oldPreference = selection?.preference;
  const changedPreference = Boolean(selection && (latest?.id || null) !== (oldPreference?.id || null));
  const lines = draft?.values?.lineItems || [];
  const requestItems = project?.inquiry?.requestItems || [];
  const currentQuestions = project?.questions || [];
  const draftQuestions = draft?.questionScope?.questions || [];
  const changedQuestions = JSON.stringify(currentQuestions) !== JSON.stringify(draftQuestions);
  const blockedQuestions = pendingBlockingQuestions(project);
  const firstInvalidId = selection?.entries?.find(entry => errors[`scopeSelection.entries.${entry.id}`] || quoteScopeQuestions(entry, draft?.questionScope).some(question => errors[`questionScope.${question.id}`]))?.id;
  useEffect(() => { setExpanded(null); setReviewingPreference(false); setReviewingQuestions(false); }, [draft?.id]);
  useEffect(() => { setReviewingPreference(false); }, [latest?.id, oldPreference?.id]);
  useEffect(() => { setReviewingQuestions(false); }, [JSON.stringify(currentQuestions), JSON.stringify(draftQuestions)]);
  useEffect(() => {
    if (firstInvalidId) setExpanded(firstInvalidId);
  }, [firstInvalidId]);
  if (!hasSelection && !currentQuestions.length && !draftQuestions.length) return null;
  const candidate = { ...selection, optionSet: project.approvedOptionSet, preference: latest };
  const unresolved = selection?.entries?.filter(entry => entry.disposition === 'needs-clarification').length || 0;
  function updateEntry(id, values) {
    if (disabled) return;
    onChange({ ...draft, scopeSelection: { ...selection, entries: selection.entries.map(entry => entry.id === id ? { ...entry, ...values } : entry) } });
  }
  function adopt() {
    if (disabled || !reviewingPreference || !changedPreference) return;
    onChange(adoptCurrentOptionPreference(project, draft));
    setReviewingPreference(false); setExpanded('preference');
  }
  return <section className="studio-quote-scope" aria-label="Link customer requests to quotation scope">
    <header className="studio-quote-scope-heading"><h3>{hasSelection ? 'Customer requests and quoted scope' : 'Questions used by this quotation'}</h3>
      <p>{hasSelection ? 'Decide how each request is covered, then link the relevant quotation lines. This does not change prices.' : 'Review the questions and their saved answers before issuing this quotation.'}</p>
    </header>
    {hasSelection && <div className="studio-quote-scope-preference">
      <div><span>Preference used by this draft</span><strong>{quoteScopeChoice(selection)}</strong>
        <small>{oldPreference ? `Confirmed preference · Version ${oldPreference.version}` : 'No confirmed preference is attached.'}</small></div>
      {changedPreference && !reviewingPreference && <Button variant="secondary" disabled={disabled} onClick={() => setReviewingPreference(true)}>Review latest preference</Button>}
    </div>}
    {changedPreference && <p className="studio-quote-scope-attention">The customer has a newer confirmed preference. Review it before issuing this quotation.</p>}
    {reviewingPreference && changedPreference && <div className="studio-quote-scope-adoption" aria-label="Review latest customer preference">
      <div className="studio-quote-scope-adoption-choices"><div><span>This draft</span><strong>{quoteScopeChoice(selection)}</strong><small>{oldPreference ? `Version ${oldPreference.version}` : 'No preference attached'}</small></div>
        <div><span>Latest confirmed choice</span><strong>{quoteScopeChoice(candidate)}</strong><small>Version {latest?.version}</small></div></div>
      {latest?.notes && <p className="studio-quote-scope-request">{latest.notes}</p>}
      <p className="studio-quote-scope-help">Confirming updates this draft only. Review the preference’s scope again; earlier quotations and the original inquiry stay unchanged.</p>
      <ActionGroup align="start"><Button variant="secondary" disabled={disabled} onClick={adopt}>Use this preference in draft</Button>
        <Button variant="quiet" disabled={disabled} onClick={() => setReviewingPreference(false)}>Keep reviewing draft</Button></ActionGroup>
    </div>}
    {errors.scopeSelection && <p className="studio-quote-scope-error" role="alert">{errors.scopeSelection}</p>}
    {(currentQuestions.length > 0 || draftQuestions.length > 0) && <div className="studio-quote-scope-question-summary">
      <div className="studio-quote-scope-preference"><div><span>Question evidence used by this draft</span>
        <strong>{draftQuestions.length} linked {draftQuestions.length === 1 ? 'question' : 'questions'}</strong>
        <small>Each question is linked to the original customer request below.</small></div>
        {changedQuestions && !reviewingQuestions && <Button variant="secondary" disabled={disabled} onClick={() => setReviewingQuestions(true)}>Review latest question evidence</Button>}
      </div>
      {changedQuestions && <p className="studio-quote-scope-attention">Question activity has changed. Review and adopt the latest evidence before issuing this quotation.</p>}
      {blockedQuestions.length > 0 && <div className="studio-quote-scope-question-blocked"><p>{blockedQuestions.length} {blockedQuestions.length === 1 ? 'question needs' : 'questions need'} an explicit resolution before this quotation can be issued.</p>
        {onQuestions && <Button variant="quiet" disabled={disabled} onClick={onQuestions}>Review project questions</Button>}
      </div>}
      {reviewingQuestions && changedQuestions && <div className="studio-quote-scope-adoption" aria-label="Review latest question evidence">
        <div className="studio-quote-scope-adoption-choices"><div><span>This draft</span><strong>{draftQuestions.length} question snapshots</strong>
          <ul className="studio-quote-scope-evidence-list">{draftQuestions.map(question => <li key={question.id}>{question.body}<small>{questionStatusLabel(question)} · {question.events.length} events</small></li>)}</ul>
          {!draftQuestions.length && <p className="studio-quote-scope-help">No question evidence was attached to this version.</p>}</div>
          <div><span>Latest project evidence</span><strong>{currentQuestions.length} question snapshots</strong>
            <ul className="studio-quote-scope-evidence-list">{currentQuestions.map(question => <li key={question.id}>{question.body}<small>{questionStatusLabel(question)} · {question.events.length} events</small></li>)}</ul>
          </div></div>
        <div>{currentQuestions.map(question => <QuoteQuestionEvidence key={question.id} question={question} label="Latest evidence to adopt" />)}</div>
        <p className="studio-quote-scope-help">Confirming updates this draft’s question references and full event history. Earlier quotations keep their own evidence. Review each linked scope decision before issuing.</p>
        <ActionGroup align="start"><Button variant="secondary" disabled={disabled} onClick={() => { onChange(adoptCurrentQuestions(project, draft)); setReviewingQuestions(false); }}>Use latest question evidence in draft</Button>
          <Button variant="quiet" disabled={disabled} onClick={() => setReviewingQuestions(false)}>Keep reviewing draft</Button></ActionGroup>
      </div>}
    </div>}
    {errors.questionScope && <p className="studio-quote-scope-error" role="alert">{errors.questionScope}</p>}
    {!hasSelection && <div className="ar-quote-scope-questions">{draftQuestions.map(question => <div key={question.id}>
      <QuoteQuestionEvidence question={question} label="Evidence used by this draft" />
      {errors[`questionScope.${question.id}`] && <p className="studio-quote-scope-error" role="alert">{errors[`questionScope.${question.id}`]}</p>}
    </div>)}</div>}
    {hasSelection && <><div className="studio-quote-scope-count"><span>{selection.entries.length} scope decisions</span><span>{unresolved ? `${unresolved} need clarification` : 'All requests classified'}</span></div>
    <ol className="studio-quote-scope-list">{selection.entries.map((entry, index) => {
      const row = quoteScopeRow(entry, selection, requestItems, lines);
      const questions = quoteScopeQuestions(entry, draft.questionScope);
      const open = expanded === entry.id;
      const bodyId = `${prefix}-scope-${index}`;
      const entryError = errors[`scopeSelection.entries.${entry.id}`] || questions.map(question => errors[`questionScope.${question.id}`]).find(Boolean);
      const canLink = ['included', 'optional'].includes(entry.disposition);
      const missingLines = row.lines.filter(line => !line.available);
      const disposition = SCOPE_DISPOSITIONS.find(item => item.value === entry.disposition)?.label || 'Needs review';
      return <li key={entry.id} data-scope-entry={entry.id}>
        <button type="button" className="studio-quote-scope-toggle" aria-expanded={open} aria-controls={bodyId} disabled={disabled}
          onClick={() => setExpanded(open ? null : entry.id)}>
          <span className="studio-quote-scope-title"><strong>{row.title}</strong><small>{row.kind}{entry.lineIds.length ? ` · ${entry.lineIds.length} quotation ${entry.lineIds.length === 1 ? 'line' : 'lines'}` : ''}</small></span>
          <Status tone={entryError || entry.disposition === 'needs-clarification' ? 'warning' : 'neutral'}>{disposition}</Status>
          <Glyph name={open ? 'close' : 'plus'} />
        </button>
        {open && <div className="studio-quote-scope-body" id={bodyId}>
          {row.notes && <p className="studio-quote-scope-request">{row.notes}</p>}
          <QuoteScopeReference entry={entry} selection={selection} requestItems={requestItems} />
          {onExplore && <Button variant="quiet" disabled={disabled} onClick={() => onExplore(entry.context, entry)}>View referenced detail</Button>}
          {questions.length > 0 && <div className="ar-quote-scope-questions"><h4>Questions linked to this request</h4>
            {questions.map(question => <QuoteQuestionEvidence key={question.id} question={question} label="Evidence used by this draft" />)}
          </div>}
          <Field label="How is this request covered?" value={entry.disposition} options={SCOPE_DISPOSITIONS} disabled={disabled}
            onChange={event => updateEntry(entry.id, { disposition: event.target.value })} />
          <fieldset className="studio-quote-scope-lines" disabled={disabled} aria-describedby={entryError ? `${bodyId}-error` : undefined}>
            <legend>Linked quotation lines</legend>
            <p className="studio-quote-scope-help">{canLink ? 'Choose one or more lines. A line may cover several customer requests.' : entry.disposition === 'excluded' ? 'Excluded requests have no quotation lines. Remove any existing links.' : 'Keep quotation lines unlinked until this request is clarified.'}</p>
            {lines.map((line, lineIndex) => {
              const selected = entry.lineIds.includes(line.id);
              return <label key={line.id} className="studio-quote-scope-line" data-disabled={!canLink && !selected || undefined}>
                <input type="checkbox" checked={selected} disabled={disabled || !canLink && !selected}
                  onChange={event => updateEntry(entry.id, { lineIds: event.target.checked ? [...entry.lineIds, line.id] : entry.lineIds.filter(id => id !== line.id) })} />
                <span><strong>{line.label || `Untitled line ${lineIndex + 1}`}</strong><small>Line {lineIndex + 1} · {line.id}</small></span>
              </label>;
            })}
            {!lines.length && <p className="studio-quote-scope-help">Add a quotation line in Pricing before linking included or optional scope.</p>}
            {missingLines.map(line => <div key={line.id} className="studio-quote-scope-missing"><span>This linked line was removed: {line.id}</span>
              <Button variant="quiet" disabled={disabled} onClick={() => updateEntry(entry.id, { lineIds: entry.lineIds.filter(id => id !== line.id) })}>Remove unavailable link</Button></div>)}
          </fieldset>
          <Field label={entry.disposition === 'excluded' ? 'Why is this excluded?' : 'Explanation for the customer'} optional={entry.disposition !== 'excluded'}
            required={entry.disposition === 'excluded'} textarea rows={3} maxLength={2000} value={entry.rationale || ''} disabled={disabled}
            onChange={event => updateEntry(entry.id, { rationale: event.target.value })} />
          {entryError && <p id={`${bodyId}-error`} className="studio-quote-scope-error" role="alert">{entryError}</p>}
        </div>}
      </li>;
    })}</ol></>}
    <p className="studio-quote-scope-help studio-quote-scope-end">Customers see {hasSelection ? 'these decisions' : 'this question evidence'} in the quotation only after you review and issue it. Questions marked as required before quotation must be resolved first.</p>
  </section>;
}
