# Product Room project repository contract

The customer workspace depends on an injected asynchronous repository. The
included adapter uses fictional commercial data and browser storage only. There
is no backend, authentication, email, supplier integration or real delivery.

## Ownership

- `project-domain.js`: validation, reviewed packets, version comparison and status.
- `project-repository.js`: local records, persistence, concurrency and transitions.
- `project-fixtures.js`: crank-only invented prices, lead-time alternatives and replies.
- `project-workspace.jsx`: forms, review, project presentation and transient UI state.
- `workspace-entry.jsx`: repository injection and the bounded React mount.
- `app.js` / `viewer.js`: Room navigation and the existing Explorer JSON controller.

A production host can call `createWorkspace(element, {repository, onNavigate,
onExplore})` with its own implementation. Replacing the adapter must preserve
review boundaries and immutable history; it is not just substituting a URL.
The example deliberately supplies no hypothetical endpoint or credentials.

## Repository methods

All methods return promises. Mutations return the saved record only after the
adapter considers persistence successful. Every returned object is a copy.

| Method | Result / boundary |
| --- | --- |
| `listProjects()` | Projects ordered by last update |
| `getProject(projectId)` | One complete customer case, or `NOT_FOUND` |
| `listDrafts()` | Incomplete inquiries saved in this browser |
| `getDraft(context)` | Existing draft for product/model/revision, or an unsaved draft |
| `saveDraft(draft)` | Saved draft with incremented revision; rejects stale edits |
| `submitInquiry(reviewInquiry(savedDraft))` | Immutable RFQ inside a new project; same review retry reuses that project |
| `createSampleQuote(projectId)` | Explicitly invoked fictional v1; reopening does not duplicate it |
| `requestRevision(reviewRevision(project, quoteId, values))` | Saved changes bound to exact project and quote revisions |
| `simulateReply(projectId, changeId)` | Explicit fictional reply plus a new quotation; original versions retained |
| `confirmNextStep(reviewNextStep(project, quoteId, values))` | Reviewed discussion/engineering-review request; no order or acceptance |

The sample-specific methods are demonstration controls, not production supplier
APIs. A real adapter needs authenticated, authorized supplier-authored quotations
and replies; it must not expose client-generated prices as approved offers.

## Data contracts

`ProductContext` contains `productId`, `productTitle`, `modelId`, and exact
`modelRevision`. Optional `part` and `document` contain `id` and `title`; an
optional `chapter` also contains `tourId`. Part labels are display text, not IDs.
A changed model revision must not silently retarget an old inquiry.

An inquiry draft has `id`, `revision`, `context`, `values`, `requirements` and
`updatedAt`. Values include application, quantity, requested weeks, required
stroke in millimeters, required load, notes and fictional contact details.
Requirements retain value, unit, source and explicit customer confirmation.
Looking at a component does not confirm a requirement or establish product fit.

A project contains an immutable `inquiry`, context, timestamps, revision and
append-only `quotes`, `changes`, `replies` and `nextSteps`. Each quotation has its
own ID/version, line items, assumptions and open items with owners. Revised
quotations link to their predecessor, change request and reply. Unknown line
amounts and the final total are `null`, not zero. A priced subtotal is not a final
offer. Requested weeks remain distinct from the illustrative proposed lead time.

Reviewed packets bind a full payload to the record revision reviewed by the
customer. Their canonical tokens detect accidental changes and identify repeat
submissions in this demo. They are not signatures, secrets or authorization.
A real service must validate data, authorization, latest revisions and idempotency
at its own transaction boundary.

## Failures and persistence

The local adapter uses `annora.product-room.projects.v1`, schema version 1.
Cooperating browser tabs use Web Locks when available, plus record revision and
last-read checks. This does not implement server-side transactions or cross-device
synchronization. Unknown/corrupt schemas are rejected without automatic erasure.

Errors expose `code`, `message` and optional `fields`. Expected codes include
`VALIDATION`, `STALE_REVIEW`, `CONFLICT`, `NOT_FOUND`, `UNSUPPORTED_PRODUCT`,
`STORAGE_UNAVAILABLE` and `STORAGE_CORRUPT`. A failed write must not produce a
success receipt; forms retain input and make recovery possible. A stale review
requires reopening and reviewing current data, not silently retrying against it.

## Future service responsibilities

A real deployment needs tenant/project access control, secure attachments,
manufacturer-approved facts and offers, transactional version checks,
idempotency, durable audit events, retention/export policies and delivery status.
None is implied by the static demo or the Explorer iframe handshake. The present
scope intentionally excludes accounts and production customer information.
