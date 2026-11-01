# Drawing overview delivery

For the subsequent seller editor, immutable overview versions and publication
workflow, see [Studio overview authoring](studio-overview-authoring.md).

## Outcome and review path

SK08 and the connecting rod now open a composed **Drawing overview** instead of
making the unedited PDF a primary presentation mode. Click a view to open it at
fit, or a linked feature to enlarge around that feature at 2×. **Drawing overview**
returns to the composed sheet. **Source PDF** is a secondary text action and
still opens the exact original reader; its external PDF link remains available.

- [SK08 overview](https://kyle-annora.github.io/annora-explorer/drawing-preview/?product=sk08&view=drawings&detail=shaft-bore)
- [Connecting-rod overview](https://kyle-annora.github.io/annora-explorer/drawing-preview/?product=linkrods&view=drawings)
- [Studio drawing workspace](https://kyle-annora.github.io/annora-explorer/studio/#drawings?product=sk08)

In Product Room, open a saved drawing project's **Conversation → Preview
drawing**. The same overview and focused reader appear inside the record. To
create a local example, choose a hole, **Ask about this detail**, **Use sample
details**, **Review inquiry**, then **Confirm demo inquiry**. Existing review,
quote, modification and comparison steps remain in place.

## Composition and design decisions

The approved Annora technical view remains the primary visual reference: neutral
paper, graphite contours, quiet dimensions and Ember only for the selected
feature. Refero research of [shadcn/ui](https://ui.shadcn.com) and
[v0](https://v0.dev) informed compact control hierarchy and subtle dividers only;
their marketing layouts, rounded cards and brand colors were not adopted.

| Decision | Basis | Result |
| --- | --- | --- |
| A continuous drawing sheet | User-approved overview direction | Shared paper surface with internal dividers, without separate raised cards. |
| View and feature activation differ | Existing source-linked geometry | A heading or blank-view tap opens the whole view; a feature opens at 2× around its geometry. |
| Source PDF is a utility | User's request to replace the primary original view | A quiet text action; no equal-weight Original sheet tab. |
| One view on small containers | Mobile readability and performance | Compact view selector, one mounted vector reader, and a clear Enlarge view action. |
| Existing line roles remain | Approved SK08/connecting-rod artwork | Source geometry and dimensions are reused without reconstruction. |

SK08 sheet 1 presents front, top, side and isometric views. Sheet 2 presents bore,
mounting-footprint and cross-bore details. The connecting rod presents top,
isometric and both bore details; the top view also retains its linked web target.
The existing focused view selector still exposes the connecting-web composition.

## Reference guarantees

- Display mode and composition are presentation state. Source asset hashes,
  drawing revision, mapping revision, sheet, region, model and part remain the
  canonical inquiry/quotation reference.
- Only eligible prepared compositions enter the overview. A changed source or
  unresolved identity cannot borrow old artwork.
- An eligible frozen record may inspect another composition of the same source,
  but only its pinned feature is interactive. Inspecting another view does not
  change that record or highlight an unrelated feature.
- If a frozen record's feature no longer matches prepared geometry, it uses its
  exact Source PDF even when other features still have prepared views.
- Studio can inspect eligible sibling views after a mapping change. Locating an
  unprepared selected detail falls back to its source coordinates.
- Explicit historical `presentation=source` links still open the source reader.
  Invalid version identifiers remain in the URL and keep inquiry actions blocked.
- Studio region authoring continues on the source PDF. Overview coordinates
  never become saved engineering associations.

No original CAD/drawing assets, Explorer runtime, customer project data or
inquiry/quotation domain logic were changed. This remains a local demo with the
existing API boundaries.

## Reusable implementation

`content/drawings/<product>/overview-views.json` lists eligible prepared view IDs
in the intended reading order for each sheet. The catalog filters this list
through the existing exact-source and per-feature eligibility rules.

`createDrawingOverview` in `src/drawings/drawing-overview.js` composes the existing
vector readers. Its `onOpen` callback carries a prepared entry ID, canonical
region ID and whether to focus the feature. `lockedRegionId` protects recorded
references. The renderer supports selection, focus, fit, resize and disposal.

The shared React `DrawingPreview` manages overview, focused reading and source
access for Studio and Product Room. Source assets load when requested. No new
WebGL context, CAD kernel, animation loop or backend is introduced.

## Verification — November 1, 2026

- Repository verification: 526 tests, 525 passing and one existing conditional
  skip; source checks and production build pass.
- Runtime tests cover canonical callbacks, locked references, compact mounting
  and disposal, feature/blank taps, drag/pinch suppression and invalid entries.
- Both actual product journeys pass: overview → hole → inquiry → review →
  confirmation → project preview → Source PDF → saved drawing → return.
- Frozen A → imported/reviewed B → restored A remains exact. B never uses A's
  prepared overview. Changed pinned mappings use their exact PDF.
- Both products' legacy source links and ten invalid-identity/reload cases pass.
- Desktop, 390 px and 320 px checks include single-reader mobile layout, 44 px
  controls, keyboard activation/focus, preview height and no horizontal overflow.
- The production build served under `/annora-explorer/` passes 33 view checks
  across those widths, each at 1×, 2× and 4×. Source reloads, Studio previews and
  both inquiry-to-project return journeys pass without browser or asset errors.
- Studio inspection, editing, region drawing, release review and recorded
  previews preserve their respective read-only/source-authoring boundaries.

Mobile checks use Chromium viewport/touch emulation on the development Mac, not
physical-phone or low-end-PC measurements. Prepared overviews remain curated,
source-derived reference views, rather than automatic production drawing output.

See [the prior technical-view expansion](technical-reading-expansion-review.md)
for source provenance and the underlying per-feature preparation contract.
