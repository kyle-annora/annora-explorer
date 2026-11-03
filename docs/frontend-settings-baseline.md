# Settings component baseline

Baseline: `2585778296c441b5ba1f7c8a8c43628b9aceebcb`, reviewed 2026-11-03.
Scope: Phase 0 of the [component plan](frontend-component-refactor-plan.md).
The approved visual reference is the existing application. No new design system
or rendering treatment is introduced in this pilot.

## Ownership before extraction

| Surface or state | Baseline owner | Preserved boundary |
| --- | --- | --- |
| Header, model picker, URL | Explorer application shell | Reload carries requested style and quality |
| Assembly tree, search, scope, inspector | Shell, navigation helpers, controller | Selection and entering an assembly remain distinct |
| Display controls | `display-ui.js` | Controller commands, current style, options and busy presentation |
| Appearance controls | Inline application shell | Presets, custom validation, Light/Dark and readiness |
| Panel visibility | Display module and shell independently | Mutual exclusion, initial focus and dismissal |
| Global keyboard | One shell document keydown handler | Escape priority and Tab wrapping |
| Appearance persistence | Shell and preference helpers | Existing keys, URL precedence and cross-tab changes |
| Geometry, lighting, picking, rendering | Scene and JSON controller | No panel gets Three.js access |
| Operation transport | Shell and operation player | Single shared animation clock |
| Presentation, chapters, captions, annotations | GuidedTour and existing player | Existing step/continuous playback and takeover |
| Performance panel | Shell and scene benchmark | Existing quality and benchmark controls |
| Embedded hosts | JSON controller bridge | Exact-origin handshake and one viewer |
| Drawing and commercial revisions | Existing repositories and host workspaces | Immutable model/drawing/inquiry/quotation references |

## Action and focus contract

| Action | Baseline behavior |
| --- | --- |
| Open Display | Close Appearance, Performance and tree; focus selected style |
| Open Appearance | Close Display, Performance and tree; focus selected Light/Dark mode |
| Display trigger closes itself | Return focus to Display trigger |
| Appearance trigger closes itself | Browser retains trigger focus; no explicit focus call |
| Close button or Escape | Close the targeted panel and return trigger focus |
| Outside pointer | Close without moving focus back |
| Open tree | Close settings/performance/chapters, take over playback and refit |
| Open Performance | Pause active tour, close settings/tree and refit |
| Open settings during presentation | Do not pause playback; Display is hidden during active tour, Appearance remains available |
| Change theme | Update scene/tokens, selected preset, custom fields, Flat label and saved visitor preference |
| Change display style | Await preparation, retain requested style and apply its saved grid preference |
| Invalid custom hex | Show validation; send no theme command |

Escape precedence remains source dialog → Performance → Appearance → Display →
tour chapters → tree → active tour. The pilot does not install another keyboard
handler. Tab remains in the existing open panel; native control keys remain native.

## Existing limitations and bounded corrections

- Baseline constructors appended generated controls without removing them on
  disposal. The pilot adds explicit cleanup for remounting.
- Baseline Display completion could sync or focus after abort. The pilot guards
  disposed UI and reports rejected requests through the existing status area.
- Reset remains available while style preparation is pending; this is preserved.
- Appearance retains readiness-based disabling, without a new pending spinner.
- The global Tab query includes disabled inputs/selects. Its loading-state edge
  remains recorded for a separate keyboard-hardening change; global routing is
  deliberately unchanged in this pilot.
- Existing overlapping CSS rules remain unchanged. Consolidation belongs to a
  later phase.

## Reproducible evidence

Chrome desktop browser, isolated storage, device scale factor 1. Viewports:
1280×720, 390×844, 320×740 and 844×390. Fixed model/camera/time were used for
closed, Light/Dark, invalid custom accent, Engineering, Linework and Flat captures.
Pending/rejected/disposal cases are controlled in the new Node tests rather than
claimed as deterministic screenshot states.

The standalone baseline records 111 checks and 28 canonical UI snapshots. The
candidate repeats these checks and also tests real Product Room and Studio
iframes. Seven configured models, cross-tab preferences, Apollo short-step and
Open Duck continuous playback are checked separately. See the
[delivery review](frontend-settings-refactor-review.md) for actual final counts.

The [browser review scripts](../scripts/review/settings-panels/README.md) reproduce
these checks. Representative images and machine-readable records are retained in
`docs/evidence/settings-panels/`; full local captures remain in ignored `work/`.
These are desktop browser emulations, not physical mobile performance results.
