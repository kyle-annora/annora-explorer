# Prepared product and technical story review

W40 extends the existing Studio and Product Room with a prepared-product
descriptor and versioned technical-reference story steps. The qualification
product is SK08; the existing crank remains the regression product. Publication
and browser results are recorded separately from this review procedure.

## Source qualification

SK08 is a single rigid support body, not an operating clamp assembly. The source
contains one mesh, 3,072 triangles and no authored animation clips. The support
body, shaft bore, mounting holes and cross-bore are geometry/features of the same
solid; no separate mechanical parts or motion have been invented.

| Identity | Prepared value |
| --- | --- |
| Product / model | `sk08` |
| Selectable body | `sk08-body` |
| Parent group | `support-body` |
| Model revision | `sha256:c1f912af43ddac4ad27f2ff99c05ed1ffa3f8bc4e7057309eca6c1194912949a` |
| Drawing package | `freecad-sk08-drawing` |
| Source edition | `annora-reference-1` |
| Association version | `annora-sk08-map-1` |
| Reference PDF hash | `efbd7d64704fce3a2b73b03e6a61c8f05b4f20fdb2e526425a3278320f558735` |
| Original PDF hash | `db5468501a8a7c61b840db481786161313b0befbcbd31fe1c910054033a73ca2` |
| STEP hash | `bb89218f5cd90ce713b08359d4d719f4297483039ef55d2abb33eb5af65d9cd5` |

The original model is by hasecilu, FreeCAD parts library, CC BY 3.0. The drawing
and STEP are paired at
[dw-examples commit c4c72a71](https://github.com/pzfreo/dw-examples/tree/c4c72a71c6440f0c824678660b59d0474f105e71).
The drawing is unreviewed draftwright output. Confirmed feature associations and
presentation review do not imply manufacturer approval. General tolerance and
some chamfer annotations are missing. Page 2 enlarges the original source views;
it adds no engineering requirements. The prepared display converts source
millimeters to meters, Y up; legacy metadata still labels source units unverified,
so source review remains an explicit readiness item.

## Review route

1. Open Studio with `?product=sk08`. Open the product editor and its Presentation
   section. The source identity and sample limits must remain visible.
2. Expand one step. Choose a linked drawing detail, edit its explanation and
   change its position with the tap/keyboard controls. The body selection follows
   the selected source detail. No movement option is offered for SK08.
3. Preview the step. Compare its drawing with the selected 3D body; use the same
   document's original PDF entry. Optionally pair a settled 3D view.
4. Save, preview the complete buyer experience, review the exact saved revision,
   then explicitly publish the demo version. Preview and review alone must not
   change the published release.
5. In Product Room, start the product story. Switch between 3D and drawing on a
   phone without losing the step or selected detail. Ask about that step.
6. Review and confirm the inquiry. Open the same saved detail from the resulting
   project, then prepare, review and issue a fictional quotation in Studio.
7. Publish a second story version with a different drawing detail. Return to the
   original project and quotation. Their product release, PDF hash, sheet,
   region, mapping and overview identities must remain unchanged.

## Acceptance matrix

| Case | Required observation | Status |
| --- | --- | --- |
| F2-01 | SK08 uses the same editor, player and viewer contract as the crank; configuration supplies its content | Passed compiled flow; see evidence below |
| F2-02 | Wrong part, model revision, source hash, page, mapping or overview blocks new preview/release | Passed exact-identity contract tests and compiled real-source handoff |
| F2-03 | Switching 3D/drawing on mobile keeps the same step, body and drawing detail | Passed compiled flow; see evidence below |
| F2-04 | An earlier story, inquiry and quotation reopen their exact historical source | Passed compiled flow; see evidence below |
| F2-05 | One 3D viewer; manual takeover, previous/next and disposal cannot commit a stale drawing | Passed compiled flow; see evidence below |
| F2-06 | Save, preview, release review and publish remain separate; edited content invalidates the review | Passed compiled flow; see evidence below |

Compiled browser qualification uses `/annora-explorer/` on localhost. Desktop
1280×900 completed 15 checkpoints; phone 390×844 and narrow phone 320×780
completed 14 checkpoints each:
original PDF, both technical details, inquiry review/confirmation, quotation
review/issue, Studio edit/preview/save/review/publish, and unchanged historical
project and quote after product version 2. These runs produced no page errors or
horizontal overflow. The complete historical project was compared byte-for-byte;
its drawing source, mapping and overview remained pinned to the original release.
The desktop run then reopened the saved 3D view and started its original story: the
original shaft-bore first step remained, rather than the newly published mounting
step.

Separate phone and landscape runs confirmed switching 3D → drawing retains step
2 and its selected source, manual takeover clears the companion, and only one
3D iframe exists. Visual review caught an initially crowded embedded viewport.
The corrected host now uses the incumbent compact controls, switches between 3D
and drawing in short landscape, and preserves a useful minimum stage height.
The complete model is visible at 320 and 390 pixels; landscape permits vertical
scrolling to the stage. No Explorer renderer or interaction engine was replaced. A narrowly scoped
compact-embedded CSS rule reserves the measured mode dock height. The selected
summary now has an 8-pixel clear gap above the controls; its measured intersection
area is zero. The standalone Explorer layout is unaffected.

A separate 390-pixel Studio run paired a new captured 3D view with the technical
step, returned to editing, reviewed and published it. The released inspection
selected `sk08-body`, matching the retained drawing feature. This completed six
additional checkpoints without starting a second 3D renderer.

Browser diagnostics observed cancelled `blob:` requests for the technical
reader's inert empty-SVG placeholders. Those placeholders are synchronously
replaced by inline vectors and immediately revoked in the existing reader.
The displayed technical views and original PDF loaded; these cancellations are
reported separately from page errors or unavailable source documents.

The [browser qualification record](evidence/prepared-products/browser-qualification.json)
records 69 checkpoints across seven final runs, plus the control-spacing check. [Desktop paired view](evidence/prepared-products/desktop-technical-story.png)
and [320-pixel model view](evidence/prepared-products/mobile-320-model.png) are the
retained review images.

The readiness report is generated from the actual bundled catalog, not a
handwritten expected result: [prepared-product readiness](evidence/prepared-products/readiness.json).
It validates both prepared products and all seven SK08 drawing-detail inquiry
handoffs. The focused product registry/story/technical-reference tests pass.

Local reproducible evidence remains under `work/product-expansion/W40/` (ignored):
`journey.mjs`, `studio.mjs`, `buyer.mjs`, `desktop-final/result.json`,
`mobile-390-final/result.json`, `mobile-320-final/result.json`, and
`switch-390-final/buyer-result.json`, `switch-320-final/buyer-result.json`, and
`landscape-844-final/buyer-result.json`. The scripts accept `BASE_URL`, `WIDTH`, `HEIGHT`
and `OUT`. `paired-studio.mjs` covers the optional capture path, and `spacing.mjs`
measures the embedded control separation. The existing crank commercial walkthrough passed on desktop, 390 px and 320 px.
The SK08 A→B change-impact regression passed all 15 checkpoints, including human
review, quotation v2 and retained A references. The complete automated suite
passed 930 tests with one existing conditional skip; both application and inquiry
library builds passed. [Release-gate evidence](evidence/prepared-products/acceptance.json).

## UI decision record

The existing Studio is the visual authority: compact neutral rows, one expanded
step editor, existing Field/Button components, keyboard/tap reordering and
prepared engineering imagery. No new palette, sidebar or navigation layer is
introduced. The model remains in the existing shared viewer.

Research was narrowed to this existing-system extension. The
[Pitch contextual properties editor](https://refero.design/pages/46d43847-1ced-45d4-a8a3-5995abd5c500)
supports exposing controls only for the selected step; the
[Figma Slides settings panel](https://refero.design/pages/211f834e-c5d9-46b9-a145-fd4316947ee2)
supports keeping edit and presentation controls distinct. Linear's monochrome
surface separation informed restraint only; its dark palette and lime CTA were
not transferred into Annora. The final implementation retains the incumbent
tokens and technical drawing reader.

## Limits

This is a prepared public example with fictional browser-local commercial data.
It does not add CAD conversion, automatic mechanical inference, private uploads,
server publishing, manufacturing approval or a backend. A fresh unknown product
still needs source preparation and authored mappings. W41 covers the separate
onboarding-workbench and independent new-source qualification. Physical phone and
ordinary-laptop performance, and customer comprehension, require their own runs;
browser emulation does not establish those claims.
