# Continuous inquiry integration · review

## Candidate scope

Stages 1 and 2 of the [delivery program](explorer-to-quote-program.md): floating
inquiry in Product Room and its guided walkthrough, plus in-context requests from
SK08 and connecting-rod drawings. Renderer, model assets and the underlying
quotation/version rules remain unchanged. Stage 3 customer-product reuse is
tracked separately and is not included in this candidate's completion claim.

Review routes:

- [Customer walkthrough](https://kyle-annora.github.io/annora-explorer/walkthrough/?new=1)
- [Crank Product Room](https://kyle-annora.github.io/annora-explorer/product-room/?model=kinetic-01)
- [SK08 drawing workspace](https://kyle-annora.github.io/annora-explorer/drawing-preview/?product=sk08&view=drawings)
- [Connecting-rod drawing workspace](https://kyle-annora.github.io/annora-explorer/drawing-preview/?product=linkrods&view=drawings)

Published source: `f9f71b9d8deff34839b6df0437063d25f79ded54`.
[GitHub Pages deployment](https://github.com/kyle-annora/annora-explorer/actions/runs/42176190544) succeeded. The target verification matched 35 served resources to the compiled build; the receipt is `work/explorer-to-quote/release/release.json`.

## Evidence recorded so far

| Check | Result |
| --- | --- |
| Full repository verification | 747 tests, 746 passed, zero failures, one existing skip; production build passed |
| Desktop walkthrough | Complete request, clarification/reply, v1, change, v2, comparison and next-step response; eight separate confirmations |
| Room save/navigation | Minimize/resume, Edit, Back, review reload, close; injected save failure blocks departure and keeps input |
| Drawing entry | Both products: same saved detail across exploration; explicit adoption; original PDF; application review with unknown quantity |
| Drawing commercial history | Seller requires quantity, v1 → change → v2 → historical v1 and reload |
| Source A→B | Actual B PDF imported; seven mappings manually confirmed; reviewed publication and project adoption; v2 retains B while inquiry and v1 retain A |
| Drawing mobile | Both products at 390 px, 320 px and 844×390; short-landscape legend overlap fixed and ordinary clicks retested |

Compiled-subpath verification passed for the desktop, 390 px, 320 px and short-landscape cases described above. Public verification passed for complete desktop/mobile Room and walkthrough journeys, plus SK08 source A→B on desktop and inquiry→v2 on mobile. Evidence and hashes are linked from the [progress record](explorer-to-quote-progress.md). Browser emulation is not physical-device qualification.

## Issues and preserved retests

- **EQ-I01:** The walkthrough suggested role handoff immediately after inquiry
  confirmation, bypassing the visible receipt action. Receipt/resume/recovery
  and active review tasks now retain action ownership. Full desktop retest passed.
- **EQ-I02:** At 844×390 the drawing overview legend overflowed into the footer
  hit area. The narrow overview stage now grows with its contents. Six focused
  layout cases and both complete landscape journeys passed without forced clicks.
- Retired drawing views can cancel revoked blob-image requests. These are retained
  as lifecycle diagnostics; currently visible image resources and HTTP failures
  are checked separately. They are not silently counted as successful assets.

Evidence is under `work/explorer-to-quote/`, grouped by stage and candidate.
Earlier failed runs remain alongside successful retests. The reusable integration
contract is [documented separately](embedded-inquiry-integration.md).

## Limits

Fictional data, browser-local persistence and explicit review remain in effect.
No backend, real quotation delivery, customer account or manufacturing approval
was added. The existing unavailable-prepared-model test skip and large catalog
bundle warning remain. Current acceptance does not establish physical-device
performance, first-time customer comprehension or conversion improvement.
