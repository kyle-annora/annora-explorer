/** Visitor-only display choices, independent of model and commercial record versions. */
export const GRID_DEFAULTS = Object.freeze({ engineering: true, linework: false, flat: false });
export function normalizeDisplayPreferences(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const grids = { ...GRID_DEFAULTS };
  for (const style of Object.keys(grids)) if (typeof source.grids?.[style] === 'boolean') grids[style] = source.grids[style];
  return { appearance: source.appearance === 'dark' ? 'dark' : 'light', grids };
}
export function readDisplayPreferences(storage, key, params) {
  let saved;
  try { saved = JSON.parse(storage.getItem(key) || 'null'); } catch { /* Private browsing or malformed preference: use the same defaults. */ }
  const result = normalizeDisplayPreferences(saved), requested = params?.get('appearance');
  if (requested === 'light' || requested === 'dark') result.appearance = requested;
  return result;
}
export function writeDisplayPreferences(storage, key, preferences) {
  const value = normalizeDisplayPreferences(preferences);
  try { storage.setItem(key, JSON.stringify(value)); } catch { /* Viewing does not require persistent storage. */ }
  return value;
}
