# Inquiry, revision and confirmation layout

Status: published and verified.

Application revision: `16c83189158af90cd69465ca07d175c63d555707`.
See the [release receipt](evidence/request-layout/release-receipt.json).
This documentation-only follow-up does not redeploy the application.

## Review route

[Start the existing-viewer walkthrough](https://kyle-annora.github.io/annora-explorer/walkthrough/?viewer=independent&new=1).

Follow **Continue demo** through one fictional project. At a review, use
**Confirm & continue** only after reading the prepared inquiry, response or
next-step request. Manual workspaces keep their own Review and Confirm actions.

## What changed

The request pages now use the same composition as the quotation pages:

1. A compact project bar identifies the product, selected component and record.
2. The current task and its edit/review stage follow immediately.
3. The form or reviewed content comes before supporting reference information.
4. One action area provides editing/back controls and the next action. In a
   walkthrough, the persistent guide owns the primary action.

The floating inquiry keeps its dock, minimize, restore and autosave behavior.
Its application fields appear before optional requests about individual details.
The saved model, camera, drawing, overview and association versions remain
available under Reference details. Saved-view restoration stays in the header.

Native inquiry entry uses the shared project frame. Inquiry review shows the
prepared snapshot, requirements and contact information. The previous separate
stepper and explanatory sidebar are removed; a compact numbered stage and the
confirmation note carry their useful meaning.

Buyer change and next-step pages lead with the editable request or its reviewed
snapshot. Source quotation facts remain visible, while full reference details
can be expanded. Confirmation explicitly requests a review or discussion; it
never accepts a quotation, confirms suitability or creates an order.

Seller clarification, reply and next-step pages use the same task and action
areas. Review displays the exact prepared response and the source request,
including its quotation version. Buyer and seller conversations show the latest
receipt first, with every earlier event available in Earlier conversation.

## Boundaries

This is a presentation change. Explorer rendering, model assets, cameras,
selection behavior and motion remain unchanged. The inquiry, quotation and
message repositories, API seams, record formats, version rules and business
review guards remain unchanged. Existing projects are not migrated or reset.

The current Annora neutral surfaces and Ember emphasis remain the visual system.
This pass continues the [established reference lock](commercial-layout-review.md):
task-first hierarchy and a separate review/confirmation boundary. It adds no new
visual direction or competing navigation.

The shared inquiry reference has an optional compact presentation. Both variants
use the same metadata and reference-update handler; the original variant remains
available to existing consumers.

Data is fictional and stored in the browser. No backend, account registration,
message delivery, order or production quotation is created.

## Acceptance matrix

| Area | Acceptance |
| --- | --- |
| Inquiry | Invalid input cannot confirm; draft save, failure recovery, minimize, restore, edit and review remain usable. |
| Primary action | One Continue demo or Confirm & continue in the guided path; normal Review and Confirm controls without the guide. |
| Review boundary | Viewing a review creates no business record; a separate explicit action commits it. |
| Changes | Requested quantity, timing and message stay pinned to the source quotation; v1 remains unchanged after v2. |
| Next step | Buyer request and seller confirmation retain their exact quotation and reference. |
| History | Latest outcome is visible first; earlier messages, quotations, drawing references and actions remain accessible. |
| Navigation | Back, reload, saved-view return, draft recovery and alternative guide navigation retain the same project. |
| Mobile | 390 px, 320 px and short landscape support the same tasks without horizontal overflow or covered primary actions. |
| Isolation | Only fresh fictional test sessions are used; unrelated projects remain unchanged. |
| Publication | Build checks, browser acceptance, exact GitHub deployment and public target verification must all pass. |

## Verification

Run `npm run verify` for repository checks, tests, the application, integration
package and independent-viewer build.

The existing `scripts/review/integration-walkthrough/browser-journey.mjs` remains
the business-flow authority. `LAYOUT_REVIEW=request` adds presentation assertions
without weakening its mutation, history or reference checks. The navigation
branch harness verifies alternatives to the linear guide.

`scripts/review/request-layout/manual.mjs` checks native inquiry, buyer revision
and next-step forms, seller reply and acknowledgement, and ordinary floating
inquiry without the guide. Configure `BASE_URL`, `OUT`, `PROFILES` and
`PLAYWRIGHT_MODULE` to run it against a built candidate or the published target.

Browser testing uses isolated Chromium contexts and touch/viewport emulation.
It is not a physical-device or low-end hardware benchmark.

## Candidate results

Repository verification passes 1,008 tests with one existing conditional skip.
The application, integration package and independent viewer example build.

Desktop, 390 px phone, 320 px compact phone and 844 × 390 landscape passed
92 full-journey checkpoints with 32 explicit confirmations. Ordinary workspaces
passed 64 checks, and alternative navigation passed 20 checks. After correcting
stale validation feedback when sample values replace invalid fields, the affected
native inquiry route passed 12 additional checkpoints across the same four sizes.

A separate source review preserved the distinct question-review action when it
is not the guide's action. Eight default-reference rendering fixtures remain
identical. The design detector reported no findings.

Public screenshot review caught a circular font alias in the floating surface.
The correction restores the canonical font stack; 12 focused checkpoints across
four viewports confirm 22 px desktop and 21 px phone task headings, along with
review, confirmation and real pointer access. Public qualification was repeated
against the corrective deployment.

[Acceptance evidence](evidence/request-layout/acceptance.json) records the suites
and their limits. The final public deployment passed another 46 full-journey checkpoints and
16 explicit confirmations on desktop and phone, including the corrected heading
typography. See [public browser evidence](evidence/request-layout/public-browser.json).
The publication audit verified 61 runtime assets, 72 model assets and 567
protected source files. The integration package matches the reviewed archive.

## Review captures

- [Floating review on desktop](evidence/request-layout/desktop-floating-review.png)
- [Floating inquiry on mobile](evidence/request-layout/mobile-floating-inquiry.png)
- [Requested changes and source quotation](evidence/request-layout/desktop-change-review.png)
- [Buyer next-step review](evidence/request-layout/mobile-next-step-review.png)
- [Seller final confirmation](evidence/request-layout/mobile-seller-confirmation.png)
- [Latest outcome and preserved history](evidence/request-layout/mobile-complete.png)
- [Native inquiry validation recovery](evidence/request-layout/mobile-inquiry-recovery.png)
