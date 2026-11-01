import {registerWalkthroughAction} from './actions.js';

/** Uses the public host controller; the Explorer and its clock stay unchanged. */
export function createWalkthroughViewerAction({viewer, sessionId, isActive, openInquiry, window:win = window}) {
  const key = `annora.walkthrough.motion.${sessionId}`;
  let seen = false, busy = false, unregister, signature = '', finishCycle;
  try { seen = win.sessionStorage.getItem(key) === 'seen'; } catch { /* Ephemeral preview still works. */ }
  function sync() {
    if (finishCycle && viewer.state?.operation?.status !== 'playing') finishCycle();
    const active = isActive(), ready = viewer.state?.lifecycle === 'ready';
    const next = JSON.stringify([active, ready, busy, seen]);
    if (next === signature) return;
    signature = next; unregister?.(); unregister = null;
    if (!active) { finishCycle?.(); return; }
    unregister = registerWalkthroughAction('buyer-viewer', {
      id: seen ? 'inquiry-open' : 'mechanism-cycle', label:'Continue demo',
      title: seen ? 'Carry the part into the inquiry.' : 'See the motion, then discuss the part.',
      note: seen ? 'Next: open an inquiry with Connecting rod attached.' : 'Next: play one short cycle, then highlight Connecting rod.',
      busy, disabled:busy || !ready,
      run: async () => {
        if (busy) return;
        busy = true; sync();
        try {
          if (seen) {
            await viewer.pause();
            await viewer.request('select',{nodeId:'rod'});
            await openInquiry();
          } else {
            if (viewer.state?.tour?.active) await viewer.request('exitTour',{restore:false});
            if (win.matchMedia('(prefers-reduced-motion: reduce)').matches) {
              await viewer.request('seekOperation',{progress:.35});
            } else {
              await viewer.request('replayOperation');
              if (viewer.state?.operation?.status === 'playing') {
                await new Promise((resolve,reject) => {
                  const timer = win.setTimeout(()=>{finishCycle=null;reject(new Error('The cycle is still paused or loading. Use the Explorer controls, then try Continue demo again.'));},30000);
                  finishCycle=()=>{win.clearTimeout(timer);finishCycle=null;resolve();};
                });
              }
            }
            if (!isActive()) return;
            await viewer.request('select',{nodeId:'rod'});
            seen = true;
            try { win.sessionStorage.setItem(key,'seen'); } catch { /* No stored business data is needed. */ }
          }
        } finally { busy = false; sync(); }
      },
    });
  }
  return {sync, dispose(){finishCycle?.();unregister?.();}};
}
