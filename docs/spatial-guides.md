# Spatial guides

A spatial guide opens a model as a sequence of viewpoints. Each chapter names its parts, camera direction, caption and action. The overview places the chapter stations in the same 3D space as the assembly. Opening a chapter moves the camera and mechanism from the current frame. A return or another click can interrupt that movement.

- [Hexapod](https://kyle-annora.github.io/annora-explorer/?model=hexapod&presentation=1) follows the leg and then separates the electronics stack.
- [Open Duck](https://kyle-annora.github.io/annora-explorer/?model=open-duck&presentation=1&guide=spatial) opens the head shell and then follows an authored leg pose.

## Add a guide to a configured model

Place an optional `spatial-guide.json` alongside the prepared model's manifest. The build loads guides only from configured packages. Copy a complete example and change the references to your own model. [Hexapod package](../content/models/hexapod/spatial-guide.json) · [Open Duck package](../content/models/open-duck/spatial-guide.json)

1. Set `modelId`, `modelRevision` and `tourId` to the configured package and authored tour. `npm run check` prints the model revision prefix. The model's generated catalog contains the complete SHA-256 revision.
2. Define the ordered `chapters`, starting with `overview`. Each detail chapter has a stable URL-safe ID, a display label, an optional station hint, a caption, its visible part groups, a camera direction and a duration in seconds. Phase cues use fractions of the action, starting at zero. The order controls the Next button.
3. Choose the mechanism for each detail. A `motion` action names a GLB clip and its animated quaternion joints. An optional `window` selects a normalized interval of the clip. An optional `trace` follows a point on the named mesh. A `separate` action lists meshes, displacement vectors in model coordinates and normalized timing windows. Use `fit: "action"` to include every lifted position in the detail framing. These moves illustrate assembly relationships.
4. Define an elliptical orbit with `center`, `axisU` and `axisV` in model coordinates. Place one station per chapter using an angle in degrees. A detail station can anchor its leader and accent outline to a visible mesh. A `fraction` in the range 0–1 on each axis locates the leader within the part's prepared bounds. Omit it to use the center.
5. Choose `entry: "default"` to open the guide from the standard presentation entry, or `"opt-in"` to leave that entry on the authored timeline. Run `npm run verify`, then review on a wide and a narrow viewport. Invalid part references, clip channels or model revisions fail the build.

## Floating labels

Use a chapter’s optional `callouts` array to attach a short explanation to a real part. The first cue starts at zero. Later cues use the normalized progress of the chapter action. The example below changes the note when the head shell lifts.

```json
"callouts": [
  {
    "at": 0,
    "title": "Head shell",
    "text": "The outer shell lifts to reveal the head assembly.",
    "anchor": { "meshName": "Duck_head_assembly_02_head" }
  },
  {
    "at": 0.45,
    "title": "Controller board",
    "text": "The board lifts clear of its seat beneath the shell.",
    "anchor": { "meshName": "Duck_head_assembly_04_raspberrypizerow", "fraction": [0.7, 0.8, 0.2] }
  }
]
```

An overview can have one opening note. Hovering, focusing or holding a detail station previews that chapter’s label, hint and anchor. Each anchor can specify a fractional location in the named part’s prepared bounds. Pick a mesh that faces the entry camera and check it again after the mechanism moves.

The label stays on a fixed margin or at the top of a phone screen. Its curved leader ends on the visible part surface. During a chapter flight or when another part covers the anchor, the text stays readable and the leader disappears. A bounded cubic Bézier curve leaves the caption horizontally on desktop and downward on a phone. Its control points adapt to the distance and available space around the printed text. The tangent treatment builds on the [D3 link curves](https://d3js.org/d3-shape/link).

## Open from another product

Use a full Explorer URL with `model=<id>&presentation=1&guide=spatial`. Add a chapter hash to start directly in that chapter. For example, a sales page can link straight to the controller inside the head. [Open Duck head assembly](https://kyle-annora.github.io/annora-explorer/?model=open-duck&presentation=1&guide=spatial#head)

A direct chapter link starts with its camera in place. During navigation, Next, the chapter menu and browser history share one state. Dragging claims the camera immediately. The scrubber owns the mechanism position. Reduced motion selects the final pose immediately and waits for the visitor to start playback. The authored timeline remains available with `guide=timeline`. Embedded hosts continue to use the existing JSON controller and timeline. [Host integration](integration.md)

## Review a new package

- Start with the whole model. Hover or hold a station and verify its caption and target part. Rotate until the station passes behind the product and check that the concealed point cannot be selected.
- Pause the mechanism partway through an action and change chapter. Follow the same part through the first frame. Rapidly choose another chapter and use Back. Each move should start at the visible pose.
- On a phone, tap a station, drag on the canvas, scrub an action and turn the screen during a transition. Confirm the correct final pose, visible controls and working return to free inspection.
