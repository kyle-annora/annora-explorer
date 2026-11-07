# Customer-project repository contract

Product Room and Studio Customer projects use the same asynchronous project
repository. The included implementation stores fictional data in this browser.
It performs no authentication, backend delivery or cross-device synchronization.
Product authoring has its own [Studio repository](studio-api.md).

## Ownership and injection

- `project-domain.js`: buyer validation, reviewed packets and comparison.
- `project-state.js`: shared change resolution and next-action ownership.
- `seller-domain.js`: quotation drafts, pricing preview and reviewed seller actions.
- `project-repository.js`: persistence, projections, concurrency and transitions.
- `project-fixtures.js`: legacy invented prices/replies and inquiry examples.
- `project-workspace.jsx` / `project-conversation.jsx`: buyer presentation.
- `src/studio/customer-*.jsx`: seller project presentation and editing.

`createWorkspace(element, {repository, onNavigate, onExplore})` accepts a buyer
adapter. Studio accepts the matching customer-project adapter separately from
its product-content repository. Keep rendering and transport separate. No
hypothetical production URL or secret is configured by this template.

## Buyer methods

All methods return promises and copies. Mutations return only after persistence
succeeds. Final sends accept reviewed, unmodified packets.

| Method | Result / boundary |
| --- | --- |
| `listProjects()` / `getProject(id)` | Buyer case projection; no seller quotation draft |
| `listDrafts()` / `getDraft(context)` | Saved or unsaved buyer inquiry drafts |
| `saveDraft(input)` | Save inquiry draft with expected-revision check |
| `submitInquiry(reviewInquiry(savedDraft))` | Immutable inquiry and new project |
| `requestRevision(reviewRevision(project, quoteId, values))` | Changes tied to exact quotation/version |
| `sendCustomerReply(reviewCustomerReply(project, {body, replyTo}))` | Answer the current clarification without making a quotation |
| `confirmNextStep(reviewNextStep(project, quoteId, values))` | Discussion/engineering-review request, not order acceptance |

Legacy `createSampleQuote(id)` and `simulateReply(id, changeId)` remain fixture
compatibility methods. The buyer interface no longer uses them to manufacture a
supplier response. They are not production APIs.

New inquiry drafts carry `values.intent`: `quotation` (default) or
`application-review`. Quotation requires a whole quantity from 1 to 100,000.
Application review may keep quantity as the empty string, meaning unknown;
any supplied quantity obeys the same integer limits. Both paths retain the
application, reference, editable review and explicit confirmation boundaries.
`inquiryFields(context, values)` and `inquiryField(context, id, values)` return
effective required flags without modifying the saved presentation profile.

New drafts, sealed reviews and submitted inquiries pin
`inquiryRulesVersion: 'inquiry-intent-v1'` separately from `inquiryProfileVersion`.
Older profiles and Room releases remain valid and unchanged. Historical records
without intent or a rule version retain those omissions; quantity remains required
for their existing review path. Choosing an intent on an older draft explicitly
adopts v1 on save. Unsupported rule versions are rejected without rewriting data.

## Seller methods

Pure review helpers are exported from `seller-domain.js`.

| Method | Result / boundary |
| --- | --- |
| `listSellerProjects()` / `getSellerProject(id)` | Confirmed cases plus their private `quoteDraft` |
| `createSampleInquiry(context)` | Open or create a fictional sample case for this release; preserves other records |
| `getQuoteDraft(projectId)` | Saved draft or unsaved copy of latest quote/inquiry; does not write |
| `saveQuoteDraft(input)` | Persist seller draft; buyer quotation remains unchanged |
| `issueQuote(reviewQuote(project, savedDraft, optionalReply))` | Append immutable quote, consume draft; optional reviewed response committed together |
| `sendReply(reviewReply(project, values))` | Seller explanation, clarification or per-topic change response; no quote generated |
| `acknowledgeNextStep(reviewAcknowledgement(project, values))` | Confirm a referenced next action; no order or payment |

A draft contains `id`, `revision`, `projectId`, `projectRevision`,
`previousQuoteId`, `changeId`, `values`, optional `replyDraft` and `updatedAt`.
The reply draft preserves incomplete per-topic responses together with the quote.
A returned `rebasedFromRevision` hint identifies newer project activity; it is not
stored. Reopening rebases context references while preserving saved content, and
the draft revision still prevents another tab from silently overwriting edits. Editable values are
quantity, scope, proposed lead time, newline-separated assumptions/exclusions,
validity and line items (`id`, `label`, quantity and unit-price numeric strings).
Blank unit price means unknown. `quoteDraftErrors` validates the issuing boundary;
`quoteDraftPreview` derives a customer-facing quote. Totals are not editable.
Unknown inquiry quantity stays blank in a seller draft and `null` in its preview.
Issuing requires an explicit valid whole quantity and valid quantities for every
line. The sample-quote helper also rejects an unknown inquiry quantity. Missing
quantities on historical amount-only quote lines are not converted to one unit:
the issued history stays intact, while a new draft requires explicit line values.

Reply values contain `kind` (`reply`, `clarification`, `change-response`), `body`,
optional `changeId`, and resolutions. Each resolution has a topic (`quantity`,
`timing`, `notes`), status (`accepted`, `alternative`, `needs-info`) and response.
A pending modification needs explicit per-topic answers before a revised quote
can be issued. An unanswered clarification prevents issue. Sending a reply alone
does not imply that a quotation version changed.

Acknowledgement values contain `nextStepId` and `body`. Customer clarification
replies identify the exact question with `replyTo`. All final packets bind the
project revision; stale reviews require a new review.

## Records and immutability

`ProductContext` pins product/model IDs and exact model revision. Versioned
inquiries also pin `roomReleaseId`, `inquiryProfileVersion`, the form snapshot and
complete Room snapshot. Optional part, document and chapter references use stable
IDs and displayed titles; documents keep revisions. Earlier records without
release attribution remain legacy records, not the current release.

A project contains immutable `inquiry`, context, timestamps, revision, and
append-only `quotes`, `changes`, legacy `replies`, `nextSteps` and `messages`.
Seller drafts are stored separately from projects and omitted from buyer reads.
Saving a seller draft does not advance the public project revision. Issuance
creates source `seller-demo`; old source `sample` records are never relabeled.

Quotes retain ID, sequential version, predecessor, quantity, USD line items,
priced subtotal, final total, scope, requested timing, proposed lead time,
assumptions, exclusions, validity and open questions. Unknown amounts and final
total remain `null`, not zero. Issued quotations also carry `issuedProjectRevision` so event order does
not depend on differing clocks or timestamp precision. Original inquiry and earlier quotes are unchanged
by later replies, draft edits or product-content releases.

Messages identify author role, kind, body, referenced change/question/next step,
per-topic resolutions, time, `projectRevision`, review token and `delivery: 'demo-only'`. A general
reply does not resolve a change automatically. Legacy sample reply behavior is
preserved for old demonstration records.

Review tokens detect accidental edits and identify repeated submissions. They
are neither signatures nor authorization. Browser role projections likewise are
not security boundaries: a production host must validate and filter server-side.

## Persistence and migration

The storage key remains `annora.product-room.projects.v1` so existing browsers
retain their cases. Schema v2 adds `messages` and root-level `quoteDrafts`.
Valid schema-v1 records migrate in memory without rewriting issued artifacts;
reads alone do not write. The next successful mutation persists the new envelope.
Unknown or corrupt data fails visibly without automatic reset or erasure.

Optional Web Locks serialize cooperating tabs, with draft/project revision and
last-read checks as additional guards. Reviewed retries are idempotent. Failed
writes must preserve form input and must not produce a success receipt. Conflicts
must not silently overwrite another tab's saved draft.

Expected errors include `VALIDATION`, `STALE_REVIEW`, `CONFLICT`, `NOT_FOUND`,
`UNSUPPORTED_PRODUCT`, `STORAGE_UNAVAILABLE` and `STORAGE_CORRUPT`, with a human
message and optional field errors.

## Embedded inquiry host

The repository-local `mountEmbeddedInquiry(element, options)` returns a handle
with `open`, `getContext`, `beforeLeave`, `minimize` and `dispose`. Options accept
the same asynchronous project repository plus `onCapture`, `onRestore`,
`onProject` and `onState` callbacks. `open({context, suggestedIntent,
suggestedScope, opener})` resumes a matching saved draft. Suggestions apply only
to a new draft; the DOM focus-return target never enters the data model.

`onCapture()` returns a complete `ProductContext`; `onRestore(context)` restores
its validated inspection. Capture occurs on entry or explicit reference update,
never on hover or every selection. `onProject(project)` is the host's navigation
boundary. `beforeLeave()` flushes pending saves and returns false on failure.

`createInquirySession` owns the headless panel lifecycle. Both panel and page
use `prepareInquirySubmission` and `confirmInquirySubmission` at the same
repository review/confirmation boundary. Loading a newer conflicting draft and
starting another inquiry after a receipt are explicit actions. The product
release, rules version and reviewed packet stay separate from transient UI state.

This section describes the local composition. External viewers can use the
separately versioned [integration kit](integration-kit-api.md) with a verified
identity/capture/restore adapter and explicit repository support for its saved
references. It qualifies one independent host, not every third-party viewer.
Embedding the Annora renderer itself continues to use its existing JSON
controller; neither integration exposes internal Three.js objects.

## Production adapter responsibilities

Enforce tenant/project access and role-specific reads and writes; validate exact
versions, line amounts and reviewed terms; issue quotations transactionally;
provide idempotent durable events, attachment access and delivery states. Keep
inquiry and product-content releases distinct from quote revisions. Local demo
roles and iframe origin validation do not implement these responsibilities.

Follow the [buyer/seller walkthrough](studio-customer-projects.md) when replacing
the adapter. Preserve the existing Explorer API and renderer boundary.
