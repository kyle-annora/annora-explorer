import React, { useEffect, useRef, useState } from 'react';
import { Button, Glyph } from '../product-room/ui/components.jsx';
import { createRoomViewer } from '../product-room/viewer.js';
import { STUDIO_PRODUCT_ID, STUDIO_PARTS } from './seed.js';

/** Presentation only: the existing embed controller owns the single 3D runtime. */
export function StudioModelStage({ productId = STUDIO_PRODUCT_ID, parts = STUDIO_PARTS, selectedId, onSelection, onEdit, onViewer, onCapture, onCaptureDone, editLabel = 'Edit details', modelRevision, visible = true }) {
  const mount = useRef(null), viewer = useRef(null), selection = useRef(onSelection), selected = useRef(selectedId);
  const [status, setStatus] = useState('loading'), [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
  const [capturing, setCapturing] = useState(false);
  const [started, setStarted] = useState(() => window.innerWidth > 900 || visible);
  selection.current = onSelection; selected.current = selectedId;
  const connection = useRef(onViewer); connection.current = onViewer;
  useEffect(() => { if (visible) setStarted(true); else void viewer.current?.pause().catch(() => {}); }, [visible]);
  useEffect(() => {
    if (!started) return;
    let active = true, initialized = false;
    setStatus('loading'); setError('');
    const host = createRoomViewer({ mount: mount.current, explorerURL: new URL('../?chrome=compact', location.href).href,
      onState(state) {
        const id = state.navigation?.selectedId;
        if (active && initialized && state.lifecycle === 'ready' && state.model?.id === productId && state.model?.revision === modelRevision && parts.some(part => part.id === id)) selection.current?.(id);
      },
      onError(cause) { if (active) { setError(cause.message); setStatus('error'); } },
    });
    viewer.current = host;
    host.mountModel(productId).then(async () => {
      if (!active) return;
      if (host.state?.model?.id !== productId || host.state?.model?.revision !== modelRevision) throw new Error('This draft references a different model version. Its saved product details remain available.');
      if (selected.current) await host.request('select', { nodeId: selected.current });
      if (active) { initialized = true; setStatus('ready'); connection.current?.(host); }
    }).catch(cause => { if (active) { setError(cause.message); setStatus('error'); } });
    const observer = new IntersectionObserver(entries => { if (entries[0] && !entries[0].isIntersecting) void host.pause().catch(() => {}); });
    observer.observe(mount.current);
    const pauseWhenHidden = () => { if (document.hidden) void host.pause().catch(() => {}); };
    document.addEventListener('visibilitychange', pauseWhenHidden);
    return () => { active = false; observer.disconnect(); document.removeEventListener('visibilitychange', pauseWhenHidden); viewer.current = null; connection.current?.(null); void host.dispose(); };
  }, [started, attempt, productId, modelRevision]);
  useEffect(() => {
    const host = viewer.current;
    if (status === 'ready' && selectedId && host?.state?.navigation?.selectedId !== selectedId)
      void host.request('select', { nodeId: selectedId }).catch(cause => { if (cause.code !== 'CANCELLED') setError(cause.message); });
  }, [selectedId, status]);
  const part = parts.find(item => item.id === selectedId);
  return <section className="studio-model-stage" id="studio-model-stage" aria-label="Product model">
    <div className="studio-model-mount" ref={mount}/>
    {status !== 'ready' && <div className="studio-model-status" role="status"><Glyph name="info"/><strong>{status === 'error' ? 'Model preview unavailable' : 'Preparing the product'}</strong><p>{error || 'Your product fields remain available while 3D loads.'}</p>{status === 'error' && <Button variant="secondary" onClick={() => setAttempt(value => value + 1)}>Try again</Button>}</div>}
    {status === 'ready' && <div className="studio-model-context" data-capture={Boolean(onCapture)}><span aria-live="polite"><strong>{part?.title || 'Whole assembly'}</strong></span>{onCapture ? <div className="studio-story-model-actions"><Button variant="secondary" pending={capturing} pendingLabel="Capturing…" onClick={async () => {
      setCapturing(true); setError('');
      try { await onCapture(); onCaptureDone?.(); } catch (cause) { setError(cause.message); }
      finally { setCapturing(false); }
    }}>Capture view and return</Button><Button variant="quiet" disabled={capturing} onClick={onEdit}>{editLabel}</Button></div> : <Button variant="quiet" icon="arrow" onClick={onEdit}>{editLabel}</Button>}</div>}
    {status === 'ready' && error && <p className="studio-model-message" role="status">{error}</p>}
  </section>;
}
