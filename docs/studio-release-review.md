# Studio release review

Date: November 1, 2026.

## Delivered scope

The prepared crank product now has a seller-facing Studio: product editing, part/document association through the existing 3D viewer, inquiry wording and field visibility, real buyer preview, reviewed browser-local publication and portable release export. All interface copy and maintained delivery documentation are English.

The Explorer renderer, model assets, floating controls, motion, material modes and guided tour files are unchanged. Studio and Room use the existing presentation library. Browser preview projects are isolated from the normal customer project store.

## Checks performed

| Area | Actual result |
| --- | --- |
| Project verification | `npm run verify`: 369 tests, 368 passed, one conditional unsupported-model test skipped; build passed |
| Desktop authoring | Edited product title/headline, selected the connecting rod in the actual Explorer, added an explanation and managed checklist, changed an inquiry label/help and hid Company |
| Real buyer preview | New title and inquiry configuration appeared in the actual Room; confirming a preview inquiry left the ordinary project store unchanged |
| Release boundary | Publishing stayed disabled before explicit review confirmation; a local v2 receipt and downloadable release package were produced |
| Customer history | An existing inquiry and v1 quotation remained byte-identical after publication; a new inquiry captured the new release/profile; the historical view retained the old label |
| Original commercial journey | Inquiry review/confirm, sample quotation, reviewed change request, sample reply/v2 comparison and reviewed next-step request all passed again |
| Release navigation | Viewing an old project in 3D and navigating Back restored the correct current version; missing preview/release links cleared stale frames and receipts |
| Mobile | All four editing sections and release review fit 320px; a phone-size actual buyer inquiry reached review; mobile publication completed |
| Failure recovery | An injected storage write failure retained form values and recovered after retry; a delayed real storage lock kept a pending save control until persistence completed |
| Data validation | Stale edits/reviews, duplicate confirmations, missing files/parts, invalid source links, malformed historical snapshots, corrupt stores and incompatible model/profile versions have targeted tests |
| Export/import | Reviewed export applies to a temporary static content directory, requires explicit replacement, rejects altered content under a reused release ID and refuses previews/incompatible assets |
| Route/build path | Browser journeys ran against compiled files served under `/annora-explorer/`, matching the GitHub Pages repository path |

Selected screenshots and machine-readable browser results are in [evidence/studio](evidence/studio/). They contain fictional demonstration records only.

## Practical limits

Mobile checks use desktop Chromium viewport emulation. No physical phone or lower-end hardware frame-rate benchmark was performed. Studio loads the existing 3D picker on demand and removes it when leaving; it does not introduce another renderer or continuous animation loop.

Saved drafts and demo releases remain in the current browser. Preview customer projects are disposable memory data. There is no backend, login, cloud sharing, real quote delivery or supplier response service. The exported content can be installed and deployed through the real GitHub workflow; a browser-local release receipt does not claim that deployment happened.

This first editor supports the prepared crank product and its supplied assets. Other models can continue using the Explorer. Arbitrary CAD import, private uploads, geometry/material/tour authoring and a seller quotation inbox remain future work.
