/** Immutable viewing reference, not a confirmed dimension or manufacturing approval. */
export function normalizeDrawingContext(input, context) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('A drawing reference needs its saved identity.');
  if (!context.modelId || !context.modelRevision || !context.part) throw new TypeError('A drawing reference needs a part and exact model revision.');
  const result = {};
  for (const key of ['id', 'title', 'revision', 'assetId', 'assetRevision', 'partId', 'sheetId', 'sheetTitle', 'regionId', 'regionLabel', 'sourceURL']) {
    const value = typeof input[key] === 'string' ? input[key].trim() : '';
    const limit = key === 'sourceURL' ? 2048 : 320;
    if (!value || value.length > limit || /[\u0000-\u001f]/.test(value)) throw new TypeError(`A drawing reference needs a valid ${key}.`);
    result[key] = value;
  }
  if (result.partId !== context.part.id) throw new TypeError('The drawing detail must reference the selected part.');
  let source;
  try { source = new URL(result.sourceURL); } catch { throw new TypeError('A drawing source needs an HTTP or HTTPS address.'); }
  if (!['http:', 'https:'].includes(source.protocol) || source.username || source.password) throw new TypeError('A drawing source needs an HTTP or HTTPS address.');
  return result;
}

/** A new drawing or asset version starts a separate draft. Changing a selected
 * region within that same version is an explicit reference change, not a new job. */
export const drawingVersionKey = context => context.drawing
  ? [context.drawing.id, context.drawing.revision, context.drawing.assetId, context.drawing.assetRevision]
  : null;
