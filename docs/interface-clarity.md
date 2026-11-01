# Interface clarity review

November 1, 2026. Implements the approved first stage only.

## Reference lock

Keep the existing Annora/Oxide floating interface, dark surfaces, modest radii,
Ember and model prominence. Preserve Engineering, clear Linework, flat highlights,
explosion, authored operation and the short-action guided player.

Use professional scene tools' separation of selection and scope, as discussed in
the November 1 review. A selection should describe a part without entering a
different assembly. An explicit **Inspect** action enters it. **Fit in view** only
centers the current selection. Parent navigation returns through the same public
controller; render and animation behavior remain shared with external hosts.

## Customer-facing changes

- Search names and source labels in the assembly index. Matching ancestors remain
  visible; results are bounded and tell visitors when to refine the query.
- Locate the selected item or collapse branches without changing the camera.
- Show **Viewing** for the current scope and a persistent Ember marker for the
  selected item. Use a separate keyboard focus outline and neutral hover.
- Show a labeled current viewing path and an explicit parent-return control.
- Keep functional descriptions and authored product facts. Use **Part of** for
  assembly membership; move source mesh counts and labels into **Model details**.
  Do not present source mesh counts as physical quantities or expose hierarchy
  depth as a customer fact.
- Retain selection, isolate/show-context, render modes and all existing playback
  controls. Disabled controls do not pick up an enabled hover treatment.
- Keep mobile search, tree tools and primary actions touch-sized; preserve the
  existing collapsible detail sheet and tour takeover behavior. Keep detail
  actions outside the scrolling body so they remain visible in short landscape.

## Interaction contract

| State or action | Visitor-visible meaning |
| --- | --- |
| Select a row | Highlight and describe it; keep the current viewing assembly. |
| Expand a branch | Reveal child rows; do not move the camera. |
| Inspect assembly / Inspect part | Enter that item and bring it into view. |
| Fit in view | Center the selection without changing assembly or operating mode. |
| Viewing badge and top path | Identify the assembly or part currently being viewed. |
| Isolate / Show context | Hide / restore surrounding parts; reflect the selected item's actual isolation state. |
| Selected | Ember text, wash and a persistent edge marker. |
| Hover | A neutral surface; an already selected control retains its accent. |
| Keyboard focus | A separate high-contrast outline. |
| Unavailable | Disabled, muted and without enabled hover feedback. Individual parts cannot be exploded; Apollo keeps its structural-model explanation for unavailable operation. |

Selecting another branch while inspecting a latch does not silently enter it.
The right panel explicitly says that the selection is outside the current view
and offers Inspect. Searching, locating and collapsing the tree preserve the
viewing scope. Parent navigation retains a usable keyboard focus destination.

Search is indexed once per package and runs only on input/navigation events. It
does not add work to the render loop. No geometry, model revision, API contract or
animation duration changes are required for this UI update.

## Deferred scope

Product Room and Studio are recorded in [the product roadmap](product-roadmap.md).
Neither is implemented in this release.

## Validation

- `npm run verify`: project/package validation, 271 passing tests and production
  build. Nine new cases cover selection versus scope, factual information and
  bounded search against all three included model packages.
- Built files served at `/annora-explorer/`, matching the GitHub Pages subpath.
- Desktop at 1280 × 720: selection, Inspect, parent return, search/no-result/Escape,
  locate, collapse, isolate/show context and switching the isolated selection.
- Responsive iframe viewports at 320 × 740, 390 × 844, 844 × 390 and 768 × 1024:
  no horizontal overflow; search and drawer exit; selected versus viewed states;
  pinned detail actions; Apollo unavailable-operation explanation. Primary touch
  controls and tree controls are at least 44 CSS pixels high.
- Both models: Engineering, Linework and flat-highlight controls; explosion and
  restoration; guided-player entry, next step, replay, progress seeking and exit.
  Crank operation retains the 2.5-second cycle and manual progress control.
- Current Mac / in-app browser, 1280 × 720, Balanced: Apollo's standard 12-second
  orbit/separate/reassemble check measured 59.88 median fps and 17.6 ms p95 frame
  interval in Engineering and Linework, with no intervals over 50 ms. Median draw
  calls were 1,608 and 4 respectively. These are local static-server runs with
  previously loaded assets, not cold-network loading measurements.

No new renderer, animation loop or dependency was added. Physical ordinary-laptop
and phone testing remains pending. Responsive browser sizing is not certification
on an integrated-GPU laptop or physical phone; CPU submission time is not GPU time.
