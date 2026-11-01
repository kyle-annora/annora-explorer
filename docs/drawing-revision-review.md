# Drawing A → B: delivery and acceptance review

## Scope

This increment completes the missing source-authoring and project-reference transition
in phases 2 and 3 of the drawing plan. It extends Studio and the buyer drawing host;
the Explorer renderer, interaction design, materials, short actions and tours stay unchanged.
All data is fictional and stored on this browser origin. No inquiry, quotation or
message is sent to a supplier. Backend services remain replaceable asynchronous adapters.

## Reference lock

Use the existing Annora Studio and Product Room design system: neutral surfaces,
compact sections, persistent dividers, explicit review/confirmation and 44px actions.
The existing drawing reader owns pan/zoom/rotation. Drawing a region is an explicit
mode; a drag cannot both pan the drawing and create an association. Shared quotation
comparison components adapt to a single column on small screens.

## Review route

Start with the [SK08 drawing](https://kyle-annora.github.io/annora-explorer/drawing-preview/?product=sk08&view=compare&sheet=sheet-2&detail=shaft-bore-detail)
and use the same browser throughout:

1. Select the shaft-bore detail, choose **Ask about this detail**, use the editable
   sample values, review and confirm the fictional inquiry. This records drawing A.
2. **View as seller** → prepare, review and issue quotation v1. It keeps A.
3. In the buyer view, request a drawing-related change. Review and confirm it.
4. In **Studio → Drawing associations**, choose SK08. Download the fictional B
   PDF example, then import it with a new source-version label. Page 1 preserves
   the original source; page 2 rearranges views and adds a review note. This is a
   document edition for demonstrating the workflow, not a changed manufacturing design.
5. Inspect both pages. Draw/redraw regions directly on the document, choose the
   actual model part, and confirm each association. Resolve or explicitly remove
   obsolete/unplaced associations. Confirm model/source pairing, then save, review
   and publish a local release. Unreviewed associations block publication.
6. Return to the **same customer project → Inquiry → Project drawing versions**.
   Select the published B release and a confirmed detail. Open the old/new drawings,
   describe the reason, review the comparison, then explicitly confirm adoption.
   If a seller draft already exists, choose whether to retain it or replace it.
   A retained A draft cannot be issued as a B quotation.
7. Address the customer's change request, prepare and review quotation v2, then
   issue it. The quotation review names B; v1 and the original change request keep A.
8. In the buyer view, compare v1/v2 and open each quotation's drawing. Conversation
   entries open their own saved reference. A reply to an older question keeps that
   question's reference, even after the project adopts B.
9. Review and confirm the requested next step. Reload and reopen both drawing versions.

A local import is available only in the browser where its bytes were stored. Public
GitHub hosting serves the application and sample assets; it does not synchronize
browser projects or uploaded PDFs across people or devices. The static-release
export path and a production asset adapter are separate deployment choices.

## Acceptance matrix

| Boundary | Required evidence |
| --- | --- |
| Source import | Actual PDF bytes and page geometry inspected; new identity; old source retained; reload succeeds |
| Association authoring | Direct pointer/touch rectangle, redraw/resize, real part selection, cancellation, explicit confirmation |
| Ambiguous/new mappings | No automatic approval; unresolved or unplaced mappings block release |
| Publication | Saved draft → review → confirmation; stale review rejected; immutable releases |
| Project change | Same project A→B, published release independently resolved, reviewer note and confirmation |
| Quote version | v1 uses A; reviewed v2 uses B; retained obsolete draft cannot issue silently |
| Conversation | Inquiry, change, reply and next-step references remain pinned to their original records |
| History | Exact old source opens after B publication/adoption and after reload; missing bytes fail explicitly |
| Mobile | 320/390px authoring and version review; no horizontal overflow; touch targets and scroll remain usable |
| Regression | Existing crank project, isolated storage, Explorer files, compiled subpath and release checks |

## Verification record

- `npm run verify`: 501 tests, 500 passed, one existing conditional skip, zero failures. Package/source validation and production build passed.
- Desktop development browser: actual B PDF import → direct region drawing → explicit pairing/mapping release → same-project adoption → v2B → both historical PDFs reopened after reload → next-step request/confirmation. Original inquiry, v1 and prior change/reply contexts stayed on A. No browser errors.
- Compiled GitHub-style subpath at 390px with touch: the same complete A→B commercial flow passed, including actual touch region creation and explicit confirmation gates. The review comparison also passed at 320px without horizontal overflow.
- Studio authoring at 1440/390/320px: import, draw, link, confirm, save, 90-degree rotation/redraw, cancel, remove, A/B switching and reload passed. Rotated coordinates were checked against expected canonical page bounds.
- Exact-reference audit: unknown/empty supplied sheet, detail or mapping, unknown product and wrong asset hash remained view-only across reload/direct inquiry entry. Valid archived A and released B stayed usable. No browser errors.
- Source import/storage and static-release installation: 25 focused tests passed, including actual PDF B hash/page validation, missing originals, corrupt bytes, quota errors, cleanup and preservation of A.
- `src/explorer/` has no changes. Existing fixed-source inquiry/quote/change/next-step flow remains functional.

These are functional checks and bounded viewport observations on the development
machine. They are not an FPS guarantee for ordinary customer hardware. Import inspects
pages without rendering them; PDF raster limits remain bounded and the application
adds no Explorer render loop or CAD kernel.

A Playwright storage-state export does not preserve Blob bytes. Full browser tests
use real uploaded bytes; isolated restored QA contexts must restore the exact fixture
PDF explicitly. This limitation belongs to the test fixture, not normal browser reload.

The published application is available at the links above. GitHub Actions records
the exact commit and deployment; the final handoff identifies the verified release.


## API and operational handoff

- [Source-version import, asset storage and static installation](studio-drawing-source-api.md)
- [Reviewed project-reference adoption and per-record context](drawing-inquiry-api.md)
- [Reader and historical source resolution](drawing-reader-integration.md)
- [Original phased plan and corrected baseline](drawing-open-source-plan.md)

Missing models, authentic customer CAD revision migration, PDF measurement/editing,
DXF, production authentication and cross-device synchronization are outside this
increment. A newly imported PDF is associated with an existing exact prepared model;
it does not infer a new model or engineering requirements.
