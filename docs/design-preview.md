# Product workspace design preview

Date: November 1, 2026. Status: independent visual and interaction review.

## Scope

The preview at `/design-preview/` explores a quieter interface for the existing
crank-slider product. It has three review states: the customer opening view,
a selected component, and the seller editing workspace. It does not replace
the published Explorer, Product Room, Studio, drawing readers or quotation
workflow. Existing customer projects and release records remain untouched.

The model is the existing Kinetic 01 package. Its geometry, authored motion,
source attribution and engineering meaning remain unchanged. This preview uses
the existing scene and JSON controller through a private local adapter, with
one renderer and one animation clock. Scene objects never become UI state or
cross a host boundary. Engineering uses an isolated light presentation surface;
the established technical rendering treatments remain available for comparison.

Seller edits are temporary presentation changes within this preview session.
They are not production publications, customer requests or cloud records. Links
to the released application remain distinct from preview controls.

## Reference lock

The user selected Pedestal as the main reference for the next interface pass.
The source was inspected both on the live [Pedestal Studio](https://www.pedestal.com/pages/studio/)
and in Refero's [modular stand configurator flow](https://refero.design/flows/8632).
The live initial screen shows a near-full-canvas product with a slim header,
edge-aligned product information and a compact selection action. After selecting
a product, model-anchored labels and a small next-step summary take over.

Relevant captured states:

- [Product selection](https://refero.design/pages/31f847e4-e1f5-4914-a8a5-5a0e1ff910ad)
- [Contextual component choices](https://refero.design/pages/cf95f623-c73a-4a26-988b-37b7fa058611)
- [Compact settings panel](https://refero.design/pages/9d4689aa-8844-4c8b-95f3-3a734bd2700d)

Pedestal is a customer configurator despite its Studio name. Its buyer-facing
sequence is adapted to product understanding and inquiry; it is not copied into
the seller's editing or reviewed-publication workflow.

| Reference | Bounded role | Excluded from this preview |
| --- | --- | --- |
| Pedestal Studio | Product-first composition, continuous light canvas, contextual floating controls, stable next action | Checkout, product pricing, its blue brand accent and furniture finish palette |
| Existing Annora / Oxide-informed Explorer | Selection versus entering an assembly, optional hierarchy, framing, separation and restoration | A permanently expanded technical console on the customer's first screen |
| Existing Atlas-informed linework | Crisp visible edges, occlusion and flat Ember emphasis | Decorative wireframes or changes to source geometry |
| Existing Annora Studio | Explicit labels, controlled inputs, clear preview boundary | Production publishing from the isolated design prototype |

## Visual commitments

- **Canvas:** a continuous silver-neutral field. The product is the dominant
  content; it is not placed inside another decorative card.
- **Typography:** one clear sans-serif UI family, with monospace reserved for
  precise identifiers or small technical metadata. Scale and spacing carry
  hierarchy; captions do not compete with the product title.
- **Accent:** Annora Ember (`#ff6840`) identifies the main action and active
  model selection. Controls retain readable dark text on a filled Ember action.
  Neutral treatments handle secondary actions and ordinary navigation.
- **Surfaces:** a small number of flat floating panels. Boundaries use subtle
  contrast and restrained dividers. No nested card frames or diffuse decorative
  glows are introduced.
- **Density:** customers see one current context and one primary next action.
  Sellers retain a compact list/canvas/inspector arrangement using the same
  component language.
- **Assets:** the real prepared crank model and its existing materials and
  motion. No generated image or imitation CAD illustration is needed.
- **Interaction:** selection is distinct from entering a component. Tool
  panels open on demand and can be dismissed without losing the current view.

## Decision ledger

| Decision | Evidence and role | Intended benefit |
| --- | --- | --- |
| One product identity and one header per state | Current Product Room repeats its own identity and the embedded Explorer identity; Pedestal uses a single slim header | Remove the appearance of an application embedded inside another application |
| Large product canvas on first entry | Pedestal's opening and selected-product screens | Make understanding the product the first task |
| Contextual component panel | Pedestal hotspot and component-choice states | Reveal relevant information after intent is known |
| Optional component hierarchy | Existing Annora/Oxide navigation | Keep complex assemblies navigable without making every customer use a tree |
| Stable action area | Pedestal progress/next-action summary; existing Annora review decisions | Make the next action predictable while preserving deliberate confirmation |
| Compact seller inspector | Existing Studio fields and preview behavior | Keep editing controls available while returning space to the product |
| Shared visual rules with different working density | User's buyer/seller distinction | Let the three states feel related without forcing them into an identical layout |
| Session-only draft state | Independent review scope | Let reviewers try edits without changing existing published products or projects |

## Review states

1. **Product:** enter the preview, inspect the whole mechanism, open available
   viewing controls, and try the existing short operating action.
2. **Component:** select a component through the model or hierarchy; inspect its
   context, enter it deliberately, and return to the complete assembly.
3. **Studio:** edit product-facing content or a selected component's notes and
   document associations, then preview that temporary draft as the customer.

The reviewer should be able to move among these states without mounting a second
renderer or losing an unexplained selection. Final route and control labels are
recorded with the acceptance results once the preview is built.

## Acceptance matrix

| Area | Check |
| --- | --- |
| Reference fidelity | Product dominates the first screen; slim header, continuous canvas, one contextual panel and a stable main action retain Pedestal's selected traits |
| Desktop | Inspect the three states at 1440 px width; no clipped model, overlapping controls, duplicate identity or large title stack above the work area |
| Mobile | Inspect at 390 px and 320 px; no horizontal overflow, inaccessible action or controls covering the entire usable model area |
| Context | Selecting a component, explicitly entering it and returning to the assembly remain distinct and understandable |
| Panels | Open and dismiss hierarchy, viewing controls and inspector; hidden panels cannot receive focus; Escape and explicit close controls work |
| Inputs | Keyboard focus is visible; labels remain readable; preview edits survive local state changes and never overwrite live product or project storage |
| Main action | Position and meaning stay predictable; pending work cannot create duplicate actions; labels describe the actual preview behavior |
| 3D loading | Loading and unavailable states are visible; render controls are unavailable until the model is ready; failure offers a clear recovery path |
| Rendering | Engineering, linework and flat highlight remain legible; selected state is visible; source geometry and existing technical output are unchanged |
| Motion | Short operating action supports pause, replay and seeking where exposed; reduced-motion preferences and hidden-tab suspension remain respected |
| Performance | One scene and demand rendering; no additional animation loop; inspect the network for duplicate model loads when switching review states |
| Production isolation | Existing Explorer, Product Room, Studio and saved projects still use their released behavior |
| Deployment | Verify the built `/annora-explorer/design-preview/` subpath, then the hosted route before sharing |

Mobile viewport emulation and synthetic throttling are browser checks. They are
not claims of measured performance on physical phones or low-end computers.

## Rollout boundary

The next decision is whether this composition and control language should become
the shared product direction. A later approved implementation can then update
the real hosts, state by state, while preserving source/version identity,
review gates and historical customer records. Approval of this preview alone
does not silently migrate those workflows.

## Acceptance results

Visual review performed on 1 November 2026 against the local development preview.
The state routes are:

- `/design-preview/?screen=product` — Product
- `/design-preview/?screen=detail` — Inspect
- `/design-preview/?screen=studio` — Studio

The review used Chrome at 1440 × 950, 390 × 844 and 320 × 740. All three
states were captured at each size. No horizontal or document-height overflow
was observed in those nine captures.

| Observed check | Result |
| --- | --- |
| Product composition | The real mechanism dominates the canvas, with a slim shared header and one main customer action. Product identity is below the mechanism instead of occupying a large banner. |
| Desktop Inspect and Studio | The selected-part panel and seller inspector have consistent surfaces, spacing and dividers. Studio uses a compact navigation column and retains the large central canvas. |
| Mobile main action | Inspect's Product Room action remains visible in its own panel footer at both 390 and 320 px. Supporting content scrolls independently. The first pass found this action below the panel viewport; that issue was corrected and recaptured. |
| Mobile hotspots | Product uses compact dot targets with accessible component names. The first pass found overlapping text labels at 320 px; the labels were removed from the small-screen visual layer and the result was recaptured. |
| Entry state | The first pass surfaced an invalid empty-selection request on Product. The corrected reset opened all tested states without that message. |
| Display modes | Engineering, Linework and Flat Ember render correctly while keeping the same selected rod and camera. Linework uses crisp edges; Flat Ember adds the selected-part fill. |
| Display and parts overlays | Menus fit the tested widths. Escape closes the Parts panel and restores focus to its trigger at all three widths. |
| Studio editing on mobile | Product and inquiry controls are reachable in the scrollable editor. Preview as customer remains visible in a separate footer at 390 and 320 px. |

The narrow Studio editing-state overlap was corrected and visually rechecked
at 390 and 320 px. Playback controls are hidden while the mobile editor is
open, leaving the mechanism unobstructed above the editor. The editor close
control sits in a fixed header; Preview as customer remains in the fixed
footer while the form scrolls between them.

Local visual evidence is stored outside the repository:

- `/tmp/annora-preview-desktop-product.png`
- `/tmp/annora-preview-desktop-detail.png`
- `/tmp/annora-preview-desktop-studio.png`
- `/tmp/annora-preview-mobile-detail.png`
- `/tmp/annora-preview-narrow-product.png`
- `/tmp/annora-preview-narrow-detail.png`
- `/tmp/annora-preview-desktop-linework.png`
- `/tmp/annora-preview-desktop-flat.png`
- `/tmp/annora-preview-mobile-editor-open.png`
- `/tmp/annora-preview-narrow-editor-open.png`

These are local review artifacts, not published product assets. This visual
pass does not claim physical-device performance, reduced-motion behavior,
load-error recovery, storage isolation, or production-route regression merely
from screenshots. Those checks and hosted deployment evidence are reported
separately.

### Built application checks

The final built preview was exercised under `/annora-explorer/design-preview/`
at 1440 × 950, 390 × 844 and 320 × 844. All three checks completed without
browser exceptions, failed asset responses, horizontal overflow or browser
storage writes. The Product Room action remained visible and clickable; Parts
received keyboard focus when opened and returned focus after selection; closing
the inquiry preview returned focus to its trigger without closing the editor.

Studio product names, introductions, per-part notes and document associations
were edited and verified in the customer preview. Inquiry setup opens a separate
session-only rehearsal: required fields are validated, a review shows the entered
values, and editing preserves them. It deliberately ends at review, with no
submission or publication. Refresh clears the isolated draft.

The existing Explorer, Product Room and SK08 Studio drawing routes loaded from
the built deployment without browser exceptions. The repository verification
suite passed: 548 tests passed, one existing test skipped, no failures; project
checks and the production build also passed.

A separate desktop browser run with 4× CPU throttling and a 390 px mobile run
with reduced motion verified rendering modes, quality selection, enter/return,
pause/replay/seek and explode/reassemble. Each run observed exactly one model
asset request and one WebGL context across all three states. Rendering stopped
when idle. These observations are resource and behavior checks, not physical
low-end-device frame-rate certification.

Review entry: [Hosted design preview](https://kyle-annora.github.io/annora-explorer/design-preview/).
Its deployment uses the existing Pages workflow and remains separate from the
production entry points. Source is contained in `design-preview/` and
`src/design-preview/`; the only shared build change is an additional Vite entry.
