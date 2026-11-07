# Customer follow-up delivery review — W00 / W10

## Delivered scope

The first expansion work package adds a focused customer follow-up to the existing Studio and Product Room. The seller chooses the original project's released story steps or compatible saved views, the customer requests to address, and one exact quotation or open clarification. Preview and explicit review precede confirmation. The buyer can pause, replay, explore, resume and return to the same project.

Live review entry points:

- [Buyer follow-up](https://kyle-annora.github.io/annora-explorer/product-room/?followUpDemo=crank-review-v1#explore)
- [Seller follow-up editor](https://kyle-annora.github.io/annora-explorer/studio/?followUpDemo=crank-review-v1)
- [Contract and boundaries](customer-follow-up.md)

The public entry is a fictional crank-slider project with two requests, quotation v1, a pending clarification and a two-step follow-up. Normal customer projects stay in their existing namespace. An additional version authored in a browser is local to that browser; its URL does not become a hosted private project.

## Changes and preserved behavior

- Additive follow-up domain/repository methods reuse the current project transaction and review conventions.
- Separate immutable follow-up versions and progress; old inquiry, quotation, drawing/overview and global product-release snapshots remain unchanged.
- The player uses the current story controller and single Explorer runtime, including pause, seek, takeover and short authored actions.
- Studio edits within the customer project; settings are progressively disclosed, without another top-level navigation item.
- Exact quote/question targets are checked again before entering the existing commercial flow. A resolved question remains history, with no automatic substitution.
- Saved-reference routes and seller return navigation remain distinct from follow-up landing routes. Switching projects exits the previous follow-up identity.
- The public fixture exporter accepts only the bundled fictional package. No private-data URL or backend is introduced.

## Acceptance evidence

Repository verification: **809 tests, 808 passed, 1 pre-existing skip, 0 failures**. Asset/drawing checks, production build and separate inquiry-library build passed. The existing large-bundle advisory remains; this work does not add another renderer or CAD kernel.

Compiled end-to-end evidence:

- Public v1 opens in a fresh browser; local v2 is unavailable there and does not silently fall back to v1.
- Seller edits, previews two steps, reviews, explicitly confirms v2 and opens its exact clarification.
- Buyer takeover/resume retains the selected step. A draft reply blocks leaving and keeps its input. Reply review does not send; confirmation does.
- Answering the question disables that follow-up's reply action while preserving both versions, the original inquiry and quotation v1.
- Injected storage failure recovers without losing input; Keep/Discard protects unsaved navigation; another tab's project change requires explicit reload and renewed review.
- Seller preview never saves buyer progress or performs the buyer's next action. Ordinary customer storage remains untouched by the fictional example.
- Buyer journeys passed at 320×740, 390×844 and 844×390 with one model iframe, visible controls/model, no horizontal overflow and no JavaScript errors. Seller desktop/mobile checks passed eight scenarios, including the actual 3D preview.
- The existing commercial walkthrough passed desktop, mobile and compact profiles: 21 checkpoints and eight confirmation gates per profile. The existing mobile story-authoring → preview → reviewed release → contextual inquiry journey also passed.

Local evidence: `work/product-expansion/W10/` contains the frozen handoff, test/build logs, fixture export check, compiled journey, seller failure/mobile checks, buyer mobile/navigation checks and legacy walkthrough/story regression. Live checks are preserved separately under `live-journey/`, `live-mobile/` and `live-assets.json`.

## Limits

No backend, accounts, real messages, cross-device private sharing, production analytics or measured conversion improvement. Progress means a local place in the story, not evidence of reading or acceptance. The first authoring slice uses the prepared crank model; expanded story registries, technical-view steps, question queues, comparison alternatives and production adapter qualification remain later work packages.

Mobile evidence uses Chrome touch/viewport emulation, not physical-device certification. Functional/performance boundaries verified here are one model iframe/runtime, pause on hidden/offscreen preview, no added render clock, and usable controls without horizontal overflow; no low-end hardware frame-rate claim is made.

## Publication receipt

- Deployed source: [`66a335e28fda7e7c7387878c238ce32ae4d3affe`](https://github.com/kyle-annora/annora-explorer/commit/66a335e28fda7e7c7387878c238ce32ae4d3affe).
- GitHub Actions: [run 42318948833](https://github.com/kyle-annora/annora-explorer/actions/runs/42318948833), build and deployment both successful.
- Pages deployment: `7614045065`, confirmed successful at `2026-11-07T00:34:51Z` (November 6 in Los Angeles).
- Both live entry pages returned HTTP 200 and their entry bundles matched the compiled candidate: `room-DkGQgXD4.js` and `studio-B7FrmP81.js`.
- Live full journey passed authoring, preview, review, v2 confirmation, exact question reply, protected unsent reply, resolved-target handling, immutable v1/inquiry/quote, fresh-browser public v1 and missing-local-v2 behavior.
- Live mobile journeys passed at 320×740, 390×844 and 844×390, with one iframe, no horizontal overflow and no page errors.

The follow-up delivery is complete for W00/W10. Other expansion work packages remain planned. This receipt does not claim production backend readiness, physical-device certification or measured conversion gains. The documentation receipt is recorded after the deployed source with a CI-skipping documentation commit; the runtime remains the source identified above.
