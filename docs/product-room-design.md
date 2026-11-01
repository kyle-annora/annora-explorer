# Product Room design contract

## Scope and reference lock

This release adds a complete, fictional customer project around the existing
crank-slider Explorer. It does not redesign the Explorer, its floating controls,
camera, rendering modes or authored animation. Studio remains a later phase.

The approved Annora Product Room is the primary visual source: graphite product
navigation, a silver reading surface, compact sans-serif typography, monospace
metadata, restrained separators and Ember for the primary decision. Product
context is carried from the 3D viewer into an inquiry; the canvas remains useful
without starting a commercial workflow.

NHI's reviewed inquiry and quotation workflow is the secondary interaction
reference. Its useful patterns are explicit requirement confirmation, immutable
saved inquiries, exact quotation versions, reviewed change requests, replies with
unresolved items, and a visible comparison. Its green branding, pulley-specific
dimensions, example prices and customer data do not belong in Annora.

Refero research also reviewed the Linear changelog style and shadcn's component
presentation. The bounded borrow is state visibility and disciplined hierarchy;
neither overrides Annora's approved palette, density or four-pixel control radius.
No new photographic or decorative assets are needed for the workflow.

## Decision ledger

| Decision | Source and role | Reason |
| --- | --- | --- |
| Keep the existing 3D stage and header language | Approved Annora Product Room | The model and its interaction remain the product anchor |
| Silver content, graphite text, Ember primary actions | Existing Annora tokens | Preserve continuity with the current experience |
| Use one primary action per decision; outlined alternatives and quiet navigation | Approved CTA hierarchy | The next step is clear without removing escape routes |
| Hide the global inquiry CTA inside the customer workspace | Approved CTA hierarchy | The current review or confirmation owns the primary action; My projects remains available |
| Keep initial inquiry to details and review | User's two-step requirement and NHI RFQ pattern | A customer can read the complete request before confirming |
| Separate selected/viewed context from explicitly confirmed requirements | NHI evidence contract | Inspecting a part is not an engineering commitment |
| Retain each saved inquiry and quote version | NHI commercial workflow | Returning customers can recover the actual history |
| Show the customer's request separately from the supplier's proposed response | NHI revision/reply pattern | A requested timing or price is not an accepted promise |
| Derive progress from records | NHI workflow adapter | Visiting a view must not mark the business step complete |
| Use compact fixed dividers in lists and comparisons | Existing Annora and NHI workspace patterns | Records are distinguishable without excessive card containers |
| Preserve field values on failure and require review again after edits | NHI state/recovery rules | Customers do not lose work or confirm stale information |
| Stack comparison columns into labelled pairs on narrow screens | Mobile constraint | Version differences remain readable at 360 CSS pixels |

## Token roles

`src/product-room/ui/tokens.css` is scoped to `.room-ui`.

- Canvas: `#f4f4f3`; controls/documents: white; subtle rows: neutral silver.
- Main text: `#292b2e`; secondary text: `#64686c`.
- Ember uses the host's existing `--accent` (`#ff6840` by default). It identifies
  a primary action or active attention state, never an approval guarantee.
- Champagne marks a completed/demo result without introducing green.
- Error text and error borders use a separate muted red-brown token.
- Controls have a 44px minimum target and 4px radius. Mobile inputs use 16px text.
- Focus is a visible graphite ring separated from the component border.
- Monetary and version data use tabular numerals where displayed in comparisons.

## State and content rules

Every final transition has a review boundary. Draft content remains editable;
saved records are isolated snapshots. A new version appends history. A label such
as “Sample quote” must remain present when example commercial data is displayed.
Unknown amounts remain unknown; pending freight or tax must not appear as zero.

The UI does not determine product suitability, pricing policy or supplier
approval. Those belong to the domain model and eventual host service. Buttons
report the operation's actual pending/success/failure state, with no cosmetic
production delay. Only the isolated component catalog uses a short delay to make
its pending example observable.

## Evaluation boundaries

Review the visual state catalog separately from the commercial journey. A correct
button does not prove that a quote request references the right version.

The full journey must be exercised through inquiry review, project return,
quotation, reviewed change request, deliberate sample reply, version comparison
and reviewed next-step request. Check saved state after reload and verify that
earlier snapshots remain unchanged. Check failure recovery and stale actions in
domain tests. Inspect desktop and mobile rendering, keyboard focus, long text,
empty states and disabled/pending controls in the browser.

The performance boundary is the unchanged Explorer and one viewer instance.
Commercial content does not need a second WebGL renderer. Device measurements are
reported only for the actual environment used; mobile viewport checks are not
hardware benchmarks.
