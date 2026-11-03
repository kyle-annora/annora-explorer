# Settings component delivery review

Date: 2026-11-03. Scope: frontend component plan Phases 0 and 1 only.
Status: published and verified on GitHub Pages.
Runtime commit: `4f8f525bb8b1e88b05d49a1ea2c8d65687c19ad7`.
Baseline source: `2585778296c441b5ba1f7c8a8c43628b9aceebcb`.

## What changed

Appearance is now a scoped component with its own controls, validation and cleanup.
Display consumes plain state instead of the scene object. A shared settings
coordinator owns panel exclusivity, dismissal and focus return. The shell retains
preferences, URL writes, global keyboard precedence and interactions with tree,
Performance and presentation controls.

Generated controls and event listeners are removed on disposal. Display requests
that finish after disposal cannot update or focus old UI. Rejected requests use
the existing status area. No framework, store or rendering dependency was added.

HTML, CSS, renderer, players, controller protocol, models, drawings, commercial
screens, storage keys and data schemas are unchanged. Unrelated README/pilot work
was excluded from this release. Later refactor phases remain unstarted.

## Validation

| Gate | Result |
| --- | --- |
| Full `npm run verify` | 602 tests: 601 passed, 0 failed, 1 pre-existing skipped fixture; asset checks and production build passed |
| New component contracts | 13 tests for exclusivity, focus, validation, readiness, pending/failure recovery, disposal and remount |
| Standalone browser | 111 checks across 1280×720, 390×844, 320×740 and 844×390; zero page errors |
| Visual baseline | All 28 canonical state/layout/style snapshots exactly match; panel pixels match. One 320px trigger-corner pixel differs by one channel level |
| Host embedding | Product Room and Studio at desktop/mobile: four cases; one canvas; no host/iframe horizontal overflow |
| Models | All seven configured models load with working settings and one canvas |
| Presentation | Apollo short-step and Open Duck continuous motion retain playback while Appearance opens; explicit pause stays paused and Escape closes settings without exiting the tour |
| Preferences | Reload and two-way cross-tab theme, appearance, grid and URL synchronization pass |
| Buyer/seller journey | Desktop and mobile each complete 20 guide actions and six explicit review confirmations, from inquiry through v1, modification, v2, next-step request and seller acknowledgment |
| History and navigation | Original v1/inquiry/context and unrelated projects remain intact; rapid clicks cannot skip review; reload/resume creates no duplicate records |
| Completion layout | Checked at 320, 390, 768 and 1440px widths |

Production builds were served at the repository subpath `/annora-explorer/`.
Full-image shading can vary inside the model bounds because the unchanged contact
shadow sampling is nondeterministic; panel comparisons isolate the UI regions.
The existing catalog-size build warning remains. Physical mobile devices and
ordinary-computer GPUs have not been qualified by this refactor.

## Review routes

- [Explorer](https://kyle-annora.github.io/annora-explorer/?model=kinetic-01&theme=ember&appearance=light)
- [Product Room](https://kyle-annora.github.io/annora-explorer/product-room/)
- [Studio](https://kyle-annora.github.io/annora-explorer/studio/)
- [Complete customer walkthrough](https://kyle-annora.github.io/annora-explorer/walkthrough/)

Try Appearance → Dark/custom accent → Display → Linework/grid, then close with
Escape. The result should look and behave like the approved version. Review this
phase before extracting further Explorer or commercial components.

## Evidence and rollback

See the [baseline ownership map](frontend-settings-baseline.md),
[implementation plan](frontend-component-refactor-plan.md),
[browser harness](../scripts/review/settings-panels/README.md) and
[evidence folder](evidence/settings-panels/).

This is a source-only component extraction. Reverting the runtime commit restores
the previous composition without any model, drawing or commercial data migration.

## Publication record

- Deployed source: `91cc8072bde6d13f91cc09cf5acf4c80f2d75b67`.
- Runtime extraction: `4f8f525bb8b1e88b05d49a1ea2c8d65687c19ad7`.
- [GitHub Pages deployment](https://github.com/kyle-annora/annora-explorer/actions/runs/41741849858): successful; CI validation and build passed.
- Live entry bundle `explorer-JNun_L9L.js` matches the locally reviewed production artifact.
- Hosted standalone settings: all 111 checks across four viewports passed, with no page errors.
- Hosted Product Room and Studio: all four desktop/mobile iframe cases passed, with one canvas and no overflow.
- Hosted Kinetic, Apollo and Open Duck: loading, settings and tour behavior passed; two-way preference synchronization passed.
- Hosted desktop commercial walkthrough: all 20 guided actions and six explicit review confirmations completed, including v2 and seller acknowledgment. History, unrelated fixtures, repeat-click guards and reload/resume remained intact.

The hosted evidence is retained beside the local evidence. This publication
record is a documentation-only follow-up; the deployed runtime revision above
remains the reviewed build. Phases 2–5 await review of this bounded pilot.
