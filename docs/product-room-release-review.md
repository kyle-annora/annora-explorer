# Product Room commercial journey — release review

Date: November 1, 2026. Scope: the crank-slider customer journey, shared UI and
browser-local demonstration records. Studio, real delivery and the Explorer
renderer are outside this change.

## Review

Start at [Product Room](https://kyle-annora.github.io/annora-explorer/product-room/).
Choose Request a quote and Use sample details. Review and confirm the inquiry,
open the sample quotation, request a change, review the sample changes and
explicitly open the sample reply. Compare v2 with v1, then review and confirm a
next-step request. Return through My projects or reload to inspect retained history.

The [component catalog](https://kyle-annora.github.io/annora-explorer/product-room/#components)
uses the actual workspace controls. Fixed appearance samples are identified;
validation, failed saves, pending state and recovery can also be exercised.

## Checked locally

- `npm run verify`: 341 tests passed; configuration validation and production build passed.
- Complete desktop journey checked against built output served at the actual
  `/annora-explorer/product-room/` path, not only the development server.
- Inquiry, change and next-step forms each require read-only review and explicit
  confirmation. Old RFQ and v1 data remain byte-for-byte unchanged after v2.
- Old quotation versions are read-only and point to the latest quotation for action.
- Saved projects, quotation versions, confirmed changes and requests survive reload.
- Storage failures retain input and block inaccurate page/product/history changes.
  Re-enabling storage lets the same draft continue; no false success is shown.
- A deliberately delayed submission is saved once. Navigation waits for it without
  a late result redirecting the customer away from the requested destination.
- Invalid project URLs show recovery, not a previously displayed customer's project.
- The selected 3D part is reference context only. Opening an inquiry does not
  automatically confirm a requirement. Returning retains the same iframe.
- Complete browser flows at 360 × 800 and 320 × 740 passed, including v2 comparison,
  final review and reload. Layout/catalog checks also covered 844 × 390 landscape
  and 1440 × 1000 desktop. The initial 320px header overflow was corrected.
- Keyboard tab navigation and validation focus work. Pending shared buttons keep
  focus and width, announce their pending label, and reject repeat activation.
- No browser page errors were recorded in the completed checks.

Evidence records are in [evidence/product-room-commercial](evidence/product-room-commercial/).
The unit-test assertions include immutability, duplicate handling, stale reviews,
version-bound changes, original unanswered questions, storage failure/corruption
and optimistic concurrency.

## Performance and preserved experience

`src/explorer/` and model packages are unchanged. Direct project entry downloads
no model assets and creates no iframe. Opening Explore creates one iframe, retained
across Room destinations; hidden operation/tour playback is paused.

The new commercial workspace is a lazy chunk, approximately 299 KB JavaScript /
92.5 KB gzip plus 28 KB CSS / 5.6 KB gzip. Reading pages and standalone Explorer do
not require it. This is a transfer-size and lifecycle check, not an FPS benchmark
on a physical phone or an entry-level computer.

## Boundaries

All prices, replies and lead-time alternatives are fictional examples. Unknown
costs are unpriced and the final total remains pending. Customer requests do not
constitute supplier approval, an order or acceptance. Nothing is sent.

Records live in the current browser. Project URLs are not private shared links;
there are no accounts or cloud synchronization. Inquiry drafts persist;
unconfirmed revision/next-step forms are session-only and guarded before leaving.
The repository API is documented for a later host service, not implemented as a
production backend. Studio remains deferred.
