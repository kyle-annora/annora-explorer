import { normalizeProjectContext } from './project-domain.js';

const PREFIX = 'annora.exploration-handoff.v1.';
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const MAX_BYTES = 400000;
const tokenPattern = /^[a-zA-Z0-9-]{16,80}$/;
const fail = message => Object.assign(new Error(message), { code: 'HANDOFF_UNAVAILABLE' });

function sessionStore(options) {
  try { return options.storage ?? globalThis.sessionStorage; }
  catch { throw fail('This browser could not keep your 3D reference. Allow session storage, then try again.'); }
}

/** Same-tab transport, not a public/shareable project URL or a delivery API. */
export function createExplorationHandoff(context, options = {}) {
  const value = normalizeProjectContext(context);
  if (!value.inspection) throw fail('Capture a 3D view before starting this inquiry.');
  const token = options.token ?? globalThis.crypto.randomUUID();
  if (!tokenPattern.test(token)) throw fail('This reference has an invalid link.');
  const now = options.now ?? Date.now();
  const payload = JSON.stringify({ version: 1, createdAt: now, context: value });
  if (payload.length > MAX_BYTES) throw fail('This 3D reference is too large to attach. Try capturing it again.');
  const storage = sessionStore(options);
  try {
    storage.setItem(PREFIX + token, payload);
    if (storage.getItem(PREFIX + token) !== payload) throw new Error('write failed');
  } catch { throw fail('Your 3D reference could not be saved. Keep this view open and try again.'); }
  return token;
}

export function readExplorationHandoff(token, options = {}) {
  if (!tokenPattern.test(token || '')) throw fail('This 3D reference link is invalid. Return to the Explorer to attach a view.');
  let serialized;
  try { serialized = sessionStore(options).getItem(PREFIX + token); }
  catch { throw fail('This browser could not read the attached 3D reference. Return to the Explorer and try again.'); }
  if (!serialized) throw fail('This 3D reference is available only in the browser tab where it was created. Return to the Explorer to attach a view.');
  try {
    if (serialized.length > MAX_BYTES) throw new Error('size');
    const value = JSON.parse(serialized), now = options.now ?? Date.now();
    if (value.version !== 1 || !Number.isFinite(value.createdAt) || value.createdAt > now + 60000 || now - value.createdAt > MAX_AGE) throw new Error('expired');
    const context = normalizeProjectContext(value.context);
    if (!context.inspection) throw new Error('no inspection');
    return context;
  } catch { throw fail('This saved 3D reference is unavailable or has expired. Return to the Explorer to attach a new view.'); }
}
