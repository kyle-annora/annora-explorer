# From product exploration to a useful quotation request

## Purpose

Annora helps a customer understand a product, identify the relevant detail, and
carry that context into a reviewed request. For a manufacturer that already has
a 3D viewer, the value is better presentation, clearer interaction and a useful
commercial handoff. Another viewer alone does not establish that value.

This candidate connects the existing crank demonstration and free Explorer to
Product Room and Studio. It keeps the current visual language and rendering.

## Review the journey

Start at [the crank demonstration](https://kyle-annora.github.io/annora-explorer/?model=kinetic-01&presentation=1).

1. Watch or pause a chapter, or enter Explore and select a component.
2. Choose **Request a quote**, **Ask about this component**, or **Discuss this
   application**. The same floating inquiry opens beside the model. The current
   view is attached, with a small preview when available. Playback pauses first.
3. Choose quotation or application review. A consultation may leave quantity
   unknown. Describe the application and choose the requested scope: **Whole product**,
   **Selected component**, or **Help define scope**. Looking at a component does
   not automatically ask the manufacturer to quote it.
4. Choose **Review inquiry**, check the details and reference, then explicitly
   confirm the fictional inquiry.
5. From the receipt, choose **Open project**, then **View as seller**. Studio shows the confirmed application, scope and
   saved reference. **Reopen saved view** restores the referenced model version,
   camera, component and source pose; return takes the seller back to the project.
6. Prepare a quotation, review it, and issue the demo version. In the buyer view,
   the same reference accompanies the quotation. Changes and subsequent quotation
   versions retain their own references; earlier issued records remain unchanged.

The primary review case is the crank. Only products registered in
`content/commerce.json` receive the standalone quote entry. Adding a model to the
catalog does not automatically promise a supported inquiry or seller workflow.

## Interaction decisions

| Decision | Customer benefit | Boundary |
| --- | --- | --- |
| Contextual entries share one saved request | Start from the selected part, chapter or header | Only enabled commercial products |
| Compact real preview plus a reopen action | Identify what was being discussed | Missing preview never substitutes a fabricated image |
| Explicit quote scope | Separate the viewed part from the requested offer | Historic inquiries without scope remain unspecified |
| Existing two-step inquiry | Requirements, then review and confirm | No submission merely by completing the form |
| Preserve the saved draft on return | Continue work without losing the original reference | Adopting a new reference is an explicit action |
| Seller reopens the same view | Reduce ambiguity during scope review | Version mismatch fails visibly rather than opening another revision |

The panel can be minimized while exploring; **Continue request** resumes it.
Changing the live selection leaves the attached reference intact. See the
[embedded-inquiry decisions](embedded-inquiry.md) for the current pilot scope.

In Product Room, top-level Explore also follows the draft's saved reference after Overview or
Specs, and protects pending input. Temporary capture links are removed when
navigating to a durable saved project. Failed handoffs leave a retry path and
unlock the form.

## Design references and retained style

The visual authority remains the existing Annora interface: neutral surfaces,
compact floating controls, existing type, and configurable accent. No new palette
or typography was introduced.

- Teenage Engineering product presentation (Refero screen
  `2055406e-755a-4276-af43-09d6b06a78f3`): retain a product-first stage and contain
  supporting media. Do not import its branding.
- [Farfetch request quote](https://refero.design/pages/104f0f5e-b10d-4d51-a1da-1d3c0484aa4f):
  borrow the compact product image and identification near the request.
- [New Balance review step](https://refero.design/pages/10a5c647-5e47-445f-84b8-9acca8b3f9b1):
  borrow a carried-forward summary with a clear edit action before confirmation.
  Payment and the length of its checkout are outside this flow.

## Integration boundary

See [API contract](api.md#json-inspection-references) for the exact inspection payload
and commands. `captureInspection` and `restoreInspection` are JSON-facing
controller capabilities, also available through the existing iframe bridge.
They do not expose Three.js objects.

An inspection contains an explicit model identity and revision, either a free
view or paused timeline state, and an optional bounded raster preview. The
controller validates model, component and chapter identity before restoring.
The host stores that inspection alongside product-release, drawing and inquiry
context. A renderer reference cannot replace those business records.

The capture reuses the existing renderer and animation loop. It creates a small
2D raster copy, not another WebGL renderer. A changed or unsettled source is
rejected. Source-owned tour time is resampled even when the requested pose key is
unchanged, preventing an immediately paused restore from freezing halfway.

This is an adapter boundary for future integrations. Compatibility with arbitrary
third-party viewers has not been demonstrated. Such an adapter must provide
stable product/version/component identities and a reproducible view before it
can claim this experience.

## Demo storage and limits

- The demonstration uses fictional inputs and browser storage. It sends no
  inquiry, quotation, message, order or payment to a manufacturer.
- Temporary handoff tokens use same-tab session storage, expire after seven
  days, and are not cross-device share links. URLs contain a token rather than
  customer requirements or raster data.
- Confirmed projects remain in the existing local project repository. Existing
  projects and historical fields are not silently rewritten.
- Capturing a saved inspection currently supports free exploration and paused
  timeline tours. The orbital presentation stage explicitly reports unavailable
  support; it is not silently converted into a different camera state.
- Authentication, server persistence, cross-device projects and real delivery
  remain future backend work. An unavailable or mismatched saved reference shows
  a recovery message rather than claiming successful restoration.

## Evaluation

| Check | Required result |
| --- | --- |
| Crank Demo and Explore entry | Capture the actual state; no duplicate renderer |
| Selected component vs requested scope | Explicitly different fields; changing reference does not silently change scope |
| Review and confirmation | Buyer and seller each have an explicit review gate |
| Return navigation | Preserve pending requirements and the saved reference |
| Seller reopen | Restore model revision, source pose and camera; playback stays paused |
| Quotation versions | v1 remains immutable when v2 is issued; references survive |
| Invalid/expired capture | Clear error and usable recovery; no contextless confirmation |
| Mobile | Usable at 320px and 390px; no horizontal overflow or duplicate large preview |
| Existing experiences | Explorer modes, drawings and model switching continue to work |

See [embedded inquiry verification](embedded-inquiry-review.md) for the current
candidate. The [earlier handoff verification](exploration-to-quote-review.md)
remains available as historical evidence.
