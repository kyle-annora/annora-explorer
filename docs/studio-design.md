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

No CAD editing, automatic motion inference, material authoring, arbitrary uploads, real authentication, customer data, supplier inbox or cloud publication service is introduced. Existing prepared actions and model packages remain the source of 3D behavior. These boundaries do not prevent a future host from implementing durable Studio and customer-project adapters.
