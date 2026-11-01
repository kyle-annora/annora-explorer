/**
 * Host-owned presentation actions. The strip never edits domain records or
 * searches for/clicks business controls. A host registers its current reviewed
 * action, and removes it when that view unmounts. No action survives navigation.
 */
export function createWalkthroughActions() {
  const entries = new Map(), listeners = new Set();
  const publish = () => { for (const listener of listeners) listener(); };
  return {
    register(owner, action) {
      if (!owner || typeof action?.run !== 'function' || !action.id) throw new TypeError('A named walkthrough action and handler are required.');
      const entry = {owner, ...action};
      entries.set(owner, entry); publish();
      return () => {
        // An old effect cleanup cannot remove a newer action from the same host.
        if (entries.get(owner) === entry) { entries.delete(owner); publish(); }
      };
    },
    get(owner) { return entries.get(owner) || null; },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  };
}

const actions = createWalkthroughActions();
export const registerWalkthroughAction = (owner, action) => actions.register(owner, action);
export const getWalkthroughAction = owner => actions.get(owner);
export const subscribeWalkthroughActions = listener => actions.subscribe(listener);

export function isWalkthroughActionCurrent(action, sourceURL, currentURL, lookup = getWalkthroughAction) {
  return Boolean(action) && sourceURL === currentURL && (!action.owner || lookup(action.owner) === action);
}

/** One activation cannot cross a review boundary, even if its UI updates fast. */
export function createAdvanceGuard({now = () => Date.now(), settleMs = 800} = {}) {
  let active = false, readyAt = 0;
  return {
    get blocked() { return active || now() < readyAt; },
    async run(action) {
      if (active || now() < readyAt) return false;
      active = true; readyAt = now() + settleMs;
      try { await action(); return true; }
      finally { active = false; readyAt = Math.max(readyAt, now() + 250); }
    },
  };
}
