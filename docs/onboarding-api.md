# Prepared product onboarding API

The intake workbench converts one prepared product into a reviewed configuration export. It is a browser-local demonstration workflow, not a server upload, manufacturer approval, hosted publication, or CAD conversion service. The existing command-line preparation and deployment boundaries remain responsible for source preparation and hosting.

## Lifecycle and ownership

1. Prepare a model manifest, stable part identities, source evidence, and optional drawing package through the existing preparation tools.
2. Open the candidate in Studio intake. Inspect the original source and unit evidence; explicitly acknowledge both checks.
3. Associate each supplied drawing region with an existing prepared part. Confirm the mappings individually.
4. Save and preview the complete intake. Review warnings, source limitations, product copy, and associations.
5. Explicitly confirm the review and export the reviewed configuration.
6. Apply the exported package through the existing reviewed-package CLI, run project checks, and deploy separately. Confirm the hosted target before claiming publication.

The intake store never writes existing Studio releases, drawing history, inquiries, quotations, or customer projects. A product without drawings retains 3D inspection; missing drawings and motion are not generated or inferred.

## Prepared candidate

The host supplies a trusted, prepared descriptor. The browser does not accept an arbitrary source path or model URL from an exported packet.

```js
{
  id: 'product-id',
  model: { id: 'product-id', revision: 'exact-prepared-revision' },
  modelManifest: 'content/models/product-id/model.json',
  drawingDirectory: 'content/drawings/product-id', // null for 3D-only
  parts: [{ id: 'stable-part-id', title: 'Support body', parentId: 'product-root' }],
  drawingPartIds: ['stable-part-id'], // actual mesh-backed parts; excludes navigation groups
  source: { author: 'Source author', url: 'https://...', license: '...', note: '...' },
  units: { source: 'mm', display: 'm', evidence: 'Pinned preparation evidence.' },
  assets: [{ id: 'source-pdf', title: 'Original source PDF', revision: 'source-revision',
    type: 'PDF', sha256: '64-character source hash', fileName: 'source.pdf', url: '/resolved/source.pdf' }],
  drawingPackages: [normalizedDrawingPackage], // at most one in this intake
  bundledRelease: validPreparedSeedRelease,
  inquiryProfile: validPreparedInquiryProfile,
  posterAssetId: 'prepared-poster',
  readiness: { issues: [] }
}
```

The candidate fingerprint includes the fixed model identity, prepared paths, source evidence, unit evidence, part identities, source asset identities, and drawing geometry. It excludes delivery-specific asset URLs. Runtime URLs are resolved by the host and are absent from portable drawing and document snapshots.

A different candidate fingerprint does not silently migrate an existing intake. The repository returns `SOURCE_CHANGED` and preserves its saved data. Existing reviewed exports remain available through their original candidate version.

## Domain functions

Import from `src/studio/onboarding-domain.js`.

| Function | Result |
| --- | --- |
| `onboardingCandidateFingerprint(candidate)` | Deterministic evidence fingerprint. |
| `onboardingDrawingParts(candidate)` | Geometry-backed mapping choices, excluding Explorer root/group navigation nodes. |
| `createOnboardingDraft(candidate, { id? })` | New unsaved draft at revision `0`; both checks false and every supplied region needs review. |
| `normalizeOnboardingDraft(draft, candidate)` | Bounded portable draft. Incomplete editable copy can be saved; source edits cannot. |
| `validateOnboardingDraft(draft, candidate)` | Array of `{ code, path, section, message, severity }`; severity is `error`, `warning`, or `info`. |
| `buildOnboardingPreview(draft, candidate)` | Deeply frozen exact preview snapshot. Errors block it. |
| `createOnboardingReview(draft, preview, candidate)` | Deeply frozen review with a token, summary rows, and nonblocking issues. Requires an exact current preview. |
| `createOnboardingPackage(review, candidate, { id, createdAt })` | Validated, frozen reviewed export packet. |
| `assertOnboardingPackage(packet, candidate)` | Validated, frozen copy for the CLI or future service adapter; rejects unexpected payload fields and changed source identity. |

`OnboardingError` carries `code`, `message`, and optional `issues`. The fingerprints and review tokens detect stale or changed state; they are not cryptographic signatures, authentication, or authorization.

### Draft

```js
{
  schemaVersion: 1,
  id, revision, updatedAt,
  productId, modelRevision, candidateFingerprint,
  checks: { source: false, units: false },
  content,
  inquiryProfile,
  presentation: { defaultRenderStyle: 'engineering' },
  drawingPackage
}
```

Editable intake content is limited to `content.title`, `content.shortTitle`, and `content.summary`. Inquiry fields use the shared inquiry-profile contract. The initial render style is `engineering`, `linework`, or `flat`.

Drawing associations are edited directly on existing source regions using `partId` and `mappingStatus` (`needs-review`, `missing`, or `confirmed`). Publication requires every supplied region to resolve to a known geometry-backed part and be confirmed. Explorer root and group nodes remain available for navigation, but are not drawing-association targets. Changing a part association removes any camera or focus point authored for its previous part. Source PDF identity, asset hashes and paths, engineering annotations, page identity, region bounds, and region labels remain fixed.

The normalized mapping receives a deterministic `onboarding-map-…` revision. Source drawing revision and source asset hashes are unchanged. A new reviewed mapping never rewrites an old inquiry, quotation, or discussion reference.

An intake intentionally does not copy the seed technical story. After applying the reviewed package, the host rebuilds technical references against its exact confirmed mapping and creates the product presentation through the generic factory. No stale source mapping or unsupported motion is reused.

### Preview, review, and export

```js
// buildOnboardingPreview
{
  schemaVersion: 1, kind: 'annora-onboarding-preview',
  id, fingerprint, draftId, draftRevision, candidateFingerprint,
  productId, modelRevision, draft,
  drawingPackage, content, inquiryProfile, presentation
}

// createOnboardingReview
{
  schemaVersion: 1, kind: 'annora-onboarding-review',
  productId, modelRevision, candidateFingerprint,
  draft, preview, summary: [{ label, value }], issues, token
}

// createOnboardingPackage
{
  schemaVersion: 1, kind: 'annora-onboarding-package', source: 'demo',
  id, createdAt, productId, modelRevision, candidateFingerprint,
  modelManifest, drawingDirectory,
  draft, preview, reviewToken
}
```

The applying host consumes `packet.preview.drawingPackage`, `content`, `inquiryProfile`, and `presentation`. It must derive final technical context and release identity against this reviewed mapping. `modelManifest` and `drawingDirectory` must exactly match the registered candidate, and all packet source assets are revalidated against it. The preview is a record of what was reviewed, not a hosted release receipt.

## Browser repository

Import from `src/studio/onboarding-repository.js`.

```js
const repository = createOnboardingRepository({
  candidate,
  storage, // localStorage-compatible; defaults to browser storage
  key,     // defaults to annora.onboarding.v1:<product-id>
  now, makeId, locks // optional injectable clock, identifiers and lock manager
});

let draft = await repository.getDraft(); // existing draft or new unsaved revision 0
// Inspect source and edit the draft.
draft = await repository.saveDraft(draft);
const preview = await repository.createPreview(draft);
const review = await repository.review(draft, preview.id);
// Show review and receive an explicit confirmation from the operator.
const exported = await repository.exportReviewed(review);
const history = await repository.listExports(); // newest first
```

All methods are asynchronous. Reads return detached values. Saving a changed draft advances its revision; an unchanged save is idempotent. Preview and review require the exact saved draft. A saved edit invalidates a pending preview and review. Repeating an already completed export returns the original packet, even after later edits; it does not create another release.

The store retains previous previews and immutable reviewed exports. Malformed storage, changed source identity, stale revisions, or a failed storage write do not trigger automatic reset or migration. Storage uses optimistic revision checks and browser locks where available. The store is capped at 500 previews and 500 exports; this demonstration repository is not an archival backend.

Common error codes: `VALIDATION`, `SOURCE_CHANGED`, `INVALID_CANDIDATE`, `INVALID_DRAFT`, `INVALID_PACKAGE`, `PREVIEW_REQUIRED`, `STALE_PREVIEW`, `STALE_REVIEW`, `CONFLICT`, `STORAGE_CORRUPT`, `STORAGE_UNAVAILABLE`, and `STORAGE_LIMIT`.

## Future service adapter

A production adapter can implement the same save → preview → review → export contract. It must independently authenticate the operator, verify source access and redistribution rights, verify actual asset bytes against their stored hashes, enforce revision concurrency, and record server-issued audit receipts. The current browser checks acknowledge preparation evidence; they do not certify manufacturer requirements or manufacturing readiness.

Source preparation and real publication remain explicit operations. There is no backend URL, simulated delivery receipt, or claim that an exported package has reached customers.

## Verification

`node --test tests/runtime/onboarding.test.js` covers:

- Explicit source/unit checks and association confirmation.
- Fixed PDF identity, hashes, annotation geometry, source claims, and destination paths.
- Delivery-independent candidate fingerprints and deterministic mapping revisions.
- Missing capabilities without fabricated drawings or motion.
- Save, preview, review, and export boundaries; stale state and idempotent retries.
- Archived snapshots and unrelated customer stores remaining unchanged.
- Corrupt storage, quota failures, invalid package fields, and unavailable source versions.

UI, mobile, generic apply CLI, fresh-product build checks, and hosted target verification are additional delivery-level gates.
