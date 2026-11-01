# Technical reading views across Drawings, Studio and Product Room

The subsequent [Drawing overview release](drawing-overview-review.md) replaces
the primary original-sheet mode with composed views and secondary Source PDF access.

## Delivered scope

The approved SK08 reading style now covers both paired products and the existing
seller and buyer drawing previews. Graphite contours, quieter hidden and center
lines, neutral dimension labels and Ember selection remain consistent. Technical
views use the original vector geometry with a reading composition; the original
PDF remains available as **Original sheet**.

| Product | Prepared views | Canonical coverage |
| --- | --- | --- |
| SK08 shaft support | Front, bore detail, top / mounting holes, side / cross-bore, isometric overview and mounting footprint | Seven existing details across both original and enlarged-reference sheets. Front/bore and side views also resolve their explicit sheet-2 aliases. |
| Connecting rod | Top, large bore, small bore, connecting web and isometric | Four existing details on the source sheet. The isometric composition is an alternative overview of the same part; it does not replace the canonical top-view region. |

Contours and highlights follow extracted source paths. Hole pairs and compound
features highlight their individual contours rather than a bounding rectangle.
Dimensions retain the source values and units, including the connecting rod's
unusual, source-printed 3.875 mm spacing. No tolerances or engineering approvals
have been added.

## Review route

1. Open the [SK08 drawing preview](https://kyle-annora.github.io/annora-explorer/drawing-preview/?product=sk08&view=drawings&detail=shaft-bore). Use the view selector to compare front, bore, top, side and isometric. Check 1×, 2× and 4×, then switch to **Original sheet**.
2. Open the [connecting-rod preview](https://kyle-annora.github.io/annora-explorer/drawing-preview/?product=linkrods&view=drawings). Inspect both bores and the connecting web. The source sheet is always one switch away.
3. Open [Studio drawings](https://kyle-annora.github.io/annora-explorer/studio/#drawings?product=sk08). **Inspect views** uses the same prepared reader. **Edit source regions**, any association-field edit and **Draw region** use original PDF coordinates. Review and published history use the shared reader as well.
4. From a technical detail, choose **Ask about this detail → Use sample details → Review inquiry → Confirm demo inquiry**. Open the saved project's **Conversation → Preview drawing**. The inline preview is pinned to that record. **Open this drawing** and **Return to project** keep the same source and detail.

Project IDs are browser-local and are not embedded in these review links. Sample
inquiries still require their existing review and confirmation. Existing quote,
revision-request, version-comparison and Explorer flows are unchanged.

## Reference and source rules

- Technical presentation IDs describe display choices only. They never replace
  model, drawing, mapping, asset, sheet, part or region identity in a business record.
- Each prepared binding requires the exact source drawing revision, model
  revision, source-file hashes, page frame and confirmed part/region geometry.
- A later mapping edition may reuse an unchanged binding. Its actual mapping ID
  stays in the saved reference. Changed bounds, part, focus point, camera or review
  status disable that feature's prepared view without disabling unchanged siblings.
- A new source PDF or incompatible association opens its own original sheet.
  Prepared A artwork is never displayed as B. Old records continue to resolve A.
- Recorded previews resolve exact available snapshots. Missing or ambiguous
  historical references show an unavailable state; they do not fall forward to
  a newer mapping.
- Studio authoring remains on original sheet coordinates. Inspection crops and
  recomposed annotations cannot be saved as source-region coordinates.

Original PDF, SVG, STEP, package and model files are unchanged. Asset provenance
and reproducible preparation are documented for
[SK08](../content/drawings/sk08/technical-multi-provenance.md) and
[the connecting rod](../content/drawings/linkrods/technical-reference.md).

## Implementation boundaries

- `src/drawing-preview/technical-catalog.js` discovers reviewed technical profiles
  and artwork. Profiles provide view variants, exact contour identifiers and
  explicit canonical aliases. Eligibility is checked separately for each feature.
- `src/drawing-preview/technical-view.js` renders inline vectors over the existing
  pan, pinch, selection and zoom controller. Source-path lookup is indexed once
  per preview, including the connecting rod's more detailed isometric drawing.
- `src/drawings/DrawingPreview.jsx` is the shared read-only React surface for
  Studio and Product Room. It offers technical/source selection and 1×/2×/4×.
- `src/drawings/reference-preview.js` resolves frozen references through injected
  catalog/repository dependencies. No backend or production account was added.
- Product Room mounts a reader only when **Preview drawing** is opened and
  disposes it on close. Original PDF assets are resolved when needed. Technical
  rendering adds no CAD kernel, WebGL context or animation loop.

Prepared assets remain repository-reviewed input. This release does not generate
a polished technical view automatically for an arbitrary uploaded drawing.

## Validation — November 1, 2026

| Check | Result |
| --- | --- |
| Repository validation, tests and production build | 521 tests: 520 passed, one existing conditional skip. Source/package checks and production build passed. |
| Prepared-view matrix | 126 combinations: nine SK08 bindings and five connecting-rod views × 1×/2×/4× × 1440/390/320 CSS-pixel widths. No overflow, page errors or source/detail mismatch. |
| Shared surfaces | 17 eligible prepared variants across 11 canonical details rendered through the shared component. |
| Source fidelity | Original file hashes verified. Technical/original switching keeps source, mapping, asset, sheet and detail identity. |
| Association eligibility | Changes to any of seven SK08 mappings disable only the affected prepared bindings; changed model/source identities reject prepared artwork. |
| Historical A/B preview | A technical preview → exact original A → imported/reviewed B original-only → reopen A technical. Context remains unchanged. Ambiguous legacy-reference rejection has regression coverage. |
| Studio authoring | Inspect → edit field / Draw region always returns to the source-coordinate editor. Review and history use the same read-only preview. |
| Actual inquiry pages | Both products: detail → reviewed inquiry → confirmation → project Conversation → inline preview → original sheet → open saved drawing → return to project. Exact reference preserved, no browser errors or 390 px overflow. |
| Interaction | Pointer selection covers bores, compound mounting features, web and overview; existing keyboard, pan and pinch behavior is retained. |
| Built deployment path | Both products and Studio checked through the production `/annora-explorer/` subpath. Twenty desktop/mobile view switches plus zoom/source controls passed with no failed asset responses. The complete inquiry/project return paths also passed against this build. |
| Limited performance check | With Chromium CPU throttled 4×, the slowest of ten sampled mobile view switches reached the next two animation frames in 93 ms. This is a local smoke check, not a low-end-device benchmark. |

Mobile checks use Chromium viewport/touch emulation on the development Mac. They
are not physical-phone or low-end-PC measurements. The original PDF reader keeps
its existing raster budget; prepared technical views remain vectors at deep zoom.

See the earlier [SK08 front/bore release](sk08-technical-view-review.md) for the
original design decisions and the [drawing revision workflow](drawing-revision-review.md)
for the unchanged A → B commercial-process contract.
