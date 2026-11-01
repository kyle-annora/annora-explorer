import { studioFingerprint } from '../studio/value.js';

const copy = value => JSON.parse(JSON.stringify(value));
const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(value);
const unique = items => new Set(items).size === items.length;
const issue = (code, path, message) => ({ code, path, message, severity: 'error' });

/** Presentation and association versions are independent of drawing revisions.
 * Fingerprints detect changed content; they are not authentication signatures. */
export function overviewSourceKey(drawing) {
  return `source-${studioFingerprint({ id: drawing.id, revision: drawing.revision, modelId: drawing.modelId,
    modelRevision: drawing.modelRevision,
    assets: drawing.assets.map(({ id, kind, sha256 }) => ({ id, kind, sha256 })).sort((a, b) => a.id.localeCompare(b.id)),
    sheets: drawing.sheets.map(({ id, assetId, pdfPage, rotation, viewBox }) => ({ id, assetId, pdfPage: pdfPage || 1, rotation: rotation || 0, viewBox })) })}`;
}
export function overviewAssociationKey(drawing, sheetId, regionId) {
  const region = drawing.sheets.find(sheet => sheet.id === sheetId)?.regions.find(region => region.id === regionId);
  if (!region) return null;
  return `link-${studioFingerprint({ sheetId, regionId, partId: region.partId, bounds: region.bounds,
    camera: region.camera || null, focusPoint: region.focusPoint || null })}`;
}
function body(input) {
  if (!input || input.schemaVersion !== 1 || !id(input.sourceKey) || !Array.isArray(input.sheets) || input.sheets.length > 32)
    throw new TypeError('The overview configuration is invalid.');
  if (!unique(input.sheets.map(sheet => sheet.sheetId))) throw new TypeError('Overview sheets must have unique identifiers.');
  const sheets = input.sheets.map(sheet => {
    if (!id(sheet.sheetId) || !Array.isArray(sheet.views) || sheet.views.length > 8 || !unique(sheet.views.map(view => view.id)))
      throw new TypeError('Choose up to eight unique views per sheet.');
    const views = sheet.views.map(view => {
      if (!id(view.id) || !id(view.viewRevision) || typeof view.title !== 'string' || view.title.length > 120 || !Array.isArray(view.targets) || view.targets.length > 32
          || !unique(view.targets.map(target => target.targetId)) || !unique(view.targets.map(target => target.regionId)))
        throw new TypeError('Each overview view needs a valid asset version, title and unique feature links.');
      const targets = view.targets.map(target => {
        if (!id(target.targetId) || !id(target.regionId) || !id(target.associationKey) || typeof target.confirmed !== 'boolean')
          throw new TypeError('Each overview feature needs an exact drawing association.');
        return { targetId: target.targetId, regionId: target.regionId, associationKey: target.associationKey, confirmed: target.confirmed };
      });
      return { id: view.id, viewRevision: view.viewRevision, title: view.title, targets };
    });
    if (sheet.defaultViewId !== null && (!id(sheet.defaultViewId) || !views.some(view => view.id === sheet.defaultViewId)))
      throw new TypeError('Choose a visible view as the initial overview view.');
    return { sheetId: sheet.sheetId, defaultViewId: sheet.defaultViewId, views };
  });
  return { schemaVersion: 1, sourceKey: input.sourceKey, sheets };
}
export function normalizeOverviewPresentation(input) {
  if (input == null) return null;
  const normalized = body(input), revision = `overview-${studioFingerprint(normalized)}`;
  if (input.revision !== revision) throw new TypeError('This overview version no longer matches its saved content.');
  return { ...normalized, revision };
}
export function reviseOverviewPresentation(input, patch = {}) {
  const normalized = body({ ...copy(input), ...copy(patch) });
  return { ...normalized, revision: `overview-${studioFingerprint(normalized)}` };
}
export function createOverviewPresentation(drawing, entries = [], orders = {}) {
  const sheets = drawing.sheets.map(sheet => {
    const available = entries.filter(entry => entry.sheetId === sheet.id);
    const requested = orders.sheets?.[sheet.id] || orders[sheet.id];
    const ordered = requested ? requested.flatMap(viewId => available.find(entry => entry.id === viewId) || []) : available;
    const views = ordered.slice(0, 8).map(entry => ({ id: entry.id, viewRevision: entry.viewRevision, title: entry.title,
      targets: entry.profile.regions.flatMap(target => {
        const region = sheet.regions.find(region => region.id === target.id);
        return region ? [{ targetId: target.id, regionId: region.id, associationKey: overviewAssociationKey(drawing, sheet.id, region.id), confirmed: region.mappingStatus === 'confirmed' }] : [];
      }) }));
    return { sheetId: sheet.id, defaultViewId: views[0]?.id || null, views };
  });
  if (!sheets.some(sheet => sheet.views.length)) return null;
  return reviseOverviewPresentation({ schemaVersion: 1, sourceKey: overviewSourceKey(drawing), sheets });
}

/** Missing prepared assets never resolve by title or by the latest version. */
export function overviewPresentationIssues(input, drawing, entries, { requireConfirmed = true } = {}) {
  if (input == null) return [];
  let presentation;
  try { presentation = normalizeOverviewPresentation(input); }
  catch (error) { return [issue('INVALID_OVERVIEW', 'presentationSnapshot', error.message)]; }
  const issues = [], add = (code, path, message) => issues.push(issue(code, `presentationSnapshot.${path}`, message));
  if (presentation.sourceKey !== overviewSourceKey(drawing)) add('OVERVIEW_SOURCE_CHANGED', 'sourceKey', 'This overview belongs to another drawing source. Prepare views for the selected source before publishing.');
  if (!presentation.sheets.some(sheet => sheet.views.length)) add('EMPTY_OVERVIEW', 'sheets', 'Choose at least one overview view, or use the source PDF without an overview.');
  for (const sheet of presentation.sheets) {
    const source = drawing.sheets.find(candidate => candidate.id === sheet.sheetId), path = `sheets.${sheet.sheetId}`;
    if (!source) { add('OVERVIEW_SHEET_MISSING', path, 'This overview sheet is not in the selected drawing.'); continue; }
    if (sheet.views.length && !sheet.defaultViewId) add('OVERVIEW_DEFAULT_MISSING', path, 'Choose an initial view for this sheet.');
    for (const view of sheet.views) {
      const prepared = entries?.find(entry => entry.id === view.id && entry.sheetId === sheet.sheetId);
      if (!view.title.trim()) add('OVERVIEW_TITLE_MISSING', `${path}.${view.id}`, 'Give this view a customer-readable title.');
      if (entries && (!prepared || prepared.viewRevision !== view.viewRevision)) add('OVERVIEW_VIEW_UNAVAILABLE', `${path}.${view.id}`, 'This exact prepared view is unavailable. Choose a current source view and review it.');
      for (const target of view.targets) {
        const region = source.regions.find(region => region.id === target.regionId), targetPath = `${path}.${view.id}.${target.targetId}`;
        if (prepared && !prepared.profile.regions.some(region => region.id === target.targetId)) add('OVERVIEW_TARGET_MISSING', targetPath, 'The selected feature does not exist in this prepared view.');
        if (!region || region.mappingStatus !== 'confirmed' || target.associationKey !== overviewAssociationKey(drawing, sheet.sheetId, target.regionId))
          add('OVERVIEW_ASSOCIATION_CHANGED', targetPath, 'Review the original drawing association, then confirm this feature link again.');
        if (requireConfirmed && !target.confirmed) add('OVERVIEW_LINK_UNCONFIRMED', targetPath, 'Confirm this feature link before publishing.');
      }
    }
  }
  return issues;
}

export function compareOverviewPresentations(before, after) {
  const left = normalizeOverviewPresentation(before), right = normalizeOverviewPresentation(after), rows = [];
  const add = (label, a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) rows.push({ label, before: a || 'None', after: b || 'None', changed: true }); };
  add('Overview version', left?.revision, right?.revision);
  for (const sheetId of new Set([...(left?.sheets || []), ...(right?.sheets || [])].map(sheet => sheet.sheetId))) {
    const a = left?.sheets.find(sheet => sheet.sheetId === sheetId), b = right?.sheets.find(sheet => sheet.sheetId === sheetId);
    add(`${sheetId} · visible views and order`, a?.views.map(view => view.title).join(' → '), b?.views.map(view => view.title).join(' → '));
    const title = (sheet, id) => sheet?.views.find(view => view.id === id)?.title;
    add(`${sheetId} · initial view`, title(a, a?.defaultViewId), title(b, b?.defaultViewId));
    for (const viewId of new Set([...(a?.views || []), ...(b?.views || [])].map(view => view.id))) {
      const oldView = a?.views.find(view => view.id === viewId), newView = b?.views.find(view => view.id === viewId);
      const links = view => view?.targets.map(target => `${target.targetId} → ${target.regionId}${target.confirmed ? '' : ' (needs review)'}`).join('; ');
      add(`${newView?.title || oldView?.title} · feature links`, links(oldView), links(newView));
    }
  }
  return { available: true, rows, count: rows.length };
}

/** Read an immutable configuration using only matching prepared geometry. */
export function resolveOverviewEntries(presentation, drawing, entries, { sheetId, requireConfirmed = true } = {}) {
  const issues = presentation ? overviewPresentationIssues(presentation, drawing, entries, { requireConfirmed }) : [];
  if (!presentation || issues.some(issue => requireConfirmed || !['OVERVIEW_ASSOCIATION_CHANGED', 'OVERVIEW_LINK_UNCONFIRMED'].includes(issue.code))) return [];
  const sheet = presentation.sheets.find(sheet => sheet.sheetId === sheetId);
  return (sheet?.views || []).map(view => {
    const prepared = entries.find(entry => entry.id === view.id);
    const regions = view.targets.filter(target => target.confirmed && target.associationKey === overviewAssociationKey(drawing, sheetId, target.regionId) &&
      drawing.sheets.find(sheet => sheet.id === sheetId).regions.some(region => region.id === target.regionId && region.mappingStatus === 'confirmed')).map(target => {
      const geometry = prepared.profile.regions.find(region => region.id === target.targetId);
      const canonical = drawing.sheets.find(sheet => sheet.id === sheetId).regions.find(region => region.id === target.regionId);
      return { ...geometry, id: target.regionId, label: canonical.label, partId: canonical.partId };
    });
    return { ...prepared, title: view.title, regionIds: regions.map(region => region.id), defaultRegionId: regions[0]?.id || null,
      initial: view.id === sheet.defaultViewId,
      profile: { ...prepared.profile, title: view.title, regions } };
  });
}
