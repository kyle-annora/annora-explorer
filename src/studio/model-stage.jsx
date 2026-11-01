import React, { useEffect, useRef, useState } from 'react';
import { Button, Glyph } from '../product-room/ui/components.jsx';
import { createRoomViewer } from '../product-room/viewer.js';
import { STUDIO_PRODUCT_ID, STUDIO_PARTS } from './seed.js';

/** Presentation only: the existing embed controller owns the single 3D runtime. */
export function StudioModelStage({ selectedId, onSelection, onEdit, modelRevision, visible = true }) {
  const mount = useRef(null), viewer = useRef(null), selection = useRef(onSelection), selected = useRef(selectedId);
  const [status, setStatus] = useState('loading'), [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
  const [started, setStarted] = useState(() => window.innerWidth > 900 || visible);
  selection.current = onSelection; selected.current = selectedId;
  useEffect(() => { if (visible) setStarted(true); else void viewer.current?.pause().catch(() => {}); }, [visible]);
  useEffect(() => {
    if (!started) return;
    let active = true, initialized = false;
    setStatus('loading'); setError('');
    const host = createRoomViewer({ mount: mount.current, explorerURL: new URL('../?chrome=compact', location.href).href,
      onState(state) {
        const id = state.navigation?.selectedId;
        if (active && initialized && state.lifecycle === 'ready' && state.model?.id === STUDIO_PRODUCT_ID && state.model?.revision === modelRevision && STUDIO_PARTS.some(part => part.id === id)) selection.current?.(id);
      },
      onError(cause) { if (active) { setError(cause.message); setStatus('error'); } },
    });
    viewer.current = host;
    host.mountModel(STUDIO_PRODUCT_ID).then(async () => {
      if (!active) return;
      if (host.state?.model?.id !== STUDIO_PRODUCT_ID || host.state?.model?.revision !== modelRevision) throw new Error('This draft references a different model version. Its saved product details remain available.');
      if (selected.current) await host.request('select', { nodeId: selected.current });
      if (active) { initialized = true; setStatus('ready'); }
    }).catch(cause => { if (active) { setError(cause.message); setStatus('error'); } });
    const observer = new IntersectionObserver(entries => { if (entries[0] && !entries[0].isIntersecting) void host.pause().catch(() => {}); });
    observer.observe(mount.current);
    const pauseWhenHidden = () => { if (document.hidden) void host.pause().catch(() => {}); };
    document.addEventListener('visibilitychange', pauseWhenHidden);
    return () => { active = false; observer.disconnect(); document.removeEventListener('visibilitychange', pauseWhenHidden); viewer.current = null; void host.dispose(); };
  }, [started, attempt, modelRevision]);
  useEffect(() => {
    const host = viewer.current;
    if (status === 'ready' && selectedId && host?.state?.navigation?.selectedId !== selectedId)
      void host.request('select', { nodeId: selectedId }).catch(cause => { if (cause.code !== 'CANCELLED') setError(cause.message); });
  }, [selectedId, status]);
  const part = STUDIO_PARTS.find(item => item.id === selectedId);
  return <section className="studio-model-stage" id="studio-model-stage" aria-label="Product model">
    <div className="studio-model-mount" ref={mount}/>
    {status !== 'ready' && <div className="studio-model-status" role="status"><Glyph name="info"/><strong>{status === 'error' ? 'Model preview unavailable' : 'Preparing the product'}</strong><p>{error || 'Your product fields remain available while 3D loads.'}</p>{status === 'error' && <Button variant="secondary" onClick={() => setAttempt(value => value + 1)}>Try again</Button>}</div>}
    {status === 'ready' && <div className="studio-model-context"><span aria-live="polite"><strong>{part?.title || 'Whole assembly'}</strong></span><Button variant="quiet" icon="arrow" onClick={onEdit}>Edit details</Button></div>}
    {status === 'ready' && error && <p className="studio-model-message" role="status">{error}</p>}
  </section>;
}
