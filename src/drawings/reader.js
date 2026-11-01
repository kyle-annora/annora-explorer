import { createDrawingView } from '../drawing-preview/drawing-view.js';
import { createPdfDrawingView } from './pdf-reader.js';
import { resolveSheetContext } from './package.js';

/** Shared low-level reader; hosts own sheet selectors, downloads and toolbars. */
export function createDrawingReader({ package: pkg, sheetId, assetURL, ...options } = {}) {
  const context = resolveSheetContext(pkg, sheetId);
  if (!context) throw new TypeError('The requested drawing sheet does not exist.');
  const url = assetURL || context.asset.url;
  if (!url) throw new TypeError('Resolve this drawing asset URL before mounting its reader.');
  if (context.sheet.format === 'pdf') return createPdfDrawingView({ ...options, assetURL: url, sheet: context.sheet });
  if (context.sheet.rotation) throw new TypeError('Prepared SVG adapters require an unrotated source sheet. Use the original PDF reader for display rotation.');
  const view = createDrawingView({ ...options, assetURL: url, sheet: context.sheet });
  view.ready = Promise.resolve(view);
  return view;
}

export { createPdfDrawingView } from './pdf-reader.js';
