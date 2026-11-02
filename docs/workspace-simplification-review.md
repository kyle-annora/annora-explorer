# Studio and Product Room workspace simplification

Status: released; local and hosted acceptance passed on 2026-11-01.

## Scope and reference lock

Extend the approved drawing workspace pattern to the remaining seller and buyer
surfaces: show the content first, keep one route into each task, and reveal editor
settings only when requested. Keep the current Annora silver/white surfaces,
compact type, neutral dividers and Ember action/selection roles.

The user-approved drawing workspace is the primary visual and interaction target.
No new design system, backend, renderer or commercial workflow is introduced.

| Decision | Evidence | Boundary |
| --- | --- | --- |
| Contextual editing instead of persistent editor navigation | Approved drawing workspace; [Linear issue detail](https://refero.design/pages/1a493a2c-7d09-4143-b0dd-745781ea7991) | Keep explicit edit labels; retain the current item and unsaved draft when closing settings |
| One compact project destination control | User request to reduce repeated navigation | Preserve existing route IDs, browser history and links into inquiry, quotation and conversation |
| Readable document before its configuration | [Mocha canvas review flow](https://refero.design/flows/11612) | Only borrow showing/hiding editing controls; retain Annora's explicit review and publication gate |
| Restrained actions and compact hierarchy | [Linear](https://linear.app), Refero style `554b801c-3b31-4086-a7e5-ae613cdd618b`; [Cron](https://cron.com), style `0528b40d-d5ef-4783-9206-d42fa97ad1d2` | Retain Annora palette/type; use accent for the main action and selection, not decorative panels |
| Secondary source/history details in disclosures | Existing source/version contract and prior drawing refinement | Current quote identity, scope, price, status and next action remain visible; historical snapshots remain accessible |
| Mobile works one task at a time | Approved drawing Edit/Back behavior | Preserve values, touch targets, focus, review confirmation and version comparison |

## Invariants

- Explorer geometry, materials, appearance, tour and controller behavior unchanged.
- Model, drawing, mapping, overview and issued quotation identities unchanged.
- Existing customer projects and immutable history continue to use their snapshots.
- Draft saving is distinct from review and issuing/publishing.
- Optional-field disclosure must reveal validation errors and required fields.
- All data remains fictional and browser-local; host adapter boundaries stay intact.

## Acceptance

### Implemented behavior

- Studio opens the product canvas first. One section selector and Edit settings
  replace the permanent section sidebar and model/settings tab strip. Closing the
  inspector retains draft values and the same Explorer iframe.
- Facts, document fields and inquiry-field configuration expand in context.
  Validation links reveal and focus the exact document/fact/part group.
- Preview size/page options and product release history are expandable. Save,
  preview, release review and explicit publication remain separate actions.
- Buyer and seller project pages use one Project view selector. Quote version is
  in the same toolbar. Project source and filtering appear on project lists.
- Product/source references, drawing history and supporting documents expand on
  demand. Current quotation scope, status and the next action remain visible.
- Issued seller comparisons are expandable; the explicit issue-review comparison
  stays open. Normal replies remain available while next-step confirmation is
  pending.
- On mobile, the editor shows a full-width inspector when editing, and preserves
  the same mounted 3D stage for returning to the product. Title/back and primary
  actions use separate rows to avoid compressing the product name.

### Local browser acceptance — 2026-11-01

| Check | Result |
| --- | --- |
| Product canvas → edit → close → save | Passed. Headline changes retained; current Room unchanged before publish. |
| Invalid collapsed document | Passed. Empty title blocks preview; Open reveals its disclosure and focuses the title. Restoring the title allows preview. |
| Preview options | Passed. Desktop/390px device and overview/specs page selection retained. Component and document disclosures appear in the buyer preview. |
| Product release | Passed. Change review shows only the edited headline; publication is disabled until explicit review confirmation; local version 2 produced. |
| Full buyer/seller journey | Passed using isolated walkthrough WT-694134f7-c182-404c-a6f0-026b83da13ee and project PRJ-DEMO-CEA75523. |
| Inquiry → quotation v1 | Confirmed inquiry; seller edited/reviewed and explicitly issued v1, 20 units, $3,950 priced subtotal. |
| Change → quotation v2 | Buyer reviewed/confirmed 30 units and requested 5 weeks; seller reviewed/issued v2 with $5,500 priced subtotal and proposed 6–8 weeks still explicit. |
| Historical version | Opening v1 retained 20 units/$3,950 and its historical status. Open latest quotation returned to v2. Product version 1 remains attached to this project. |
| Resolve and move forward | Buyer reviewed/confirmed engineering-review request; seller reviewed/confirmed reply; buyer conversation shows both records and Demo complete. |
| Responsive review | Chrome viewport overrides at 390×844 and 320×780: editor and buyer conversation fit without page overflow. Seller comparison at 390px retains readable previous/current columns. These are browser viewport checks, not physical-device or hardware benchmarks. |
| Browser console | No application errors captured during the product editor/preview/release run. |
| Regression | npm run verify: 565 tests, 564 passed, 1 existing skip, 0 failures; project/drawing checks and production build passed. Final reply-availability adjustment additionally passed all 18 seller tests; final CSS/header build passed. |
| Design detector | Impeccable scan of all 16 changed UI files returned no mechanical findings. |

Local screenshots (ignored review artifacts):
`work/workspace-simplification/studio-desktop.jpg` and
`work/workspace-simplification/studio-mobile.jpg`.

No domain schema, persisted identity, API, model package, Explorer renderer or
inquiry/quotation state transition was changed. Existing automated coverage for
source revisions, drawing mappings, overview snapshots and immutable quotations
remains passing.

### Hosted acceptance

- Deployment commit: `d307619232d239e413eb4359e2658db3864a1f8b`.
- [GitHub Pages build and deployment](https://github.com/kyle-annora/annora-explorer/actions/runs/41377927174): success.
- Live Studio verified: Open product enters the full canvas; Edit settings opens the
  inspector; embedded 3D loads and retains the previously saved accent preference.
- Live Product Room verified: cross-workspace links load under `/annora-explorer/`,
  Specs & docs exposes the new collapsed component/document rows, and My projects
  loads the existing browser-local draft.
- Production-build subpath verification also passed Studio → Drawings → Product
  Room → Specs → Connecting rod → Locate in 3D, preserving `part=rod`.
- Hosted screenshot: `work/workspace-simplification/studio-hosted.jpg`.

Review links:
[Studio](https://kyle-annora.github.io/annora-explorer/studio/),
[Product Room](https://kyle-annora.github.io/annora-explorer/product-room/),
[guided walkthrough](https://kyle-annora.github.io/annora-explorer/walkthrough/).
