# Hexapod linework study: comparison design

This is the review brief for an isolated experiment, not a change to the
Explorer's display defaults. Read the implementation and measured release
results separately from these acceptance criteria.

## What the comparison answers

When a complete six-legged assembly fits on a screen, electronics and motor
details can merge into dark patches while long diagonal edges look coarse. We
need to distinguish a sampling problem from a problem of what to draw. The
study holds source geometry, visibility and the camera constant within each
view, and varies only these two treatments:

| Treatment | Sampling | Detail policy | Question |
| --- | --- | --- | --- |
| Original | Existing Linework baseline | Existing visible contours and features | What does the approved renderer show? |
| Clarity only | Increased, bounded sampling | Same as original | Do diagonal edges and occlusion cuts improve without changing the information? |
| Density only | Same as original | Edited internal detail | Can the assembly be read at its original pixel budget? |
| Combined | Same as clarity only | Same as density only | Are the benefits complementary? |

The controls belong on one stage. A switch of treatment must preserve the
current orbit, zoom, part transforms, scope, backdrop and selection state. A
view change can deliberately frame a different subject. Baseline is a control,
not a fourth proposed production treatment.

## Reference roles

- [Atlas Motion](https://atlasmotion.com/) is the visual target for a readable
  exploded illustration: a strong outer shape, quieter internal structure and
  restrained accent on the subject being explained. Preserve hierarchy; do
  not introduce surface shading to hide a line-density problem.
- [Rhino Technical display](https://docs.mcneel.com/rhino/8/help/en-us/options/view_displaymodes_technical.htm)
  is a reference for distinguishing silhouettes, edges, creases and hidden
  lines. Annora draws from a prepared triangle mesh; this experiment does not
  infer analytic CAD features, exact manufacturing geometry or tolerances.
- The existing Explorer supplies interaction and color conventions: compact
  controls, a model-first stage, Ember for emphasis, and depth-aware lines.
  Colors, grid, backgrounds and camera angle must not become hidden variables
  between treatments.

## Three subjects in one immutable source

The source [manifest](../content/models/hexapod/manifest.json) and
[hierarchy](../content/models/hexapod/metadata.json) identify the original
objects. No comparison requires a new model revision.

| Subject | Source identity | What reviewers should read |
| --- | --- | --- |
| Whole assembly | Root `hexapod`; six leg groups and the body | Body stack, separation between mechanisms and the six attachments before minor hardware |
| Single leg | `hex-leg-1`, the front-right leg: 14 meshes across coxa, femur and tibia joints | Joint locations, brackets, member outlines and functional hole loops; smooth curves must not turn into dotted arcs |
| Electronics detail | The three source surfaces `Hex_electronics_1`, `Hex_electronics_1_surface2`, `Hex_electronics_1_surface3` | Board outline and connectors regain readable internal detail when viewed locally. The parent `hex-body-electronics` also includes a separate battery; do not mistake its full-group bounds for the PCB bounds |

The three mesh surfaces of the electronics visual are not three
additional mechanical components. A local illustration can use the source
surfaces together to frame the PCB. No commercial record or source geometry
should be rewritten to create a study view.

## Why segment length alone is unsafe

This audit reads the committed [crease records](../content/models/hexapod/edge-metadata.json)
and [contour records](../content/models/hexapod/silhouette-metadata.json).
Counts below are candidates in prepared data, not simultaneous visible strokes.
Across all mesh instances: 138,448 crease segments and 284,174 contour
candidates. The source package has 92 mesh instances backed by 14 unique
geometries. The crease threshold used in preparation was 32 degrees.

The sampled crease graph below joins equal mesh-local endpoints rounded to
four decimal places. A closed loop is a connected group in which every vertex
has two incident edges. This is a topology observation, not a claim about the
source author's intent.

| Mesh | Crease segments | Connected groups | Closed loops | Exact undirected duplicates after rounding |
| --- | ---: | ---: | ---: | ---: |
| Electronics primary surface | 30,715 | 618 | 42 | 0 |
| Electronics second surface | 2,501 | 233 | 71 | 0 |
| Electronics third surface | 5 | 1 | 0 | 0 |
| Front-right coxa motor, primary surface | 3,460 | 89 | 11 | 0 |
| Front-right tibia member | 683 | 27 | 26 | 0 |
| Base | 2,105 | 82 | 81 | 0 |

The median tibia segment is only 0.44% of its part's bounding-box diagonal,
yet a closed curve made of those segments spans nearly 49% of that diagonal.
Dropping short segments would destroy visibly large curves. On the primary
electronics surface only 123 degree-two joins are straight within 0.1 degrees:
merging collinear strokes alone cannot remove its overall density. Joining
triangles by welded vertices is also insufficient for semantic labeling: one
connected island spans that entire source surface. These measurements do not
identify a pin, mounting hole or connector with engineering certainty.

Keep depth geometry and high-priority structural contours intact. If fine
features are attenuated, base importance on complete curves, stable source
groups or role and projected scale; avoid independently popping individual
segments as the model rotates. Restoration at closer inspection is part of the
review, not an assumption about all future products.

## Review and decision criteria

1. **Compare matched frames.** Capture all four treatments for each of the
   three views, with the same camera, explosion amount, viewport and lighting.
   Record actual drawing-buffer dimensions: a preset name is not a pixel count.
2. **Inspect the failure regions.** At assembly scale, compare the PCB's dark
   cluster, a long leg diagonal and the central body spacing. In the leg view,
   verify bracket outlines, joint bores and tibia curves survive the density
   treatment. At PCB scale, check that purposeful detail returns and the source
   boundary remains continuous.
3. **Orbit consistently.** Repeat the same rotation path per treatment;
   pause and return to the same angle. Check for abrupt opacity jumps, broken
   loops, sparkle, through-surface lines, and drift in framing. Matching start
   and end frames alone does not establish stability between them.
4. **Check compact layouts.** At narrow portrait and short landscape sizes,
   choices must remain reachable by touch and keyboard, orbit must remain
   usable and the subject must not be obscured by controls. Respect reduced
   motion; do not start an automatic orbit on entry.
5. **Measure with context.** Report browser, viewport, device scale, sampling
   budget, warm-up and measured intervals for a repeatable motion. Compare with
   Original on the same machine. CPU throttling and pixel-budget stress tests
   are useful proxies; neither qualifies a physical midrange or mobile GPU.

Recommend a treatment only for the scopes where the visual and motion checks
support it. A public review preview is not approval to replace the production
renderer or to generalize this model-specific detail policy to every assembly.
