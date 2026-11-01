/** Drawing packages bind authored regions to exact document and model versions.
 * Coordinates are unrotated page-top-left points, never screen pixels. No CAD
 * topology or manufacturing approval is inferred by this module. */
const HASH = /^[a-f0-9]{64}$/i;
const ID = /^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/;
const clone = value => JSON.parse(JSON.stringify(value));
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const vector = (value, length) => Array.isArray(value) && value.length === length && value.every(Number.isFinite);
const issue = (code, path, message, severity = 'error') => ({ code, path, message, severity });

export class DrawingPackageError extends TypeError {
  constructor(issues) {
    super(issues.map(item => `${item.path}: ${item.message}`).join('\n'));
    this.name = 'DrawingPackageError'; this.issues = issues;
  }
}

function legacyPackage(input, options) {
  const pdfId = `${input.id}-pdf`, stepId = `${input.id}-step`;
  return {
    ...clone(input), schemaVersion: 2, modelRevision: input.modelRevision || options.modelRevision,
    mappingRevision: input.mappingRevision || `legacy-${input.revision}`,
    pairing: input.pairing || { status: 'unverified', evidence: 'Legacy drawing metadata. Confirm the source PDF and STEP pairing before publication.' },
    assets: [
      { id: pdfId, kind: 'pdf', file: input.pdfFile, sha256: input.assetRevision },
      { id: stepId, kind: 'step', file: input.stepFile, sha256: input.stepSha256 },
    ],
    sheets: (input.sheets || []).map(sheet => ({ ...sheet, assetId: pdfId, format: 'pdf', pdfPage: sheet.pdfPage || 1,
      coordinateFrame: 'page-top-left', rotation: 0,
      regions: (sheet.regions || []).map(region => ({ ...region, mappingStatus: region.mappingStatus || 'confirmed' })),
    })),
  };
}

function isAssetURL(value) {
  if (!nonempty(value)) return false;
  try { const parsed = new URL(value, 'https://drawing-package.invalid/'); return ['http:', 'https:', 'blob:'].includes(parsed.protocol) && !parsed.username && !parsed.password; }
  catch { return false; }
}

function isSourceURL(value) {
  if (!nonempty(value)) return false;
  try { const parsed = new URL(value); return ['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password; }
  catch { return false; }
}

function structuralIssues(pkg) {
  const errors = [], add = (code, path, message) => errors.push(issue(code, path, message));
  if (pkg.schemaVersion !== 2) add('schema-version', 'schemaVersion', 'Expected drawing package schema version 2.');
  for (const field of ['id', 'modelId', 'modelRevision', 'title', 'revision', 'mappingRevision', 'sourceURL', 'units', 'status'])
    if (!nonempty(pkg[field])) add('required', field, 'A nonempty value is required.');
  if (!ID.test(pkg.id || '')) add('invalid-id', 'id', 'Use a stable identifier.');
  if (!['mm', 'cm', 'm', 'in', 'unknown'].includes(pkg.units)) add('units', 'units', 'Use mm, cm, m, in or unknown; do not infer missing source units.');
  if (!isSourceURL(pkg.sourceURL)) add('source-url', 'sourceURL', 'Use an absolute HTTP(S) source URL without credentials.');
  if (!['source-derived', 'human-confirmed', 'unverified'].includes(pkg.pairing?.status) || !nonempty(pkg.pairing?.evidence))
    add('pairing-evidence', 'pairing', 'Pairing needs an explicit status and evidence.');
  const assets = Array.isArray(pkg.assets) ? pkg.assets : [], assetMap = new Map();
  if (!assets.length) add('assets', 'assets', 'At least one original source asset is required.');
  assets.forEach((asset, index) => {
    const path = `assets[${index}]`;
    if (!asset || typeof asset !== 'object' || Array.isArray(asset)) { add('asset', path, 'An asset object is required.'); return; }
    if (!ID.test(asset.id || '') || assetMap.has(asset.id)) add('asset-id', `${path}.id`, 'Asset IDs must be unique stable identifiers.');
    assetMap.set(asset.id, asset);
    if (!['pdf', 'svg', 'step'].includes(asset.kind)) add('asset-kind', `${path}.kind`, 'Use pdf, svg or step.');
    if (!HASH.test(asset.sha256 || '')) add('source-identity', `${path}.sha256`, 'An exact SHA-256 source identity is required.');
    if (!nonempty(asset.file) || asset.file.startsWith('/') || asset.file.split(/[\\/]/).includes('..') || /[?#]/.test(asset.file))
      add('asset-file', `${path}.file`, 'Use a file path relative to this package directory.');
    if (asset.url !== undefined && !isAssetURL(asset.url)) add('asset-url', `${path}.url`, 'Use a local or HTTP(S) asset URL.');
  });
  assets.forEach((asset, index) => {
    if (!asset?.sourceAssetId) return;
    const seen = new Set([asset.id]); let source = asset;
    while (source.sourceAssetId) {
      if (seen.has(source.sourceAssetId) || !assetMap.has(source.sourceAssetId)) { add('derived-source', `assets[${index}].sourceAssetId`, 'Derived assets must resolve to an original asset without cycles.'); break; }
      seen.add(source.sourceAssetId); source = assetMap.get(source.sourceAssetId);
    }
  });
  const sheets = Array.isArray(pkg.sheets) ? pkg.sheets : [], sheetIds = new Set();
  if (!sheets.length) add('sheets', 'sheets', 'At least one drawing sheet is required.');
  sheets.forEach((sheet, index) => {
    const path = `sheets[${index}]`;
    if (!sheet || typeof sheet !== 'object' || Array.isArray(sheet)) { add('sheet', path, 'A sheet object is required.'); return; }
    const paper = sheet.viewBox;
    if (!ID.test(sheet.id || '') || sheetIds.has(sheet.id)) add('sheet-id', `${path}.id`, 'Sheet IDs must be unique stable identifiers.');
    sheetIds.add(sheet.id);
    if (!nonempty(sheet.title)) add('sheet-title', `${path}.title`, 'A sheet title is required.');
    const asset = assetMap.get(sheet.assetId);
    if (!asset || asset.kind !== sheet.format || !['pdf', 'svg'].includes(sheet.format)) add('sheet-asset', `${path}.assetId`, 'The sheet must reference an asset with the matching PDF or SVG format.');
    if (sheet.format === 'pdf' && (!Number.isInteger(sheet.pdfPage) || sheet.pdfPage < 1)) add('pdf-page', `${path}.pdfPage`, 'PDF pages use positive one-based page numbers.');
    if (sheet.coordinateFrame !== 'page-top-left') add('coordinate-frame', `${path}.coordinateFrame`, 'Use unrotated page-top-left coordinates.');
    const validPaper = vector(paper, 4) && paper[2] > 0 && paper[3] > 0;
    if (!validPaper) add('view-box', `${path}.viewBox`, 'Use finite x, y, width and height values with positive dimensions.');
    if (sheet.format === 'pdf' && validPaper && (paper[0] !== 0 || paper[1] !== 0)) add('pdf-origin', `${path}.viewBox`, 'PDF coordinates start at the unrotated page top-left [0, 0].');
    if (![0, 90, 180, 270].includes(sheet.rotation)) add('rotation', `${path}.rotation`, 'Use 0, 90, 180 or 270 degrees clockwise.');
    const regionIds = new Set();
    if (!Array.isArray(sheet.regions)) add('regions', `${path}.regions`, 'Regions must be an array.');
    (Array.isArray(sheet.regions) ? sheet.regions : []).forEach((region, regionIndex) => {
      const regionPath = `${path}.regions[${regionIndex}]`;
      if (!region || typeof region !== 'object' || Array.isArray(region)) { add('region', regionPath, 'A semantic region object is required.'); return; }
      const rect = region.bounds;
      if (!ID.test(region.id || '') || regionIds.has(region.id)) add('region-id', `${regionPath}.id`, 'Region IDs must be unique within the sheet.');
      regionIds.add(region.id);
      if (!nonempty(region.label)) add('region-label', `${regionPath}.label`, 'A customer-readable detail name is required.');
      if (!['confirmed', 'needs-review', 'missing'].includes(region.mappingStatus)) add('mapping-status', `${regionPath}.mappingStatus`, 'Use confirmed, needs-review or missing.');
      if (region.mappingStatus === 'confirmed' && !nonempty(region.partId)) add('part-id', `${regionPath}.partId`, 'Confirmed regions must reference a real model part ID.');
      const validRect = vector(rect, 4) && rect[2] > 0 && rect[3] > 0;
      if (!validRect) add('region-bounds', `${regionPath}.bounds`, 'Use finite x, y, width and height values with positive dimensions.');
      else if (validPaper && (rect[0] < paper[0] || rect[1] < paper[1] || rect[0] + rect[2] > paper[0] + paper[2] + 1e-7 || rect[1] + rect[3] > paper[1] + paper[3] + 1e-7))
        add('region-outside', `${regionPath}.bounds`, 'The semantic region must stay inside its source page.');
      if (region.focusPoint !== undefined && !vector(region.focusPoint, 3)) add('focus-point', `${regionPath}.focusPoint`, 'A focus point must contain three finite model-space coordinates.');
      if (region.camera !== undefined) {
        if (!region.camera || typeof region.camera !== 'object') add('camera', `${regionPath}.camera`, 'Authored camera data must be an object.');
        else {
          for (const required of ['direction', 'halfSize']) if (!vector(region.camera[required], 3))
            add('camera-required', `${regionPath}.camera.${required}`, 'Authored detail cameras need a direction and framing halfSize.');
          for (const [key, value] of Object.entries(region.camera)) {
          if (!['target', 'direction', 'halfSize', 'focusPoint', 'position', 'up'].includes(key)) add('camera-field', `${regionPath}.camera.${key}`, 'Only authored target, position, direction, up, halfSize or focusPoint vectors are supported.');
          else if (!vector(value, 3) || (['direction', 'up'].includes(key) && Math.hypot(...value) === 0) || (key === 'halfSize' && value.some(item => item <= 0)))
            add('camera-vector', `${regionPath}.camera.${key}`, 'Use a finite, non-degenerate model-space vector.');
          }
        }
      }
    });
  });
  return errors;
}

/** Structural validation accepts unresolved draft mappings. Publication uses
 * releaseDiagnostic with the exact imported part registry and model revision. */
export function normalizeDrawingPackage(input, options = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new DrawingPackageError([issue('package', '$', 'A drawing package object is required.')]);
  const pkg = input.schemaVersion === 1 ? legacyPackage(input, options) : clone(input);
  if (!pkg.modelRevision && options.modelRevision) pkg.modelRevision = options.modelRevision;
  if (Array.isArray(pkg.assets)) pkg.assets = pkg.assets.map(asset => asset && typeof asset === 'object' ? ({ ...asset,
    sha256: typeof asset.sha256 === 'string' ? asset.sha256.toLowerCase() : asset.sha256,
    ...(options.assetURLs?.[asset.id] || options.assetURLs?.[asset.file] ? { url: options.assetURLs[asset.id] || options.assetURLs[asset.file] } : {}),
  }) : asset);
  const issues = structuralIssues(pkg);
  if (issues.length) throw new DrawingPackageError(issues);
  return pkg;
}

export const validateDrawingPackage = normalizeDrawingPackage;

/** Release gates distinguish an honest unreviewed source from an unconfirmed
 * association. Reference documents are allowed; incorrect bindings are not. */
export function releaseDiagnostic(input, { partIds, modelRevision } = {}) {
  let pkg;
  try { pkg = normalizeDrawingPackage(input); }
  catch (error) { if (error instanceof DrawingPackageError) return { valid: false, issues: error.issues }; throw error; }
  const issues = [];
  if (!modelRevision) issues.push(issue('model-version-required', 'modelRevision', 'Validate against the exact imported model revision before publication.'));
  else if (pkg.modelRevision !== modelRevision) issues.push(issue('model-version', 'modelRevision', 'The package targets a different model revision. Reconfirm its associations.'));
  if (pkg.pairing.status === 'unverified') issues.push(issue('pairing-unverified', 'pairing', 'Confirm evidence that these source documents and geometry belong together.'));
  if (pkg.units === 'unknown') issues.push(issue('units-unverified', 'units', 'Source units have not been verified.', 'warning'));
  if (pkg.status === 'unreviewed-reference') issues.push(issue('reference-only', 'status', 'This is an unreviewed reference, not a manufacturing-approved drawing.', 'warning'));
  const registry = partIds ? new Set(partIds) : null;
  if (!registry) issues.push(issue('part-registry', 'modelId', 'Validate against the exact imported model part registry before publication.'));
  pkg.sheets.forEach((sheet, sheetIndex) => sheet.regions.forEach((region, index) => {
    const path = `sheets[${sheetIndex}].regions[${index}]`;
    if (region.mappingStatus !== 'confirmed') issues.push(issue('mapping-unconfirmed', `${path}.mappingStatus`, 'Confirm the model part and authored source region before publication.'));
    if (registry && !registry.has(region.partId)) issues.push(issue('unknown-part', `${path}.partId`, 'The selected part does not exist in this model revision.'));
  }));
  return { valid: !issues.some(item => item.severity === 'error'), issues };
}

export function resolveSheetContext(pkg, sheetId, regionId = null) {
  const sheet = pkg?.sheets?.find(item => item.id === sheetId);
  if (!sheet) return null;
  const region = regionId === null ? null : sheet.regions.find(item => item.id === regionId);
  if (regionId !== null && !region) return null;
  const asset = pkg.assets.find(item => item.id === sheet.assetId);
  return asset ? { package: pkg, sheet, region, asset } : null;
}

export function sourceAssetFor(pkg, assetId) {
  let asset = pkg.assets.find(item => item.id === assetId), count = 0;
  while (asset?.sourceAssetId && count++ < pkg.assets.length) asset = pkg.assets.find(item => item.id === asset.sourceAssetId);
  return asset || null;
}
