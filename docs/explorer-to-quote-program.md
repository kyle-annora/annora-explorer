# Explorer to quotation · delivery program

Approved November 5, 2026. This is the execution entry for the continuing work,
not a declaration that every stage has shipped.

## Outcome

A customer can understand a product, point to a component or drawing detail,
describe a need without leaving the view, review the request, and follow the
seller's quotation and response in one project. Patrick and Wesley can present
that value through one guided route with explicit buyer/seller handoffs.

The integration must also be reusable for another authorized product without
forking the Explorer or creating a second inquiry system.

## Verified starting point

- Released source: `00948c889737b95e6ca4acecf4f6e59f34b15692`.
- [Released crank Explorer](https://kyle-annora.github.io/annora-explorer/?model=kinetic-01).
- The standalone crank has one floating inquiry shared by header, component and
  chapter entries. It supports quotation and application-review intents,
  save/resume, explicit reference replacement, review and confirmation.
- The shared inquiry session and repository exist. Product Room still starts its
  primary request through the full-page workspace; the walkthrough uses that
  older route.
- Drawing A to B, manual association review, quotation v1/v2 references and
  historical snapshots already exist. Their contextual entry needs integration;
  the version system is not a new deliverable.
- Baseline verification: 734 tests, 733 passed, zero failures, one existing skip.
  Compiled-subpath and public desktop/mobile browser checks are recorded in
  `work/embedded-inquiry-review/`. Its `release.json` identifies the target bytes
  and deployment. Physical-device performance and customer comprehension are
  not established by browser emulation.

## Non-negotiable decisions

1. Keep current Explorer rendering, animation, appearance, navigation and model
   capabilities. Use the existing renderer and public JSON controller.
2. All entries for a product/version resume the same draft. Exploring another
   part does not silently replace the inquiry's attached context.
3. The buyer edits, reviews, then explicitly confirms. The seller drafts,
   reviews, then explicitly issues. A presenter shortcut cannot bypass a gate.
4. Keep exact model, source drawing, mapping and overview versions. New releases
   never rewrite issued quotations or earlier discussions.
5. Use fictional browser-local data and asynchronous repository interfaces.
   Implement no backend, accounts, real delivery or real commercial commitment.
6. Preserve existing projects and historical routes. Resolve storage conflicts
   explicitly; never discard unsaved input to make navigation easier.
7. Keep the approved visual system and English maintained documentation. The
   reference lock in [embedded inquiry](embedded-inquiry.md) remains applicable.
8. MK's engineering-brief flow and Annora's fictional quotation flow have
   different release claims. Validate MK sources and authority before using it
   as the third-stage proof; do not relabel its brief as an actual quotation.

## Delivery stages

### Stage 1 · One continuous demonstration

**Entry:** the existing crank, published Product Room content and isolated
walkthrough session.

- **EQ-101:** Reuse the floating inquiry and shared session in Product Room.
  Capture/restore through its existing embedded Explorer controller. Keep one
  canvas, pinned product release and the correct repository namespace.
- **EQ-102:** Make header and relevant product/component/document actions resume
  that inquiry. Guard model changes, page changes, Back and leaving the host.
- **EQ-103:** Update the walkthrough to carry the selected connecting rod into
  the floating request. Keep one clear Continue demo action, visible current
  role and explicit confirmation at each review gate.
- **EQ-104:** Rehearse request → seller quote v1 → buyer change → seller quote v2
  → comparison → next-step discussion. Refresh the presenter guide and record
  the actual release after publication.

**Exit evidence:** desktop and narrow/mobile routes; draft save/minimize/resume;
explicit reference changes; keyboard and focus; save-failure recovery; isolated
walkthrough data; immutable inquiry and v1; one renderer; production subpath and
live target checks. No route should silently fall back to the older intake.

### Stage 2 · Drawings enter the same conversation

**Entry:** Stage 1's reusable host integration and existing SK08/linkrod packages.

- **EQ-201:** Connect overview, prepared view and hole/detail entry to the same
  floating inquiry while retaining the drawing reader. Share its existing
  drawing repository; do not create an ordinary-product duplicate.
- **EQ-202:** Show the attached detail and exact source, association and overview
  versions in request and review. Reopen that saved context from the panel.
- **EQ-203:** Verify source A → source B → manual association review → quote v2
  referencing B, with v1 and earlier discussion still reopening A.
- **EQ-204:** Document the host contract and configuration needed by the next
  product. Original PDF remains a secondary source entry.

**Exit evidence:** both packages; overview/detail selection; zoom/rotation/page
changes; mobile sheet and original PDF; save/resume; explicit adoption of B;
old references unchanged; missing/ambiguous versions fail visibly and preserve
the original record.

### Stage 3 · Authorized customer-product reuse

**Entry:** reviewed source, redistributable assets, stable component identities,
known product claims and a bounded customer journey. Prefer the existing MK
America product when these conditions are satisfied.

- **EQ-301:** Read MK's current project packet, registered sources, task scope and
  release receipts. Select one product and one supported request scenario.
- **EQ-302:** Configure brand, components, narrative and inquiry requirements
  through shared integration seams. Add precise spatial-demo context capture
  only where the chosen route needs it; do not guess an unsupported view.
- **EQ-303:** Rehearse the customer route using fictional data. Preserve the
  distinction between an engineering brief and a commercial quotation.
- **EQ-304:** Publish only the authorized candidate; verify the public target,
  refresh the MK producer record when applicable, and deliver reuse instructions.

**Exit evidence:** a second product uses the same session and review model;
context survives explore/demo/request transitions; mobile and prior projects
pass; no private material enters the public template. Any unavailable asset,
source or authority is a specific hold with a retry and owner, not a completion
claim. Independent work in Stages 1 and 2 continues around such a hold.

## Evaluation matrix

| Boundary | Required check | Failure means |
| --- | --- | --- |
| Context | Saved part/view/version differs from live selection until explicitly replaced | Block the affected entry |
| Confirmation | Edit invalidates review; no automatic submit/issue | Block release |
| History | Issued v1 and earlier discussion remain byte-equivalent after v2 | Block release |
| Persistence | Failed save and cross-tab conflict retain input with a recoverable action | Block affected transition |
| Navigation | Back, minimize, resume, role switch and return-to-view have reachable exits | Block the broken path |
| Mobile | 320 px, 390 px and short landscape: controls reachable, no overflow or covered primary action | Fix before publication |
| Performance | One renderer; lazy inquiry UI; no recurring camera changes while typing | Investigate regression before release |
| Integration | Namespace, release identity and API adapter remain correct in each host | Block integration |
| Publication | Successful build/deployment plus target artifact identity and route smoke test | No published claim until verified |
| Comprehension | A new viewer can explain the part, request and next action | Record human review separately |

Automated checks do not establish improved conversion, manufacturing correctness
or performance on untested hardware. Pilot measurements remain a later activity.

## Operating record and checkpoints

- This plan is the stable entry; [program progress](explorer-to-quote-progress.md)
  records task status, evidence, unresolved issues and the next executable action.
- Keep review evidence under `work/explorer-to-quote/`, by stage and candidate.
  Preserve failed runs and link their retests. Maintain stable issue IDs.
- Update the progress record after each coherent implementation unit, user
  correction and tested release. Report completed, pending and held work
  separately. A local commit, successful test and public release are distinct.
- Run `npm run verify` for each release candidate, then compiled-subpath browser
  checks. Broaden tests when changes or failures justify it.
- Publish tested milestones to the already-authorized GitHub target. Preserve
  unrelated working files; do not include them in a delivery commit.
- Stop for user input only when a missing product fact or publication boundary
  materially blocks dependent work. Routine implementation follows this plan.
- A stage is complete when its exit evidence and release receipt exist, not
  merely when its interface renders. The program finishes after all three stages
  have their required deliverables and an accurate customer-facing handoff.

## Final handoff

One customer-call walkthrough link, a concise English presenter guide, tested
Explorer/Product Room/Studio routes, configuration and adapter instructions,
version-preservation evidence, actual deployment identities and explicit limits.
New visual modes, additional sample models, backend production and conversion
claims are outside this program.
