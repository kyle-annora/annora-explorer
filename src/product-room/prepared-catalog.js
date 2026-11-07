import { MODEL_CATALOG } from '../generated/catalog.js';
import { STUDIO_PARTS, STUDIO_ASSETS, BUNDLED_RELEASE, ORIGINAL_BUNDLED_RELEASE, resolveStudioContent } from '../studio/seed.js';
import { createPreparedProductRegistry, preparedProductParts } from './prepared-products.js';
import { createDrawingContext } from '../drawing-preview/context.js';
import { preparedOverviewViewsFor, overviewPresentationFor } from '../drawing-preview/technical-catalog.js';
import { createTechnicalStoryReference } from './technical-story.js';
import { registeredProductPackages } from './registered-packages.js';
import crankMetadata from '../../content/models/kinetic-01/metadata.json' with { type: 'json' };
import supportMetadata from '../../content/models/sk08/metadata.json' with { type: 'json' };
import supportDrawing from '../../content/drawings/sk08/package.json' with { type: 'json' };
import supportRelease from '../../content/rooms/sk08/release.json' with { type: 'json' };

const clone = value => JSON.parse(JSON.stringify(value));
const supportModel = MODEL_CATALOG.sk08;
const supportParts = preparedProductParts(supportMetadata);
const supportAssets = [
  { id: 'reference-pdf', title: 'SK08 reference drawing', revision: supportDrawing.revision, type: 'PDF', date: '2026-11-01',
    sha256: supportDrawing.assets.find(asset => asset.id === 'reference-pdf').sha256,
    fileName: 'sk08-reference.pdf', url: new URL('../../content/drawings/sk08/reference.pdf', import.meta.url).href },
  { id: 'source-pdf', title: 'Original SK08 source drawing', revision: 'source-c4c72a71', type: 'PDF', date: '2026-11-01',
    sha256: supportDrawing.assets.find(asset => asset.id === 'source-pdf').sha256,
    fileName: 'sk08-source.pdf', url: new URL('../../content/drawings/sk08/source.pdf', import.meta.url).href },
];

function prepareSupport() {
  if (!supportModel) return null;
  const overviewViews = preparedOverviewViewsFor(supportDrawing), overview = overviewPresentationFor(supportDrawing);
  const model = { ...supportModel, parts: supportMetadata.parts };
  const references = supportDrawing.sheets.flatMap(sheet => sheet.regions.filter(region => region.mappingStatus === 'confirmed').flatMap(region => {
    const context = createDrawingContext({ drawing: supportDrawing, sheetId: sheet.id, regionId: region.id, modelRevision: supportModel.revision,
      model, presentationSnapshot: overview });
    const views = overview?.sheets.find(item => item.sheetId === sheet.id)?.views.filter(view => view.targets.some(target => target.regionId === region.id && target.confirmed)) || [];
    return (views.length ? views : [null]).map(view => ({ id: `${sheet.id}:${region.id}:${view?.id || 'source'}`,
      title: `${view?.title || sheet.title} · ${region.label}`, nodeId: region.partId,
      technical: createTechnicalStoryReference({ context, pdfPage: sheet.pdfPage || 1, rotation: sheet.rotation || 0, viewId: view?.id || null }) }));
  }));
  const bundledRelease = clone(supportRelease), inquiryProfile = bundledRelease.inquiryProfile;
  return { id: 'sk08', model: supportModel, parts: supportParts, assets: supportAssets, posterAssetId: 'sk08-poster',
    posterTitle: 'SK08 prepared isometric view', posterURL: new URL('../../content/drawings/sk08/technical-iso.svg', import.meta.url).href,
    source: supportMetadata.source, units: { source: 'mm', display: 'm', evidence: 'Pinned STEP/PDF preparation provenance and manifest specify mm → m; legacy metadata orientation.sourceUnits remains unverified.' },
    bundledRelease, originalRelease: bundledRelease, inquiryProfile, commercial: { mode: 'sample', drawingWorkflow: true },
    drawingPackages: [supportDrawing], overviewViews, technicalReferences: references };
}

// Host registration is separate from rendering. Add another prepared descriptor
// here; no model-ID branch belongs in the Explorer, editor or story player.
const descriptors = [{ id: 'kinetic-01', model: MODEL_CATALOG['kinetic-01'], parts: STUDIO_PARTS, assets: STUDIO_ASSETS,
  source: { ...crankMetadata.source, url: BUNDLED_RELEASE.content.source.url }, units: { source: 'm', display: 'm', evidence: 'Prepared mechanism geometry and model metadata orientation.sourceUnits; dimensions remain illustrative.' },
  posterAssetId: 'kinetic-poster', posterTitle: 'Crank-slider engineering view',
  posterURL: new URL('./assets/crank.png', import.meta.url).href,
  bundledRelease: BUNDLED_RELEASE, originalRelease: ORIGINAL_BUNDLED_RELEASE, inquiryProfile: BUNDLED_RELEASE.inquiryProfile,
  commercial: { mode: 'sample', drawingWorkflow: false }, technicalReferences: [], drawingPackages: [], resolveContent: resolveStudioContent }, prepareSupport()].filter(item => item?.model);

export const preparedProducts = createPreparedProductRegistry([...descriptors,...registeredProductPackages]);
export const preparedProduct = id => preparedProducts.get(id);
