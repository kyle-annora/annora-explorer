# W41 fresh-product source handoff

Status: prepared and locally checked; publication and operator confirmation are owned by the parent work unit.

## Candidate

`nema17-bracket` — an Apache-2.0 NEMA 17 bent motor bracket from build123d, with its same-source generated drawing in dw-examples. It is entirely new to this catalog. The part remains one CAD solid; aperture, motor holes and base slots are associated features, never fabricated assembly parts.

Source pins and original license are in `content/drawings/nema17-bracket/README.md` and `source-attribution.md`. The original PDF, STEP and review JSON are preserved byte for byte. Source notes identify missing general tolerance and incomplete through-step dimensioning. No motion, load performance, material specification or manufacturing approval is asserted.

## Registration inputs

- Model manifest: `content/models/nema17-bracket/manifest.json`
- Model revision: `sha256:7606153455cb7659be54549a18d6cb0bf2b4d998050dfb6b556f16c2a281ab74`
- Drawing intake input: `content/drawings/nema17-bracket/intake-source.json`
- Drawing working/release target: `content/drawings/nema17-bracket/package.json`
- Poster: `content/drawings/nema17-bracket/poster.svg`
- Source PDF: `content/drawings/nema17-bracket/source.pdf`
- Source STEP: `content/drawings/nema17-bracket/nema17-bracket.step`
- Drawing ID: `build123d-nema17-bracket-drawing`
- Drawing revision: `annora-reference-1`
- Initial mapping revision: `annora-nema17-map-1`
- Root/group/part: `nema17-bracket` / `motor-bracket` / `nema17-bracket-body`
- Detail IDs: `motor-aperture`, `motor-mounting-holes`, `base-slots`
- Source-coordinate frame: page top-left; PDF page 1; A3 landscape; millimeters as printed; scale 2:1.

The three draft regions start `needs-review`. `intake-source.json` must remain unchanged. The release flow can replace `package.json` with the reviewed edition. Build checks intentionally reject publication while these mappings remain unconfirmed.

## Prepared reading views

- `nema17-technical-front-v1:front:sheet-1` — motor aperture.
- `nema17-technical-front-v1:mounting:sheet-1` — motor mounting pattern, using the same front source vectors.
- `nema17-technical-base-v1:base:sheet-1` — six base slots.

All three reading variants use source PDF vectors with a shared 1000 × 720 reading frame. Current associations are source-backed but require explicit operator confirmation before publication. The PDF and model source identities remain the basis of version binding. Poster artwork copies the source isometric vector paths.

## Evidence

`source-validation.json` records:

- Original STEP/PDF hashes verified.
- Single body identity and exact model revision verified.
- Initial release correctly blocked for all three unconfirmed links.
- An in-memory confirmed copy passes release validation while retaining the unreviewed-reference warning; no real record is auto-confirmed by this check.
- Three technical reading variants and three overview entries resolve using the shared catalog.
- Every highlight path exists and every prepared hit region is inside its view.
- Eight PDF-to-CAD dimension checks pass within 0.0001 mm.
- Original source sheet, front reading view, base reading view and poster were rendered and visually inspected.

Runtime browser verification, mobile touch checks and actual operator publication are intentionally left for the complete W41 walkthrough; no such checks are claimed here.

Geometry: 3,396 triangles / 3,436 vertices; 30,723 bytes gzip mesh; 9,243 bytes gzip creases; 15,561 bytes gzip contours. Front/base vectors are about 10 KB each. Original PDF is 76,732 bytes and loads separately. The source sheet fallback is 437,451 bytes uncompressed; avoid loading it before a user requests the original sheet. No CAD kernel is shipped to the browser.

## Manual preparation count

Five preparation activities were required:

1. Qualify the source, license and paired model/drawing identity.
2. Convert STEP offline into a rigid GLB, retaining dimensions and units.
3. Author one model definition and run the unchanged generic model importer.
4. Identify three source-backed draft feature associations and cameras.
5. Compose two readable technical views and a poster from original vectors.

The operator review still requires three explicit link confirmations and a release review. There are zero shared renderer/runtime edits in this source work. Two product-local Python preparation helpers plus the existing tessellator wrapper make the offline asset preparation reproducible; they do not imply a universal zero-preparation CAD pipeline.

## Identity correction before publication

The first unpublished intake draft mistakenly used the source GLB checksum (`035248…eae1`) as `modelRevision`. The authoritative model revision is the composite manifest-and-assets identity from `loadProject`: `sha256:7606153455cb7659be54549a18d6cb0bf2b4d998050dfb6b556f16c2a281ab74`. The intake input, working package, validation and preparation helper were corrected before release; original model, STEP and PDF bytes did not change. Preparation/validation now query `loadProject` directly. Any local browser draft created from the earlier input must be restarted before review.

`source-audit.json` adds a second verification pass: four files freshly downloaded from pinned upstream match the local bytes, the STEP independently matches the original build123d commit, one solid and the original cylinder radii are verified, GLB coordinate conversion/bounds match the tessellation, and all 88 technical view geometry paths are preserved under their documented uniform transform (maximum rounding error below 0.000001 presentation units).

## Overlapping source details

The front aperture and motor-hole pattern have naturally overlapping bounding rectangles in the original PDF. Shared hit testing cannot infer intent from those rectangles. The prepared overview therefore presents one linked feature per reading variant: aperture, mounting pattern, then base slots. The original source regions and vector geometry are unchanged. In the original PDF/association review, use the explicit linked-detail list to choose the intended feature. No shared hit-testing or renderer change was introduced.

The independent audit also remeasures all eight baseline dimensions directly from the original PDF at 2:1, rather than trusting prepared metadata. Maximum error is below 0.000007 mm (PDF coordinate rounding). Exact source region rectangles remain unchanged by the reading-variant split.
