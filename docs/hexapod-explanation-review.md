# Hexapod explanatory chapter — review

## Delivered scope

The Hexapod leg chapter now explains two moving joints and one foot path. A
2.8-second presentation includes short resting holds around approximately two
seconds of movement. The source model and its authored clip are unchanged.

A fixed side diagram samples the same joint pivots and foot point as the 3D
scene. It stays aligned while the camera rotates. On small screens it opens on
request and pauses playback. Plan, elevation and section references remain
available through **Reference drawings**.

**Inspect this assembly** opens the front-right leg in Explore, assembled and
unisolated. **Demo** returns to the paused chapter and camera. The global
**Explore** action continues to restore the visitor's previous workspace.

This is the first explanatory chapter. The other model chapters, rendering
styles, Product Room, Studio and versioned commercial data were not redesigned.

## Verification

- Project validation, model/drawing validation, regression tests and production
  build passed: 667 tests, 666 passed and one existing skip.
- Source-geometry assertions confirm the diagram receives actual joint positions,
  the rest pose stays fixed, backward scrubbing is reversible and the foot returns
  to its starting point. The inactive body-side joint is not described as moving.
- Desktop 1440×1000 and touch-emulated 390×844 / 360×740: synchronized scrub,
  diagram/reference return, visible focus, at least 44px diagram controls, no
  horizontal overflow or JavaScript errors. Small-screen expansion pauses the
  action; Escape closes the diagram before leaving the chapter.
- Short-screen review found and corrected an expanded diagram heading clipping
  beneath the header. The figure now fits within the stage; exceptionally short
  screens scroll its contents. Compiled checks passed at 320×568, 844×390 and
  667×375, including diagram dismissal and contextual inspection.
- Contextual inspection passed keyboard and touch checks, including entry from an
  already exploded/isolated scene. Demo returns at the saved 65% progress.
- Reduced-motion emulation starts paused and permits explicit pose scrubbing.
- Compiled output was served under `/annora-explorer/`. Five smoke cases passed:
  Hexapod inspection/resume, mobile diagram/reference return, Open Duck navigation,
  Apollo timeline return and Product Room embed. No failed network requests or
  JavaScript errors were observed.
- Compact, Product Room, walkthrough and Studio embeds retained their existing
  navigation. Open Duck/Hexapod navigation passed at 320px and 390px widths.

One initial development-server run lost the crank timeline's saved selection.
The schema file was edited during that test; it is imported by Vite's config,
so the timing is consistent with a development reload. The original failed
result is preserved. Three isolated current/baseline/current runs passed with
stable document identities and the same restored selection/camera behavior.
A separate compiled crank journey also passed: selection, camera, browser
history and paused Demo return at 65%. This does not justify changing the
unchanged crank implementation.

## Performance evidence and limits

The explanation adds an SVG figure and reuses the existing 3D stage and animation
clock. The paused scene's render count did not increase during a one-second idle
sample. Only one viewport WebGL canvas was present.

A Chrome responsiveness sample at 1440×900 recorded a 16.7ms median animation-frame
interval, with p95 of 16.7ms at normal CPU speed and 16.8ms with 4× CPU throttling.
Neither sample recorded an interval over 50ms. These are short local browser
samples, not physical low-end hardware or mobile GPU benchmarks. The build still
reports the existing large catalog bundle warning.

Customer comprehension after one viewing remains a review question. The chapter
is an illustrative mechanism clip, not validated robot control or gait analysis.

## Evidence and publication

Local browser evidence is retained in `work/hexapod-explanation-review/`,
`work/contextual-inspection/`, and the workspace's
`.local/hexapod-explanation-audit/` directory. Initial failures are retained rather
than overwritten by retries.

The exact source commit and deployment result are recorded in the GitHub
[Deploy Explorer workflow](https://github.com/kyle-annora/annora-explorer/actions).
Review the published [Hexapod chapter](https://kyle-annora.github.io/annora-explorer/?model=hexapod&presentation=1#leg).
The final handoff confirms publication only after checking that target.

See [chapter decisions and package contract](hexapod-explanation-chapter.md).
