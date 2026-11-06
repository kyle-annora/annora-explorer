# In-context inquiry · approved implementation

Approved on November 5, 2026. This first iteration connects the prepared crank
product to the existing buyer and seller workflow. It does not change the
Explorer's renderer or create a second quotation system.

The follow-on [delivery program](explorer-to-quote-program.md) extends this same
surface to Product Room, the guided walkthrough and prepared drawing hosts. Its
[integration review](explorer-to-quote-review.md) records the new scope separately
from this original pilot record.

## Customer journey

The customer can start from a selected component, an authored chapter, or the
header. Each entry opens the same saved request beside the model. The customer
can minimize the panel, continue exploring, and return without losing work.

1. **Your request:** choose a quotation or application review, describe the need,
   and supply relevant details. Optional technical and contact fields are
   disclosed when needed.
2. **Review:** inspect the exact reference, scope, entered requirements and
   contact details. Edit before explicitly confirming the demo inquiry.
3. **Receipt:** remain in the Explorer or open the saved project. Product Room
   owns follow-up and quotation history; Studio owns the seller's response.

A quotation needs a quantity. An application review may leave quantity unknown.
Neither a selected mesh nor its mesh count proves separate sale availability,
order quantity, dimensional accuracy or suitability.

## Confirmed interaction decisions

- Contextual entries converge on one draft per existing product/version key.
  Opening another entry resumes that draft; it does not create a duplicate.
- The selected 3D part and the inquiry's attached reference are separate states.
  Live navigation never silently replaces the saved reference or quoted scope.
- An explicit reference-update action captures the current settled view and
  invalidates a prior review. A different component requires scope reconsideration.
- Capture pauses authored movement and retains model revision, selection, scope,
  camera and supported timeline state. Capture uses the existing renderer.
- Desktop uses a nonmodal working panel. The model remains operable. Mobile uses
  an expandable sheet; the persistent **Continue request** header resumes it
  when minimized, keeping the tour scrubber and model controls unobstructed.
- Closing/minimizing saves rather than discards. A failed save retains inputs
  and explains the failure. The view reflows around the panel once; editing does not repeatedly move the camera.
- Two visible stages suffice. Intent-dependent fields do not create additional
  mandatory Next clicks. Review and explicit confirmation are always retained.
- Historical inquiries and issued quotations keep their original rules and
  references. Missing historical intent is not retroactively assigned.
- A draft changed in another tab requires an explicit reload choice. The local
  entries remain visible until the customer chooses to replace them. The receipt
  offers a deliberate new-inquiry action without changing its completed project.
- The demo remains browser-local. A successful demo confirmation is not delivery
  to a real seller. Repositories remain asynchronous service boundaries.

## Reference lock

The approved Annora interface remains the visual source: neutral surfaces,
compact floating controls, established typography and configurable accent.
The selected-component card is the primary location for a contextual action.

- [Faire request flow](https://refero.design/flows/13083): initiate a request while
  retaining the product browsing context.
- [Farfetch quotation flow](https://refero.design/flows/3551): reveal relevant
  questions and present an editable review before confirmation.
- [Linear creation panel](https://refero.design/pages/e5fb7da7-81e7-4855-880d-9cb566924d24):
  prioritize the need and keep optional metadata compact.

These references inform structure, not brand styling. The panel must not dim or
lock the desktop model. Keep one dominant action in each panel state.

## Shared harness interpretation

Accepted intake decisions INT-1/INT-2 support one request across entry points.
The MPI request pattern supports asking only for missing information and showing
the provenance of carried context. Detailed branching and modal guidance in the
shared harness remain proposals; they do not override this approved floating
panel or the existing draft-save behavior. Human comprehension review remains
separate from automated functional checks.

## Boundaries and evaluation

First pilot: the configured crank product, component/product quotation and
application review, selected-component/chapter/header entries. Preserve existing
full-page inquiry routes, buyer/seller review gates and immutable quotations.

Later: drawing-region entry, returning-customer changes, wider model rollout and
external-viewer adapters. Those capabilities require their own reference and
identity validation; this iteration does not claim they are integrated.

Acceptance evidence belongs in `work/embedded-inquiry-review/`: both intents,
save/resume, explicit reference replacement, desktop and mobile, keyboard/focus,
failure recovery, seller review, unchanged history and compiled subpath. Record
the deployed commit and verify the public target before declaring publication.
