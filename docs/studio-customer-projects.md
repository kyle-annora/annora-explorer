# Studio customer projects

Studio and Product Room are two views of the same browser-local customer case.
Products manages reusable product content. Customer projects manages an individual
inquiry, seller quotation drafts, issued versions and customer conversations.
All demonstration names, prices and commercial terms are fictional.

## Open the workspace

- Seller queue: `studio/#projects`.
- Seller case: `studio/#project?id=<project-id>`.
- Buyer case: `product-room/#project&project=<project-id>`.

Use the role links to review the same case from either side. They are demo
navigation, not authentication or account switching. A project saved on one
browser/device is not available on another. Studio's product-preview inquiries
remain isolated from these customer records.

## Work queue and project structure

The compact list prioritizes the next action, its owner, the latest quotation and
recent activity. Filters separate **Needs your attention**, **Waiting for
customer**, and **All projects**. Buyer inquiry drafts never enter the seller
queue; only confirmed inquiries do.

Each case has **Inquiry**, **Quotation**, and **Conversation** views. Its product,
model, document and form references remain pinned to the inquiry's original
snapshot. Open the contextual Product Room to inspect the part in the existing
Explorer. The project queue and quotation editor do not start a WebGL viewer.

The inquiry identifies whether the customer requested a quotation or application
review and consultation. An application review can arrive with quantity unknown.
Keep that uncertainty visible and ask for clarification when needed. Preparing a
quotation requires the seller to enter a valid quantity before issue; opening a
draft does not substitute one unit or change the customer's original request.

## Quotation boundary

1. Prepare a seller draft: scope, quantities, line items, proposed lead time,
   assumptions, exclusions and validity.
2. Save at any time, or choose **Review quotation** to save and inspect the exact
   customer-visible document.
3. Explicitly issue the reviewed demo quotation. Only then does it appear in the
   buyer's project.

Saving a seller draft does not change the buyer-visible quotation. Issued
versions are immutable. Revising one creates another draft; publishing that draft
appends the next version. A failed save or issue must not show a successful
receipt or discard the input. Unknown prices are pending, not zero. The priced
subtotal is distinct from a final total, and requested timing is distinct from
the seller's proposed lead time.

## Communication and modifications

A seller can request clarification or send an explanatory reply without making a
new quotation. Customer replies remain linked to the question they answer.
Requested quantity, timing and other changes receive explicit responses. A reply
that asks for more information leaves the request open. Changed commercial terms
require a reviewed quotation version; both sides can compare it with its
predecessor. Original requests and messages remain in history.

A customer's discussion or engineering-review request can be acknowledged by the
seller. That acknowledgement confirms the next action, not an order, payment,
contract acceptance or a completed sale.

## Review walkthrough

Use the prepared crank model and the fictional Example Automation customer.

1. In Product Room, select a relevant component, start an inquiry, use sample
   details or enter fictional requirements, review, and confirm the demo inquiry.
2. Open the same project as seller. Review the original request and prepare a
   quotation with scope, pricing and lead-time assumptions.
3. Save the draft. Open the buyer view and confirm it still awaits a quotation.
4. Return as seller, review the complete document, and explicitly issue v1.
5. As buyer, request a quantity change from 20 to 30 and a shorter requested
   timeframe. Review and confirm the modification request.
6. As seller, ask a clarification question. Confirm that this does not create v2.
7. As buyer, reply. As seller, address the requested changes and issue a reviewed
   v2. Do not silently treat requested timing as an accepted delivery promise.
8. As buyer, compare v1 and v2, open the earlier version, and return to the latest.
9. Request engineering review. As seller, acknowledge the next step. Both sides
   should display the same referenced quotation and conversation history.

The workspace's explicit sample-inquiry action is a shortcut for opening a new
fictional case. It must not overwrite existing inquiries, drafts or quotations.

## Service handoff

See [customer-project API](product-room-api.md). The host uses asynchronous
repository methods; final actions accept reviewed packets. A production adapter
must enforce tenant and role access, buyer/seller projections, immutable issued
versions, transaction boundaries, idempotency and durable history itself.
Browser-local projection is not a security boundary. This release adds no
backend, real delivery, account integration or credentials.

## Acceptance coverage

- Buyer drafts absent from seller queue; seller drafts absent from buyer reads.
- Explicit review before issuing a quote, reply or next-step acknowledgement.
- Reply-only actions do not create a quotation.
- Change outcomes and next-action ownership remain explicit.
- Earlier quotations and product snapshots remain unchanged.
- Reload, duplicate confirmation, stale edits, failed writes and cross-tab changes
  preserve data or return actionable errors.
- Responsive list, fields, conversation and comparison at 320 px and desktop.
- No automatic model download in queue/editor; existing Explorer unchanged.

See the [release review](studio-projects-release-review.md) for observed results,
screenshots and limitations.
