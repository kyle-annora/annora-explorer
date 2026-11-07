# Prepared products and technical stories

W40 · Reusable prepared-product host contract. This is a static demonstration
with browser-local product releases and customer projects. It does not add a
backend, upload service, manufacturer approval or production quotation pricing.

## What is reusable

`src/product-room/prepared-products.js` owns a data-only registry and readiness
report. A host supplies prepared descriptors; the Explorer renderer is unchanged.
`src/product-room/prepared-catalog.js` registers the current crank and SK08
packages. Customer copy and the SK08 initial story live in
`content/rooms/sk08/release.json`, alongside the existing crank release.

| Prepared product | Available story types | Deliberate limitation |
| --- | --- | --- |
| Crank-slider | Captured view, prepared 2–3 second action | No fabricated engineering drawing |
| SK08 shaft support | Captured view, pinned technical drawing detail | One rigid source body; no invented movement |

The same Studio repository, draft validation, release review and story player
serve both. A product without motion can still publish a static or drawing story.
Missing drawing assets disable the affected technical choices and block release
of a story that still references them. They do not disable ordinary 3D browsing.

## Descriptor boundary

Create a descriptor with these fields, then register it with
`createPreparedProductRegistry(descriptors)`:

| Field | Meaning |
| --- | --- |
| `id` | Stable product identity; independent from a release ID |
| `model` | Prepared model catalog entry, including exact revision and authored actions |
| `parts` | Named root, groups and parts with stable IDs and parent IDs |
| `source`, `units` | Source attribution/license and explicit source-to-display unit evidence |
| `assets` | Trusted managed document IDs, revisions, URLs, file names, and drawing hashes |
| `bundledRelease`, `originalRelease` | Current bundled seed and retained original product release |
| `inquiryProfile` | Product-specific labels and supported inquiry field visibility |
| `posterAssetId`, `posterTitle`, `posterURL` | Prepared product image and customer-readable title |
| `commercial` | Explicit workflow mode; currently `sample` or `none`, never inferred pricing |
| `drawingPackages` | Exact prepared source packages used by technical steps |
| `overviewViews` | Available prepared view versions and their source feature targets |
| `technicalReferences` | Confirmed reading references described below |
| `resolveContent` | Optional trusted host resolver; the default resolves exact managed asset versions |

`preparedProductParts(metadata)` flattens the existing model package hierarchy;
it does not infer new parts or mechanical relationships. Registry construction
rejects duplicate product IDs atomically. The resulting descriptors are frozen
copies, so editing a Studio draft cannot change the registered source package.

Public accessors:

```js
const registry = createPreparedProductRegistry(descriptors);
const product = registry.get(productId); // null when unregistered
const products = registry.list();
const exactProduct = registry.forRelease(savedRelease);
```

`forRelease` rejects a missing product or mismatched model revision. It never
loads the current product into an older saved record. The host must display the
unavailable-history state and preserve that record.

## Exact technical references

The technical story extension is additive to existing `chapter` and `inspection`
steps. Each option is `{ id, title, nodeId, technical }`. Its `technical` value
comes from `createTechnicalStoryReference` in `technical-story.js` and pins:

- Model ID and revision, part ID, and the linked drawing feature.
- Drawing ID and source revision, asset ID and SHA-256, sheet and region IDs.
- Confirmed mapping revision, page number and page rotation.
- Explicit overview snapshot/revision and view ID, or explicit source-only mode.

Construct references through the existing `createDrawingContext`, using a
confirmed region from the exact prepared package. Registry readiness checks
model/part identity, source hash, page, mapping status, original asset availability
and overview associations. Story publication additionally requires an exact match
to an available registered reference. The product document list must retain the
same source ID, title, revision and asset ID, so the selected detail can enter the
existing inquiry contract. A user-edited step title does not change source
identity. No dimension, tolerance, motion or approval is synthesized.

Changing a drawing source or overview does not mutate an existing story. Review
and publish a new product release with new references. A historical release keeps
its original technical payload; if the source can no longer be resolved, the
reader reports that limitation instead of falling forward to a newer file.

## Studio integration

Inject the same descriptor into both the repository and domain validation:

```js
const repository = createStudioRepository({ product });
const issues = validateStudioDraft(draft, { product });
const review = createReleaseReview(savedDraft, publishedRelease, { product });
```

`normalizeStudioDraft`, `validateRelease`, `validateReleasePackage` and
`studioChanges` accept the same `{ product }` option. Existing callers default
to the crank descriptor. The existing storage key remains
`annora.studio.products.v1`; other products use
`annora.studio.products.v1:<product-id>` unless a host provides an explicit key.
This keeps the new SK08 draft/release history separate from existing crank work.

Saving, previewing, reviewing and confirming publication remain separate actions.
A changed saved draft invalidates its earlier review. A failed write retains the
old published release. Repeating the same confirmed review is idempotent. Export
still contains a reviewed release and its managed document manifest.

Apply an exported release through the existing command:

```sh
npm run apply:room-release -- --file reviewed-release.json --replace
```

The importer resolves its product from the trusted build registry and validates
the exact model, document assets and technical references before writing
`content/rooms/<product-id>/release.json`. It rejects arbitrary product paths,
previews, changed content under the same release ID and unavailable sources.
This updates prepared content only; it does not publish the website or modify
browser projects. Run verification, review the content diff and use the existing
deployment workflow afterward.

## Readiness is scoped

`preparedProductReadiness(descriptor)` returns independent viewer, story,
inquiry and commercial states, available step types, source evidence, counts and
actionable issues with fix paths. It does not label a model quote-ready merely
because it renders.

Generate a report from the same trusted catalog used by the application:

```sh
node scripts/report-prepared-products.mjs --out work/prepared-products/readiness.json
```

The command also constructs an inquiry draft for every registered technical
reference using the actual bundled product release. It exits nonzero when a
registered product, bundled release or detail-to-inquiry handoff has an error.
It does not read browser projects or claim visual/performance acceptance.

SK08 source units are documented by its pinned preparation provenance and
manifest as millimeters, converted to meters for display. Its legacy metadata
field `orientation.sourceUnits` still says `unverified`; the report retains this
caveat rather than rewriting source metadata. Source drawing status remains
`unreviewed-reference`. Confirmed associations mean that the selected feature
matches the prepared reading view, not that a manufacturer approved the drawing.

This batch proves reuse across two already prepared products. Arbitrary CAD
conversion, fresh-model onboarding, private document uploads, authenticated
hosting and production commerce remain separate work packages.

## Validation

`tests/runtime/prepared-products.test.js` covers isolated second-product
publication, unavailable/mismatched references, frozen registration, missing
capabilities, exact historical records, stale reviews, failed persistence and
semantic drawing-reference changes. Existing Studio and story regressions remain
part of `npm run verify`.

Before publishing a new package, inspect the compiled repository subpath on
desktop and mobile: preview a technical step, switch to 3D and back, open the
original PDF, start a request about that exact detail, review/confirm it, and
reopen the saved source from the seller workspace. Record real browser results
separately from this contract; do not infer performance on untested hardware.
