import { registerWalkthroughAction } from '../walkthrough/actions.js';
import { inquiryWalkthroughAction } from '../walkthrough/inquiry-action.js';

/** Room ownership only. The mounted surface owns the shared inquiry session. */
export function createRoomInquiryHost({ element, repository, onState = () => {}, onClose, onCapture, onRestore, onProject,
  loadPanel = () => import('./embedded-inquiry.jsx'), register = registerWalkthroughAction } = {}) {
  let panel, loading, state = null, active = false, unregister, disposed = false;
  function sync() {
    unregister?.(); unregister = null;
    if (active && repository.mode === 'walkthrough') unregister = register('buyer-workspace', inquiryWalkthroughAction({ state, panel }));
    onState({ ...state, active });
  }
  async function ensure() {
    if (panel) return panel;
    if (!loading) loading = loadPanel().then(({ mountEmbeddedInquiry }) => mountEmbeddedInquiry(element, {
      repository, onCapture, onRestore, onProject, onClose,
      allowAnother: repository.mode !== 'walkthrough',
      onState(next) { state = next; sync(); },
    })).then(value => { panel = value; sync(); return value; }).catch(error => { loading = null; throw error; });
    return loading;
  }
  return {
    get state() { return state; },
    getContext() { return panel?.getContext() || null; },
    async open(options) {
      if (disposed) throw new Error('This inquiry host has closed.');
      active = true; sync();
      return (await ensure()).open(options);
    },
    async beforeLeave() { if (loading) await loading; return panel ? panel.beforeLeave() : true; },
    suspend() { active = false; panel?.suspend(); sync(); },
    minimize() { return panel?.minimize(); },
    async dispose() {
      if (loading) await loading;
      if (panel && !(await panel.dispose())) return false;
      disposed = true; active = false; unregister?.(); unregister = null; return true;
    },
  };
}
