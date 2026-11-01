# Studio repository and release contract

The Studio shell accepts an asynchronous repository through `createStudio(element, { repository })`. The included `createStudioRepository()` adapter stores fictional authoring records in the current browser. Replacing this adapter must preserve review and version boundaries; it does not add a server to the Explorer.

## Ownership

| Module | Responsibility |
| --- | --- |
| `src/studio/domain.js` | Draft normalization, field/reference validation, change comparison, review packets |
| `src/studio/repository.js` | Draft persistence, immutable previews/releases, optimistic concurrency, export |
| `src/studio/seed.js` | Prepared crank references, managed sample assets, bundled content |
| `src/studio/app.jsx` | Products, lifecycle, persistence and release confirmations |
| `src/studio/editor.jsx`, `preview.jsx`, `ui.jsx`, `navigation.js` | Editing sections, buyer preview, shared patterns and routes |
| `src/product-room/release-content.js` | Exact release selection and isolated buyer preview repository |
| `src/product-room/inquiry-profile.js` | Shared supported inquiry field configuration |
| `scripts/apply-room-release.mjs` | Validated static package installation before a normal build/deployment |

## Adapter methods

All methods return promises. Returned records are copies. Mutations report success only after persistence succeeds.

| Method | Contract |
| --- | --- |
| `listProducts()` | Compact product/draft/release summary records |
| `getDraft(productId)` | Existing draft or an unsaved copy of the current release |
| `saveDraft(draft)` | Save with optimistic draft revision check; incomplete copy is allowed |
| `getPublished(productId)` | Active local-demo release or the bundled baseline |
| `getRelease(releaseId)` | Exact released snapshot; no silent substitution |
| `listReleases(productId)` | Released versions for the prepared product |
| `createPreview(savedDraft)` | Validate and preserve an immutable preview of an exact saved draft |
| `getPreview(previewId)` | Exact preview snapshot; unavailable IDs fail clearly |
| `reviewRelease(savedDraft)` | Validated draft, active base release, differences and review token |
| `publishDemo(review)` | Confirm the reviewed draft; append a new local demo release; duplicate retries reuse the same receipt |
| `exportRelease(releaseId)` | Portable reviewed release and managed asset manifest; previews cannot be exported as releases |

Test/host options for `createStudioRepository` include `storage`, `key`, `now`, `makeId` and `locks`. The storage key is `annora.studio.products.v1`; the store schema version is 1. Cooperating tabs use Web Locks where available and reject stale drafts. This is not cross-device synchronization or a database transaction service.

## Records

A **draft** contains `id`, `revision`, `productId`, `modelRevision`, `content`, `inquiryProfile`, `presentation` and `updatedAt`.

A **release** contains `id`, `version`, `productId`, `modelRevision`, `content`, `inquiryProfile`, `presentation`, `createdAt` and `source` (`bundled`, `demo` or `preview`). Preview records additionally identify their saved draft and draft revision. Release identity and model identity have separate meanings.

`content` retains the buyer Room structure: identity/copy, highlights, questions, grouped facts, source attribution and documents. It adds `partContent` entries with an exact `nodeId`, customer-facing title, explanation and related document IDs. Fact status is `verified`, `illustrative` or `unverified`; an unverified claim must remain an explicit unknown rather than a specific unsupported performance value.

Documents retain their own ID, metadata, revision/date and optional component association. `assetId` and `assetRevision` pin a prepared managed file separately from the document's editable metadata revision. Stored arbitrary URLs, temporary upload URLs and private attachments are not accepted as document assets. The host resolves allowed assets for its own build path. An overview highlight can reference a fact by `factId`; the buyer renderer resolves its value from that same fact so overview and specification values stay consistent.

The **inquiry profile** contains a stable ID, field-configuration version and supported fields. Each field defines `id`, `label`, `hint`, `unit`, `enabled` and `required`. Application and quantity remain required; standard units and the review/confirmation flow cannot be changed by content authors. Optional field labels, help text and visibility can change in a new profile version.

`presentation.defaultRenderStyle` selects an existing supported render style. It does not mutate model geometry, material definitions, motion or tour scripts.

## Customer history and preview isolation

New buyer contexts pin `roomReleaseId`, `inquiryProfileVersion`, the profile snapshot and `roomSnapshot`, in addition to the exact model revision. A linked document retains its revision. Draft identity includes these versions so a new content release does not silently reuse an old draft. Legacy records remain explicitly unversioned.

The preview query is `?studioPreview=<id>`; a released local demo can be opened with `?release=<id>`. Both require the exact snapshot and never silently resolve to the latest product. Preview inquiry/quotation interactions use a separate in-memory customer repository. They do not write to `annora.product-room.projects.v1`.

## Validation and errors

`validateStudioDraft`, `validateRelease` and `validateReleasePackage` return issues with `path`, `section`, `message` and `severity`. The UI links an issue back to the relevant editor section. Invalid references, model mismatch and incomplete required content block release; explicit unknown technical details remain visible warnings.

Expected adapter failures include `VALIDATION`, `STALE_REVIEW`, `CONFLICT`, `NOT_FOUND`, `UNSUPPORTED_PRODUCT`, `STORAGE_UNAVAILABLE`, `STORAGE_CORRUPT` and `INCOMPATIBLE_RELEASE`. Failed writes retain the user's screen inputs and do not produce a success receipt. Corrupt/unknown saved schemas are not erased automatically.

Review tokens detect accidental edits and duplicate confirmations. They are not authentication, authorization, approval signatures or secrets. A future service must validate payloads, ownership, version checks, idempotency and publication permission at its own transaction boundary.

## Static export and deployment

The package has `schemaVersion: 1`, `kind: "annora-room-release"`, `release` and `assetManifest`. The importer validates the current prepared model and known assets, then writes the reviewed content to `content/rooms/kinetic-01/release.json`. It rejects repurposing the same release identity for changed content. A replacement requires explicit `--replace`.

Applying the file does not deploy it. The normal `npm run verify` and GitHub Pages workflow remain the publication path. Browser-only demo receipts must never be reported as successful hosted deployments. Future service adapters may implement real publication orchestration without changing the Explorer runtime.
