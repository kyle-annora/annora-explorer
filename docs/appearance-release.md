# Explorer appearance and interaction release

Status: compiled acceptance passed; hosted acceptance is pending deployment.

## Approved behavior

The compact production layout remains the foundation. This release restores a
consistent relationship between the chosen accent and the actual 3D interaction,
adds a visible reference-grid preference, and completes Light and Dark appearance
for the shared Explorer used by Product Room and Studio.

- The default accent remains Ember. All preset and custom accent colors apply to
  hover and persistent selection in Engineering, Linework and Flat rendering.
- A temporary hover does not clear the selected component. The two states use
  different contour emphasis while retaining the chosen hue.
- Light and Dark appearance update the floating controls and the actual render
  output together. Technical linework remains unshaded and depth-aware.
- Reference grid is available from Display in every rendering style. It is a
  visual reference plane, not a calibrated measuring surface.
- Appearance and display choices are viewer preferences. They do not migrate or
  rewrite product releases, drawing associations, saved inquiries or quotations.
- Existing selection, entry, isolation, explosion, authored operation, guided
  tour and explicit commercial review gates remain intact.

## Reference lock

The existing Pedestal-informed composition owns the layout and light canvas.
The earlier Oxide-informed dark treatment supplies charcoal surfaces and
disciplined fluorescent emphasis. Atlas-informed linework retains clear visible
edges, occlusion and flat selected-part emphasis. These references do not add
new commerce behavior or modify source geometry.

## Acceptance matrix

| Area | Required evidence |
| --- | --- |
| Rendering | Apollo and crank in Engineering, Linework and Flat, each in Light and Dark |
| Interaction | Actual pointer hover; selected A while hovering B; pointer exit; selection remains stable |
| Accent | Ember and all presets, plus very light and very dark custom values; visible contour hue agrees with the picker |
| Grid | Every render style exposes the control; on/off result is visible and remembered; foreground geometry occludes the plane |
| Continuity | Appearance changes preserve camera, component selection, explosion progress and authored playback state |
| Mobile | 320 and 390 px, touch selection without a sticky hover, reachable controls and no horizontal overflow |
| Runtime | One active canvas/context; no model reload or line-topology rebuild on appearance changes; settled idle drawing stops |
| Embedded viewers | Product Room and Studio use the same display behavior; no duplicated viewer identity |
| Commercial path | Reviewed inquiry, v1 quotation, reviewed change, v2 quotation, comparison and confirmed next step |
| Drawing history | Source A to B requires manual review; v2 references B while old records retain A; overview v1 to v2 remains immutable |
| Delivery | Repository verification, built repository subpath, successful GitHub Pages deployment, hosted smoke and workflow checks |

## Verification method

Baseline commit: `d88a6c345f80111126e3ebee1e9a3710a5e4f572`.

Browser checks use isolated Chrome contexts and fictional data. Actual hover
targets are found through pointer interaction and the visible component label.
Before/after screenshots of the same camera permit contour-color inspection
without confusing existing material or interface colors with the hover outline.
Existing commercial and drawing acceptance harnesses retain their assertions and
explicit confirmation steps.

Browser viewport emulation, CPU throttling and synthetic visibility events are
regression checks. They do not establish physical-phone or low-end GPU FPS.

## Results

The production build was served at the repository subpath
`http://127.0.0.1:8107/annora-explorer/`. All checks below used that build.

| Check | Observed result |
| --- | --- |
| Repository verification | 565 tests: 564 passed, one existing skipped test, zero failures. Project and drawing checks and the production build passed. |
| Render and interaction matrix | All 12 combinations passed: Apollo and crank, three render styles, Light and Dark. Actual hover, selected A while hovering B, pointer exit, camera continuity and grid controls were checked. |
| Accent matrix | All 72 combinations passed: ten presets and two custom extremes (`#101010`, `#f9f9f9`), three render styles, Light and Dark. The chosen raw color matched the viewer state; paired screenshots verified colored contour pixels. |
| Canvas appearance | Screenshot pixels outside the model measured RGB `243,243,241` in Light and `27,27,27` in Dark, consistently across all three styles. |
| Grid and occlusion | Grid on/off was visible in every mode. Reviewed screenshots show the reference plane behind the model and occluded by foreground faces, including unshaded Linework. |
| Shared visitor preferences | A fresh viewer starts with Ember. Dark, a custom cyan accent and grid off survived navigation from Explorer to Product Room, Studio and Apollo. Reload retained the latest style-specific grid and accent preferences. |
| Touch UI | Explorer, Product Room and Studio passed at both 320 and 390 px. Actual touch selected a different component without a persistent hover. Appearance, color and grid controls remained reachable, with no horizontal overflow. Studio mounted its mobile viewer only after opening Product model. |
| Embedded runtime | Product Room and Studio passed desktop 4× CPU throttling and mobile touch/reduced-motion checks: one canvas/context, no settled idle drawing, pause on simulated hidden state, and no browser errors or failed assets. Appearance changes preserved active operation progress; pause, replay and 40% scrub remained functional. |
| Apollo asset lifecycle | At 4× CPU throttling, switching all render styles, Light/Dark, custom accent and grid retained one canvas/context. The model, edge data and silhouette data were each requested once; no asset was requested twice. Settled draw counts stopped increasing. |
| Guided commercial walkthrough | The 21-step path completed at 320 px with its explicit review and confirmation gates. One project retained two quotations, a change request and a confirmed next step. |
| Full commercial regression | Manual chapter-by-chapter paths passed at 1440 and 320 px: inquiry, draft/review/issue, buyer modification, v2, version comparison, next-step review and seller acknowledgment. Resume produced no duplicate records; ordinary projects and a separate Studio release remained unchanged. |
| Drawing source history | Same-project A→B passed import, manual association review and adoption. Quotation v2 referenced B; earlier inquiry, quotation and discussion retained A. Original context was unchanged. |
| Published overview history | SK08 at 390 px and connecting rod at 320 px completed overview v1→v2. Historical inquiry and quotation records remained byte-identical. Original PDF, inline/open/reload preview and 1×/2×/4× zoom passed. |

The baseline actual-hover screenshot had a largely neutral contour despite the
chosen Laser red accent. In the corresponding compiled Light Engineering sample,
11,357 changed model-area pixels matched the selected red hue; only 211 changed
pixels were neutral. This is evidence for that fixed-camera sample, not a global
render-quality score. All 72 final samples contained pixels near their chosen
raw RGB values, including the light and dark custom extremes. The Appearance
trigger retains a neutral icon and a bordered color chip so those extremes do not
hide the control itself.

Evidence is collected under `/tmp/annora-appearance-qa/`. Core records are
`built/results.json`, `palette-built/pixel-results.json`,
`mobile-built/results.json`, `cross-host.json`, `performance.json`, `apollo-assets.json`,
`drawing-revision-built.log` and `overview-built/results.json`. Existing commercial
harnesses remain under `/tmp/annora-production-rollout/` and
`/tmp/annora-room-qa/`.

## Performance interpretation

The runtime checks establish bounded renderer lifecycle behavior and interaction
continuity. They do not establish a speedup on low-end GPUs. The new contour pass
uses existing pixel budgets; its per-pixel shader work still needs profiling on
representative physical hardware. Four-times CPU throttling does not simulate a
low-end GPU, and mobile viewport emulation does not replace device testing.
