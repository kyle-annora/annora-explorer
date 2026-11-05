# Hexapod view workspace

The standalone Hexapod Explorer now separates **how to navigate** from **what to view**.

- **Demo / Explore** selects guided explanation or free inspection.
- **3D / Drawings / Compare** selects the representation of the current assembly.
- **Engineering / Linework / Flat highlight** remains the appearance of the 3D model.

Review route: `/?model=hexapod&presentation=1#leg`.

## Reference and layout decisions

The existing Annora neutral floating workspace is the visual target. Keep its typography,
custom accent and restrained control states. The Spline viewport reference separates
projection controls from material properties; use that separation without copying its
dense authoring panels. The previously approved Mechanical Watch reference informs the
motion explanation; its live two-joint diagram remains a 3D companion.

| Decision | Source | Application |
| --- | --- | --- |
| One persistent representation switch | Approved user proposal; Spline editor viewport | Same 3D / Drawings / Compare controls in Demo and Explore |
| Full-size drawings | User's request to inspect technical diagrams | Reuse the existing SVG drawing reader with pan, pinch, Fit and zoom |
| Side-by-side only when space permits | Existing Annora mobile requirements | Compare above 980 CSS pixels; 3D / Drawings at narrower widths |
| Preserve inspection context | Existing viewer navigation contract | Pause when switching, retain chapter, selection and camera checkpoints |
| Explicit reference status | Existing model source metadata | Model reference / At rest; no invented dimensions or document approvals |

Reference screen: https://refero.design/pages/42c103b0-f7ac-4e89-b0cc-d77d174aa739

## Viewer behavior

**3D** keeps the existing model, interaction, annotation and optional motion diagram.
**Drawings** opens the current assembly's prepared Plan, Elevation or Section A–A at
full size. **Compare** places the interactive 3D pose beside the at-rest reference.
The two panes share the assembly/chapter context, not a falsely synchronized pose:
the diagram remains at rest while the 3D action can be played or scrubbed.

Switching representation pauses rotation and action playback. Returning to 3D does
not restart the action. Each full-size camera checkpoint belongs to its semantic
workspace and context, so remounting Demo does not erase it. Compare may reframe
within its smaller canvas; returning to the original size restores the full-size
camera. A changed physical viewport is refitted for visibility instead of restoring
a desktop framing on a phone.

Escape first returns a drawing/comparison view to 3D. The existing chapter/Explore
Escape path then resumes. Below 981 pixels, Compare is omitted; an already-open
Compare view becomes Drawings when the viewport narrows. Users retain full-size
controls and can return to 3D.

In Explore, real hierarchy ancestry and authored mesh membership choose an available
reference. The front-right-leg detail does not stand in for every leg. Unmapped parts
use the whole-model reference. No region-to-part hit targets are fabricated.

## Content and reuse

Hexapod is the first opted-in package (`referenceWorkspace: true` in its spatial guide).
The shared implementation has no model-ID branches. Asset URLs still come from the
validated spatial-guide pipeline, retaining source hash and model revision checks.

These SVGs are model-derived orthographic projections and mesh sections, not approved
manufacturing drawings. No dimensions, tolerances, document revision or original PDF
are invented. The separate versioned SK08/linkrod document workflow remains unchanged.

`reference-context.js` resolves authored assembly coverage. `reference-workspace.js`
owns representation state and camera checkpoints. `reference-reader.js` owns projection
choice and reuses `createDrawingView` for SVG pan/zoom. Orbital UI supplies a private
pause/camera adapter; no Three.js objects cross the public controller boundary.

There is one existing WebGL renderer and clock. The additional reader is event-driven
SVG. Other model packages, embedded Explorer, Product Room, Studio and saved inquiry /
quotation / drawing versions do not opt into this standalone change.

## Review sequence

1. Open the leg chapter, pause at a recognizable point, and adjust the 3D camera.
2. Choose Drawings. Inspect Plan, Elevation and Section; zoom and pan, then Fit.
3. Choose Compare on desktop. Play or scrub the 3D action beside the at-rest reference.
4. Return to 3D; confirm paused progress and the original full-size camera.
5. Switch Demo → Explore → Demo while viewing drawings and while comparing.
6. Change the chapter while in Drawings; confirm its reference updates without autoplay.
7. On mobile, check the same chapter and drawing controls at full size. Use Escape
   or the 3D control to return; narrow a desktop Compare view to test the fallback.
8. Confirm another model and embedded commercial workflows retain their prior UI.

Validation results and release evidence are recorded separately in
`work/reference-workspace-review/` and `docs/hexapod-view-workspace-review.md`.
