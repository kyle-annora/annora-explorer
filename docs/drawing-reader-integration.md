# Drawing package and reader integration

The drawing layer is separate from the existing Explorer runtime. Hosts select a model, sheet and region; the reader renders the source page and maintains its own document pan, zoom and accessible detail targets. The 3D scene does not acquire another WebGL context.

## Package contract

`src/drawings/package.js` exports:

- `normalizeDrawingPackage(input, {modelRevision, assetURLs})`: returns an independent schema version 2 value or throws `DrawingPackageError` with structured `issues`.
- `validateDrawingPackage`: the same structural validation entry point.
- `releaseDiagnostic(package, {partIds, modelRevision})`: returns `{valid, issues}`. Each issue has `code`, `path`, `message` and `severity`. Errors block publication. An honest unreviewed-reference warning does not imply manufacturing approval.
- `resolveSheetContext(package, sheetId, regionId?)`: returns `{package, sheet, region, asset}` or `null`.
- `sourceAssetFor(package, assetId)`: follows an explicitly declared derived-source chain to the original asset.

Each package declares exact `modelId`, `modelRevision`, document `revision`, and independent `mappingRevision`. Every asset carries its SHA-256 identity and a package-relative `file`. The host resolves those files to public build URLs through `assetURLs`, keyed by asset ID or file name. The validator does not download or compute source hashes; the import/build evaluation must compare declared hashes against the redistributed bytes.

```json
{
  "schemaVersion": 2,
  "id": "example-drawing-package",
  "modelId": "example-model",
  "modelRevision": "exact-model-revision",
  "title": "Reference drawing",
  "revision": "exact-document-revision",
  "mappingRevision": "mapping-001",
  "sourceURL": "https://supplier.example/drawing.pdf",
  "units": "mm",
  "status": "unreviewed-reference",
  "pairing": {
    "status": "human-confirmed",
    "evidence": "Original STEP and PDF checked against the same supplied revision."
  },
  "assets": [{
    "id": "original-pdf",
    "kind": "pdf",
    "file": "source.pdf",
    "sha256": "REPLACE_WITH_THE_64_CHARACTER_SHA256_OF_THE_ACTUAL_FILE"
  }],
  "sheets": [{
    "id": "sheet-1",
    "title": "Front and section views",
    "assetId": "original-pdf",
    "format": "pdf",
    "pdfPage": 1,
    "coordinateFrame": "page-top-left",
    "viewBox": [0, 0, 800, 600],
    "rotation": 0,
    "regions": [{
      "id": "bore",
      "label": "Bearing bore",
      "partId": "actual-imported-part-id",
      "mappingStatus": "confirmed",
      "bounds": [100, 150, 60, 40],
      "camera": {
        "target": [0, 0, 0],
        "direction": [0, 0, 1],
        "halfSize": [1, 1, 1]
      }
    }]
  }]
}
```

The example is a contract illustration. Its placeholder hash and part ID must be replaced with real imported identities before use.

Coordinates use the unrotated source page's top-left, in PDF page points. They are independent from source geometry units (`mm`, `cm`, `m`, `in`, or explicitly `unknown`). PDF view boxes start at `[0, 0]`; width and height must match `page.getViewport({scale: 1, rotation: 0})`. `rotation` is clockwise presentation rotation, with explicit values 0, 90, 180 or 270. It does not rewrite stored region coordinates. Intrinsic PDF page rotation is not silently inherited: the authored mapping and explicit sheet rotation define the presentation.

Regions are semantic authored links, not generated CAD faces. Multiple bores or views can refer to one real imported solid. Region bounds must remain inside the page. Authored camera vectors use the model's coordinate space; they are not inferred from drawing dimensions. The host applies the model package's transform before moving its camera.

`mappingStatus` is `confirmed`, `needs-review` or `missing`. Unresolved drafts can retain a null or outdated part ID so that authors can repair them. The release gate requires a real part registry, confirms each association and rejects a mismatched model revision. `pairing.status` is `source-derived`, `human-confirmed` or `unverified`, always with written evidence. Unverified pairing blocks publication. A derived PDF or SVG includes `sourceAssetId` pointing to its source; chains must resolve without cycles.

Schema version 1 metadata is explicitly normalized to a PDF package. It retains the previous `${drawing.id}-pdf` asset ID, source SHA and region IDs. It is not automatically upgraded to confirmed source pairing. Saved inquiries must retain their original document, model and mapping versions; unavailable versions are shown as unavailable rather than replaced by the current package.

## Host API

```js
import { createDrawingReader } from './src/drawings/reader.js';

const reader = createDrawingReader({
  mount,
  package: resolvedPackage,
  sheetId: 'sheet-1',
  onSelect(regionId, canonicalRegion) {
    // Select the real part and optionally use its authored 3D camera data.
    // Do not save presentation-rotated coordinates into an inquiry.
  },
  onViewChange({ zoom, canZoomIn, canZoomOut, rotation, loading, error }) {
    // Update host-owned controls without changing sheet selection.
  },
  onError(error) {
    // Keep the original PDF download accessible and show an honest error.
  },
});

await reader.ready;
reader.select('bore', { focus: true });
reader.rotateBy(90);
// On unmount or before replacing the sheet:
reader.dispose();
```

The factory returns immediately so a host can dispose an abandoned load. `ready` resolves after the initial render, resolves to null after early disposal, or rejects on a real load/coordinate error. Hosts may either await it or handle `onError`. Toolbar state is host-owned.

The PDF controller exposes `select`, `focusRegion`, `fit`, `zoomBy`, `resize`, `setRotation`, `rotateBy`, `pause`, `resume`, `dispose`, plus getters `element`, `selectedId`, `zoom`, `rotation`, `pageCount` and `isDisposed`. Programmatic selection is silent and does not echo a 2D-to-3D event. `onSelect` always returns the canonical authored region. The shared SVG adapter exposes the original selection/pan/zoom API and a ready Promise; it expects a pre-oriented sheet with rotation 0. Use the PDF adapter for interactive rotation.

Only one sheet is mounted at once. The host owns multi-sheet selection and disposes the previous reader before mounting the next. When a mobile layout hides drawings, call `pause`; call `resume` when visible again. Ordinary scrolling remains available; document zoom uses toolbar controls, pinch, or Ctrl+wheel. Keyboard users can Tab to a detail and activate it with Enter or Space.

## Rendering, performance and dependencies

`pdfjs-dist` is pinned to **6.4.299**, the official Mozilla distribution checked during this implementation. It requires Node **22.13 or later** (or supported later majors); the existing Vite 7 and Three.js versions remain unchanged.

The original PDF is rendered by PDF.js, not an external PDF iframe. `pdf-runtime.js` is dynamically imported only on a PDF mount. Vite emits the same-origin worker, fonts, CMaps and decoders; ancillary resources are fetched only when required by the opened document. No external CDN is needed. The PDF document cannot execute JavaScript or XFA workflows through this reader.

Rendered pixels appear inside the existing SVG paper viewport. Region outlines and interactive targets remain vectors. Zoom replaces the artwork image without recreating the pan/zoom layer. Presentation rotation rotates the PDF artwork and the canonical overlay bounds together. Page dimensions are checked before any region is displayed; a mismatched source revision fails visibly.

The default whole-page raster budget is **8 million pixels**, **4096 pixels per side**, and effective DPR **at most 2**. It can be lowered through `maxPixels` and `maxDimension`. Rendering is event-driven and debounced by 100 ms. Panning does not rerender the PDF. Stale renders are cancelled and cannot replace a newer page orientation. Transient canvases are released after encoding. The retained image URL is revoked on replacement or disposal; disposing also destroys the PDF loading task and worker transport. Whole-page raster limits mean extremely deep zoom eventually stops adding raster detail; use the original PDF download for print-scale inspection.

The reader currently focuses on drawing display and authored regions. It does not provide PDF text editing, form filling, measurement, manufacturing validation or a CAD kernel.

## Evaluation and attribution

Run `node --test tests/drawing-package.test.mjs tests/runtime/drawing-pdf.test.js`. Coverage includes real source-file hashes, source/model/mapping identity, invalid and unresolved associations, publication gates, rotations, bounded raster allocation, silent programmatic selection, stale rendering, pause/resume, errors and disposal during all loading stages. Full host evaluation must also traverse the buyer/seller context and saved versions.

PDF.js is Apache-2.0. Its fonts, Adobe CMaps and decoders have additional bundled notices. The build's `LICENSES.txt` must include the PDF.js root license and the relevant `standard_fonts/LICENSE_*`, `cmaps/LICENSE` and `wasm/LICENSE_*` files alongside model/source attribution. Official reference: [PDF.js examples](https://mozilla.github.io/pdf.js/examples/) and [Mozilla PDF.js repository](https://github.com/mozilla/pdf.js).
