# Hexapod: explaining one leg reach

This chapter helps a customer see how the upper and lower joints combine to move
one foot. It builds on the existing Hexapod Demo, preserves the 2.5-second source
clip, and presents it within a 2.8-second chapter. It connects the selected assembly
to Explore. It does not introduce a gait
simulation or change the robot model.

## Scope and evidence

The source is `content/models/hexapod/model.glb`, clip `HexapodLegReach`.
The GLB inspected for this decision has SHA-256:

```
1f2eefe0a0bdffcd09b70f4850a955a225f7974801dfc15122e3a52b818081e0
```

The source package retains hardware and joint frames. Its motion is an authored
pose study, not firmware output, a walking gait, balance simulation or a claim
about rated performance. Keep that distinction in source documentation and the
short visible label **Illustrative motion**. Do not present derived coordinates
as manufacturer dimensions.

The clip audit establishes:

- The selected leg has three joint tracks, but its body/`coxa` track is constant
  throughout this clip. It must not be described as a third moving joint.
- `HexJoint_leg_1_femur` and `HexJoint_leg_1_tibia` change orientation. Relative to
  their starting quaternions, maximum changes are approximately 17 and 10 degrees,
  respectively. These are properties of this illustrative clip.
- Both moving joints reach their maximum change at progress 0.5. Motion returns
  from that point; the original return caption at 0.69 appeared late.
- The upper joint leads the initial lift. The lower joint already moves slightly
  during that interval and contributes more in the second quarter. The story
  emphasizes each contribution; it must not claim they move exclusively in turn.
- The same material point at the bottom of the foot is sampled throughout. Its
  start and end coordinates match. The drawn path represents that point's
  presented movement, not the robot's reachable workspace or a measured gait.

## Reference lock

The existing Annora Demo remains the primary visual system: generous 3D framing,
quiet paper background, restrained technical typography, one accent and compact
controls. Research informs the explanation and composition rather than replacing
that system.

| Reference and verification | Borrow | Deliberately omit |
| --- | --- | --- |
| [Mechanical Watch](https://ciechanow.ski/mechanical-watch/), interactive article reviewed in the earlier motion study | Show the relationship between input, joint movement and visible result; let the user inspect time manually | A new mechanical solver or physics claims inferred from authored animation |
| [Smithsonian Voyager](https://smithsonian.github.io/dpo-voyager/story/usage/tours-task/), official documentation verified | Coordinate a guided story with scene state, camera and annotations; preserve free inspection | Importing the full authoring tool or exposing its complete analysis toolbar |
| [Amplification Machine headphones](https://theamplificationmachine.com/3d), live chapter selection inspected | One purposeful chapter shot; selected component brought forward with enough assembly context to explain its place; concise anchored label | Twelve-part scroll length, decorative halo, unrelated marketing chrome |
| [Teardown diesel engine](https://www.teardown.co.in/mechanical/diesel-engine), live Take apart and Run inspected | An action explains cause and consequence. A selected mechanism has a clear current state and visible result | Dense 29-step list, operating telemetry, fault modes, technical claims not supported by our model |
| [Whirlpool/Emersya viewer](https://emersya.com/showcase/OK90BSN2XW), live numbered hotspot inspected | Coordinate framing, active cue and a short functional explanation | A collection of simultaneous tooltips; its mechanism operation was not verified in this review |

## Chapter decisions

| Decision | Reason and source |
| --- | --- |
| Lead with **Two joints. One reach.** | The imported clip has two moving joints. The title gives the viewer one question to resolve. |
| Name the visible pivots **Upper joint** and **Lower joint** | Customer language is clearer than source anatomy names. Source IDs remain unchanged for linkage. |
| Highlight the contribution currently being explained | Amplification's selected-part framing and Teardown's causal presentation give the viewer a focal point. |
| Track one actual point on the foot | Connect cause at the pivots with the resulting motion. A free-floating decorative curve would not explain the mechanism. |
| Add a synchronized side diagram | A fixed projection makes the relationship readable while the customer rotates the 3D view. It uses the same sampled coordinates. |
| Keep the diagram folded on small screens | The model, explanation and transport already compete for space. The user opens a readable figure when useful. |
| Keep reference drawings available as a secondary action | The motion schematic and the at-rest Plan/Elevation/Section views answer different questions. Original reference access remains available. |
| Let a contextual action open the selected detail in Explore | Demo explains the movement; Explore restores the assembled pose and focuses the same assembly. The Demo checkpoint remains available on return. |

## Choreography

The chapter lasts **2.8 seconds**. Its `playbackWindow: [0.14, 0.86]` provides
about 0.39 seconds at the starting pose, 2.016 seconds of motion, and about
0.39 seconds at the completed pose. The original 2.5-second GLB clip is sampled
within that window; the asset and free-Explore animation remain unchanged.
Pause, replay and scrub remain available. Camera travel settles before mechanism
movement needs close attention.

1. **Ready — chapter progress 0.** Identify the upper joint while the leg rests.
2. **Lift and reach — from 0.14.** The mechanism begins moving. Emphasize the
   upper joint first, then the lower joint from 0.32. These are explanatory
   highlights, not claims that only one joint moves at a time.
3. **Return together — from 0.5.** Both moving joints return. This is also the
   midpoint of the sampled source clip, where the actual return begins.
4. **Back at rest — from 0.86.** Hold the completed pose before replay or leaving.

The body connection/`coxa` stays fixed throughout. A contextual **Inspect this
assembly** action opens that assembly in Explore after restoring its assembled
pose. Returning to Demo restores the saved chapter and action progress.
The cue thresholds belong to the model package. Playback, scrub and resume must
sample the same state. Reversing the slider reverses the explanation as well as
the geometry; no separate animation clock is introduced.

## Motion diagram contract

`createMotionDiagram` accepts the existing stage element and optional callbacks:

```js
createMotionDiagram({ main, mount, getAccent, onTakeover, onReference })
```

It returns `setChapter(chapter)`, `setFrame(frame)`, `setHidden(boolean)` and
`dispose()`. The diagram adds a DOM/SVG layer only; it owns no WebGL context,
animation loop or model transforms.

The chapter's `explanation` supplies a title, two named joint references and the
projection axes. The Hexapod side projection uses a horizontal direction parallel
to `[1, 0, -1]` and vertical `[0, 1, 0]`. The diagram normalizes these axes.

The current diagram intentionally supports **two joints and one foot point**;
it is not a general-purpose chain or mechanism solver. The authored fields are:

```js
{
  inspectNodeId: 'hex-leg-1',
  action: { /* preserved clip metadata */ playbackWindow: [0.14, 0.86] },
  explanation: {
    joints: [
      { node: 'HexJoint_leg_1_femur', label: 'Upper joint',
        highlightMesh: 'Hex_leg_1_femur_motor_1' },
      { node: 'HexJoint_leg_1_tibia', label: 'Lower joint',
        highlightMesh: 'Hex_leg_1_tibia_motor_1' }
    ],
    cues: [[0, 0], [0.32, 1], [0.5, -1]],
    diagram: { horizontal: [0.70710678, 0, -0.70710678], vertical: [0, 1, 0] }
  }
}
```

`inspectNodeId` selects the assembly on the Explore handoff. Each `highlightMesh`
names the visible cue for a joint; `cues` pairs chapter progress with a joint index
or `-1` for no isolated highlight. The runtime samples `playbackWindow` once for
both geometry and diagram. New model packages must supply real source nodes and
projection axes rather than copying Hexapod coordinates.

The stage supplies:

- `points`: current upper pivot, lower pivot and foot point, in one shared model space;
- `restPoints`: the same three points in the actual starting pose;
- `trace`: the full sampled foot path in the same space;
- `progress`: the sampled clip fraction;
- `activeIndex`: upper `0`, lower `1`, or neither `-1`.

Explicit `restPoints` are required. Reopening a paused chapter must never label a
mid-action pose as the resting pose. The projection fits once per chapter from
the rest pose and full path, with clearance for the moving links. It stays stable
while the mechanism and 3D camera move.

The figure uses a dashed rest chain, a solid current chain, numbered joint labels
and an accent foot path/current point. It has no scale ticks, invented dimensions,
or clickable-looking diagram handles. On compact screens it starts as **View
motion diagram**. Opening pauses playback through `onTakeover`; Escape closes the
figure before leaving the chapter. **Reference drawings** opens the retained
at-rest views through the host callback.

## Acceptance matrix

These are release gates, not claims that a test has passed. Record actual results
and the published commit in the release review.

| Area | Required observation |
| --- | --- |
| Motion truth | Only the two moving joints are explained as active. The body connection remains stationary. The return cue starts with the actual return motion. |
| Causal readability | A first-time viewer can identify the upper joint, lower joint and foot point, and explain what changed after one action. |
| Geometry fidelity | Current 3D pivot and foot positions match diagram input. Dashed rest pose remains unchanged at 0%, 25%, 50%, 75% and 100%. |
| Stable projection | Rotating or zooming 3D does not make the side diagram rotate or reframe. No link, marker or label is clipped at sampled extrema. |
| Playback | Pause, resume, replay and backward scrub keep geometry, highlights, text and diagram synchronized. No independent timer accumulates drift. |
| Chapter resume | Leave at a partial pose, visit Whole model, return: pose, foot path and diagram rest state remain correct. |
| Explore handoff | The contextual action opens the intended model/component. Browser Back and Demo return retain an understandable chapter and progress state. |
| Reference access | Plan/Elevation/Section remain reachable, with a clear route back to the motion diagram. Reference views are still identified as at rest. |
| Small screens | At 390 px and 360 px widths, diagram is initially collapsed; touch target is at least 44 px; expanded figure is readable; transport and dismissal remain reachable. |
| Keyboard | Toggle, reference action, transport and contextual Explore action are reachable with visible focus. Escape dismisses an open compact diagram first. |
| Reduced motion | No unavoidable autoplay or camera sweep. Explicit pose selection and scrub remain usable; explanatory text does not rely only on motion. |
| Visual continuity | Existing paper, fonts, accent roles and control language remain. The new figure does not introduce a dashboard or a second competing navigation system. |
| Performance | One WebGL stage and existing clock remain. Paused idle does not acquire a new render loop. Measure only on actual tested devices; report throttling separately. |
| Regression | Whole model, Electronics, Open Duck, Apollo, Product Room, Studio and versioned inquiry/quotation paths keep their existing behavior. |

## Delivery record

Implementation is limited to the first Hexapod explanatory chapter and reusable
supporting presentation capabilities. Runtime/browser acceptance and publication
are recorded in the release review after the integrated candidate is exercised.
The source-model audit above is complete; it is not a substitute for visual and
workflow verification.
