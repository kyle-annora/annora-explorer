# Studio drawing associations

The drawing workspace is a separate authoring flow for prepared CAD/drawing
packages. It uses the existing Product Room components and the public Explorer
controller. It does not modify Explorer rendering, existing product releases or
customer projects.

## Seller review path

1. Open **Drawing associations** in Studio and choose a prepared product/source
   version. The source PDF or SVG, STEP, model revision and asset hashes are fixed.
2. Choose a sheet and detail. Inspect the original drawing, then switch to **3D
   part** to check its linked component. Only one 3D iframe is mounted; it is
   disposed when the drawing is shown again.
3. Edit the customer-readable detail name, linked part, note or rectangle. Bounds
   use unrotated page coordinates from the upper-left corner, not physical part
   dimensions. **Preview region** shows the staged rectangle. **Confirm mapping**
   explicitly confirms the edited association. **Cancel edit** restores the
   current draft's association.
4. **Save draft** keeps work in progress. Unconfirmed, unresolved or invalid
   regions can be saved, but cannot be published. Switching regions stages an
   unfinished edit as needing review. Leaving the workspace offers save, discard
   or continued editing.
5. **Review release** saves the draft and checks all mappings, exact model part
   IDs, page bounds and source-pairing evidence. A distinct review page lists the
   customer-facing associations. The seller confirms the review before **Publish
   local release** becomes available.
6. Open the buyer preview or inspect release history. The **What changed** comparison separates document/model identities from detail labels, part links, page bounds, notes and confirmation states. Mapping versions are separate from commercial quotation versions. Each published release is
   immutable. A later edit creates another version; old inquiries must continue
   to use the snapshot they captured.

Source-pairing confirmation means the files belong together. It does not turn a
reference drawing into a manufacturing-approved drawing. Existing source status
and warnings are retained in review and published data.

## Host contract

```js
import { mountDrawingWorkspace } from './src/studio/drawing-workspace.jsx';

const workspace = mountDrawingWorkspace(element, {
  packages: drawingCatalog,
  initialPackageId: 'linkrods',
  explorerURL: 'https://example.com/explorer/',
  onPackageChange(productId) { /* update the host route */ },
  onPreview(record) { /* open a buyer host with record.packageSnapshot */ },
  onPublish(release) { /* record the new browser-local release */ },
  onBack() { /* return to Studio */ },
});

await workspace.beforeLeave(); // false when the seller chooses to keep editing
workspace.dispose();
```

A React host can mount the exported `DrawingWorkspace` directly. Its ref exposes
`beforeLeave()`. The catalog shape is:

```ts
type DrawingCatalogEntry = {
  id: string;
  title: string;
  package: DrawingPackageV2;
  assets?: Record<string, string>; // prepared asset ID or file path → resolved URL
  model: {
    id: string;
    revision: string;
    parts: Array<{ id: string; title: string }>;
  };
};
```

The host owns routing. The workspace does not change the URL itself, inspect the
iframe DOM or use private renderer state. New products enter through the catalog,
not model-specific UI branches.

## Repository API boundary

`createDrawingRepository({ packages, storage?, key?, now?, makeId?, locks? })`
returns the local demo adapter. An authenticated backend can replace this adapter
without changing the editor.

| Method | Result / guard |
| --- | --- |
| `getDraft(productId)` | Current source-version draft or a new unsaved draft |
| `saveDraft(draft)` | Optimistic revision check; preserves incomplete mappings |
| `reviewDraft(savedDraft)` | Validated immutable review packet pinned to the saved draft and active release |
| `publishReviewed(review, { confirmed: true })` | Immutable, versioned release; rejects stale review and repeats idempotently |
| `createPreview(savedDraft)` / `getPreview(id)` | Immutable validated buyer preview, pinned to the saved draft |
| `listReleases(productId)` / `getRelease(id)` | Read-only history, including earlier source versions |
| `getPublished(productId)` | Latest local release or `null` |
| `exportRelease(id)` | Serializable release without its local review token |

Storage uses `annora.studio.drawing-packages.v1`. It never reads or writes the
existing Product Room or Studio product namespaces. A source change creates a
separate draft key and leaves older drafts and release snapshots in place.
Malformed stores are reported without erasure. A failed write leaves the saved
draft and published version unchanged. Web Locks, where available, serialize
browser-tab writers; optimistic version checks reject stale editors.

Release records include `id`, `version`, `productId`, `modelId`, `modelRevision`,
`sourceRevision`, `mappingRevision`, `packageSnapshot`, `partIds`, `draftId`,
`draftRevision`, `createdAt`, `baseReleaseId`, `previousPackageSnapshot` and `source: 'demo' | 'preview'`. Source asset hashes,
page coordinates, part IDs and prepared engineering annotations are protected
from association edits. `mappingRevision` changes with the reviewed associations
and pairing evidence; the model and document identities do not.

A production adapter must additionally enforce authorization, authenticated
review, server-side validation, durable asset storage and concurrency. A review
token here is a local change identifier, not an authentication mechanism or a
digital signature. No backend is implemented in this demo.

## Verification

The focused suite is `tests/runtime/studio-drawings.test.js`. It covers explicit
confirmation, invalid bounds, nonexistent parts, immutable source identity,
source pairing, stale review, repeated publish, source-version replacement,
preview pinning, concurrent edits, storage failure and isolation from existing
customer data. Browser review should additionally verify original PDF rendering,
3D selection, keyboard controls, leave guards, 390px layout and the publish review
step. Do not infer production hardware performance from these checks.

## Apply an exported release to the static deployment

From a published release or its history view, choose **Export release**. The JSON
file is the direct `annora-drawing-release` record; it is not wrapped in a second
`release` property. Use Node.js 22.13 or newer:

```sh
npm run apply:drawing-release -- --file /path/to/DRAWING-RELEASE.json
npm run apply:drawing-release -- --file /path/to/DRAWING-RELEASE.json --replace
npm run verify
```

The first command stores a flat, immutable
`content/drawings/<prepared-folder>/release-<release-id>.json` and keeps the default
associations unchanged. The optional `--replace` also writes the reviewed mapping
snapshot to that folder's `package.json`. Before replacing a default, the importer
retains its previous snapshot in an existing release file or creates
`release-bundled-<fingerprint>.json`. That baseline has version `0`; its timestamp
records archival, not an unknown historical publication date.

The importer discovers the product through `project.config.json`, recomputes its
model revision from the real prepared package and verifies real part IDs. Every
source file is checked against its fixed SHA-256. It rejects previews, unresolved
associations, invalid page bounds, incompatible model versions, changed source
files, unsafe paths and attempts to rewrite an existing release identity. Only
mapping JSON is written; PDF, SVG, STEP and model assets remain unchanged.

Stored snapshots use `source: 'bundled'` and omit runtime asset URLs. The catalog
resolves their exact asset IDs and hashes to deployment URLs. Earlier snapshot
files remain available after the default changes. Review the resulting diff, then
commit and push through the existing deployment workflow. Applying a file does
not deploy the site or alter browser-local customer projects.
