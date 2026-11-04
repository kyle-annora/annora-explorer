// Run from any directory: node scripts/generate-spatial-plates.mjs [--check] hexapod open-duck
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { loadProject } from './lib/project-config.mjs';
import { inspectGLB } from './lib/model-preparation.mjs';
import { renderSpatialPlate } from './lib/spatial-plate-render.mjs';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const { models } = await loadProject(projectRoot);
const check = process.argv.includes('--check');
const modelIds = process.argv.slice(2).filter((arg) => arg !== '--check');
if (!modelIds.length)
  throw new Error('Pass at least one configured model ID (for example: hexapod open-duck).');
const json = async (file) => JSON.parse(await readFile(file, 'utf8'));
for (const modelId of modelIds) {
  if (!/^[a-z][a-z0-9-]*$/.test(modelId)) throw new Error('Invalid model ID.');
  const model = models.find((record) => record.manifest.id === modelId);
  if (!model) throw new Error('Unknown configured model: ' + modelId);
  const dir = path.dirname(model.manifestPath);
  const { metadata } = model;
  const [guide, source] = await Promise.all(
    ['spatial-guide.json', 'plates-source.json'].map((name) => json(path.join(dir, name)))
  );
  if (source.schemaVersion !== 1 || !['x', 'z'].includes(source.elevation))
    throw new Error('The plate source requires an elevation axis of x or z.');
  const bytes = await readFile(model.assets.model);
  const sourceSha256 = createHash('sha256').update(bytes).digest('hex');
  if (guide.modelId !== modelId || guide.modelRevision !== model.revision)
    throw new Error('Guide and source model revisions differ.');
  inspectGLB(bytes);
  const gltf = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    ''
  );
  gltf.scene.updateMatrixWorld(true);
  const point = new Vector3();
  const parts = metadata.parts.map((part) => {
    const mesh = gltf.scene.getObjectByName(part.meshName);
    if (!mesh?.isMesh) throw new Error('Missing source mesh: ' + part.meshName);
    const vertex = mesh.geometry.getAttribute('position'),
      positions = new Float64Array(vertex.count * 3);
    for (let i = 0; i < vertex.count; i++)
      point
        .fromBufferAttribute(vertex, i)
        .applyMatrix4(mesh.matrixWorld)
        .toArray(positions, i * 3);
    return { group: part.group, name: part.meshName, positions, indices: mesh.geometry.index?.array };
  });
  const out = path.join(dir, 'plates');
  if (!check) await mkdir(out, { recursive: true });
  let total = 0;
  for (const chapter of guide.chapters) {
    if (!/^[a-z][a-z0-9-]*$/.test(chapter.id)) throw new Error('Invalid chapter ID: ' + chapter.id);
    const section = source.sections?.[chapter.id];
    if (
      !section ||
      !['x', 'z'].includes(section.axis) ||
      !Number.isFinite(section.fraction) ||
      section.fraction <= 0 ||
      section.fraction >= 1
    )
      throw new Error('Specify the section plane for chapter ' + chapter.id);
    const members = parts.filter(
      (part) => chapter.id === 'overview' || !chapter.groups || chapter.groups.includes(part.group)
    );
    for (const view of ['plan', 'elevation', 'section']) {
      const svg = renderSpatialPlate(members, {
        modelId,
        modelRevision: guide.modelRevision,
        sourceSha256,
        chapterId: chapter.id,
        view,
        elevation: source.elevation,
        section,
      });
      const file = path.join(out, chapter.id + '-' + view + '.svg');
      if (check) {
        if ((await readFile(file, 'utf8')) !== svg)
          throw new Error('Regenerate ' + path.relative(projectRoot, file));
      } else await writeFile(file, svg);
      total += Buffer.byteLength(svg);
    }
  }
  console.log(
    modelId +
      ': ' +
      (check ? 'verified ' : 'generated ') +
      guide.chapters.length * 3 +
      ' plates (' +
      Math.round(total / 1024) +
      ' KiB total).'
  );
}
