# Product walkthrough

The [public walkthrough](https://kyle-annora.github.io/annora-explorer/walkthrough/)
connects the existing Explorer, buyer Product Room and seller Studio through one
fictional crank-slider project. Patrick and Wesley can use this single link in a
customer conversation without an account or repository access.

## Present the three chapters

Use the fixed **Continue demo** button in the presentation strip. It prepares
fictional sample input, opens the next view and switches between buyer and seller
in the same tab. At every full review it changes to **Confirm & continue**. Read
the document, then press it again to confirm that specific action. There is no
background submission or timed advancement through a confirmation.

The standard rehearsal uses the same button throughout:

1. **Understand the product.** The first press plays one short crank cycle and
   highlights Connecting rod. The next opens an inquiry with that part attached.
   Existing pause, replay and free exploration remain available.
2. **Get a quotation.** Continue fills empty inquiry fields with fictional
   requirements for 20 assemblies and opens the full review. Confirm, then
   continue to the seller. Continue prepares a private sample quotation for
   review; a separate confirmation issues v1. Existing saved drafts retain their
   entered terms.
3. **Resolve and move forward.** Continue to the buyer, review a request for
   30 assemblies and five weeks, and confirm. Continue to the seller to review
   v2 and the reply to each requested change. Quantity is accepted; proposed
   delivery remains 6–8 weeks after technical review. Confirm v2, then continue
   to the buyer to compare versions and review an engineering-discussion request.
   Confirm the request, continue to the seller, review the acknowledgment and
   confirm it. Continue once more to the buyer-visible agreement.

The guided sample needs no manual data entry or search for page buttons. The
presenter controls the pace: the standard path takes 20 deliberate presses,
including six separate confirmations and six role handoffs. Native page controls
remain available for questions or manual editing. Returning to the guide uses the
current project state, and does not replace entered values. Validation errors
stay on the current form until the presenter corrects them.

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
The presentation action invokes the host’s existing review and confirmation
handlers. It does not override these business rules.

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
  route, host-action and successful-mutation events, with no continuous polling
  or render loop. Chapter state follows the case rather than a stale link hint.
- `src/walkthrough/actions.js` holds current host action descriptors in memory.
  Buyer and seller views register their own handlers and unregister on departure.
  The strip does not query button text, synthesize clicks or mutate records. A
  single-flight guard and brief repeat-click lock protect review boundaries.
- `src/walkthrough/viewer-action.js` uses the existing public controller to play
  the short cycle and select the rod. Reduced motion presents a paused pose.
  The helper contains no renderer, animation clock or domain write.
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

The [one-button follow-up review](one-button-walkthrough-review.md) records the
fixed-action rehearsal, confirmation boundaries, keyboard and responsive checks.
