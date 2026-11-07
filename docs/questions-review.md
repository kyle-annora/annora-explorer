# Independent component questions — delivery review

W30 · November 6, 2026 · Candidate; target publication is recorded separately.

The same crank project now carries several independent component questions from
buyer clarification through reviewed seller responses and quotation scope.
An answer does not automatically resolve a question. Original inquiry details,
earlier replies and issued quotations retain their exact historical meaning.

## One review path

Start in [the crank Product Room](https://kyle-annora.github.io/annora-explorer/product-room/?optionDemo=crank-options-v1).
Use the same browser for buyer/seller switching. An existing comparison project
is retained; a fresh browser receives the same fictional starting project.

1. Confirm a support preference if this is a fresh example. Under **Project
   questions**, ask about **Connecting rod**, review and confirm. Add a separate
   question about **Linear guide**. Each has its own source and next owner.
2. **View as seller**. Reply to one question, review and confirm the reply. It
   becomes **Answered**. Separately review a resolution note and confirm
   **Resolved**. The other question remains open.
3. Prepare a quotation and classify its request scope. An unresolved
   scope-affecting question blocks issue even when the request is marked Included.
   Return to questions; request clarification on the other component, switch to
   buyer and confirm an answer, then have the seller answer and resolve it.
4. Continue the saved quotation. Review and explicitly adopt the current question
   evidence. Its original request links to the relevant quote lines. Review the
   complete customer-facing quotation before issuing v1.
5. Reopen a resolved question as buyer, with a reason. Have the seller answer and
   separately resolve it. A v2 draft keeps v1's evidence until explicit adoption.
   Review and issue v2, then compare versions. v1 still shows its old answers and
   resolution; v2 shows the additional work.

Informational questions can remain open without blocking quote issue; their open
state remains visible in the frozen quotation. Seller-confirmed resolution is
attributed to the seller and never presented as buyer acceptance. A buyer can
acknowledge an answered question instead. The question's scope classification is
explicitly chosen and reviewed at creation.

## Scope and implementation

- Additive question records and append-only events use the existing project
  repository and transaction boundary. API operations and capability checks are
  documented in [the contract](questions.md).
- One compact list opens one thread at a time. Original context, chronological
  activity and quotation evidence remain distinguishable. No global navigation
  or Explorer rendering behavior was added.
- Unconfirmed edits protect role switching, project navigation and unloading.
  Conflicting updates require a fresh review while keeping entered text. Stored
  question selection survives reload and returning from the original 3D detail.
- Quotation snapshots explicitly adopt current question evidence; no reply
  silently changes price, disposition, original inquiry or an earlier quotation.
- Ordinary projects with saved request items also support question evidence,
  including quotation adoption without an approved option set. Old projects
  retain their existing project-level clarification workflow.

## Design decisions

| Decision | Evidence / reason |
| --- | --- |
| Keep current tokens and compact rows | Existing Annora OptionComparison, QuoteScopeEditor and [Studio design](studio-design.md) remain the visual authority. |
| Separate the question from its activity | [Linear issue activity](https://refero.design/pages/13774021-f998-4003-849d-ad1533489547), inspected via Refero, distinguishes context from chronological updates. Only that narrow pattern is borrowed. |
| Reply, resolution and reopening are distinct reviewed actions | User requirement and F6a acceptance: answering one component question cannot close another or imply acceptance. |
| One expanded thread, optional reference/history disclosures | Preserve scanability and the existing mobile interaction pattern without another row of tabs. |
| Identify the next responsible role in the existing project status | Multiple questions need aggregate ownership; the question itself still carries its individual state. |

## Validation and limitations

Final candidate verification passed: 856 tests, 855 passed, one existing skip,
zero failures. Asset checks, the production build and the separate inquiry bundle
also passed. The complete W30 path passed 18 checkpoints at each of 1280, 390 and
320 pixels. The original commercial walkthrough passed 21 checkpoints and eight
confirmation gates per desktop/mobile/compact profile.

See [acceptance evidence](evidence/questions/acceptance.json) for candidate checks,
viewports, preserved records and regression results. Target commit, workflow and
observed public assets belong in [the release receipt](evidence/questions/release-receipt.json)
after publication.

Verification caught and corrected a seller projection bug: a confirmed question
action returned the shared project without the seller-only saved-draft summary,
causing **Continue quotation** to disappear. The host now reloads and validates the
seller projection after confirmation. Ordinary projects initially lacked a way
to adopt updated question evidence; that control now works independently of
option comparison. The adapter guard also rejects malformed returned project
envelopes before installing them into either workspace.

All data remains fictional and browser-local. There is no backend, email,
authentication, cross-device sharing or automatic pricing. Roles describe demo
attribution, not access control. Questions are bounded to original saved request
items; this release does not implement W31 source-change impact review, W32
analytics, attachments or arbitrary new CAD references. Browser tests use
responsive emulation and do not establish physical-device performance.
