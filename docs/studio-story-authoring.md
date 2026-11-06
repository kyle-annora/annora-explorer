# Studio product story authoring

This bounded authoring surface extends **Presentation** in the existing crank
product editor. It does not introduce a second renderer, animation clock, CAD
editor or backend. The existing Explorer still owns its camera, materials,
prepared motion, reduced-motion behavior and manual takeover.

## Author and review

1. Open Studio → Products → crank product → Presentation.
2. Under Product story, add a step and edit its title and short explanation.
3. Choose either a prepared 2–3 second action or a captured view. Prepared actions
   retain their authored camera, highlights and timing. Their discussion subject
   must be one of the action's highlighted parts or its selected assembly.
4. For a captured view, choose the part, open Adjust view in 3D, and arrange it in
   free exploration. On desktop, capture the settled view from the editor. On a
   narrow screen, use Capture view and return in the visible model footer. Active
   tours must be exited first. Changing the part invalidates that capture.
5. Preview individual steps in the same model. Move steps earlier/later or remove
   them. A story supports at most eight steps and can be removed entirely.
6. Save the draft. Open Preview, select 3D Explorer in Preview options, and start
   the story in the actual buyer Room. Check its full order and explanations.
7. Review the release changes, then explicitly confirm a local demo release.
   Prior releases and customer project snapshots remain unchanged.

On a narrow screen, Open model / Edit story switches between the existing model
and editor. Capture in 3D opens that same model and presents Capture view and return.
Capture happens while the canvas is visible so its camera viewport stays valid.
It does not create another viewer. A hidden or backgrounded model remains subject
to the existing pause behavior.

## Buyer experience

The Room offers Start story only when its exact release includes a story. A
compact host strip contains the current explanation and step navigation. Its
height is included in the available canvas height, so it does not cover the
model or form. While this strip owns playback, the native Explorer tour caption,
transport and annotations are hidden and their reserved canvas space is released.
The editor's individual-step preview continues to use the native controls.
Each prepared action exposes pause/resume, replay and progress;
held views remain static. Explore freely exits story playback. Starting again
returns to step one. Ask about this step opens the existing contextual inquiry.
On short landscape screens, the open story occupies a scrollable side rail so the
model and controls stay visible together. The header and release notice remain
available. Closing the story restores the regular Room layout.
Native chapter changes, exiting the tour or choosing another held-view subject
return control to free exploration without overwriting the user's new state.
Orbiting or pausing the current chapter keeps its story explanation available.

No story is silently added to a legacy product release. Editing a product story
does not rewrite an existing inquiry's `roomSnapshot` or issued quotation.

## Contract

`presentation.story` is optional:

```js
{
  version: 1,
  title: "How this product works",
  steps: [{
    id: "stable-step-id",
    title: "Follow one cycle",
    caption: "The guide keeps the slider straight.",
    nodeId: "crank",
    kind: "chapter",
    tourId: "kinetic-01",
    chapterId: "motion"
  }]
}
```

An `inspection` step uses `kind: "inspection"` and an `inspection` value instead
of `tourId`/`chapterId`. This release accepts only the free-view inspection form:
an exact model revision, selected part, scope, display state and captured camera.
No bitmap is stored in a story. Existing controller validation still checks
runtime capabilities and exact compatibility before applying it.

Drafts may be saved with incomplete text or captures, but their editable structure
is checked before storage. Preview and release validation reject missing or
duplicate step identities, unknown parts, unavailable actions, actions outside
the short duration range, action/subject mismatch and invalid captured views.
Any changed step/order/camera changes the release review token. The review lists
the actual title, explanation, part/action and camera change before confirmation.
Archived releases keep their original part and action identities and validate
captured cameras against their archived model revision. They are not rebound to
the current catalog, and cannot be republished without current-model review.

The shared `createStoryController` invokes `restoreInspection`, `startTour`,
`goToTourChapter`, `resumeTour`, `pauseTour`, `seekTour` and `exitTour` through the
existing host viewer. The buyer strip opts into `startTour({ controls: "host" })`
and restores native chrome with `setTourControls` on takeover or disposal. Native
chrome remains the default everywhere else. It has no requestAnimationFrame loop. Superseded or disposed
preparation cannot start a late step. Renderer/controller failure remains visible
and cannot advance the displayed story index.

## Boundaries

- The authoring editor currently targets the prepared crank product, matching the
  existing Studio product editor. The adapter contract is independent of geometry.
- Prepared actions cannot be re-rigged or given a different physical path here.
- Camera capture covers settled free views and paused manual operation; arbitrary
  spatial/orbital presentation poses are not supported.
- Paired engineering-view authoring, related documents within a story, customer
  personalization and cross-device sharing remain later work. Do not fabricate a
  technical drawing for the crank to fill this gap.
- A local demo release is not a hosted release. Export and use the existing GitHub
  build/deployment workflow for a cross-device hosted product.

## Evidence

`tests/runtime/product-story.test.js` verifies source/action validation, exact
camera identity, preview and release preservation, stale-review rejection,
semantic release changes, command order, pause/replay/seek/exit, unsupported model
revisions, malformed draft rejection, historical storage and native takeover,
plus late-preparation cancellation. Browser validation and any hosted
release receipt are recorded by the parent product-expansion delivery review.
