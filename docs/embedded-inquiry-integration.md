# Integrate the shared in-context inquiry

The same floating presentation and headless session now serve the standalone
crank Explorer, Product Room, the walkthrough and prepared drawing previews.
Each host owns navigation and its repository; the panel owns only its request
session and local presentation. This is a source integration boundary, not a
published package or compatibility claim for arbitrary third-party viewers.

## Host contract

Lazy-load `src/product-room/embedded-inquiry.jsx` when a request is opened:

```js
const { mountEmbeddedInquiry } = await import('./embedded-inquiry.jsx');
const panel = await mountEmbeddedInquiry(mount, {
  repository,                 // Supply this host's existing async repository.
  onCapture: captureContext,  // Return a validated, exact snapshot; may reject.
  onRestore: restoreContext,  // Reopen the saved snapshot, never the latest source.
  onProject: openProject,     // Navigate only after successful confirmation.
  onState: updateHostChrome,
  allowAnother: true,
});
await panel.open({ context, opener, suggestedIntent: 'application-review' });
```

`context` is a domain reference, not a Three.js object. It contains product/model
identity and revision, the reviewed product release and optional selected part,
chapter, inspection or drawing snapshot. Use existing constructors rather than
assembling partial version fields from visible labels.

| Host | Context boundary | Repository |
| --- | --- | --- |
| Standalone crank | `captureInspection` + `attachInquiryRelease` | Ordinary demo project repository |
| Product Room | `viewer.context({includeInspection:true})` + exact `contextForRelease` | Room's existing repository |
| Walkthrough | Same Room controller, pinned bundled content | Isolated walkthrough session repository |
| Studio preview | Same reviewed preview context | Preview-only in-memory repository |
| Drawings | `createDrawingContext` + `resolveReferencePreview` | Existing drawing project repository |

Never use the panel's default repository for a drawing, preview or walkthrough
host. These namespaces intentionally remain separate. Importing the floating
surface does not authorize merging or migrating existing projects.

## Navigation and lifecycle

- `open` resumes the same saved draft for a product/version. A newly selected
  region within that version does not silently replace its attached reference.
- `onCapture` runs only for explicit reference adoption or deliberate new inquiry.
  It must reject unsupported or unsettled state. Paused timeline and free 3D
  inspection are supported; orbital inspection is not yet supported.
- `beforeLeave()` returns false on failed persistence. Await it before product,
  source, route or role changes. Keep both the URL and product selector consistent
  with the retained draft when leaving is refused.
- `minimize()` saves and lets the user explore. `resume()` reopens the current
  panel. Keep an accessible host resume action on narrow screens where the
  minimized badge would cover model or drawing controls.
- `suspend()` hides the panel after a successful leave check. `dispose()` saves
  before releasing its React root; it can also refuse. Do not keep an older
  hidden editor active beside a second editor for the same draft.
- `getContext()` returns the attached context, not the host's live selection.
  `onRestore` must restore it exactly or report that its source is unavailable.
- `onState` exposes open/expanded/busy, draft/project IDs, stage, save status and
  error code for chrome. It does not expose domain mutation shortcuts.

The existing Product Room and drawing host helpers cover lazy-open races and
their route-specific behavior. Model browsing remains available in the same
renderer. Layout changes reserve space once; typing does not reframe the camera.

## Presenter actions and confirmation

Product Room preserves `#inquiry` and `#inquiry&stage=review`, showing the model
with the floating request. Its `buyer-workspace` action owns Continue demo while
the request is open. `buyer-viewer` owns the earlier mechanism demonstration.

`review({fillSample:true})` fills only missing fictional sample fields and then
prepares review. `confirm()` is a separate activation and requires the expanded
review. A minimized panel first resumes. A receipt first opens the saved project;
role handoff follows. Conflict recovery never becomes an automatic overwrite.

`allowAnother:false` keeps a walkthrough to one project. Starting a new sample
creates a fresh walkthrough namespace rather than inserting another project into
the current story. None of these presenter helpers sends data to a real seller.

## Version and intent rules

A quotation requires an explicit valid quantity. An application review may leave
it unknown. Seller quotation issue still requires quantity; no UI guesses one.

Drawing capture includes source revision and asset hash, sheet/detail, part,
mapping revision and optional overview snapshot. Overview layout revisions are
independent of engineering source versions. The reference presenter reads only
the attached snapshot. The View action resolves that snapshot through the host.

Review/confirmation and source A→B adoption remain separate. Explicitly adopting
B changes the project's active working reference; it does not mutate the original
inquiry, issued v1 or prior discussions. Each later commercial record carries its
own reviewed reference. The original PDF stays reachable through the reader.

## Required reuse checks

Verify namespace isolation, save failure, cross-tab conflict, minimize/resume,
route restoration, exact source reopen, explicit review/confirmation and old
history. Test 320/390 px and short landscape with real hit testing. Confirm one
renderer, working source assets and the deployment subpath. Human comprehension
and physical-device performance need their own recorded review.
