# Annora Explorer review and delivery guide

Annora connects a mechanical product's 3D presentation to a buyer's inquiry and
the seller's quotation workflow. A customer can point to a part or drawing
detail, discuss a specific revision and return to the quotation history.

**[Start the customer walkthrough](https://kyle-annora.github.io/annora-explorer/walkthrough/?new=1)**

Patrick and Wesley can open this public link without an account. It starts a
fresh fictional crank-slider project. Each browser has its own demonstration.

## Present one complete buyer and seller project

Use the top **Continue demo** button throughout. It opens the next view and
switches roles in the same tab. The current chapter, specific step and buyer or
seller identity stay visible. Guide contains chapter jumps and extra navigation.

| Chapter | What to show | Value to discuss |
| --- | --- | --- |
| 1. Understand the product | Play the short mechanism cycle, highlight the connecting rod and open an inquiry beside the model. Minimize it to continue exploring and return to the same draft. | The customer can explain their question using the product itself, without leaving the view. |
| 2. Get a quotation | Review the attached 3D reference and an inquiry for 20 assemblies, then confirm. Open the saved project, switch to the seller, prepare quotation v1, review it and issue it. | The seller receives a structured request with the exact product context; the buyer sees an issued quotation. |
| 3. Resolve and move forward | Request 30 assemblies and five weeks. Review the seller's v2 and compare the changed terms. Request an engineering discussion and confirm the seller's response. | Both sides can see the change, the response and the agreed next action in one project history. |

At six review gates the button becomes **Confirm & continue**. Read the content
before confirming. Preparing a request or quotation never skips that review.
Stop advancing or use the native editing controls whenever a customer wants to
explore a detail.

If the seller needs clarification before quoting, **Ask for clarification** adds
one reviewed seller question and one reviewed buyer reply. That optional branch
has eight confirmations in total. The guided button finishes a visible editor or
review before suggesting a role change.

The live selection and the attached request are deliberately separate. Changing
the part while exploring does not change the saved request. **Use current view**
explicitly replaces the attached reference. At review, the draft is read-only;
**Edit details** returns to the form before any confirmation.

The example deliberately preserves a commercial distinction: the buyer requests
five weeks; the seller proposes 6–8 weeks after technical review. The last screen
records agreement to an engineering discussion. It does not place an order.

Use **Guide → Start a new sample** to rehearse again. Share the walkthrough entry
link above; project-specific links refer to records in the current browser.

## Review the supporting capabilities

Open these after the main walkthrough when they answer a customer's question.

| Area | Review link | Available capability |
| --- | --- | --- |
| Interactive 3D | [Explorer](https://kyle-annora.github.io/annora-explorer/?model=kinetic-01) | Part selection, hierarchy, focus/isolation, explode/restore, authored motion and guided tours. Engineering materials, crisp linework and flat highlights share the same controls. Light/Dark, custom accents and an optional grid are available. |
| Buyer workspace | [Product Room](https://kyle-annora.github.io/annora-explorer/product-room/?model=kinetic-01) | Product information, specifications and documents; the same floating inquiry over 3D; saved projects; quotation versions, change requests, comparison and conversation. |
| Seller workspace | [Studio](https://kyle-annora.github.io/annora-explorer/studio/) | Product editing, part/document associations, inquiry configuration, buyer preview and reviewed content releases. Customer projects let the seller draft, review and issue quotations, then reply to requested changes. |
| Engineering drawings | [SK08 linked 3D and drawings](https://kyle-annora.github.io/annora-explorer/drawing-preview/?product=sk08&view=compare) · [Connecting-rod drawings](https://kyle-annora.github.io/annora-explorer/drawing-preview/?product=linkrods&view=drawings) | Click between a part and a drawing detail. Open a composed technical overview, zoom into a view or hole, and retain access to the original PDF. Ask about the selected detail in place, keeping its exact source, association and overview versions in the inquiry. |
| Seller drawing configuration | [SK08 in Studio](https://kyle-annora.github.io/annora-explorer/studio/#drawings?product=sk08) | Choose prepared views, adjust their order and link features. Preview and review an overview before publishing it locally. Import a new source drawing and directly mark regions for confirmed associations. |

Drawing updates have their own review process. A seller can introduce source B,
review its associations and explicitly adopt B in the same customer project.
Quotation v2 can reference B while quotation v1 and earlier discussions retain A.
Overview layout versions remain separate from engineering source revisions.

Apollo provides a larger structural exploration example through the Explorer's
model selector. The guided commercial case uses the crank. Polished technical
views use prepared geometry and reviewed associations; arbitrary PDF uploads do
not automatically acquire that presentation.

## Reuse the Explorer for another product

The public [GitHub template](https://github.com/kyle-annora/annora-explorer) includes
project configuration, model preparation tools, English instructions and an
automated validation/deployment workflow. Brand, model selection and enabled
features can be configured per project.

- [Create a repository from the template](https://github.com/new?template_name=annora-explorer&template_owner=kyle-annora).
- [Review the independently deployed bench-vise example](https://kyle-annora.github.io/annora-explorer-bench-vise/).
- [Try the external host example](https://kyle-annora.github.io/annora-explorer/examples/embed/).

Another website or application can embed the Explorer through an iframe and its
JSON controller. The host can discover available functions, select a part, frame
a view, run a tour and save a compatible camera bookmark.

New products require prepared model assets, stable part identities and authored
motion or tours. The importer accepts prepared GLB files. Customer-specific
product facts and quotation rules need their own reviewed content.

## Current deployment and the first customer pilot

This deployment uses fictional commercial data and browser-local storage. Buyer
and seller views demonstrate the workflow on one browser. Real accounts,
permissions, shared project storage and durable message delivery need Annora's
future backend adapters. A Studio demo release is local; publishing it to the
shared website uses the separate export, validation and deployment process.

For a first customer pilot, select one product and one inquiry scenario. Request
a redistributable assembly, matching drawing revisions, part names, approved
product information and sample quotation terms. Assign a technical owner to
confirm the associations and one commercial owner to review the quotation path.

Agree which outcomes to measure before connecting real traffic: inquiry
completion, clarification rounds, time to an issued quotation and whether users
can identify the correct revision. These are pilot measures, not demonstrated
conversion or revenue results.

Desktop and mobile viewport checks are recorded. Qualification on customers'
physical phones and ordinary computers remains part of pilot acceptance.

## Engineering handoff and evidence

| Topic | Documentation |
| --- | --- |
| Project setup and publication | [Configuration](configuration.md), [model packages](models.md), [deployment](deployment.md) |
| External integration | [Embedding guide](integration.md), [Explorer API](api.md) |
| Buyer and seller data boundaries | [Product Room API](product-room-api.md), [Studio API](studio-api.md) |
| Drawing versions and authoring | [Drawing reader](drawing-reader-integration.md), [Studio overview configuration](studio-overview-authoring.md), [source A to B verification](drawing-revision-review.md) |
| Delivery process | [Architecture](architecture.md), [decisions](decisions.md), [evaluation matrix](evaluation.md), [AI-assisted project skill](../.agents/skills/explorer-project/SKILL.md) |

See the [current delivery program](explorer-to-quote-program.md),
[progress and release checkpoint](explorer-to-quote-progress.md), and
[integration review](explorer-to-quote-review.md) for tested routes and current
publication status. The [earlier walkthrough acceptance record](walkthrough-simplification-review.md)
is retained as historical evidence; it is not the current release claim.
