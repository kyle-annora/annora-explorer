import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createTechnicalCatalog } from '../../src/drawing-preview/technical-library.js';
import { loadOverviewCatalog } from '../../scripts/lib/overview-catalog.mjs';
import { createDrawingOverview } from '../../src/drawings/drawing-overview.js';
import {
  normalizeOverviewPresentation, reviseOverviewPresentation, overviewPresentationIssues,
  overviewSourceKey, overviewAssociationKey, resolveOverviewEntries, compareOverviewPresentations,
} from '../../src/drawings/overview-presentation.js';

const copy = structuredClone;
async function fixture(product) {
  const directory = new URL(`../../content/drawings/${product}/`, import.meta.url);
  const names = await readdir(directory);
  const data = { sources: {}, profiles: {}, artwork: {}, overviewDefinitions: {}, presentations: {}, releases: {}, legacyPresentations: {} };
  for (const name of names) {
    let group;
    if (name === 'package.json') group = 'sources';
    else if (/^technical-.*\.json$/.test(name)) group = 'profiles';
    else if (/^technical-.*\.svg$/.test(name)) group = 'artwork';
    else if (name === 'overview-views.json') group = 'overviewDefinitions';
    else if (name === 'overview-presentation.json') group = 'presentations';
    else if (name === 'overview-legacy.json') group = 'legacyPresentations';
    else if (/^release-.*\.json$/.test(name)) group = 'releases';
    if (group) {
      const value = await readFile(new URL(name, directory), 'utf8');
      data[group][name] = group === 'artwork' ? value : JSON.parse(value);
    }
  }
  const pkg = data.sources['package.json'], catalog = createTechnicalCatalog(data);
  return { data, pkg, catalog, entries: catalog.preparedOverviewViewsFor(pkg),
    presentation: catalog.overviewPresentationFor(pkg), directory: fileURLToPath(directory) };
}
const fixtures = Object.fromEntries(await Promise.all(['sk08', 'linkrods'].map(async product => [product, await fixture(product)])));

test('real SK08 and connecting-rod overview defaults have matching source, view assets and confirmed feature links', async () => {
  for (const [product, fixture] of Object.entries(fixtures)) {
    const { pkg, entries, presentation, directory } = fixture;
    assert.deepEqual(overviewPresentationIssues(presentation, pkg, entries), []);
    assert.equal(presentation.sourceKey, overviewSourceKey(pkg));
    assert.deepEqual(normalizeOverviewPresentation(presentation), presentation);
    const loaded = await loadOverviewCatalog(directory);
    assert.deepEqual(loaded.overviewViews, entries, `${product}: Node importer and browser catalog use the same identities`);
    assert.deepEqual(loaded.overviewPresentation, presentation);
    assert.deepEqual(presentation.sheets.map(sheet => sheet.views.length), product === 'sk08' ? [4, 3] : [4]);
    for (const sheet of presentation.sheets) {
      const resolved = resolveOverviewEntries(presentation, pkg, entries, { sheetId: sheet.sheetId });
      assert.deepEqual(resolved.map(entry => entry.id), sheet.views.map(view => view.id));
      assert.equal(resolved.filter(entry => entry.initial).length, 1);
      for (const view of sheet.views) for (const target of view.targets)
        assert.equal(target.associationKey, overviewAssociationKey(pkg, sheet.sheetId, target.regionId));
    }
  }
});

test('view inclusion, order, title and initial view change presentation only and preserve the prior snapshot', () => {
  const { pkg, entries, presentation } = fixtures.sk08, before = JSON.stringify(presentation), sourceBefore = JSON.stringify(pkg);
  const input = copy(presentation), sheet = input.sheets[0];
  sheet.views = [sheet.views[2], sheet.views[0]];
  sheet.views[0].title = 'Cross-bore detail first';
  sheet.defaultViewId = sheet.views[0].id;
  const edited = reviseOverviewPresentation(input), resolved = resolveOverviewEntries(edited, pkg, entries, { sheetId: sheet.sheetId });
  assert.notEqual(edited.revision, presentation.revision);
  assert.equal(edited.sourceKey, presentation.sourceKey);
  assert.equal(JSON.stringify(pkg), sourceBefore); assert.equal(JSON.stringify(presentation), before);
  assert.deepEqual(resolved.map(entry => entry.id), sheet.views.map(view => view.id));
  assert.equal(resolved[0].title, 'Cross-bore detail first'); assert.equal(resolved[0].initial, true);
  assert.deepEqual(resolved[0].profile.regions[0].geometry, entries.find(entry => entry.id === resolved[0].id).profile.regions[0].geometry);
  const changes = compareOverviewPresentations(presentation, edited);
  assert.ok(changes.rows.some(row => row.label.includes('visible views and order')));
  assert.ok(changes.rows.some(row => row.label.includes('initial view')));
  const invalid = copy(edited); invalid.sheets[0].defaultViewId = 'removed-view';
  assert.throws(() => reviseOverviewPresentation(invalid), /visible view/);
});

test('manual feature relinking needs explicit confirmation and resolves only the chosen canonical hole', () => {
  const { pkg, entries, presentation } = fixtures.linkrods;
  const input = copy(presentation), bore = input.sheets[0].views.find(view => view.id.includes(':large-bore:'));
  const target = bore.targets[0];
  target.regionId = 'small-bore'; target.associationKey = overviewAssociationKey(pkg, 'sheet-1', target.regionId); target.confirmed = false;
  const pending = reviseOverviewPresentation(input);
  assert.ok(overviewPresentationIssues(pending, pkg, entries).some(issue => issue.code === 'OVERVIEW_LINK_UNCONFIRMED'));
  assert.deepEqual(resolveOverviewEntries(pending, pkg, entries, { sheetId: 'sheet-1' }), []);
  const draftPreview = resolveOverviewEntries(pending, pkg, entries, { sheetId: 'sheet-1', requireConfirmed: false });
  assert.equal(draftPreview.length, 4); assert.deepEqual(draftPreview.find(entry => entry.id === bore.id).regionIds, [], 'unconfirmed draft links are not clickable');
  target.confirmed = true;
  const confirmed = reviseOverviewPresentation(input), linked = resolveOverviewEntries(confirmed, pkg, entries, { sheetId: 'sheet-1' }).find(entry => entry.id === bore.id);
  assert.deepEqual(overviewPresentationIssues(confirmed, pkg, entries), []);
  assert.deepEqual(linked.regionIds, ['small-bore']); assert.equal(linked.defaultRegionId, 'small-bore');
  assert.equal(linked.profile.regions[0].label, pkg.sheets[0].regions.find(region => region.id === 'small-bore').label);
  assert.deepEqual(linked.profile.regions[0].geometry, entries.find(entry => entry.id === bore.id).profile.regions[0].geometry, 'manual linking retains prepared artwork geometry');
  const changed = copy(pkg); changed.sheets[0].regions.find(region => region.id === 'small-bore').bounds[0] += 1;
  assert.ok(overviewPresentationIssues(confirmed, changed, entries).some(issue => issue.code === 'OVERVIEW_ASSOCIATION_CHANGED'));
  assert.deepEqual(resolveOverviewEntries(confirmed, changed, entries, { sheetId: 'sheet-1' }), []);
});

test('changed SVG or profile bytes and removed views cannot masquerade as the pinned asset version', () => {
  const { data, pkg, presentation, entries } = fixtures.sk08;
  for (const kind of ['artwork', 'profile', 'removed']) {
    const next = copy(data);
    if (kind === 'artwork') next.artwork['technical-front.svg'] += '\n<!-- source test change -->';
    else if (kind === 'profile') next.profiles['technical-front.json'].viewBox[2] += 1;
    else delete next.profiles['technical-front.json'];
    const changed = createTechnicalCatalog(next).preparedOverviewViewsFor(pkg);
    assert.ok(overviewPresentationIssues(presentation, pkg, changed).some(issue => issue.code === 'OVERVIEW_VIEW_UNAVAILABLE'), kind);
    assert.deepEqual(resolveOverviewEntries(presentation, pkg, changed, { sheetId: 'sheet-1' }), [], kind);
  }
  const broken = copy(presentation); broken.sheets[0].views[0].targets[0].targetId = 'unavailable-hole';
  const sealed = reviseOverviewPresentation(broken);
  assert.ok(overviewPresentationIssues(sealed, pkg, entries).some(issue => issue.code === 'OVERVIEW_TARGET_MISSING'));
  assert.deepEqual(resolveOverviewEntries(sealed, pkg, entries, { sheetId: 'sheet-1' }), []);
});

test('imported B cannot borrow A geometry while archived A retains its prepared overview', () => {
  for (const { data, pkg, presentation } of Object.values(fixtures)) {
    const b = copy(pkg); b.revision = 'imported-B'; b.mappingRevision = 'mapping-B'; b.assets.find(asset => asset.kind === 'pdf').sha256 = 'b'.repeat(64);
    const next = copy(data); next.sources['package.json'] = b;
    next.releases['release-archived-A.json'] = { productId: pkg.modelId, packageSnapshot: copy(pkg), presentationSnapshot: presentation };
    const catalog = createTechnicalCatalog(next);
    assert.deepEqual(catalog.preparedOverviewViewsFor(b), []);
    assert.equal(catalog.overviewPresentationFor(b), null);
    assert.deepEqual(catalog.overviewEntriesFor(b, { sheetId: 'sheet-1', presentationSnapshot: presentation }), []);
    const old = catalog.preparedOverviewViewsFor(pkg);
    assert.ok(old.length > 0);
    assert.deepEqual(overviewPresentationIssues(presentation, pkg, old), []);
    assert.ok(catalog.overviewEntriesFor(pkg, { sheetId: 'sheet-1', presentationSnapshot: presentation }).length > 0);
  }
});

test('a view can be informational without hole targets and source-only remains an explicit choice', () => {
  const { pkg, entries, presentation, catalog } = fixtures.sk08, input = copy(presentation);
  input.sheets[0].views[0].targets = [];
  const informational = reviseOverviewPresentation(input), resolved = resolveOverviewEntries(informational, pkg, entries, { sheetId: 'sheet-1' });
  assert.deepEqual(overviewPresentationIssues(informational, pkg, entries), []);
  assert.deepEqual(resolved[0].regionIds, []); assert.deepEqual(resolved[0].profile.regions, []); assert.equal(resolved[0].defaultRegionId, null);
  assert.equal(resolved[0].artwork, entries.find(entry => entry.id === resolved[0].id).artwork);
  assert.deepEqual(catalog.overviewEntriesFor(pkg, { sheetId: 'sheet-1', presentationSnapshot: null }), []);
  assert.equal(normalizeOverviewPresentation(null), null);
  const empty = reviseOverviewPresentation({ ...input, sheets: input.sheets.map(sheet => ({ ...sheet, views: [], defaultViewId: null })) });
  assert.ok(overviewPresentationIssues(empty, pkg, entries).some(issue => issue.code === 'EMPTY_OVERVIEW'));
});

test('preserved legacy layout is independent of the current published config and current order list', () => {
  const { data, pkg, presentation } = fixtures.linkrods, next = copy(data);
  const current = copy(presentation); current.sheets[0].views.reverse(); current.sheets[0].views[0].title = 'New seller title';
  current.sheets[0].defaultViewId = current.sheets[0].views[0].id;
  const published = reviseOverviewPresentation(current);
  next.presentations['overview-presentation.json'] = published;
  next.overviewDefinitions['overview-views.json'].sheets['sheet-1'].reverse();
  const catalog = createTechnicalCatalog(next);
  assert.deepEqual(catalog.overviewPresentationFor(pkg), published);
  assert.deepEqual(catalog.legacyOverviewPresentationFor(pkg), data.legacyPresentations['overview-legacy.json']);
  assert.notEqual(catalog.overviewPresentationFor(pkg).revision, catalog.legacyOverviewPresentationFor(pkg).revision);
  assert.deepEqual(catalog.overviewEntriesFor(pkg, { sheetId: 'sheet-1', presentationSnapshot: presentation }).map(entry => entry.title), presentation.sheets[0].views.map(view => view.title));
});

// A minimal browser surface isolates initial mounting; geometry rendering is
// already covered by the technical reader and viewport integration checks.
class Element {
  constructor(tag) { this.tagName = tag; this.children = []; this.attributes = new Map(); this.dataset = {}; this.value = ''; }
  append(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node); } }
  replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
  setAttribute(key, value) { this.attributes.set(key, value); }
  getAttribute(key) { return this.attributes.get(key); }
  addEventListener() {} removeEventListener() {}
  getBoundingClientRect() { return this.rect || this.parent?.getBoundingClientRect() || { width: 390, height: 500 }; }
  querySelector() { return null; } querySelectorAll() { return []; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this); }
}
function mountOverview(entries, options = {}) {
  const mount = new Element('div'); mount.rect = { width: 390, height: 500 };
  const calls = [], document = { createElement: tag => new Element(tag), createElementNS: (_, tag) => new Element(tag) };
  const viewer = createDrawingOverview({ mount, entries, selectedId: 'shaft-bore', document, window: { innerWidth: 390 }, ...options,
    createView(input) { calls.push(input); return { element: new Element('svg'), ready: Promise.resolve(), select() {}, dispose() {}, resize() {} }; } });
  return { viewer, calls };
}

test('mobile overview starts on the seller default while a recorded hole keeps its dedicated composition', async () => {
  const { pkg, entries, presentation } = fixtures.sk08, input = copy(presentation);
  input.sheets[0].defaultViewId = input.sheets[0].views.find(view => view.id.includes(':iso:')).id;
  const resolved = resolveOverviewEntries(reviseOverviewPresentation(input), pkg, entries, { sheetId: 'sheet-1' });
  const open = mountOverview(resolved); await open.viewer.ready;
  assert.equal(open.viewer.activeEntryId, input.sheets[0].defaultViewId); assert.equal(open.calls.length, 1);
  open.viewer.dispose();
  const recorded = mountOverview(resolved, { lockedRegionId: 'shaft-bore' }); await recorded.viewer.ready;
  assert.equal(recorded.viewer.activeEntryId, resolved.find(entry => entry.regionIds.includes('shaft-bore')).id); assert.equal(recorded.calls.length, 1);
  recorded.viewer.dispose();
});
