import { normalizeDrawingContext } from './drawing-context.js';

export const TECHNICAL_STORY_VERSION = 1;
const copy = value => JSON.parse(JSON.stringify(value));
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 320 && !/[\u0000-\u001f]/.test(value);
const failure = (code, message) => Object.assign(new TypeError(message), { code });
const check = (valid, message) => { if (!valid) throw failure('INVALID_TECHNICAL_REFERENCE', message); };

/** Exact reading identity, without duplicating a commercial Room snapshot. */
export function createTechnicalStoryReference({ context, pdfPage = 1, rotation = 0, viewId = null }) {
  return normalizeTechnicalStoryReference({ version: TECHNICAL_STORY_VERSION,
    context: { modelId: context?.modelId, modelRevision: context?.modelRevision,
      part: copy(context?.part || null), drawing: copy(context?.drawing || null) }, pdfPage, rotation, viewId });
}

/** Source review is not manufacturing approval. This checks document identity. */
export function normalizeTechnicalStoryReference(input, { model, nodeId } = {}) {
  check(object(input) && input.version === TECHNICAL_STORY_VERSION, 'This technical step uses an unsupported reference version.');
  check(JSON.stringify(input).length <= 24000, 'Keep one technical reference within the supported size.');
  const source = input.context;
  check(object(source) && text(source.modelId) && text(source.modelRevision), 'A technical step needs its exact model version.');
  check(object(source.part) && text(source.part.id) && text(source.part.title), 'Choose the part linked to this drawing detail.');
  check(!model || (source.modelId === model.id && source.modelRevision === model.revision), 'This technical reference belongs to another model version.');
  check(!nodeId || source.part.id === nodeId, 'The technical detail and story step must select the same part.');
  const drawing = normalizeDrawingContext(source.drawing, source);
  check(text(drawing.mappingRevision), 'A technical step needs its confirmed association version.');
  check(/^[a-f0-9]{64}$/i.test(drawing.assetRevision), 'A technical step needs the exact source file hash.');
  check(Object.hasOwn(drawing, 'presentationSnapshot'), 'Choose an exact overview version or explicitly use the original drawing.');
  check(Number.isInteger(input.pdfPage) && input.pdfPage >= 1 && input.pdfPage <= 10000, 'Choose the exact source drawing page.');
  check([0, 90, 180, 270].includes(input.rotation), 'Choose a supported drawing page rotation.');
  check(input.viewId === null || text(input.viewId), 'Choose an available technical view or the original drawing.');
  if (input.viewId !== null) {
    const sheet = drawing.presentationSnapshot?.sheets.find(item => item.sheetId === drawing.sheetId);
    const view = sheet?.views.find(item => item.id === input.viewId);
    check(view && view.targets.some(target => target.regionId === drawing.regionId && target.confirmed),
      'The selected overview view must contain this confirmed drawing detail.');
  }
  return { version: TECHNICAL_STORY_VERSION,
    context: { modelId: source.modelId, modelRevision: source.modelRevision,
      part: { id: source.part.id, title: source.part.title }, drawing },
    pdfPage: input.pdfPage, rotation: input.rotation, viewId: input.viewId };
}

/** Labels can be edited; source, page, association and overview cannot drift. */
export function technicalStoryReferenceKey(input) {
  const ref = normalizeTechnicalStoryReference(input), { context } = ref, d = context.drawing;
  return JSON.stringify([ref.version, context.modelId, context.modelRevision, context.part.id,
    d.id, d.revision, d.assetId, d.assetRevision, d.mappingRevision, d.sheetId, d.regionId,
    d.partId, d.sourceURL, d.presentationRevision ?? null, d.presentationSnapshot,
    ref.pdfPage, ref.rotation, ref.viewId]);
}

/** The prepared host supplies exact available references; history never falls forward. */
export function validateTechnicalStoryReference(input, { model, nodeId, technicalReferences = [], historical = false } = {}) {
  const ref = normalizeTechnicalStoryReference(input, { model, nodeId });
  if (historical) return ref;
  const identity = technicalStoryReferenceKey(ref);
  const available = technicalReferences.some(candidate => {
    if (candidate?.available === false || candidate?.nodeId !== ref.context.part.id) return false;
    try { return technicalStoryReferenceKey(candidate.technical) === identity; }
    catch { return false; }
  });
  if (!available) throw failure('TECHNICAL_SOURCE_UNAVAILABLE',
    'This exact drawing, association or overview is unavailable. Choose a prepared reference and review the step again.');
  return ref;
}
