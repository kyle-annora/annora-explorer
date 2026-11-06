# Contextual request items

Request items collect independent questions during the existing floating inquiry.
They do not add a mandatory inquiry step or automatically create priced quote
lines. One reviewed inquiry can contain up to twelve references.

## Buyer and seller flow

1. Open an inquiry from the current model selection or drawing detail.
2. Choose Add current view or Add current detail. Browsing alone never adds or
   changes a reference.
3. Choose Ask a question, Request a change or Request technical review, then
   describe the request. Only one item editor expands at a time.
4. Minimize the inquiry to inspect another part, or select another drawing
   detail. Resume the same draft and explicitly attach the new reference.
5. View reference returns to that item's saved context after pending edits save.
   Remove request affects the draft only.
6. Review the complete inquiry and every request. Confirm separately. Editing an
   item invalidates any earlier review.
7. The saved buyer project and Studio inquiry show the same list. Each reference
   can reopen its exact saved model or drawing context. The seller still decides
   what belongs in quotation scope.

Existing single-reference inquiries continue to work without any request items.
All data in this starter remains local fake/demo data; there is no server send,
account service or cross-device synchronization.

## Stored shape

The additive `requestItems` field is optional on a draft and on its confirmed
`project.inquiry` snapshot:

```js
requestItems: [{
  id: "stable-request-id",
  purpose: "question", // question | change | review
  notes: "Can this mounting detail support the requested fixture?",
  context: { /* existing normalized ProjectContext, captured for this item */ }
}]
```

Each context retains its own selected part, drawing/document reference, revision,
page/region, overview version and saved inspection where available. Different
source drawing revisions may be discussed within one collection. Product,
geometry revision, product release and inquiry profile must still match the
inquiry. Stable item identities cannot be duplicated. Notes are bounded at 2,000
characters and must be nonempty before review.

Selection changes cannot rewrite an attached context. Confirmed inquiry snapshots
remain immutable when a seller creates another quotation or a later source
revision is published. Request-item identity is separate from quote-line identity.

## Host and API seam

The local repository opts in with `supportsRequestItems: true`. A custom host
adapter must explicitly opt in only after preserving the full field on save,
load, review and confirmation. The session rejects a save or confirmation result
that silently drops or changes the list. Legacy adapters omit the capability and
retain their existing single-context behavior.

The inquiry session exposes `addRequestItem`, `updateRequestItem`,
`editRequestItem`, `removeRequestItem`, `restoreRequestItem` and
`getRequestItemContext`. The same save queue and leave protection apply. Capture
must finish successfully before attachment; failure does not replace existing
items. Restoration waits for the save boundary and reports a failure without
moving the model or dismissing the panel.

Seller reopen links carry both `project` and `requestItem`. The host resolves the
item from the saved project rather than accepting arbitrary untrusted context in
the URL. Exact reference validation remains in the existing model/drawing host.

## Verification

`tests/runtime/request-items.test.js` covers per-item identity and revision,
legacy records, snapshot persistence, validation, adapter loss, failed saves,
review invalidation and guarded restore. Compiled buyer/seller and mobile results
are recorded in the phase-one product expansion delivery record.
