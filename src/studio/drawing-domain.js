import { normalizeDrawingPackage, releaseDiagnostic } from '../drawings/package.js';
import { copyStudioValue as copy, sameStudioValue as same, studioFingerprint } from './value.js';
import { normalizeOverviewPresentation, overviewPresentationIssues, overviewSourceKey } from '../drawings/overview-presentation.js';

export class DrawingStudioError extends Error {
  constructor(code, message, issues = []) { super(message); this.name = 'DrawingStudioError'; this.code = code; this.issues = issues; }
}
const issue = (code, path, message, severity = 'error') => ({ code, path, message, severity });
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
export const copyDrawingValue = copy;
export const sameDrawingValue = same;
export const drawingPartIds = entry => (entry.model?.parts || []).map(part => part.id);

export function drawingSource(entry) {
  if (!entry?.id || !entry.package || !entry.model?.id || !entry.model?.revision) throw new DrawingStudioError('INVALID_CATALOG', 'This prepared product is missing its model or drawing version.');
  const source = normalizeDrawingPackage(entry.package, { modelRevision: entry.model.revision, partIds: drawingPartIds(entry), assetURLs: entry.assets });
  if (source.modelId !== entry.model.id || source.modelRevision !== entry.model.revision) throw new DrawingStudioError('INVALID_CATALOG', 'The drawing package and model versions do not match.');
  return source;
}

/** Mapping edits cannot replace source files, their hashes, the model or sheet coordinates. */
function sourceIdentity(pkg) {
  const { mappingRevision, pairing, sheets, assets, unplacedMappings, ...source } = pkg;
  return { ...source, assets: assets.map(({ url, ...asset }) => asset), sheets: sheets.map(({ regions, ...sheet }) => sheet) };
}
export const drawingSourceSignature = entry => {
  const pkg = drawingSource(entry);
  return studioFingerprint({ source: sourceIdentity(pkg), pairing: pkg.pairing, mappingRevision: pkg.mappingRevision, preparedRegions: pkg.sheets.map(sheet => ({ id: sheet.id, regions: sheet.regions })), ...(pkg.unplacedMappings ? { unplacedMappings: pkg.unplacedMappings } : {}) });
};
export const drawingDraftKey = entry => `${entry.id}:${drawingSourceSignature(entry)}`;
export const allDrawingMappings = pkg => pkg.sheets.flatMap(sheet => sheet.regions.map(region => ({ sheet, region })));

function withMappingRevision(draft) {
  const next = copy(draft);
  next.packageSnapshot.mappingRevision = `mapping-${studioFingerprint({ source: next.sourceSignature, pairing: next.packageSnapshot.pairing, sheets: next.packageSnapshot.sheets.map(sheet => ({ id: sheet.id, regions: sheet.regions })), ...(next.packageSnapshot.unplacedMappings ? { unplacedMappings: next.packageSnapshot.unplacedMappings } : {}) })}`;
  return next;
}
export function createDrawingDraft(entry, id) {
  const pkg = drawingSource(entry);
  return withMappingRevision({ schemaVersion: 1, id, key: drawingDraftKey(entry), productId: entry.id,
    packageId: pkg.id, sourceSignature: drawingSourceSignature(entry), revision: 0, updatedAt: null,
    packageSnapshot: pkg, ...(entry.overviewPresentation?.sourceKey === overviewSourceKey(pkg)
      ? { presentationSnapshot: normalizeOverviewPresentation(entry.overviewPresentation) } : {}) });
}
export function entryForDrawingDraft(entry, draft) {
  if (!draft?.sourceVersionId) return entry;
  if (!draft.sourcePackageSnapshot || draft.sourcePackageSnapshot.modelId !== entry.model.id || draft.sourcePackageSnapshot.modelRevision !== entry.model.revision)
    throw new DrawingStudioError('SOURCE_CHANGED', 'This imported source belongs to a different model version.');
  return { ...entry, package: draft.sourcePackageSnapshot, assets: undefined, overviewPresentation: undefined, overviewViews: [] };
}
export function assertDrawingDraft(draft, entry) {
  entry = entryForDrawingDraft(entry, draft);
  if (!draft || draft.schemaVersion !== 1 || !nonempty(draft.id) || !Number.isSafeInteger(draft.revision) || draft.revision < 0
      || draft.productId !== entry.id || draft.key !== drawingDraftKey(entry) || draft.sourceSignature !== drawingSourceSignature(entry)
      || draft.packageId !== entry.package.id || !draft.packageSnapshot?.sheets) throw new DrawingStudioError('SOURCE_CHANGED', 'This draft belongs to another source version. Reopen that version or start a draft for the current package.');
  const source = drawingSource(entry);
  if (!same(sourceIdentity(draft.packageSnapshot), sourceIdentity(source))) throw new DrawingStudioError('SOURCE_CHANGED', 'Source files, their versions and page coordinates cannot be changed in the association editor.');
  const changes = draft.regionChanges || { added: [], removed: [], removedUnplaced: [] };
  if (!['added', 'removed', 'removedUnplaced'].every(key => Array.isArray(changes[key]) && changes[key].every(value => typeof value === 'string') && new Set(changes[key]).size === changes[key].length))
    throw new DrawingStudioError('INVALID_DRAFT', 'The association change record is invalid.');
  // Existing engineering annotations remain fixed. Explicitly authored new regions
  // may contain only semantic links; no dimensions or camera poses are inferred.
  for (const sheet of source.sheets) {
    const after = draft.packageSnapshot.sheets.find(item => item.id === sheet.id);
    if (!after || new Set(after.regions.map(region => region.id)).size !== after.regions.length) throw new DrawingStudioError('SOURCE_CHANGED', 'Keep the source sheets and unique detail identifiers.');
    for (const region of sheet.regions) {
      const edited = after.regions.find(item => item.id === region.id), key = `${sheet.id}:${region.id}`;
      if (!edited) { if (!changes.removed.includes(key)) throw new DrawingStudioError('SOURCE_CHANGED', 'Remove an association explicitly before leaving it out of a release.'); continue; }
      const fixed = ({ label, partId, bounds, mappingStatus, note, camera, focusPoint, ...rest }) => rest;
      if (!same(fixed(region), fixed(edited)) || ['camera', 'focusPoint'].some(key => edited[key] !== undefined && !same(edited[key], region[key])))
        throw new DrawingStudioError('SOURCE_CHANGED', 'Prepared engineering references cannot be replaced here.');
    }
    for (const region of after.regions) if (!sheet.regions.some(item => item.id === region.id)) {
      if (!changes.added.includes(`${sheet.id}:${region.id}`) || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(region.id)
          || Object.keys(region).some(key => !['id', 'label', 'partId', 'bounds', 'mappingStatus', 'note'].includes(key)))
        throw new DrawingStudioError('SOURCE_CHANGED', 'Create new drawing associations explicitly with a stable identifier.');
    }
  }
  const originalUnplaced = source.unplacedMappings || [], currentUnplaced = draft.packageSnapshot.unplacedMappings || [];
  if (currentUnplaced.some(item => !originalUnplaced.some(original => same(item, original)))
      || originalUnplaced.some(item => !currentUnplaced.some(next => next.id === item.id) && !changes.removedUnplaced.includes(item.id)))
    throw new DrawingStudioError('SOURCE_CHANGED', 'Resolve or remove unplaced associations explicitly.');
  const resolved = copy(draft);
  resolved.packageSnapshot.assets = copy(source.assets);
  // Presentation is separately versioned content, never part of engineering
  // source identity. Older drafts gain the preserved bundled baseline in memory;
  // historical releases are never rewritten during this migration.
  const presentation = resolved.presentationSnapshot !== undefined ? resolved.presentationSnapshot
    : (entry.overviewPresentation?.sourceKey === overviewSourceKey(resolved.packageSnapshot) ? entry.overviewPresentation : undefined);
  if (presentation !== undefined && presentation !== null) {
    try { resolved.presentationSnapshot = normalizeOverviewPresentation(presentation); }
    catch (error) { throw new DrawingStudioError('INVALID_PRESENTATION', error.message); }
    if (resolved.presentationSnapshot.sourceKey !== overviewSourceKey(resolved.packageSnapshot))
      throw new DrawingStudioError('SOURCE_CHANGED', 'This overview belongs to another original drawing. Prepare or select views for the current source version.');
  }
  return withMappingRevision(resolved);
}

export function drawingMappingIssues(pkg, sheetId, region, partIds) {
  const sheet = pkg.sheets.find(item => item.id === sheetId), path = `sheets.${sheetId}.regions.${region?.id || 'unknown'}`;
  const issues = [];
  if (!sheet) return [issue('MISSING_SHEET', path, 'Choose a sheet from this drawing package.')];
  if (!nonempty(region.label)) issues.push(issue('MISSING_LABEL', `${path}.label`, 'Name the detail so a customer can recognize it.'));
  if (!partIds.includes(region.partId)) issues.push(issue('MISSING_PART', `${path}.partId`, 'Choose a part from this exact model version.'));
  const [x, y, w, h] = region.bounds || [], [sx, sy, sw, sh] = sheet.viewBox;
  if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0 || x < sx || y < sy || x + w > sx + sw + 0.001 || y + h > sy + sh + 0.001)
    issues.push(issue('INVALID_BOUNDS', `${path}.bounds`, 'Keep the region inside the page, with a positive width and height.'));
  return issues;
}

/** Changes are staged explicitly; only Confirm mapping can mark a changed region confirmed. */
export function updateDrawingMapping(draft, entry, sheetId, regionId, patch, { confirm = false } = {}) {
  const next = assertDrawingDraft(draft, entry), sheet = next.packageSnapshot.sheets.find(item => item.id === sheetId);
  const region = sheet?.regions.find(item => item.id === regionId);
  if (!region) throw new DrawingStudioError('NOT_FOUND', 'This drawing region is no longer available.');
  if (Object.hasOwn(patch, 'partId') && patch.partId !== region.partId || Object.hasOwn(patch, 'bounds') && !same(patch.bounds, region.bounds)) { delete region.camera; delete region.focusPoint; }
  for (const key of ['label', 'partId', 'bounds', 'note']) if (Object.hasOwn(patch, key)) region[key] = copy(patch[key]);
  region.mappingStatus = confirm ? 'confirmed' : (!region.bounds || patch.mappingStatus === 'missing' ? 'missing' : 'needs-review');
  if (confirm) {
    const issues = drawingMappingIssues(next.packageSnapshot, sheetId, region, drawingPartIds(entry));
    if (issues.length) throw new DrawingStudioError('VALIDATION', 'Review the region and linked part before confirming.', issues);
  }
  return withMappingRevision(next);
}
export function confirmDrawingPairing(draft, entry, evidence) {
  const next = assertDrawingDraft(draft, entry);
  if (!nonempty(evidence) || evidence.trim().length < 12) throw new DrawingStudioError('VALIDATION', 'Describe how you checked that the model and drawing share the same source version.');
  next.packageSnapshot.pairing = { status: 'human-confirmed', evidence: evidence.trim() };
  return withMappingRevision(next);
}

export function drawingReleaseIssues(draft, entry) {
  try {
    const normalized = assertDrawingDraft(draft, entry);
    const pkg = normalized.packageSnapshot, issues = [];
    for (const { sheet, region } of allDrawingMappings(pkg)) {
      issues.push(...drawingMappingIssues(pkg, sheet.id, region, drawingPartIds(entry)));
      if (region.mappingStatus !== 'confirmed') issues.push(issue('UNCONFIRMED_MAPPING', `sheets.${sheet.id}.regions.${region.id}`, `Confirm the association for “${region.label || region.id}” before publishing.`));
    }
    if (pkg.unplacedMappings?.length) issues.push(issue('UNPLACED_MAPPINGS', 'unplacedMappings', 'Place or explicitly remove the associations whose original pages are missing.'));
    if (!allDrawingMappings(pkg).length) issues.push(issue('MISSING_MAPPINGS', 'sheets', 'Add prepared feature regions before publishing this package.'));
    if (!['source-derived', 'human-confirmed'].includes(pkg.pairing?.status) || !nonempty(pkg.pairing?.evidence))
      issues.push(issue('UNVERIFIED_PAIRING', 'pairing', 'Verify that the model and drawing come from the same source version.'));
    try { issues.push(...releaseDiagnostic(pkg, { partIds: drawingPartIds(entry), modelRevision: entry.model.revision }).issues); }
    catch (error) { issues.push(...(error.issues?.length ? error.issues : [issue(error.code || 'INVALID_PACKAGE', 'packageSnapshot', error.message)])); }
    if (normalized.presentationSnapshot) issues.push(...overviewPresentationIssues(normalized.presentationSnapshot, pkg,
      entryForDrawingDraft(entry, normalized).overviewViews, { requireConfirmed: true }));
    return [...new Map(issues.map(item => [`${item.code}:${item.path}`, item])).values()];
  } catch (error) { return [issue(error.code || 'INVALID_DRAFT', 'packageSnapshot', error.message)]; }
}
export function createDrawingReview(draft, entry, baseReleaseId = null) {
  const normalized = assertDrawingDraft(draft, entry), issues = drawingReleaseIssues(normalized, entry);
  if (issues.some(item => item.severity === 'error')) throw new DrawingStudioError('VALIDATION', 'Resolve the highlighted associations before reviewing a release. Your draft is saved.', issues);
  return { schemaVersion: 1, kind: 'annora-drawing-review', draft: normalized, baseReleaseId,
    token: `drawing-review-${studioFingerprint({ draft: normalized, baseReleaseId })}`, issues };
}

export function drawingMappingSummary(pkg) {
  const rows = allDrawingMappings(pkg);
  return { total: rows.length, confirmed: rows.filter(({ region }) => region.mappingStatus === 'confirmed').length,
    needsReview: rows.filter(({ region }) => region.mappingStatus === 'needs-review').length,
    missing: rows.filter(({ region }) => region.mappingStatus === 'missing' || !region.partId).length };
}

/** Document/model identity and authored associations are compared independently from quote versions. */
export function compareDrawingPackages(before, after, { parts = [] } = {}) {
  if (!before || !after) return { available: false, sourceChanges: [], associationChanges: [], associationCount: 0, sourceFilesUnchanged: false };
  const sourceChanges = [], associationChanges = [], changedAssociations = new Set();
  const add = (rows, label, left, right) => { if (!same(left, right)) rows.push({ label, before: left ?? 'Not present', after: right ?? 'Not present', changed: true }); };
  const fileIdentity = pkg => pkg.assets.map(({ id, kind, file, sha256 }) => ({ id, kind, file, sha256 })).sort((a, b) => a.id.localeCompare(b.id));
  const leftFiles = fileIdentity(before), rightFiles = fileIdentity(after), sourceFilesUnchanged = same(leftFiles, rightFiles);
  add(sourceChanges, 'Drawing source version', before.revision, after.revision);
  add(sourceChanges, 'Model version', before.modelRevision, after.modelRevision);
  for (const id of new Set([...leftFiles, ...rightFiles].map(asset => asset.id))) {
    const left = leftFiles.find(asset => asset.id === id), right = rightFiles.find(asset => asset.id === id);
    if (!same(left, right)) add(sourceChanges, `Source file · ${right?.file || left?.file}`, left ? `${left.kind.toUpperCase()} · SHA-256 ${left.sha256}` : null, right ? `${right.kind.toUpperCase()} · SHA-256 ${right.sha256}` : null);
  }
  const sheetIdentity = sheet => sheet ? JSON.stringify({ asset: sheet.assetId, page: sheet.pdfPage || 1, bounds: sheet.viewBox, rotation: sheet.rotation }) : null;
  for (const id of new Set([...before.sheets, ...after.sheets].map(sheet => sheet.id))) {
    const left = before.sheets.find(sheet => sheet.id === id), right = after.sheets.find(sheet => sheet.id === id);
    add(sourceChanges, `${right?.title || left?.title} · sheet reference`, sheetIdentity(left), sheetIdentity(right));
  }
  const leftMappings = new Map(allDrawingMappings(before).map(({ sheet, region }) => [`${sheet.id}:${region.id}`, region]));
  const rightMappings = new Map(allDrawingMappings(after).map(({ sheet, region }) => [`${sheet.id}:${region.id}`, region]));
  const partName = id => parts.find(part => part.id === id)?.title || id || 'Not linked';
  const bounds = values => values?.length === 4 ? values.map((value, index) => `${['left', 'top', 'width', 'height'][index]} ${value}`).join(' · ') : 'Not set';
  const states = { confirmed: 'Confirmed', 'needs-review': 'Needs review', missing: 'Not linked' };
  for (const id of new Set([...leftMappings.keys(), ...rightMappings.keys()])) {
    const left = leftMappings.get(id), right = rightMappings.get(id), title = right?.label || left?.label || id;
    if (!left || !right) { add(associationChanges, title, left ? 'Association present' : null, right ? 'Association present' : null); changedAssociations.add(id); continue; }
    for (const [key, label, display] of [['label', 'detail name', value => value], ['partId', 'linked part', partName], ['bounds', 'page region', bounds], ['mappingStatus', 'confirmation', value => states[value] || value], ['note', 'note', value => value || 'No note']]) {
      if (!same(left[key] ?? null, right[key] ?? null)) { add(associationChanges, `${title} · ${label}`, display(left[key]), display(right[key])); changedAssociations.add(id); }
    }
  }
  add(associationChanges, 'Source pairing evidence', before.pairing?.evidence, after.pairing?.evidence);
  add(associationChanges, 'Source pairing status', before.pairing?.status, after.pairing?.status);
  return { available: true, sourceChanges, associationChanges, associationCount: changedAssociations.size, sourceFilesUnchanged };
}

const regionChanges = draft => draft.regionChanges ||= { added: [], removed: [], removedUnplaced: [] };
export function addDrawingMapping(draft, entry, sheetId, input = {}) {
  const next = assertDrawingDraft(draft, entry), sheet = next.packageSnapshot.sheets.find(item => item.id === sheetId);
  if (!sheet) throw new DrawingStudioError('NOT_FOUND', 'Choose a current drawing sheet before adding a detail.');
  const unplaced = input.fromUnplacedId && next.packageSnapshot.unplacedMappings?.find(item => item.id === input.fromUnplacedId);
  if (input.fromUnplacedId && !unplaced) throw new DrawingStudioError('NOT_FOUND', 'This unplaced association is no longer available.');
  const id = input.id || unplaced?.region.id || `detail-${globalThis.crypto.randomUUID()}`, key = `${sheetId}:${id}`;
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(id) || sheet.regions.some(region => region.id === id) || regionChanges(next).removed.includes(key))
    throw new DrawingStudioError('DUPLICATE_REGION', 'Use a new unique detail identifier. Removed identifiers are kept for history.');
  const partId = input.partId ?? unplaced?.region.partId ?? null;
  sheet.regions.push({ id, label: input.label || unplaced?.region.label || 'New drawing detail', partId,
    bounds: input.bounds ? copy(input.bounds) : null, mappingStatus: input.bounds && drawingPartIds(entry).includes(partId) ? 'needs-review' : 'missing',
    ...(input.note ? { note: input.note } : {}) });
  regionChanges(next).added.push(key);
  if (unplaced) { next.packageSnapshot.unplacedMappings = next.packageSnapshot.unplacedMappings.filter(item => item.id !== unplaced.id); regionChanges(next).removedUnplaced.push(unplaced.id); }
  return withMappingRevision(next);
}
export function removeDrawingMapping(draft, entry, sheetId, regionId) {
  const next = assertDrawingDraft(draft, entry), sheet = next.packageSnapshot.sheets.find(item => item.id === sheetId);
  if (!sheet?.regions.some(region => region.id === regionId)) throw new DrawingStudioError('NOT_FOUND', 'This drawing association is no longer available.');
  sheet.regions = sheet.regions.filter(region => region.id !== regionId);
  regionChanges(next).removed.push(`${sheetId}:${regionId}`);
  return withMappingRevision(next);
}
export function removeUnplacedDrawingMapping(draft, entry, id) {
  const next = assertDrawingDraft(draft, entry);
  if (!next.packageSnapshot.unplacedMappings?.some(item => item.id === id)) throw new DrawingStudioError('NOT_FOUND', 'This unplaced association is no longer available.');
  next.packageSnapshot.unplacedMappings = next.packageSnapshot.unplacedMappings.filter(item => item.id !== id);
  regionChanges(next).removedUnplaced.push(id);
  return withMappingRevision(next);
}

export function createImportedDrawingSource(entry, basePackage, imported, { revisionLabel, sourceVersionId, importedAt } = {}) {
  const base = normalizeDrawingPackage(basePackage), asset = copy(imported.asset), parts = drawingPartIds(entry);
  if (base.modelId !== entry.model.id || base.modelRevision !== entry.model.revision || asset.kind !== 'pdf' || !/^sha256:[a-f0-9]{64}$/.test(asset.localBlobKey || '')
      || asset.localBlobKey !== `sha256:${asset.sha256}` || !Array.isArray(imported.pages) || !imported.pages.length)
    throw new DrawingStudioError('INVALID_IMPORT', 'The inspected PDF and exact configured model are required to create a source version.');
  const warnings = [], usedSheets = new Set(), label = String(revisionLabel || 'Imported PDF').trim().slice(0, 120);
  const sheets = imported.pages.map(page => {
    const original = base.sheets.find(sheet => (sheet.pdfPage || 1) === page.pageNumber && !usedSheets.has(sheet.id));
    if (original) usedSheets.add(original.id);
    const viewBox = [0, 0, page.width, page.height];
    if (!Number.isInteger(page.pageNumber) || page.pageNumber < 1 || ![page.width, page.height].every(value => Number.isFinite(value) && value > 0 && value <= 14400))
      throw new DrawingStudioError('INVALID_PDF_PAGE', 'A source page has invalid or unsupported dimensions.');
    const regions = (original?.regions || []).map(region => {
      const rect = region.bounds, fits = Array.isArray(rect) && rect.every(Number.isFinite) && rect[0] >= 0 && rect[1] >= 0 && rect[2] > 0 && rect[3] > 0 && rect[0] + rect[2] <= page.width && rect[1] + rect[3] <= page.height;
      const validPart = parts.includes(region.partId);
      if (!fits) warnings.push(`“${region.label}” needs a new region on page ${page.pageNumber}; its earlier bounds do not fit.`);
      return { id: region.id, label: region.label, partId: validPart ? region.partId : null, bounds: fits ? copy(rect) : null,
        mappingStatus: fits && validPart ? 'needs-review' : 'missing', ...(region.note ? { note: region.note } : {}),
        ...(validPart && region.camera ? { camera: copy(region.camera) } : {}), ...(validPart && region.focusPoint ? { focusPoint: copy(region.focusPoint) } : {}) };
    });
    return { id: original?.id || `sheet-${page.pageNumber}`, title: `Page ${page.pageNumber}`, assetId: asset.id, format: 'pdf', pdfPage: page.pageNumber,
      viewBox, coordinateFrame: 'page-top-left', rotation: 0, regions };
  });
  const unplaced = [...copy(base.unplacedMappings || [])];
  for (const sheet of base.sheets.filter(sheet => !usedSheets.has(sheet.id))) for (const region of sheet.regions) {
    unplaced.push({ id: `${sheet.id}:${region.id}`, sheetId: sheet.id, sheetTitle: sheet.title, region: { id: region.id, label: region.label, partId: parts.includes(region.partId) ? region.partId : null, bounds: null, mappingStatus: 'missing' } });
  }
  if (unplaced.length) warnings.push(`${unplaced.length} association${unplaced.length === 1 ? '' : 's'} came from a page that is not present. Place or remove them explicitly.`);
  const pkg = { ...copy(base), revision: `pdf-${asset.sha256}`, revisionLabel: label, manufacturerRevision: null, assetRevision: asset.sha256,
    title: `${entry.package.title} — ${label}`, mappingRevision: `unreviewed-${asset.sha256.slice(0, 16)}`, pdfFile: asset.file,
    status: 'unreviewed-reference', statusLabel: 'Imported PDF · needs review', statusNote: 'User-imported reference drawing. Associations and model pairing require human review; no manufacturing approval is inferred.',
    sourceOrigin: { kind: 'local-pdf', sourceVersionId, fileName: imported.fileName, sha256: asset.sha256, importedAt, baseSourceRevision: base.revision },
    pairing: { status: 'unverified', evidence: 'A new PDF was imported for this exact model. Check the original document, part links and page regions before confirming their pairing.' },
    assets: [...base.assets.filter(item => item.kind === 'step').map(item => { const result = copy(item); return result; }), asset], sheets, unplacedMappings: unplaced };
  return { schemaVersion: 1, id: sourceVersionId, productId: entry.id, kind: 'local-pdf', label, revision: pkg.revision, modelRevision: entry.model.revision,
    createdAt: importedAt, packageSnapshot: normalizeDrawingPackage(pkg), importWarnings: warnings };
}

export function createSourceDrawingDraft(entry, sourceVersion, id) {
  const sourceEntry = { ...entry, package: sourceVersion.packageSnapshot, assets: undefined, overviewPresentation: undefined, overviewViews: [] };
  return { ...createDrawingDraft(sourceEntry, id), sourceVersionId: sourceVersion.id, sourcePackageSnapshot: copy(sourceVersion.packageSnapshot),
    importWarnings: copy(sourceVersion.importWarnings || []), regionChanges: { added: [], removed: [], removedUnplaced: [] } };
}
