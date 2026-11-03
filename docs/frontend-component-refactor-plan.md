# Frontend component refactor plan

Status: Phases 0 and 1 implemented and verified locally on 2026-11-03.
See [delivery review](frontend-settings-refactor-review.md) for publication and evidence.
Baseline source: `2585778`, reviewed on 2026-11-03.

Improve component ownership and predictable interaction while preserving the
approved Explorer, Product Room and Studio experience. Begin with a bounded
Explorer pilot. Expand only when that pilot demonstrates visual and behavioral
parity with a simpler ownership structure.

## Decisions for the first execution batch

| Decision | Working direction |
| --- | --- |
| Scope | Phase 0 baseline and Phase 1 Display and Appearance pilot |
| Visual reference | Current approved interface, including Light, Dark and Ember |
| Frontend stack | Retain the existing DOM and React boundaries |
| Rendering | Preserve the scene, JSON controller, players and single render clock |
| Content | Preserve every model, drawing, product and quotation revision |
| State | Use local component ownership and a small overlay coordinator |
| Shared packages | Keep repository-local modules until another consumer validates extraction |
| Data | Keep existing demo adapters and API boundaries; no backend work |
| Publication | Validate an isolated preview before updating the public build |

A new state library, framework migration, scene rewrite and package publishing
are separate decisions. They are not prerequisites for this work.

## Roadmap and decision gates

| Phase | Work | Exit gate | Decision after review |
| --- | --- | --- | --- |
| 0 | Record component ownership, action rules and fixed-state browser baselines | Important states and expected behavior are documented and reproducible | Start the bounded pilot |
| 1 | Extract Appearance UI; coordinate it with existing Display UI | Both panels preserve behavior, appearance and preferences; ownership is explicit | Adopt or revise the component pattern |
| 2 | Apply the pattern to tree, inspector, transport and captions; consolidate their CSS and layout measurements | Mode-specific actions and occupied viewport regions have one defined owner | Extend the approach beyond Explorer |
| 3 | Promote shared UI, tokens and viewer/drawing adapters out of feature-owned folders | Two actual consumers use the shared contract; compatibility remains intact | Decide which modules warrant a stable public API |
| 4 | Split inquiry and quotation workspaces into task-specific screens and workflow controllers | Inquiry, issue, revision and comparison retain confirmation and exact history | Accept the commercial workspace structure |
| 5 | Profile performance and generalize product capabilities | Measured changes improve the target scenario; a second product works without identifier branches | Decide on optimization and independent packaging separately |

Phases 2–5 are a roadmap. Each is scoped from the preceding review rather than
implemented as one broad rewrite.

## Phase 0 baseline

- [x] Inventory the Explorer surfaces and their current owners: header, model
  picker, tree, selection inspector, Display, Appearance, operation controls,
  presentation controls, captions, annotations and performance panel.
- [x] Record which layer owns each state and side effect: domain/controller,
  player, application shell, component, URL or visitor preference storage.
- [x] Record opening focus, Tab containment, Escape precedence, outside-click
  dismissal and trigger-focus return for Display and Appearance.
- [x] Capture approved states with fixed camera, model revision and animation
  time. Include closed, open, selected, disabled, pending and validation error.
- [x] Record known baseline defects separately. Do not silently redefine the
  reference while extracting components.
- [x] Record the exact source commit, browser, viewport, theme and quality for
  each browser check. Use isolated test storage; preserve existing user projects.

Use Crank-slider for the normal exploration path, Open Duck for continuous
presentation, and Apollo for a structural model without operating motion.
Smoke-check the remaining configured models, including heavier Dropbear.

Cover 1280×720 desktop, 390×844 portrait, 320×740 compact portrait and 844×390
landscape. Include a real Product Room or Studio iframe and its narrower layout.
Use focused combinations, not an exhaustive Cartesian product of all settings.

Deliverables: component ownership map, action and visibility matrix, fixed-state
screenshots, and a baseline issue list. Store durable review references in
`docs/`; temporary captures and logs may remain in ignored `work/` directories.

## Phase 1 component pilot

### File boundaries

| File | Planned responsibility |
| --- | --- |
| `src/explorer/app.js` | Compose panels, supply read-only state and controller commands, retain preference and URL ownership |
| `src/explorer/display-ui.js` | Preserve the existing Display entry point while separating panel behavior from shell coordination |
| `src/explorer/ui/appearance-panel.js` | New scoped Appearance view with input validation, pending/disabled presentation and explicit cleanup |
| `src/explorer/ui/overlay-coordinator.js` | New coordinator for Display/Appearance exclusivity, dismissal and focus return |
| Focused runtime tests | Verify panel coordination, cleanup and state transitions |
| Review documentation | Record checks and any deliberately deferred baseline defects |

Keep existing element IDs, classes and layout during this pilot. Renderer,
controller protocol, players, model packages, generated catalogs, commercial
screens and storage schemas remain outside the implementation boundary.

### Ownership contract

- The coordinator owns which of the two panels is open. Each panel owns its
  controls, validation and visual update behavior.
- The application shell supplies the existing controller commands and a small
  read-only display snapshot. New panel modules do not access Three.js objects.
- Existing preference keys, URL precedence, cross-tab synchronization and
  rejection recovery remain owned by the shell and preference helpers.
- The existing document-level Escape precedence remains authoritative. Delegate
  panel closing through it instead of installing a competing keyboard handler.
- Existing tree, performance, tour-chapter and source-dialog behavior is preserved
  through explicit shell callbacks. They are not migrated in this batch.
- Every mount has one cleanup path. Use scoped elements and abortable listeners;
  disposing or remounting must not append duplicate controls or listeners.

### Work sequence

1. Establish Phase 0 evidence before changing runtime behavior.
2. Extract Appearance presentation and listeners while preserving shell-side
   persistence and the existing controller commands.
3. Add the two-panel coordinator and adapt Display's opening/closing callbacks.
4. Remove superseded handlers from the shell. Keep unrelated controls unchanged.
5. Run focused tests and review the same browser states as the baseline.
6. Run full release verification, inspect the production repository subpath and
   prepare the review record before publication.

Keep these changes in small, reversible commits. Separate the structural move
from any subsequently approved behavior correction.

## First batch acceptance matrix

| Check | Acceptance |
| --- | --- |
| Mutual exclusion | Opening Display closes Appearance and vice versa; other dialogs and presentation behavior follow existing rules |
| Keyboard | Opening focus, Tab/Shift+Tab, Escape and trigger return match the baseline; native input/select keys remain functional |
| Pointer and touch | The visible control is its target; outside-click closing remains predictable; hidden controls cannot receive focus |
| Rendering choices | Engineering, Linework and Flat produce the same controller actions and visible result |
| Display options | Grid, contact shadows, feature/hidden edges and line weight retain their enabled, disabled and selected states |
| Appearance | Light/Dark, preset accent, valid custom color and invalid custom input retain their behavior |
| Async recovery | A pending or rejected style/appearance request cannot leave controls stuck or commit stale UI after close/dispose |
| Preferences | URL overrides, reload, model switch, cross-tab updates and unavailable storage retain current behavior |
| Capability limits | A configured-disabled style or customization control remains unavailable through UI and controller policy |
| Lifecycle | Repeated open/close and host remount do not accumulate listeners or start another render/update loop |
| Presentation | Continuous tour, short step tour, pause, takeover and return retain their existing relationship to these panels |
| Responsive and embedded | Approved layout and targets remain usable across the listed viewports and host iframe; no horizontal overflow |
| Historical data | Existing model revisions, bookmarks, drawing references and inquiry/quotation records are unchanged |

Preserve focused coverage in `display-preferences.test.js`,
`display-profiles.test.js`, `themes-and-view.test.js`, controller and lifecycle
tests. Add tests for the newly defined coordination behavior rather than tests
that merely repeat implementation details.

Run `npm run verify` before release, then inspect the built application under
`/annora-explorer/`. Report actual test counts and browser evidence. Narrow
viewport emulation does not qualify physical mobile GPU performance.

## Later phase boundaries

### Explorer composition

Extract one surface at a time. Introduce a derived UI state for available actions
and visibility without replacing controller or player state. Establish one
registry of occupied UI regions for camera fitting and annotation avoidance.
Consolidate each surface's responsive/state CSS and delete its superseded rules
after parity checks; avoid a global stylesheet rewrite.

### Shared frontend modules

Move stable primitives through compatibility exports so consumers can migrate
independently. Share semantic tokens and action contracts while retaining
distinct canvas and business-workspace roles. Keep rendering colors separate
from application surface tokens. Keep buyer and seller permissions explicit.

### Commercial workspaces

Separate InquiryEditor, InquiryReview, ProjectDetail, QuoteEditor, QuoteReview
and QuoteComparison compositions from draft persistence and reviewed actions.
Keep immutable versions and existing repository interfaces authoritative. Prove
one complete vertical flow before extending the extraction to all screens.

### Performance and product generalization

Profile controller notification work, route loading and model switching before
optimizing. Compare under the same hardware, quality and workload with repeated
observations. Treat regressions beyond baseline variation as a failed gate.
Generalizing Studio's sample-specific product bindings needs a separate second
product trial; registering a renderer model alone is not that trial.

## Review and rollback

The first review includes the ownership map, exact changed-file list, same-state
visual comparison, acceptance results and unresolved items. Continue only when
parity is demonstrated and obsolete handlers have been removed.

If the pilot changes rendering, saved references, navigation semantics or the
approved layout unexpectedly, hold publication and correct or revert the isolated
pilot commit. No data or schema migration is required for rollback. Preserve
unrelated local README and pilot-document work.

Read alongside [architecture](architecture.md), [evaluation](evaluation.md),
[shared UI contract](product-room-components.md) and
[integrated presentation review](integrated-presentation-review.md).
