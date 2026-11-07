# W60 — Independent viewer commercial walkthrough

Status: published and verified. Application source `a7eb763` is live.
The [release receipt](evidence/integration-walkthrough/release-receipt.json) records
the successful deployment and public-target qualification.

## Intended presentation

The buyer starts in an existing independent 3D viewer, selects a component and
opens an inquiry alongside the model. The selected part, model/product versions
and exact camera remain attached as the same project moves through inquiry,
seller quotation, customer revision and an agreed next step.

Patrick and Wesley can present this through three chapters:

1. **Understand the product.** Frame the connecting rod in the existing viewer.
   Open a floating inquiry with that captured context.
2. **Get a quotation.** Review and confirm the inquiry, switch to the seller,
   then prepare, review and issue quotation v1.
3. **Resolve and move forward.** Review a customer change, prepare and issue v2,
   compare both versions, request an engineering discussion and acknowledge it.

The primary action is **Continue demo**. A review must remain visible before a
later **Confirm & continue** activation. Role changes are explicit. The flow
does not place an order, take payment or claim that an inquiry was delivered.

## Published entry and release boundary

One link for Patrick and Wesley:
[Independent viewer walkthrough](https://kyle-annora.github.io/annora-explorer/walkthrough/?viewer=independent).

This release includes integration kit **0.2.0**, with optional
`@annora/integration-kit/walkthrough` exports for Annora's same-origin static-browser
commercial-demo hosts. The entry depends on separately deployed Product Room and
Studio pages. It is not a production backend or a portable seller application.

The ordinary [independent viewer example](https://kyle-annora.github.io/annora-explorer/integrations/existing-viewer/)
retains its standalone capture/inquiry behavior when no walkthrough is requested.
The original [0.1.0 artifact URL](https://kyle-annora.github.io/annora-explorer/integration-kit/annora-integration-kit-0.1.0.tgz)
is preserved byte-for-byte and verified against the original W50 hash receipt.

## What is connected

- One WTI session and one fictional project carry the reviewed commercial state.
- The independent viewer owns the canvas, model, selection and camera. Annora
  adds the contextual inquiry and commercial conversation.
- Buyer and seller reference cards reopen the original independent viewer.
  Historical quotation links resolve their own recorded context and return to
  the same project, role and quotation/review location.
- URL navigation carries saved record identities. The camera snapshot stays in
  the isolated repository. Unknown or conflicting historical references fail
  without replacing them with the latest view.
- Quote versions, customer changes, replies and next-step requests retain the
  exact external reference through the existing versioned domain.

## Existing-work protections

WTI sessions use `annora.walkthrough.independent.projects.v1.<session>`. The
ordinary Product Room store, Studio product releases, native WT walkthrough,
and standalone integration example remain separate. No migration or deletion is
part of this candidate. Explorer rendering and interaction are outside its scope.

The independent crank host shows the source model in a static pose. It supports
part selection and saved camera views; it does not claim authored mechanism
animation, drawing rendering or guided-story playback. All commercial data is
fictional and browser-local. Production delivery remains an API integration.

## Qualification evidence

The [W60 acceptance matrix](w60-integration-walkthrough-acceptance.md) defines the
checks. [Machine-readable evaluation](evidence/integration-walkthrough/evaluation.json)
records the completed candidate runs.

| Area | Measured result |
| --- | --- |
| Full workflow | 92 checkpoints across 1280×900, 390×844, 320×740 and 844×390; eight explicit confirmations per run including clarification/reply |
| Navigation | 20 focused checks on desktop/320: direct inquiry, saved draft return, Guide hit areas, exact seller review return and invalid project rejection |
| Reference/history | Original adapter, part, camera and product/model revisions retained in inquiry, v1, v2 and discussion; historical v1 remains unchanged |
| Failure/recovery | Controlled save failure retains edits; retry, minimize, Back and review/completion reload pass |
| Existing experiences | Native crank desktop/mobile: 32 checkpoints; SK08 A→B mobile: 12; ordinary independent example desktop/mobile: 22 |
| Package | Fresh external host installs/builds packed 0.2.0; 15 conformance checks include real 0.1.0→0.2.0 saved-inquiry compatibility |
| Checks/build | 1,002 passing tests, one existing conditional skip; product/drawing checks and all three builds pass |
| Rendering | One independent canvas; no Explorer iframe; 0–1 frames during 400 ms idle samples; no renderer/model changes |
| Publication | Final public release: 46 full-journey and 20 navigation checks; four routes and 60 assets verified; served package fresh install/build and 15 conformance checks passed |

The duplicate confirmation/next-step primaries are hidden or demoted only in the
WTI presentation. The Guide now stays above the floating inquiry. The explicit
reference-return action preserves the seller review step instead of guessing the
next workflow state. Saved-reference visits keep request creation in the project
workflow rather than starting a second inquiry from a historical record.

The return link now follows its description in normal layout. An explicit spacing
check passes on desktop, 390 px and 320 px; the final public run includes this fix.

Candidate and public screenshots, records and fictional snapshots are retained under
`work/product-expansion/W60/`. Browser sizes are emulated; no physical-device or
ordinary-PC frame-rate claim is made. Backend delivery and cross-device storage
remain API work, not behavior represented by this demonstration.

## Review focus

Ask whether the buyer can move from a specific component into a quote request
without losing the product context; whether the seller can respond with a clear,
reviewed scope; and whether a later change remains understandable across versions.
The presentation should demonstrate that continuity through the customer's own
viewer, with one obvious next action at each step.

## Suggested customer-call language

- **Understand the product:** “Keep your existing viewer. A specific component can become the starting point of the conversation.”
- **Get a quotation:** “The selected part and saved view travel with the request, so the seller can respond with context.”
- **Resolve and move forward:** “Change a requirement, compare the revised quotation, and agree on the next step without losing the original discussion.”

Use Guide → Start a new sample for a fresh rehearsal. Returning to the entry
resumes this browser's existing sample. No sign-in is required for the public demo.
