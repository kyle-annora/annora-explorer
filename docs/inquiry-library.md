# Client-local inquiry integration

This build reuses the existing floating inquiry and session in another local
application. It is a bounded integration artifact, not a published SDK or a
backend. A client supplies its repository, viewer adapter and product context.
The client remains responsible for the meaning of its records and confirmation.
An engineering brief must not be presented as a commercial quotation.

## Build and vendor

From the Explorer repository:

```sh
npm run build:inquiry
```

The separate `vite.inquiry.config.js` produces these ignored files:

```text
dist-inquiry/inquiry.js
dist-inquiry/inquiry.css
dist-inquiry/LICENSES.txt
dist-inquiry/manifest.json
```

Copy all four into the client's isolated candidate, for example
`src/vendor/annora-inquiry/`. Import the JavaScript and stylesheet through that
client's bundler. React and React DOM are external dependencies; the artifact
manifest records the exact versions used by this source. The initial integration
uses the client's existing React 19.3.1 and React DOM 19.3.1. Other UI dependencies
are bundled and their redistribution notices accompany the artifact.

The manifest records the base source commit, hashes of the actual source files,
an aggregate source-tree digest, dependency versions, and JavaScript/CSS hashes.
The source-tree and output hashes identify local changes beyond that base commit.
Keep the manifest with the copied artifact; a copied file alone is not evidence
that a client candidate was built or released.

This configuration does not run the model preparation, presentation-asset or
normal multi-page build plugins. A build-time boundary rejects model content,
generated catalogs, the Three.js and PDF runtimes, and Studio UI modules. The
pure `src/studio/value.js` JSON/fingerprint helper is permitted. No product,
drawing, photograph or customer asset belongs in this library.

## Mount the shared surface

```jsx
import React from 'react';
import {
  mountEmbeddedInquiry,
  createInquiryDraft,
  normalizeInquiryDraft,
  normalizeInspectionReference,
} from './vendor/annora-inquiry/inquiry.js';
import './vendor/annora-inquiry/inquiry.css';

const panel = await mountEmbeddedInquiry(mountElement, {
  repository: clientRepository,
  context: productContext,
  onCapture: captureSupportedView,
  onRestore: restoreSavedView,
  onProject: openExactSavedBrief,
  onState: updateHostControls,
  onClose: returnToExploration,
  allowAnother: false,
  presentation: {
    fixedIntent: 'application-review',
    fields: ['application', 'notes', 'name', 'company', 'email'],
    fieldLabels: { application: 'Handling objective' },
    showScope: false,
    labels: {
      eyebrow: 'APPLICATION BRIEF',
      detailsTitle: 'Describe your application.',
      reviewTitle: 'Review your application brief.',
      confirmedTitle: 'Brief saved.',
      reviewButton: 'Review application brief',
      confirmButton: 'Confirm application brief',
      receiptTitle: 'Your brief and view are together.',
      receiptDescription: 'Open your project to review this saved brief.',
      receiptNote: 'Synthetic local brief. Nothing has been sent.',
      openProjectButton: 'Open brief',
      resumeLabel: 'Continue your brief',
      savedLabel: 'Brief saved',
    },
    renderReview: ({ review }) => React.createElement(Brief, {
      payload: review.clientPayload,
      questions: review.openQuestions,
      compact: false,
    }),
  },
});

await panel.open({ context: productContext, opener: entryButton });
```

The library entry requires an explicit repository; it never silently falls back
to Annora's browser store. The optional presentation configuration changes the
surface, not the client's validation or persistence rules. Omitted configuration
retains the standard inquiry interface.

`fields` accepts the supported field IDs from `inquiry-profile.js` and must
include `application`. Omitting `quantity` requires a fixed `application-review`
intent. `fieldLabels` changes the corresponding input labels. A fixed intent
hides the purpose chooser; it does not rewrite an existing draft. A mismatched
saved intent remains visible as an error and cannot proceed to confirmation.

The complete label vocabulary and defaults are in
`src/product-room/inquiry-presentation.js`. Unknown label names fail at mount.
`renderReview` receives the actual prepared packet and its standard draft. It
must render the complete client record and any open questions that confirmation
will preserve. Returning no content or throwing prevents confirmation; Edit
details remains available so the customer can retry. Host code must not mutate
the reviewed packet or substitute newer live data while rendering it.

## Repository and record contract

The surface uses these asynchronous methods. A synchronous local repository can
be wrapped with `async` methods without artificial delays.

| Method | Required behavior |
| --- | --- |
| `getDraft(context)` | Return the existing exact draft, or a new standard draft. A read must not confirm a record. |
| `saveDraft(draft)` | Persist incomplete input, check its revision, and return the normalized draft with its current revision and timestamp. |
| `prepareInquiryReview(savedDraft)` | Optional: prepare the client's existing complete review record. Return a JSON packet with a nonempty `token` and a `draft` exactly equal to `savedDraft`. |
| `submitInquiry(review)` | Validate the exact reviewed packet and current source revision, then perform the client's explicit confirmation. Return the project-shaped receipt below. |

Start a new fixed-intent draft with the shared constructor:

```js
const draft = createInquiryDraft(productContext, stableDraftId);
draft.values.intent = 'application-review';
draft.values.quoteScope = 'discuss';
```

The standard shape is:

```js
{
  id: 'client-draft-id',
  revision: 0,
  inquiryRulesVersion: 'inquiry-intent-v1',
  context: productContext,
  values: {
    intent: 'application-review', quoteScope: 'discuss',
    application: '', quantity: '', targetWeeks: '', stroke: '', load: '',
    notes: '', name: '', company: '', email: '',
  },
  requirements: [],
  updatedAt: null,
}
```

Use strings for input values. A new unpersisted draft has revision zero; a saved
draft has a positive integer revision and a valid timestamp. Map the client's
existing draft/version identity consistently and preserve fields outside the
compact form. Do not create a second commercial store alongside a client brief.
For example, `application` may project the client's `objective`, while contact
fields project its existing contact object. The adapter must also preserve the
reference in the client's own draft and confirmed snapshot.

Every context needs `productId`, `productTitle`, `modelId` and exact
`modelRevision`. Optional `part`, `chapter`, `document`, drawing and inspection
references must pass the shared normalizers. Do not invent Room release metadata
for an unrelated client. If Room release/profile fields are supplied, their full
saved snapshot is required and validated.

The default review operation remains `saveDraft` followed by `reviewInquiry`.
With a client hook, the session first saves and validates the standard draft,
then awaits `prepareInquiryReview`. One suitable packet is:

```js
{
  token: clientReview.token,
  draft: savedStandardDraft,
  clientPayload: clientReview.payload,
  openQuestions: clientReview.openQuestions,
  clientReview: {
    projectId, token: clientReview.token, draftVersion, payloadDigest,
  },
}
```

The session stores this packet without replacing its token or extra JSON fields.
Confirmation forwards that same packet to `submitInquiry`. It does not call the
preparation hook again. Editing invalidates the review and requires a new
preparation. The adapter must not prepare a different, unseen client review
inside `submitInquiry`.

Return this minimum presentation shape after successful confirmation:

```js
{
  id: clientProject.id,
  context: reviewedContext,
  inquiry: { values: reviewedStandardValues },
  // Optional client-owned data, forwarded unchanged to onProject:
  clientReceipt: { projectId, snapshotId, revision, operationId },
}
```

Use `clientReceipt` to open the exact confirmed brief/PDF revision. Repeating the
same review and operation must return the same receipt, including after reload.
The session suppresses repeated confirmation within its lifetime; the repository
must enforce idempotency across sessions and retries.

## Saving, conflict recovery and lifecycle

Errors use `code`, `message` and optional `fields` keyed by standard input name.
The adapter should translate client errors at its boundary:

| Situation | Code |
| --- | --- |
| Stored draft changed before save | `CONFLICT` |
| Stored source changed after review | `STALE_REVIEW` |
| Storage could not persist input | `STORAGE_UNAVAILABLE` or another actionable storage code |
| Invalid user values | `VALIDATION`, with `fields` where applicable |

Failed save/review/confirmation retains the local input. `CONFLICT` and
`STALE_REVIEW` offer an explicit Load saved draft choice. Only the customer's
Replace with saved draft action reloads it. The adapter's `getDraft` must then
read the latest source, rather than returning stale cached data. If that draft
was submitted or removed, report unavailability; do not silently create a new
draft to resolve a conflict.

The returned panel API is:

| Method | Meaning |
| --- | --- |
| `open({context, opener, stage, suggestedIntent, suggestedScope})` | Open or resume. `stage:'review'` prepares a fresh review only; it never confirms. Pass the actual entry button before disabling it. |
| `beforeLeave()` | Await loading/actions/saves; return `false` if saving failed. Gate page, model, role and project changes on this result. |
| `getContext()` | Read the pinned attached reference, independently of live selection. |
| `minimize()` / `resume()` | Save and collapse, or expand the retained surface. |
| `review()` / `confirm()` | Separate explicit actions. Confirmation also requires a displayed, available review. |
| `openProject()` | Open the confirmed receipt through the host callback. |
| `suspend()` | Hide only; call after successful `beforeLeave`. It retains the session. |
| `dispose()` | Flush and unmount; return `false` on failed saving. |

`onState` reports `open`, `expanded`, `busy`, `hasDraft`, `draftId`, `stage`,
`status`, `projectId` and `errorCode`. The host owns routing, viewport space and
global keyboard precedence. The panel owns its focus and scroll area. It does
not change browser history or scroll the window.

One adapter and mounted session must own one selected client project. Shared
context identity contains product/model/release/drawing identity, not an
arbitrary client's project ID. Switching between two client projects for the
same product requires saving and disposing the old session before mounting the
new project's adapter. Similarly, dispose before the client's existing full-page
editor edits that same draft; reopen from the repository afterward. Hiding two
active editors is not sufficient isolation.

## Public viewer boundary

Viewer callbacks exchange bounded JSON only. They must validate model identity,
pause supported playback, wait for settled state, and reject incompatible or
unavailable views without replacing the attached reference. Live selection never
updates a draft automatically; Use current view is deliberate adoption.

For an older viewer with the existing `captureView`/`restoreView` contract, a
supported free Explore view can be wrapped as follows:

```js
const inspection = normalizeInspectionReference({
  version: '1', model: bookmark.model, view: bookmark,
});
// Restore through the client's public controller:
await client.request('restoreView', { bookmark: inspection.view });
```

An inspection preview image is optional. This wrapper does not add orbital or
spatial-presentation capture support. Enter a supported Explore surface explicitly
when the existing controller cannot capture the displayed presentation. Do not
read iframe DOM, copy a renderer into the host, or describe that transition as
preserving an unsupported orbital pose.

## Verification boundary

Run `npm run verify` for changes to the shared source and `npm run build:inquiry`
for the transferable artifact. `tests/inquiry-bundle.test.mjs` checks the actual
independent build, external imports, source/output hashes and excluded assets.
`tests/runtime/inquiry-client-adapter.test.js` checks exact review packets,
separate confirmation, edit invalidation, failed preparation and presentation
constraints. Existing session/Room/walkthrough tests retain the default behavior.

Each client still needs its own adapter tests and desktop/mobile browser replay:
unknown input, draft resume, explicit reference replacement, save failure, stale
source, exact review, repeated confirmation, historical revision and PDF return.
Build/deployment receipts and human comprehension remain separate evidence.
