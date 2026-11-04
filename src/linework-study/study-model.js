import manifest from '../../content/models/hexapod/manifest.json';

// This isolated study binds the exact existing package, without changing the
// production catalog or loading other model packages into the experiment.
export const STUDY_MODEL = Object.freeze({
  id: manifest.id, rootId: manifest.rootId, title: manifest.title,
  shortTitle: manifest.shortTitle, normalizeWidth: manifest.view.normalizedWidth,
  defaultDirection: manifest.view.direction, presentationPolicy: manifest.presentationPolicy,
  modelUrl: new URL('../../content/models/hexapod/model.glb', import.meta.url),
  compressedUrl: new URL('../../content/models/hexapod/model.glb.gz', import.meta.url),
  metadataUrl: new URL('../../content/models/hexapod/metadata.json', import.meta.url),
  edgesUrl: new URL('../../content/models/hexapod/edges.bin', import.meta.url),
  compressedEdgesUrl: new URL('../../content/models/hexapod/edges.bin.gz', import.meta.url),
  edgeMetadataUrl: new URL('../../content/models/hexapod/edge-metadata.json', import.meta.url),
  silhouettesUrl: new URL('../../content/models/hexapod/silhouettes.bin', import.meta.url),
  compressedSilhouettesUrl: new URL('../../content/models/hexapod/silhouettes.bin.gz', import.meta.url),
  silhouetteMetadataUrl: new URL('../../content/models/hexapod/silhouette-metadata.json', import.meta.url),
});
export const STUDY_VIEWS = Object.freeze({
  overview: { title: 'Exploded assembly', scope: 'hexapod', explosion: 1, direction: [1.5, 1.25, 1.6] },
  leg: { title: 'Single leg', scope: 'hex-leg-1', explosion: 0, direction: [1.5, .8, 1.6] },
  electronics: { title: 'Electronics', scope: 'hex-body-electronics', explosion: 0, direction: [.9, 1.7, 1.6], meshes: ['Hex_electronics_1', 'Hex_electronics_1_surface2', 'Hex_electronics_1_surface3'] },
});
export const STUDY_VARIANTS = Object.freeze({
  baseline: { title: 'Original', description: 'Current linework. The reference for every comparison.' },
  clarity: { title: '01 · Clarity only', description: 'Finer sampling and edge smoothing. Original detail density.' },
  density: { title: '02 · Detail density only', description: 'Screen-aware detail. Original sampling and line weights.' },
  combined: { title: '03 · Combined', description: 'Finer sampling with screen-aware detail.' },
});
