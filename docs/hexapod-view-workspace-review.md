# Hexapod view workspace review

Reviewed 2026-11-05. Scope: the standalone Hexapod 3D / Drawings / Compare workspace,
with shared controls in Demo and Explore. See [behavior and architecture](hexapod-view-workspace.md).

## Validation

- `npm run verify`: **674 tests, 673 passed, 1 existing skip, 0 failures**; asset /
  drawing checks and production build passed. Existing large catalog chunk warning remains.
- Compiled site under `/annora-explorer/`: **12/12 state and navigation cases passed**.
  Eight camera round trips restored numeric position/target exactly; free-camera
  projection offsets also matched. Chapter and paused action progress survived
  representation changes and Demo / Explore remounts.
- Additional UI checks: **9/9 passed** across desktop, 320×568, 390×844, 844×390,
  dark Explore, keyboard navigation, OpenDuck, Apollo, Product Room and Studio.
  The compact Drawings footer was then rechecked at all three mobile sizes.
- Escape closes an open Chapters menu first, then returns Drawings to 3D. Compare
  becomes full-size Drawings when the viewport narrows; focus remains reachable.
- The reference reader was separately checked for projection remembrance, Fit /
  zoom, 44px controls, missing assets, rapid chapter changes and disposal during loading.
- No invented selectable regions are presented for Hexapod reference projections.

Two camera ownership bugs were found and fixed before release: a remounted Demo
lost its full-size camera, and a first representation change inside Demo could lose
Explore's earlier camera. Checkpoints now belong to semantic mode/context, and are
captured before both mode handoffs. Earlier failure evidence is preserved alongside
final results. A short-screen footer duplication and Escape popup precedence were
also corrected.

## Performance evidence and limits

Headless Chrome on the development Mac, 1440×900, Balanced default. Normal and 4× CPU
throttling each used **one WebGL context**, with zero context losses and browser errors.
Settled Drawings produced **zero WebGL draw calls during a one-second idle sample**.
Seven warmed representation changes took 53–70 ms normally and 69–85 ms at 4× CPU
throttling, measured from automation click through two animation frames. These are
synthetic UI responsiveness probes, not model-load/FPS measurements on ordinary
customer hardware. The reference reader uses the existing event-driven SVG engine.

## Evidence and reproduction

Local evidence remains in `work/reference-workspace-review/`:

- `compiled-final.json`, `compiled-summary.json`: twelve compiled state cases;
- `ui/results.json`, `ui/mobile-footer-fix.json`: UI and small-screen review;
- `performance.json`: normal and throttled responsiveness probes;
- screenshots, earlier failures and scripts alongside the results.

The compiled camera inspection exposes only the existing capture function inside the
test browser; it does not modify source, bundles on disk or renderer behavior. UI /
performance checks run the ordinary compiled site. Physical-device and customer-file
validation remain part of a later pilot; this change makes no manufacturing accuracy
claim and does not alter saved quotation or drawing versions.

Publication is confirmed separately against the GitHub Pages target and saved in
`work/reference-workspace-review/release-receipt.json`, including deployed commit,
workflow run and live checks.
