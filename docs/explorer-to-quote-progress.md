# Explorer to quotation · progress

Plan: [delivery program](explorer-to-quote-program.md).

## Current checkpoint

- Program authorized November 5, 2026. All three bounded delivery stages are published and verified as of November 6, 2026.
- Current Annora release: `d99f6b9a77d059906a8f17041df8d1b78ddd1971`, including the asset-free shared inquiry library and adapter-owned review hook.
- Stages 1 and 2 are published and verified on GitHub Pages. [Deployment](https://github.com/kyle-annora/annora-explorer/actions/runs/42176190544) succeeded; 35 served resources match the compiled candidate.
- The library [deployment](https://github.com/kyle-annora/annora-explorer/actions/runs/42179378985) also succeeded; its target verification matched 35 served resources. Its release is separate from the MK candidate.
- Stage 3 is live at the [dedicated MK inquiry preview](https://kyle-annora.github.io/mk-america-demo-preview/inquiry-preview/#/explorer-inquiry?node=discharge). Commit `5947f1994f5b7baa717dbc3950e966eb40bf86a5`, release `mk-explorer-inquiry-public-c5c425726386`, and all 88 served artifact hashes are verified.
- MK producer refresh is complete: generation **41**, with its exact receipt recorded below. Human acceptance and physical-device qualification remain separate from this delivery's completion.

| Stage | Status | Evidence / next action |
| --- | --- | --- |
| 0. Baseline and delivery plan | Complete | Starting release, scope and acceptance boundaries recorded |
| 1. Continuous demonstration | Published and verified | Full Room and walkthrough journeys pass; receipt/navigation issue fixed |
| 2. Drawing entry | Published and verified | Eight compiled product/viewport cases pass, including manual source A→B→v2 |
| 3. Customer reuse | Published and verified | Dedicated MK application brief uses the shared panel/session and existing repository; final recovery, PDF, public target and producer receipts passed |

## Task ledger

| Task | Status | Required evidence |
| --- | --- | --- |
| EQ-101 | Verified and published | Room floating panel + exact release + one canvas |
| EQ-102 | Verified and published | Entry convergence + guarded navigation + recovery |
| EQ-103 | Verified and published | Continue demo + buyer/seller review gates |
| EQ-104 | Verified and published | Complete desktop/mobile public journey and release receipt |
| EQ-201 | Verified and published | Same drawing repository and in-place inquiry |
| EQ-202 | Verified and published | Detail capture/restore and review identity |
| EQ-203 | Verified and published | A/B, manual review and immutable old history |
| EQ-204 | Verified and published | Public drawing flows, original PDF and host contract |
| EQ-301 | Complete | Registered MK source/authority review retained; producer generation 41 includes the separate release |
| EQ-302 | Verified and published | Shared generated bundle, configurable presentation and adapter-owned MK review; one existing viewer/store |
| EQ-303 | Verified | Four normal viewports, final compiled recovery retests, complete R1/R2 history and visually checked PDFs |
| EQ-304 | Verified and published | 88 target artifact hashes, two live journeys, exact release receipt, producer refresh and reuse handoff |

## Known boundaries

- The floating inquiry now covers the standalone crank, Product Room, its
  walkthrough and the two configured drawing products. Other models are not
  automatically enabled by the shared library.
- Spatial/orbital presentation capture is currently unavailable through the
  inspection controller; it must not be represented as a captured reference.
- Product Room, drawing, preview and walkthrough hosts supply their own repository
  and content context. The MK adapter supplies MK's engineering-brief repository.
- MK's scope is a synthetic engineering-brief discussion. This release does not
  establish a commercial quotation, manufacturer CAD, engineering acceptance or
  external delivery. Client assets stay in the dedicated MK target.
- Ordinary physical hardware, physical phone keyboard behavior and first-time
  customer comprehension remain unmeasured.

## Stage 1 and 2 evidence

- `work/explorer-to-quote/release/verify.log`: 747 tests, 746 passed, zero failures,
  one existing skip. The final CSS correction was rebuilt successfully.
- `stage-1/compiled/desktop/` and `stage-1/compiled-mobile-r3/`: complete Room and
  walkthrough routes with eight separate confirmations and unchanged history.
- `stage-1/room-guards/`: injected save failure, navigation refusal and recovery.
- `stage-2/FINAL-TARGETED-QA.json`: eight compiled cases, 108 checkpoints, actual
  B PDF import, seven manual mapping confirmations, reviewed source adoption and
  quote v2. Old inquiry and v1 remain A.
- `stage-2/overview-hit-area/`: six ordinary-click layout checks for the corrected
  short-landscape legend/footer overlap.
- `standalone-regression/`: the previously released in-Explorer inquiry and
  quotation v1/v2 flow still pass.

Paths above are relative to `work/explorer-to-quote/`. Original failures remain
preserved; the acceptance review distinguishes application defects from runner
selectors that needed to use the actual visible mobile close/resume controls.

- `release/release.json`: published revision, successful deployment, 35 target hashes and evidence digests.
- `stage-1/live/summary.json`: desktop and 390 px complete public journeys, including eight explicit confirmations.
- `stage-2/LIVE-TARGETED-QA.json`: two public cases, 30 checkpoints, including actual source B import and immutable A history.

## Shared library evidence

- `work/inquiry-library-review/release.json`: release `d99f6b9`, successful
  deployment, 35 target hashes, library manifest and public walkthrough smoke.
- Full Annora verification: 753 tests, 752 passed, zero failures, one existing skip.
  Default standalone quotation and application-review regressions passed.
- `npm run build:inquiry` produces `inquiry.js`, `inquiry.css`, `LICENSES.txt`
  and `manifest.json`. The bundle excludes models, Three.js, PDF, catalog assets
  and Studio UI. React and React DOM remain client dependencies.
- [Library contract](inquiry-library.md): explicit repository injection,
  configurable fields/labels, full custom review and unchanged review-token
  submission. Failed custom review rendering cannot enable confirmation.
- `work/inquiry-library-review/live-drawings-current/validation.json`: current
  public SK08 source A→B→quotation v2 regression passed 17 checkpoints with zero
  page errors or HTTP failures. All 39 observed resource hashes stayed unchanged;
  inquiry and v1 retained A after v2 adopted B.

## Stage 3 release evidence

The candidate is isolated at workspace path
`work-packages/mk-america/reviews/explorer-to-quote-stage-3-2026-11-05/app-candidate`.
Its [published dedicated entry](https://kyle-annora.github.io/mk-america-demo-preview/inquiry-preview/#/explorer-inquiry?node=discharge)
is separate from the existing MK demonstration. [Reuse handoff](mk-inquiry-reuse.md)
describes the adapter, supported capture and maintained boundaries.

The candidate uses the actual `d99f6b9` library with MK's existing project store,
full brief validation and confirmation token. It keeps one viewer, a pinned
selected component/view/model revision, explicit reference replacement, complete
review/open questions, existing clarification/R2 history and the actual PDF.
An ordinary inspection transition is explicit; the preceding orbital pose is
not represented as a saved inspection.

Evidence under the same MK review directory includes:

- `FINAL-REVIEW.json`, `QA-COMPLETION.json` and `FINAL-QA-EVIDENCE-INDEX.json`:
  accepted scope, exact evidence bindings and closed issues. Final automated
  verification passed **83 of 83 tests**, with zero failures; build passed.
- `compiled-final-04/`: four normal journeys at 1366×768, 390×844, 320×780 and
  844×390 passed before the final history/PDF-only fixes. Preserve the failed
  phone recovery run here as historical evidence; it is not relabeled as passed.
- Final compiled targeted verification passed **4 of 4 cases, 44 checkpoints**:
  desktop normal and three repeated 390 px save/confirmation/Back failure runs.
  These retests close the phone rollback-loop issue and retain input, the review
  gate, original R1 and an unrelated existing project through R2 and reload.
- `final-targeted/pdf-visual-review.json`: actual R1 and R2 PDFs each have two
  pages; all four pages were inspected. Pinned detail/model revision and complete
  open questions remain present, with the blank continuation page corrected.
- `live/results.json`: **2 of 2 public journeys, 22 checkpoints**, desktop and
  390 px, with zero errors. `release/release-receipt.json` records successful
  deployment, commit `5947f1994f5b7baa717dbc3950e966eb40bf86a5`, release revision
  `mk-explorer-inquiry-public-c5c425726386` and **88 matching served artifact hashes**.
- Preservation checks retain all **452 original/separate-candidate files**.
  The existing MK mainline's **86 tracked files and 85 served assets** are unchanged.
- `ui-smoke/` and the final QA index retain source-component, review and responsive
  screenshots, including the corrected short-landscape footer.

The MK producer completed generation **41**. Its receipt is
`work-packages/mk-america/runs/2026-11-06T08-16-26.281Z-c51fd1fa-0cce-4262-9746-c5200c9c318e/receipt.json`.
The exact public artifact, target and producer evidence complete EQ-304. This
closes the approved three-stage delivery scope; adding other products, real
delivery/backend services, orbital capture or a measured customer pilot is
separate work.

## Working-tree preservation

Before this program, `README.md`, `docs/open-duck-showcase-plan.md` and
`docs/pilot/` contained unrelated changes. Preserve them and exclude them from
program commits unless independently reviewed and authorized as part of a unit.
