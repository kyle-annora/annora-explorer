import { normalizeOverviewPresentation, overviewPresentationIssues } from './overview-presentation.js';

/** Resolve a recorded reference without falling forward to the latest package.
 * Dependencies are supplied by the host so this boundary also works with a
 * future API repository. The returned entry owns any temporary asset leases. */
export async function resolveReferencePreview(context, { catalog = [], staticReleases = [], listReleases = async () => [], resolveEntry } = {}) {
  const ref = context?.drawing;
  if (!ref || !context.modelId || !context.modelRevision) throw new Error('This record does not contain an exact drawing reference.');
  const entry = catalog.find(item => item.model.id === context.modelId && item.model.revision === context.modelRevision);
  if (!entry) throw new Error('The recorded model version is unavailable. Its saved reference is unchanged.');
  const local = await listReleases(entry.id);
  const snapshots = [entry.package, ...[...staticReleases, ...local].filter(record => record.productId === entry.id).map(record => record.packageSnapshot)];
  const candidates = snapshots.filter(pkg => {
    if (!pkg || pkg.id !== ref.id || pkg.modelId !== context.modelId || pkg.modelRevision !== context.modelRevision || pkg.revision !== ref.revision) return false;
    if (ref.mappingRevision && pkg.mappingRevision !== ref.mappingRevision) return false;
    const sheet = pkg.sheets.find(item => item.id === ref.sheetId), region = sheet?.regions.find(item => item.id === ref.regionId);
    const asset = pkg.assets.find(item => item.id === sheet?.assetId);
    return asset?.id === ref.assetId && asset.sha256 === ref.assetRevision && region?.partId === ref.partId &&
      (!context.part?.id || context.part.id === region.partId) && region.mappingStatus === 'confirmed';
  });
  if (!candidates.length) throw new Error('The recorded drawing or association version is unavailable. A newer file will not replace it.');
  // Older records did not store mappingRevision. They can be displayed only
  // when every available matching edition agrees on the selected geometry.
  // Never infer a latest association for an old commercial record.
  if (!ref.mappingRevision) {
    const identities = new Set(candidates.map(pkg => {
      const sheet = pkg.sheets.find(item => item.id === ref.sheetId), region = sheet.regions.find(item => item.id === ref.regionId);
      return JSON.stringify({ assetId: sheet.assetId, pdfPage: sheet.pdfPage, rotation: sheet.rotation, viewBox: sheet.viewBox,
        partId: region.partId, bounds: region.bounds, camera: region.camera, focusPoint: region.focusPoint });
    }));
    if (identities.size !== 1) throw new Error('This older record does not identify an association version. Its saved reference is preserved; no current mapping is substituted.');
  }
  if (typeof resolveEntry !== 'function') throw new TypeError('An exact drawing asset resolver is required.');
  const resolved = await resolveEntry(entry, candidates[0]);
  // Legacy records may use only the preserved bundled baseline. A later seller
  // publication is never used as an implicit presentation migration.
  const recorded = ref.presentationSnapshot !== undefined;
  const candidate = recorded ? ref.presentationSnapshot : resolved.legacyOverviewPresentation ?? entry.legacyOverviewPresentation;
  let presentationSnapshot = null, presentationState = recorded ? 'source-only' : 'legacy-source';
  if (candidate) {
    try {
      const checked = normalizeOverviewPresentation(candidate);
      if (recorded && ref.presentationRevision !== checked.revision) throw new Error('Overview identity mismatch.');
      if (overviewPresentationIssues(checked, resolved.package).some(issue => issue.severity !== 'warning')) throw new Error('Overview source mismatch.');
      presentationSnapshot = checked;
      presentationState = recorded ? 'recorded' : 'legacy';
    } catch {
      // The original source remains usable even when its prepared presentation
      // is unavailable. Never substitute a newer overview for this record.
      presentationState = 'unavailable';
    }
  }
  return { ...resolved, previewSheetId: ref.sheetId, previewRegionId: ref.regionId, presentationSnapshot, presentationState };
}
