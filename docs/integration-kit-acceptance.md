# Integration kit acceptance

The unit qualifies `@annora/integration-kit` 0.1.0 with a separately implemented
Three.js host. The host keeps its own canvas, camera, selection and model assets;
the kit supplies the contextual inquiry boundary. Existing Explorer, Room,
Studio, drawing history and commercial project stores remain separate.

## Required evidence

| ID | Acceptance | Evidence required |
| --- | --- | --- |
| B-01 | Distributable excludes models, Three.js, PDF runtime and customer assets | Packed file inventory, dependency/import boundary, manifest/output hashes and React peer declaration |
| B-02 | Capabilities degrade explicitly without metadata loss | Inquiry-only adapter; unsupported drawing/story rejection; unsupported repository/reference version retains input and bytes |
| B-03 | Independent capture/restore pins exact identity | Select stable component, capture camera, edit inquiry, review, confirm, restore original; reject another model/revision/adapter |
| B-04 | Lifecycle and failure boundaries remain safe | Superseded capture, timeout/retry, cancellation/disposal, failed persistence and explicit confirmation; existing exact-origin bridge regression |
| B-05 | A host builds from English instructions outside the repository | OS-temporary copy installs the packed kit with its own peers and Three.js; no root source aliases; compiled subpath browser check |
| B-06 | Reinstall/rollback preserves records | Same-version artifact reinstall with preserved host store; unsupported future reference fails closed; separate source/build/publication evidence |

## Reproducible checks

Build the package and independent example using the repository's integration-kit
instructions first. Then run:

```sh
node scripts/review/integration-kit/fresh-host.mjs
node scripts/review/integration-kit/artifact-conformance.mjs
```

This script copies the independent example into a fresh temporary directory,
changes only the local package artifact path, installs dependencies there and
builds there. It inspects the packed file list and public exports, validates peer
declarations, rejects source aliases, and records artifact/build hashes.
`KIT_ARTIFACT`, `HOST_SOURCE` and `OUT` override its input/output paths. The fresh
host is retained for browser qualification. The second command imports that
host's installed package and checks capability, lifecycle, reference preservation,
review/confirmation and same-version reinstall behavior. Neither command
establishes browser behavior or publication.

Runtime checks must use the installed package, not imports from `src/`. Preserve
the original fixture/store before every mutation and compare values afterward.
In particular, a declared compatible repository that drops a saved reference
must fail; testing only the capability flag is insufficient.

Browser review covers desktop, 390 px and 320 px portrait, and short landscape.
Check real hit targets, no horizontal overflow, a visible model while exploring,
minimize/resume, edit/review/confirm, return to the exact saved view, and reload
with the same saved record. Observe one viewer canvas and no Annora iframe. The
independent viewer loads its own geometry; the kit's package excludes it.

## Candidate qualification — November 6, 2026

The independent host installed and built the packed artifact outside the source
checkout. All **14 installed-artifact checks passed**, including reference-loss
refusal, superseded capture, timeout/retry, cancellation, disposal, explicit
review/confirmation, unsupported-version preservation and package reinstall with
unchanged saved records.

The compiled independent host passed **44 checkpoints** across these viewports:

| Viewport | Checked journey | Result |
| --- | --- | --- |
| 1280 × 900 | Selected part → draft → review/edit → confirmation → exact saved camera → reload | Passed |
| 390 × 844 | Same journey with touch emulation, save failure/retry and return navigation | Passed |
| 320 × 740 | Same journey, narrow layout and real button hit testing | Passed |
| 844 × 390 | Same journey in short landscape | Passed |

Each run retained one canvas and no Annora iframe, recorded no page or request
errors, preserved an unrelated-store sentinel, and observed zero additional idle
renders over a 400 ms sample. The saved camera matched its attached snapshot.
Unsupported stored data stayed unchanged while the viewer remained usable.

The retained-page lifecycle branch passed with synthetic `persisted` events.
Actual Back navigation also passed, but Chrome did **not** use its back-forward
cache in these runs. These two observations are recorded separately.

Existing-flow regression also passed: the crank walkthrough completed 16
checkpoints and eight explicit confirmations at both desktop and mobile sizes.
The SK08 mobile journey completed 15 checkpoints from drawing A to reviewed B,
quotation v2, mixed A/B references, exact drawing reopen and reload. The original
inquiry, earlier quotation, discussions and unrelated project namespace remained
unchanged.

Exact artifact/build hashes and publication identity belong in the W50 delivery
evidence. These candidate checks do not establish that a public target has
deployed; publication requires its separate release receipt and target checks.

## Limits of this release

- No real backend, account, quote delivery, customer data or cross-device sync.
- The independent example qualifies one adapter; it does not certify every
  commercial 3D viewer.
- The example supports product inquiry, selected parts and captured views.
  Drawing-detail and story capabilities are explicit unsupported states.
- Adapter authors own stable component IDs, exact source resolution, snapshot
  interpretation and cancellation of scene changes.
- Browser emulation is not a physical-phone or ordinary-PC performance claim.
- This is the first kit version. Same-version reinstall/rollback and
  unsupported-version preservation are not proof of a cross-version production
  data migration.
- The host owns storage. Existing Annora project keys and other browser data
  must not be reused, migrated or cleared by the independent demo.
