# Evaluation and release evidence

Revision 1 · Acceptance plan, not a report that future features passed.
Extends the existing [evaluation matrix](../evaluation.md).

## Gate ownership

| Gate | Required evidence | Owner | Blocks |
| --- | --- | --- | --- |
| G0 Scope | Actor, starting fixture, one task, primary action, non-goals and failure states | Integrator | Implementation brief |
| G1 Contract | Exact identities, capability/error semantics, migration/legacy fixtures, reviewed confirm boundary | Domain owner + integrator review | UI integration |
| G2 Feature | Feature acceptance IDs below; errors and interrupted operations as well as happy path | Implementation + independent evaluator | Candidate acceptance |
| G3 Regression | Applicable existing Explorer, story, drawing A/B, inquiry, quote v1/v2 and return navigation | Evaluator | Publication |
| G4 Visual/mobile | Desktop, 390×844, 320×780, 844×390; real hit targets, keyboard/focus, visible model and action | Evaluator | Publication |
| G5 Performance | Named browser/device/model/quality and same-fixture before/after observations | Evaluator | Any performance claim; production qualification |
| G6 Artifact/target | Required checks, public-content scan, build/source identity, successful deployment and actual target replay | Integrator | Published claim |
| G7 Customer usefulness | Buyer/seller task observed without coaching; comprehension and next-action evidence | Product/Demo with participants | Customer acceptance or benefit claim |

G5 and G7 cannot be closed by unit tests or browser emulation. An internal demo
may be published with these explicitly unmeasured, but cannot be called physically
qualified or customer-accepted. A visible regression remains a publication blocker
even when automated tests are green.

## Feature acceptance matrix

The numbered cases are defined in [scope](scope.md). Each case must record
candidate, fixture, route, viewport, expected/observed and evidence path.

| Work package | Required cases | Additional adverse case / invariant |
| --- | --- | --- |
| W10 | F3-01–06 | Local link in clean browser is not a false shared project; public fixture contains no private data |
| W20/W21 | F4-01–06, F1-01–04 | Missing scope metadata is rejected by adapter; unknown amount remains unknown |
| W30 | F6-01–06, F1-04 | Wrong question/reply target rejected; legacy serialized project still works |
| W31 | F5-01–06 | Verified on SK08: independent A/B question/scope refs; stale project/draft/source rejection; failure recovery; 320px touch; original inquiry/questions/v1 unchanged. See [evidence](../evidence/drawing-impact/acceptance.json). |
| W32 | F6-07–10 | Saved-record projection and optional observation boundaries are implemented. Retry, failed save, unknown schema, safe envelope, namespace provenance and responsive journeys are recorded in the [project activity review](../project-evidence-review.md); publication has its own receipt. |
| W40 | F2-01–06 | No fabricated drawing/action; unsupported host capability is visible |
| W41 | A-01–06 | New source produces a new package; independent operator needs no undocumented edits |
| W50 | B-01–06, F1-03 | Independent host has no Annora scene/controller import; upgrade/rollback retains old records |
| W60 | Accepted preceding cases + full declared journey | Walkthrough uses real domain operations and cannot skip review/confirmation |

## Shared failure and history fixtures

Maintain focused fixtures for:

- A legacy single-context inquiry without request items or story metadata.
- A current inquiry with two independent item contexts and a saved unsent draft.
- Quote v1 plus a draft v2, with unanswered and answered questions distinguished.
- Drawing source A, candidate B, a removed region, an ambiguous association and
  an intentionally retained A reference. Preserve original PDF access.
- Follow-up A and B referencing different exact story/quote versions.
- Option set A and B, with one withdrawn option and an explicitly undecided buyer.
- Old adapter with no new capability; falsely opted-in adapter dropping metadata.
- Save failure, stale review, duplicate confirm, cross-tab conflict, missing asset,
  unavailable archived model, disposal during load and interrupted transition.

Historical tests compare normalized retained records/digests, not only displayed
labels. Issue/release review must bind the exact revision shown. Failed migration
leaves original storage recoverable. Buyer reads omit seller drafts; demo role
filtering is not described as production authorization.

## Browser and visual review

Run compiled output under the deployment subpath. Test ordinary clicks, touch,
Tab/Enter/Escape, focus return, browser Back, draft resume and role changes. No
action depends on hover; reordering has a keyboard/tap alternative. Check errors,
empty states, long names and unknown values, not only the seeded happy path.

Keep one primary action for the current task, one playback control surface and
one model canvas. Menus must not silently hide actions required to complete the
journey. In short landscape the model, reference identity and primary action stay
reachable. Retain theme and selected accent. Capture same-camera comparisons for
any change that might affect rendering or framing; host copy-only changes do not
justify another rendering redesign.

Use the existing 21-checkpoint commercial walkthrough and explicit confirmation
gates as a regression baseline, adjusting assertions only for an approved behavior
change. A changed test selector is not a changed product requirement.

## Performance and scale evidence

For affected paths record asset transfer, model/triangle/draw-call counts where
available, number of active canvases, setup/interaction times and hidden-tab
behavior. Compare the same model, viewport, quality, browser and hardware.
Do not replace source assets or lower visual quality to improve a comparison
without reporting that change.

Structural requirements: no new per-frame telemetry; no second renderer for
comparison; bounded item/step/event collections; no repeated model download on
panel navigation; cancelled loads cannot commit late; unmounted/hidden players
stop work under the existing lifecycle policy. Contract tests cover these where
possible; observed GPU behavior requires a device run.

Before a production performance claim, nominate at least one ordinary laptop
and one physical phone, agree a task budget from a measured baseline, and record
the result. This plan deliberately does not invent a universal FPS or import-time
promise. Log source-preparation effort separately from renderer load time.

## Neutral customer tasks

1. Buyer: "Find the guide detail, ask about that and a second part, then review
   what you will send." Observe navigation help needed, exact reference retention,
   unintended submission and whether the buyer understands the confirmation.
2. Seller: "Answer one question and ask for clarification on the other. Prepare
   a quotation showing what is included." Observe whether request, answer and
   priced scope are distinguished without explanation from the presenter.
3. Returning buyer: "Open the follow-up, find what changed and identify your next
   action." Observe whether the buyer can name the correct quote/reference version.
4. Delivery operator: "Prepare this supplied model and publish a fictional demo
   using only the English instructions." Record undocumented steps, manual asset
   work, active time and failures. Do not conflate agent success with novice success.

Record observed completion and confusion. No fixed participant count in this
plan establishes statistical conversion uplift. Real funnel measurement requires
defined eligible sessions, privacy/consent decisions and the future host service.

## Evidence record and release

Statuses are `NOT RUN`, `PASS`, `FAIL`, `BLOCKED` or `N/A` with a reason.
Retain failed probes; a closing retest links to the same issue ID. Each receipt
records source commit, contract versions, artifact hashes, fixture identities,
checks, actual device/browser coverage, known limitations and target status.

Run `npm run verify` before an application release. Run `npm run build:inquiry`
when the distributable or its consumers change. Check licenses and public content,
then publish only the approved candidate. Verify target entries/assets and replay
the actual live journey; a successful push is not target verification. If hosting
fails, record the hold and distinguish source completion from publication.

Each future MK adoption requires its own candidate, adapter checks, target receipt
and producer refresh. Annora's source publication alone is insufficient. Planning
documents can be committed without redeploying unchanged app code; this revision
does not claim a new runtime release.
