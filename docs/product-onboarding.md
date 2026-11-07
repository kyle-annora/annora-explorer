# Prepared product onboarding

This workflow takes a new, qualified model and drawing through Studio checks,
explicit part associations, a saved preview and a reviewed export. The deployment
owner applies that export to the template and publishes through the existing
GitHub workflow. Browser review does not itself publish a website.

Use the NEMA 17 motor bracket as the complete example. It is a new public source,
not a copy of the crank or SK08. Customer inquiries, quotations and notes remain
fictional browser-local records. See [the API boundary](onboarding-api.md).

## Who does what

| Owner | Job | Result |
| --- | --- | --- |
| Preparation operator | Qualify rights, units, geometry, source drawing and stable identities | Versioned prepared files and candidate recipe |
| Seller in Studio | Check source evidence, name the product and confirm each drawing association | Saved preview, explicit review and portable JSON export |
| Deployment owner | Validate the export against trusted files, check the build, publish and verify the target | Registered Room, exact release receipt and live link |

No new renderer or product-specific JavaScript is needed for another product
that fits this contract. CAD conversion, meaningful hierarchy and authored
technical compositions still require source preparation. This is not an arbitrary
CAD-upload or automatic engineering-approval service.

## 1. Prepare and qualify the files

1. Verify that the source can be redistributed. Keep its license, author,
   attribution, pinned source revision and original files together.
2. Record source units and the conversion into the viewer's display units.
   Inspect the geometry and source drawing together. Do not infer tolerances,
   manufacturing approval or animation from geometry.
3. Prepare a rigid GLB using [the model contract](models.md). Use unique mesh
   names and stable part identities. Import with the existing CLI:

   ```sh
   npm run import:model -- --source path/to/model.glb --definition path/to/import-definition.json --out content/models/my-product
   ```

4. Add `content/models/my-product/manifest.json` to `project.config.json`'s models
   list, then run `npm run prepare:project`. The resulting model revision is the
   **composite package identity**, not the GLB file hash. Never hand-edit
   `src/generated/` or substitute the GLB hash for the package revision.
5. Prepare `content/drawings/my-product/intake-source.json` and an initial
   `package.json` with the same source. Use the exact configured model revision,
   original PDF hash, page dimensions, region coordinates and existing part IDs.
   New associations start `needs-review`. Preserve the original STEP/PDF. Regions
   are prepared source locations; this intake does not invent drawing geometry.
6. Supply a source-derived SVG poster and optional technical/overview profiles
   under the same drawing directory. Existing drawing schema validation and
   exact-source rules apply. A source with incomplete engineering information
   remains explicitly a reference after review.
7. Create `content/onboarding/my-product/candidate.json`. Copy the structure of
   the NEMA 17 candidate and change its data: safe product ID, model manifest,
   drawing directory, names, units evidence, poster filename, source label and
   creation date. `commercialMode: "sample"` enables fictional inquiries and
   quotation drafts. It does not assert a real commercial offering.

The candidate catalog discovers these data files. If an asset or exact model
revision is missing, Studio reports the problem instead of substituting another
product. The initial whole-project drawing check can report unconfirmed links;
complete the following review before attempting a release build.

## 2. Check and associate in Studio

Open **Products → Add prepared product** (`studio/#onboard`).

1. **Source checks:** review the original files, provenance, license and units
   evidence. Edit the public title, short title and summary. Explicitly confirm
   both checks, then **Continue to details**. Empty or incomplete checks block
   progress. Save draft is secondary and remains browser-local.
2. **Link details:** select a prepared source region, inspect its drawing and
   corresponding 3D part, choose the intended part, then **Confirm this link**.
   Confirm every region. Changing a part requires confirmation again. Overlapping
   source rectangles are disambiguated through the named detail list; do not
   assume a rectangle is a separately manufactured part.
3. **Save and preview:** inspect the saved copy, each linked detail and the 3D
   model. Mobile opens the drawing first and starts 3D only when requested.
   Only one existing Explorer is mounted. The exact model/PDF/mapping versions
   stay attached to the preview.
4. **Review this package → Confirm review:** check the product and all confirmed
   links. Editing after preview invalidates that preview and review. Create a
   new preview rather than bypassing the confirmation.
5. **Export reviewed package:** download the JSON. The result is **Ready for
   deployment**; it is not a cloud receipt. Keep the export with the work unit's
   evidence. Existing products and customer project records are not modified.

## 3. Apply and publish

Run from the template checkout containing the same prepared files:

```sh
npm run apply:onboarding -- --file path/to/my-product-reviewed-package.json
npm run verify
npm run build:inquiry
```

The command verifies source bytes, exact model revision, candidate identity,
confirmed mappings and reviewed preview. It rejects an existing registration;
it cannot overwrite an established product or silently upgrade its projects.
It creates a product registration, bundled Room release and onboarding receipt
under `content/rooms/my-product/`, and applies the confirmed mapping to the
product's drawing package. `intake-source.json` and the original files remain
unchanged. Validation failures must leave the repository unchanged.

Review the resulting diff. Run the browser checks below against the compiled
site with its actual deployment subpath. Commit the source, reviewed data and
evidence, then push through the configured Pages workflow. Verify the workflow
result, public asset identities and live journey before describing it as
published. Record the application commit separately from a later receipt-only
commit. The CLI receipt alone is not deployment proof.

## 4. Acceptance checklist

- Source rights, original file hashes, units and package revision agree.
- Every drawing association is explicitly confirmed; unknown parts, edited
  source coordinates, missing files and stale review are rejected.
- Model, original PDF and technical views open and identify the same source.
- The new Room is discoverable without a shared-renderer or host-specific branch.
- A buyer can inspect a detail, create and review a sample inquiry, and return
  to the exact model/drawing evidence. Studio can prepare, review and issue a
  fictional quotation with that reference preserved.
- Existing crank and SK08 projects, historical quotations and drawing A/B
  records continue to open at their original versions.
- At 320/390 px widths, controls remain reachable, page content does not overflow,
  drawing gestures work, and switching between drawing and 3D does not duplicate
  renderers. Test keyboard focus and unsaved-navigation recovery.
- Record browser, viewport and quality settings. Emulation is not evidence of
  physical low-end device performance.
- Source state, browser export, applied repository data and verified live release
  each have distinct evidence.

## Changes and recovery

For a deployed product, use the existing Studio product/drawing revision workflow.
Do not rerun new-product onboarding to rewrite its identity. Old inquiries and
quotations retain their saved source snapshots. If preparation changes, create a
new candidate/revision and review again; do not edit an old export token.

Corrupt or unavailable browser storage is an error, not an empty successful
save. Keep the original browser record and retry in a functioning environment.
An unavailable source must be repaired before review. A build or deployment
failure leaves publication pending even when the local package was applied.
