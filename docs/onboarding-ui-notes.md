# Prepared product onboarding UI

## Purpose and boundary

The seller prepares a new product through one focused Studio workspace: check
prepared assets, connect source drawing details to real model parts, inspect the
saved preview, then explicitly review and export its configuration.

This is an extension of Studio's established interface, not another design system.
It keeps the current grayscale surfaces, Ember action treatment, compact type,
existing controls and shared drawing/3D viewers. The user explicitly authorized
this workflow and asked to preserve Explorer, existing projects and commercial
history. Those constraints serve as the design brief; no additional design
questionnaire was necessary.

The workspace only accepts a prepared candidate. It does not imply that arbitrary
STEP imports, licensing review or server publishing occur in the browser. An
export is labelled **Ready for deployment**. The deployment owner applies it to
the template, validates the resulting build and publishes it separately.

## Reference lock

The existing Studio interface is the primary visual authority. Refero research
was used to check the mapping and confirmation pattern, not to replace the
approved visual language.

| Reference | Adopted | Deliberately omitted |
| --- | --- | --- |
| [shadcn/ui](https://ui.shadcn.com), Refero style `c14c0a94-1037-449e-bf5b-4cb972656ac7` | Restrained gray dividers, hierarchy through type and spacing, compact native controls | Marketing display typography, pills and another palette |
| [Rox mapping screen](https://refero.design/pages/440e2cb7-7058-490b-86dc-7ab6849715d1) | Source-to-target rows, a nearby preview, one forward action | Search and filtering for a small prepared detail set, auto-mapping, modal overlay |
| [Rox review screen](https://refero.design/pages/444b3c33-0a7e-48ad-9b24-f43710b0b787) | A distinct review before confirmation | Green success decoration and a combined edit/publish action |
| [Resend import flow](https://refero.design/flows/10626) | Check → associate → preview → explicit confirmation | Fake upload progress or a claim of cloud import |

Style searches covered monochrome industrial software, compact product tools and
Linear-style engineering interfaces. Linear's dark/glass treatment was rejected
because it would introduce another visual language into this established Studio.
The Rox mapping screenshot was inspected in addition to the full screen and flow
descriptions.

## Interaction structure

1. **Check sources.** Edit only the title, short title and summary. Inspect the
   original files, source author/license, exact versions and recorded unit
   conversion. Both source and unit acknowledgments start unchecked.
2. **Link details.** Select one prepared drawing region. Choose a real part and
   explicitly confirm the link. Changing a part returns the link to review. The
   drawing and 3D preview share the active detail, but selecting a different part
   in the model does not silently confirm a mapping.
   Only prepared mesh parts are offered as link targets. Assembly and root nodes
   remain available in the 3D hierarchy but cannot identify drawing geometry.
   An older invalid link is shown for review rather than silently rebound.
3. **Preview.** Save the draft and generate an exact snapshot. Inspect the source
   drawing or open the existing 3D viewer. Editing invalidates this preview and
   any subsequent review.
4. **Review.** Read the product, model/drawing versions and confirmed mappings.
   The primary action explicitly confirms the review.
5. **Export.** Download the reviewed JSON package. Exporting does not change the
   public site, existing product registry, inquiries or quotations.

The progress row describes the active task. It is not an additional persistent
navigation system. Previous steps remain accessible; there is one forward action.
Only the selected mapping expands its settings. The original PDF stays in the
existing reader and remains available from its secondary file link.

## Mobile and performance

- The drawing preview comes before mapping controls on a narrow screen.
- The 3D iframe starts only after the user chooses **3D model**. This applies on
  desktop too; a source check does not initialize a renderer.
- A single existing `StudioModelStage` is reused while changing details. A hidden
  model is paused by the shared host. There is no additional render loop.
- The mobile 3D stage remains portrait with room for the existing Explorer
  controls. A short square iframe would activate its narrow landscape layout;
  the onboarding host avoids that without changing Explorer.
- Source reading reuses `DrawingPreview`, including its existing zoom, pan,
  rotation and source-PDF behavior.
- Source/part mapping IDs and source coordinates are independent of the viewport.
- Primary controls, source links, drawing zoom and progress return actions have
  at least 44 px touch targets. No required action depends on hover.
- The action row is in document flow. It does not cover a drawing or the phone
  keyboard with an additional fixed footer.

## State and recovery

Pending operations preserve their button label area. Storage failures keep the
current editable draft in memory and do not claim a successful save. Invalid
inputs produce a focused error summary. Navigation uses Studio's existing
save/discard/keep-editing dialog, including host navigation and candidate changes.
A failing save prevents the switch. A browser-leave warning protects unsaved
edits. Corrupt stored work is not silently deleted.

The component calls the onboarding repository only. Its records are isolated
from Studio releases, published drawing packages and buyer/seller project stores.
The reader receives exact matching asset IDs and hashes with build URLs attached
to a temporary clone. Portable previews and exports retain source identities
without storing build-specific URLs.

## Verification record

- JSX parsing: passed.
- Impeccable automated detector on the two new UI files: no findings.
- Domain and source tests are recorded separately by the implementation owner.
- Full browser flow at 1280, 390 and 320 px: passed source gates, per-detail
  confirmation, reconfirmation after a part change, exact original PDF, lazy
  single-iframe 3D preview, saved preview, explicit review and reviewed export.
- Existing product/project store isolation and idempotent repeated export:
  passed in each browser context. No browser errors or page overflow occurred.
- Navigation tests passed save-and-return, discard-and-return, keep editing on a
  direct hash change, and resuming a saved setup from the product list. Editing
  after reaching review required a new preview. Every visible onboarding button
  measured at least 44 px high at 320 px.
- Screens were inspected at desktop, 390 and 320 px. Mobile model framing was
  corrected in the new host CSS; the Explorer renderer and UI were unchanged.
- Screenshots and browser records: `work/product-expansion/W41/ui/`.
- Final compiled subpath build: 11 onboarding checks and four navigation checks
  passed at each of 1280, 390 and 320 px. The additional gates verify that only
  mesh parts are offered and that unconfirmed links cannot enter preview.
  Evidence: `work/product-expansion/W41/compiled-onboard/`. Durable results and
  selected screenshots are archived in `docs/evidence/product-onboarding/`.
- The actual reviewed browser export is
  `docs/evidence/product-onboarding/reviewed-package.json`; deployment verification is
  recorded separately in the W41 delivery record.

These viewport tests are browser emulation, not a claim of testing on a physical
phone or benchmarking an ordinary computer. The implementation keeps the existing
renderer, starts no renderer for source checks, and never mounts more than one
model iframe.

## Repeatable browser review

`scripts/review/product-onboarding/onboarding.mjs` exercises the complete setup
and exact export. `scripts/review/product-onboarding/navigation.mjs` checks route
guards, draft resumption, preview invalidation and control sizes. Both accept
`BASE_URL`, `WIDTH` and `OUT`. They use an installed `playwright` module by default;
`PLAYWRIGHT_MODULE` can point to a separately installed module.

Each export stays in its review output directory. Only an explicit
`EXPORT_PACKAGE` setting writes an additional package elsewhere, so regression
runs do not overwrite the package used by the deployment receipt.

Visual acceptance: no horizontal overflow at 320/390 px; readable source facts;
44 px controls; visible drawing before a renderer starts on mobile; clean source
and review hierarchy; clear saved/error/pending states; no action implying that
an export has already published a website.
