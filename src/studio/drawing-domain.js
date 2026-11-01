import { normalizeDrawingPackage, releaseDiagnostic } from '../drawings/package.js';
import { copyStudioValue as copy, sameStudioValue as same, studioFingerprint } from './value.js';

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
  const { mappingRevision, pairing, sheets, assets, ...source } = pkg;
  return { ...source, assets: assets.map(({ url, ...asset }) => asset), sheets: sheets.map(({ regions, ...sheet }) => sheet) };
}
export const drawingSourceSignature = entry => {
  const pkg = drawingSource(entry);
  return studioFingerprint({ source: sourceIdentity(pkg), pairing: pkg.pairing, mappingRevision: pkg.mappingRevision, preparedRegions: pkg.sheets.map(sheet => ({ id: sheet.id, regions: sheet.regions })) });
};
export const drawingDraftKey = entry => `${entry.id}:${drawingSourceSignature(entry)}`;
export const allDrawingMappings = pkg => pkg.sheets.flatMap(sheet => sheet.regions.map(region => ({ sheet, region })));

function withMappingRevision(draft) {
  const next = copy(draft);
  next.packageSnapshot.mappingRevision = `mapping-${studioFingerprint({ source: next.sourceSignature, pairing: next.packageSnapshot.pairing, sheets: next.packageSnapshot.sheets.map(sheet => ({ id: sheet.id, regions: sheet.regions })) })}`;
  return next;
}
export function createDrawingDraft(entry, id) {
  const pkg = drawingSource(entry);
  return withMappingRevision({ schemaVersion: 1, id, key: drawingDraftKey(entry), productId: entry.id,
    packageId: pkg.id, sourceSignature: drawingSourceSignature(entry), revision: 0, updatedAt: null,
    packageSnapshot: pkg });
}
export function assertDrawingDraft(draft, entry) {
  if (!draft || draft.schemaVersion !== 1 || !nonempty(draft.id) || !Number.isSafeInteger(draft.revision) || draft.revision < 0
      || draft.productId !== entry.id || draft.key !== drawingDraftKey(entry) || draft.sourceSignature !== drawingSourceSignature(entry)
      || draft.packageId !== entry.package.id || !draft.packageSnapshot?.sheets) throw new DrawingStudioError('SOURCE_CHANGED', 'This draft belongs to another source version. Reopen that version or start a draft for the current package.');
  const source = drawingSource(entry);
  if (!same(sourceIdentity(draft.packageSnapshot), sourceIdentity(source))) throw new DrawingStudioError('SOURCE_CHANGED', 'Source files, their versions and page coordinates cannot be changed in the association editor.');
  // Prepared feature identities and engineering annotations stay attached to the source.
  for (const sheet of source.sheets) {
    const after = draft.packageSnapshot.sheets.find(item => item.id === sheet.id);
    if (!after || after.regions.length !== sheet.regions.length) throw new DrawingStudioError('SOURCE_CHANGED', 'Keep every prepared drawing region. Mark an unresolved region as needing review.');
    for (const region of sheet.regions) {
      const edited = after.regions.find(item => item.id === region.id);
      const fixed = ({ label, partId, bounds, mappingStatus, note, ...rest }) => rest;
      if (!edited || !same(fixed(region), fixed(edited))) throw new DrawingStudioError('SOURCE_CHANGED', 'Prepared feature identifiers and engineering references cannot be replaced here.');
    }
  }
  const resolved = copy(draft);
  resolved.packageSnapshot.assets = copy(source.assets);
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
  for (const key of ['label', 'partId', 'bounds', 'note']) if (Object.hasOwn(patch, key)) region[key] = copy(patch[key]);
  region.mappingStatus = confirm ? 'confirmed' : (patch.mappingStatus === 'missing' ? 'missing' : 'needs-review');
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
    assertDrawingDraft(draft, entry);
    const pkg = draft.packageSnapshot, issues = [];
    for (const { sheet, region } of allDrawingMappings(pkg)) {
      issues.push(...drawingMappingIssues(pkg, sheet.id, region, drawingPartIds(entry)));
      if (region.mappingStatus !== 'confirmed') issues.push(issue('UNCONFIRMED_MAPPING', `sheets.${sheet.id}.regions.${region.id}`, `Confirm the association for “${region.label || region.id}” before publishing.`));
    }
    if (!allDrawingMappings(pkg).length) issues.push(issue('MISSING_MAPPINGS', 'sheets', 'Add prepared feature regions before publishing this package.'));
    if (!['source-derived', 'human-confirmed'].includes(pkg.pairing?.status) || !nonempty(pkg.pairing?.evidence))
      issues.push(issue('UNVERIFIED_PAIRING', 'pairing', 'Verify that the model and drawing come from the same source version.'));
    try { issues.push(...releaseDiagnostic(pkg, { partIds: drawingPartIds(entry), modelRevision: entry.model.revision }).issues); }
    catch (error) { issues.push(...(error.issues?.length ? error.issues : [issue(error.code || 'INVALID_PACKAGE', 'packageSnapshot', error.message)])); }
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
