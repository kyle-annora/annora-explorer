# Open source integration plan for linked product drawings

Implementation update (2026-11-01): phases 1–3 are implemented in the drawing package, reader and Studio workflow. See [delivery review](drawing-workflow-review.md) for verification and the separately scoped Explorer refinements. The baseline audit below records the state before these changes.

Status: proposal for review. Date: 2026-11-01.

Annora should connect product understanding, engineering references and a reviewed
commercial conversation. The next delivery should make the existing linked
drawing preview reusable across products, give Studio a controlled way to author
those associations, and carry the same references through quotations and changes.
The current Explorer, its rendering modes and its public controller remain the
presentation foundation.

## Current implementation and gaps

The deployed preview already proves part-to-drawing navigation, authored detail
cameras, preserved source hashes, explicit inquiry attachment, review before
confirmation and saved-reference recovery. The original customer-project and
Studio storage are isolated from the drawing demonstration.

The next integration must address specific boundaries in the current code:

- `src/drawing-preview/app.js` imports one drawing and uses its first sheet.
- `context.js` and `model-views.js` contain linkrods-specific release, part and
  camera definitions. The four regions are curated features of one CAD solid.
- `src/product-room/drawing-inquiry.js` intentionally exposes an inquiry-only
  repository; it does not connect this sample to seller quotations.
- Studio's seed and `scripts/apply-room-release.mjs` currently support the crank
  product. Merely adding another drawing does not make seller publication generic.

The existing immutable inquiry/release contracts should be extended, not replaced.
An unchanged file hash establishes asset identity; pairing a supplier PDF with a
CAD revision additionally needs source evidence or explicit human confirmation.

## Source decomposition and adoption decisions

The following source snapshots were inspected. Findings describe those snapshots,
not a guarantee about later releases. No external project code was installed or
executed during this review.

| Project | Concrete source behavior | Annora decision |
| --- | --- | --- |
| Replicad `6ef8ae10` | STEP BRep import; visible/hidden projected edges; mesh face and edge groups | Trial an offline preparation adapter. Keep the CAD kernel outside the default buyer page |
| Archiyou `cd5f0642` | Document/page/view separation; resolved scale; annotation and geometry layers | Adopt the document-package and scale rules in Annora's own implementation |
| FreeCAD TechDraw `24ea8589` | Classified technical edges; base/detail/section relationships; drawing export | Use as engineering reference and an optional preparation-tool candidate |
| draftwright-rust `71a1e0d4` | Source-bound analysis, authored specification, resolved drawing plan and revision diagnostics | Adopt explicit diagnostics and unresolved-reference policy; evaluate generation separately |
| Chili3D `e35a8eec` | Hover detection, selection and completion are separate; overlapping candidates can be prioritized | Independently implement a small selection coordinator and Studio association flow |
| dxf-viewer `d601f94f` | Worker preparation, batched rendering, layers and viewport-coordinate conversion | Optional DXF model-space adapter after fidelity and performance gates |
| PDF.js `0a415334` | Original PDF rendering, page transforms, cancellation and visible-page scheduling | Preferred first new document adapter, inside existing Annora controls |

### Replicad and Archiyou

Replicad's [STEP importer](https://github.com/sgenoud/replicad/blob/6ef8ae10f7cb708ec34c74b37f3be255c3c2dbc8/packages/replicad/src/importers.ts)
uses `STEPControl_Reader` and `OneShape`. Its
[projection implementation](https://github.com/sgenoud/replicad/blob/6ef8ae10f7cb708ec34c74b37f3be255c3c2dbc8/packages/replicad/src/projection/makeProjectedEdges.ts)
uses OCCT hidden-line removal, and
[`drawProjection`](https://github.com/sgenoud/replicad/blob/6ef8ae10f7cb708ec34c74b37f3be255c3c2dbc8/packages/replicad/src/draw.ts)
separates visible and hidden drawings. These are useful derived views, not a
complete dimensioned manufacturing document or guaranteed assembly/BOM import.

Its [mesh groups](https://github.com/sgenoud/replicad/blob/6ef8ae10f7cb708ec34c74b37f3be255c3c2dbc8/packages/replicad/src/shapeFunctions/mesh.ts)
can support feature metadata during preparation. Its
[topology labels](https://github.com/sgenoud/replicad/blob/6ef8ae10f7cb708ec34c74b37f3be255c3c2dbc8/packages/replicad-opencascadejs/build-config/wrappers/shape-hasher.cpp)
are runtime-local. Persistent inquiry identities must remain Annora-authored and
revision-bound. Wrapper code is MIT; the OCCT package has separate LGPL terms.

Archiyou's [Docs](https://github.com/ArchiyouApp/archiyou/blob/cd5f0642d6d6fc3f9d7e8f38ab769d11e1abdb7a/packages/core/src/docs/Docs.ts)
and [View](https://github.com/ArchiyouApp/archiyou/blob/cd5f0642d6d6fc3f9d7e8f38ab769d11e1abdb7a/packages/core/src/docs/View.ts)
separate page layout, cached geometry, annotations and actual resolved scale.
Annora should likewise distinguish screen zoom from paper scale. Its
[SVG exporter](https://github.com/ArchiyouApp/archiyou/blob/cd5f0642d6d6fc3f9d7e8f38ab769d11e1abdb7a/packages/core/src/modeler/SVGExporter.ts)
separates screen and physical line weights. The current
[generic importer](https://github.com/ArchiyouApp/archiyou/blob/cd5f0642d6d6fc3f9d7e8f38ab769d11e1abdb7a/packages/core/src/importer/Importer.ts)
does not list STEP; its projection code also leaves correspondence work unresolved.
Use the active monorepo, not the archived `archiyou-core`, as the research reference.
Apache-2.0 covers application code; OCCT dependencies retain their own terms.

### FreeCAD and Draftwright

FreeCAD's [view model](https://github.com/FreeCAD/FreeCAD/blob/24ea8589aa8676049f7fe53ca9d1d1c398c38d26/src/Mod/TechDraw/App/DrawViewPart.cpp)
and [projection algorithms](https://github.com/FreeCAD/FreeCAD/blob/24ea8589aa8676049f7fe53ca9d1d1c398c38d26/src/Mod/TechDraw/App/ProjectionAlgos.cpp)
distinguish visible, hidden, smooth, seam and outline edges.
[Detail views](https://github.com/FreeCAD/FreeCAD/blob/24ea8589aa8676049f7fe53ca9d1d1c398c38d26/src/Mod/TechDraw/App/DrawViewDetail.cpp)
retain their base view, anchor and scale. These are useful metadata relationships.
[Page export](https://github.com/FreeCAD/FreeCAD/blob/24ea8589aa8676049f7fe53ca9d1d1c398c38d26/src/Mod/TechDraw/Gui/PagePrinter.cpp)
uses Qt GUI infrastructure, so unattended preparation needs an environment proof.
Inspected TechDraw files carry LGPL-2.1-or-later headers.

Draftwright's [document model](https://github.com/pzfreo/draftwright-rust/blob/71a1e0d4d8418f04d66fbf4fa868ad4f0fa19212/docs/model.md)
separates regenerated analysis, authored specification and resolved output. Its
[revision handling](https://github.com/pzfreo/draftwright-rust/blob/71a1e0d4d8418f04d66fbf4fa868ad4f0fa19212/src/revision.rs)
retains ambiguous and orphaned references for resolution instead of guessing.
Annora should apply this policy to drawing associations and commercial history.
The current [API](https://github.com/pzfreo/draftwright-rust/blob/71a1e0d4d8418f04d66fbf4fa868ad4f0fa19212/src/api.rs)
disables DXF export and exposes SVG, PDF and PNG. The code is AGPL-3.0-only;
direct incorporation requires a deliberate licensing and distribution decision.

The pinned [dw-examples corpus](https://github.com/pzfreo/dw-examples/blob/c4c72a71c6440f0c824678660b59d0474f105e71/README.md)
contains unreviewed outputs with source-specific asset licenses. Our existing rod
drawing was generated with 0.2.5. Regenerating it with another tool/version creates
a new derived asset revision. A successful process exit alone is insufficient:
per-part failures and diagnostic reports must also be checked.

### Chili3D and document viewers

Chili3D's [selection contract](https://github.com/xiangechen/chili3d/blob/e35a8eecba803a463698f2e49a7404f25c607ba5/packages/core/src/selection.ts)
and [selection manager](https://github.com/xiangechen/chili3d/blob/e35a8eecba803a463698f2e49a7404f25c607ba5/packages/app/src/selectionManager.ts)
separate preview, node/subshape selection and confirmed completion. Adopt that
interaction rule for seller association authoring. Runtime indexes are not
cross-revision product IDs. The TS application is AGPL-3.0; this proposal calls
for an independent, bounded implementation rather than copying its editor.

The [DXF viewer](https://github.com/vagran/dxf-viewer/blob/d601f94f7114d3df9044289ff185c460ab57fc40/src/DxfViewer.js)
provides layers and coordinate transforms, but pointer events return coordinates,
not a complete entity-selection contract. Its
[batching](https://github.com/vagran/dxf-viewer/blob/d601f94f7114d3df9044289ff185c460ab57fc40/src/BatchingKey.js)
groups render geometry independently of persistent inquiry identity. The
[limitations](https://github.com/vagran/dxf-viewer/blob/d601f94f7114d3df9044289ff185c460ab57fc40/README.md)
include incomplete paper space, line styles and advanced dimensions. It creates
another WebGL renderer, which makes side-by-side comparison a separate performance
decision. MPL-2.0 applies to its covered files and modifications.

PDF.js [page transforms](https://github.com/mozilla/pdf.js/blob/0a4153349dc473ba950fc17941c5ca7eda43c1de/src/display/page_viewport.js),
[render lifecycle](https://github.com/mozilla/pdf.js/blob/0a4153349dc473ba950fc17941c5ca7eda43c1de/src/display/api.js)
and [render queue](https://github.com/mozilla/pdf.js/blob/0a4153349dc473ba950fc17941c5ca7eda43c1de/web/pdf_rendering_queue.js)
fit original multipage document review. Use its Apache-2.0 library through a lazy
adapter. PDF page points, screen pixels and model millimeters remain distinct;
showing a drawing does not establish CAD measurement semantics.

## Proposed shared boundary

`Prepared product package → Explorer and Drawings → Product Room conversation`

Studio authors and publishes that package; the customer consumes the reviewed
release. The existing public Explorer controller stays the only bridge to 3D.

The proposed package groups six responsibilities:

1. **Assets:** original STEP/PDF/DXF hashes, derived asset hashes, conversion tool
   versions, units and source attribution.
2. **Release identity:** independent model revision, document revision, product
   release and mapping revision. A source snapshot is not a manufacturer revision.
3. **Sheets and views:** page size, rotation, coordinate frame, optional validated
   scale and relationships between base, detail and section views.
4. **Associations:** an authored feature ID, real part ID, document region and
   optional curated camera. Mapping states are confirmed, needs review or missing.
5. **Evidence:** original/generated document kind, pairing evidence, approval
   status and diagnostics. Manufacturing approval is never inferred from geometry.
6. **Capabilities:** available document adapters and supported actions. Unsupported
   formats or unavailable historical versions produce explicit states.

A selection coordinator records origin and revision so delayed 3D readiness,
hover events and document switches cannot overwrite a confirmed reference.
Inspection remains separate from attaching a requirement. Read-only adapters
expose load, locate, fit, select, pause/cancel and dispose with plain JSON data.

Proposed code responsibilities, subject to the first phase review:

| Area | Responsibility |
| --- | --- |
| `content/drawings/<product>/` | Source assets and versioned drawing packages |
| `src/drawings/` | Package validation, SVG/PDF adapters and shared selection |
| `src/drawing-preview/` | Thin independent review host |
| `src/studio/` | Pairing, association authoring and reviewed releases |
| `src/product-room/` | Immutable references in inquiry, quotation and change records |
| `scripts/cad/` | Optional offline preparation and diagnostics |

## Delivery sequence

| Phase | Work and deliverables | Acceptance gate |
| --- | --- | --- |
| 1 — General document package and reader | Move sample-specific definitions into data. Retain the SVG adapter and add a lazy PDF.js adapter for original multipage drawings. Deliver package schema, validator, API notes and a second paired product | Rod and second product use the same host without product branches. Rotation, zoom and page changes preserve regions. STEP/PDF identity and pairing evidence are checked. Existing Explorer and records pass regression |
| 2 — Studio association and publication | Pair source files; choose a real part; mark a document region; preview both directions; confirm or cancel. Add association status and document revision to existing draft/review/publish | A seller can publish a second product without editing source. Unverified, stale and missing associations are visible. Failed validation preserves the draft. Historical projects retain the old release |
| 3 — Full commercial reference loop | Make the drawing package available to the existing seller workspace. Preserve references in inquiry, quotation scope and change requests. Compare document/association versions independently from price/scope versions | One scenario runs inquiry → reviewed quote v1 → drawing-related change → reviewed quote v2 → agreed next step. Every message opens its original reference; an ambiguous replacement requires human resolution |
| 4 — Offline CAD preparation experiment | Trial Replicad on one single-solid and one multipart source. Produce prepared geometry, visible/hidden projected views and a diagnostic report. Evaluate FreeCAD separately if page/detail/section generation is needed | Validate units, geometry, part identity and projection fidelity. Reject flattened/lost assembly identity. Record time/memory. Buyer page downloads no CAD kernel. Generated views remain distinct from supplied drawings |
| Conditional — DXF support | Trial dxf-viewer against actual target-customer files; add an optional model-space adapter only if it passes | Layers, blocks, text, units and dimensions match the reference corpus. Unsupported paper-space content is reported. Compare meets a two-renderer budget or remains single-view. Original PDF stays accessible |

Phases 1–3 are the product priority. Phase 4 can be a separate technical experiment
after the package contract is locked; it must not delay the buyer/seller flow.
DXF is conditional on actual customer material. Geometry editing, automatic
manufacturing dimensioning and browser CAD-kernel execution require separate scope.

## Evaluation and customer review

Use at least two source-paired products and a deliberately changed revision. Include
a repeated-feature case, a removed feature, a rotated page and a multipage drawing.
Each fixture has expected associations and explicit source/approval status.

| Concern | Required evidence |
| --- | --- |
| Source identity | Hash mismatches fail; supplied revision and generated derivative are distinguished |
| Association correctness | Zero wrong-part/wrong-region matches in the fixture set; ambiguous matches remain unresolved |
| Version safety | Old inquiry and quotation reopen their own assets; a new revision never silently rewrites history |
| Review semantics | Selection does not submit; review does not confirm; stale review is rejected |
| Visual fidelity | Page rotation, line hierarchy, fonts, dimensions and crops checked against original documents |
| Navigation | Browser Back, return to project, deep links and missing-version recovery preserve context |
| Mobile | 320/390px touch, pinch, scroll, keyboard/focus and visible primary actions; one active presentation at a time |
| Performance | No CAD kernel in default buyer load; bounded page cache; cancelled obsolete loads; repeated switch/dispose returns resources to a bounded baseline |
| Regression | Apollo/crank interactions, guided tours, existing Room/Studio records and deployment subpaths remain intact |

Set numeric document size/page-count and device budgets from the initial customer
fixture set. Record hardware and network conditions; CPU throttling alone does not
establish ordinary-device performance.

The reviewable outcome is a seller-prepared product package whose 3D parts,
drawings and commercial decisions refer to the same known release. Patrick and
Wesley can demonstrate one continuous customer conversation, including a drawing
change that is resolved and carried into a new quotation.
