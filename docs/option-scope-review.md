# Option comparison and quotation scope review

W20/W21 · November 6, 2026 · Published and verified on GitHub Pages.

Application commit: `819b51638f01e9a1a5f6e9c1c58353f3cb5f0112`.
[Successful deployment](https://github.com/kyle-annora/annora-explorer/actions/runs/42324297556)
and [target verification receipt](evidence/option-scope/release-receipt.json).

This delivery connects a buyer's reviewed preference to the seller's explicit
quotation scope in one fictional crank-slider project. Explorer rendering,
motion, tours and controls are unchanged. The new comparison reuses its existing
viewer when a customer opens the connecting rod or linear guide.

## Review route

Start in [Product Room](https://kyle-annora.github.io/annora-explorer/product-room/?optionDemo=crank-options-v1).
The same browser can switch to [Studio](https://kyle-annora.github.io/annora-explorer/studio/?optionDemo=crank-options-v1)
using **View as seller**, then return using **View as buyer**. These links select
an isolated fictional store; they do not transfer a visitor's project data.

1. Compare **Guided handoff** with **Engineering support**. Both describe support
   services around the same mechanism; neither changes its geometry. Inspect
   either referenced part, return, choose a preference and review it. Nothing is
   saved until **Confirm preference**. **Help me decide** is also valid.
2. In Studio, prepare a quotation. Link the connecting-rod request to two quote
   lines. Leave the linear-guide request at **Needs clarification** and try
   reviewing: issuance is blocked. Resolve it, or exclude it with an explanation.
3. Review the complete quotation, including its frozen preference and component
   scope, then issue v1. The buyer sees the scope only after this confirmation.
4. As buyer, change the preference and confirm a second event. In Studio, a new
   quotation draft still carries v1's choice. **Review latest preference** and
   **Use this preference in draft** explicitly adopt the change; review the
   preference's coverage again before issuing v2.
5. Compare v1 and v2. The changed choice, note, scope status and line mappings are
   visible. Opening v1 shows its original choice and scope; the inquiry and both
   preference events remain unchanged.

## Acceptance evidence

| Check | Candidate result |
| --- | --- |
| F4-01 · Two packages, confirmed preference and two exact component references | PASS · rendered buyer/seller journey |
| F4-02 · Browse does not choose; editing invalidates review; cancel recovers navigation | PASS · unit and browser checks |
| F4-03 · One request maps to two stable lines; unresolved scope blocks issue | PASS · unit and browser checks |
| F4-04 · Seller draft remains private until reviewed issue | PASS · persistence assertions before both issue gates |
| F4-05 · Preference and quotation v1/v2 preserve original meaning | PASS · immutable inquiry, events and issued-v1 assertions |
| F4-06 · Invalid/missing/withdrawn option, stale review, removed line and lossy adapter | PASS · contract tests; browser stale-preference gate |
| Exact part reopening and return | PASS · same project, same fixture namespace, selected Connecting rod and one existing iframe |
| Layout | PASS · complete commercial path at 1280×960, 390×844 and 320×844; buyer interaction at 1280, 390, 320 and 844px landscape |
| Existing follow-up | PASS · exact quotation, clarification, review, local v2, missing-version refusal and unsent-reply protection |
| Existing commercial walkthrough | PASS · desktop, mobile and compact profiles; 21 checkpoints and 8 confirmation gates each |
| Target deployment | PASS · successful Pages deployment, matching public JavaScript assets and complete live desktop/mobile journeys; see release receipt |

The final `npm run verify` passed: 829 tests, 828 passed, one existing skip,
zero failures, asset checks and production build complete. `npm run build:inquiry`
also passed. [Recorded acceptance evidence](evidence/option-scope/acceptance.json).

Browser checks used headless Chrome on the development machine with responsive
emulation. There were no page errors or horizontal page overflow in the passing
journeys. No claim is made about physical-phone performance, ordinary-laptop FPS
or measured conversion uplift. No second renderer or model variant was added.

The comparison borrows aligned factual rows and restrained separators from
[Slab's comparison](https://refero.design/pages/0cf40735-f75f-49db-b156-433364ade083),
within the existing Annora tokens and explicit review pattern. Shared facts are
shown once; mobile labels each value. Original project records are collapsed
while comparing, and the saved summary is explicitly labeled **Current preference**
to distinguish it from an earlier quotation's frozen choice.

Two host issues discovered during verification were corrected: fixture identity
and exact part selection were lost on the first 3D handoff; the first unsaved
preference had no cancellation path. Closing browser checks cover both fixes. Final review also corrected the new-inquiry
exit from the isolated example, blocked a skipped confirmation from reporting
success, and enforced the seller adapter capability check.

## Boundaries and handoff

See [the contract and API handoff](option-scope.md). This is browser-local demo
data with future adapter seams. There is no backend, message delivery, account
sync, payment, automatic pricing or customer geometry configuration. The two
prepared packages are authored in a deterministic public fixture; a general
seller option-authoring interface and option-set revision workflow are deferred.
The comparison fixture hides follow-up authoring; the separate W10 follow-up
example and ordinary projects retain that capability.

Review artifacts are retained under ignored `work/product-expansion/W20/` and
`W21/`, including initial failures and passing retests. Maintained tests live in
`tests/runtime/option-scope*.test.js`, `option-comparison-model.test.js` and
`tests/quote-scope-presentation.test.mjs`. Publication details belong to
`docs/evidence/option-scope/release-receipt.json`.
