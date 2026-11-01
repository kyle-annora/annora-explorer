import { matchesTechnicalBinding } from './technical-policy.js';

const sources = import.meta.glob('../../content/drawings/*/package.json', { eager: true, import: 'default' });
const profiles = import.meta.glob('../../content/drawings/*/technical-*.json', { eager: true, import: 'default' });
const artwork = import.meta.glob('../../content/drawings/*/technical-*.svg', { eager: true, query: '?raw', import: 'default' });
const extraBindings = Object.values(profiles).flatMap(value => value.bindings || []);
const prepared = Object.entries(profiles).filter(([, profile]) => profile.id && profile.viewBox && profile.regions).flatMap(([path, profile]) => {
  const folder = path.slice(0, path.lastIndexOf('/') + 1);
  const source = sources[folder + 'package.json'];
  const svg = artwork[folder + (profile.artworkFile || path.slice(path.lastIndexOf('/') + 1).replace(/\.json$/, '.svg'))];
  if (!source || !svg) return [];
  const baseId = path.slice(path.lastIndexOf('/technical-') + 11).replace(/\.json$/, '');
  const variants = profile.presentations || [
    { id: baseId, title: profile.title, viewBox: profile.viewBox, annotationVariant: profile.annotationVariant || 'front' },
    ...(profile.detailViewBox ? [{ id: 'bore', title: 'Bore detail', viewBox: profile.detailViewBox, annotationVariant: 'detail', regionId: profile.regions[0].id, regions: [profile.regions[0]] }] : []),
  ];
  const bindings = [{ sheetId: profile.sheetId },
    ...(profile.canonicalAliases || []).map(alias => ({ sheetId: alias.sheetId, regionMap: { [profile.regions[0].id]: alias.regionId } })),
    ...extraBindings.filter(binding => binding.profileId === profile.id),
  ];
  return variants.flatMap(variant => bindings.map(binding => ({ source, artwork: svg, baseId, variant, binding, profile })));
});

/** Resolve presentation content, never a replacement business reference.
 * A region filter also limits interactive targets in frozen-record previews. */
export function technicalEntriesFor(drawing, { sheetId, regionId, unavailable = false } = {}) {
  return prepared.flatMap(item => {
    const { source, artwork, profile, variant, binding } = item;
    if (sheetId && binding.sheetId !== sheetId) return [];
    const mapId = id => binding.regionMap?.[id] || id;
    const sheet = drawing?.sheets?.find(candidate => candidate.id === binding.sheetId);
    const regions = (variant.regions || profile.regions).map(region => {
      const id = mapId(region.id), canonical = sheet?.regions.find(candidate => candidate.id === id);
      return { ...region, id, label: canonical?.label || region.label,
        outlinePathIds: region.outlinePathIds || region.featureOutlinePathIds || profile.featureOutlinePathIds };
    }).filter(region => (!regionId || region.id === regionId) &&
      matchesTechnicalBinding(drawing, source, binding.sheetId, region.id, unavailable));
    if (!regions.length) return [];
    const id = `${profile.id}:${variant.id}:${binding.sheetId}`;
    return [{ id, title: variant.title || profile.title, artwork, sheetId: binding.sheetId,
      legacyPresentation: item.baseId === 'front' ? variant.id : undefined,
      regionIds: regions.map(region => region.id),
      defaultRegionId: regions.some(region => region.id === mapId(variant.regionId || profile.canonical?.regionId))
        ? mapId(variant.regionId || profile.canonical?.regionId) : regions[0].id,
      profile: { ...profile, ...variant, id, title: variant.title || profile.title, sheetId: binding.sheetId,
        presentation: id, annotationVariant: variant.annotationVariant || profile.annotationVariant || variant.id,
        regions, units: drawing.units },
    }];
  });
}

export const technicalEntryFor = (drawing, unavailable = false) => technicalEntriesFor(drawing, { unavailable })[0];
export const supportsTechnicalDetail = (entry, sheetId, regionId) => Boolean(entry && entry.sheetId === sheetId && entry.regionIds.includes(regionId));
