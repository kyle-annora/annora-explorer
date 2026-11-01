import { matchesTechnicalBinding } from './technical-policy.js';
import { studioFingerprint } from '../studio/value.js';
import { createOverviewPresentation, overviewSourceKey, resolveOverviewEntries } from '../drawings/overview-presentation.js';

/** Shared browser/build resolver. Seller configurations contain references,
 * never executable SVG. Geometry must match its prepared original sources. */
export function createTechnicalCatalog({ sources = {}, profiles = {}, artwork = {}, overviewDefinitions = {}, presentations = {}, releases = {}, legacyPresentations = {} } = {}) {
  const extraBindings = Object.values(profiles).flatMap(value => value.bindings || []);
  const candidates = folder => [...Object.entries(sources).filter(([path]) => path === folder + 'package.json').map(([, pkg]) => pkg),
    ...Object.entries(releases).filter(([path]) => path.startsWith(folder)).flatMap(([, record]) => [record.sourcePackageSnapshot, record.previousPackageSnapshot, record.packageSnapshot].filter(Boolean))];
  const prepared = Object.entries(profiles).filter(([, profile]) => profile.id && profile.viewBox && profile.regions).flatMap(([path, profile]) => {
    const folder = path.slice(0, path.lastIndexOf('/') + 1);
    const matching = candidates(folder).filter(pkg => (!profile.source?.revision || pkg.revision === profile.source.revision) &&
      (!profile.sourceSha256 || pkg.assets.some(asset => asset.sha256 === profile.sourceSha256)) &&
      (!profile.sourceStepSha256 || pkg.assets.some(asset => asset.sha256 === profile.sourceStepSha256)));
    const source = matching.find(pkg => pkg.mappingRevision === profile.source?.mappingRevision) || matching[0];
    const svg = artwork[folder + (profile.artworkFile || path.slice(path.lastIndexOf('/') + 1).replace(/\.json$/, '.svg'))];
    if (!source || !svg) return [];
    const baseId = path.slice(path.lastIndexOf('technical-') + 10).replace(/\.json$/, '');
    const variants = profile.presentations || [
      { id: baseId, title: profile.title, viewBox: profile.viewBox, annotationVariant: profile.annotationVariant || 'front' },
      ...(profile.detailViewBox ? [{ id: 'bore', title: 'Bore detail', viewBox: profile.detailViewBox, annotationVariant: 'detail', regionId: profile.regions[0].id, regions: [profile.regions[0]] }] : []),
    ];
    const bindings = [{ sheetId: profile.sheetId },
      ...(profile.canonicalAliases || []).map(alias => ({ sheetId: alias.sheetId, regionMap: { [profile.regions[0].id]: alias.regionId } })),
      ...extraBindings.filter(binding => binding.profileId === profile.id),
    ];
    return variants.flatMap(variant => bindings.map(binding => ({ source, artwork: svg, baseId, variant, binding, profile, folder })));
  });
  function entries(drawing, { sheetId, regionId, unavailable = false, strict = false } = {}) {
    if (!drawing || unavailable) return [];
    const sourceKey = overviewSourceKey(drawing);
    return prepared.flatMap(item => {
      const { source, artwork, profile, variant, binding } = item;
      if (sheetId && binding.sheetId !== sheetId || sourceKey !== (item.sourceKey ||= overviewSourceKey(source))) return [];
      const mapId = id => binding.regionMap?.[id] || id;
      const sheet = drawing.sheets.find(candidate => candidate.id === binding.sheetId);
      if (!sheet) return [];
      const regions = (variant.regions || profile.regions).map(region => ({ ...region, id: mapId(region.id),
        outlinePathIds: region.outlinePathIds || region.featureOutlinePathIds || profile.featureOutlinePathIds }));
      const id = `${profile.id}:${variant.id}:${binding.sheetId}`;
      const fullProfile = { ...profile, ...variant, id, title: variant.title || profile.title, sheetId: binding.sheetId,
        presentation: id, annotationVariant: variant.annotationVariant || profile.annotationVariant || variant.id, regions, units: source.units };
      const viewRevision = item.viewRevision ||= `view-${studioFingerprint({ profile: fullProfile, artwork })}`;
      const selected = regions.filter(region => (!regionId || region.id === regionId) &&
        (!strict || matchesTechnicalBinding(drawing, source, binding.sheetId, region.id, unavailable)));
      if (strict && !selected.length) return [];
      const canonicalDefault = mapId(variant.regionId || profile.canonical?.regionId);
      return [{ id, viewRevision, title: variant.title || profile.title, artwork, sheetId: binding.sheetId,
        legacyPresentation: item.baseId === 'front' ? variant.id : undefined,
        regionIds: selected.map(region => region.id), defaultRegionId: selected.some(region => region.id === canonicalDefault) ? canonicalDefault : selected[0]?.id || null,
        profile: { ...fullProfile, regions: selected.map(region => ({ ...region, label: sheet.regions.find(candidate => candidate.id === region.id)?.label || region.label })) } }];
    });
  }
  function preparedSource(drawing) {
    return prepared.find(item => item.source.id === drawing?.id && overviewSourceKey(item.source) === overviewSourceKey(drawing));
  }
  function legacyOverviewPresentationFor(drawing) {
    const item = preparedSource(drawing);
    if (!item) return null;
    const saved = legacyPresentations[item.folder + 'overview-legacy.json'];
    return saved || createOverviewPresentation(item.source, entries(item.source), overviewDefinitions[item.folder + 'overview-views.json'] || {});
  }
  function overviewPresentationFor(drawing) {
    const item = preparedSource(drawing);
    if (!item) return null;
    const key = item.folder + 'overview-presentation.json';
    return Object.hasOwn(presentations, key) ? presentations[key] : legacyOverviewPresentationFor(drawing);
  }
  return {
    technicalEntriesFor: (drawing, options) => entries(drawing, { ...options, strict: true }),
    preparedOverviewViewsFor: (drawing, options) => entries(drawing, options),
    legacyOverviewPresentationFor, overviewPresentationFor,
    overviewEntriesFor(drawing, { sheetId, unavailable = false, presentationSnapshot, requireConfirmed = true } = {}) {
      if (unavailable) return [];
      const snapshot = presentationSnapshot === undefined ? overviewPresentationFor(drawing) : presentationSnapshot;
      return resolveOverviewEntries(snapshot, drawing, entries(drawing), { sheetId, requireConfirmed });
    },
  };
}
