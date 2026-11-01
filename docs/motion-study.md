# Crank motion study

Independent review preview, based on `ada76ab`. The production Explorer is unchanged.

## Reference lock

- Mechanical Watch: one visible causal chain; reversible inspection of source motion.
  https://ciechanow.ski/mechanical-watch/
- Oxide: compact floating controls and continuous spatial context.
  https://explorer.oxide.computer/
- Atlas: composed decomposition and restrained flat color over crisp contours.
  https://atlasmotion.com/#jdm
- Preserve Ember, current geometry, source animation, engineering/line rendering
  and the existing single scene/render clock. Do not add cinematic camera orbits.

## Review behavior

Three independent 2.5-second actions: Motion, Inside and Restore. Each action
holds at its endpoint; it never automatically advances to the next action.
Play resumes a paused action; at its endpoint it plays that action again. Replay
always starts the current action at zero. The timeline is local to that action
and supports backward seeking, including exact endpoints. Changing views stays
paused. Dragging the model grants manual camera control.

The motion view uses a fixed authored camera and highlights the rotary input.
The rod and guided carriage remain visible together. Inside separates meaningful
groups with the rod highlighted; Restore returns exact source rest poses.
The exploded view is explanatory, not a manufacturing/disassembly procedure.

The original four-second GLB clip is sampled from 0 to 1 over 2.5 presentation
seconds. This changes playback timing only; it does not change pivots, joint
relationships or source geometry, and is not a claim about real machine speed.
Source model: Kinetic 01 by Pradeep Kaushik, MIT. Model licensing remains included.

## Architecture and evaluation

New tour data lives in `content/models/kinetic-01/motion-study.json`. The original
tour remains a regression fixture. The experimental player option stops at exact
chapter boundaries; the pure sampler can hold that chapter's end state. Both
options are opt-in and absent from the production deployment.

Review: pause mid-cycle; scrub backward; scrub both endpoints; replay after orbit
takeover; switch chapters repeatedly; inspect Inside then Restore; test keyboard,
portrait and compact landscape; inspect source-pose fidelity and retained memory.
Record device coverage honestly. Viewport emulation is not physical-phone proof.

## Verification record — October 31, 2026

- `npm run verify`: 253 tests passed; project validation and production build passed.
- Browser checks: initial paused state, 2.50-second endpoint hold without automatic
  advancement, mid-action pause, replay, reverse scrub, exact endpoints, all three
  views, manual orbit takeover and replay returning to the authored camera.
- Responsive checks: 1280 × 720 desktop, 390 × 844 portrait and 844 × 390 landscape.
  Landscape transport fits without scrolling; no horizontal overflow was found.
- Existing 12-second local benchmark, Balanced: median 59.88 fps, p95 frame
  interval 17.6 ms, 220 draw calls/frame, zero frames above 50 ms, first linework
  frame 15.1 ms. These are results for the current browser/device only. Physical
  ordinary-computer and mobile-device validation is still pending.
- No console warnings or errors appeared in the inspected local preview session.
- Original source GLB is unchanged: SHA-256
  `5356cb1e7dcf85874c1f2152795b7011f43f01c2bfc899a5fa75a198687204ad`.

The preview lives on branch `preview/crank-motion-study`. A separate, build-only
GitHub Pages repository publishes it; the main Explorer deployment is unchanged.

- Preview: https://kyle-annora.github.io/annora-explorer-motion-preview/
- Preview source: https://github.com/kyle-annora/annora-explorer/tree/preview/crank-motion-study
- Original Explorer: https://kyle-annora.github.io/annora-explorer/
