import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';

export const referenceKinds = ['plan', 'elevation', 'section'];
const plateFile = /^plates\/[a-z][a-z0-9-]{0,95}\.svg$/;

export function validateReferenceViews(views, require) {
  require(views && referenceKinds.includes(views.initial), 'reference drawings need a valid initial view.');
  require(referenceKinds.every(kind => typeof views[kind] === 'string' && plateFile.test(views[kind])),
    'each reference drawing must name an SVG in this model’s plates folder.');
  if (views.cues !== undefined) {
    require(Array.isArray(views.cues) && views.cues.length <= 12 && views.cues.every((cue, index) =>
      Number.isFinite(cue?.at) && cue.at > 0 && cue.at <= 1 && referenceKinds.includes(cue.view) &&
      (index === 0 || cue.at > views.cues[index - 1].at)), 'reference view cues must be ordered within the action.');
  }
  require(new Set(referenceKinds.map(kind => views[kind])).size === referenceKinds.length,
    'plan, elevation and section must use distinct drawings.');
}

// Resolve every drawing against the same model and GLB as the chapters.
// Distinct model packages may reuse filenames such as plates/overview-plan.svg.
export async function resolveReferenceAssets(model, guide, source) {
  const chapters = guide.chapters.filter(chapter => chapter.referenceViews);
  if (!chapters.length) return [];
  const packageDir = path.dirname(model.manifestPath);
  const sha256 = createHash('sha256').update(source).digest('hex');
  const assets = [];
  for (const chapter of chapters) {
    for (const kind of referenceKinds) {
      const filename = chapter.referenceViews[kind];
      const absolute = await realpath(path.join(packageDir, filename));
      if (path.dirname(absolute) !== path.join(packageDir, 'plates')) throw Error('Drawing escapes its model package: ' + filename);
      const svg = await readFile(absolute, 'utf8');
      const raw = svg.match(/<metadata\b[^>]*>([\s\S]*?)<\/metadata>/)?.[1];
      let meta;
      try { meta = JSON.parse(raw); } catch { /* Report the asset path below. */ }
      if (meta?.modelId !== guide.modelId || meta?.sourceSha256 !== sha256 ||
          meta?.modelRevision !== guide.modelRevision || meta?.chapterId !== chapter.id ||
          meta?.pose !== 'rest' || meta?.projection !== 'orthographic' || meta?.view !== kind) {
        throw Error(`${guide.modelId}/${filename} does not match this chapter, view and model revision.`);
      }
      assets.push({ filename, absolute });
    }
  }
  return assets;
}
