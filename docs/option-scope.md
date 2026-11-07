# Prepared options and quotation scope

W20/W21 implementation handoff · 2026-11-06 · Integrated acceptance and release verification pending.

A buyer compares two prepared service packages, reviews a preference, and confirms
it within one existing crank project. The seller maps that preference and the
original component requests to quotation lines. A separately reviewed issue makes
the scope visible to the buyer. A later preference and quotation append history;
they do not rewrite the confirmed inquiry or quotation v1.

The packages are fictional service scopes for the same mechanism. A preference
is not an order, mechanical configuration, price agreement or supplier promise.
Unknown prices and the final total remain unknown.

## Review path

1. Open Product Room with `?optionDemo=crank-options-v1`. Compare **Guided handoff**
   and **Engineering support**, including the connecting rod and linear guide
   references. Inspecting either package or component does not save a preference.
2. Choose a package or **Help me decide**. Review the choice and optional note,
   then explicitly confirm. The project receives a new preference event.
3. Open the same project in Studio. Prepare the quotation and assign each
   requested detail and the preference an explicit disposition. Link the relevant
   quotation lines; add an explanation where required.
4. Save, review and issue the quotation through the existing confirmation flow.
   Buyers see the issued snapshot, not the seller's working draft.
5. Confirm a different customer preference. A new quotation draft retains the
   previous quote's exact scope until the seller reviews and explicitly adopts
   the new preference. Resolve the new preference row, review and issue v2.
6. Compare v1 and v2. Both preference versions, the original component contexts,
   the inquiry and the earlier quotation remain available.

This is a review sequence, not a claim that deployment or customer acceptance has
completed. Follow [the evaluation gates](product-expansion/evaluation.md) for the
candidate and record actual route, viewport, source and target evidence separately.

## Records and history

| Record | Meaning and invariant |
| --- | --- |
| `project.approvedOptionSet` | One immutable version-1 `scope-packages` snapshot with exactly two options, title, disclaimer and the original `project.context`. Each option has a stable ID, availability, comparison facts and original request-item IDs. |
| `project.optionSetApproval` | Review token, confirmation time and project revision for the approved snapshot. This unit prepares it through fixture/API operations; there is no general option-authoring screen. |
| `project.optionPreferences[]` | Append-only confirmed events. Each pins project, original context, option-set ID/version, explicit choice, optional option ID, note and review provenance. **Help me decide** has a null option ID. |
| `quoteDraft.scopeSelection` | Exact approved set, exact confirmed preference event, and editable scope entries. This is seller work, not an issued buyer offer. |
| `quote.scopeSelection` | The reviewed draft's exact scope snapshot, copied at issue. Later preferences or drafts cannot change it. |
| `scopeSelection.entries[]` | One row for every original request item and a separate preference row. Each pins its original context and maps an explicit disposition to stable quotation-line IDs and a rationale. |

A request row uses `id: "request:<requestItemId>"`; the preference row uses
`id: "preference"` and `requestItemId: null`. The original request text and purpose
remain in the immutable `project.inquiry.requestItems`; the entry separately pins
the exact part, model, release and any drawing/inspection context. One request may
map to several lines, and one line may support several requests.

New fields are additive to the existing project store. Reading legacy records
does not write a migration or assign them current options. The W10 follow-up
fixture and ordinary customer-project namespace remain separate.

## Dispositions and blockers

| Disposition | Required state before issue |
| --- | --- |
| Included | At least one existing quotation-line ID. |
| Optional | At least one existing quotation-line ID; remains explicitly optional scope. |
| Excluded | An explanation and no linked quotation lines. |
| Needs clarification | May remain in a saved draft; blocks quotation issue until explicitly resolved or excluded with a reason. No linked lines. |

Neither a price, similar label nor package selection automatically includes or
resolves a request. Disposition changes do not calculate prices or alter line
amounts. Removing a linked line leaves the mapping visibly invalid; it does not
silently substitute another line. Save can retain unfinished work, but review
blocks missing line references and unresolved scope.

Existing commercial blockers still apply, including unanswered clarification and
unresolved customer change requests. Missing/withdrawn options, altered source
snapshots, missing scope metadata and stale project reviews fail explicitly.
Repeated confirmation of the same reviewed packet is idempotent. A newer event
in another tab invalidates an older quote review without discarding the saved draft.

## Opt-in host API

The browser-local implementation extends `createDemoProjectRepository` with
`supportsOptionScope: true`. It uses the existing transaction, storage and lock
boundary. An external adapter must explicitly support these records and preserve
all snapshots; claiming the capability while dropping metadata is an error.

| Operation or helper | Contract |
| --- | --- |
| `reviewOptionSet(project, input)` | Pure validation and reviewed packet for two prepared packages linked to the original inquiry. |
| `repository.approveOptionSet(review, { confirmed: true })` | Confirms the immutable project snapshot once. Returns the updated project; cannot replace an already approved set. |
| `reviewOptionPreference(project, { choice, optionId, notes })` | Pure review. `choice` is `option` or `help-me-decide`; reading or reviewing does not save. |
| `repository.reviewOptionPreference(projectId, input)` | Repository convenience wrapper for review against its current project. |
| `repository.confirmOptionPreference(review, { confirmed: true })` | Appends a confirmed event and advances the project revision. Returns the updated project. |
| `adoptCurrentOptionPreference(project, draft)` | Pure, explicit seller adoption. Preserves matching original request decisions and resets the changed preference row to Needs clarification. Does not save or issue. |
| `repository.getQuoteDraft / saveQuoteDraft` | Existing methods now retain `scopeSelection`. Initial drafts seed unresolved entries. Drafts copied from a quote retain that quote's exact scope. |
| `reviewQuote(project, draft)` / `repository.issueQuote(review)` | Existing separate review and issue boundary; validates current preference, exact scope, mapped lines and commercial blockers. |
| `compareQuotes(before, after, project)` | Existing comparison extended with preference, note and per-request scope changes, including stable-line reference changes. |

Pure domain helpers live in `src/product-room/option-scope-domain.js`. Repository
operations and adapter guards live in `src/product-room/option-scope-repository.js`.
The `SCOPE_DISPOSITIONS`, `optionPreferenceLabel` and `quoteScopeErrors` exports
support shared buyer/seller presentation without a renderer dependency.

Host integrations should call `assertOptionScopeRepository(repository)` before
using the feature, `assertOptionPreferenceRoundTrip(review, returnedProject)` after
preference confirmation, and `assertOptionScopeRoundTrip(expectedDraft, savedDraft)`
after draft saves. These reject missing or changed persisted metadata. Errors use
the existing `ProjectError` contract, including `CONFIRMATION_REQUIRED`,
`STALE_REVIEW`, `SCOPE_REVIEW_REQUIRED`, `UNSUPPORTED_OPTIONS`, `SCOPE_DATA_LOSS`
and field-level `VALIDATION` errors.

Review tokens are consistency checks in this local demonstration, not signatures
or an authorization system. A real host must enforce its own access, validation,
concurrency and durable storage policies.

## Fixture and limits

`src/product-room/option-scope-demo.js` prepares the public fictional example. The
allowlisted query is `optionDemo=crank-options-v1`; its browser-storage key is
`annora.options.demo.crank-options-v1`. Buyer and seller routes retain this identity
and the same project. The example does not copy a visitor's ordinary projects,
reset their records, or share local changes with another browser.

This batch includes two prepared service packages and one immutable approved
option set per project. It does not implement a general option-authoring UI,
option-set revision publishing, arbitrary product configurations, automated CPQ,
pricing rules, compatibility promises, real supplier delivery, a backend,
authentication or cross-browser synchronization. A withdrawn option can be rejected
by the contract; there is no option-withdrawal authoring workflow in this batch.

Explorer rendering, camera controls, component selection and the existing drawing
and inquiry workflows are preserved. New functionality belongs to the host
project/repository layers. Focused domain, history, failure and adapter tests are
in `tests/runtime/option-scope.test.js`; their results do not substitute for mobile,
visual, integrated-flow or deployment verification.
