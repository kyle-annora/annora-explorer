// This module is imported only when a PDF reader is mounted. The worker is a
// Vite-emitted, same-origin asset, not a CDN or a dependency on a hosted viewer.
import * as pdfjs from 'pdfjs-dist/build/pdf.mjs';
import workerURL from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerURL;

// Hashed Vite assets retain their public URL through a small file registry.
// Files are emitted at build time; only the fonts/CMaps/decoders requested by
// the opened document are fetched. No assets are requested on Explorer pages.
const files = import.meta.glob('/node_modules/pdfjs-dist/{standard_fonts,cmaps,wasm}/*.{pfb,ttf,bcmap,wasm,js}', { eager: true, query: '?url', import: 'default' });
const directories = { standardFontDataUrl: 'standard_fonts', cMapUrl: 'cmaps', wasmUrl: 'wasm' };
class BundledBinaryDataFactory {
  async fetch({ kind, filename }) {
    const file = files[`/node_modules/pdfjs-dist/${directories[kind]}/${filename}`];
    if (!file) throw new Error(`Unsupported PDF resource: ${filename}`);
    const response = await fetch(file);
    if (!response.ok) throw new Error(`The PDF resource could not be loaded: ${filename}`);
    return new Uint8Array(await response.arrayBuffer());
  }
}

export function loadPDFDocument(url) {
  return pdfjs.getDocument({ url, isEvalSupported: false, enableXfa: false, stopAtErrors: true,
    BinaryDataFactory: BundledBinaryDataFactory, useWorkerFetch: false, useSystemFonts: false,
    maxImageSize: 16_000_000, canvasMaxAreaInBytes: 32_000_000 });
}
