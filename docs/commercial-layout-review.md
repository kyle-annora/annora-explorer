# Commercial project layout

Status: published and verified.

Application revision: `46d987c16f643ee43543815e63559659612c4fcd`.
See the [release receipt](evidence/commercial-layout/release-receipt.json).
This documentation-only follow-up does not redeploy the application.

## Purpose

Patrick and Wesley should be able to follow one project from an existing viewer
through inquiry, quotation, revision and an agreed next step. This pass improves
the seller's inquiry and quotation review, and the buyer's quotation and version
comparison. It does not redesign the Explorer or change the commercial rules.

## Presentation decisions

- One compact project bar identifies the product, selected part, project and
  visible record. It uses the context pinned to that record, including historical
  quotations; the latest product context must not overwrite it.
- The current task follows immediately. Inquiry content, the quotation under
  review, or the changes in v2 precede supporting history and provenance.
- One record selector provides access to inquiry, quotation, discussion and
  related work. A quote version selector remains explicit.
- Saved-view access remains direct. Full reference details, supporting evidence
  and activity are available on demand rather than stacked above the task.
- A shared action area groups editing/back actions and the primary next action.
  During the walkthrough, the persistent Continue demo / Confirm & continue
  control owns that primary action. The host still owns every review guard.
- On mobile, comparison fields keep their previous and current values together.
  The user does not need to pan a wide table to understand a changed term.

## Visual reference and boundary

The existing Annora neutral surfaces, Ember emphasis, typography, 4 px corners
and 44 px controls remain the design system. The relevant references are
[Contra's proposal preparation and send flow](https://refero.design/flows/4880)
and [Linear's task and supporting metadata hierarchy](https://refero.design/pages/4a094449-e0ab-4893-8e58-c6239e7c228c).
Their task hierarchy and explicit review boundaries inform the layout; their
branding is not copied.

The previous mobile buyer v2 page placed its actual quotation below an entire
viewport of status, progress and navigation. The seller inquiry was similarly
preceded by several repeated context blocks. The correction is structural:
stable project identity, one current task, then optional supporting information.

The shared `project-frame` components are display-only. Repositories, API seams,
record formats, version bindings, review handlers, renderer and assets stay in
their existing modules. Data remains fictional and browser-local. Nothing is
sent to a customer or supplier.

## Acceptance

1. A single visible project bar identifies the correct project and record.
2. The same independent-viewer project completes inquiry, clarification,
   quotation v1, buyer revision, quotation v2 and an agreed next step.
3. Every business commit still requires a separate review and confirmation.
   Continue does not submit an unreviewed editor or bypass dirty-state guards.
4. v2 changes appear before the full quotation. Historical v1 stays available
   and opens its original saved reference; returning restores the same record.
5. Manual workspaces retain their actions without requiring the walkthrough.
6. Desktop, 390 px phone, 320 px compact phone and landscape layouts have no
   horizontal overflow, covered primary actions or inaccessible selectors.
7. Error recovery, reload, Back/return and existing project storage remain intact.
8. The required repository verification and published target checks pass.

## Review route

[Start the independent-viewer walkthrough](https://kyle-annora.github.io/annora-explorer/walkthrough/?viewer=independent).
Use Continue demo for the main route. Confirmation screens still require an
explicit Confirm & continue. Use the record and version selectors to inspect
history, and Reopen saved view to return to the original component and camera.

## Verification procedure

The focused review harness is `scripts/review/commercial-layout/browser.mjs`.
It uses a fresh Chromium context and fictional records for each viewport. Native
manual-workspace fixtures are created through the repository API; external-viewer
sessions are never copied into an incompatible native project store.

The existing integration-walkthrough journey remains the end-to-end authority
for eight separate business confirmations, saved-view return, failure recovery,
history and reload. The navigation branch suite checks alternatives to the main
Continue path. Run the focused suite against a built site with `BASE_URL`,
`OUT` and optionally `PLAYWRIGHT_MODULE` pointing to an installed Playwright
module. No user browser session is used.

The full repository verification passes 1,008 tests, with one existing conditional
skip, and builds the application, integration kit and independent-viewer example.
Six new regression cases ensure seller replies and next-step confirmations use
their actual source record even when a historical quotation was previously open.

The design detector reported no findings. A separate code and screenshot review
identified and resolved the response-context mismatch, a programmatic-heading
focus artifact and a mobile comparison badge wrap. Interactive focus indicators
remain visible.

The end-to-end pointer check also caught the project bar scrolling beneath the
fixed walkthrough strip on desktop and landscape. Workspace focus now preserves
the complete project bar below the visible header and guide. The saved-view
control is checked for real pointer input, not just DOM visibility.

Browser results and the actual deployed revision are recorded with the acceptance
evidence and release receipt. Mobile and 200%-equivalent reflow checks use
Chromium emulation; they are not physical-device performance measurements.

Final local validation passed 92 end-to-end checkpoints with 32 explicit business
confirmations across desktop, phone, compact phone and landscape; 20 navigation
branch checkpoints; and 50 focused layout/manual-workspace checkpoints across
five viewports, including 200%-equivalent reflow. The focused checks cover
ordinary operation without the guide, keyboard disclosures and the corrected
historical-quotation-to-current-response path.

See [acceptance evidence](evidence/commercial-layout/acceptance.json). Application
source identity, Actions deployment and live-target checks belong in the
release receipt rather than being inferred from a successful push.

## Review captures

- [Seller inquiry](evidence/commercial-layout/desktop-seller-inquiry.png)
- [Seller quotation review](evidence/commercial-layout/desktop-seller-review.png)
- [Buyer version comparison](evidence/commercial-layout/desktop-buyer-comparison.png)
- [Mobile version comparison](evidence/commercial-layout/mobile-buyer-comparison.png)

## Published verification

The live desktop and phone paths passed 66 browser checkpoints: the complete
commercial journey, sixteen separate end-to-end confirmations, focused page
checks and ordinary workspace operation. Both runs reopened the exact saved
references and historical quotations without browser errors or failed requests.

GitHub Actions build and deployment succeeded for the application revision above.
Four live entry pages and 61 runtime assets match the reviewed build. All 521
protected source files, 72 model assets and the independent-viewer assets remain
unchanged. The Explorer entry differs only in hashed shared-import filenames.
The published integration archive and source manifest were checked separately.
