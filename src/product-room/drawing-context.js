import { normalizeOverviewPresentation } from '../drawings/overview-presentation.js';

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
  // Existing projects predate mapping versions. Do not assign today's mapping
  // to those records; only preserve a version that the host explicitly supplied.
  for (const key of ['mappingRevision','revisionLabel']) if (input[key] !== undefined) {
    const value = typeof input[key] === 'string' ? input[key].trim() : '';
    if (!value || value.length > (key==='revisionLabel'?160:320) || /[\u0000-\u001f]/.test(value)) throw new TypeError(`A drawing reference needs a valid ${key}.`);
    result[key] = value;
  }
  // Layout has its own immutable identity. It is deliberately excluded from
  // drawingVersionKey: changing presentation does not create another job or
  // rebase an already saved inquiry onto the seller's current overview.
  if (input.presentationSnapshot !== undefined) {
    const snapshot = normalizeOverviewPresentation(input.presentationSnapshot);
    if ((snapshot && input.presentationRevision !== snapshot.revision) || (!snapshot && input.presentationRevision !== undefined))
      throw new TypeError('The saved overview does not match its presentation version.');
    result.presentationSnapshot = snapshot;
    if (snapshot) result.presentationRevision = snapshot.revision;
  } else if (input.presentationRevision !== undefined) {
    throw new TypeError('A saved overview version needs its exact presentation snapshot.');
  }
  return result;
}

/** A new drawing or asset version starts a separate draft. Changing a selected
 * region within that same version is an explicit reference change, not a new job. */
export const drawingVersionKey = context => context.drawing
  ? [context.drawing.id, context.drawing.revision, context.drawing.assetId, context.drawing.assetRevision,
    ...(context.drawing.mappingRevision ? [context.drawing.mappingRevision] : [])]
  : null;


/** Active project work and historical records deliberately have different fallbacks. */
export const projectDrawingContext = project => project.activeDrawingContext || project.context;
export const recordContext = (project, record) => record?.context || project.context;
export const drawingReferenceKey = context => JSON.stringify([context.modelId,context.modelRevision,
  ...(drawingVersionKey(context) || []),context.drawing?.sheetId,context.drawing?.regionId,context.drawing?.partId]);

export const drawingVersionLabel = drawing => drawing?.revisionLabel || drawing?.revision;
