# Drawing change impact — host contract

W31 adds reviewed working references to the existing drawing-revision workflow. It does not replace the original inquiry, question events, issued quotations or PDF archive. All example data is fictional and browser-local.

## Reference ownership

- The inquiry and each question keep their original exact context.
- `project.activeDrawingContext` identifies the primary reference for new commercial work.
- `project.impactReviews` and its independently checked `impactReviewIndex` are append-only. Each receipt contains the reviewed proposal, decisions, original project and draft revisions, exact published release and confirmation token.
- Each affected question or request scope has its own working reference derived from those receipts. One question can retain A while a quotation scope adopts B.
- `draft.impactScope` and `quote.impactScope` contain the exact reviewed per-record references. An old quotation never reads today's working references.
- Existing drawing source, association and overview identities stay separate. The exact context includes source hashes and any saved overview snapshot. No CAD identity or geometric equivalence is inferred.

## Adapter methods

An adapter explicitly declares `supportsDrawingImpact: true` and implements:

```js
proposeDrawingImpact(projectId, { releaseId, context })
reviewDrawingImpact(projectId, {
  releaseId, context, projectRevision, quoteDraft, note,
  decisions: [{ id, decision, context, reason, lineIds }]
})
confirmDrawingImpact(review, { confirmed: true })
```

The proposal requires a saved seller quotation draft. Findings identify dependent questions and request scope, their original and previous working context, possible target contexts, a classification and a reason. The unrelated handoff question in the SK08 fixture is not listed.

Decisions are explicit:

| Decision | Meaning |
| --- | --- |
| `confirmed` | Use a manually reviewed, published detail from the candidate source for this record |
| `retained` | Keep the previous exact working reference, with the seller's reason |
| `omitted` | Exclude this request scope from the new quotation; never delete the original inquiry or question |

Every scope retained or adopted must reference valid, stable quotation-line IDs. A question cannot be omitted. The question-resolution gate still applies independently; confirming a drawing mapping does not answer an unresolved scope-affecting question.

The server-side equivalent must authorize the seller, resolve the release independently, revalidate its exact identity and compare both project and draft revisions within one transaction. Do not trust client labels or a client-supplied release. The browser implementation uses the existing local transaction boundary and checks repeated confirmation tokens for idempotence.

## Snapshot shape

```js
impactScope: {
  version: 1,
  reviewId,
  projectRevision,
  entries: [{
    id, kind, recordId, label,
    originalContext, context,
    decision, reason, lineIds, authorRole,
    reviewId, reviewedProjectRevision
  }]
}
```

`kind` is `question` or `scope`. IDs are `question:<question-id>` or `scope:request:<request-item-id>`. `context` is the chosen exact reference, or `null` for explicitly omitted scope. The original context remains unchanged. For an already reviewed record, another review starts from its current working reference, not silently from the initial inquiry.

## Review and failure rules

- Matching detail IDs propose a candidate; they do not approve it. Missing/ambiguous details require an explicit choice or retention.
- A changed model revision is outside this adapter. A new CAD model needs a separately compatible capture.
- Changing a question or quotation draft after review invalidates the confirmation. Pending UI decisions remain available for another review.
- A save failure keeps the form and decisions. No success message is shown for a dropped impact snapshot.
- Saving a draft does not issue an offer. The normal full quotation review and explicit issue confirmation remain mandatory.
- Removing a quotation line referenced by reviewed scope blocks issue until its association is reviewed again.
- Loading records validates impact provenance and issued snapshot history. Unknown/corrupt data is preserved and rejected, never reset to the example.

## Prepared example and integration boundary

`?impactDemo=sk08-a-b-v1` uses isolated storage `annora.impact.demo.sk08-a-b-v1`. Normal projects, the crank option example and existing customer records are not seeded or migrated.

A and B are immutable bundled SK08 example releases. B uses the existing `demo-revision-b.pdf`: its first page preserves the original source; its second page rearranges enlarged views and adds a review note. It is a document-layout demonstration, not evidence of revised geometry, dimensions, fits or tolerances. The source files and original PDF remain available through the existing reader.

This delivery covers questions and quotation request scope. Broader impact projection over shared presentations, follow-up steps, arbitrary imported CAD and other products remains a separate increment. Production authorization, durable storage, notifications and cross-device synchronization are not implemented.

Reference links use saved quotation/review identities, not serialized replacement contexts. Unknown or mixed identities fail explicitly; a B link cannot fall back to A. Inline previews show the exact saved drawing; **View part in 3D** opens its saved part in the existing viewer.

The Explorer runtime, drawing renderer and motion remain unchanged. PDF previews load on demand through the existing bounded reader.
