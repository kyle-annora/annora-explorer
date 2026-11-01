/** Stable change identifiers. These are not authentication or digital signatures. */
export const copyStudioValue = value => JSON.parse(JSON.stringify(value));
export function canonicalStudioValue(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalStudioValue).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalStudioValue(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
export const sameStudioValue = (left, right) => canonicalStudioValue(left) === canonicalStudioValue(right);
export function studioFingerprint(value) {
  const text = canonicalStudioValue(value);
  let first = 2166136261, second = 2246822519;
  for (let index = 0; index < text.length; index++) {
    first = Math.imul(first ^ text.charCodeAt(index), 16777619);
    second = Math.imul(second ^ text.charCodeAt(index), 3266489917);
  }
  return `${(first >>> 0).toString(16).padStart(8, '0')}${(second >>> 0).toString(16).padStart(8, '0')}`;
}
export const profileVersion = fields => `kinetic-inquiry-${studioFingerprint(fields)}`;
