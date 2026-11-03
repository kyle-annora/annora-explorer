import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { loadProject } from './project-config.mjs';

const roles = { film:/\.mp4$/, gif:/\.gif$/, hero:/\.png$/, exploded:/\.png$/, detail:/\.png$/ };
const assert = (condition, message) => { if (!condition) throw new Error(`Presentation media: ${message}`); };

/** Only configured model/tour pairs may contribute derivative media to a build. */
export async function loadPresentationAssets(root, models) {
  const registry = JSON.parse(await readFile(path.join(root, 'content/presentations/registry.json'), 'utf8'));
  assert(registry.schemaVersion === 1 && Array.isArray(registry.items), 'unsupported registry.');
  const configured = new Map(models.map(model => [model.manifest.id, model]));
  const ids = new Set(), result = []; let mediaRoot;
  for (const record of registry.items) {
    assert(record && typeof record.modelId === 'string' && /^[a-z][a-z0-9-]+$/.test(record.modelId) && !ids.has(record.modelId), 'duplicate or invalid model ID.');
    ids.add(record.modelId);
    const model = configured.get(record.modelId); if (!model) continue;
    mediaRoot ||= await realpath(path.join(root, 'content/presentations/media'));
    assert(model.tour?.id === record.tourId, `${record.modelId} references a different authored tour.`);
    assert(/^sha256:[a-f0-9]{64}$/.test(record.modelRevision) && model.revision === record.modelRevision, `${record.modelId} media belongs to a different model package revision.`);
    for (const key of ['title','shortTitle','description','attribution']) assert(typeof record[key] === 'string' && record[key].trim() && record[key].length <= 1000, `${key} needs bounded text.`);
    for (const key of ['sourceUrl','preparationUrl']) {
      const url = new URL(record[key]); assert(url.protocol === 'https:' && !url.username && !url.password, `${key} must be a public HTTPS source.`);
    }
    assert(record.sourcePin && /^[a-f0-9]{40}$/.test(record.sourcePin.revision), `${record.modelId} needs its pinned source revision.`);
    const pinned = new URL(record.sourcePin.repository); assert(pinned.protocol === 'https:' && !pinned.username && !pinned.password, 'invalid source repository.');
    assert(record.media && Object.keys(record.media).length === Object.keys(roles).length, `${record.modelId} needs its complete matching media set.`);
    for (const [role, relative] of Object.entries(record.media)) {
      assert(roles[role] && typeof relative === 'string' && relative.startsWith('content/presentations/media/') && roles[role].test(relative), `invalid ${role} asset.`);
      const file = await realpath(path.join(root, relative));
      assert(file.startsWith(`${mediaRoot}${path.sep}`), `${role} escapes the media directory.`);
      const info = await stat(file); assert(info.isFile() && info.size > 0, `${role} asset is empty.`);
    }
    result.push(record);
  }
  return result;
}

export function presentationAssetModule(root, records) {
  const imports = [], rows = records.map((record, index) => {
    const refs = Object.entries(record.media).map(([role,relative]) => {
      const binding = `asset_${index}_${role}`;
      imports.push(`import ${binding} from ${JSON.stringify(`${path.join(root, relative)}?url`)};`);
      return `${JSON.stringify(role)}:${binding}`;
    });
    const { media, ...metadata } = record;
    return `{...${JSON.stringify(metadata)},media:{${refs.join(',')}}}`;
  });
  return `${imports.join('\n')}\nexport default [${rows.join(',')}];`;
}

export function presentationAssetsPlugin(root) {
  const id = 'virtual:annora-presentation-assets', resolved = `\0${id}`;
  return {
    name:'configured-presentation-assets',
    resolveId(value) { return value === id ? resolved : null; },
    async load(value) {
      if (value !== resolved) return null;
      const { models } = await loadProject(root);
      return presentationAssetModule(root, await loadPresentationAssets(root, models));
    },
  };
}
