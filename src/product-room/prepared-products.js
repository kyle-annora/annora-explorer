import { normalizeInquiryProfile } from './inquiry-profile.js';
import { normalizeDrawingPackage, releaseDiagnostic } from '../drawings/package.js';
import { normalizeOverviewPresentation, overviewPresentationIssues } from '../drawings/overview-presentation.js';
import { normalizeTechnicalStoryReference } from './technical-story.js';

const clone = value => JSON.parse(JSON.stringify(value));
const text = value => typeof value === 'string' && Boolean(value.trim());
const identity = value => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,199}$/.test(value);
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
const failure = (code, message) => Object.assign(new Error(message), { code });
const records = value => Array.isArray(value) ? value : [];

/** Data-only hierarchy shared by the editor, story validation and readiness report. */
export function preparedProductParts(metadata) {
  if (!metadata?.root) return [];
  return [
    { ...metadata.root, parentId: null },
    ...records(metadata.groups).map(group => ({ ...group, parentId: group.parentId || metadata.root.id })),
    ...records(metadata.parts).map(part => ({ ...part, parentId: part.group || metadata.root.id })),
  ].map(({ id, title, description = '', parentId }) => ({ id, title, description, parentId }));
}

function capability(available, reason = '') { return { available, reason: available ? '' : reason }; }

/** Readiness describes prepared evidence, not engineering approval or service availability. */
export function preparedProductReadiness(input) {
  const model = input?.model, parts = records(input?.parts), assets = records(input?.assets);
  const partIds = new Set(parts.map(part => part.id)), issues = [];
  const add = (area, code, path, message, severity = 'error') => issues.push({ area, code, path, message, severity });
  if (!model || !identity(model.id) || !text(model.revision)) add('viewer', 'MODEL_MISSING', 'model', 'Register an exact prepared model revision.');
  if (!parts.length || parts.some(part => !identity(part.id) || !text(part.title)) || partIds.size !== parts.length)
    add('viewer', 'PARTS_INVALID', 'parts', 'Prepare a unique, named component hierarchy.');
  if (model && !partIds.has(model.rootId || model.id)) add('viewer', 'ROOT_MISSING', 'parts', 'Include the model root in the prepared hierarchy.');
  if (parts.some(part => part.parentId && !partIds.has(part.parentId))) add('viewer', 'PARENT_MISSING', 'parts', 'Every component parent must exist in this product.');
  const cyclic = parts.some(part => { const seen = new Set(); let current = part;
    while (current?.parentId) { if (seen.has(current.id)) return true; seen.add(current.id); current = parts.find(item => item.id === current.parentId); } return false; });
  if (cyclic) add('viewer', 'HIERARCHY_CYCLE', 'parts', 'Remove the component hierarchy cycle before preparing this product.');
  const source = input?.source || input?.metadata?.source;
  if (!text(source?.license) || !text(source?.url)) add('source', 'SOURCE_INCOMPLETE', 'source', 'Record source attribution, redistribution license and source URL.');
  const units = input?.units || {};
  if (!text(units.source) || !text(units.display) || !text(units.evidence)) add('source', 'UNITS_UNCONFIRMED', 'units', 'Document source units, display units and their preparation evidence.', 'warning');
  const actions = records(model?.tour?.chapters).filter(chapter => chapter.duration >= 2 && chapter.duration <= 3
    && text(chapter.id) && partIds.has(chapter.selectedId)
    && records(chapter.highlightIds).every(id => partIds.has(id))
    && (!chapter.operation || Boolean(model.operationClipId && model.capabilities?.operation)));
  if (!actions.length) add('story', 'NO_PREPARED_ACTION', 'model.tour', 'No prepared short action is supplied. Use a captured view or an available drawing detail.', 'info');
  const referenceIssues = new Map();
  const packages = records(input?.drawingPackages);
  for (const reference of records(input?.technicalReferences)) {
    try {
      const technical = normalizeTechnicalStoryReference(reference.technical, { model, nodeId: reference.nodeId }), context = technical.context, drawing = context.drawing;
      if (technical?.version !== 1 || context?.modelId !== model?.id || context.modelRevision !== model?.revision
          || !partIds.has(reference.nodeId) || context.part?.id !== reference.nodeId || drawing?.partId !== reference.nodeId)
        throw new Error('The drawing detail belongs to another model or part.');
      const raw = packages.find(pkg => pkg.id === drawing.id && pkg.revision === drawing.revision && pkg.mappingRevision === drawing.mappingRevision
        && pkg.assets?.some(asset => asset.id === drawing.assetId && asset.sha256 === drawing.assetRevision));
      if (!raw) throw new Error('The exact drawing source and mapping version are unavailable.');
      const pkg = normalizeDrawingPackage(raw), sheet = pkg.sheets.find(item => item.id === drawing.sheetId), region = sheet?.regions.find(item => item.id === drawing.regionId);
      if (!releaseDiagnostic(pkg, { partIds: [...partIds], modelRevision: model.revision }).valid
          || !sheet || !region || region.partId !== reference.nodeId || region.mappingStatus !== 'confirmed'
          || (sheet.pdfPage || 1) !== technical.pdfPage || (sheet.rotation || 0) !== technical.rotation)
        throw new Error('Review the exact page, part and drawing association before using this detail.');
      if (!assets.some(asset => asset.id === drawing.assetId && asset.sha256 === drawing.assetRevision && asset.url))
        throw new Error('The original drawing asset is not included in this prepared product.');
      if (technical.viewId) {
        if (!Array.isArray(input.overviewViews)) throw new Error('The prepared technical view assets are unavailable.');
        const overview = normalizeOverviewPresentation(drawing.presentationSnapshot);
        if (!overview || overview.revision !== drawing.presentationRevision || overviewPresentationIssues(overview, pkg, input.overviewViews).length)
          throw new Error('The drawing overview or its confirmed links no longer matches this source.');
        const view = overview.sheets.find(item => item.sheetId === sheet.id)?.views.find(item => item.id === technical.viewId);
        if (!view?.targets.some(target => target.regionId === region.id && target.confirmed)) throw new Error('This exact view does not contain the confirmed feature.');
      }
    } catch (error) {
      referenceIssues.set(reference.id, error.message);
      add('drawings', 'TECHNICAL_REFERENCE_UNAVAILABLE', `technicalReferences.${reference.id}`, error.message);
    }
  }
  const technicalReferences = records(input?.technicalReferences).filter(reference => !referenceIssues.has(reference.id));
  if (!technicalReferences.length) add('drawings', 'NO_TECHNICAL_REFERENCE', 'technicalReferences', 'No confirmed drawing detail is prepared for this product.', 'info');
  let profile;
  try { profile = normalizeInquiryProfile(input?.inquiryProfile || input?.bundledRelease?.inquiryProfile); }
  catch { add('inquiry', 'PROFILE_MISSING', 'inquiryProfile', 'Prepare a valid inquiry field profile before accepting requests.'); }
  const release = input?.bundledRelease;
  if (!release || release.productId !== input?.id || release.modelRevision !== model?.revision || release.content?.modelId !== model?.id)
    add('inquiry', 'RELEASE_MISMATCH', 'bundledRelease', 'Prepare a product release for this exact model revision.');
  if (profile && release?.inquiryProfile?.id !== profile.id) add('inquiry', 'PROFILE_MISMATCH', 'bundledRelease.inquiryProfile', 'The product release must use this product’s inquiry profile.');
  for (const document of records(release?.content?.documents)) {
    if (!assets.some(asset => asset.id === document.assetId && asset.revision === document.assetRevision && asset.url))
      add('inquiry', 'DOCUMENT_UNAVAILABLE', `bundledRelease.content.documents.${document.id}`, 'Include the exact managed document version used by this release.');
  }
  for (const reference of technicalReferences) {
    const drawing = reference.technical.context.drawing;
    const document = records(release?.content?.documents).find(document => document.id === drawing.id);
    if (!document || document.title !== drawing.title || document.revision !== drawing.revision || document.assetId !== drawing.assetId)
      add('inquiry', 'DRAWING_HANDOFF_MISMATCH', `technicalReferences.${reference.id}`, 'Include this exact source drawing identity in the product release before starting a request about the detail.');
  }
  const clear = areas => !issues.some(issue => areas.includes(issue.area) && issue.severity === 'error');
  const viewer = clear(['viewer', 'source']);
  const inquiry = viewer && Boolean(profile) && clear(['inquiry']);
  const commercialMode = input?.commercial?.mode === 'sample' ? 'sample' : 'none';
  const capabilities = {
    inspection: capability(viewer, 'The prepared model or source needs attention.'),
    chapter: capability(viewer && actions.length > 0, 'No prepared short action is supplied.'),
    technical: capability(viewer && technicalReferences.length > 0, 'No confirmed drawing detail is available.'),
    inquiry: capability(inquiry, 'The prepared release or inquiry profile needs attention.'),
    quotation: capability(inquiry && commercialMode === 'sample', 'No quotation workflow is configured for this product.'),
  };
  return freeze({ schemaVersion: 1, productId: input?.id || null, modelId: model?.id || null, modelRevision: model?.revision || null,
    viewer: { status: viewer ? 'ready' : 'blocked' },
    story: { status: viewer ? 'ready' : 'blocked', stepKinds: ['inspection', 'chapter', 'technical'].filter(kind => capabilities[kind].available) },
    inquiry: { status: inquiry ? 'ready' : 'blocked' },
    commercial: { status: capabilities.quotation.available ? 'sample-only' : 'not-configured', mode: commercialMode },
    capabilities, actions: clone(actions), technicalReferenceIds: technicalReferences.map(reference => reference.id),
    counts: { parts: parts.length, documents: assets.length, actions: actions.length, technicalReferences: technicalReferences.length },
    units: clone(units), source: source ? clone(source) : null, issues,
    limitations: ['Prepared views and confirmed associations are not manufacturing approval.', 'Readiness does not establish backend storage, customer permissions or delivery guarantees.'],
  });
}

/** All-or-nothing identity registration. Incomplete capabilities remain explicit. */
export function createPreparedProductRegistry(descriptors = []) {
  if (!Array.isArray(descriptors) || descriptors.some(item => !identity(item?.id)) || new Set(descriptors.map(item => item.id)).size !== descriptors.length)
    throw failure('INVALID_PRODUCT_REGISTRY', 'Prepared products require unique stable identities.');
  const products = new Map();
  for (const supplied of descriptors) {
    const { resolveContent: customResolve, ...data } = supplied;
    const input = clone(data), readiness = preparedProductReadiness(input);
    const descriptor = { ...input, parts: input.parts || [], assets: input.assets || [],
      originalRelease: input.originalRelease || input.bundledRelease, poster: input.posterURL,
      actions: readiness.actions, capabilities: readiness.capabilities, readiness,
      technicalReferences: records(input.technicalReferences).filter(item => readiness.technicalReferenceIds.includes(item.id)),
    };
    descriptor.resolveContent = customResolve || (content => {
      const result = clone(content);
      if (result.id !== descriptor.id || result.modelId !== descriptor.model?.id) throw failure('INCOMPATIBLE_PRODUCT', 'This content belongs to another prepared product.');
      result.documents = records(result.documents).map(document => {
        const asset = descriptor.assets.find(asset => asset.id === document.assetId && asset.revision === document.assetRevision);
        if (!asset?.url) throw failure('DOCUMENT_UNAVAILABLE', 'This exact document version is unavailable. The saved reference has not been replaced.');
        return { ...document, url: asset.url, type: asset.type, fileName: asset.fileName };
      });
      const facts = records(result.specGroups).flatMap(group => records(group.facts));
      result.highlights = records(result.highlights).map(item => {
        const fact = item.factId && facts.find(fact => fact.id === item.factId); return fact ? { ...item, value: fact.value } : item;
      });
      return result;
    });
    products.set(input.id, freeze(descriptor));
  }
  return Object.freeze({
    get: id => products.get(id) || null,
    list: () => [...products.values()],
    forRelease(release) {
      const descriptor = products.get(release?.productId);
      if (!descriptor || release.modelRevision !== descriptor.model?.revision || release.content?.modelId !== descriptor.model.id)
        throw failure('PREPARED_PRODUCT_UNAVAILABLE', 'This exact prepared product revision is unavailable. Its historical record is preserved.');
      return descriptor;
    },
  });
}
