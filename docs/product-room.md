# Product Room

Product Room is a static host around the existing Explorer. It combines product
explanation, approved sample facts and technical documents with a demo request
flow. The standalone Explorer remains the shared renderer and player; Studio is
deferred until this Room implementation has been reviewed.

## Open the Room

With `npm run dev`:

- `http://127.0.0.1:8095/product-room/` — default crank model and Explore view.
- `http://127.0.0.1:8095/product-room/?model=kinetic-01#overview`
- `http://127.0.0.1:8095/product-room/?model=kinetic-01#specs`
- `http://127.0.0.1:8095/product-room/?model=apollo#explore`

The GitHub Pages route is
`https://kyle-annora.github.io/annora-explorer/product-room/`.
Publication and final browser results must be verified against the deployed
revision; the route alone is not evidence of a successful deployment.

## Three destinations

| Destination | Purpose |
| --- | --- |
| Explore | Default entry, with the existing full Explorer interface and its authored actions |
| Product overview | Explain the product through short buyer questions and relevant story/part entry points |
| Specs & documents | Group source-backed demonstration facts and provide sample printable technical briefs |

The `model` query selects a prepared example. The Room and embedded model must
agree before the host attaches a component or chapter to a request. A model change
must not reuse the previous model's node IDs, capabilities or draft identity.
Apollo has a structural tour, not an authored operating mechanism; its controls
must reflect that distinction.

Sample product content is authored in `src/product-room/content.js`. The linked
technical briefs in `product-room/files/` are illustrative, printable HTML
documents. They are not manufacturer-certified data sheets or confidential
customer drawings. Overview images are captures of the existing Explorer; their
model attribution is the same source attribution shown in each Room.

Only Room samples matching configured model IDs are offered. If a template user
removes both sample models, this route shows a configuration message and an
Explorer link rather than associating sample facts with an unrelated model.
A new product needs its own reviewed Room content; it is not inferred from CAD.

## Request semantics

`createRequestFlow` owns a native dialog, with a pure state module enforcing the
details, review and confirmation sequence:

1. **Details:** enter one question/application and a next-step purpose. Name and
   email are optional in this demo. Product context is visible; part, document and
   chapter attachments can be removed.
2. **Review:** display the exact message, contact details and attached context.
   `Edit details` returns to the draft. The final confirmation action appears only
   on this screen.
3. **Receipt:** `Confirm demo request` creates a local, in-memory sample reference.
   The result explicitly says nothing was sent. Repeated confirmation cannot create
   a second receipt for the same reviewed request.

No request is transmitted, uploaded or written to local storage. Drafts survive
closing the panel only within that page instance. Reloading or disposing the host
discards them. Drafts are isolated by product, model and exact model revision.

If a visitor reopens an older draft from a different selected component, the old
message retains its original context. A visible `Use current context` action makes
replacement explicit. A previously reviewed request returns to Details when the
new opening context differs, so a new selection cannot silently cause confirmation
of an older question.

The host pauses playback before opening the request. Closing restores keyboard
focus and must not automatically resume the model. Escape closes the native
dialog; clicking its backdrop does not discard the draft.

## Integration boundary

The Room uses the existing public iframe client and JSON controller. It does not
access private Three.js objects or introduce a second animation loop. See
[integration](integration.md) and [API](api.md) for command and lifecycle contracts.

- Keep one active WebGL instance. Pause inactive presentation work and dispose a
  replaced instance through the existing lifecycle.
- Read authoritative model revision and selection before creating part context.
  Labels are display text, not stable cross-revision IDs.
- Use tour/chapter references to identify authored explanations. The current
  bookmark API does not capture arbitrary running-tour poses.
- Keep existing pause, replay, seek, takeover, quality profiles, rendering styles
  and model capability restrictions intact.
- Model loading/failure should leave overview and documents usable.

There is no backend, account, durable link store, shared discussion, CRM integration
or real request delivery. The iframe handshake is routing validation, not private
asset access control. Only redistributable sample content belongs in this public
deployment.

## Acceptance walkthrough

Run `npm run verify`, serve the resulting `dist/` through HTTP under the repository
subpath, and inspect the following before release:

| Check | Expected result |
| --- | --- |
| Open the default Room | Explore opens with the crank model; no introductory gate is required |
| Visit Overview and Specs | Clear content grouping; technical briefs open; returning to Explore remains coherent |
| Switch to Apollo | Room title, facts, documents and inquiry context match Apollo; no unsupported operation is offered |
| Choose a buyer question | The intended supported part or authored chapter opens in the existing Explorer |
| Select a part, open a request | Visible product and part context, with exact revision retained internally |
| Submit empty details | Inline validation; no receipt or final action bypass |
| Review then edit | Entered message and context remain intact |
| Confirm the reviewed request | One clearly labeled demo receipt; no network delivery |
| Close and reopen a draft | Same-product draft restored; new selection does not silently replace context |
| Reload | No claim of saved account data; in-memory draft is gone |
| Phone widths 320–390 px | Navigation, document actions, form, errors and review confirmation remain reachable |
| Landscape height | Dialog and content remain scrollable; controls are not trapped under fixed panels |
| Keyboard | Visible focus, native dialog containment, Escape and focus return work |
| Model/asset error | Useful fallback/retry; factual content and documents remain accessible |
| Standalone Explorer | Original routes and interactions remain unchanged |

Report actual viewport/device dimensions and measured results separately. A desktop
browser in a narrow iframe is a responsive-layout check, not physical phone GPU
testing. Synthetic sample content cannot establish product performance or sales
conversion claims.

## Current limitations and next phase

The Room presents prepared model packages and demonstration knowledge. It does not
convert arbitrary CAD, infer mechanical constraints, edit source geometry, or
automatically verify technical statements.

Studio remains the next phase: content editing, part/document association, authored
story preparation, preview and explicit release review. Its future authoring model
is documented in [the Product Room and Studio proposal](product-room-studio-proposal.md).
It must continue to use the shared runtime and validated package boundary.

## Release evidence

The release is published through the existing GitHub Pages workflow. The deployed
commit and workflow result are available in the repository Actions history.

Local release checks on November 1, 2026:

- `npm run verify`: 321 tests passed, configuration validation and production build passed.
- Built site checked at the real `/annora-explorer/product-room/` repository subpath.
- Desktop flow: overview question → authored chapter → pause → request details →
  review → edit/remove context → confirm → explicitly demo-only receipt.
- Apollo and crank selection checked from both the Room and the retained iframe.
  Switching products on a reading page cannot attach the old model’s component.
- Responsive checks: 390 × 844 and 320 × 740 portrait, plus 844 × 390 landscape.
  Narrow-phone document request completed through review and confirmation.
- Technical briefs are real downloadable/printable HTML assets; package reference
  tests verify every content target and source-backed sample value.
- `src/explorer/` remains unchanged. One iframe is retained across Room pages;
  active tour, operation and separation playback are paused before leaving 3D.
- No additional rendering dependency. Room script is approximately 33 KB before
  compression; the existing Three.js bundle loads only with the embedded Explorer.

These are desktop-browser responsive checks, not measurements on a physical
phone or an entry-level GPU. Apollo retains its existing larger asset download.
Requests are demonstration records only; no account or backend delivery exists.
