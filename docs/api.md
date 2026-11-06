# Explorer API contract

Status: **Implemented controller and iframe interface, protocol `annora.explorer/0.1-draft`.** The pre-1.0 protocol is versioned explicitly. A same-document SDK and MCP server are not included. See the [integration guide](integration.md) and [release evidence](release-review.md).

## Purpose and current boundary

Let websites, presentations and tools use selected capabilities through one controller. The current floating interface remains the reference consumer with unchanged behavior.

The floating shell still owns document-global DOM IDs and URL policy inside one iframe. Its consequential actions and host commands now pass through the same controller. The iframe bridge is available in this template; it is not a released npm SDK.

| Existing implementation | Existing responsibility | Proposed boundary |
| --- | --- | --- |
| [navigation-state.js](../src/explorer/navigation-state.js) and [model-state.js](../src/explorer/model-state.js) | Selection, scope, disclosure and curated hierarchy | Controller-owned navigation; UI disclosure remains instance-local |
| [scene.js](../src/explorer/scene.js) | Rendering, camera, source poses, separation, picking and substantial GPU disposal | Private runtime, exposed through validated commands |
| [tour-player.js](../src/explorer/tour-player.js) and [tour-ui.js](../src/explorer/tour-ui.js) | Deterministic clock, controls, snapshot and takeover | Shared transport coordinated by the controller; scoped UI lifecycle |
| [app.js](../src/explorer/app.js) | DOM, URL, theme storage, UI/scene synchronization | Default shell and host-specific URL/storage policy |

Internal `capturePresentation()` contains Maps, vectors and per-mesh poses; keep it private.

## Ownership and initialization

Each instance owns one model, presentation state, renderer loop and subscriptions. Resolve content versions before readiness. Defaults remain **Engineering**, **Ember**, **Balanced**, assembled root, no autoplay and the current shell.

Start with an iframe adapter. Later JavaScript mounting and MCP tools must use the same controller. MCP addresses a specific live instance or offline authoring command; it does not render a model. No backend or telemetry upload is introduced.

Lifecycle: `created → loading → ready`, or `loading → error`; any non-disposed state may enter `disposing → disposed`. Optional linework preparation is a busy activity within `ready`, not a second model load. The instance keeps the last usable treatment while preparing a new one.

- Configuration resolves an approved [model package](models.md), theme, shell and enabled capabilities; no executable model code.
- `getState()`, `getCapabilities()` and subscription are available before model readiness. Content queries and presentation mutations return `NOT_READY` until their required data is available; they are not silently queued.
- The enabled capabilities are the intersection of package support, runtime support and host configuration. The host can disable a supported feature, but cannot enable a feature missing from the asset.
- The shell retains loading/failure feedback, attribution and visitor playback/takeover controls.
- Change models through dispose-and-create. Hot replacement and concurrent large models are deferred.

## Read contracts

Public values are JSON-compatible. Model `id` means manifest `packageId`; current query aliases are adapter mappings. Node IDs are revision-specific, not guaranteed stable across CAD exports.

| Query | Result |
| --- | --- |
| `getCapabilities()` | Protocol/runtime versions; resolved model ID and revision when known; supported and enabled render styles, view modes, operation clips and tours; supported quality presets; readiness-dependent availability |
| `getState()` | Current lifecycle and presentation state, described below; never a live Three.js object |
| `getNode({ nodeId })` | ID, title, kind, parent ID, child IDs and source-backed description/attribution where available |
| `getChildren({ nodeId })` | Immediate child descriptors in authored navigation order; no vertex arrays or geometry payload |
| `getTour({ tourId })` | Tour ID, duration, `playback` (`continuous` or `steps`) and ordered chapter descriptors with ID, label, start, duration, chapter-relative `previewAt` and optional `settledAt`; no executable script |

Distinguish unsupported from unavailable: Apollo has `operation.supported: false`; Kinetic may be supported but unavailable during loading.

The state shape is:

| Field | Meaning |
| --- | --- |
| `protocolVersion`, `instanceId`, `stateRevision` | Contract version, instance identity and monotonically increasing presentation revision |
| `lifecycle` | `created`, `loading`, `ready`, `error`, `disposing` or `disposed` |
| `model` | `null` before resolution, otherwise `{ id, revision }` |
| `navigation` | `{ selectedId, scopeId, isolated }`; disclosure/expanded rows are shell state |
| `presentation` | `{ mode, renderStyle, explosion, explosionTarget, separation, transitioning }`; modes are `explore`, `explode`, `operate`; styles are `engineering`, `linework`, `flat` |
| `operation` | `{ available, clipId, status, progress, duration, sourceDuration, speed, followCamera }`; status is `unavailable`, `paused`, `playing` or `completed` |
| `tour` | `{ active, tourId, playback, status, time, duration, chapterId, reason }`; status is `idle`, `preparing`, `paused`, `playing` or `completed` |
| `appearance` | Resolved theme ID/revision; requested and effective quality profile |
| `environment` | `{ visible, reducedMotion }`, sufficient to explain paused/adapted behavior |
| `busy` | Array of pending request IDs and activities; preparation/transition is not GPU completion |

Before readiness, unavailable presentation fields are `null`. Queries copy authoritative state without side effects. Bound timeline event frequency; settled views retain demand rendering.

## Command catalog

These signatures share the result/event contract below.

| Command | Parameters | Required behavior |
| --- | --- | --- |
| `select` | `nodeId` | Highlight and update details; preserve scope, isolation and camera. The shell may reveal the selected path. |
| `focus` | `nodeId` | Enter an assembly, select it, show parent context and fit. A leaf inside current scope is only framed; an outside leaf enters its scope first, matching the current UI. |
| `frame` | `nodeId`, optional `view` (`current`, `front`, `rear`) | Fit a node visible in the active scope without changing selection, scope or isolation. A hidden or out-of-scope target returns `UNSUPPORTED_ACTION` with guidance to use explicit `focus`. Front/rear use package-authored directions; the default retains the current direction. |
| `isolate` | `nodeId` or `null` | With an ID, explicitly enter that node's scope if necessary and hide its surrounding context. With `null`, restore context in the current scope. Report all resulting state changes. |
| `setRenderStyle` | `style` | Use Engineering, Linework or Flat without resetting camera, selection, scope or source time. Prepare optional line data before committing a style. |
| `setDisplayOptions` | `options` | Merge validated display preferences without changing source geometry, camera, scope, selection or playback. See the display contract below. |
| `setMode` | `mode` | Mirror current Explore/Explode/Operate semantics. Operate enters the assembled root paused; explicit mode changes restore source poses as necessary. |
| `setExplosion` | `progress`, optional `transition` | Set a finite fraction in `[0,1]`. `transition` is `animate` by default or `immediate` for host scrubbing; immediate updates do not refit the camera. An animated update fits once. |
| `pauseExplosion` | none | Freeze separation and any alignment/camera movement at the current display pose. |
| `resumeExplosion` | none | Resume the retained separation action toward its original endpoint. |
| `replayExplosion` | none | Restart the retained separation or reassembly action, preserving its direction. Requires a prior nonzero action range. |
| `replayOperation` | none | Atomically rewind and play one authored operating cycle; align to the first source pose before advancing its clock. |
| `playOperation` | none | Resume one authored cycle from the current manual operation position; restart at zero when already completed. Enter Operate first if needed. Never synthesize an animation. |
| `pauseOperation` | none | Freeze source time; let an already requested pose/camera transition settle. |
| `seekOperation` | `progress` | Enter Operate if needed, sample the authored clip at a finite fraction in `[0,1]`, and remain paused. |
| `setOperationSpeed` | `speed` | Use only package/runtime-advertised speeds; preserve phase. Current UI speeds are `0.25`, `0.5`, `1`. |
| `setFollowCamera` | `enabled` | Enable or stop authored stage following. Manual orbit turns following off. |
| `startTour` | `tourId`, optional `controls` | Prepare required assets, capture the prior presentation, then start. Step tours enter their first chapter paused and ready; continuous tours retain autoplay after this explicit command. Under reduced motion, enter the stable chapter presentation paused. Controls default to `explorer`. An authored host player may request `host`, hiding native captions, annotations and transport and releasing their viewport reservation. The host must provide pause, replay, progress and an exit. |
| `pauseTour` | none | Pause the clock and presentation control; retain the current explanation and exact time. |
| `resumeTour` | none | Explicitly rejoin the authored presentation at retained time. At a held step endpoint, replay that step; use `goToTourChapter` followed by `resumeTour` to advance. Reduced motion remains visitor-paced; hidden instances remain paused. |
| `seekTour` | `seconds`, optional `chapterId` | Seek and remain paused. Supply the current `chapterId` when scrubbing a step, including its exact endpoint; this keeps the endpoint in that chapter instead of entering the next. Time must fall within the named chapter. Backward seeks sample deterministically. |
| `goToTourChapter` | `chapterId` | Require an active tour. Seek to chapter start plus `previewAt` and remain paused. Under reduced motion, sample its `settledAt` state as the current player does. The controller, not the host, resolves these authoring semantics. |
| `exitTour` | optional `restore` | Default `true`: restore the captured prior view with playback paused. `false`: retain the current scene for free exploration, matching the existing completion action. |
| `setTourControls` | `controls` (`host` or `explorer`) | Change the active tour's control surface without changing source time or pose. Recompute viewport reservations for the visible control surface. A host must restore `explorer` on disposal or native takeover. Exit, disposal and saved-inspection restoration restore native defaults. `state.tour.controls` reports the owner. |
| `setTheme` | registered `themeId`, or `"custom"` with `accent` | Change interaction accent without changing geometry, navigation or tour playback. A custom accent must be a six-digit hex color and requires the advertised `customAccent` capability. Presets reject accent overrides; arbitrary CSS is never accepted. |
| `setQuality` | `profile` | Set an advertised profile; expose requested/effective values when adaptive reduction occurs. Preserve semantic state and camera. |
| `captureView` | none | Return the versioned JSON bookmark specified below. This is not image capture. |
| `restoreView` | `bookmark` | Validate compatibility first, then restore a supported bookmark with operation paused. |
| `captureInspection` | none | Return `{ inspection, previewStatus }` for settled free exploration or a paused timeline tour; preserve the active tour. |
| `restoreInspection` | `inspection` | Validate the complete saved reference before mutation, restore its exact source pose/camera, and keep playback stopped. |
| `cancel` | `requestId` | Stop a pending request; retain a coherent current view. Cancellation is not an undo. |
| `dispose` | none | Abort owned work, end subscriptions and release instance-owned resources. Repeated disposal is safe. |

Tree disclosure is shell-local; alternative shells use `getChildren()`.

`setExplosion(0)` leaves the explosion workspace visible if already in it, as today. Use `setMode("explore")` to return to Explore. A leaf cannot be meaningfully separated; unsupported nonzero separation returns `UNSUPPORTED_ACTION` with unchanged presentation.

## Ordering, completion and interruption

Each request has a caller-generated ID scoped to a negotiated session. The controller validates it, reports acceptance if asynchronous work begins, and emits exactly one terminal result: `completed`, `failed` or `cancelled`. A JavaScript adapter may express the terminal result as a Promise; the iframe adapter uses the same result object. At the controller/wire boundary, a retry of an in-flight ID attaches to that request; a duplicate completed ID returns its retained result within the session's bounded deduplication window. The convenience client rejects a second local request with an already-pending ID; callers should retain the original Promise. Reusing a retained ID with different arguments is `INVALID_REQUEST`.

Completion depends on the command:

- A selection completes after authoritative state is updated and the resulting frame is submitted.
- An animated focus, separation or view restoration completes after the relevant transition settles and a frame is submitted. This does not certify display scan-out or GPU timing.
- A rendering change completes after assets are ready, the selected treatment is committed and a frame is submitted. A failed load retains the previous usable style.
- `startTour`, `resumeTour` and `playOperation` complete when transport has started, or has entered its documented paused state. They do not wait 60 seconds or an entire source cycle. Completion of playback is a separate state/event.
- `captureView` completes when a valid bookmark is returned. `captureInspection` completes after copying an existing-renderer frame, or explicitly reporting an unavailable preview; a changed source during capture returns `BUSY_STATE`.
- `dispose` completes when owned asynchronous work can no longer commit state and resources have been released.

Rapid requests must not allow an older async result to override a newer intent. A later rendering request supersedes pending rendering preparation; a later camera/pose request supersedes incompatible active transitions. The former request receives `cancelled` with reason `superseded`. Shared downloaded data may still be cached, but a cancelled consumer cannot update the display. Unrelated mutations may proceed only if the controller can serialize their state commits deterministically.

The controller owns command ordering; the scene retains its private transition/generation mechanics. UI disclosure and local URL/preferences remain shell-owned.

### Interaction conflicts

| Situation | Controller behavior |
| --- | --- |
| Visitor drags the model during a tour | Pause tour with reason `takeover`, stop its automatic camera control and grant manual orbit. Do not auto-resume. |
| Host issues a non-tour presentation command during a tour or its preparation | Cancel pending tour preparation, or apply takeover to an active tour, before executing it. The host must explicitly `resumeTour` or `exitTour` later. |
| Visitor takes control during a host camera transition | Cancel that transition request with reason `user-takeover`; preserve the displayed pose instead of jumping to its original start. |
| Operate requested while separated or isolated | Follow the existing explicit transition to assembled root, then enter operation paused or start it as requested. |
| Focus/isolation/explosion requested during manual operation | Pause operation, restore immutable source rest poses through the existing transition and apply the requested inspection state. |
| Instance becomes hidden | Do not advance playback across hidden time. Tour continuation remains explicit; retain existing manual-operation visibility behavior. |
| Reduced motion becomes active | Pause tour and use stable chapter states. Do not override the preference through a host command. |

Never combine source operation and exploded offsets on one pose. Tours sample source time through the existing renderer loop.

## Events and errors

Iframe events contain `protocolVersion`, `sessionId`, `instanceId`, `eventSequence`, `stateRevision`, `type`, optional `requestId`, and a JSON `payload`. New events receive increasing sequence numbers; replaying a retained command result preserves its original sequence and revision. `stateChanged.payload` is the complete public snapshot; `ready.payload` contains `{ state, capabilities }`. Controller-local events have no session ID until the transport attaches one. For version 0.1-draft, patches can be considered later. A terminal command result identifies the state revision it committed or retained. Consumers may ignore older state snapshots, but must still correlate replayed command results by request ID. Recover missed state with `getState()`.

Events: `ready`, `stateChanged`, `commandAccepted`, `commandResult`, `takeover`, `error`, `disposed`. Loading and playback completion use state changes. Subscriptions are removable. Bound motion updates; retain terminal results and discrete transitions losslessly.

| Error code | Meaning / recovery |
| --- | --- |
| `NOT_READY` | Required model data is unavailable; wait for lifecycle/capability changes. |
| `UNKNOWN_NODE` / `UNKNOWN_TOUR` / `UNKNOWN_CHAPTER` | Referenced ID is absent from the loaded revision or active tour; query content again. |
| `UNSUPPORTED_ACTION` | Package/runtime/host policy does not permit the action; inspect capabilities. |
| `INVALID_ARGUMENT` / `INVALID_REQUEST` | Invalid range, shape or reused request identity; correct the request. |
| `BUSY_STATE` | A stable reference cannot be captured; pause playback and let transitions settle. Only legacy `captureView` also requires leaving an active tour. |
| `ASSET_LOAD_FAILED` | Required data failed to load; preserve the last usable presentation and report a retryable flag based on the actual failure. |
| `INCOMPATIBLE_VIEW` | Bookmark version, model revision or coordinate convention differs; do not partially apply it. |
| Transport mismatch | Wrong-origin, source, protocol and stale-session messages are ignored. The current client reports a handshake timeout if no valid peer responds; it does not send error replies to untrusted origins. |
| `DISPOSED` | Instance ended; create a new instance. |

Errors include code, English message and `retryable`, without private host data or stack traces. Unknown commands fail explicitly.

## JSON view bookmarks

`captureView` captures **settled free exploration/explosion, or paused manual operation**. It rejects an active tour, a moving transition, residual orbit damping, an active benchmark, a detached intermediate pose or playing operation with `BUSY_STATE`. Use the separate inspection contract below to retain a paused timeline tour.

A bookmark includes `viewVersion`, exact `model.id`/`model.revision`, `coordinateFrame`, selected/scope IDs, isolation, mode, render style, separation, a paused operation clip/progress where applicable, and camera `position`, `target`, `up` arrays plus `projection: { kind, verticalFovDegrees, zoom, offsetX, offsetY }`. All numbers are finite; `kind` is `perspective` in this draft. Camera values use the revision-scoped `normalized-assembly-v1` display frame, distinct from source units. Include capture viewport dimensions; exclude DOM IDs, meshes, animation objects, Maps and buffers.

Validate bookmarks before mutation. Restore the camera exactly for identical layout; otherwise preserve direction and fit available space. Operation remains paused, following off. Theme/quality stay host-configured. Reject revision mismatch without title-based ID remapping. Internal tour snapshots retain their richer reversible behavior.

## JSON inspection references

`getCapabilities().inspections` advertises `{ version: "1", supported, available }`.
`captureInspection({})` returns `{ inspection, previewStatus }`, where `previewStatus`
is `"captured"` or `"unavailable"`. The snapshot is a plain JSON value:

```js
{
  version: "1",
  model: { id, revision },
  // Exactly one source:
  view: /* complete existing 0.1 view bookmark */,
  // OR
  tour: {
    tourId, chapterId, time,
    sourceOwned, highlightIds,
    selectedId, scopeId, isolated, mode, renderStyle, displayOptions,
    separation, operation, camera
  },
  preview: { dataUrl, width, height } // optional
}
```

The free `view` retains the existing bookmark format. A `tour` records the existing
GuidedTour timeline at its exact global time and chapter, including held step
endpoints. Its presentation fields have the same meaning as the bookmark fields.
`sourceOwned` indicates whether the authored tour still owns the displayed pose
and emphasis; `false` retains a visitor's paused takeover. `highlightIds` preserves
authored emphasis independently of the selected part. `operation` is either `null`
or `{ clipId, progress, status: "paused" }`. Cameras retain the bookmark coordinate
frame and projection format.

Capture requires a settled source pose with all playback stopped. A paused or
completed timeline tour remains active; capture neither exits it nor seeks it.
Moving transitions, residual camera damping, pending presentation commands,
detached intermediate poses and playing transport return `BUSY_STATE`. Hosts may
explicitly pause and retry after settling. The separate spatial presentation stage
is unsupported and returns `UNSUPPORTED_ACTION`; it is never silently substituted
with the underlying free view.

`restoreInspection({ inspection })` returns `{ restored: true }` after a submitted,
settled frame. Exact model ID/revision, format version, tour/chapter position,
enabled presentation capabilities, node IDs and camera values are validated before
mutation. Incompatibility returns `INCOMPATIBLE_VIEW`; malformed values return
`INVALID_ARGUMENT`, and unavailable nodes return `UNKNOWN_NODE`. There is no
title-based remapping or fallback to a different chapter. Source playback remains
stopped, and restoring a tour never starts its clock automatically. Saved camera
position, target, field of view and zoom survive host viewport changes; pixel
projection offsets scale with the viewport instead of reframing the subject.
Theme and quality remain host-configured. Existing `captureView`/`restoreView`
behavior is unchanged.

The preview copies the current renderer canvas during the existing render loop;
it creates no second WebGL renderer, animation clock or model instance. Default
captures are JPEG with a maximum side of 480 pixels. Accepted stored previews are
PNG/JPEG/WebP base64 data URLs, at most 120,000 characters and 640 pixels per side.
Remote URLs, SVG and executable data are rejected. If the browser cannot read the
canvas, the source reference is still returned with `previewStatus: "unavailable"`
and no `preview`. Cancellation/disposal removes the frame waiter, and the temporary
2D canvas is not retained. Shared normalization is exported as
`normalizeInspectionReference(value, { model })` for host storage validation.

Only `restoreInspection` receives an expanded, bounded transport allowance for
the small image. This contract adds no account, authentication, cloud storage or
backend; hosts decide where to keep the validated local reference.

## Iframe transport

Use `postMessage` around the controller; never target embedded DOM selectors.

1. The host creates the iframe at an approved origin and requests a handshake with a unique nonce and exact proposed protocol `annora.explorer/0.1-draft`.
2. Both sides validate `event.origin` and `event.source` against the configured peer. The child checks an explicit permitted parent origin; it does not trust an origin value inside the message.
3. The handshake establishes an instance ID and fresh session ID, echoes the nonce and reports runtime/protocol versions. This establishes routing, not user authentication.
4. Subsequent requests require that session and protocol. Replies use the exact peer origin rather than `*`. Reload, bridge teardown or iframe removal invalidates the session; delayed old messages cannot affect the replacement instance. A `dispose` command ends the renderer/controller lifecycle but leaves terminal-state queries and idempotent disposal available until transport teardown.
5. Only enumerated commands and schema-valid JSON data are accepted. Arbitrary URLs, JavaScript, DOM selectors and private scene property paths are outside the protocol.

Example request and terminal response, **illustrative only**:

```json
{
  "protocolVersion": "annora.explorer/0.1-draft",
  "sessionId": "review-session-01",
  "requestId": "request-007",
  "type": "command",
  "method": "setRenderStyle",
  "params": { "style": "linework" }
}
```

```json
{
  "protocolVersion": "annora.explorer/0.1-draft",
  "sessionId": "review-session-01",
  "instanceId": "explorer-01",
  "eventSequence": 21,
  "stateRevision": 8,
  "type": "commandResult",
  "requestId": "request-007",
  "payload": { "status": "completed", "result": { "renderStyle": "linework" } }
}
```

Both query and mutation requests use the same envelope. Read queries return a terminal result without incrementing `stateRevision`. A cancelled example uses `payload: { "status": "cancelled", "reason": "superseded" }`; a failed example uses `payload: { "status": "failed", "error": { "code": "UNSUPPORTED_ACTION", "message": "This model has no authored operating clip.", "retryable": false } }`.

## Lifecycle acceptance and phase boundary

The runtime implements shell/scene disposal, compressed-load cancellation, late-result protection and sequential remounting. Unit coverage and an independent browser consumer exercise these boundaries; long-duration device memory qualification remains open.

Disposal must abort loads/commands, disconnect observers, remove listeners, cancel frames, release owned resources and prevent late commits. Distinguish shared assets from owned buffers. Qualify repeated destroy/recreate of one active large assembly; concurrent-instance performance is deferred.

Acceptance mapping in the [evaluation matrix](evaluation.md):

- **API-01:** capability/state discovery, unavailable vs unsupported and unchanged state on rejected commands.
- **API-02:** result/event ordering, rapid supersession, load failure and manual takeover.
- **API-03:** JSON-only state, exact model-revision compatibility and supported view round trips.
- **API-04:** iframe origin/source/session/protocol validation and rejection of stale messages.
- **LIFE-01:** dispose during load, repeated mount/dispose, bounded resource ownership and no cross-instance event leakage.

Preserve decisions D-02, D-05, D-08, D-09, D-11, D-13 and D-14 in the [register](decisions.md). Follow the [harness](architecture.md) for subsequent changes. The standalone template distributes this controller and iframe boundary. Additional adapters must preserve the same capability and lifecycle contracts.

## Version 0.1 defaults

| Choice | Recommended 0.1-draft decision |
| --- | --- |
| First consumer | A separate iframe host page exercising discovery, selection, styles, tour takeover and disposal. |
| JavaScript/MCP packaging | Defer public package/server distribution until the controller and iframe consumer pass the same scenarios. |
| Model replacement | Dispose and recreate; preserve current URLs through host adapters. |
| Bookmark support | Stable free-view/paused-operation states only, exact model revision, no automatic ID remapping. |
| Command deadlines | The iframe client defaults to 30 seconds per request. Timeouts request cancellation and must not be interpreted as successful completion. |
| Event cadence and retained request window | Continuous state is bounded to approximately 10 Hz; discrete changes and terminal results remain lossless. The controller targets up to 128 tracked requests by evicting oldest terminal entries; pending requests are retained and reduce completed-result capacity. |
| Surface customization | Default shell first, optional panels only where primary control and attribution remain usable. Deeper custom shells follow a concrete consumer. |


## Version 0.1 compatibility notes

The iframe adapter is the implemented initialization surface. The controller supports configured feature restrictions; the shell enforces the project configuration. The current bookmark adapter retains the authored camera-up direction and rejects unsupported roll before mutation. Projection offsets use the current viewport layout, with a layout key for same-layout restoration; changed layouts refit the authored direction. `startTour` is idempotent while that tour is active; replay uses `seekTour(0)` followed by `resumeTour`. Browser history-cache suspension preserves the instance; normal departure disposes it. See [integration.md](integration.md) for working initialization and teardown examples.


## Short-action transport

The bundled crank and Apollo tours use `playback: "steps"`. Each 2.5-second
chapter holds at its endpoint with `status: "paused"` and `reason: "chapter-end"`.
`time` stays global; local slider progress is `(time - chapter.start) / duration`.
A host can show **Next step**, **Replay** and **Explore freely** using chapter IDs
from `getTour()`. See the [independent host](../examples/embed/host.js).
Existing tours without this flag keep continuous playback.

`presentation.separation` reports `{ available, playing, time, duration, progress,
from, to, value, speed, once, stage }`. Here `progress` is action time, while
`value` is the actual separation amount. Reassembly runs from a larger `from` to
a smaller `to`; a resumed action keeps that direction. The shell's slider uses
absolute separation, and `setExplosion({progress, transition: "immediate"})`
pauses at the chosen amount. `duration` is active animation time, excluding source
alignment and camera preparation. State notifications remain rate limited.

Manual operation exposes `duration` for presentation playback and `sourceDuration`
for the original animation clip. The bundled crank retimes its full 4-second
source clip to 2.5 seconds at speed 1. This is explanatory playback, not a measured
machine speed. Pause, replay and scrubbing never invent new operating constraints.


## Display preferences

The shared controller now accepts `setDisplayOptions` with an `options` object.
It merges the supplied keys. Unknown keys, wrong types and unrecognized line weights
return `INVALID_ARGUMENT`. The shell display panel uses this same command. Appearance, grid and accent changes do not take control from a playing or preparing tour, move the camera, or reset an operating pose.

```json
{"method":"setDisplayOptions","params":{"options":{"featureEdges":true,"hiddenEdges":false,"lineWeight":"standard"}}}
```

| Option | Default | Applies to |
| --- | --- | --- |
| `appearance` | `"light"` | All styles: `"light"` or `"dark"` canvas, ink and interface treatment |
| `grid` | `false` | All styles: depth-occluded reference ground grid; not a measurement scale |
| `ambientOcclusion` | `true` | Engineering: contact shading, subject to the quality budget |
| `featureEdges` | `true` | Linework / Flat: internal crease edges; silhouettes remain visible |
| `hiddenEdges` | `false` | Linework / Flat: dashed occluded edges on selected or tour-emphasized parts only |
| `lineWeight` | `"standard"` | Linework / Flat: `"fine"`, `"standard"` or `"bold"`, in screen space |

Preferences are exposed under `getState().appearance.display`; defaults and line
weights and appearances are advertised by `getCapabilities().displayOptions`. Inapplicable preferences
are retained while another style is displayed. They cannot enable a disabled render
style, override adaptive quality limits, or mutate the model package. They are local
to the current instance. The default shell separately saves explicit visitor appearance and per-style grid choices under its project-scoped display-preference key. A new visitor starts with the Engineering grid on and Linework/Flat grids off; hosts can override the instance through the same exact-origin `setDisplayOptions` bridge command. Preferences never write project, drawing or quotation records.

New `captureView` bookmarks include `displayOptions`. Existing `0.1` bookmarks without
this optional property still restore and use display defaults. Older bookmarks lacking `appearance` keep the current canvas appearance; newly captured bookmarks include it. Invalid supplied
options fail before any scene mutation. Tours retain these preferences; they do not
silently enable hidden lines or change stroke weight. More detail:
[display craft and source review](display-craft.md).
