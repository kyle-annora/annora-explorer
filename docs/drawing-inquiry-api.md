# Drawing inquiry integration

The drawing preview reuses the Product Room buyer workspace, validation, saved
drafts and review-confirmation action. It does not create a second inquiry form
or send requests to a backend.

## Host contract

Create one repository per mounted host using
`createDrawingProjectRepository()` from
`src/product-room/drawing-inquiry.js`. Pass it to `createWorkspace()` from
`src/product-room/workspace-entry.jsx` with the existing `onNavigate(route)` and
`onExplore(context)` callbacks.

- Open `{ view: 'inquiry', context }` after the visitor selects a drawing detail.
- Open `{ view: 'projects', context }` to list this preview's saved inquiries and
  drafts. The context supplies a default for a new inquiry.
- Open `{ view: 'project', projectId }` to reopen a confirmed inquiry. Its saved
  context is authoritative; do not replace it with the current selection.
- `onExplore(context)` receives the saved selection when the visitor chooses
  **View selected detail**. Check that its model, drawing and asset revisions are
  available before navigating. If unavailable, explain which version is missing;
  never silently substitute a newer sheet.
- Use `beforeLeave(nextRoute)` before leaving the workspace. It saves pending
  input and prevents losing an incomplete reviewed action.
- The workspace uses `readBuyerRoute`, `buyerRouteHash` and
  `annora:routechange` from `src/product-room/navigation.js`. The host also
  handles hash/history navigation. Inquiry contents and review tokens do not
  belong in URLs.

The normal details → review → explicit confirmation sequence remains intact.
Opening a review, selecting a drawing area, or choosing sample details never
submits an inquiry.

## Optional drawing context

Existing product contexts remain valid and unchanged. A drawing context adds:

```json
{
  "productId": "bearing-study",
  "productTitle": "Bearing housing",
  "modelId": "bearing-study",
  "modelRevision": "model-r1",
  "part": { "id": "housing", "title": "Housing" },
  "drawing": {
    "id": "housing-drawing",
    "title": "Bearing housing drawing",
    "revision": "A",
    "assetId": "housing-sheet",
    "assetRevision": "sha256:example-content-hash",
    "partId": "housing",
    "sheetId": "sheet-1",
    "sheetTitle": "Sheet 1 · Housing",
    "regionId": "bore",
    "regionLabel": "Bearing bore",
    "sourceURL": "https://example.org/pinned-source/housing.pdf"
  }
}
```

This is a schema example, not the provenance of the published model. All fields
are nonempty strings. `partId` must match `context.part.id`. The model and its
revision are required. The source must be an HTTP(S) URL without embedded
credentials. Titles and identifiers are limited to 320 characters; the source
URL is limited to 2,048 characters.

`revision` identifies the drawing issue or pinned design version. `assetRevision`
identifies the actual drawing artifact, preferably by its content hash. They are
separate because a rendered drawing asset can change without changing the
human-readable drawing title. The importer/host owns verification of the
STEP/drawing pair and region-to-part mapping. This context validator checks the
record's structure and consistency; it does not establish engineering validity.

For a configured inquiry form, use `contextForRelease(release, { part, drawing })`.
The saved release must contain a document matching the drawing's `id`, `title`,
`revision` and `assetId`. The exact release and form profile stay with the inquiry.
This does not require adding the preview product to Studio's managed catalog.

## Identity, review and persistence

The draft identity includes product, model revision, optional product/form
release, and drawing id/revision/asset id/asset revision. A different drawing
version starts a separate draft. Selecting another region of the same drawing
does not discard entered information: the saved reference remains until the
visitor explicitly chooses **Use current product reference**.

The drawing's part cannot be removed independently. The complete drawing
reference enters the same review seal as customer input. Editing its region or
revision after review invalidates the old confirmation. Confirmed inquiries are
immutable snapshots; reopening them preserves the exact reference and does not
assign the current model or sheet version.

The preview uses `annora.drawing-preview.projects.v1` in browser storage. It never
reads, migrates or clears ordinary Product Room or Studio records. Local storage
failures retain input and report an error. Malformed stored references are
rejected without resetting records.

`capabilities.inquiryOnly` tells the shared workspace to omit seller handoffs and
quotation actions unsupported by this preview. Normal Product Room, Studio and
walkthrough repositories retain their existing capabilities and behavior.

## Future API boundary

A real host can replace the repository using the existing asynchronous contract
in [Product Room API](product-room-api.md). Preserve the complete drawing context
in saved drafts, review packets and project responses. The server must validate
access, allowed part-to-region mappings, exact available revisions and confirmed
requirements independently. A browser review seal is an accidental-change guard,
not authorization or a security signature.

Viewed geometry and drawing dimensions remain reference context. They never
become confirmed requirements automatically. Fictional sample details remain
editable and require the same explicit review and confirmation as typed details.

## Checks

`tests/runtime/drawing-inquiry.test.js` covers exact-reference round trips,
separate version identity, changed-selection review rejection, invalid context,
historical release matching, storage isolation and corruption preservation.
Run the normal project verification and test the mounted host on desktop and
mobile before release.
