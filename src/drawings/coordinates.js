export function normalizeRotation(value) {
  if (!Number.isFinite(value) || value % 90 !== 0) throw new TypeError('Drawing rotation must be a multiple of 90 degrees.');
  return ((value % 360) + 360) % 360;
}

/** Canonical page-top-left coordinates rotated clockwise with the PDF artwork. */
export function rotatePoint([x, y], [px, py, width, height], rotation) {
  const dx = x - px, dy = y - py;
  switch (normalizeRotation(rotation)) {
    case 90: return [height - dy, dx];
    case 180: return [width - dx, height - dy];
    case 270: return [dy, width - dx];
    default: return [dx, dy];
  }
}

export function rotateBounds([x, y, width, height], paper, rotation) {
  const points = [[x, y], [x + width, y], [x, y + height], [x + width, y + height]].map(point => rotatePoint(point, paper, rotation));
  const xs = points.map(point => point[0]), ys = points.map(point => point[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)];
}

export function rotateSheet(sheet, rotation = sheet.rotation || 0) {
  const angle = normalizeRotation(rotation), [, , width, height] = sheet.viewBox;
  return { ...sheet, rotation: angle, viewBox: [0, 0, angle % 180 ? height : width, angle % 180 ? width : height],
    regions: sheet.regions.map(region => ({ ...region, bounds: rotateBounds(region.bounds, sheet.viewBox, angle) })),
  };
}

/** Whole-page raster budgets prevent zoom or Retina screens from allocating
 * unbounded canvases. SVG selection overlays remain vector at every zoom. */
export function pdfRasterSize({ width, height, scale = 1, pixelRatio = 1, maxPixels = 8_000_000, maxDimension = 4096 }) {
  if (![width, height, scale, pixelRatio, maxPixels, maxDimension].every(value => Number.isFinite(value) && value > 0)) throw new TypeError('PDF raster dimensions and limits must be finite and positive.');
  const desired = scale * Math.min(pixelRatio, 2);
  const bounded = Math.min(desired, Math.sqrt(maxPixels / (width * height)), maxDimension / width, maxDimension / height);
  return { width: Math.max(1, Math.floor(width * bounded)), height: Math.max(1, Math.floor(height * bounded)), scale: bounded };
}
