# Drawing source versions and local PDF assets

Studio can import an original PDF as a new source version for an existing,
exactly identified model. The imported source starts unreviewed. Changing the
source does not change the model, update a customer project or replace an older
quotation. The seller reviews the drawing associations before publishing; the
commercial workspace separately reviews a project’s adoption of that release.

## Import boundary

```js
import { importDrawingPDF } from '../src/studio/drawing-source-import.js';

const savedBase = await repository.saveDraft(workingDraft);
const draftB = await importDrawingPDF({
  productId: 'sk08',
  file: selectedFile,                 // File, Blob or ArrayBuffer
  revisionLabel: 'Customer review B', // a label, not engineering approval
  baseDraftId: savedBase.id,
  repository,
  signal: abortController.signal,
});
```

`importDrawingPDF` returns a saved draft and makes it the active source draft.
It uses the repository’s asset store unless an `assetStore` is supplied. Import
checks the PDF header, computes SHA-256, inspects the original pages through the
existing lazy PDF.js worker and stores the original bytes before registering a
source version. It does not rasterize pages during inspection.

Limits are 32 MiB, 50 pages and page dimensions no larger than 14,400 points per
axis. The inspection timeout is 45 seconds. Damaged, password-protected,
unsupported, empty or oversized documents produce an actionable error. Abort,
timeout and failure release the inspection worker and temporary URL. A late lazy
runtime cannot create a worker after an import has already ended.

Copied associations retain their IDs and exact page coordinates only when those
coordinates still fit the corresponding page. Every copied association becomes
`needs-review`; an unplaced or invalid part reference becomes `missing`. A
changed page can have `bounds: null` until the seller draws a region. Associations
from removed pages remain in `packageSnapshot.unplacedMappings` and block release
until explicitly relocated or removed. No automatic geometric remapping occurs.

Source annotations such as dimensions are not carried forward as claims about a
new PDF. An authored camera may remain on an unchanged, valid part/detail. A
redrawn region or changed part clears the earlier camera and focus point; newly
drawn regions use the ordinary part view until a suitable view is authored.

The package’s original `sourceURL` remains the prepared CAD source link. Imported
PDF provenance is recorded separately in `sourceOrigin` with the original file
name, SHA-256, import time, source-version ID and preceding source revision. The
interface labels this link as the prepared model source, not the uploaded PDF.

## Repository additions

The existing `annora.studio.drawing-packages.v1` JSON namespace remains readable.
New optional `sourceVersions` and `activeDrafts` collections preserve earlier
stores, drafts, release IDs and mapping revision calculations.

| Method | Contract |
| --- | --- |
| `getDraft(productId, {sourceVersionId?, draftId?})` | Returns the selected source draft; without a selector, returns the active compatible draft |
| `getDraftById(id)` | Reads a saved draft without changing the active version |
| `selectDraft(id)` | Changes the active saved draft; the prior draft remains stored |
| `listSourceVersions(productId)` | Returns prepared and imported source records with labels, source snapshots and draft IDs |
| `createSourceDraft(productId, inspectedSource, options)` | Registers inspected, durably stored PDF bytes and creates an unreviewed saved draft |
| `exportAsset(releaseId, assetId)` | Returns an imported original Blob, its SHA-256 filename and relative package path |
| `assetStore` | The asynchronous immutable original-file adapter |

The usual save, review, preview and publish APIs remain unchanged. Review and
publication verify that local originals still exist and match their hashes.
Missing browser files block publication while preserving metadata and earlier
history. A restored source must have the exact original hash; a new file is a new
source version.

Imported drafts carry `sourceVersionId` and an immutable
`sourcePackageSnapshot`. The repository validates these against its registered
source record rather than trusting an editable draft payload. A new source does
not gain permission to replace model bytes, model revision, STEP geometry or
prepared source identities.

## Association operations

```js
addDrawingMapping(draft, entry, sheetId, {
  id, label, partId, bounds, note,
  fromUnplacedId, // optional explicit relocation from a removed page
});
updateDrawingMapping(draft, entry, sheetId, regionId, patch, {confirm: true});
removeDrawingMapping(draft, entry, sheetId, regionId);
removeUnplacedDrawingMapping(draft, entry, unplacedId);
confirmDrawingPairing(draft, entry, evidence);
```

These pure functions return new draft values. They accept the original catalog
entry even when editing an imported source draft. New regions are unconfirmed.
`confirm: true` requires a real part ID and a positive in-page rectangle. Added,
removed and relocated identifiers are recorded in `regionChanges`; removed IDs
are not reused for different details. A final release retains this change record
so the static importer can validate authored additions and removals.

## Durable assets and temporary rendering URLs

`createDrawingAssetStore()` uses IndexedDB database
`annora.studio.drawing-assets.v1`, store `assets`. Blobs are inserted once under
`sha256:<64 lowercase hex characters>` and are never overwritten or automatically
deleted. The adapter verifies stored bytes when they are read. Hash mismatch,
quota exhaustion, blocked upgrades, unavailable storage and missing originals
have distinct errors. An injected asynchronous backend supports tests or a
future authenticated storage service.

A persisted imported asset looks like:

```json
{
  "id": "pdf-<sha256>",
  "kind": "pdf",
  "file": "imports/<sha256>.pdf",
  "sha256": "<sha256>",
  "byteLength": 123456,
  "localBlobKey": "sha256:<sha256>"
}
```

No object URL is stored in a source record, draft, project or release. Resolve
assets only while a reader is mounted:

```js
const lease = await resolveDrawingAssets(packageSnapshot, {
  assetStore: repository.assetStore,
  resolveBundledAsset: (asset, pkg) => lookupExactBundledHash(asset, pkg),
});
mountReader(lease.package);
// After disposing the reader:
lease.dispose();
```

The lease returns `{package, assets, dispose}`. `package` is a transient clone;
never save it. `dispose()` revokes all locally created URLs and is idempotent.
Partial resolution failure also revokes already-created URLs. An explicit
bundled resolver is authoritative. When omitted, a trusted catalog package can
use its existing non-blob asset URL. The root host resolves archived bundled
files by exact hash, never by substituting the current drawing.

The browser is still a local demo store. Clearing site data removes local files.
If metadata registration fails after a Blob has been safely stored, the Blob may
remain unused; the importer does not risk deleting bytes that another tab or
release might already reference. Production needs authenticated durable storage,
retention, server-side validation and explicit lifecycle management.

## Optional static deployment of a reviewed imported PDF

Export the release JSON and each new original PDF through `exportAsset`. Put
`<sha256>.pdf` files in a local folder, then run:

```sh
npm run apply:drawing-release -- --file /path/to/release.json \
  --asset-dir /path/to/exported-originals --replace
npm run verify
```

The importer validates the exact configured model and real parts, reviewed
pairing and regions, immutable source-version baseline, actual PDF SHA-256, byte
size and original page dimensions. It adds new bytes only at
`content/drawings/<product>/imports/<sha256>.pdf`; existing source files are never
overwritten. Without the matching original it rejects the import explicitly.
Apply source releases in order so preceding source versions remain available.

Deployment snapshots omit `localBlobKey` and all runtime URLs. The previous
default and earlier source files remain available. `--replace` changes the default
package only after validation; omitting it stages the immutable release. This
command does not deploy or alter customer projects. The drawing checker rejects
browser-local file references in static packages.

## Evaluation

`tests/runtime/studio-drawing-import.test.js` covers inspection, limits,
cancellation, late runtime cleanup, SHA deduplication, corruption, quota,
source A/B retention and reload, missing and removed pages, region authoring,
source tampering, URL leases and unavailable originals. Existing authoring tests
cover review confirmation, stale edits and concurrency.
`tests/drawing-release-import.test.mjs` additionally installs a real PDF B in a
temporary project and proves that its bytes and page dimensions match while A
remains unchanged. Browser checks cover actual IndexedDB and PDF.js import,
source switching, reload, drawing gestures, review and publication.
