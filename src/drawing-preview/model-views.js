import metadata from "../../content/models/linkrods/metadata.json" with { type: "json" };
import manifest from "../../content/models/linkrods/manifest.json" with { type: "json" };

const sourceBounds = metadata.bounds;
const sourceCenter = sourceBounds[0].map(
  (low, axis) => (low + sourceBounds[1][axis]) / 2,
);
const scale =
  manifest.view.normalizedWidth / (sourceBounds[1][0] - sourceBounds[0][0]);
const sessions = new WeakMap();
const clone = (value) => JSON.parse(JSON.stringify(value));
const normalize = (vector) =>
  vector.map((value) => value / Math.hypot(...vector));
const dot = (a, b) => a.reduce((sum, value, axis) => sum + value * b[axis], 0);
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const problem = (code, message) => Object.assign(new Error(message), { code });
// Authored inspection windows surround real source geometry in meters. They are
// framing choices, not invented CAD subparts or manufacturing dimensions.
const views = Object.freeze({
  overview: {
    direction: manifest.view.direction,
    halfSize: sourceBounds[0].map(
      (low, axis) => (sourceBounds[1][axis] - low) / 2,
    ),
  },
  "large-bore": {
    direction: [0.18, 2.6, 1],
    halfSize: [0.000875, 0.0011, 0.000875],
  },
  "small-bore": {
    direction: [0.18, 2.6, 1],
    halfSize: [0.00055, 0.0011, 0.00055],
  },
  "connecting-web": {
    direction: [0.3, 1.3, 2],
    halfSize: [0.00155, 0.0007, 0.00065],
  },
});

/** Same affine normalization used by the unchanged Explorer's model load. */
export function normalizeDrawingPoint(point, model) {
  const center = model?.bounds
    ? model.bounds[0].map((v, i) => (v + model.bounds[1][i]) / 2)
    : sourceCenter;
  const factor = model?.bounds
    ? model.normalizeWidth / (model.bounds[1][0] - model.bounds[0][0])
    : scale;
  if (
    !Array.isArray(point) ||
    point.length !== 3 ||
    !point.every(Number.isFinite)
  )
    throw problem(
      "INVALID_DETAIL",
      "This drawing detail does not provide a valid model location.",
    );
  return point.map((value, axis) => (value - center[axis]) * factor);
}

/** Pure host-side bookmark construction; no WebGL or private viewer state. */
export function createDrawingRegionView(bookmark, region, model) {
  const modelId = model?.id || manifest.id,
    rootId = model?.rootId || manifest.rootId;
  const center = model?.bounds
    ? model.bounds[0].map((v, i) => (v + model.bounds[1][i]) / 2)
    : sourceCenter;
  const factor = model?.bounds
    ? model.normalizeWidth / (model.bounds[1][0] - model.bounds[0][0])
    : scale;
  if (
    bookmark?.model?.id !== modelId ||
    bookmark.coordinateFrame !== "normalized-assembly-v1"
  )
    throw problem(
      "INCOMPATIBLE_VIEW",
      "Open the matching model before locating this drawing detail.",
    );
  const authored = region?.camera || (!model && views[region?.id]);
  if (
    !authored ||
    (model?.parts && !model.parts.some((part) => part.id === region.partId))
  )
    throw problem(
      "INVALID_DETAIL",
      "Choose a prepared detail linked to this model.",
    );
  const result = clone(bookmark),
    camera = result.camera;
  if (
    !camera?.projection ||
    !camera.viewport ||
    camera.viewport.width <= 0 ||
    camera.viewport.height <= 0
  )
    throw problem(
      "INVALID_VIEW",
      "The Explorer view is not ready for detail framing.",
    );
  const target = normalizeDrawingPoint(
    authored.target || authored.focusPoint || region.focusPoint || center,
    model,
  );
  const forward = normalize(authored.direction);
  let side = cross(camera.up, forward);
  const aligned = Math.hypot(...side) < 1e-8;
  if (aligned)
    side = cross(Math.abs(forward[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], forward);
  const right = normalize(side),
    up = normalize(cross(forward, right));
  if (aligned) camera.up = up;
  const halfSize = authored.halfSize.map((value) => value * factor);
  const { verticalFovDegrees, zoom } = camera.projection;
  if (!(verticalFovDegrees > 0 && verticalFovDegrees < 180 && zoom > 0))
    throw problem("INVALID_VIEW", "The Explorer camera projection is invalid.");
  const tangent = Math.tan((verticalFovDegrees * Math.PI) / 360) / zoom;
  const aspect = camera.viewport.width / camera.viewport.height;
  // Keep a little context around each detail; account for the existing floating
  // UI's projection shift without reading or modifying the iframe DOM. layoutKey
  // stays an opaque identity, used only to detect a changed presentation layout.
  const fillX =
    Math.max(
      0.35,
      1 -
        (2 * Math.abs(camera.projection.offsetX || 0)) / camera.viewport.width,
    ) * 0.82;
  const fillY =
    Math.max(
      0.35,
      1 -
        (2 * Math.abs(camera.projection.offsetY || 0)) / camera.viewport.height,
    ) * 0.82;
  let distance = 0.75;
  for (const x of [-halfSize[0], halfSize[0]])
    for (const y of [-halfSize[1], halfSize[1]])
      for (const z of [-halfSize[2], halfSize[2]]) {
        const corner = [x, y, z],
          depth = dot(corner, forward);
        distance = Math.max(
          distance,
          Math.abs(dot(corner, right)) / (tangent * aspect * fillX) + depth,
          Math.abs(dot(corner, up)) / (tangent * fillY) + depth,
        );
      }
  result.selectedId = region.partId;
  result.scopeId = rootId;
  result.isolated = false;
  result.mode = "explore";
  result.separation = 0;
  result.operation = null;
  camera.target = target;
  camera.position = target.map(
    (value, axis) => value + forward[axis] * distance,
  );
  // Render style, display options, projection, up and current layoutKey remain
  // exactly as captured. Repeated detail requests cannot accumulate zoom.
  return result;
}

/** Call only for the explicit "Show in 3D" action; ordinary orbiting is untouched.
 * The room viewer must already be mounted. Returns { focused, regionId } or
 * { focused:false, superseded:true } when a newer queued choice replaces it.
 */
export async function focusDrawingRegion(viewer, region, model) {
  if (!viewer || typeof viewer.request !== "function")
    throw new TypeError("A ready Explorer host viewer is required.");
  let session = sessions.get(viewer);
  if (!session) {
    session = { sequence: 0, tail: Promise.resolve() };
    sessions.set(viewer, session);
  }
  const sequence = ++session.sequence,
    previous = session.tail;
  const task = (async () => {
    await previous.catch(() => {});
    const superseded = () => sequence !== session.sequence;
    if (superseded()) return { focused: false, superseded: true };
    const captureSettled = async () => {
      for (let attempt = 0; attempt < 35; attempt++) {
        if (superseded()) return null;
        try {
          return await viewer.request("captureView");
        } catch (error) {
          if (error?.code !== "BUSY_STATE" || attempt === 34) throw error;
          await new Promise((resolve) => setTimeout(resolve, 80));
        }
      }
    };
    const bookmark = await captureSettled();
    if (superseded()) return { focused: false, superseded: true };
    await viewer.request("restoreView", {
      bookmark: createDrawingRegionView(bookmark, region, model),
    });
    if (superseded()) return { focused: false, superseded: true };
    const settled = await captureSettled();
    if (superseded()) return { focused: false, superseded: true };
    // Restoring an assembled pose may expose the existing action controls and
    // change the public layout key. The runtime intentionally fits the whole
    // model when a bookmark's layout is stale. Reframe once against the settled
    // layout, using a fresh public capture; never continuously fight navigation.
    if (settled.camera.layoutKey !== bookmark.camera.layoutKey) {
      await viewer.request("restoreView", {
        bookmark: createDrawingRegionView(settled, region, model),
      });
    }
    return superseded()
      ? { focused: false, superseded: true }
      : { focused: true, regionId: region.id };
  })();
  session.tail = task.catch(() => {});
  return task;
}
