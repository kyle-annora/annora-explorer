# Product walkthrough

The [public walkthrough](https://kyle-annora.github.io/annora-explorer/walkthrough/)
connects the existing Explorer, buyer Product Room and seller Studio through one
fictional crank-slider project. Patrick and Wesley can use this single link in a
customer conversation without an account or repository access.

## Present the three chapters

Allow approximately five to seven minutes with narration. The presentation strip
shows the current role, chapter and next action. **Continue as buyer** and
**Continue as seller** keep the same case in the same tab. **Find next action**
locates the relevant control without submitting anything.

1. **Understand the product.** Run one short operating cycle. Select Connecting
   rod and show its product information. Start an inquiry from that selection.
   Explain: “We begin with the part and the question your customer is looking at.”
2. **Get a quotation.** Use sample details for 20 assemblies. Review and confirm
   the inquiry. Continue as seller, inspect its product reference, prepare the
   quotation and fill demo pricing. Enter a proposed lead time such as 6–8 weeks
   after technical review. Save the draft, review the complete document and issue
   v1. Explain: “The seller receives the context and requirements together. Drafts
   stay separate from the quotation the customer receives.”
3. **Resolve and move forward.** Continue as buyer and request a change using the
   sample values: 30 assemblies and five weeks requested. Review and confirm.
   Continue as seller, prepare the next quotation version, update the quantity
   and pricing, and respond to each requested change. Keep the proposed lead time
   distinct from the customer's requested timing. Review and issue v2. Continue
   as buyer, compare the changed fields and request an engineering review. As
   seller, review and confirm the next-step response. Explain: “The request,
   response and revised quotation stay in one project, with a clear next owner.”

The final state confirms a discussion or engineering review. It does not create
an order, accept a contract or process payment. All names, prices and terms are
fictional. Nothing is emailed or sent outside this browser.

Studio product editing and publishing remain available as an optional follow-up.
They are not required to complete the three-chapter customer conversation.

## Start and resume

Opening `/walkthrough/` creates a separate local sample session on first use and
resumes it on later visits. A fresh session enters Product Room in 3D; a resumed
session opens the saved case at its next role/action. Only existing explicit
review and confirmation actions create inquiries, quotations or messages.

Use **Guide → Start a new sample** to begin another demonstration. This creates a
new namespace and keeps the previous sample and ordinary projects intact. The
guide also contains the current presentation instruction on small screens.

Data stays in the current browser. Share the public entry link, not a local
project-specific URL, with another presenter. Each browser gets its own sample.
The demonstration is not a shared account or a cloud workspace.

## Navigation and state corrections

The [pre-implementation audit](demo-walkthrough-plan-and-audit.md) recorded the
original problems. This release addresses them as follows:

| Audit | Corrected behavior |
| --- | --- |
| W01 | A saved 3D reference returns to the originating buyer or seller project, preserving its view. |
| W02 | Page transitions reveal the local return row above the title and clear sticky navigation, including presentation chrome. |
| W03 | Saving a quotation refreshes the project projection; status, main action and empty state consistently recognize the saved draft. |
| W04 | Buyer tab, version, request stage and seller tab, version, editor/review stage have explicit routes. Saved input is restored where supported; ended quotation drafts resolve to the project. |
| W05 | Role handoffs remain in the same tab, preserving project and demonstration session. |
| W06 | Both quotation views show changes before the full document, with unchanged rows available on demand. Buyer next actions appear above the document on mobile. |
| W07 | Seller focus handling checks revisions before showing a stale-project warning. |
| W08 | Inquiry instructions describe the seller's reviewed quotation workflow. |

Historical quotations remain read-only. Pending changes, clarification and
next-step requests keep their state-specific actions and visible explanations.
The presentation navigator does not override these business rules.

## Implementation boundaries

- `walkthrough/index.html` and `src/walkthrough/entry.js` create or resume a sample
  and navigate into the existing hosts.
- `src/walkthrough/session.js` wraps the existing asynchronous project repository
  with a non-overridable storage namespace. Ordinary buyer and seller APIs remain
  unchanged. Metadata uses `annora.walkthrough.session.v1`; project records use
  `annora.walkthrough.projects.v1.<session-id>`. Studio authoring in a walkthrough
  also uses a separate store.
- `src/walkthrough/flow.js` derives guidance from recorded state. It performs no
  business mutation. `chrome.js` renders the compact navigation and listens for
  route and successful-mutation events, with no continuous polling or render loop.
- Host navigation handles `annora:walkthrough-navigate` through existing unsaved
  input guards. `annora:routechange` updates guidance; successful session mutations
  emit `annora:walkthrough-change`.
- Malformed session links show recovery rather than opening the ordinary project
  repository. Restart never clears other storage namespaces.
- Product Room uses the bundled crank content for the sample, so unrelated Studio
  edits cannot change the demonstration. Existing projects retain their pinned
  product reference. Explicit Studio preview/release links read the isolated
  authoring snapshot instead. Preview inquiries use disposable memory and never
  become the demonstration's customer case.
- The Explorer runtime, model packages, renderer and animation controls are
  unchanged. Commercial pages do not introduce another renderer.

## Verification

The release checks include the repository validation/build suite and browser
rehearsals through the actual controls, rather than manual URL shortcuts between
roles. Desktop and mobile checks cover:

- Short mechanism motion and selected-part context carried into reviewed inquiry.
- One case, session and tab throughout v1, change request, v2 and next-step confirmation.
- Saved draft visibility and review-before-issue boundaries.
- Browser Back/Forward, reload, historical quotation selection and ended-draft recovery.
- Changes-first comparison, reachable action controls and responsive layout.
- Restart, resume, malformed-session recovery and unchanged ordinary project and
  Studio records, checked byte-for-byte against preloaded fixtures.

See [release verification](demo-walkthrough-release-review.md) for exact build,
viewport and deployment results. Responsive browser emulation does not establish
physical-device or lower-end GPU performance.
