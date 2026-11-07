# Independent viewer walkthrough acceptance

This qualification covers a single fictional customer project from an existing
viewer through inquiry, seller quotation, a customer change, quotation v2 and an
agreed next step. The purpose is to demonstrate continuity: Annora adds the
commercial conversation while the customer's viewer remains its own system.

## Product boundary

- Entry: `walkthrough/?viewer=independent`.
- A `WTI-` session owns a separate local project namespace. Ordinary Product Room
  projects, Studio product releases, the earlier native walkthrough and the
  standalone integration example are not migrated or cleared.
- The independent viewer owns its canvas, geometry, camera and selection. Its
  first guided action selects and frames the connecting rod. It does not claim
  to play the native Explorer's authored mechanism animation.
- A request pins the external adapter identity, product and model revisions,
  selected component and camera snapshot. Issued quotations and subsequent
  discussions retain that exact reference.
- This is a local demonstration. No backend, delivery, account, order, payment
  or cross-device synchronization is represented as implemented.

## Required acceptance matrix

| ID | Customer-visible behavior | Evidence and failure condition |
| --- | --- | --- |
| W60-01 | One entry opens the independent viewer and one clear Continue demo action | Same WTI session is present throughout. No native Explorer iframe replaces the host. |
| W60-02 | The first action identifies and frames the relevant part; the next opens an inquiry beside it | One retained viewer canvas. Context contains the external part ID and exact camera. No unsupported motion claim. |
| W60-03 | An inquiry can be minimized and resumed without losing its reference or edits | The same draft and canvas survive. Browsing another part does not silently replace the attached reference. |
| W60-04 | Filling or reviewing an inquiry does not submit it | The review is visible before a later Confirm & continue activation. No project is created by preparation alone. |
| W60-05 | Buyer and seller handoffs identify the current role and preserve the project | The same session and project ID appear in Product Room and Studio. No alternative sample project is created. |
| W60-06 | The seller reviews quotation v1 before issuing it | Draft preparation leaves the issued-quotation count unchanged. Confirmation creates one v1. |
| W60-07 | The buyer reviews a change request before sending it | The request refers to v1 and the saved external part. Preparation does not create a change record. |
| W60-08 | The seller reviews v2; the buyer sees a readable comparison with v1 | v2 links to v1 and the change request. v1 remains byte-for-byte unchanged. The external reference remains exact. |
| W60-09 | Historical quotations reopen their saved external view | Restore uses the selected record's context. Camera, adapter, model/product revisions and component identity match the saved snapshot. Return goes to the originating record and role. |
| W60-10 | Requesting and acknowledging a next step each require review and confirmation | One next-step request and one seller acknowledgement are recorded. The result is not described as an order or payment. |
| W60-11 | A clarification and its answer remain attached to this project | Seller and buyer replies each have separate review and confirmation. Neither action issues a quotation. |
| W60-12 | Return, Back and refresh remain safe during review and after completion | A retired review cannot confirm a new action. Refresh neither duplicates records nor rewrites history. Returning to an old quotation does not promote it to current. |
| W60-13 | Failed saving keeps the customer's work available | A controlled local persistence failure leaves the inquiry, edits and reference visible; retry succeeds without duplicating the draft. |
| W60-14 | Existing work is preserved | Protected ordinary, native-walkthrough, Studio and standalone-example storage bytes are identical before and after qualification. |
| W60-15 | Mobile remains operable | Desktop, 390 px, 320 px and short landscape have no page-level horizontal overflow. Continue has an accessible name, a minimum 44 px target and receives pointer input. Reviews and comparisons remain readable. |
| W60-16 | The wrapper does not introduce another renderer or unnecessary idle work | Independent-viewer screens contain exactly one canvas and no Explorer iframe. Idle rendering and mobile DPR are recorded. Browser emulation is not a physical-device performance claim. |
| W60-17 | The release can be reproduced and verified | English instructions, automated results, commit/build identity and a separate public-target receipt are retained. A local build is not publication evidence. |

## Qualification procedure

Run the compiled site, including the separately built independent-viewer example.
The browser runner uses rendered controls for business mutations. Storage reads
provide evidence. Its only storage writes are explicitly identified synthetic
test preconditions in a fresh browser context and a controlled save-failure
injection; it never operates on the user's browser profile.

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
BASE_URL=http://127.0.0.1:8159/annora-explorer/ \
OUT=work/product-expansion/W60/browser \
node scripts/review/integration-walkthrough/browser-journey.mjs
```

`PROFILES` selects `desktop,mobile,compact,landscape`. The default checks all
four. Screenshots, step metadata, exact fictional project snapshots and a summary
belong in the output directory. A failed checkpoint must retain its URL, stage,
visible page, error and storage evidence.

Run `scripts/review/integration-walkthrough/navigation-branches.mjs` with the same
environment variables for focused desktop and 320 px checks: direct inquiry
entry, Guide chapter changes with a saved draft, exact return to a seller review,
and invalid explicit project IDs in the viewer, buyer and seller hosts. That
runner defaults to `PROFILES=desktop,compact` and uses its own output directory.

The main sequence is: independent product view → floating inquiry → inquiry
review → confirmation → seller quotation review → issue v1 → buyer change review
→ send change → seller revised quotation review → issue v2 → comparison →
next-step review → request → seller acknowledgement review → confirm → completed
customer project. A clarification/reply branch and historical-reference return
are additional qualification paths, not extra steps in the default presentation.

Pure contract tests cover session isolation, routing, stale actions, reference
selection, unsupported references and failed repository mutations. Existing
native crank and drawing A→B qualification remain regression gates. The public
target must be checked after the intended commit is deployed, separately from
these candidate checks.

## Compiled candidate qualification

The completed candidate passed **92 main-journey checkpoints**: 23 each at
1280 × 900, 390 × 844, 320 × 740 and 844 × 390. Each run completed eight distinct
review/confirmation boundaries, including the optional clarification/reply
branch. There were no page errors or failed resource requests.

An additional **20 navigation checkpoints** passed at desktop and 320 px. They
cover direct inquiry entry, saved-draft chapter changes and refresh, returning
from the external viewer to the exact unissued seller review, and invalid
explicit project IDs in the viewer, Product Room and Studio.

The checks retained exact adapter, product/model revision, part and camera data
through v1, the change request, v2, historical v1 and the next-step conversation.
Review alone did not issue or submit a record. Failed saving retained the editor;
retry, minimize/resume, Back and refresh preserved work. Four isolated synthetic
namespace preconditions remained byte-for-byte unchanged.

Visual review found and resolved two guided-mode issues: the Guide menu was
behind the floating inquiry, and native filled actions competed with Continue.
The final compact review keeps one orange confirmation in the walkthrough strip;
the native Edit details action remains available. In mobile quotation view, the
native next-step action uses an outline. Guide chapter buttons now receive real
pointer input above the inquiry.

Independent-viewer screens retained one canvas and no Explorer iframe. The
400 ms idle samples recorded 0–1 additional rendered frames; mobile drawing
buffer allocation stayed bounded. These are Chrome emulation observations, not
physical-phone or ordinary-PC performance measurements.

Reproducible evidence is retained in:

- `work/product-expansion/W60/browser-qualified/`
- `work/product-expansion/W60/navigation-branches-qualified/`
- `work/product-expansion/W60/evaluation-summary.json`

The earlier failed Guide checks and prior candidate screenshots remain in their
separate directories. Publication, target verification and existing-flow
regression are recorded separately in the W60 delivery record. The local results
above do not establish that a public target has deployed.
