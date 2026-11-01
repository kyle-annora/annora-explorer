# Display craft and open-source review

Date: 2026-11-01. This revision implements the approved refinement of the existing
Explorer. Product Room and Studio remain in the [roadmap](product-roadmap.md).
No customer-specific content, new rendering dependency, editor framework or backend
is added. Existing model packages, animation timings and camera interpolation are retained.

## Reference lock

Oxide remains the visual anchor: compact floating surfaces, a model-first canvas,
neutral technical typography and one client accent. Atlas contributes the linework
hierarchy: clear silhouettes, quieter internal details and flat selected-color regions.
Rhino contributes explicit display rules rather than a claim of CAD feature parity.
We do not claim to implement Rhino's intersection solving, analytic NURBS outlines,
clipping planes, section hatching, drafting tolerances or viewport engine.

Sources actually inspected:

| Source and pinned revision | Files / behavior examined | Adopted here | Deliberately excluded |
| --- | --- | --- | --- |
| [PlayCanvas PCUI](https://github.com/playcanvas/pcui/tree/55e6fad22f62ae86863d71dccc3961b015427bef), MIT | `src/components/TreeView/style.scss`, `TreeView/index.ts`, `Button/style.scss`, `Panel/style.scss`; selection, expansion, focus, disabled controls and panel headers | Separate disclosure, selected state and scope; consistent rows; keyboard traversal; restrained headers | Desktop editor density on touch devices; framework replacement |
| [Kaamos](https://github.com/AtomiLabSlop/kaamos/tree/950dab31cff8604580e44d9fc758f4a2f9af7fe0), AGPL-3.0-only | `src/store/ui.ts`, `src/ui/Toolbar.tsx`, `src/scene/SelectionOutline.tsx`; ephemeral state, grouped controls, screen-space selection | Action / view / display grouping; display state separate from model data; selected emphasis survives hover | Source copying, path tracing, authoring tools and always-through-object selection outlines |
| [Speckle](https://github.com/specklesystems/speckle-server/tree/51d43b91c4681a75bff8b285da7f443a4599da67), repository-specific licenses | `packages/frontend-2/components/viewer/controls/ButtonGroup.vue`, `ButtonToggle.vue`; `packages/viewer/src/modules/extensions/SelectionExtension.ts` | Deliberate control groups; distinct hover / selected / disabled states | Collaboration backend, model-version comparison and repository code reuse |
| [Rhino Technical display](https://docs.mcneel.com/rhino/8/help/en-us/options/view_displaymodes_technical.htm) | Visible lines, silhouettes, creases and hidden-line treatments | Exposed contour / feature / hidden-edge rules and consistent screen-space weights | Presenting prepared mesh edges as exact manufacturing drawings |

These are source-study references, not runtime dependencies. The implementation is
original. In particular, no AGPL source was copied into this MIT starter. Research
copies are local ignored files, not part of the published repository or build.

## Decisions implemented

- Neutral graphite replaces the purple cast in surfaces, studio lights and the
  optional grid. The default grid is off. The model remains the dominant object.
- Tree rows stay on one line, retaining full accessible titles and tooltips. Root
  labels use the package's short title. Branch disclosure never changes selection
  or camera scope. Arrow keys move focus / open branches; Enter selects; Inspect
  enters the chosen scope.
- Selected item, assembly membership and model provenance have distinct hierarchy.
  Repeated current-view prose is removed. Fit in view is neutral; Inspect keeps
  accent emphasis. Isolate retains its explicit pressed state.
- The bottom dock separates Action, View and Display. Mode-specific settings live
  in one floating panel. Mobile uses a bounded, scrollable overlay with 44 px rows.
  Escape, outside press and competing overlays close it; focus returns to the trigger.
- Hover previews are neutral. A selected part keeps its Ember outline even when
  another part is hovered. Hover never paints a different part with flat fill.

## Rendering contract

| Rule | Engineering | Linework | Flat accent |
| --- | --- | --- | --- |
| Purpose | Read finishes, form and contact | Read silhouettes and internal features | Explain one part in context |
| Surfaces | Package-authored PBR finishes under neutral studio lights | Depth-only surfaces: no surface shading | Selected / tour-emphasized part uses unlit accent fill |
| Visible outlines | Selected part only | Bright neutral, 1.8 CSS px standard | Bright neutral; filled-part boundary white |
| Internal features | Physical material boundaries | Quieter gray, 1.05 CSS px standard; optional | Same, with white boundaries on fill |
| Hidden geometry | No through-surface selection glow | Hidden by depth; optional selected dashed edges | Same; solid selected fill remains legible |
| Hover | Quiet emissive preview, or neutral outline if nothing selected | White preview; selection stays accent | White preview; fill remains selected |
| Context outside scope | Faint neutral context | Faint silhouettes; overlap brightness capped | Same |
| Quality controls | Contact shadows and optional grid; AO respects device budget | Fine / Standard / Bold; feature lines; selected hidden edges | Same |

Line weights are multiplied by 0.75 at viewports up to 480 CSS px. Ratios are
computed from immutable base widths at each resize, so switching DPR or weight
cannot compound thickness. Hidden lines use a 4 px mark / 4 px gap, depth-greater
comparison and reduced opacity. They are off by default. This is prepared mesh-edge
illustration, not a tolerance-certified hidden-line drawing.

## Performance and integration boundaries

The existing on-demand render loop is retained. Line geometry, adjacency and batching
are prepared once. Preference changes update uniforms or visibility, not topology.
The optional hidden-edge pass shares the existing crease geometry and adds one line
batch only while enabled and an active part is emphasized. No extra full-screen
postprocessing pass is introduced. Engineering uses the existing SSAO budget.

`display-profiles.js` owns validated defaults. `display-ui.js` is a shell consumer of
`setDisplayOptions`; Three.js objects remain private. Capture/restore includes the
preferences and accepts older bookmarks. See [API](api.md).

## Evaluation

Automated checks cover preference validation, partial updates, bookmark capture,
selection/hover independence, depth-only surfaces, shared hidden-edge geometry,
bounded line batches, non-compounding DPR/weight changes, source geometry ownership,
pose restoration and existing tour transitions. Browser evidence and measured device
results are recorded below before release. Responsive viewport checks do not certify
physical phone GPU performance.

### Release checks

- `npm run verify`: package checks, 276 tests and production build passed.
- Built repository subpath tested at `/annora-explorer/`, including Apollo and
  crank packages. Engineering, Linework, Flat accent, hierarchy entry, selection,
  isolation, separation/return and authored tour transitions were inspected.
- Real iframe viewports: 320 × 740, 390 × 844, 844 × 390 and 768 × 1024. Display
  controls are reachable, the panel scrolls at short heights, and the tablet
  document reports no horizontal overflow. These are viewport checks, not hardware emulation.
- Apollo default Linework, Balanced, 1280 × 720 on the current Mac/IAB session:
  12.0 seconds, 720 rendered frames, median 59.88 fps, p95 frame interval 17.6 ms,
  no frames over 50 ms, 4 draw calls/frame. Local cached asset loading was used;
  these numbers do not describe a cold public-network launch. Hidden edges were off.
- No source models were reimported. No triangulation, adjacency generation or
  geometry upload was added to interaction frames. The display panel caches its
  last semantic state and does not rewrite hidden DOM on each tour animation frame.

Remaining evaluation: physical ordinary Windows laptops and iOS/Android devices;
GPU execution time and peak GPU memory; broader imported-model topology coverage.
The optional dashed hidden-edge treatment is an illustrative mesh renderer, not
Rhino-equivalent CAD visibility computation.
