import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createTechnicalCatalog } from '../../src/drawing-preview/technical-library.js';

/** Same source/version checks as the browser, without a bundler or CAD kernel. */
export async function loadOverviewCatalog(directory, drawing) {
  const names = await readdir(directory), sources = {}, profiles = {}, artwork = {}, overviewDefinitions = {}, presentations = {}, releases = {}, legacyPresentations = {};
  sources['package.json'] = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
  for (const name of names) {
    if (/^technical-.*\.json$/.test(name)) profiles[name] = JSON.parse(await readFile(join(directory, name), 'utf8'));
    else if (/^technical-.*\.svg$/.test(name)) artwork[name] = await readFile(join(directory, name), 'utf8');
    else if (/^release-.*\.json$/.test(name)) releases[name] = JSON.parse(await readFile(join(directory, name), 'utf8'));
    else if (name === 'overview-views.json') overviewDefinitions[name] = JSON.parse(await readFile(join(directory, name), 'utf8'));
    else if (name === 'overview-presentation.json') presentations[name] = JSON.parse(await readFile(join(directory, name), 'utf8'));
    else if (name === 'overview-legacy.json') legacyPresentations[name] = JSON.parse(await readFile(join(directory, name), 'utf8'));
  }
  const catalog = createTechnicalCatalog({ sources, profiles, artwork, overviewDefinitions, presentations, releases, legacyPresentations });
  const pkg = drawing || sources['package.json'];
  return { overviewViews: catalog.preparedOverviewViewsFor(pkg), overviewPresentation: catalog.overviewPresentationFor(pkg),
    legacyOverviewPresentation: catalog.legacyOverviewPresentationFor(pkg) };
}
