# Engineering materials and lighting

This revision improves finish recognition in the existing Explorer. It preserves
navigation, camera framing, Ember, short actions, guided tours, Linework and Flat.
Finishes remain illustrative, not a manufacturing specification of the source assembly.

## Reference decisions

- [Rhino Rendered display](https://docs.mcneel.com/rhino/8/help/en-us/options/view_displaymodes_rendered.htm)
  separates materials, environment and edge behavior. Our solid Engineering
  surfaces remain independent of the technical line renderer.
- [Rhino materials](https://docs.mcneel.com/rhino/8/help/en-us/commands/materials.htm)
  distinguish metallic response, roughness and directional effects. These
  untextured packages do not supply manufacturing-oriented UVs; this revision
  does not invent brushing directions or add arbitrary normal noise.
- [Kaamos EnvironmentRig](https://github.com/AtomiLabSlop/kaamos/blob/950dab31cff8604580e44d9fc758f4a2f9af7fe0/src/scene/EnvironmentRig.tsx)
  informed the separation of baked reflections from the backdrop. Our studio is
  an original implementation. No AGPL code is copied or included as a dependency.
  Kaamos's through-occluder selection behavior is not adopted.
- [Three.js PBR materials](https://threejs.org/docs/pages/MeshStandardMaterial.html)
  and [PMREM](https://threejs.org/docs/pages/PMREMGenerator.html) provide the existing
  runtime mechanisms. Implementation is pinned to Three.js 0.180.0.

## Material and light roles

| Finish | Visual role |
| --- | --- |
| Structural satin | Broad, restrained reflection on the main form |
| Satin silver | Cleaner metallic response on linkages and smaller bodies |
| Dark machined | Dark metal with readable corners and recesses |
| Bright hardware | Narrower reflections on pins, screws and shafts |
| Polymer and seals | Dark, rough dielectric surfaces without metallic glare |
| Smoked glazing | Smooth reflective approximation with opaque depth behavior |
| Warm bearing finish | Warm metallic detail distinct from silver hardware |
| Coated surround | Dielectric colored coating distinct from bare metal |

`appearance.js` retains package-specific semantic assignments. `engineering.js`
owns material construction and the studio. Five soft reflection panels are baked
once into a PMREM with 256-pixel cube-face input. The neutral supporting lights and
reflection sources stay fixed in world space, so highlights move consistently
during orbit and operation. The backdrop remains independent.

No downloaded HDR image, transmission pass, normal texture, shadow map or animated
noise is added. Source geometry and normals remain unchanged. Temporary bake
geometry, materials and texture are released immediately; the Explorer owns and
disposes the resulting environment target.

## Selection, contact and depth

Selection remains an Ember boundary and preserves the underlying finish. Hover is
neutral and cannot steal selection. Fully occluded selection edges are suppressed;
active parts write depth. Parent context stays faint and non-occluding during
inspection. Linework and Flat retain their independent hidden-line/fill behavior.

Balanced resolves selected boundaries at the bounded drawing-buffer resolution,
with zero glow. Performance retains the lower-resolution boundary buffer and no
ambient occlusion. Contact shading uses a tighter radius and distance range to
reduce broad dark halos. Surface pixel limits, adaptive fallback and the existing
single on-demand render loop are unchanged.

## Evaluation and handoff

The benchmark is now `standard-v3`. Engineering includes a representative selected
assembly; the previous unselected run skipped outline work. Exported measurements
include `model.selectedPartCount`. Do not compare v3 Engineering directly with
historical v2 unselected measurements.

Automated checks cover finish assignments and optical separation, independent
per-part state, opaque depth behavior, source geometry ownership, deterministic
panel data, bounded bake resources, cleanup on success/failure, mode restoration,
selection/hover priority, benchmark coverage and tour/operation transitions.

Physical ordinary Windows laptops and iOS/Android GPUs remain separate acceptance
work. A narrow browser viewport and the Performance preset do not emulate that
hardware. Smoked glazing remains an opaque approximation, and material treatment
does not repair source mesh faceting.

### Release checks — 2026-11-01

- `npm run verify`: package validation, 286 tests and the production build passed.
- The built `/annora-explorer/` path was checked with both packages. Inspection,
  isolation/context, visible and occluded selections, interior/exterior views,
  operating playback, tour chapters and return to Engineering were exercised.
- Real browser iframe sizes: 320 × 740, 390 × 844 and 844 × 390. Controls and
  model framing remain usable; no horizontal document overflow was found.
- Current Mac / in-app browser, Apollo Engineering, 1482 × 896 CSS pixels,
  local cached load, 12-second v3 orbit/separation/restoration including four
  highlighted parts:

| Profile | Render buffer | Median fps | p95 interval | Frames >50 ms | Draw calls/frame |
| --- | --- | --- | --- | --- | --- |
| Balanced | 1818 × 1099 | 59.88 | 17.5 ms | 0 | 2415 |
| Performance | 1408 × 851 | 59.88 | 17.5 ms | 0 | 1611 |

These are browser-frame measurements, not GPU execution times. The Performance
profile reduces pass cost; its result on this Mac is not evidence of performance
on an ordinary laptop. No claim is made about cold-network load time or physical
phone GPU behavior.
