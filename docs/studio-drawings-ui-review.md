# Studio drawings workspace review

Status: implemented and locally verified on November 1, 2026. GitHub Pages
acceptance is recorded in the delivery note below.

## Problem

The drawing page combines document selection, source versions, overview editing,
association editing, preview and publication. Too many controls have similar
visual weight, while document-level and selected-detail actions appear together.
Expanded forms and repeated toolbars reduce the space available for the drawing.
Competing workspace and feature layout rules also make the intended editor
structure less predictable at different viewport sizes.

The seller should always be able to answer three questions: which document and
version is open, which view or detail is selected, and what action comes next.

## Reference lock

The existing Annora silver canvas, white panels, compact typography and restrained
Ember accent remain the primary visual direction. This is a refinement of the
current Studio, not a new visual system.

| Reference | Pattern to use | Boundary |
| --- | --- | --- |
| [Rive editor](https://refero.design/pages/b6e752b9-3ce1-4874-9c57-15c6a1f5be67) | Separate hierarchy, dominant canvas and selected-item inspector | Do not import its dark-only treatment, blue accent or animation controls |
| [Linear issue detail](https://refero.design/pages/c0d1f40b-ba22-4026-9f55-08f124442353) | Quiet metadata, aligned labels and values, restrained dividers | Do not add a feed or a second navigation hierarchy |
| [Replo editor](https://refero.design/pages/a6b5d0f5-f6a9-434b-9273-bc280a3ec807) | A stable global preview/publication action area distinct from local editing controls | Keep Annora's action roles and explicit review gate |
| [Linear Changelog](https://linear.app/changelog) — Refero style `11d3e58a-87d7-4a9a-bbf5-720f4fd3ffc6` | Compact typographic hierarchy and tonal separation without heavy shadows | Use these structural rules, not the dark palette or pill-shaped controls |
| [MONO](https://mono.frm.fm/en) — Refero style `4b3c372c-aff6-4608-bafb-1dde853c4805` | Planar composition and deliberate structural dividers | Retain existing Annora type, corner radii and CTA treatment |

The drawing itself remains the main visual content. Use existing prepared vector
views and the original source reader; do not introduce decorative imagery or
additional nested cards. Ember continues to indicate selected state and the main
action. Neutral surfaces and text carry the remaining hierarchy.

## Implemented presentation

| Area | Presentation change | Preserved behavior |
| --- | --- | --- |
| Header | Compact title and a stable Save draft / Buyer preview / Review action group | Existing save, preview and review operations remain distinct |
| Document context | Keep the current product and source identity visible; disclose the source/version configuration when needed | Source selection, import, original PDF and history remain available |
| Workspace modes | Keep Overview and Associations as deliberate local modes | Existing mode-specific editing capabilities remain intact |
| Overview | One view list, one drawing canvas and one contextual inspector | View inclusion, titles, order, initial mobile view and feature bindings remain editable |
| View list | Compact selectable rows; reorder controls belong to the selected row | Order changes remain explicit and keyboard/touch accessible |
| Detail settings | Disclose individual forms instead of expanding every detail at once | Link review and confirmation remain explicit |
| Association editor | Details list, drawing canvas and selected association settings | Region authoring, part selection, mapping status and confirmation remain intact |
| Coordinates | Move numeric region bounds into a disclosure | Exact coordinates remain editable; drawing a region remains supported |
| Mobile overview | Open on Preview; use Views / Preview / Settings for one working surface at a time | The same selected view and unsaved edits persist across local panels |
| Mobile associations | Use Details / Drawing / Settings | Current region, part choice and form state persist across local panels |
| Layout ownership | Let drawing feature styles own their internal layout; the shared workspace stylesheet owns only the surrounding shell | Avoid duplicate `.sd-*` / `.so-*` layout overrides in the shell |

Global actions stay in one consistent location. Local actions such as confirming
an association remain next to the information they affect. Desktop controls stay
compact, while mobile controls retain usable touch targets. The center canvas
receives the remaining width after the bounded list and inspector.

## Scope and invariants

This work changes presentation and transient editor navigation. It does not add
a backend, alter the Explorer renderer, change source geometry or modify the
inquiry and quotation data model.

- Source, mapping, overview and quotation versions remain separate identities.
- A new source version still requires manual association review.
- A reviewed snapshot must still be explicitly confirmed before publication.
- Editing after review invalidates that review through the existing safeguards.
- Historical inquiries, quotations and discussions keep their original references.
- Original PDFs and published history remain accessible.
- Existing projects are neither migrated nor silently replaced.
- Demo publishing remains local to the browser; GitHub deployment remains a
  separate delivery action.

## Verification

`npm run verify` passed: 565 tests, 564 passed, one existing skip and zero
failures. The production build passed again after the narrow-screen action-row
adjustment. No new dependencies were added.

Manual browser checks used the dev app and the built `/annora-explorer/` subpath.
All edits and releases used local sample data.

| Check | Actual result |
| --- | --- |
| Connecting rod overview | Renamed and reordered a view; opened one link editor; changed the initial mobile view |
| SK08 overview | Switched between both sheets and added a prepared view on a 320 px screen |
| Associations | Selected the shaft bore, disclosed coordinates, edited a note and explicitly confirmed the mapping |
| Focus and panel continuity | Focusing a field no longer replaces the drawing; mobile Preview region returns to Drawing; selection and edits persist across local panels |
| Draft safety | Leaving with unsaved changes opened the existing recovery dialog; Keep editing retained the edits; saved drafts survived reload |
| Review and publication | Created local connecting-rod releases 1 and 2; Publish remained disabled until the review confirmation was checked |
| Historical snapshot | Release 1 kept its earlier title, order and initial view after release 2 was published |
| Buyer preview | Opened the saved presentation in the buyer preview with the exact overview identity and source/mapping references in its URL |
| Source controls | Product/source controls, import form, fictional drawing download, original PDF and history remained reachable |
| Responsive layout | Inspected 1280 px desktop, 1024 px narrow desktop, 390 px and 320 px mobile; no page-level horizontal overflow; mobile header actions stay in one row with 44 px heights |
| Hidden 3D preview | Reused the existing host visibility-pause pattern; no renderer changes |
| Existing contracts | Repository tests cover source revisions, manual confirmation, overview lineage and retained inquiry/quotation references |

The source A→B import and complete buyer/seller quotation journey were not
manually repeated in this presentation-only pass. Their domain implementations
were unchanged and the existing regression suite passed. Mobile verification
used responsive browser viewports, not physical-device performance measurements.

## Delivery note

Changes are limited to the Studio drawing workspace and overview editor, their
feature-owned styles, and this record. Explorer rendering, source assets, drawing
reader and inquiry/quotation repositories are unchanged. Existing unrelated
README and pilot-document work is excluded from this delivery.

GitHub Pages acceptance: passed for implementation revision
`e0ce35d9f810869747f9bcb3cace2df481f0e5cc`.
[Deployment run 41359003618](https://github.com/kyle-annora/annora-explorer/actions/runs/41359003618)
completed successfully. Hosted checks confirmed the connecting-rod desktop
workspace and the SK08 mobile preview/settings switch at 390 px, without page
horizontal overflow. The desktop page reported no browser-console errors.

Local screenshots are saved under `work/studio-drawings-review/desktop.jpg` and
`work/studio-drawings-review/mobile.jpg` (review artifacts, excluded from Git).

Review routes:

- [Studio drawings](https://kyle-annora.github.io/annora-explorer/studio/#drawings)
- [SK08](https://kyle-annora.github.io/annora-explorer/studio/#drawings?product=sk08)
- [Connecting rod](https://kyle-annora.github.io/annora-explorer/studio/#drawings?product=linkrods)

Related contracts: [overview authoring](studio-overview-authoring.md),
[drawing source API](studio-drawing-source-api.md), and
[Studio API](studio-api.md).
