# Short-action integration review

Release scope: integrate the approved crank motion study into the main Explorer
and guided tour, and apply the same transport to Apollo structure inspection.
No source geometry, rendering treatment, branding, backend or private customer
content changes are included.

## Review entry points

- [Crank Explorer](https://kyle-annora.github.io/annora-explorer/)
- [Apollo Explorer](https://kyle-annora.github.io/annora-explorer/?model=apollo)
- [Independent iframe host](https://kyle-annora.github.io/annora-explorer/examples/embed/)

Choose **Start guided tour**, then **Play step**. Each action holds on its final
frame. **Next step** advances, **Replay** repeats the current action, and dragging
the slider inspects it in either direction. **Explore freely** keeps the final
assembled view. Closing the tour restores the prior view with playback paused.

## Reference decisions

| Reference | Adopted behavior | Boundary |
| --- | --- | --- |
| [Mechanical Watch](https://ciechanow.ski/mechanical-watch/) | A stable view makes the rotary input, connecting rod and constrained output readable. Time can be inspected manually. | Use the preserved source animation; do not infer a mechanical solver. |
| [Atlas Motion](https://atlasmotion.com/) | Crisp hidden lines, selective flat Ember and a composed separation view. | Keep the approved renderer and model package. |
| [Oxide Explorer](https://explorer.oxide.computer/) | Compact floating controls, spatial continuity and immediate visitor takeover. | Retain Annora identity, hierarchy and public controller. |

## Delivered behavior

| Surface | Sequence | Active time |
| --- | --- | --- |
| Crank tour | Rotary input to linear output → separate the connecting parts → restore | 3 × 2.5 s |
| Apollo tour | Whole hatch → separate layers → restore → inspect one latch → separate latch → restore latch → whole hatch | 7 × 2.5 s |
| Manual operation | One complete authored source cycle, with pause, replay and scrubbing | 2.5 s at 1× |
| Manual separation | Separate or reassemble the current scope; pause, reverse scrub, resume and replay | 2.5 s per action |

Times exclude asset/camera preparation and visitor reading. Reduced-motion mode
shows authored stable poses and advances only on visitor input. Tabs hidden while
a tour is active pause; a held view stops continuous rendering. Existing continuous
tours remain supported and have regression fixtures.

The crank's source clip remains 4 seconds long; the presentation retimes that
entire clip to 2.5 seconds. This is not a physical cycle-rate claim. Apollo remains
a structural model without an authored operating animation. Its separation offsets
explain the assembly; they are not a documented service/disassembly procedure.

## Shared implementation

- One scene-owned rendering loop drives both source operation and finite separation.
- `SeparationPlayer` retains start, end, current time and direction. Exact endpoint
  sampling supports pause, reverse scrubbing and source-pose restoration.
- Step tours hold the final frame within its current chapter, avoiding accidental
  scope changes at slider 100%. Replaying and advancing are explicit actions.
- Manual mode changes restore full source transforms before separating; pausing
  that alignment retains the visible pose and resumes without a rotation jump.
- The camera fits the separation envelope once. Assets and buffers are reused;
  no new package dependency, GLB, line buffer or per-frame model rebuild is added.
- The iframe API adds separation transport and atomic operation replay. Models opt
  into `presentationPolicy.actionDuration` and tours into `playback: "steps"`.
  See [API](api.md) and [model authoring](models.md).

## Validation evidence

- `npm run verify`: 262 tests pass, package checks pass and production build succeeds.
- Regressions cover exact chapter-end holds, backward seeks, replay, final restored
  poses, action-direction retention, interrupted source alignment, capability gates,
  invalid durations, supported playback modes and the unchanged continuous player.
- Browser review: crank three-step completion; Apollo seven-step completion,
  whole-to-latch scope transitions, manual operation and separation, pause/replay/
  scrub, final free exploration, and independent iframe-host control.
- Desktop 1280×720, portrait 390×844 and landscape 844×390 checked. Controls remain
  reachable; mobile tour layouts have no horizontal overflow. Standalone Explorer
  review reported no runtime error or warning. The host tab recorded one unlocalized
  MutationObserver error during navigation; its model loading, three-step playback,
  chapter advancement and final return to exploration still completed successfully.
- Built `dist/` served under `/annora-explorer/`, including `/examples/embed/`, to
  exercise the same relative asset paths used by GitHub Pages.
- A held Apollo frame counter stayed at 921 across separate observations, confirming
  demand rendering resumes only when needed.

### Current-browser performance

Apollo, Performance profile, 1280×720, pixel ratio 1. Existing 12-second orbit,
separation and reassembly scenario; local HTTP with already prepared assets:

| Treatment | Median fps | Frame interval p95 | Frames >50 ms | Draw calls/frame |
| --- | ---: | ---: | ---: | ---: |
| Engineering | 59.88 | 17.4 ms | 0 | 804 |
| Flat linework | 59.88 | 17.5 ms | 0 | 5 |

These measurements describe this browser on the available Mac. They do not certify
an ordinary laptop, physical phone, GPU time or cold-network performance. Apollo
still has 801 meshes and approximately 785k triangles; use a smaller customer
package and test target hardware before a production performance commitment.

The review artifacts are saved locally under `work/review/` (ignored by Git).
The previous independent motion-study deployment remains available for comparison.
