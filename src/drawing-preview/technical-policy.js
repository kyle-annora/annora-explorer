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
