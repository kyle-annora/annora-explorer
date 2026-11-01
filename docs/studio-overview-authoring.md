# Studio drawing overview authoring

## What ships

Sellers can configure the prepared SK08 and connecting-rod drawing overviews in
Studio, review the same reader buyers will use, and publish an immutable local
demo release. A new inquiry pins that overview; quotations and discussion records
retain the context of their project. Editing the current overview never updates
an issued quotation or silently moves an existing inquiry to another layout.

- [SK08 Studio](https://kyle-annora.github.io/annora-explorer/studio/#drawings?product=sk08)
- [Connecting-rod Studio](https://kyle-annora.github.io/annora-explorer/studio/#drawings?product=linkrods)
- [SK08 buyer view](https://kyle-annora.github.io/annora-explorer/drawing-preview/?product=sk08&view=drawings)
- [Connecting-rod buyer view](https://kyle-annora.github.io/annora-explorer/drawing-preview/?product=linkrods&view=drawings)

No backend, account, cloud synchronization or manufacturer delivery is added.
**Publish local release** makes the reviewed version available to Product Room
in the same browser. The exported package can be installed and deployed through
the existing GitHub Pages pipeline. Local release and hosted deployment remain
distinct actions.

## Seller path

1. Open **Drawings**, choose a product and source version, and use **Overview**.
2. Add or remove prepared views. Drag to reorder, or use the up/down controls.
   Change a customer-facing title and choose which view opens first on narrow
   screens. A sheet supports up to eight views.
3. Enable a clickable feature and choose its source detail. The linked model
   part is shown alongside the selection. A changed link requires **Confirm
   link**. Use **Inspect source association** to review the original PDF region
   and part through the existing association editor.
4. Test the overview and selected view in **Customer preview**. Unconfirmed or
   stale links remain noninteractive. The original PDF is always accessible.
5. Save the draft or open **Buyer preview**. **Review release** lists overview
   changes separately from document and association changes. Explicitly confirm
   the review, then publish. Editing after review makes that review stale.
6. Open the released buyer view. Revisit **Release history** to inspect an earlier
   version. Publication does not change existing customer projects.

The initial view is a presentation preference, not the selected engineering
reference. Recorded mobile previews may prioritize their pinned feature, while
fresh buyer views respect the seller's initial-view choice.

## Scope and design decisions

This editor arranges existing prepared vector views. It does not generate a new
technical drawing, change engineering dimensions, infer hole identities or turn
an arbitrary uploaded PDF into the curated vector style. Imported source B keeps
its own original PDF until compatible prepared views are available and reviewed.

The approved Studio visual system remains dominant: neutral surfaces, fine
dividers, compact controls, and Ember for selected state and the main action.
The existing [Studio design references](studio-design.md) and the
[Framer editor reference](https://refero.design/pages/0ccbb46d-45ef-4266-956a-0834be4846bf)
inform the list/canvas/selected-settings organization. On small screens, Views,
Preview and Settings are separate local panels. Up/down controls provide a
keyboard and touch alternative to drag reordering. Publication uses the existing
review gate rather than a new competing action path.

## Independent identities

| Identity | Meaning | Changes when |
| --- | --- | --- |
| Drawing/source revision and file SHA-256 | Exact original document and model package | A different source is imported |
| Mapping revision | Original-page regions and their model-part associations | Reviewed source associations change |
| Overview revision | Visible views, order, titles, initial view and feature bindings | Seller presentation configuration changes |
| Quotation version | Commercial offer issued for a project | A new reviewed quotation is issued |

Presentation-only edits do not change the engineering reference or create another
commercial job automatically. An existing draft resumes its saved context. A new
inquiry created after submission receives the current published overview.
Quotations subsequently prepared for an older project retain that project's
overview. Engineering-reference adoption remains a separate explicit workflow.

## Presentation contract

`presentationSnapshot` is stored beside `packageSnapshot` on drawing drafts,
previews and releases. It is not inserted into the immutable source identity.

```ts
type OverviewPresentation = {
  schemaVersion: 1;
  revision: string;
  sourceKey: string;
  sheets: Array<{
    sheetId: string;
    defaultViewId: string | null;
    views: Array<{
      id: string;
      viewRevision: string;
      title: string;
      targets: Array<{
        targetId: string;
        regionId: string;
        associationKey: string;
        confirmed: boolean;
      }>;
    }>;
  }>;
};
```

The source key binds exact source assets, model identity and page coordinates.
The view fingerprint binds prepared SVG bytes and the view profile. Each feature
binds a prepared hit target to a canonical original-page region; its association
key detects changes to that region's part, bounds or camera reference. Fingerprints
are change detectors, not authentication signatures.

Saved customer drawing contexts carry `presentationSnapshot` and its
`presentationRevision`. The snapshot contains configuration and immutable asset
references, not duplicated SVG bytes. Explicit `null` means source-only. Older
records without presentation data use the fixed `overview-legacy.json` baseline
when compatible, never the seller's latest configuration. Missing or changed
prepared assets fall back to the exact original PDF.

Standalone URLs use `overview=<revision>` to pin a saved configuration. The
existing `presentation=overview|technical|source` parameter controls display mode
only. Unknown overview revisions and conflicting source identifiers cannot be
silently rewritten into a new inquiry reference.

## API and implementation boundaries

| Boundary | Responsibility |
| --- | --- |
| `src/drawings/overview-presentation.js` | Pure snapshot normalization, revision creation, source/link validation, comparison and prepared-view resolution |
| `src/drawing-preview/technical-library.js` | Shared browser/build resolution of exact prepared geometry |
| `src/studio/drawing-repository.js` | Save, immutable preview, reviewed publication, history and export |
| `src/studio/drawing-overview-editor.jsx` | Seller view selection, ordering and explicit feature-link confirmation |
| `src/drawings/DrawingPreview.jsx` | Shared buyer/seller renderer; explicit snapshot or source-only mode |
| `src/drawings/reference-preview.js` | Exact historical source and overview resolution |
| `scripts/lib/overview-catalog.mjs` | Node adapter using the same prepared-view validation as the browser |
| `scripts/apply-drawing-release.mjs` | Validated static installation and archival |

The repository API remains `getDraft → saveDraft → createPreview/reviewDraft →
publishReviewed`, with existing concurrency, stale-review and repeated-publication
guards. `getRelease` and `exportRelease` include the overview snapshot and its
revision. Future authenticated hosts can replace this local adapter without
changing the editor or Explorer controller.

`overview-views.json` remains a seed list. `overview-legacy.json` preserves the
original pre-editor layout. A static installation can write
`overview-presentation.json` as the reviewed current configuration; earlier
releases retain their own snapshots. An original asset or prepared view must not
be overwritten under a reused identity.

To install a reviewed export, use the existing command:

```sh
npm run apply:drawing-release -- --file /absolute/path/to/release.json --replace
npm run verify
```

The importer archives the preceding source and presentation, validates the
prepared geometry and original files, then updates the default. It does not
modify customer projects or deploy the site itself. See
[deployment](deployment.md) for the separate commit/build/deploy path.

## Evaluation

Focused runtime and static-install coverage includes:

- Immutable v1/v2 releases and presentation-only changes with an unchanged mapping.
- Saved v1 inquiry, quotation and discussion; new v2 inquiry and quotation.
- Unconfirmed, stale or changed feature links and invalid prepared assets.
- Explicit source B rejection of source A's artwork; archived A remains available.
- Old stores and fixed legacy presentation without rewriting customer history.
- Stale review, repeated publication, source-only and informational views.
- The same browser/Node resolution policy and static export/install retention.
- Compact initial-view preference and one mounted vector reader per narrow sheet.

Browser acceptance uses actual Studio editing and publication, customer inquiry
review, seller quotation review/issue, then v2 publication and historical reopening.
It also checks 390/320 px layout, keyboard/touch alternatives, 1×/2×/4× zoom,
original-PDF access and return navigation. These are browser-emulated mobile
checks, not measurements from physical phones or low-end computers.

Explorer geometry, materials, camera interactions and tours are unchanged. No
new WebGL renderer or CAD kernel is introduced. Prepared view fingerprints are
cached; source PDFs load only when requested. Title edits update the draft
immediately and refresh the SVG preview after a 150 ms pause. Reordering and
feature-link changes update the preview immediately.

### Release acceptance — November 1, 2026

`npm run verify` completed: **549 tests, 548 passed, one existing conditional
skip, zero failures**, followed by a successful production build. The complete
browser journey passed on the development server and on the production build at
the `/annora-explorer/` repository subpath. The Explorer bundle stayed unchanged.

| Check | Result |
| --- | --- |
| SK08, 390 px: publish v1, inquiry, reviewed quotation, publish v2, new inquiry and quotation | Passed |
| Connecting rod, 320 px: the same complete journey | Passed |
| Original inquiry, issued quotation and v1 release after v2 publication | Deep-equal to their saved snapshots |
| Historical inline preview, open drawing, reload and original PDF | Retained v1 and its original file |
| Configured initial isometric view, drag/up-down order, 1× / 2× / 4× zoom | Passed |
| Horizontal overflow, page errors and failed requests in both journeys | None |

A local Chrome run with 4× CPU throttling recorded one task over 50 ms during
title typing after preview buffering, compared with 31 before buffering. This
is a synthetic editing check on the development machine, not a hardware
performance guarantee.
