/** A derived view is valid only for its exact prepared source and associations.
 * This policy never resolves or changes a business reference. */
export function matchesTechnicalSource(drawing, prepared, unavailable = false) {
  if (unavailable || !drawing || !prepared) return false;
  for (const key of ['id', 'revision', 'modelRevision', 'mappingRevision']) {
    if (drawing[key] !== prepared[key]) return false;
  }
  if (!prepared.assets.every(asset => drawing.assets?.some(candidate =>
    candidate.id === asset.id && candidate.sha256 === asset.sha256))) return false;
  return prepared.sheets.every(source => {
    const sheet = drawing.sheets?.find(item => item.id === source.id);
    if (!sheet || sheet.assetId !== source.assetId || sheet.pdfPage !== source.pdfPage ||
      sheet.rotation !== source.rotation || JSON.stringify(sheet.viewBox) !== JSON.stringify(source.viewBox)) return false;
    return source.regions.every(region => {
      const actual = sheet.regions?.find(item => item.id === region.id);
      return actual?.partId === region.partId && actual?.mappingStatus === 'confirmed' &&
        JSON.stringify(actual.bounds) === JSON.stringify(region.bounds);
    });
  });
}

/** A later association edition can reuse geometry only for a binding that is
 * byte-for-byte equivalent in its engineering coordinates and linked part.
 * The host still retains the later mapping ID in its own immutable context. */
export function matchesTechnicalBinding(drawing, prepared, sheetId, regionId, unavailable = false) {
  if (unavailable || !drawing || !prepared || !drawing.mappingRevision) return false;
  for (const key of ['id', 'revision', 'modelId', 'modelRevision'])
    if (drawing[key] !== prepared[key]) return false;
  if (!prepared.assets.every(asset => drawing.assets?.some(candidate =>
    candidate.id === asset.id && candidate.kind === asset.kind && candidate.sha256 === asset.sha256))) return false;
  const source = prepared.sheets.find(sheet => sheet.id === sheetId);
  const actual = drawing.sheets?.find(sheet => sheet.id === sheetId);
  if (!source || !actual || source.assetId !== actual.assetId || source.pdfPage !== actual.pdfPage ||
    (source.rotation || 0) !== (actual.rotation || 0) || JSON.stringify(source.viewBox) !== JSON.stringify(actual.viewBox)) return false;
  const expected = source.regions.find(region => region.id === regionId);
  const region = actual.regions.find(item => item.id === regionId);
  if (!expected || !region || region.mappingStatus !== 'confirmed') return false;
  return ['partId', 'bounds', 'camera', 'focusPoint'].every(key =>
    JSON.stringify(region[key]) === JSON.stringify(expected[key]));
}
