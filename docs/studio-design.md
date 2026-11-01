# Studio — reference lock and interaction decisions

Date: November 1, 2026. Scope: the prepared crank product, fictional content and browser-local authoring.

## Primary reference

The shipped Annora Product Room and its shared `.room-ui` component catalog are the visual authority. Preserve silver surfaces, graphite text, Ember primary actions, champagne completion states, compact lists and fixed dividers. The embedded Explorer keeps its floating UI, renderer, material modes and animation controls.

## Narrow supporting references

- [Linear](https://linear.app), inspected through Refero style `554b801c-3b31-4086-a7e5-ae613cdd618b`: compact spacing, explicit text hierarchy and contained controls. Its dark palette and lime accent are excluded.
- [Lemon Squeezy product editor](https://refero.design/pages/670b2726-ed70-45d6-80d7-d153a87ee2ea), [alternate editing state](https://refero.design/pages/af3a9bc1-4cbb-4660-9e05-91bb66f0787c): grouped editable sections and distinct draft/publish actions. Its billing controls, purple theme and large empty center are excluded.
- Existing Annora project review: review a fixed snapshot, then explicitly confirm. A successful local action must not imply delivery or hosted deployment.

## Route hierarchy

```text
/studio/                         Products
  #edit/product                 Product information
  #edit/parts                   Parts and document association
  #edit/presentation            Existing display modes and explanation links
  #edit/inquiry                 Inquiry field configuration
  #preview?id=<id>              Buyer preview
  #release                      Release review
  #release?id=<id>              Exact released snapshot receipt
/product-room/                  Buyer-facing product and customer projects
  ?studioPreview=<id>           Exact isolated draft preview
  ?release=<id>                 Exact released demo snapshot in this browser
```

The runtime hash names follow the implementation; product and customer-project records remain separate. Studio does not add a second component tree or render engine.

## Decision ledger

| Decision | Reason | Acceptance evidence |
| --- | --- | --- |
| Three surfaces: products, editor, preview/release | Keep the authoring path short | One crank product completes the full path |
| Existing component primitives | Preserve visual and state consistency | Shared buttons, fields, notices and comparison rows |
| On-demand existing 3D picker | Associate real node IDs without maintaining another tree | Selected node can be linked to a document and opened in the Room |
| Real Room preview | Avoid a separate mock that drifts from the buyer UI | Draft title and configured inquiry text appear in the actual Room |
| Immutable preview and release identities | Prevent a new edit from silently changing the reviewed version | Stale reviews are rejected; previous customer records remain unchanged |
| Managed sample assets | Keep document associations portable and safe | Export contains stable asset IDs, not temporary object URLs |
| Separate preview project repository | Protect existing customer records during author testing | Preview submission leaves the main project store unchanged |
| Explicit local-demo release | Work within the approved static/no-backend scope | Receipt says current browser; export and hosted deployment are distinct |
| Single-column mobile editor | Preserve readable labels and touch targets | 320/360 px layout and buyer review checks |

## Deferred capabilities

No CAD editing, automatic motion inference, material authoring, arbitrary uploads, real authentication, production customer data or cloud publication service is introduced. Existing prepared actions and model packages remain the source of 3D behavior. These boundaries do not prevent a future host from implementing durable Studio and customer-project adapters.

## Customer-project workspace extension

The approved extension retains the primary Annora reference above. Refero
research additionally inspected Mercury's [line-item editor](https://refero.design/pages/c20cc9bc-c12f-4064-b5c5-f3b3f0294b7f),
[review-and-send screen](https://refero.design/pages/64cbc94f-183a-4ef6-b50d-e1d1be4f7aff)
and [creation flow 11047](https://refero.design/flows/11047). Borrow only grouped
commercial fields and a complete recipient-facing preview before final issue.
Mercury's purple palette, decorative preview gradient, payment collection and
multi-step recipient setup are outside this workflow.

| Decision | Source and bounded role | Application |
| --- | --- | --- |
| Products / Customer projects | Approved buyer/seller architecture | Product publishing remains separate from quotation issuance |
| Compact queue with fixed dividers | Existing Annora lists; Linear density | Customer identity, current task and next owner have distinct emphasis |
| Scope / Pricing / Delivery groups | Mercury line-item editor | Group editable terms without introducing extra wizard steps |
| Full review before issue | Mercury review; approved Annora confirmation pattern | Draft saving never makes an offer visible to the buyer |
| Reply independent of version | Approved collaboration workflow | Clarification does not manufacture a revised quotation |
| Context on demand | Existing public Explorer controller | Reference the pinned part without adding another tree or renderer |
| Single-column mobile document | Shared component system | Read the complete quote before reaching its final confirmation |

The distinguishing interaction is one project carried across two roles: the
seller edits a private draft, explicitly issues a version, and the buyer sees
that exact version with its corresponding conversation. Ember indicates primary
actions; champagne marks completion; neutral dividers organize records. No new
palette or component language is introduced.


## Fixed presentation action

The customer-call walkthrough keeps the current Annora strip and host pages.
The user's requested single-button path is the interaction authority; the
existing reviewed-snapshot pattern remains the confirmation authority.

| Decision | Source and role | Application |
| --- | --- | --- |
| Fixed Continue demo control | Presenter needs one prescribed path | A stable control advances actual host actions and role handoffs |
| Confirm & continue label | Existing full-review boundary | Each final write requires another deliberate click after the full review opens |
| Ember only on the next action | Existing Annora action token | Neutral chapter navigation remains subordinate to the current action |
| Same buyer and seller pages | Existing shared components | No duplicate slideshow or hidden mock records can drift from the product |
| Sample preparation preserves edits | Approved manual takeover | Empty buyer fields receive sample values; saved seller drafts retain their terms |
| Explicit final outcome | Chapter 3 brief | Buyer sees the agreed engineering discussion with both quote versions retained |
