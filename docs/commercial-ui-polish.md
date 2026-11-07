# Commercial UI polish

A presentation refinement across the floating inquiry, buyer project and seller
workspace. The existing gray, white and charcoal system remains, with Ember
reserved for the guided primary action. Explorer behavior and commercial records
are unchanged.

## Review

[Start a fresh existing-viewer walkthrough](https://kyle-annora.github.io/annora-explorer/walkthrough/?viewer=independent&new=1).

Follow **Continue demo** through the same fictional project. Reviews still require
**Confirm & continue**. Inspect the attached part, the quotation's scope and
priced subtotal, the v1/v2 comparison, and the agreed next step. Use Guide to
reveal workspace navigation or start another sample.

## Design decisions

The existing Annora visual system remains the authority. Research informed the
following bounded patterns:

- [Attio record pages](https://attio.com/changelog/2026/record-page-redesign):
  separate record identity, current task and supporting details.
- [Mercury review reference](https://refero.design/pages/efc545db-3e3e-4034-a051-1fa4be599384):
  use a clear review boundary before committing a consequential action. Only
  reference metadata was available; this is not a claim of live-flow inspection.
- [Midday invoicing](https://midday.ai/invoicing/): organize commercial content
  around scope, line items and aligned amounts, rather than repeated status cards.

The result is one coordinated system:

1. Inquiry values remain readable when moving from editing to review. Attached
   references are explicitly named and have a **View attached part/detail** action.
2. Buyer and seller quotations share the same scope, subtotal and pricing layout.
   A priced subtotal is not presented as a final total. Explicitly unknown values
   remain unknown, and zero is not treated as missing.
3. Comparison tables show paired previous/current values. Line-item names appear
   once unless renamed. Changed-only views do not repeat a visible Changed badge
   on every row; accessible change semantics remain.
4. Project and quotation selectors share a compact task-header row. Secondary
   reference data remains expandable. Final conversation leads with the actual
   agreed action and the exact saved seller response.
5. The guide keeps chapter and buyer/seller identity at the top. Its one existing
   guarded action sits in a fixed bottom region near the working content. Menus,
   inquiry sheets and short landscape layouts reserve that region explicitly.

Values use 14–15 px text, labels generally 12–13 px, task headings 23–28 px, and
mobile text inputs remain 16 px. Numeric columns use tabular figures. No new font,
icon dependency, renderer, backend or animation loop is introduced.

## Preserved contracts

- The native Explorer, camera, selection, model assets and rendering modes.
- Draft persistence, minimize/restore, attached-view restoration and save recovery.
- Review before confirmation, stale-view guards and duplicate-action prevention.
- Exact model, drawing, overview and association revisions on saved records.
- Original inquiry and v1 history after issuing v2; unrelated project namespaces.
- API seams, fake-data isolation and browser-only storage.

This remains a demo. It does not send an inquiry, create an order, approve
engineering suitability or create a real customer account.

## Verification and publication

Published application revision: `0b91bffb129c0a9d4c57d3062f9bdd5a5420f90a`.
[GitHub Pages deployment succeeded](https://github.com/kyle-annora/annora-explorer/actions/runs/42372816776).
The public target passed 72 asset and package checks. The public independent-viewer
journey passed 46 checkpoints and 16 explicit confirmations across desktop and
mobile; an additional 22 Guide layout checks passed across intermediate, mobile,
compact and landscape viewports. The repository suite passed 1,014 tests with
one existing conditional skip and no failures.

See [acceptance evidence](evidence/commercial-polish/acceptance.json) and
[release receipt](evidence/commercial-polish/release-receipt.json) for the tested
candidate and published source revision. The earlier request-layout release is
preserved in its own evidence directory.

The independent-viewer journey harness verifies eight separate confirmations, exact
references, history, save failure, reload and storage isolation. Additional checks
cover ordinary unguided forms, mobile table layouts, Guide reachability and fixed
action placement. Tests use isolated Chrome contexts and fictional fixtures.
Viewport and touch emulation are not physical-device or low-end hardware benchmarks.
The native guided Explorer journey was not separately exercised in this round;
its source, models and rendering behavior remain outside this presentation change.
