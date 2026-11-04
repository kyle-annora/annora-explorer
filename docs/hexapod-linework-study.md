# Hexapod linework: isolated review preview

## Review links

- [Interactive preview](https://kyle-annora.github.io/annora-linework-study/)
- [Single leg](https://kyle-annora.github.io/annora-linework-study/?view=leg&variant=combined)
- [Electronics](https://kyle-annora.github.io/annora-linework-study/?view=electronics&variant=combined)
- [Source branch](https://github.com/kyle-annora/annora-explorer/tree/preview/hexapod-linework-study)
- [Static deployment repository](https://github.com/kyle-annora/annora-linework-study)

Start with Original, then compare Clarity, Detail density and Combined. Changing
treatment preserves the camera and source pose. Drag to orbit, scroll or pinch
to zoom, use Slow rotation to inspect motion, and Reset camera to return to the
reference frame. The three subject presets deliberately change framing.
Nothing rotates automatically on entry. Light and Dark are both available.

This preview is deployed separately from the production Explorer. It does not
write browser project data or modify the Product Room, Studio, quotations,
drawing versions, shared rendering code, or the source Hexapod package.

## What changes in each treatment

| Choice | Clarity | Density |
| --- | --- | --- |
| Original | Exact production Linework sampling and strokes | Exact production detail |
| Clarity | Bounded supersampling and supported multisample targets | Original detail |
| Detail density | Original sampling and line widths | Smooth screen-size weighting of connected features |
| Combined | Same sampling as Clarity | Same weighting as Detail density |

There is one canvas, camera, animation clock and model. Source depth geometry
still occludes hidden lines. Structural outlines, complete hole curves and
connected feature networks are evaluated together; short triangle-edge
segments are not individually deleted. Electronics and motors use a more
restrained density policy than structural members. Small details recover as
their projected footprint grows. This is a Hexapod-specific visual experiment,
not semantic CAD recognition or a manufacturing drawing.

The density treatment adds 7,184,574 bytes of prepared attributes, not another
render pass. The tested cases use four draw calls. Preparation happens once and
yields while grouping larger data. Idle rendering stops after the view settles.
Linework does not enable surface lighting, ambient occlusion, hidden-line
X-ray rendering, or a blur filter as a substitute for readable strokes.

Default Balanced clarity sampling is bounded to four million pixels on desktop
and two million on compact stages; the bounded sample allocation is eight and
four million respectively. Unsupported multisampling falls back to the bounded
higher-resolution target. The diagnostic Performance profile uses 1.6 million
pixels. An explicitly selected existing Quality profile can retain its larger
original allocation so Clarity never silently becomes lower resolution than
Original. No quality downgrade occurs midway through a comparison.

## Evidence and limits

The source geometry fingerprint remains
`1f2eefe0a0bdffcd09b70f4850a955a225f7974801dfc15122e3a52b818081e0`.

- Baseline was compared with an unmodified production `AssemblyScene` at
  1280 × 800, DPR 1. Decoded pixel hashes matched exactly for all three subjects:
  92 assembly meshes, 14 leg meshes and all three PCB source surfaces.
- Twelve desktop captures cover four treatments × three subjects. Camera and
  active mesh identity stay unchanged across each set. The stage uses one canvas.
- Small-angle rotation samples cover −2° to +2° in 0.5° steps for the leg and
  PCB in Density and Combined. All four sequences returned pixel-identically
  to their starting angle. The largest adjacent change in total ink was 0.75%.
  This is a bounded repeatability check, not proof of zero flicker at every orbit.
- At the tested framing, Density retains approximately 91.8% of original
  assembly ink, 98.6% of leg ink and 95.5% of PCB ink. Ink coverage measures
  visual clutter, not accuracy or the proportion of engineering information.
  Leg apertures, mounting holes, PCB boundary and pins were also visually checked.
- Mobile checks cover 320 × 740, 390 × 844 and 844 × 390, DPR 2, with all three
  subjects in Light and Dark. Controls have at least 44-pixel touch height, no
  horizontal overflow, and reachable hit areas. Orbit, pause, reset and the
  performance drawer were exercised in Chrome touch emulation.
- The five new topology/policy tests cover complete closed rims at two
  tessellations, reversible material selection, unchanged occlusion geometry,
  independent treatments, sampling bounds and unsupported multisampling.
  The full project verification reports 607 tests: 606 pass, one existing skip,
  zero failures; production and focused preview builds both pass.

The PCB contains diagonal and branching source lines that also appear in the
production control. They remain visible here. Cleaning the source illustration
is a separate decision from sampling and density; this experiment does not
silently edit that geometry.

The UI's Performance check runs a 12-second camera sweep, restores its starting
camera, and exports frame intervals, viewport, buffers and sample counts. These
are browser frame intervals, not GPU-only timings. See the adjacent performance
record for the measured machine and results. A CPU slowdown cannot emulate a
midrange GPU; physical ordinary-PC and mobile-GPU qualification remains open.

## Reproduce

From this source branch, with the repository's supported Node version:

```sh
npm ci
npm run verify
npx vite build --config vite.study.config.js
python3 -m http.server 8191 --bind 127.0.0.1 --directory work/linework-study-dist
```

The focused output contains only this entry, the Hexapod assets and runtime,
licenses and a `.nojekyll` marker. The normal production build remains separate.
For local editing, use `npx vite --config vite.study.config.js` on port 8190.

Optional automated browser review requires a separate Playwright installation
and Google Chrome. Set `PLAYWRIGHT_MODULE` to its entry module if it is not
available as `playwright` in the project:

```sh
node scripts/qa-linework-study-browser.mjs http://127.0.0.1:8191/
node scripts/qa-linework-study-browser.mjs http://127.0.0.1:8191/ --performance
```

For the exact production-renderer control, run the repository-root Vite server
in another terminal (`npx vite --host 127.0.0.1 --port 8208`). Then run:

```sh
node scripts/qa-linework-study-renderer.mjs http://127.0.0.1:8208/
```

The renderer probe deliberately loads source modules rather than a production
bundle. It records decoded pixel hashes, mesh identities, buffers and motion
samples. Both scripts write local evidence under `work/`; generated captures
are not mixed into production assets.

## Review decision

Decide separately whether Clarity is worth its sampling cost and whether the
Density policy removes distracting lines without suppressing useful details.
The current recommendation is to review Combined first, then compare Original
at the same frame and zoom into the PCB. No treatment is promoted into the
formal Explorer by this release. A future rollout needs broader model coverage
and physical lower-end GPU measurements.
