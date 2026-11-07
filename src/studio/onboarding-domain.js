import { normalizeDrawingPackage, releaseDiagnostic } from '../drawings/package.js';
import { normalizeInquiryProfile } from '../product-room/inquiry-profile.js';
import { validateStudioDraft } from './domain.js';
import { copyStudioValue as copy, sameStudioValue as same, studioFingerprint, profileVersion } from './value.js';

export const ONBOARDING_SCHEMA_VERSION = 1;
export class OnboardingError extends Error {
  constructor(code, message, issues = []) { super(message); this.name = 'OnboardingError'; this.code = code; this.issues = issues; }
}
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const safeId = value => nonempty(value) && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(value) && !value.includes('..');
const safePath = value => nonempty(value) && !value.startsWith('/') && !/[\\?#\u0000-\u001f]/.test(value) && value.split('/').every(piece => piece && piece !== '.' && piece !== '..');
const check = (condition, code, message) => { if (!condition) throw new OnboardingError(code, message); };
const frozen = value => { if (value && typeof value === 'object') { Object.values(value).forEach(frozen); Object.freeze(value); } return value; };
const cleanAssets = assets => (assets || []).map(({ url, ...asset }) => asset);
const portableDrawing = input => input ? { ...normalizeDrawingPackage(input), assets: cleanAssets(normalizeDrawingPackage(input).assets) } : null;
const sourceRegions = pkg => pkg?.sheets.map(sheet => ({ ...sheet, regions: sheet.regions.map(({ partId, mappingStatus, camera, focusPoint, ...region }) => region) }));
const fixedDrawingSource = pkg => {
  if (!pkg) return null;
  const { mappingRevision, sheets, ...source } = portableDrawing(pkg);
  return { ...source, sheets: sourceRegions({ sheets }) };
};
const baseDrawing = candidate => portableDrawing(candidate?.drawingPackages?.[0] || null);
const editableContent = new Set(['title', 'shortTitle', 'summary']);
const fixedContent = content => Object.fromEntries(Object.entries(content || {}).filter(([key]) => !editableContent.has(key)));
const portableContent = content => ({ ...copy(content), documents: (content.documents || []).map(({ url, ...document }) => copy(document)) });
const sourceAssets = candidate => cleanAssets(candidate.assets).map(({ id, revision, type, sha256, fileName }) => ({ id, revision, type, ...(sha256 ? { sha256 } : {}), fileName }));
function candidateSource(candidate) {
  check(object(candidate) && safeId(candidate.id) && candidate.model?.id === candidate.id && nonempty(candidate.model.revision), 'INVALID_CANDIDATE', 'Choose a prepared product with a stable model identity.');
  check(safePath(candidate.modelManifest) && candidate.modelManifest.startsWith('content/models/'), 'INVALID_CANDIDATE', 'The prepared model manifest must stay inside content/models.');
  check(candidate.drawingDirectory == null || safePath(candidate.drawingDirectory) && candidate.drawingDirectory.startsWith('content/drawings/'), 'INVALID_CANDIDATE', 'The drawing directory must stay inside content/drawings.');
  check(Array.isArray(candidate.parts) && candidate.parts.length > 0 && candidate.parts.every(part => safeId(part.id)) && new Set(candidate.parts.map(part => part.id)).size === candidate.parts.length, 'INVALID_CANDIDATE', 'Prepare unique part identities before onboarding.');
  check(!candidate.drawingPackages || candidate.drawingPackages.length <= 1, 'UNSUPPORTED_INPUT', 'Prepare one drawing package per onboarding candidate. Additional source versions use the existing drawing revision workflow.');
  const drawing = baseDrawing(candidate);
  check(!drawing || drawing.modelId === candidate.id && drawing.modelRevision === candidate.model.revision && candidate.drawingDirectory, 'SOURCE_CHANGED', 'The prepared drawing and model must share the exact revision.');
  return { productId: candidate.id, modelId: candidate.model.id, modelRevision: candidate.model.revision,
    modelManifest: candidate.modelManifest, drawingDirectory: candidate.drawingDirectory || null,
    parts: candidate.parts.map(({ id, title, parentId }) => ({ id, title, parentId: parentId || null })),
    source: copy(candidate.source || {}), units: copy(candidate.units || {}), assets: sourceAssets(candidate), drawing: fixedDrawingSource(drawing) };
}

/** Drawing readers resolve source geometry, not the Explorer's grouping nodes. */
export function onboardingDrawingParts(candidate) {
  const parts = candidate?.parts || [], parents = new Set(parts.map(part => part.parentId).filter(Boolean));
  const allowed = new Set(candidate?.drawingPartIds || parts.filter(part => part.parentId && !parents.has(part.id)).map(part => part.id));
  return parts.filter(part => allowed.has(part.id));
}

/** A change identifier, not an authentication signature. Build-specific asset URLs are excluded. */
export const onboardingCandidateFingerprint = candidate => `candidate-${studioFingerprint(candidateSource(candidate))}`;
function mappedDrawing(input, candidate) {
  const baseline = baseDrawing(candidate), pkg = portableDrawing(input);
  check(Boolean(pkg) === Boolean(baseline) && same(fixedDrawingSource(pkg), fixedDrawingSource(baseline)), 'SOURCE_CHANGED', 'Keep the prepared source files, hashes, pages, regions and engineering annotations unchanged.');
  if (!pkg) return null;
  for (const sheet of pkg.sheets) for (const region of sheet.regions) {
    const original = baseline.sheets.find(item => item.id === sheet.id)?.regions.find(item => item.id === region.id);
    check(original, 'SOURCE_CHANGED', 'Use a region from the exact prepared drawing.');
    // A camera authored for one component cannot silently follow a new binding.
    if (region.partId !== original.partId) { delete region.camera; delete region.focusPoint; }
    for (const key of ['camera', 'focusPoint']) check(region[key] === undefined || same(region[key], original[key]), 'SOURCE_CHANGED', 'Keep authored model-space detail views unchanged.');
  }
  pkg.mappingRevision = `onboarding-map-${studioFingerprint({ source: fixedDrawingSource(pkg), mappings: pkg.sheets.map(sheet => ({ id: sheet.id, regions: sheet.regions })) })}`;
  return pkg;
}

/** Incomplete copy and unconfirmed mappings can be saved; source identity cannot be edited. */
export function normalizeOnboardingDraft(input, candidate) {
  const candidateFingerprint = onboardingCandidateFingerprint(candidate);
  check(object(input) && input.schemaVersion === ONBOARDING_SCHEMA_VERSION && safeId(input.id)
    && Number.isSafeInteger(input.revision) && input.revision >= 0 && input.productId === candidate.id
    && input.modelRevision === candidate.model.revision && input.candidateFingerprint === candidateFingerprint,
  'SOURCE_CHANGED', 'This onboarding draft belongs to another prepared source. Reopen its original candidate; saved records have not changed.');
  check(JSON.stringify(input).length <= 750000, 'INVALID_DRAFT', 'Keep the reviewed product package within the supported size.');
  check(object(input.content) && object(input.checks) && typeof input.checks.source === 'boolean' && typeof input.checks.units === 'boolean', 'INVALID_DRAFT', 'The product information and source checks are incomplete.');
  const content = portableContent(input.content), seed = portableContent(candidate.bundledRelease.content);
  check(same(fixedContent(content), fixedContent(seed)), 'SOURCE_CHANGED', 'Only the product title, short title and summary are editable during intake. Keep source claims and managed document identities unchanged.');
  for (const key of editableContent) check(typeof content[key] === 'string' && content[key].length <= (key === 'shortTitle' ? 60 : 180), 'INVALID_DRAFT', 'Keep product copy within its supported length.');
  const inquiryProfile = normalizeInquiryProfile(input.inquiryProfile);
  check(inquiryProfile.id === candidate.inquiryProfile.id, 'INVALID_DRAFT', 'Keep this candidate’s inquiry profile identity.');
  inquiryProfile.version = profileVersion(inquiryProfile.fields);
  check(object(input.presentation) && ['engineering','linework','flat'].includes(input.presentation.defaultRenderStyle)
    && Object.keys(input.presentation).every(key => key === 'defaultRenderStyle'), 'INVALID_DRAFT', 'Choose a prepared display style. Technical story steps are rebuilt from the reviewed drawing associations.');
  const drawingPackage = mappedDrawing(input.drawingPackage, candidate);
  check(input.updatedAt == null || typeof input.updatedAt === 'string' && Number.isFinite(Date.parse(input.updatedAt)), 'INVALID_DRAFT', 'The saved draft date is invalid.');
  return { schemaVersion: ONBOARDING_SCHEMA_VERSION, id: input.id, revision: input.revision, updatedAt: input.updatedAt || null,
    productId: candidate.id, modelRevision: candidate.model.revision, candidateFingerprint,
    checks: { source: input.checks.source, units: input.checks.units }, content, inquiryProfile,
    presentation: { defaultRenderStyle: input.presentation.defaultRenderStyle }, drawingPackage };
}

export function createOnboardingDraft(candidate, { id = `ONBOARD-DRAFT-${studioFingerprint(candidateSource(candidate))}` } = {}) {
  const drawingPackage = baseDrawing(candidate);
  if (drawingPackage) for (const sheet of drawingPackage.sheets) for (const region of sheet.regions) region.mappingStatus = 'needs-review';
  return normalizeOnboardingDraft({ schemaVersion: ONBOARDING_SCHEMA_VERSION, id, revision: 0, updatedAt: null,
    productId: candidate.id, modelRevision: candidate.model.revision, candidateFingerprint: onboardingCandidateFingerprint(candidate),
    checks: { source: false, units: false }, content: portableContent(candidate.bundledRelease.content),
    inquiryProfile: copy(candidate.inquiryProfile), presentation: { defaultRenderStyle: candidate.bundledRelease.presentation?.defaultRenderStyle || 'engineering' }, drawingPackage }, candidate);
}

export function validateOnboardingDraft(input, candidate) {
  let draft;
  try { draft = normalizeOnboardingDraft(input, candidate); }
  catch (error) { return [{ code: error.code || 'INVALID_DRAFT', path: 'draft', section: 'sources', message: error.message, severity: 'error' }]; }
  const issues = [], add = (code, path, message, section = 'sources', severity = 'error') => issues.push({ code, path, section, message, severity });
  if (!draft.checks.source) add('SOURCE_REVIEW_REQUIRED', 'checks.source', 'Review the source, redistribution license and supplied files.');
  if (!draft.checks.units) add('UNITS_REVIEW_REQUIRED', 'checks.units', 'Check the source-to-display units against the preparation evidence.');
  if (!nonempty(candidate.source?.license) || !nonempty(candidate.source?.author) || !nonempty(candidate.source?.url)) add('SOURCE_INCOMPLETE', 'source', 'Add the source author, license and public source link in the prepared candidate.');
  if (!nonempty(candidate.units?.source) || !nonempty(candidate.units?.display) || !nonempty(candidate.units?.evidence) || ['unknown','unverified'].includes(candidate.units.source)) add('UNITS_UNCONFIRMED', 'units', 'Document verified source units, display units and the conversion evidence.');
  for (const warning of candidate.readiness?.issues || []) {
    if (warning.severity === 'error' && ['viewer','source'].includes(warning.area)) add(warning.code, warning.path, warning.message);
  }
  if (draft.drawingPackage) {
    const diagnostic = releaseDiagnostic(draft.drawingPackage, { partIds: onboardingDrawingParts(candidate).map(part => part.id), modelRevision: candidate.model.revision });
    for (const problem of diagnostic.issues) add(problem.code, `drawingPackage.${problem.path}`, problem.message, 'associations', problem.severity);
    for (const asset of draft.drawingPackage.assets.filter(asset => ['pdf','svg'].includes(asset.kind))) {
      if (!candidate.assets.some(item => item.id === asset.id && item.sha256 === asset.sha256 && item.url)) add('SOURCE_ASSET_MISSING', `drawingPackage.assets.${asset.id}`, 'Include the exact original drawing file in this candidate.', 'sources');
    }
  } else add('NO_DRAWING', 'drawingPackage', 'No drawing is supplied. This product can use 3D inspection; technical drawing steps stay unavailable.', 'associations', 'info');
  // Product content uses the existing commercial validation. Intake does not
  // invent technical steps; the reviewed associations materialize them later.
  const product = { ...candidate, technicalReferences: [] };
  const contentIssues = validateStudioDraft({ ...draft, presentation: draft.presentation }, { product });
  for (const problem of contentIssues) issues.push({ code: 'PRODUCT_CONTENT', ...problem, section: problem.path.startsWith('content.') || problem.path.startsWith('inquiry') ? 'sources' : 'preview' });
  return issues;
}

export function buildOnboardingPreview(input, candidate) {
  const draft = normalizeOnboardingDraft(input, candidate), issues = validateOnboardingDraft(draft, candidate);
  if (issues.some(issue => issue.severity === 'error')) throw new OnboardingError('VALIDATION', 'Resolve the source checks and associations before previewing the complete product.', issues);
  const fingerprint = `preview-${studioFingerprint(draft)}`;
  return frozen({ schemaVersion: ONBOARDING_SCHEMA_VERSION, kind: 'annora-onboarding-preview', id: `ONBOARD-PREVIEW-${studioFingerprint(draft)}`,
    fingerprint, draftId: draft.id, draftRevision: draft.revision, candidateFingerprint: draft.candidateFingerprint,
    productId: draft.productId, modelRevision: draft.modelRevision, draft: copy(draft),
    drawingPackage: copy(draft.drawingPackage), content: copy(draft.content), inquiryProfile: copy(draft.inquiryProfile), presentation: copy(draft.presentation) });
}

export function createOnboardingReview(input, preview, candidate) {
  const draft = normalizeOnboardingDraft(input, candidate), expected = buildOnboardingPreview(draft, candidate);
  check(same(expected, preview), 'STALE_PREVIEW', 'The product changed after preview. Open the current saved version before reviewing it.');
  const summary = [
    { label: 'Product', value: draft.content.title },
    { label: 'Model version', value: draft.modelRevision },
    { label: 'Drawing associations', value: String(draft.drawingPackage?.sheets.reduce((total, sheet) => total + sheet.regions.length, 0) || 0) },
    { label: 'Delivery', value: 'Reviewed configuration export; deployment is a separate build step.' },
  ];
  const payload = { schemaVersion: ONBOARDING_SCHEMA_VERSION, kind: 'annora-onboarding-review', productId: draft.productId,
    modelRevision: draft.modelRevision, candidateFingerprint: draft.candidateFingerprint, draft, preview: copy(preview), summary,
    issues: validateOnboardingDraft(draft, candidate).filter(issue => issue.severity !== 'error') };
  return frozen({ ...payload, token: `onboarding-review-${studioFingerprint(payload)}` });
}

export function createOnboardingPackage(review, candidate, { id, createdAt }) {
  const expected = createOnboardingReview(review?.draft, review?.preview, candidate);
  check(same(expected, review), 'STALE_REVIEW', 'Review the complete current product before exporting it.');
  const packet = { schemaVersion: ONBOARDING_SCHEMA_VERSION, kind: 'annora-onboarding-package', source: 'demo', id, createdAt,
    productId: review.productId, modelRevision: review.modelRevision, candidateFingerprint: review.candidateFingerprint,
    modelManifest: candidate.modelManifest, drawingDirectory: candidate.drawingDirectory || null,
    draft: copy(review.draft), preview: copy(review.preview), reviewToken: review.token };
  return assertOnboardingPackage(packet, candidate);
}

/** Structural and identity checks; a real service must independently authenticate its operator. */
export function assertOnboardingPackage(input, candidate) {
  check(object(input) && input.schemaVersion === ONBOARDING_SCHEMA_VERSION && input.kind === 'annora-onboarding-package' && input.source === 'demo', 'INVALID_PACKAGE', 'Export a reviewed Annora onboarding package. Raw drafts and previews cannot be deployed.');
  check(safeId(input.id) && typeof input.createdAt === 'string' && Number.isFinite(Date.parse(input.createdAt)), 'INVALID_PACKAGE', 'The export needs its recorded identity and creation time.');
  check(input.productId === candidate.id && input.modelRevision === candidate.model.revision && input.candidateFingerprint === onboardingCandidateFingerprint(candidate)
    && input.modelManifest === candidate.modelManifest && input.drawingDirectory === (candidate.drawingDirectory || null), 'SOURCE_CHANGED', 'This export targets another prepared source or destination. Existing products have not changed.');
  const normalized = normalizeOnboardingDraft(input.draft, candidate);
  check(same(input.draft, normalized), 'INVALID_PACKAGE', 'The export draft contains unreviewed fields or a different mapping identity.');
  const review = createOnboardingReview(input.draft, input.preview, candidate);
  check(input.reviewToken === review.token, 'STALE_REVIEW', 'The package changed after review. Review and export the current product again.');
  const packet = { schemaVersion: ONBOARDING_SCHEMA_VERSION, kind: 'annora-onboarding-package', source: 'demo', id: input.id, createdAt: input.createdAt,
    productId: input.productId, modelRevision: input.modelRevision, candidateFingerprint: input.candidateFingerprint,
    modelManifest: input.modelManifest, drawingDirectory: input.drawingDirectory, draft: copy(input.draft), preview: copy(input.preview), reviewToken: input.reviewToken };
  check(same(input, packet), 'INVALID_PACKAGE', 'Use only the reviewed configuration fields in this package.');
  return frozen(packet);
}
