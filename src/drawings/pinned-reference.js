/** Missing query fields may use defaults; supplied identities must never do so. */
export function requestedDrawingIssues(pkg, query) {
  const issues = [];
  const expect = (key, actual, label) => {
    if (query.has(key) && query.get(key) !== actual) issues.push(`The requested ${label} is unavailable.`);
  };
  expect('drawing', pkg.revision, 'drawing version');
  expect('mapping', pkg.mappingRevision, 'association version');
  const sheet = query.has('sheet') ? pkg.sheets.find(item => item.id === query.get('sheet')) : pkg.sheets[0];
  if (!sheet) issues.push('The requested drawing sheet is unavailable.');
  if (query.has('detail') && !sheet?.regions.some(region => region.id === query.get('detail'))) issues.push('The requested drawing detail is unavailable.');
  expect('asset', pkg.assets.find(asset => asset.id === sheet?.assetId)?.sha256, 'source file');
  return issues;
}
