# Shared Explorer navigation

## Decision

The guided demo and free Explorer are two views of the same product. Model
identity and the mode switch remain in one header. A visitor should be able to
inspect a part, watch its explanation, and return without losing their place.

| Level | Demo | Explore |
| --- | --- | --- |
| Shared header | Model selector, Demo / Explore | Same controls in the same positions |
| Context navigation | Chapters and current chapter count | Assembly path and parts index |
| Scene controls | Rotation, pause, replay, progress, next chapter | Selection, framing, render style, assembly actions |

The new header replaces the spatial demo's separate large identity/navigation
block and the free workspace's floating presentation entry. Existing scene
controls retain their roles. Both spatial and timeline demos use the same
header position for chapter navigation.

## Switching rules

- **Demo** resumes the last chapter and action progress, paused. Spatial demos
  also remember the camera within each visited chapter.
- **Explore** restores the previous inspection, including selection and camera.
  A timeline's secondary **Explore this view** intentionally keeps the current
  demonstrated scene; it is labelled separately from the mode switch.
- Browser Back and Forward reconcile the mode with the URL. Spatial chapter
  changes also participate in history and retain their individual checkpoints.
- Changing models preserves Demo or Explore when the destination supports it.
  Model-specific chapter hashes are cleared. Products without a demo remain in
  Explore with an explicitly unavailable Demo control.
- Open Duck and Hexapod use the spatial demo by default. Existing explicit
  `guide=timeline` links continue to open the timeline.
- Paused checkpoints are held in the current page session. A full reload uses
  the requested URL and does not promise persistent personal camera/playhead
  storage. Checkpoints never enter customer project or quotation records.

## Implementation boundaries

- `ui/viewer-navigation.js` owns the persistent header and relocation of the
  existing controls. It retains their IDs and listeners.
- `orbital-navigation.js` owns spatial mode/chapter history and checkpoints.
- `timeline-navigation.js` owns standalone timeline mode history and checkpoints.
- `tour-ui.js` keeps playback ownership. User exits can use the route adapter;
  external controller commands retain their existing contract.
- Spatial rendering still borrows the existing renderer. On return, the saved
  inspection camera is restored after the free layout is measured.
- Embedded Explorer instances do not mount this standalone navigation shell.
  Product Room, Studio, drawing versions and commercial data are not changed.

The references informing the shared model/mode hierarchy were Vectary's
Design/Preview navigation and Arcade's edit/preview navigation. The existing
Annora neutral surfaces, accent treatment and floating scene controls remain
the visual reference.

## Acceptance

1. Open a spatial detail, scrub to 65%, switch to Explore, select and rotate a
   part, then return to Demo. Verify the detail resumes at 65%, paused.
2. Visit another chapter, scrub to 40%, and use Back/Forward. Each chapter must
   retain its own playhead. Return to Explore and check the original part and
   framing, including the projection offset.
3. Repeat mode switching and history with Apollo and the crank timeline. Check
   exact chapter-end checkpoints as well as an intermediate playhead.
4. Change models while in Demo. The destination stays in Demo, and its chapter
   selector remains in the same place. Check an explicit old timeline link.
5. At 320, 390, 844 and 1440 CSS pixels, check the model selector, mode switch,
   chapter popup and appearance control. Verify no horizontal overflow, distinct
   active/hover states, 44px primary targets, and keyboard menu focus/return.
6. Verify direct embedded routes retain their original controls. Run the full
   regression suite and check the compiled repository subpath before release.

Local browser evidence is kept under `work/navigation-review/`: the original
audit, responsive screenshots and functional JSON results. Browser checks use
Chrome desktop and viewport/touch emulation; they are not measurements on a
physical low-end phone or laptop.

## Review record — November 4, 2026

- Full validation: 646 tests passed, one pre-existing skip; asset checks and
  production build passed.
- Six browser journeys passed on the compiled `/annora-explorer/` subpath:
  Open Duck, Hexapod, Apollo, crank, switching models within Demo, and the
  explicit legacy Open Duck timeline link.
- The compact embedded viewer, Product Room viewer, walkthrough viewer and
  keyboard exit/history checks passed without the standalone header leaking
  into the embedded interfaces.
- Responsive and chapter-menu keyboard checks passed at 320, 390, 844 and
  1440px. New mode targets are 44px; active state stays distinct from hover.
- On desktop and touch emulation, revisiting a paused detail restored the same
  visible meshes, opacity, transforms and camera. Hexapod electronics showed
  8 visible meshes, whole model 92, then electronics 8 again; Open Duck head
  showed 39, whole model 170, then head 39 again.

Two issues found during review were corrected: a projection-offset shift when
returning to the free camera, and incomplete visibility transitions when
returning to a visited chapter. Geometry and appearance were checked in
addition to the numeric chapter/playhead state.
