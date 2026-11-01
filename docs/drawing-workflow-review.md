# Drawing workflow and Explorer delivery review

Delivery date: 2026-11-01. This increment implements the approved drawing-package plan, then returns to the existing Explorer interaction refinements. Public demo data remains browser-local. No backend, account service, email, order or payment integration was added.

## Review links

- [Linked 3D and drawings](https://kyle-annora.github.io/annora-explorer/drawing-preview/?product=sk08&view=compare)
- [Studio drawing associations](https://kyle-annora.github.io/annora-explorer/studio/#drawings?product=sk08)
- [Existing Explorer](https://kyle-annora.github.io/annora-explorer/?model=kinetic-01)

Use the same browser for buyer and seller views. Their demonstration records share an isolated local repository; another device will not see them.

## What is implemented

| Area | Delivered behavior |
| --- | --- |
| Prepared drawing packages | Exact model, source-file and association identities; confirmed/needs-review/missing mappings; evidence of the STEP/PDF relationship; source hashes checked in CI |
| Original document reader | Lazy PDF.js, original PDFs, multiple sheets, pan/zoom/fit/rotation, bounded raster size, cancellation and disposal. Prepared SVG remains supported. Hidden readers pause |
| Independent second product | FreeCAD SK08 shaft support, one actual CAD body, two clearly labelled reference sheets, seven drawing regions. Original STEP and original PDF retained. Features are not invented assembly parts |
| Seller authoring | Choose product, sheet, real part and region; edit label/bounds; preview; explicitly confirm association; save draft; review; confirm local publication. Invalid mappings cannot publish |
| Version handling | Immutable local previews/releases, source-versus-association comparison, portable export, validated static application and archival of previous defaults. Unavailable references remain unavailable across reload; using the current reference is an explicit action |
| Commercial conversation | Drawing inquiry → seller draft → reviewed quote v1 → customer change → reviewed reply → reviewed quote v2 → comparison → requested and confirmed next step. The initial model/drawing/sheet/detail/mapping reference stays pinned |
| Explorer refinement | Selecting a part retains opened sibling branches. Overlay changes/rotation retain the framed component. An orbit that returns to its start does not become a click. Compact mobile details retain Inspect/Fit |
| Offline preparation experiment | Replicad imports and projects the real source successfully. A named two-solid algorithm fixture exposes loss of the product/name tree and unstable face IDs. Kept as an offline candidate, never added to buyer runtime |

Engineering, Linework and Flat Ember remain available. Existing short action timing, tour playback controls and visual style are retained. No additional Explorer render pass or animation clock was introduced.

## Demonstration route

1. Open the SK08 paired preview. Choose the enlarged detail sheet, rotate it, select the shaft bore and locate its real parent body in 3D.
2. Choose **Ask about this detail**. Use editable fictional details, review, then confirm. Check the exact reference in the saved project.
3. Choose **View as seller**. Prepare a quotation, review the customer-facing version, then explicitly issue the local demo quotation.
4. Return through **View as buyer**. Request a drawing-related change, review and confirm it. In Studio, respond to the requested topics and issue a reviewed next version.
5. Compare quotation versions, choose an engineering review as the next step, then acknowledge that request in Studio. Earlier quotations and the source reference remain unchanged.
6. Separately open Studio Drawings. Change a region label, confirm its association, save, review and publish. Inspect the source/association comparison and open the exact published preview. This does not alter the existing inquiry.

## Verification evidence

- `npm run verify` passed: 473 tests total, 472 passed, one existing conditional skip, no failures. This includes package/source-byte validation, mapping, reader coordinates, cancellation, publication, import/archive, review tokens, commercial versions and navigation.
- The complete browser path above passed in development and the compiled repository subpath for SK08 sheet 2: two quotation versions, one customer change, one next-step request and two seller messages; the original context remained byte-equivalent.
- Drawing and Studio browser checks covered 1440px desktop, 390px and 320px portrait layouts, product switching, two sheets, rotation, publication, frozen buyer preview, unsaved-navigation choices and source links. No horizontal overflow or JavaScript errors in the checked flows.
- Explorer checks covered 1440×900, 390×844, 320×740 and 844×390. Crank and Apollo retained all three display styles, tour pause/exit restoration and working canvas click/double-click. An out-and-back orbit did not change selection. Settled idle produced zero additional renders during a 600ms observation.
- Existing Product Room, Studio and walkthrough namespaces are unchanged; the drawing commercial repository retains its previous namespace and records. Historical contexts without a mapping revision retain their prior draft identity.

These are functional checks and bounded observations, not an FPS or load-time commitment for ordinary customer computers. Apollo remains an optional large download. The final release should be checked on the representative client device before a performance commitment.

## Deployment and handoff

`npm run check` now verifies the bytes and associations of drawing packages as well as model packages. `npm run apply:drawing-release -- --file <export.json>` stages an immutable static release. Add `--replace` only after reviewing the source/association diff to make it the default; the previous default is archived. It does not deploy or alter browser projects. Run verification and use the existing GitHub deployment workflow afterwards.

The drawing editor is an association editor for prepared assets. It does not import arbitrary CAD, infer tolerances, certify drawings or silently remap features across revisions. Source document revisions, association revisions and quotation versions have separate identities and comparisons. Customer source revisions need an explicit migration/review process before adoption by an existing project.

Relevant contracts:

- [Reader and package API](drawing-reader-integration.md)
- [Studio association workspace and static release application](studio-drawing-workspace.md)
- [Buyer/seller inquiry API](drawing-inquiry-api.md)
- [Open-source decomposition and implementation plan](drawing-open-source-plan.md)
- [Offline CAD experiment, measurements and identity gate](offline-cad-preparation.md)

A real multipart customer assembly and a production server adapter remain separate acceptance gates. The algorithm fixture is not evidence of production assembly import support.
