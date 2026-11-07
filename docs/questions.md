# Independent questions and reviewed resolution

W30 contract · November 6, 2026 · Candidate behavior; integrated review and publication are separate evidence.

The existing crank comparison project can hold several questions about different
saved request items. Each question keeps its own source, answer, owner and
resolution history. A seller answer does not resolve a question. Closing one
question never closes another or changes the confirmed inquiry.

The browser-local demonstration exposes API seams for a future host. It does not
send messages, authenticate roles, notify people, share across browsers, or claim
that a technical answer is correct. Seller confirmation is explicitly attributed
to the seller; only a buyer action is a buyer acknowledgement.

## Review sequence

1. Open the existing `?optionDemo=crank-options-v1` project. Choose one original
   request item, write a question, and state whether it affects quotation scope.
   Review its exact component/source and explicitly confirm.
2. Add another independent question for the other component. Each starts Open
   with the seller responsible for the next action.
3. In Studio, answer a particular question or request clarification. A clarification
   waits on the buyer; the buyer's reviewed reply returns responsibility to the
   seller. A seller answer produces Answered, never Resolved.
4. Review a separate resolution and its rationale. Seller confirmation is a
   seller-reviewed disposition; a buyer can instead acknowledge the answer.
   Both remain visible with their actual author role.
5. Prepare quotation scope. Every question points to its original request scope
   entry. All scope-affecting questions must be explicitly resolved before quote
   issue or next-step confirmation. Informational questions can remain open and
   remain visible in the quotation's frozen evidence.
6. Reopen a resolved question with a reviewed reason. The old answer, resolution,
   quotation and inquiry remain intact. A later quotation draft keeps its earlier
   evidence until the seller explicitly adopts the latest question history,
   reviews the quotation and issues another version.

Opening a component, expanding a question, reviewing or returning to a
saved record does not write any question or adopt current evidence.

## Records and transitions

| Record | Contract |
| --- | --- |
| `project.questionPolicy` | `{version:1}`, created only by the first confirmed question. Merely reading an older project never enables this policy. |
| `project.questions[]` | Opening order. Each thread has stable `id`, `projectId`, `requestItemId`, the exact immutable `requestItem` snapshot and `context`, original `body`, explicit `blocking` boolean, `scopeEntryId`, `createdAt`, and append-only `events`. |
| `question.scopeEntryId` | Exactly `request:<requestItemId>`. In the prepared comparison it links to the same request's `scopeSelection.entries[]` row and context. It does not infer a price or include a line. |
| `question.events[]` | `{id,questionId,version,kind,authorRole,body,projectRevision,createdAt,reviewToken}`. Versions increase within a thread; project revisions order all events across threads. |
| `project.questionEventIndex[]` | Repository-owned append-only `{id,questionId,projectRevision}` references. Loading checks these against all thread events so an accidentally omitted thread or event fails visibly. |
| `draft.questionScope` / `quote.questionScope` | `{version:1,projectRevision,questions:[exact thread snapshots]}`. This includes informational and resolved questions, their original contexts, all events through the recorded revision, and scope-entry links. |

| Event | Allowed author / prior state | Result / next owner |
| --- | --- | --- |
| `opened` | Buyer; explicit new question | Open / seller |
| `clarification` | Seller; any unresolved state | Waiting on buyer / buyer |
| `buyer-reply` | Buyer; Waiting on buyer | Waiting on seller / seller |
| `answer` | Seller; any unresolved state | Answered / seller, pending explicit disposition |
| `resolved` | Buyer or seller; Answered only; rationale required | Resolved / no outstanding owner |
| `reopened` | Buyer or seller; Resolved only; reason required | Open / seller |

The demonstration supports up to 24 questions, 60 events per question and 4,000
characters per body or rationale. A thread's original text, source, blocking
classification and scope link cannot be edited after confirmation. Later work is
an attributed event, never a replacement of the opening record.

## Domain and repository API

Pure helpers live in `src/product-room/question-domain.js`. The existing local
project adapter includes `supportsQuestions: true`; external adapters must opt in
and preserve the full records.

| Operation | Input / result |
| --- | --- |
| `reviewQuestion(project, input)` | `{requestItemId,body,blocking}` → reviewed buyer opening packet. |
| `reviewQuestionReply(project, input)` | `{questionId,authorRole,kind,body}`, where kind is `answer`, `clarification` or `buyer-reply` → reviewed reply packet. |
| `reviewQuestionResolution(project, input)` | `{questionId,authorRole,body}` → reviewed resolution packet, requiring Answered. |
| `reviewQuestionReopen(project, input)` | `{questionId,authorRole,body}` → reviewed reopen packet, requiring Resolved. |
| `repository.reviewQuestion*` | Convenience wrappers for the same reviews against a freshly loaded `projectId` and input. |
| `repository.confirmQuestion(review, {confirmed:true})` | Confirm the opening and return the updated project. |
| `repository.confirmQuestionReply(review, {confirmed:true})` | Append only to the reviewed question and return the updated project. |
| `repository.confirmQuestionResolution(review, {confirmed:true})` | Append the explicitly attributed resolution. |
| `repository.confirmQuestionReopen(review, {confirmed:true})` | Append the reason and reopen; retain all earlier history. |
| `questionState(question)` | `{status,ownerRole}`; status is `open`, `waiting-on-buyer`, `waiting-on-seller`, `answered` or `resolved`. |
| `questionStatusLabel(question)` | Readable status without an acceptance claim. |
| `pendingBlockingQuestions(project)` | Unresolved threads with `blocking:true`; Answered is still unresolved. |
| `adoptCurrentQuestions(project, draft)` | Pure explicit adoption of all current question evidence. Returns a new draft and updates its project revision; does not save or issue it. |
| `quoteQuestionErrors(project, draft)` | Field-level evidence, source-link, current-history and unresolved-blocker checks. |
| `assertQuestionsRepository(repository)` | Reject unsupported adapters before a write. |
| `assertQuestionRoundTrip(review, returnedProject)` | Reject missing or changed question, event, attribution, source or history after confirmation; validate the returned project revision, required records, dates and exact originally reviewed inquiry before either workspace installs it. |
| `assertQuestionScopeRoundTrip(expectedDraft, savedDraft)` | Reject an adapter that drops or changes quotation evidence. |

The existing `getQuoteDraft`, `saveQuoteDraft`, `reviewQuote` and `issueQuote`
retain and check `questionScope`. A draft copied from a quote starts with that
quote's exact evidence. If the previous quote predates questions, its later draft
initially has an empty historical snapshot; the seller must explicitly adopt the
new questions. A pre-question saved draft remains recoverable after the first
question is added, but its next save requires evidence adoption. An unrelated
project revision does not by itself require adopting identical question history.

`compareQuotes` compares frozen question snapshots, including changed events and
whether the seller confirmed or the buyer acknowledged the resolution. It never
renders an old quotation using today's question state. Existing option preference,
request disposition and commercial change/clarification gates still apply.

## Consistency and recovery

Reviews bind the project revision, exact source, target question, thread event
count, author role, action and body. All confirmations use the existing project
transaction and optional Web Lock. Repeating an already confirmed token returns
the saved project without another event. A change in another tab invalidates the
old review and leaves the saved quotation draft and caller's unsent input intact.

Loading replays every event against its reviewed prior state, checks the event
index and original request source, validates each quotation against the historical
cutoff at issue, and compares issued evidence to its review. Corrupt or incomplete
data fails as `STORAGE_CORRUPT` without replacing the browser store. Storage failures
leave prior records untouched. These tokens are consistency checks for a local
demo, not signatures or a substitute for server authorization and durable storage.

Errors follow `ProjectError`, including `CONFIRMATION_REQUIRED`, `STALE_REVIEW`,
`CONFLICT`, `VALIDATION`, `QUESTION_REVIEW_REQUIRED`, `UNSUPPORTED_QUESTIONS` and
`QUESTION_DATA_LOSS`. Existing legacy projects keep their single project-level
clarification behavior and their prior record shape; there is no automatic
conversion of `messages` into question threads.

Focused tests are in `tests/runtime/questions.test.js`. They cover independent
sources/ownership, attribution, separate resolution, reopen history, scope and
next-step blockers, informational questions, exact v1/v2 evidence, explicit
adoption, stale tabs, repeated confirmation, storage failure, adapter data loss,
load corruption and legacy behavior. Runtime tests do not establish visual,
mobile, customer, performance or publication acceptance.
