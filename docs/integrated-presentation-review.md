# Integrated presentation review

Status: release candidate validated on 2026-11-03. The publication record below
separates local verification from the deployed source revision.

## Scope

Integrate the approved robot Showcase experience into the existing Explorer as a
presentation state of its current model stage. The shared `GuidedTour`,
`TourPlayer`, source animation sampler and scene continue to own playback. The
interface has one presentation entry, a compact transport and an explicit return
to exploration. It does not mount another live viewer.

Open Duck is the first integration reference, followed by Hexapod and Dropbear.
Existing Kinetic, Apollo, connecting-rod and SK08 packages retain their exact
identity and version references. Product Room, Studio, drawing releases and
customer projects keep their existing storage and review contracts.

## Reference lock

Primary direction: the approved Annora Explorer and compact robot presentation,
informed by Oxide's model-first floating controls.

Preserve the silver/graphite canvas, Ember default and custom accent, compact
technical typography, existing engineering materials, clear occlusion-aware
linework, flat component emphasis and a dominant model stage. Atlas informs the
linework treatment; teenage engineering informs restrained labels and flat,
precise component surfaces. These references do not replace Annora's color roles.

| Decision | Source | Role and reason |
| --- | --- | --- |
| One presentation entry in the current stage | Approved integration brief | Keep exploration and explanation connected without a second navigation destination |
| Hide secondary panels during playback | Oxide and the approved Showcase | Reserve the focal area for the mechanism |
| Short caption and compact transport | Approved Showcase and teenage engineering restraint | Identify the current explanation without a large text card |
| Existing linework and selective Ember | Atlas and confirmed Annora rendering decisions | Distinguish parts while retaining visible/hidden-edge relationships |
| Pause on visitor interaction; explicit Resume | Existing Explorer playback contract | Give control back without silently resuming |
| Capability-based controls | Existing model package and JSON API | A structural model must not acquire invented operating animation |

No additional bitmap artwork is required. The prepared source-linked assemblies
are the visual content. Keep the same theme and performance controls in
exploration; presentation layout changes must not reset user display choices.

## Playback and navigation invariants

- Continuous robot presentations use full-tour seeking. Existing short step
  presentations retain chapter-local seeking, exact chapter-end holds and
  explicit advancement.
- Pause, reverse seeking and replay sample the same authored timeline. They do
  not start a second animation clock or infer a physical mechanism.
- Orbit/selection takeover pauses the active presentation and releases its camera.
  The paused explanation remains resumable. Component navigation must remain
  available through a clear exploration action.
- Closing a presentation restores its captured navigation and scene snapshot.
  Exploring from the current frame intentionally retains that visible state.
- Preparation, cancellation, restoration and replay retain abort/generation and
  intent checks. Retired work must not modify a newly loaded model.
- Hidden pages and reduced-motion visitors never resume automatically. Stable
  reduced-motion poses retain the authored chapter meaning.
- Public bookmarks remain exact-revision JSON. Active tours, detached poses,
  moving transitions and playing operations remain unavailable to `captureView`.
- Captions, transport, open chapter lists and component panels participate in
  available-viewport calculations. Annotation collision checks match visible UI.
- Model switching retains appearance preferences while resetting navigation,
  isolation, playback and pending work.

## Required verification

| Gate | Acceptance and evidence to record |
| --- | --- |
| Original content | Existing four packages and their resolved revisions match the baseline |
| Runtime | Optional layered separation preserves omitted/full-range behavior; one scene clock |
| Continuous playback | Open Duck, Hexapod and Dropbear complete, pause, reverse-seek, replay and permit manual takeover |
| Step playback | Kinetic and Apollo retain exact chapter holds, replay and explicit next-step behavior |
| Navigation | Select versus Inspect, parent return, isolation and whole-model reset remain distinct |
| Display | Engineering, Linework, Flat, custom accent, grid and Light/Dark remain coherent |
| Async lifecycle | Exit/model switch during line preparation or restoration cannot activate stale UI |
| Accessibility | Focus remains reachable; hidden panels are not keyboard traps; controls have clear names and states |
| Responsive layout | Desktop, 390-pixel portrait, compact portrait and landscape retain reachable controls with no horizontal overflow |
| Business regression | Existing Room/Studio inquiry and quotation review plus drawing A/B history remain readable and exact |
| Media | Selected robot has matching film/keyframes and source notices; no cross-model fallback |
| Publication | Production build works under the repository subpath; deployed source revision and live routes agree |

The prior robot measurements apply to that separate release and development
workstation. They do not qualify ordinary computers or physical phones for this
integrated release. Record asset sizes, viewport, quality and any new measured
results separately. Dropbear remains a heavier optional model, with no closed-chain
solver or walking claim.

## Evidence record

### Local release verification — 2026-11-03

- `npm run verify`: 589 tests, 588 passed, zero failures, one pre-existing skipped
  Studio fixture test. Seven model packages and drawing packages validated;
  production build completed. The existing catalog-size warning remains.
- The final responsive adjustment was rebuilt and checked on the production
  artifact at `/annora-explorer/`, matching the GitHub Pages repository path.
- Open Duck: automatic entry, full completion, replay, pause, backward seeking,
  chapter changes, Close snapshot restoration and free exploration checked.
- Hexapod: native model handoff, manual canvas takeover, explicit resume,
  backward seeking, layered separation and technical rendering checked.
- Dropbear: native loading, complete presentation, replay, pause and chapter
  navigation checked. No console errors observed on this production route.
- Crank and Apollo: existing step-local progress, 2.5-second endpoint holds,
  explicit Next step and compact controls checked. Their model package revisions,
  together with connecting rod and SK08, are asserted unchanged in tests.
- Layouts reviewed at 1280×720, 390×844, 320×740 and 844×390. Compact portrait
  transport separates replay from the progress/exploration row. Landscape keeps
  the caption left of the model and uses a single transport row. No horizontal
  page overflow observed. Main scene has one canvas.
- Dark/Light, custom accent and Linework were exercised; model switching carries
  the visitor's requested rendering style and quality rather than a transient
  authored tour style. Disabled quality capabilities cannot be bypassed by URL.
- Studio SK08 overview/source-version controls opened correctly. The existing
  walkthrough's first Continue demo ran the crank motion, selected Connecting rod
  and carried that part into inquiry. Automated Room, Studio, drawing-version,
  quotation and walkthrough regressions passed. Their source was not changed.
- Optional media page resolved the matching Open Duck film, GIF and three
  keyframes; 960×600, 20-second film metadata loaded. This route mounts no 3D
  renderer. The main Explorer only imports media URLs, not video bytes.
- Regression tests cover a hidden page completing asynchronous preparation:
  playback stays paused on return until the visitor explicitly resumes.

### Review routes

- [Open Duck presentation](https://kyle-annora.github.io/annora-explorer/?model=open-duck&presentation=1)
- [Hexapod presentation](https://kyle-annora.github.io/annora-explorer/?model=hexapod&presentation=1)
- [Dropbear presentation](https://kyle-annora.github.io/annora-explorer/?model=dropbear&presentation=1)
- [Optional film and keyframes](https://kyle-annora.github.io/annora-explorer/presentation-media/?model=open-duck)
- [Existing customer walkthrough](https://kyle-annora.github.io/annora-explorer/walkthrough/)

The ordinary root URL still opens Crank-slider in exploration mode. Only an
explicit `presentation=1` requests a presentation. Unknown, empty or duplicate
model requests cannot autoplay a fallback model.

### Content and host boundaries

The three robots are added through their prepared packages, with source licenses
and reproduction links retained. Media metadata lives in
`content/presentations/registry.json`; every entry pins the exact model package
revision and authored tour. A stale film/package pair fails the build. Only
configured model/tour pairs contribute derivative media. Core render styles,
animations and the JSON embed controller remain shared.

Product Room and Studio keep their existing commercial samples. Adding a robot
to the public model menu does not invent a quotation catalog, customer project
or drawing release for that robot. The independent model lab and Showcase remain
available for authoring and media export.

### Performance limits

This review used the development workstation and browser viewport emulation,
not a physical entry-level computer or phone. Ordinary-device qualification is
still pending. Compressed model downloads are about 2.22 MiB for Open Duck,
0.92 MiB for Hexapod and 6.26 MiB for Dropbear, fetched when selected. Dropbear
and Apollo remain heavier optional examples. The shared catalog is about
269 kB gzip; it is not all model geometry. No new CAD kernel, renderer, animation
clock or runtime dependency was introduced.

### Publication

The source commit, successful Pages run and final hosted route check are recorded
in the release follow-up. Until then the checks above describe the local build.
