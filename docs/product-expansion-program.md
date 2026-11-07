# Product explanation and sales collaboration program

Approved November 6, 2026. This records the user's acceptance of six product
extensions and two reuse foundations. Approval of the roadmap is not evidence
that every phase has shipped. Preserve the current Explorer and commercial flows.

The [detailed scope and execution pack](product-expansion/README.md) expands this
approved direction into bounded user flows, work packages, agent ownership and
evaluation gates. Its execution breakdown is proposed for review; the status
table below remains the capability ledger.

## Outcome

A seller prepares an explanation from existing product assets. A buyer collects
specific questions while inspecting it. Both can return to the exact references
and understand the next action. Measure authoring effort and buyer task completion
separately from deployment and automated test success.

## Delivery order

| Phase | Scope | Observable acceptance | Current status |
| --- | --- | --- | --- |
| 1A | Contextual request list | Collect two independent part/drawing questions; preserve each version/view and note; resume, review all, confirm once; seller can inspect both | Implemented; release validation recorded below |
| 1B | Studio story authoring | Choose a prepared part/view/action, concise explanation and order; preview using the existing controller/player; review and release; old products remain pinned | Implemented for the prepared crank; release validation recorded below |
| 2 | Customer-specific presentation and follow-up | Select relevant story segments and open questions; resume an exact local demo handoff; define permission-aware host contracts for real sharing | Planned |
| 3 | Prepared option comparison and scope | Compare approved alternatives, show included/optional/requested parts, retain exact selected option in the request | Planned |
| 4 | Change-impact review | Identify references/questions/draft quote lines requiring review when an approved source changes; never rewrite historical records | Planned |
| 5 | Action workspace and conversion evidence | Track independently anchored questions, responsibility and resolution; distinguish observed events from inferred sales value | Planned |
| Foundation A | Product onboarding workbench | Reuse one intake/readiness path for another prepared product; report semantic/source/performance gaps and preparation effort | W41 published; [review and receipt](w41-product-onboarding-review.md) |
| Foundation B | Supported integration kit | Versioned distributable, adapter examples, capability checks and independent host acceptance suite | W50 implemented and qualified; [review and publication receipt](w50-integration-kit-review.md). MK remains a separate integration. |

Real accounts, durable cross-device sharing, permissions, notifications and external
transmission remain future host-service work. Simulate those contracts with fake
data only until separately authorized. Do not add a backend to the starter.

## Phase 1 boundaries

- Add independent request items to the existing floating inquiry. Each owns its
  context, purpose and note; existing requirements and legacy drafts retain meaning.
- Selection and browsing never mutate an attached item. Adding/replacing/removing
  an item invalidates review. Save failures retain recoverable entries.
- One visible final review contains every item before confirmation. No immediate
  submission from the editing state and no silent adapter loss of item data.
- Reuse prepared actions and the current player. Story editing is not CAD, rigging,
  arbitrary motion generation or a second rendering loop.
- Separate draft, reviewed release and host publication. Old project context and
  issued quote versions retain their original product release.
- Start in the public crank example. Extend existing drawing hosts using the same
  contract. A new MK candidate requires its own registered producer refresh and
  release receipt; changing shared source does not update the MK deployment.

## Reference lock

Designing extensions to the existing buyer inquiry and seller editor for desktop
and mobile web. The incumbent components and user-approved visual system are the
primary build target; this is not a redesign. Preserve the model canvas, compact
floating surface, current palette/type and restrained action hierarchy.

Research inspected November 6 through Refero:

- Oxide style `57399d2f-b94d-48df-a573-2c423077b16c`: compact functional controls,
  controlled accent and tonal separation. Do not copy its green or replace themes.
- Linear create-issue screen `1bd10114-f1e0-4621-97d9-f84600e2389a`: concise entry,
  retained draft and one clear committing action. Borrow progressive detail only;
  do not add another full navigation sidebar or blocking modal.
- Luma camera editor `240f5d6f-5774-483f-a648-7c1903d6a926`: visible scene preview
  with locally scoped editing and deliberate playback. Borrow preview/action
  adjacency, not its dense camera readouts or a new timeline runtime.

| Decision | Reason |
| --- | --- |
| One expandable item at a time | Keep several requests readable within the existing floating width |
| Add current view is explicit | Browsing and submitted evidence have different meanings |
| Existing two-step inquiry retained | Collection must not add mandatory screens |
| Story editor stays in Presentation | Avoid another top-level destination |
| Draft preview before reviewed release | Authoring never silently changes existing customer projects |
| Mobile uses the existing compact surface | Do not require hover, dragging or wide-screen side-by-side editing |

## Evaluation

Phase 1 must cover legacy single-context records, independent item identity,
source A/B history, save failure and conflict recovery, complete review and stale
review rejection. Exercise buyer-to-seller return and quoted context. Story tests
cover allowed part/action/camera identity, ordering, interruption, preview, reviewed
release, old-release isolation and invalid references. Inspect compiled desktop,
390px phone, narrow phone and short landscape routes, including keyboard access
and no horizontal overflow. Run the required repository verification before any
release, then verify the deployed target and record the exact commit/receipt.

Physical phone/hardware tests, customer comprehension and conversion improvements
remain unmeasured until the corresponding participant/device evidence exists.

## Delivery record

Baseline: `14ab67a8226611904f773336eac5516719496d72` (documentation release),
runtime baseline `d99f6b9a77d059906a8f17041df8d1b78ddd1971`.
Phase 1 implementation, boundaries and candidate checks are recorded in the
[delivery review](product-expansion-review.md). Detailed contracts are in
[contextual requests](contextual-request-items.md) and
[Studio story authoring](studio-story-authoring.md). The first subsequent work
package, W00/W10 customer follow-up, is tracked in its [delivery review](customer-follow-up-review.md)
and [contract](customer-follow-up.md). Other expansion work packages remain planned;
their status must not be inferred from this candidate or its public example.
