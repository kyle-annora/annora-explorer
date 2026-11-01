import { ROOM_CONTENT } from '../product-room/content.js';
import { DEFAULT_INQUIRY_PROFILE } from '../product-room/inquiry-profile.js';
import { MODEL_CATALOG } from '../generated/catalog.js';
import metadata from '../../content/models/kinetic-01/metadata.json' with { type: 'json' };
import preparedRelease from '../../content/rooms/kinetic-01/release.json' with { type: 'json' };
import { copyStudioValue, profileVersion } from './value.js';

export { DEFAULT_INQUIRY_PROFILE };
export const STUDIO_PRODUCT_ID = 'kinetic-01';
export const STUDIO_MODEL = MODEL_CATALOG[STUDIO_PRODUCT_ID];
export const STUDIO_PARTS = Object.freeze([
  { id: metadata.root.id, title: metadata.root.title, parentId: null, description: metadata.root.description },
  ...metadata.groups.map(group => ({ id: group.id, title: group.title, parentId: metadata.root.id, description: group.description })),
  ...metadata.parts.map(part => ({ id: part.id, title: part.title, parentId: part.group, description: part.description })),
].map(Object.freeze));
export const STUDIO_ASSETS = Object.freeze([
  {
    id: 'kinetic-brief', title: 'Crank-slider mechanism brief', type: 'HTML', revision: 'Sample 01', date: '2026-11-01',
    fileName: 'kinetic-01-mechanism-brief.html',
    url: new URL('../../product-room/files/kinetic-01-mechanism-brief.html', import.meta.url).href,
  },
  {
    id: 'kinetic-application-checklist', title: 'Application discussion checklist', type: 'HTML', revision: 'Sample 02', date: '2026-11-01',
    fileName: 'kinetic-01-application-checklist.html',
    url: new URL('../../product-room/files/kinetic-01-application-checklist.html', import.meta.url).href,
  },
].map(Object.freeze));

const content = copyStudioValue(ROOM_CONTENT[STUDIO_PRODUCT_ID]);
content.posterAssetId = 'kinetic-poster';
content.documents = content.documents.map(({ url, ...doc }) => ({ ...doc, assetId: 'kinetic-brief', assetRevision: 'Sample 01' }));
content.specGroups = content.specGroups.map(group => ({ ...group, facts: group.facts.map((fact, index) => ({
  ...fact, id: `${group.id}-${index + 1}`, status: group.id === 'application' ? 'unverified' : 'illustrative',
})) }));
// The overview and specification table share the same authored stroke fact.
content.highlights[0].factId = 'geometry-1';
content.partContent = metadata.groups.map(group => ({
  nodeId: group.id, title: group.title, description: group.description,
  documentIds: group.id === 'rod' ? ['kinetic-brief'] : [],
}));
const inquiryProfile = copyStudioValue(DEFAULT_INQUIRY_PROFILE);
inquiryProfile.version = profileVersion(inquiryProfile.fields);
export const ORIGINAL_BUNDLED_RELEASE = {
  id: 'ROOM-kinetic-01-bundled-2026-11-01', version: 1,
  productId: STUDIO_PRODUCT_ID, modelRevision: STUDIO_MODEL?.revision || 'unconfigured',
  content, inquiryProfile, presentation: { defaultRenderStyle: 'engineering' },
  createdAt: '2026-11-01T12:00:00.000Z', source: 'bundled',
};
function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
export const BUNDLED_RELEASE = freeze(copyStudioValue(preparedRelease ? { ...preparedRelease, source: 'bundled' } : ORIGINAL_BUNDLED_RELEASE));

/** Resolve trusted prepared asset IDs for this build; stored releases contain no host-specific paths. */
export function resolveStudioContent(input) {
  const result = copyStudioValue(input);
  const facts = result.specGroups.flatMap(group => group.facts);
  result.highlights = result.highlights.map(item => {
    const fact = item.factId && facts.find(fact => fact.id === item.factId);
    return fact ? { ...item, value: fact.value } : item;
  });
  result.documents = result.documents.map(doc => {
    const asset = STUDIO_ASSETS.find(item => item.id === doc.assetId);
    if (!asset) throw new Error(`Document asset "${doc.assetId}" is not included in this build.`);
    return { ...doc, url: asset.url, fileName: asset.fileName, type: asset.type };
  });
  return result;
}
