import sk08Source from '../../content/drawings/sk08/package.json';
import sk08Profile from '../../content/drawings/sk08/technical-front.json';
import sk08Artwork from '../../content/drawings/sk08/technical-front.svg?raw';
import { matchesTechnicalSource } from './technical-policy.js';

// Curated presentation content stays outside the shared Explorer and reader.
const entries = [{ source: sk08Source, profile: sk08Profile, artwork: sk08Artwork }];

export const technicalEntryFor = (drawing, unavailable = false) =>
  entries.find(entry => matchesTechnicalSource(drawing, entry.source, unavailable));

export const supportsTechnicalDetail = (entry, sheetId, regionId) =>
  Boolean(entry && sheetId === entry.profile.sheetId &&
    (regionId === 'overview' || entry.profile.regions.some(region => region.id === regionId)));
