# MK application brief · shared inquiry reuse

This is the Stage 3 reuse handoff for the
[Explorer-to-quotation program](explorer-to-quote-program.md). The dedicated MK
integration is published and verified. The
[progress record](explorer-to-quote-progress.md) owns the complete evidence ledger.

## Review entry and scope

Open the [dedicated MK inquiry preview](https://kyle-annora.github.io/mk-america-demo-preview/inquiry-preview/#/explorer-inquiry?node=discharge).
Its path is `/inquiry-preview/#/explorer-inquiry?node=discharge`, separate from the
existing MK demonstration and from the public Annora template. The client model,
brand assets and engineering-brief content remain in the MK application.

The flow records a synthetic engineering application brief. It does not price,
send or accept a commercial quotation. Unknown dimensions and responsibilities
remain open, and confirmation does not establish engineering suitability.

1. Inspect the selected component and choose **Describe a need**. **Use sample**
   is a separate deliberate action that creates a unique tagged sample.
2. Enter the handling objective and optional notes/contact. Minimize and continue
   inspecting; **Resume brief** returns to the same draft. Live selection never
   replaces its attached reference. **Use current view** is the explicit change.
3. Choose **Review application brief** to read the full MK payload and actual
   open questions. **Edit full application** reaches dimensions, handling details
   and responsibility fields in the existing editor.
4. Choose **Confirm application brief**. This records the reviewed MK revision
   and opens its existing project, history and application PDF. Discussion and
   a reviewed response can produce R2; R1 remains unchanged.

`#/explorer-inquiry?project=ID&revision=N` opens the exact saved reference read-only.
It does not create a draft. Deliberately describing a need resumes an existing
draft or starts a revision from that snapshot. Missing references stay missing;
an incompatible model revision fails visibly rather than adopting a current view.

## Reuse boundary

The client vendors the four generated files from `npm run build:inquiry` into
`src/vendor/annora-inquiry/`. It imports the real `mountEmbeddedInquiry` and uses
the same inquiry session as Annora. The generated bundle is not edited locally.

The validated library source is
`d99f6b9a77d059906a8f17041df8d1b78ddd1971`; its source-tree digest is
`108948ecda758d6905ba4f184abc5d5c4d9a60767c1274be7df51d33c4bf6d19`.
The [library guide](inquiry-library.md) specifies build, vendoring, runtime and
conflict contracts. This delivery is a reusable UI/library seam, not a hosted
service or a general-purpose viewer SDK.

| Client responsibility | Integration |
| --- | --- |
| UI host | `src/ui/InContextInquiryPage.jsx` and its scoped CSS keep one iframe, route identity and accessible panel controls. |
| Domain authority | `src/adapters/embedded-inquiry.js` projects editable fields into the shared session while preserving the complete existing MK draft/store. |
| Review gate | `prepareInquiryReview(savedDraft)` calls MK's actual review operation and returns its full payload, open questions and token. The panel renders `Brief compact={false}`. |
| Confirmation | `submitInquiry(review)` verifies that exact packet and submits its existing MK token/operation ID. It never prepares a hidden replacement review. |
| Viewer boundary | `src/adapters/explorer-inquiry.js` uses the existing public JSON client for settled `captureView` and `restoreView`. No iframe DOM access or second renderer is needed. |
| Navigation | The host flushes `beforeLeave()` before another page owns the draft. Failed saves retain input and refuse departure; first-save URL pinning does not remount the viewer. |
| Output/history | The screen brief and actual PDF identify the selected detail and exact model revision. Confirmed snapshots keep their own reference after R2. |

Presentation configuration fixes the intent to `application-review`, omits
commercial quantity/stroke controls and uses engineering-brief labels. All hidden
MK values remain in the authoritative draft and undergo MK validation. Existing
invalid engineering values must be repaired in the full editor; the adapter does
not erase them. Explicit saved-draft recovery handles stale writes.

## Capture boundary

The supported route is ordinary Explore inspection. Capture waits for the public
controller to settle, pauses supported operation/separation playback, and stores
the selected component, scope, camera, view settings and exact model revision.
Active tours are refused. The old MK viewer does not expose orbital capture, so
entering this route does not carry over an orbital presentation pose.

## Verified release

The MK publication commit is `5947f1994f5b7baa717dbc3950e966eb40bf86a5`; the exact
release revision is `mk-explorer-inquiry-public-c5c425726386`. Deployment succeeded
and all **88 served artifact hashes** match the compiled release. The final
candidate passed **83 of 83 tests** and its production build.

Four normal compiled journeys passed at 1366×768, 390×844, 320×780 and 844×390
before the final history/PDF-only corrections. The final compiled retest passed
desktop normal plus three repeated 390 px save/confirmation/Back failure cases:
**4 cases and 44 checkpoints**. Public desktop and 390 px journeys then passed
**2 of 2 cases, 22 checkpoints, zero errors**. They cover explicit review and
re-review, R1/R2 history, saved-reference restoration and unrelated-project
preservation. Earlier failed runs remain alongside their successful retests.

Actual downloaded R1 and R2 PDFs each contain two pages. All four pages were
visually checked; the selected detail, exact model revision and complete open
questions are present. The original MK source and separate candidate remain
preserved across 452 files; the established public mainline retains all 86
tracked files and 85 served assets unchanged.

The source candidate and detailed client contract are under workspace path
`work-packages/mk-america/reviews/explorer-to-quote-stage-3-2026-11-05/`;
`app-candidate/docs/in-context-inquiry.md` documents the precise adapter shapes.
Within that review directory, `release/release-receipt.json`, `FINAL-REVIEW.json`
and `QA-COMPLETION.json` bind the published target to its accepted evidence.
MK producer generation **41** records this release; its receipt is
`work-packages/mk-america/runs/2026-11-06T08-16-26.281Z-c51fd1fa-0cce-4262-9746-c5200c9c318e/receipt.json`.

The bounded reuse proof is complete. It does not enable every Annora model or
promote this preview over the existing MK demonstration.

## Remaining acceptance limits

Browser emulation does not establish physical-phone keyboard behavior, ordinary
hardware performance, first-time customer comprehension or conversion impact.
There is no backend, account, external delivery, manufacturing acceptance or
commercial commitment in this integration.
