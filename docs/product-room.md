# Product Room

Product Room connects the existing Explorer to a continuing customer project.
The crank sample supports a complete inquiry, seller-authored demo quotation,
revision, conversation, version comparison and next-step request. Studio supplies
the seller workspace. Product facts and commercial figures are explicitly
illustrative.

## Review routes

- [Product Room / 3D entry](https://kyle-annora.github.io/annora-explorer/product-room/)
- [My projects](https://kyle-annora.github.io/annora-explorer/product-room/?model=kinetic-01#projects)
- [New crank inquiry](https://kyle-annora.github.io/annora-explorer/product-room/?model=kinetic-01#inquiry)
- [Component catalog](https://kyle-annora.github.io/annora-explorer/product-room/#components)
- [Apollo presentation](https://kyle-annora.github.io/annora-explorer/product-room/?model=apollo#explore)

Use the same paths on the development server. Public product pages are Explore,
Overview and Specs & docs. They are free navigation, not steps a buyer must finish.
The quotation sample is deliberately scoped to the crank. Apollo keeps its
existing structural presentation and reviewed, in-memory discussion dialog.

## Customer walkthrough

1. Open the default Room. Inspect the crank, rod or carriage, or use the unchanged
   guided tour. Select **Request a quote**. The exact model revision and optional
   selected part/chapter are attached as reference context, not confirmed needs.
2. Enter an application and quantity, or choose **Use sample details**. Technical
   details and fictional contact information can remain open. Explicitly confirm
   a stroke requirement if relevant; editing its value clears that confirmation.
3. Choose **Review inquiry**. Inspect the read-only request, then either edit it
   or **Confirm demo inquiry**. Only confirmation creates a project and immutable
   RFQ. A draft is not a submitted inquiry.
4. The saved project awaits a quotation. Use **View as seller** to open the same
   case in Studio. Save a quotation draft, review the complete customer-facing
   document, then explicitly issue demo v1. The buyer cannot see an unissued draft.
5. As buyer, choose **Request a change**, then **Use sample changes** or enter
   quantity, requested timing and a question. Review the exact changes against
   that quotation version before confirming the demo request.
6. As seller, clarify or explain without automatically creating a version. Reply
   to each requested change and issue reviewed v2 when commercial terms change.
   As buyer, compare the versions and inspect the original v1. Conversation keeps
   the requests, authored replies and unresolved questions together.
7. From the latest quote, choose the next step. Enter a discussion or engineering
   review request, review it and explicitly confirm. The seller can acknowledge
   it. This records a local demo agreement on the next action, not an order,
   acceptance, payment or supplier commitment.
8. Reload or return through **My projects**. The original inquiry, quotation
   versions and confirmed requests remain in this browser.

## Records and truth boundaries

Inquiry drafts auto-save locally, with an explicit Save draft alternative.
Reviewed RFQs, quotes, changes, replies and next-step requests are separate
records. Duplicate confirmation reuses its result. Stale reviews cannot silently
submit against a newer project version. Browser-storage failures keep the input
and do not produce a success message. Unknown/corrupt records are not erased.

Only the customer can explicitly confirm a requirement. Viewing a component,
matching a model dimension or loading a sample does not verify application fit.
Customer timing is a request. Unknown prices remain null; a subtotal is not a
complete offer. Example supplier replies do not answer arbitrary technical text.
Open questions stay attached across revisions.

Inquiry drafts and confirmed records persist in this browser. Unconfirmed change
and next-step forms are working-session UI state, not cloud-saved drafts. There
are no accounts, cross-device links, real messages or production customer data.
A project URL identifies a record in the current browser; it is not a shared or
private customer portal link. Use fictional details in this public demonstration.

## Product and renderer boundary

The Room uses one iframe and the existing JSON controller. It does not own
Three.js objects, modify the Explorer or add an animation loop. Playback pauses
before navigating to reading/project pages. The iframe is retained when returning
from a project; direct project entry does not load 3D assets until needed.

Workspace React and Base UI code are loaded only when a customer-project or
component route opens. Overview, Specs and the standalone Explorer do not need
that runtime. The component catalog renders the same controls as the workspace.

The exact model revision accompanies each product/part/document/chapter context.
A changed revision cannot silently reuse old component IDs. A new model requires
its own reviewed Room content and commercial adapter; geometry does not generate
technical facts or pricing. Only configured sample models appear in the Room.

The printable files in `product-room/files/` are sample technical briefs, not
manufacturer-certified specifications. All public assets must be redistributable.

## Implementation and handoff

- [Design decisions and reference lock](product-room-design.md)
- [Shared component contract](product-room-components.md)
- [Project repository API and future backend boundary](product-room-api.md)
- [Explorer host integration](integration.md)
- [Studio proposal and updated scope](product-room-studio-proposal.md)

NHI supplies workflow and component-ownership references. Annora's existing
silver/graphite/Ember visual language remains authoritative. The shared component
folder is a local library used by Room; it is not yet a separately published
package. Both buyer and seller workspaces reuse it.

See the [release review and recorded checks](product-room-release-review.md).

## Acceptance checks

Run `npm run verify`, then serve `dist/` under `/annora-explorer/` and inspect:

| Area | Required result |
| --- | --- |
| Entry and return | Default 3D, supported part/chapter links, one retained iframe |
| Confirmation | Inquiry, changes and next-step forms require read-only review before confirmation |
| Requirement evidence | No implicit confirmation from selection; value edits clear confirmation |
| Immutability | New quote or draft edits never rewrite a saved inquiry or old quote |
| Version context | Requests bind exact quote/version; old versions offer return to latest |
| Replies | Seller clarification/reply independent of quote issuance; explicit outcomes and next owner |
| Persistence | Reload restores records; duplicates, stale edits and blocked storage handled honestly |
| Mobile | 320–390px portrait and short landscape; reachable actions, readable comparison, no page overflow |
| Keyboard | Visible focus, named controls, usable tabs, forms, review and error recovery |
| Performance | Reading/project entry avoids model downloads; paused hidden Explorer; no second canvas |
| Regression | Existing Explorer styles, motion, tours and model switching unchanged |

Record actual device/viewport checks separately from assumptions. Desktop-browser
responsive checks do not establish physical phone or entry-level GPU performance.
