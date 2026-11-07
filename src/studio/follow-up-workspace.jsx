import React, { useEffect, useRef, useState } from 'react';
import { ActionGroup, Button, EmptyState, Notice, Section } from '../product-room/ui/components.jsx';
import { followUpCatalog, followUpNextActions } from '../product-room/follow-up-domain.js';
import { followUpURL } from '../product-room/follow-up-demo.js';
import { createRoomViewer } from '../product-room/viewer.js';
import { createFollowUpView } from '../product-room/follow-up-view.js';
import { DrawingReference } from '../product-room/drawing-reference.jsx';
import { MODEL_CATALOG } from '../generated/catalog.js';
import { buildHierarchy } from '../explorer/model-state.js';
import { FollowUpEditor, FollowUpReview } from './follow-up-editor.jsx';
import { UnsavedDialog } from './ui.jsx';
import { copy, date } from './navigation.js';

const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const staleCodes = new Set(['STALE_REVIEW', 'CONFLICT']);

/** Preview borrows the existing host and player. It cannot publish, navigate to a quote, or save buyer progress. */
function FollowUpPreview({ review, onBack }) {
  const stage = useRef(null), controls = useRef(null), returnToReview = useRef(onBack);
  const [state, setState] = useState('loading'), [error, setError] = useState(''), [attempt, setAttempt] = useState(0), [reference, setReference] = useState(null);
  returnToReview.current = onBack;
  useEffect(() => {
    let active = true, player;
    const abort = new AbortController(), release = review.snapshot, model = MODEL_CATALOG[release.context.modelId];
    setState('loading'); setError(''); setReference(null);
    if (!model || model.revision !== release.context.modelRevision) {
      setState('error'); setError('The exact model version in this follow-up is unavailable. The saved project remains unchanged.');
      return () => { active = false; };
    }
    const host = createRoomViewer({ mount: stage.current, explorerURL: new URL('../?chrome=compact', location.href).href,
      onState: next => player?.update(next), onError: cause => { if (active) { setState('error'); setError(cause.message); } } });
    (async () => {
      const [response] = await Promise.all([fetch(model.metadataUrl, { signal: abort.signal }), host.mountModel(model.id)]);
      if (!response.ok) throw new Error('The prepared model details could not be loaded. Try the preview again.');
      const metadata = await response.json();
      if (!active) return;
      const parts = [...buildHierarchy(metadata, model.presentationPolicy).nodes.values()];
      player = createFollowUpView({ mount: controls.current, viewer: host, release, model, parts, preview: true,
        progress: { revision: 0, stepId: release.story.steps[0].id, mode: 'paused' },
        onOpenReference: async item => {
          if (item.context.drawing) { if (active) setReference(item.context); return; }
          if (active) setReference(null);
          await host.restoreContext(item.context);
        }, onBack: () => returnToReview.current(), onError: cause => { if (active) setError(cause.message); } });
      player.update(host.state); setState('ready');
    })().catch(cause => { if (active && cause.name !== 'AbortError') { setState('error'); setError(cause.message); } });
    const pause = () => { if (document.hidden) player ? player.suspend() : void host.pause().catch(() => {}); };
    document.addEventListener('visibilitychange', pause);
    const observer = new IntersectionObserver(entries => { if (!entries[0]?.isIntersecting) player ? player.suspend() : void host.pause().catch(() => {}); });
    observer.observe(stage.current);
    return () => { active = false; abort.abort(); observer.disconnect(); document.removeEventListener('visibilitychange', pause); player?.dispose(); void host.dispose(); };
  }, [review.token, attempt]);
  return <section className="studio-follow-up-preview" aria-label="Preview follow-up">
    <header className="studio-follow-up-preview-header"><div><h2>Preview the customer sequence</h2><p>Playback stays here. Return to review before confirming.</p></div><Button variant="secondary" onClick={onBack}>Return to review</Button></header>
    <div className="studio-follow-up-preview-stage" ref={stage} />
    {state === 'loading' && <p role="status">Preparing the existing Explorer…</p>}
    {error && <Notice kind="error" title={state === 'error' ? 'Preview unavailable' : 'Preview needs attention'}>{error}
      {state === 'error' && <ActionGroup align="start"><Button variant="secondary" onClick={() => setAttempt(value => value + 1)}>Try preview again</Button></ActionGroup>}</Notice>}
    <div className="studio-follow-up-preview-controls" ref={controls} />
    {reference && <div className="studio-follow-up-preview-reference"><DrawingReference context={reference} label="Original customer drawing" />
      <Button variant="quiet" onClick={() => setReference(null)}>Close drawing reference</Button></div>}
  </section>;
}

/** The saved project is read-only here. Only a dedicated follow-up draft and immutable confirmed version can be written. */
export function FollowUpWorkspace({ repository, projectId, guardRef, onNavigate, onGo }) {
  const [project, setProject] = useState(null), [draft, setDraft] = useState(null), [saved, setSaved] = useState(null), [releases, setReleases] = useState([]);
  const [mode, setMode] = useState('edit'), [review, setReview] = useState(null), [confirmed, setConfirmed] = useState(false), [published, setPublished] = useState(null);
  const [busy, setBusy] = useState('loading'), [error, setError] = useState(''), [errors, setErrors] = useState({}), [status, setStatus] = useState('');
  const [stale, setStale] = useState(false), [reloadAsked, setReloadAsked] = useState(false), [leave, setLeave] = useState(null);
  const busyRef = useRef('loading'), latest = useRef({}), generation = useRef(0), dirtyRef = useRef(false), alive = useRef(true), statusNode = useRef(null), workspace = useRef(null);
  const dirty = !!draft && !same(draft, saved);
  latest.current = { project, draft, saved, mode, review, confirmed, releases, stale }; dirtyRef.current = dirty;
  const projectRoute = { page: 'project', id: projectId, tab: 'conversation', mode: 'detail' };

  async function readWorkspace() {
    const results = await Promise.allSettled([repository.getSellerProject(projectId), repository.getFollowUpDraft(projectId), repository.listFollowUps(projectId)]);
    const rejected = results.find(result => result.status === 'rejected');
    if (rejected) throw rejected.reason;
    return results.map(result => result.value);
  }
  function showFailure(cause) {
    setError(cause.message || 'This action could not be saved. Your input is still here.'); setErrors(cause.fields || {});
    if (staleCodes.has(cause.code)) { setStale(true); setConfirmed(false); }
    requestAnimationFrame(() => (workspace.current?.querySelector('[aria-invalid="true"], [data-follow-up-error]') || statusNode.current)?.focus({ preventScroll: true }));
  }
  async function task(name, operation) {
    if (busyRef.current) return;
    const turn = generation.current;
    busyRef.current = name; setBusy(name); setError(''); setErrors({}); setStatus('');
    try { return await operation(); }
    catch (cause) { if (alive.current && turn === generation.current) showFailure(cause); return null; }
    finally { if (alive.current && turn === generation.current) { busyRef.current = ''; setBusy(''); } }
  }
  async function saveCurrent() {
    const current = latest.current;
    const next = same(current.draft, current.saved) && current.draft.revision > 0
      ? current.saved : await repository.saveFollowUpDraft(current.draft);
    if (!alive.current) return next;
    latest.current = { ...latest.current, draft: next, saved: next };
    dirtyRef.current = false; setDraft(next); setSaved(copy(next)); setStatus(`Draft saved ${date(next.updatedAt)}.`);
    return next;
  }
  async function prepare(preview = false) {
    return task(preview ? 'preview' : 'review', async () => {
      await saveCurrent();
      const next = await repository.reviewFollowUp(projectId);
      if (!alive.current) return;
      setReview(next); setConfirmed(false); setMode(preview ? 'preview' : 'review'); setStale(false);
    });
  }
  async function publish() {
    return task('confirm', async () => {
      const current = latest.current;
      const release = await repository.publishFollowUp(current.review, { confirmed: current.confirmed });
      if (!alive.current) return;
      setPublished(release); setReleases(values => values.some(value => value.id === release.id) ? values : [...values, release]);
      setMode('published'); setConfirmed(false); setStatus(`Follow-up v${release.version} confirmed. The customer project and quotation are unchanged.`);
    });
  }
  function edit(next) {
    if (busyRef.current) return;
    setDraft(next); latest.current = { ...latest.current, draft: next }; dirtyRef.current = !same(next, latest.current.saved);
    setReview(null); setConfirmed(false); setError(''); setErrors({}); setStatus('');
  }
  async function reloadSaved() {
    return task('reload', async () => {
      const [fresh, stored, versions] = await readWorkspace();
      if (!alive.current) return;
      // Rebind only after explicit reload confirmation; all original choices still need review.
      const next = { ...stored, projectRevision: fresh.revision, context: copy(fresh.context) };
      setProject(fresh); setSaved(copy(stored)); setDraft(next); setReleases(versions);
      latest.current = { ...latest.current, project: fresh, saved: stored, draft: next };
      dirtyRef.current = !same(next, stored); setReview(null); setConfirmed(false); setStale(false); setReloadAsked(false); setMode('edit');
      setStatus('Saved work reopened against the current project. Check your choices and review again.');
    });
  }

  useEffect(() => {
    alive.current = true; const turn = ++generation.current;
    busyRef.current = 'loading'; setBusy('loading'); setProject(null); setDraft(null); setSaved(null); setReleases([]);
    setMode('edit'); setReview(null); setPublished(null); setError(''); setErrors({}); setStatus(''); setStale(false); setReloadAsked(false); setConfirmed(false); dirtyRef.current = false;
    readWorkspace().then(([record, value, versions]) => {
      if (!alive.current || turn !== generation.current) return;
      setProject(record); setDraft(value); setSaved(copy(value)); setReleases(versions);
      setStale(value.projectRevision !== record.revision);
    }).catch(cause => { if (alive.current && turn === generation.current) showFailure(cause); })
      .finally(() => { if (alive.current && turn === generation.current) { busyRef.current = ''; setBusy(''); } });
    return () => { alive.current = false; ++generation.current; };
  }, [repository, projectId]);
  useEffect(() => {
    const guard = next => {
      if (busyRef.current) return true;
      if (dirtyRef.current) { setLeave(next); return true; }
      return false;
    };
    if (guardRef) guardRef.current = guard;
    const beforeUnload = event => { if (dirtyRef.current || (busyRef.current && busyRef.current !== 'loading')) { event.preventDefault(); event.returnValue = ''; } };
    const checkCurrent = async () => {
      if (busyRef.current || !latest.current.project) return;
      const before = latest.current, turn = generation.current;
      try {
        const [record, stored] = await Promise.all([repository.getSellerProject(projectId), repository.getFollowUpDraft(projectId)]);
        if (!alive.current || turn !== generation.current || busyRef.current) return;
        const savedDraftChanged = stored.revision !== before.saved.revision
          || (stored.revision > 0 && stored.id !== before.saved.id);
        if (record.revision !== before.project.revision || savedDraftChanged) {
          setStale(true); setConfirmed(false);
        }
      } catch (cause) { if (alive.current && turn === generation.current) showFailure(cause); }
    };
    window.addEventListener('beforeunload', beforeUnload); window.addEventListener('focus', checkCurrent); window.addEventListener('storage', checkCurrent);
    return () => {
      if (guardRef?.current === guard) guardRef.current = null;
      window.removeEventListener('beforeunload', beforeUnload); window.removeEventListener('focus', checkCurrent); window.removeEventListener('storage', checkCurrent);
    };
  }, [repository, projectId, guardRef]);

  const versions = <Section className="studio-follow-up-versions" title="Confirmed versions" description="Each version keeps its original views, requests and next step.">
    {releases.length ? <ol>{[...releases].reverse().map(release => <li key={release.id}><div><strong>{release.title}</strong><small>Follow-up v{release.version} · {date(release.createdAt)}</small></div>
      <Button variant="quiet" disabled={!!busy} icon="external" onClick={() => onNavigate({ externalURL: followUpURL(release) })}>Open follow-up v{release.version}</Button></li>)}</ol>
      : <p className="studio-follow-up-source">No follow-up has been confirmed for this project.</p>}
  </Section>;
  return <div className="studio-follow-up-workspace" ref={workspace}>
    <div className="studio-follow-up-return"><Button variant="quiet" icon="back" disabled={!!busy} onClick={() => onNavigate(projectRoute)}>Back to customer project</Button></div>
    <div ref={statusNode} tabIndex={-1} className="studio-follow-up-feedback">
      {stale && <Notice title="This project or saved follow-up changed">
        <p>Your current input is still here. Reopen saved work and review it against the current project before confirming.</p>
        {!reloadAsked ? <Button variant="secondary" disabled={!!busy} onClick={() => setReloadAsked(true)}>Reload saved version</Button>
          : <><p>Reloading replaces your current edits with the last saved follow-up. Previously confirmed versions stay unchanged.</p>
            <ActionGroup align="start"><Button variant="secondary" disabled={!!busy} onClick={() => setReloadAsked(false)}>Keep current input</Button><Button pending={busy === 'reload'} disabled={!!busy} onClick={reloadSaved}>Reload and review choices</Button></ActionGroup></>}
      </Notice>}
      {error && (mode === 'published' || mode === 'preview' || !project || !draft) && <Notice kind="error" title="Follow-up needs attention">{error}</Notice>}
    </div>
    {busy === 'loading' ? <p role="status">Opening the project follow-up…</p> : !project || !draft ? <EmptyState title="Follow-up unavailable" description="The project could not be opened. Existing project records have not changed."><Button variant="secondary" onClick={() => onNavigate(projectRoute)}>Return to project</Button></EmptyState>
      : mode === 'preview' && review ? <FollowUpPreview review={review} onBack={() => { setMode('review'); setConfirmed(false); }} />
        : mode === 'review' && review ? <FollowUpReview review={review} targets={followUpNextActions(project)} busy={busy} error={error}
          confirmed={confirmed && !stale} canConfirm={!stale} onConfirmedChange={value => setConfirmed(value && !stale)} onEdit={() => { setMode('edit'); setConfirmed(false); }}
          onPreview={() => { setMode('preview'); setConfirmed(false); }} onConfirm={publish} />
          : mode === 'published' && published ? <div className="studio-follow-up"><Section title={`Follow-up v${published.version} confirmed`} description="Saved in this browser. Nothing was emailed or sent to the customer.">
            <p>{published.title}</p><ActionGroup align="start"><Button icon="arrow" onClick={() => onNavigate({ externalURL: followUpURL(published) })}>Open customer follow-up</Button>
              <Button variant="secondary" onClick={() => { setMode('edit'); setReview(null); }}>Prepare another version</Button></ActionGroup></Section>{versions}</div>
            : <><FollowUpEditor project={project} draft={draft} catalog={followUpCatalog(project)} targets={followUpNextActions(project)} errors={errors} error={error} busy={busy} status={status}
              onChange={edit} onSave={() => task('save', saveCurrent)} onReview={() => prepare(false)} onPreview={() => prepare(true)} onCancel={() => onNavigate(projectRoute)} />{versions}</>}
    <UnsavedDialog open={!!leave} pending={!!busy} title="Keep your follow-up edits?"
      description="Save this follow-up before leaving, or discard the edits from this session. Confirmed follow-up versions stay unchanged."
      onKeep={() => setLeave(null)} onDiscard={() => { const target = leave; setLeave(null); dirtyRef.current = false; onGo(target); }}
      onSave={() => task('save', async () => { await saveCurrent(); const target = leave; setLeave(null); onGo(target); })} />
  </div>;
}
