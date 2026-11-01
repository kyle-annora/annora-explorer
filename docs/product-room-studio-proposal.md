# Product Room and Studio — discussion proposal

Date: 2026-11-01. Status: **Product Room implementation approved and delivered for review. Studio remains deferred.**

See [Product Room implementation and review](product-room.md) for the shipped routes, boundaries and checks.

This is an information architecture and scope proposal. It does not change the
Explorer, its interface, model packages, rendering or interactions. The agreed
sequence is Product Room, then Studio, then end-to-end validation, followed by
durable sharing and a real customer pilot. Room details have been approved for
the static demo; Studio choices still need review. No backend or real customer
data service is included.

## Product purpose and ownership

Product Room helps a buyer understand one product, inspect supporting information
and prepare a useful next conversation. Studio lets the Annora delivery team and
an authorized manufacturer author that experience. Explorer remains the shared
renderer and player.

Initial audiences:

- A buyer or application engineer exploring independently.
- A salesperson presenting the same product during a call.
- A content author preparing the Room in Studio, with a technical reviewer
  responsible for product facts and motion claims.

One Room initially presents one product and an explicitly pinned model revision.
This first scope is a product-level presentation, not a private account-specific
deal room. Private projects, pricing, negotiation and persistent customer history
will require a future host application with real access control.

## Product Room information architecture

Three top-level destinations and one contextual action:

```text
Product Room
  Explore                 default entry; existing Explorer
  Product overview        what it does, why it matters, what to inspect
  Specs & documents       approved facts and supporting files
  Discuss your application
    Draft request -> Review -> Confirm -> Demo receipt
```

Direct entry into Explore keeps the 3D product immediately visible. A compact Room
header identifies the product and offers the three destinations. A first visitor
can use the existing guided tour or open Product overview. Returning from content
to Explore retains the current in-session selection and paused presentation.
This temporary session behavior is distinct from durable saved-view sharing.

### R1 — Explore

Purpose: understand the product spatially and mechanically.

- Existing Explorer in one large, full-width iframe below a compact Room header.
- Preserve the component tree, selected-part information, render modes, material
  controls, short actions, takeover, source attribution and tour transport.
- Do not add a second outer tree, property inspector or animation transport.
- Room navigation and its contextual inquiry action live outside the iframe.
- A Room-level action can use the selected part as context; at the root it refers
  to the product. It must not imply a hidden subassembly has been selected.
- The external Room shell may provide a focus view that hides its own navigation;
  the embedded Explorer remains unchanged.

Only one live WebGL instance is mounted. Inactive content destinations pause it.
An unavailable 3D model does not prevent reading the overview or documents; show a
representative poster, a useful error and Retry while keeping those routes usable.

### R2 — Product overview

Purpose: explain the product's relevance and provide a useful presentation order.

Use a product image or static render, a short value statement, a small set of
approved facts, and three buyer questions. Avoid repeating the component tree.
Each question connects a business or engineering explanation to an authored
chapter or a compatible prepared view.

Illustrative crank content:

| Buyer question | Explanation to author | Related presentation |
| --- | --- | --- |
| How does rotary motion become linear travel? | Describe the crank, rod and guided carriage | Existing motion chapter |
| What constrains the path? | Explain the guide and bearing relationships | Guide selection / prepared view |
| How do the parts fit together? | Explain the two joints and assembly order | Existing separation chapter |

Each entry has a title, a short explanation, optional evidence, and one action such
as `See how it works`. The action opens Explore at that explanation. Apollo uses
structural questions; it must never be offered an operating action it lacks.
Do not invent claims about precision, throughput or maintenance intervals from
the geometry. Unverified facts stay out of the buyer-facing release.

### R3 — Specs & documents

Purpose: help the buyer find the evidence needed for evaluation.

- Group approved specifications by meaning: dimensions, operating envelope,
  interfaces and application requirements, where supported by supplied content.
- Show values with units and qualifications. Do not use raw CAD property keys as
  customer labels. Preserve a source reference and approval state internally.
- Use a compact document list with stable dividers, title, type, revision/date and
  product/part association. Support preview or open/download as appropriate.
- A relevant fact or document can link to a component in Explore. Returning from
  that inspection should retain the document/filter context.
- Missing information is explicitly `To confirm`; absent categories are omitted.
  Empty categories are not decorative cards.
- Small inventories need grouping rather than a complex filter system. Add search
  only when the actual content volume justifies it.

Files in a public static prototype must be redistributable samples. Hiding a URL
or control is not access control for confidential drawings.

### R4 — Contextual request, shared by all destinations

Purpose: carry a precise question or next-step request into the conversation.

This is a focused panel on desktop and a full-screen sheet on mobile. It is not a
fourth permanent workspace competing with the three content destinations.

1. **Draft:** show attached product, selected part when relevant, and associated
   document or authored chapter. Ask for one question/request and a preferred
   next step. Collect only the contact information required by the configured
   host. Context is visible and removable; it is never silently inferred.
2. **Review:** show the exact message, context and contact destination. Allow Edit.
   Only this screen exposes the final confirmation action.
3. **Receipt:** in the prototype, state that this is a demo request and no message
   was sent. Preserve a recoverable local draft only if local storage is explicitly
   implemented; do not imply an account, cloud sync or delivery.

An authored chapter reference is enough to identify a tour explanation. Capturing
an arbitrary running-tour pose is not supported by the current bookmark API.
Opening a request pauses playback; returning does not resume it automatically.

Private question threads, quotations, signatures, shared task plans and CRM
delivery are later host capabilities. A compact synthetic request summary may
demonstrate the eventual handoff, clearly labeled as sample data.

## Navigation, presentation and mobile rules

- Keep one active activity: exploring, reading evidence or preparing a request.
  Do not layer Room forms over the Explorer's own open controls.
- Room navigation uses text links. Secondary actions use outlines. The current
  task has one strongest action, especially on review/confirmation screens.
- Retain the approved graphite/silver-neutral visual system, restrained borders,
  current typography and configurable customer accent. Ember remains the default
  model highlight. Do not introduce a new palette or generic metric dashboard.
- Product overview uses an image plus short explanatory entries; technical content
  uses aligned rows and dividers. Distinguish headings, values and metadata.
- Mobile presents the same three destinations with compact navigation. Entering
  Explore gives the existing responsive viewer a usable stage; reading and request
  forms take over the screen instead of shrinking the canvas into several columns.
- Navigation away pauses playback. Reduced motion and manual takeover remain
  authoritative. Files and facts remain usable without loading the 3D package.
- Studio is initially a desktop authoring tool. Phone support covers Room preview,
  content/release review and simple text corrections; dense chapter authoring is
  not claimed to be comfortable on a phone in this first scope.

## Studio derived from the Room

Three core surfaces: Rooms list, Room editor, and Preview & release review.

### S1 — Rooms list

A compact list with product/Room name, thumbnail, draft/release state, last edited
time and the version currently used by the Room. Main action: `Create room`.
Per-row action: `Open studio`; preview is secondary. Start from an existing prepared
model package. Traffic charts, lead scores and team-performance KPIs are excluded.

### S2 — Room editor

One editor with a section list, a large preview and a contextual editing panel.
The editing panel concerns Room content; it is not another copy of the Explorer's
component UI. Toggle between content editing and full viewer inspection rather
than keeping two trees and two inspectors visible.

| Room output | Studio editing capability | Validation |
| --- | --- | --- |
| Product identity and opening context | Title, short promise, approved image, brand, initial destination | Required identity; image fallback; contrast |
| Three buyer questions | Question/explanation, evidence and chapter/view association; ordering | Valid destination; concise copy; no unsupported motion |
| Customer-facing part knowledge | Pick existing component; label, explanation, facts, files | Exact model revision/node reference; source-backed claims |
| Technical facts | Group, value, unit, qualification and source; approve or leave unverified | Unit/value completeness; approval required for release |
| Documents | Sample asset reference, title, type, date/revision and association | File exists; permitted content; valid component links |
| Guided explanation | Chapter order, caption, existing part/view/action, duration and held endpoint | Package-supported action; valid references; deterministic replay |
| Appearance | Approved finish families, default display, theme and enabled features | Valid package settings and supported capabilities |
| Next conversation | Action label, small request schema, required context and future destination | Draft/review/confirm separation; honest demo receipt |

The Story editor uses a chapter list and the existing 2–3 second actions. It writes
declarative tour data consumed by the same player. It is not a new general-purpose
timeline, rigging, physics, joint-solving or geometry editor. Importing an arbitrary
CAD assembly and automatically producing valid movement is outside this scope.

### S3 — Preview & release review

- Preview the exact buyer-facing Room at desktop and phone dimensions.
- Separate content checks, model checks and device checks. Show actionable issues
  with links back to the field or chapter needing correction.
- Record a draft identifier and the model revision being reviewed.
- Require an explicit release confirmation after review. Editing a draft must not
  change the currently released Room.
- Release a versioned content package/manifest through the existing build pipeline.
  The prototype may export the draft and simulate the release receipt; it must not
  claim a successful hosted publication unless a build/deployment actually ran.

## Shared content and feasibility boundary

| Object | Responsibility |
| --- | --- |
| Room version | Product identity, navigation, ordered explanations and next action |
| Model reference | Package ID plus exact model revision and supported capabilities |
| Product fact | Approved text/value/unit, qualification, evidence/source, optional part |
| Part content | Revision-scoped node ID, buyer-facing label and related facts/files |
| Story reference | Existing tour/chapter or supported revision-pinned prepared view |
| Document | File reference, readable metadata and product/part association |
| Request draft | Message, explicit context and contact data; separate from public Room content |

Room content revision and model revision are distinct. Labels never become IDs.
Replacing the geometry requires explicit review/rebinding of affected references;
do not silently migrate them by similar part names.

Existing controller capabilities include reading parts, selection, framing,
inspection, isolation, display changes, authored action/tour playback and compatible
bookmarks. Use `embed-client.js`; keep private Three.js objects out of the host.

New Room content, editing forms, document association and request review are host
work. The current API does **not** live-edit component names, finish assignment,
geometry or tour scripts. Host-only text may preview immediately; edits affecting
the Explorer must produce a validated draft package and rebuild/remount it.
The first Studio should select prepared packages, export versioned drafts, and use
the existing CLI/build pipeline for this boundary. Automatic online build orchestration
is an adapter to implement later, not a feature to fake as already integrated.

Real accounts, private assets, durable sharing, concurrent collaboration, persistent
comments, customer responses and analytics require future Annora services. The iframe
handshake is not authentication. No backend is added to the Explorer template.

## Proposed implementation order after approval

1. Design the three Room destinations and request states with existing sample content.
   Lock desktop and mobile layouts before frontend construction.
2. Build the independent Room host around the unchanged Explorer; verify navigation,
   resource failure and contextual request review using explicit demo data.
3. Build the Studio list/editor/review surfaces around the same content schema.
   Enable real content editing and draft export; validate package changes through
   the existing build flow rather than claiming unsupported live mutation.
4. Exercise one complete author → preview → reviewed package → Room workflow,
   including mobile and lower-performance device checks.
5. After those capabilities are accepted, plan durable view sharing, production
   services and the first real customer pilot.

## Acceptance matrix for the later build

| Area | Observable acceptance |
| --- | --- |
| Understanding | A visitor can identify the product purpose and open an explanation without learning CAD terminology |
| Context | A part-related document/question retains the product, exact model revision and part identity |
| Content | One Studio fact edit updates all relevant Room uses without duplicate manual edits |
| Playback | Pause, replay, seek and takeover retain the existing player behavior |
| Capabilities | Apollo never exposes unsupported operating motion |
| Confirmation | Neither a request nor a release is finalized before its review/confirmation step |
| Versioning | A draft cannot overwrite a release; incompatible references are visibly flagged |
| Resilience | Model failure leaves overview/files usable; request failure retains the draft |
| Mobile | Navigation, files, request review and viewer controls remain reachable at 320–390 px widths |
| Performance | One WebGL instance; explicit pause/dispose; physical ordinary-device tests reported separately |
| Regression | Standalone Explorer routes and approved interactions remain unchanged |

## Reference lock

- **Primary:** the approved Annora Explorer and its Oxide-informed model-first,
  graphite, compact, floating UI. No new visual direction is proposed.
- [Dock sales rooms](https://www.dock.us/solutions/sales): borrow the consolidation
  of explanatory content, resources and a next conversation. Do not import its
  entire CRM, analytics or account-collaboration scope.
- [Spline editor reference](https://refero.design/pages/62c42d36-6eaa-4bc9-8aa3-1800f156888c)
  and [Vectary editor reference](https://refero.design/pages/d0b4b27a-b41e-48bf-9d70-f012325f6b81):
  borrow contextual editing and the separation of content structure, preview and
  properties for Studio. Their modeling tools are not part of this proposal.
- [Speckle model review](https://speckle.systems/blog/introducing-fe2-the-new-speckle-front-end/):
  retain awareness of model version and discussion context. Its cross-version
  comment persistence and live follow mode are not current Explorer capabilities.

Discussion decisions: default entry into Explore; three Room destinations with a
shared request flow; one product per Room; prepared packages for initial Studio;
desktop-first authoring with full mobile buyer support. These are recommendations,
not implementation approvals.
