import { createTechnicalCatalog } from './technical-library.js';

const catalog = createTechnicalCatalog({
  sources: import.meta.glob('../../content/drawings/*/package.json', { eager: true, import: 'default' }),
  profiles: import.meta.glob('../../content/drawings/*/technical-*.json', { eager: true, import: 'default' }),
  artwork: import.meta.glob('../../content/drawings/*/technical-*.svg', { eager: true, query: '?raw', import: 'default' }),
  overviewDefinitions: import.meta.glob('../../content/drawings/*/overview-views.json', { eager: true, import: 'default' }),
  presentations: import.meta.glob('../../content/drawings/*/overview-presentation.json', { eager: true, import: 'default' }),
  legacyPresentations: import.meta.glob('../../content/drawings/*/overview-legacy.json', { eager: true, import: 'default' }),
  releases: import.meta.glob('../../content/drawings/*/release-*.json', { eager: true, import: 'default' }),
});
export const { technicalEntriesFor, preparedOverviewViewsFor, overviewEntriesFor, legacyOverviewPresentationFor, overviewPresentationFor } = catalog;
export const technicalEntryFor = (drawing, unavailable = false) => technicalEntriesFor(drawing, { unavailable })[0];
export const supportsTechnicalDetail = (entry, sheetId, regionId) => Boolean(entry && entry.sheetId === sheetId && entry.regionIds.includes(regionId));
