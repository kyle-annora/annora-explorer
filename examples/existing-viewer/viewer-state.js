// This contract belongs to the independent viewer, not the Annora renderer.
export const VIEWER_COORDINATE_FRAME = 'source-meters-y-up-v1';
export const VIEWER_CAPABILITIES = Object.freeze({
  inquiry: true, selectedPart: true, capturedView: true,
  drawingDetail: false, story: false,
});

export function assertNotAborted(signal) {
  if (signal?.aborted) throw new DOMException('Viewer operation was cancelled.', 'AbortError');
}

function vector(value, name) {
  if (!Array.isArray(value) || value.length !== 3 || value.some(n => typeof n !== 'number' || !Number.isFinite(n) || Math.abs(n) > 1000)) {
    throw new TypeError(`Invalid viewer ${name}.`);
  }
  return [...value];
}

export function normalizeViewerSnapshot(value, fixture) {
  if (!value || value.schemaVersion !== 1) throw new TypeError('Unsupported viewer snapshot version.');
  if (value.modelId !== fixture.modelId || value.modelRevision !== fixture.modelRevision) {
    throw new Error('This view belongs to a different model revision. Load its original model to restore it.');
  }
  if (value.coordinateFrame !== VIEWER_COORDINATE_FRAME) throw new TypeError('Unsupported viewer coordinate frame.');
  const id = value.selectedPartId;
  if (id !== null && !fixture.parts.some(part => part.id === id)) throw new TypeError('This component is unavailable in the pinned model.');
  const camera = value.camera;
  if (!camera || !camera.projection) throw new TypeError('The saved camera is missing.');
  const position = vector(camera.position, 'camera position');
  const target = vector(camera.target, 'camera target');
  const up = vector(camera.up, 'camera up');
  const { fov, zoom, near, far } = camera.projection;
  if (![fov, zoom, near, far].every(Number.isFinite) || fov < 10 || fov > 100 || zoom < 0.1 || zoom > 10 || near <= 0 || far <= near || far > 1000) {
    throw new TypeError('Invalid viewer projection.');
  }
  const direction = position.map((n, i) => n - target[i]);
  const distance = Math.hypot(...direction);
  const upLength = Math.hypot(...up);
  const cross = [direction[1]*up[2]-direction[2]*up[1], direction[2]*up[0]-direction[0]*up[2], direction[0]*up[1]-direction[1]*up[0]];
  if (distance < 0.00001 || upLength < 0.999 || upLength > 1.001 || Math.hypot(...cross) < distance * 0.00001) {
    throw new TypeError('Invalid viewer camera orientation.');
  }
  return {
    schemaVersion: 1, modelId: fixture.modelId, modelRevision: fixture.modelRevision,
    coordinateFrame: VIEWER_COORDINATE_FRAME, selectedPartId: id,
    camera: { position, target, up, projection: { fov, zoom, near, far } },
  };
}

export function resolveFixtureParts(fixture, meshes) {
  if (fixture?.schemaVersion !== 1 || fixture.coordinateFrame !== VIEWER_COORDINATE_FRAME || !Array.isArray(fixture.parts) || fixture.parts.length > 2000) {
    throw new TypeError('Unsupported independent viewer fixture.');
  }
  const byName = new Map(meshes.map(mesh => [mesh.name, mesh]));
  const byId = new Map();
  const usedNames = new Set();
  for (const part of fixture.parts) {
    if (!part.id || !part.title || byId.has(part.id) || usedNames.has(part.meshName) || !byName.has(part.meshName)) {
      throw new Error(`The pinned component mapping is incomplete: ${part.id || 'unnamed'}.`);
    }
    usedNames.add(part.meshName);
    byId.set(part.id, { part, mesh: byName.get(part.meshName) });
  }
  if (byId.size !== meshes.length) throw new Error('The loaded model has components outside the pinned mapping.');
  return byId;
}
