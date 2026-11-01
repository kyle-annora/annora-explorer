# Demo walkthrough plan and route audit

November 1, 2026. Discussion draft for Patrick and Wesley.

Implementation follow-up: the [product walkthrough](demo-walkthrough.md) records
the approved solution and corrections. This document preserves the original
audit evidence and proposal; the open statuses below describe that earlier audit.

The customer presentation should follow one product conversation: understand the
mechanism, request and receive a quotation, then resolve a change and confirm the
next action. Product Room hosts the existing Explorer; Studio provides the seller
view of the same case. The presentation should make that continuity visible.

This audit inspected the live deployment at commit
`021cf12c462c798aa3d8ec2e129349fd2ee82772`. It records findings and proposed changes.
No application code, runtime behavior, existing customer records or hosted release
was changed. Screenshots use isolated browser contexts and fictional data.

## Proposed customer presentation

Use the crank-slider mechanism throughout. Example Automation requests 20
assemblies for an inspection fixture, then changes the quantity to 30 and asks
for an earlier delivery. The connecting rod is the selected technical reference;
it is not a separate product being quoted. Requested timing and the seller's
proposed lead time must remain distinct.

Target five to seven minutes, including narration. This is a proposed pacing
budget, not a measured completion time.

| Chapter | What Patrick or Wesley shows | Value the customer can see |
| --- | --- | --- |
| Understand the product | Enter Product Room in 3D. Run one short crank cycle, select the connecting rod, and show its linked information. Use one explosion or linework view only if it explains the question. | A shared visual reference makes the mechanism and the customer's question concrete. |
| Request and receive a quotation | Start an inquiry from that selection. Use fictional sample details, review, and confirm. Continue as seller in the same case, show the received context, prepare pricing, review the document, and issue v1. | The seller receives the product and part context with the requirements. Draft pricing is separate from the quotation the buyer receives. |
| Resolve a change and agree on the next step | As buyer, request 30 assemblies and earlier timing. As seller, address both topics and issue reviewed v2. As buyer, compare the changed terms and request engineering review. As seller, acknowledge that next step. | Requirements, responses and quotation versions remain connected; both parties know what changed and who acts next. |

End on the agreed next action and its quotation reference. A confirmed engineering
review is not an order, payment or contract acceptance. The current demo records
actions in the same browser and does not send messages to another person.

### Entry and optional depth

The core entry should be [Product Room in 3D](https://kyle-annora.github.io/annora-explorer/product-room/?model=kinetic-01#explore).
The standalone Explorer currently exposes model and source links, with no visible
commercial handoff. It remains a useful independent tool; the existing Room host
is the appropriate starting point for this presentation.

Studio product authoring belongs in an optional follow-up: edit product details,
associate a document with a part, preview, and publish a local demo version. Apollo,
appearance settings, model importing, component-library internals and the full
clarification loop are also optional. They should not interrupt the crank case.

These are presentation chapters, not additional customer form steps. The existing
requirements and review sequence remains intact.

## Proposed presentation controls

- One entry link opens a fresh fictional demonstration session. Reopening that
  link resumes the session; restarting replaces only that session's fixture data.
- A compact presentation strip shows the chapter, current role and project. It
  sits in the host, without changing or covering the Explorer's floating controls.
- Role handoffs use the same tab and the same case. Labels say where they go, such
  as **Continue as seller**. An explicit **Open separately** can remain available.
- Presentation navigation changes the view. It never silently confirms an
  inquiry, issues a quotation or sends a response. Those actions retain their
  own review and final confirmation.
- Prepared checkpoints can support a shorter presentation or recovery. They must
  be visibly identified as sample states, preserve unrelated records and never
  masquerade as a customer or seller action.
- Optional technical depth stays behind one secondary control. The main sequence
  always returns to the current project and role.

## Confirmed route and state findings

P1 denotes a wrong workflow destination. P2 denotes a recoverable navigation,
state-display or usability problem. None of the reproduced cases below showed
loss of saved quotation data. Findings remain open; no fixes were applied.

### W01 Buyer return from 3D opens the seller workspace

**P1, live-browser reproduction.** Open a buyer project, choose **View in 3D**, then
**Back to customer project** in the saved-reference banner. The destination is
`studio/#project?id=...`, although the visitor entered from the buyer project.

The return link is unconditionally seller-directed in
[Product Room app](../src/product-room/app.js), line 226. The entry is at line 148.
Preserve the originating role and route, along with the pinned product reference.
Returning from buyer exploration must restore the buyer case; seller exploration
must restore the seller case.

[Observed seller destination](evidence/walkthrough-audit/buyer-return-landed-seller.png).

### W02 Automatic scrolling hides the return control

**P2, live-browser reproduction at 1440 and 390 pixels.** Select Connecting rod
in Product Room, request a quotation, use sample details, review and confirm.
After project entry, the local **My projects** return control is underneath the
sticky header. Scrolling upward recovers it; the separate header navigation
remains available.

At 1440 pixels the local control occupies viewport y=3–47 while the header ends
at y=72. At 390 pixels it occupies y=39–83 while the header ends at y=108.
Hit-testing the center reaches the header, not the button. This is an obscured
control, not a missing DOM node.

`revealHeading()` in [buyer workspace](../src/product-room/project-workspace.jsx),
line 340, scrolls the title into view. Its CSS scroll margin clears the title but
does not preserve the return row above it. Page transitions should reveal the
page context and return control together and account for responsive header height.

[Mobile viewport evidence](evidence/walkthrough-audit/mobile-obscured-return.png).

### W03 Saved quotation state and available actions disagree

**P2, live-browser reproduction.** Studio → Customer projects → Open sample
inquiry → Prepare quotation → Fill demo pricing → Save draft → Back to project.
The page still says **New inquiry / Prepare quotation**. Reload changes it to
**Quotation draft / Continue quotation**. The saved draft itself remains intact.
After reload, the Quotation tab still says **Prepare quotation**, contradicting
the correct **Continue quotation** action above it.

In [seller workspace](../src/studio/customer-workspace.jsx), `saveCurrent()` at
line 244 updates editor state without refreshing the project projection. The
return action at line 1054 only resets the editor. The empty quotation branch
at line 740 ignores an existing saved draft.

All status labels, empty states and actions should derive from the same current
project state, distinguishing no draft, saved draft and issued quotation.

[Immediately after saving](evidence/walkthrough-audit/saved-draft-stale-action.png)
and [conflicting actions after reload](evidence/walkthrough-audit/saved-draft-conflicting-actions.png).

### W04 Browser history does not represent the work being done

**P2, live-browser reproduction.** Open a seller project from the queue, prepare
the next quotation, save and review it. Browser Back returns directly to the
queue, while **Back to editing** returns to the editor. The saved draft is safe.

On the buyer side, choosing v1 or Conversation does not update the project URL.
Reload returns to the default tab and latest quotation. A copied URL therefore
cannot reproduce the view being presented.

Seller `mode` lives inside [customer workspace](../src/studio/customer-workspace.jsx)
at line 64, while [Studio navigation](../src/studio/navigation.js), line 19,
only represents the page and project. Buyer loading at
[project workspace](../src/product-room/project-workspace.jsx), line 555, selects
the latest version and computed default tab.

Represent meaningful editor/review, project-tab and quotation-version states in
navigation. Browser Back, visible Back, refresh and role handoffs should preserve
the expected location. Guard unsaved edits rather than silently skipping them.

[Before browser Back](evidence/walkthrough-audit/seller-review-before-back.png)
and [after browser Back](evidence/walkthrough-audit/seller-review-after-back.png).

### W05 Role switching creates duplicate project tabs

**P2, live-browser reproduction.** Seller **View as buyer** opens a new tab. Buyer
**View as seller** navigates within that tab. A round trip leaves two seller tabs;
repeating it adds another. The target rules differ between
[seller workspace](../src/studio/customer-workspace.jsx), line 599, and
[buyer workspace](../src/product-room/project-workspace.jsx), line 753.

Use consistent same-tab handoffs in the presentation, with explicit role and
project identity. This is demo navigation, not an authentication boundary.

### W06 Mobile comparison overwhelms the changed terms

**P2 usability gap, live-browser reproduction.** The seeded seller v2 quotation
at 390 pixels renders unchanged scope, assumptions, exclusions and validity in
the comparison. The full page measures 5,140 pixels tall. This is not horizontal
overflow: the inspected seller views fit both 320 and 390 pixel widths.

[Seller comparison](../src/studio/customer-views.jsx), line 141, sends every row
to the shared Comparison component. Adopt the buyer's changes-first approach,
with unchanged details available on demand. Keep the complete quotation document
accessible separately from the change summary.

[Mobile seller quotation](evidence/walkthrough-audit/mobile-seller-comparison.png).

## Additional findings and intentional behavior

- **W07, source and synthetic-event evidence only:** seller editing/review treats
  every window focus as potentially stale without comparing revisions
  (`customer-workspace.jsx`, lines 201–217). Dispatching a focus event with
  unchanged storage shows **Project activity may have changed**. Native tab/window
  switching did not trigger it in this headless environment, so native-browser
  reproduction remains open. Compare revisions before requiring recovery.
- **W08, confirmed stale copy:** the buyer inquiry sidebar still promises
  **open a sample quotation** (`project-workspace.jsx`, line 1207), although that
  buyer-side generation action has been removed. The copy must describe the
  current seller-review-and-issue workflow.
- The global **Request a quote** intentionally hides on project/workspace pages.
  Historical quotations intentionally replace current-version actions with
  **Open latest quotation**. A pending change or question also changes the
  available action. These are valid rules; retain them with a stable action area,
  a visible reason and a clear next owner.
- The live desktop and 390 pixel inquiry path preserved the selected Connecting
  rod in review and the saved project. It required explicit review and confirmation,
  produced no page errors and had no horizontal overflow in the inspected views.

## Why the problems cluster at the boundaries

The existing rendering, buyer workflow and seller workflow were developed as
separate hosts with local navigation state. Business records now connect them,
but role, return location, active tab, selected quotation and action presentation
do not yet follow one shared contract. Individual data transitions can be correct
while the continuous customer presentation is confusing.

Keep the Explorer runtime independent. Unify the host navigation and project-state
rules, then reuse the existing component system for their presentation. Cosmetic
button changes alone would leave the routing and stale-state defects intact.

## Proposed implementation sequence after approval

1. Correct W01–W05: role-aware return, visible return controls, current project
   projections, recoverable history and consistent handoffs. Resolve W08 and
   validate W07 during the same workflow pass.
2. Define one compact next-action area for each project state. Align buyer and
   seller comparison behavior, including W06 on mobile. Do not re-enable actions
   on historical quotation versions.
3. Add the three-chapter presentation host and isolated sample checkpoints. Reuse
   existing live screens and explicit confirmations rather than duplicate forms.
4. Rehearse the real click path from a fresh session and a resumed session. Only
   after review and approval should this become the published presentation entry.

## Acceptance matrix

| Area | Required evidence before release |
| --- | --- |
| Case continuity | Same project, product snapshot and selected part across inquiry, seller draft, issued versions and replies. |
| Navigation | Buyer and seller 3D returns preserve origin; browser Back matches visible Back; role handoffs do not accumulate tabs; refresh restores tab/version. |
| Actions | No-draft, saved-draft, issued, pending-change, pending-question and historical-version states each show the correct next action and explanation. |
| Confirmation | Saving does not issue; presentation navigation does not submit; final confirmation uses the reviewed contents. |
| Recovery | Unsaved changes, stale revisions, storage failure and missing local fixtures have clear recovery without altering unrelated records. |
| Mobile and focus | At 320, 390, 768 and desktop widths, action controls are visible and reachable by touch and keyboard; scroll/focus transitions clear sticky navigation. |
| Presentation | A fresh case and resumed case complete the three chapters without manual URL entry or unexplained role changes; optional paths return to the same chapter. |
| Performance | The existing single-viewer lifecycle remains intact; project lists and quote editing do not load model geometry. Measure any new overhead before claiming performance. |

This audit used desktop Chromium and responsive viewport emulation. Physical
phones, native mobile browser history, screen readers and lower-end GPU performance
were not evaluated here. The previous release's data-transition checks remain
useful; they do not replace the continuous navigation checks above.

## Design authority

Preserve the approved Annora surfaces, compact dividers, Ember action emphasis,
champagne completion states and floating Explorer. The existing
[Studio reference lock](studio-design.md) and captured live evidence guide this
proposal. This audit used Refero's evidence-first audit method; it introduces no
new visual style or external reference direction.
