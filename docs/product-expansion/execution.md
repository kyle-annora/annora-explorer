# Execution, harness and agent plan

Revision 4 · Execution plan with W20/W21 and W30 publication status. Feature IDs refer
to [scope](scope.md); candidate acceptance and publication require separate evidence.

## 1. Delivery strategy

Build vertical slices that both buyer and seller can use. Avoid six feature
branches that invent different versions, navigation or project state and merge
only at the end. Keep the existing runtime and commercial flow as the baseline.
Use a capability flag until a slice's contract, UI and historical behavior agree.

The recommended sequence below remains the delivery plan. The user has approved
the feature directions. W20/W21 publication and integrated acceptance are recorded
in the [delivery review](../option-scope-review.md); remaining packages stay planned.
Sizes express coordination/risk, not elapsed-time promises. Re-estimate after W10
using actual integration, review and recovery work. Asset availability and future
service ownership can change the schedule independently of agent count.

## 2. Work packages and dependencies

| ID | Scope / concrete deliverable | Prerequisite | Size / main risk | Review result |
| --- | --- | --- | --- | --- |
| W00 | Freeze identity/capability/state rules; named fixtures; baseline routes; define error and historical behavior | Current verified release | S–M / conflicting assumptions | A reviewed contract and examples each agent can consume |
| W10 | F3 crank follow-up: author, buyer resume, same-project next action, local release and public fictional fixture export | W00; existing F1/F2 | M / confusing local and hosted delivery | Seller builds two-step follow-up; buyer returns to the same project and exact quote/clarification |
| W20 | F4a two prepared service packages, differences and reviewed preference events | W00 | M / unsupported configuration claims | Published; local and live desktop/mobile QA passed. Buyer can choose or remain undecided without changing the confirmed inquiry. See [handoff](../option-scope.md). |
| W21 | F4b request-to-quote scope mapping, explicit preference adoption and v1/v2 comparison | W20 | M–L / metadata lost during draft/quote copying | Published; local and live desktop/mobile QA passed. Requested versus offered scope is reviewed before separate issue; prior snapshots remain unchanged. See [handoff](../option-scope.md). |
| W30 | F6a question-level events, replies, blocker policy and buyer/seller work list | W00, W21 scope-link contract | L / existing singular pending-question policy | Published; compiled desktop/mobile/compact and live desktop/mobile checks passed. Independent questions, reviewed resolution, frozen v1/v2 evidence and ordinary-project compatibility. See [review](../questions-review.md). |
| W31 | F5 impact report, per-question/scope working references and explicit drawing/overview A→B decisions | W10, W21, W30; existing drawing revision flow | L / false matches and accidental history adoption | A and B may coexist in working references; original inquiry, discussions and v1 keep A |
| W32 | F6b bounded events and small evidence view in existing workspace | W10, W30; event definitions from W00 | S–M / counting observations as business outcomes | Reproducible demo counts, no sensitive payloads or blocked user actions |
| W40 | F2a registry, F2b technical-view steps and prepared-product readiness report | W00; existing story/drawing contracts | L / crank assumptions spread across hosts | Second prepared product uses supported story/drawing steps without renderer forks |
| W41 | A intake/mapping/export workbench and independent fresh public-product qualification | W40 | M–L / asset preparation effort | Independent operator follows English workflow and produces a reproducible package |
| W50 | B versioned integration artifacts, conformance runner, independent public viewer and upgrade rehearsal | W00 contract spike; freeze F1/F3/F4/F6 payloads before final qualification | M–L / viewer and repository capability mismatch | A separate host uses declared functions and safely rejects unsupported ones |
| W60 | One revised customer walkthrough, release/evidence index, final combined regressions | All accepted packages; exclude any explicitly deferred capability | M / inflated completion claims | Patrick/Wesley can follow one path and every claim has a candidate and proof |

This is not a requirement to wait for all packages before showing progress.
Release W10, W20/W21 and W30/W31 as separate coherent candidates. Readiness and
independent-host investigations can run between these releases without changing
their shared contracts. W32's UI waits for reliable event semantics.

## 3. Recommended waves

1. **W0: establish boundaries.** W00 locks identities, proposed methods, capability
   fallbacks, existing fixture evidence and the first review path. Investigate the
   independent viewer seam and second-product source availability read-only.
2. **W1: focused customer follow-up.** Complete W10 on the crank. Prove local-only
   and fresh-browser public-fixture modes separately. No real recipient sending.
3. **W2: preference to quoted scope.** Complete W20 then W21. Review the whole
   buyer preference → seller disposition → quote v1/v2 path, not just option cards.
4. **W3: resolve and maintain.** W30 defines question-level behavior first. W31
   uses those identities for impact review. W32 adds evidence only after persisted
   events and retries are trustworthy. Use existing SK08/linkrods A/B sources.
5. **W4: prove repeatability.** Complete W40/W41 and W50. Readiness reports and
   adapter spikes may start earlier, but final compatibility follows frozen
   product payloads. Prove another product and an independent viewer separately.
6. **W5: compose the delivery.** W60 binds accepted features into a short buyer/
   seller presentation. No new commercial behavior is implemented in walkthrough
   code; it drives the same reviewed project operations.

If the next customer call prioritizes reuse, W40's readiness slice or W50's
independent-host spike can move ahead of W32. Moving them does not make the
unfinished features complete or permit parallel edits to their shared stores.

## 4. First executable unit: W00 → W10

**Starting fixture:** the published crank release, a fictional confirmed project
with two independent request items, an issued quote v1, one current clarification,
and a released story with two prepared steps. Use that project's exact product
release. The first next action opens the exact quote or answers the existing
clarification; it does not edit the confirmed inquiry. Leave other projects and
the bundled product release unchanged.

| Task | Owner | Output / stop condition |
| --- | --- | --- |
| W00.1 Current inventory | Integrator + evaluator | Baseline source/deploy IDs, routes, storage keys, fixture hashes, preserved unrelated files |
| W00.2 Follow-up contract | Domain agent | Draft/release/progress and next-action types; exact snapshots; errors; legacy/no-record cases |
| W00.3 Boundary review | Integrator | Agree local/public/future-host distribution and confirm no new renderer/store ownership |
| W10.1 Domain implementation | Domain agent | Pure validation/review helpers, repository extension and history/retry/conflict tests |
| W10.2 Seller authoring | Seller experience agent | Scoped editor selecting steps/questions and one next action; preview/review states |
| W10.3 Buyer follow-up | Buyer experience agent | Compact player, explicit resume, agenda/reference return, guarded same-project quote/clarification action |
| W10.4 Integration | Integrator | Connect existing routing/repository/export; exact source identity and old-release checks |
| W10.5 Public demo fixture | Integrator + content reviewer | Fictional allowlisted package; fresh-browser path; no private project serialization |
| W10.6 Independent acceptance | Fresh evaluator | F3-01–06, adverse states, mobile and existing inquiry/story regressions |
| W10.7 Publication | Integrator only | Required checks, target validation and release receipt, or an explicit publication hold |

Seller and buyer agents may start from frozen fixtures after W00.3. They must not
invent repository methods independently. A contract change returns to W00.2 and
updates consumers before integration. Unfinished source availability cannot be
replaced by a fictional success response.

## 5. Agent arrangement: four active slots, including the integrator

Use roles per work package, not a permanent agent per feature. There are two
useful configurations within the same four-slot limit:

| Stage | Slot 1 | Slot 2 | Slot 3 | Slot 4 |
| --- | --- | --- | --- | --- |
| Contract preparation | Root/integrator | Domain/API | Buyer flow and fixture analysis | Seller/source/adapter analysis |
| UI implementation after contract freeze | Root/integrator | Domain/API | Buyer UI | Seller UI |
| Integration and acceptance | Root/integrator | Responsible implementation/fix owner | Fresh independent evaluator | Onboarding or adapter work on disjoint files |

Do not run four browser/GPU suites concurrently and call the results a performance
baseline. Give acceptance one known server/subpath, fixture namespace and browser
owner. Parallel pure tests are appropriate; mutable project fixtures are isolated.

### Responsibilities and write ownership

| Role | Owns | Must not do independently |
| --- | --- | --- |
| Integrator | Scope decisions, shared host wiring, cross-module state integration, candidate branch, publication and evidence claims | Skip required review because another agent says tests pass |
| Domain/API | New pure domain modules, contracts, fixture shapes, validation and focused tests | Invent UI routes, change shared stores outside an assigned lease, publish |
| Buyer experience | New scoped buyer components/styles, interaction states, mobile/focus/return behavior | Rewrite seller logic, add a second store/player, silently expand capabilities |
| Seller experience | New scoped editor/review components/styles and fixtures | Change issued-record semantics or shared version rules independently |
| Evaluator | Adversarial fixtures, compiled/live replay, visual findings, traceable evidence | Approve only its own implementation or silently repair product failures in a test |
| Onboarding/integration engineer | Package tooling, readiness reports, distribution/consumer fixture within explicit paths | Add model-specific renderer cases or copy client-private assets |

The final two roles rotate into available slots; they are not extra concurrent agents.

### Shared-file leases

Root owns `src/product-room/app.js`, `project-workspace.jsx`,
`src/studio/app.jsx`, `customer-workspace.jsx`, `customer-views.jsx`,
`editor.jsx`, shared navigation and release wiring. Domain agents normally work
in new pure modules and provide integration patches. Root may explicitly lease
`project-domain.js`, `seller-domain.js`, `project-state.js`,
`project-repository.js`, `src/studio/domain.js` or `repository.js` to one owner
for one work package. No second writer touches a leased file.

`src/explorer/app.js`, `controller.js` and the renderer are protected boundaries.
A demonstrated missing public capability requires a separate scoped change,
regression list and root integration. `src/generated/` is never hand-edited.

The current environment shares one filesystem. A branch name alone does not
isolate concurrent writes. Use disjoint file ownership or an explicit isolated
checkout when needed; do not switch the shared checkout underneath another agent.
Only root commits integrated work and pushes. Preserve unrelated working changes.

## 6. Handoff and harness records

Each work package has one status record; documents link to it rather than copying
status everywhere. Suggested location when execution begins:
`work/product-expansion/<work-package>/handoff.json` plus an English review note.
Publish only an allowlisted receipt/evidence summary under `docs/evidence/`.

```json
{
  "workPackage": "W10",
  "status": "contract-review",
  "baselineCommit": "exact-source-commit",
  "contractRevision": "reviewed-contract-revision",
  "owner": "assigned-role",
  "ownedPaths": [],
  "forbiddenPaths": [],
  "acceptanceIds": ["F3-01", "F3-02", "F3-03", "F3-04", "F3-05", "F3-06"],
  "fixtureIds": [],
  "evidence": [],
  "openIssues": [],
  "nextAction": "specific next action and owner",
  "publication": {"status": "not-attempted"}
}
```

Use separate implementation, test, publication and customer-acceptance fields.
A progress record cannot promote itself from implemented to customer-accepted.
When a run is interrupted, the next owner starts from this record and the exact
candidate, not from a vague chat summary. Retry the recorded failing step before
expanding scope. Never automatically erase the customer's browser store to make
a regression pass.

An issue record contains ID, owner, candidate, route, fixture, expected/observed,
reproduction, evidence, smallest closing retest and status. Product owns ambiguous
behavior; Demo owns explanation/order; implementation owns a clear behavior that
fails; source owner supplies missing input. Mixed issues have one lead.

For a future MK candidate, start from its registered CURRENT entry and complete
the required producer refresh in that same delivery/correction/release unit.
The Annora plan and release do not update MK generation 41 or its deployed bundle.

## 7. Skills and reusable operating instructions

Keep the existing `.agents/skills/explorer-project/SKILL.md` as a short router to
contracts and checks. Do not duplicate business rules across skills. During
execution, extract four short playbooks only when their actual workflow exists:

1. Product intake and readiness → A, model/source rules, source report.
2. Story/follow-up/request authoring → F1/F2/F3, review and identity rules.
3. Host integration qualification → B, capability and adapter acceptance.
4. Evaluation and release handoff → evidence, unresolved issues and live target.

Use interface-design skills for changed UI, with the established visual reference
as the constraint. Use animation skills only if an approved motion change is
needed; these host features normally reuse the existing player. Additional skill
installation is not a prerequisite. A skill never supplies publishing authority
or makes an engineering claim true.

## 8. Scope decisions to confirm at review

| Decision | Recommended boundary | Why it affects execution |
| --- | --- | --- |
| First complete slice | W10 focused follow-up on crank | Reuses the strongest current authoring and inquiry path |
| Distribution | Local demo plus one public fictional fixture; real private sharing deferred | Avoids confusing browser data with a delivered customer project |
| Options | Two same-release scope alternatives first | Current identity rules do not support arbitrary cross-model RFQs |
| Question concurrency | Multiple question-scoped clarifications for new records; preserve legacy serialized flow | Requires explicit project-state migration and quote blocker policy |
| Technical views | Existing SK08/linkrods references, through product capability registry | No fabricated source drawing or implicit crank-wide support |
| Production boundary | Fake/local adapter with service contracts only | Backend, identity, permissions and notifications need their own owner and acceptance |

These recommendations make the detailed plan executable. They are not a request
to approve deployment again. The next discussion should settle scope/order, then
start W00/W10 with the bounded agent assignments above.
