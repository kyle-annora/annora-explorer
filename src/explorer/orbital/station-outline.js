import { LinearSRGBColorSpace, Vector2 } from 'three';
import { InteractionOutlinePass } from '../interaction-outline.js';

// The same display-space outline used in free inspection, applied to the
// visible surface named by a station. Allocate its full mask only on emphasis.
export function createStationOutline({ scene, camera, renderer, meshes, stations, getAccent }) {
  const pass = new InteractionOutlinePass(new Vector2(1, 1), scene, camera);
  pass.enabled = false;
  pass.occluderObjects = meshes;
  const byName = new Map(meshes.map(mesh => [mesh.name, mesh]));
  const targets = new Map(stations.map(s => [s.id, byName.get(s.anchor?.meshName)]));
  const size = new Vector2();
  let width, height;
  return {
    pass,
    sync(id) {
      const mesh = targets.get(id);
      pass.enabled = Boolean(mesh?.visible);
      if (!pass.enabled) { pass.hoveredObjects.length = 0; return; }
      pass.hoveredObjects[0] = mesh;
      renderer.getDrawingBufferSize(size);
      if (size.x !== width || size.y !== height) {
        width = size.x; height = size.y; pass.setSize(width, height);
      }
      pass.setPixelRatio(renderer.getPixelRatio());
      pass.visibleEdgeColor.setHex(parseInt(getAccent().slice(1), 16), LinearSRGBColorSpace);
    },
    dispose: () => pass.dispose(),
  };
}
