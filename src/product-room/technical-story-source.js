import { normalizeTechnicalStoryReference } from './technical-story.js';

/** Resolve the recorded document and presentation, never the latest edition. */
export async function resolveTechnicalStoryPreview(input, { signal, isCurrent = () => true } = {}) {
  const reference = normalizeTechnicalStoryReference(input);
  const current = () => !signal?.aborted && isCurrent();
  const cancelled = () => Object.assign(new Error('The drawing preview was cancelled.'), { code: 'CANCELLED' });
  if (!current()) throw cancelled();
  const [{ DRAWING_CATALOG, DRAWING_RELEASES, resolveDrawingEntry }, { createDrawingRepository },
    { resolveReferencePreview }, { overviewEntriesFor }] = await Promise.all([
    import('../drawings/catalog.js'), import('../studio/drawing-repository.js'),
    import('../drawings/reference-preview.js'), import('../drawing-preview/technical-catalog.js'),
  ]);
  if (!current()) throw cancelled();
  const packages = DRAWING_CATALOG.filter(entry => entry.model?.revision && entry.package.modelRevision === entry.model.revision);
  const repository = createDrawingRepository({ packages });
  const lease = await resolveReferencePreview(reference.context, { catalog: DRAWING_CATALOG, staticReleases: DRAWING_RELEASES,
    listReleases: id => repository.listReleases(id), resolveEntry: resolveDrawingEntry });
  try {
    if (!current()) throw cancelled();
    const sheet = lease.package.sheets.find(item => item.id === reference.context.drawing.sheetId);
    if (!sheet || (sheet.pdfPage || 1) !== reference.pdfPage || (sheet.rotation || 0) !== reference.rotation)
      throw new Error('This recorded drawing page or rotation is unavailable. Its saved reference has not changed.');
    if (reference.viewId) {
      const entries = overviewEntriesFor(lease.package, { sheetId: sheet.id, presentationSnapshot: lease.presentationSnapshot });
      if (lease.presentationState === 'unavailable' || !entries.some(entry => entry.id === reference.viewId && entry.regionIds.includes(reference.context.drawing.regionId)))
        throw new Error('This recorded technical view is unavailable. Open its original PDF from the saved drawing record.');
    }
    return { ...lease, reference };
  } catch (error) { lease.dispose?.(); throw error; }
}
