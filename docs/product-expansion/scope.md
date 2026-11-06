# Detailed feature scope

Revision 1 · Proposed implementation boundaries. See [status and decisions](README.md).

## 1. Shared rules

- Retain compact floating UI, model prominence, Ember default, Light/Dark,
  Engineering/Linework/flat treatments, pause/replay/seek and manual takeover.
- A product release, geometry revision, drawing source, mapping revision, drawing
  overview, story step, inquiry and quotation are different identities. Store
  explicit references and snapshots; never resolve history to latest implicitly.
- Live browsing is transient. Attaching a detail, choosing an option, adopting a
  source, publishing a release and confirming a request are deliberate actions.
- Incomplete drafts can be saved. Review validates a saved revision; editing
  invalidates the review. Final confirmation uses that exact reviewed content.
- Mutations succeed only after persistence. Failed save, stale review and conflict
  retain input and offer recovery. Unknown stored schemas are not automatically erased.
- Existing records remain readable. Additive fields need normalizers, review
  coverage, adapter capability checks and historical fixtures, not UI-only storage.
- One mounted viewer and one animation clock. Buyer and seller roles are local
  demo projections, not authorization. No confidential data in URLs or public fixtures.
- Keep one primary next action in the current task. Reuse existing navigation;
  reveal advanced settings when editing. Mobile must not depend on hover or drag.

These extend [the confirmed decisions](../decisions.md),
[project contract](../product-room-api.md) and [Studio contract](../studio-api.md).

## 2. F1 — Contextual request collection

**User outcome:** inspect several details and confirm one understandable inquiry.

**Already delivered:** up to twelve independently pinned items, purpose and note,
one expanded editor, explicit add/remove/restore, complete final review, separate
confirmation and buyer/seller exact reopen. Legacy single-reference drafts work.
An item is not automatically a priced quote line.

**Remaining scope:** expose each immutable inquiry item as the source of a
question thread in F6 and a scope decision in F4. Keep the original item unchanged;
new replies, requested changes and resolutions are separate records. Preserve
both model and drawing context through an external capable adapter in B.

**Boundaries:** a collection retains one product, geometry revision, product
release and inquiry profile. Different drawing-source revisions may coexist
within that identity. Cross-product RFQs and arbitrary attachments are not V1.
Keep twelve items until a real case establishes a need for more.

**Acceptance:** F1-01 attach two details, browse elsewhere, then reopen both exact
references; F1-02 review includes every item and cannot confirm after an edit;
F1-03 failed/old adapter cannot silently drop items; F1-04 later replies or quote
scope do not rewrite the original inquiry. Reuse current tests rather than
rebuilding this feature.

## 3. F2 — Authored product explanation

**User outcome:** a seller prepares a concise explanation without editing runtime code.

**Already delivered:** the prepared crank supports up to eight action or captured-view
steps, short captions, ordering, preview, release review and local demo publication.
The buyer can take over and ask about a step. Source actions remain authored 2–3
second motions; the editor does not create mechanical relationships.

**Extension F2a — Product capabilities:** introduce a prepared-product registry
for available model revision, parts, actions, documents, technical views and
inquiry profile. Remove the crank-only host assumption through this registry,
not new model-ID switches. Missing motion disables action authoring with an
explanation; it does not prevent a static view story. Reuse the current editor,
release importer and controller.

**Extension F2b — Technical-view steps:** allow a step to reference an existing
reviewed drawing view/detail and optionally pair it with a compatible 3D view.
Pin source/page/region/mapping/overview identities. Desktop can show paired views;
mobile switches between them with the same step and selected reference retained.
Original PDF remains a secondary action. A missing source blocks publication or
opens an explicit historical-unavailable state; never synthesize dimensions.

**Proposed records:** extend the existing story step union with a versioned
technical-reference step. A capability descriptor states which step types a
product/host supports. Old chapter/inspection steps remain unchanged. Spatial
presentation poses remain unsupported captures until separately validated.

**Not included:** CAD editing, rigging, AI-invented engineering facts, arbitrary
timeline authoring, voice generation or a second rendering engine.

**Acceptance:** F2-01 second prepared product works through configuration;
F2-02 incompatible part/action/source blocks preview/release; F2-03 drawing and
3D selection agree after mobile switching; F2-04 old released stories retain their
sources; F2-05 playback/takeover has one set of controls and no late transition;
F2-06 save/review/publication boundaries remain separate.

## 4. F3 — Customer-specific presentation and follow-up

**User outcome:** prepare a short explanation for one customer conversation, then
return that buyer to the exact project decision instead of a generic homepage.

**Seller flow:** open a project → Prepare follow-up → use that project's exact
compatible product/model/release → select/reorder its existing steps and
compatible saved inspections →
attach selected inquiry items as an agenda → write a brief introduction → choose
one next action → preview as buyer → review → confirm a follow-up revision.
Customer-specific content never edits the reusable product release.

**Buyer flow:** open the follow-up → see its purpose and current step → play or
explore freely → explicitly resume → inspect an agenda reference → return to the
same project to answer its current clarification, open an exact quotation or
request its supported next step. The next action must be available in the
current project state; unavailable targets show
an explanation and a safe return. A follow-up pointing to quote v1 never silently
opens v2; it may separately indicate that a newer version exists.

W10 starts after inquiry confirmation. It never converts that immutable inquiry
back into a draft or silently creates a replacement project. Resuming an actual
unconfirmed inquiry would be a separately typed draft target and fixture, deferred
from the first W10 slice. An unrelated/newer release cannot be substituted into
this project; historical references remain pinned evidence, not silent adoption.

**Distribution is three distinct capabilities:**

| Mode | V1 implementation | Claim allowed |
| --- | --- | --- |
| Local personalized follow-up | Browser-local draft/release and progress | Available in this browser only |
| Prepared public demonstration | Allowlisted fictional fixture, exported and deployed through the site build | Works in a fresh browser at the hosted link |
| Private recipient delivery | Contract and failure states only | Requires future host identity, access and storage services |

A Copy link button cannot turn session/local storage into cross-device sharing.
Public URLs contain safe fixture/revision IDs, not project notes or identity data.
A local-only target opened elsewhere reports unavailable local content clearly.
The public fixture uses a fictional project in an isolated demo namespace and an
explicit demo entry; it does not import a real customer's project or overwrite
an existing browser project. Export review checks all referenced content.

**Proposed records:** `FollowUpDraft`, immutable `FollowUpRelease`, separate local
`FollowUpProgress`; exact product release, selected step snapshots, request IDs,
source project revision, audience mode and next-action target. Progress means
where to resume, not proof that a customer read or agreed. New follow-up versions
preserve old content and targets. Imported/exported fixtures validate identity,
assets and allowed data before becoming public.

**Not included:** general slide software, CRM campaigns, email sending, real
accounts, access tokens implemented in the browser, read receipts or inferred intent.
F3 first uses the crank. F2a/F2b enable later drawing-product follow-ups.

**Acceptance:** F3-01 two steps/two questions leave the global release unchanged;
F3-02 free explore and return preserve position and any unsent project reply;
F3-03 the next action pins originating follow-up, exact project/target and reference
without mutating the confirmed inquiry; F3-04 follow-up B leaves A intact;
F3-05 fresh-browser public fixture works while a local-only record is honestly
unavailable; F3-06 missing source, stale review, failed write and repeated confirm
are recoverable without false delivery. Check 320/390 px and short landscape.

## 5. F4 — Approved options and quoted scope

**User outcome:** compare meaningful alternatives, record a preference, and see
exactly how the seller treated the requested scope.

### F4a. Two prepared alternatives

Seller authors two approved options in one product release with stable IDs,
version, short descriptions, source-backed comparison facts and relevant views.
Use one renderer; option focus changes the existing view. Mobile uses sequential
cards or a compact differences list. Buyer explicitly chooses an option or Help
me decide. Browsing never changes preference. Final inquiry review includes the
preference and all questions; changing preference requires another review.

Start with clearly labeled fictional scope packages where authentic geometric
alternatives do not exist. A service/scope alternative is not a mechanical
configuration. Unknown price, compatibility or performance remains unknown.
Do not fabricate load ratings, geometry or availability to populate a comparison.

### F4b. Explicit request-to-quote mapping

Seller inspects requested items/preference and assigns a disposition: Included,
Optional, Excluded with explanation, or Needs clarification. Link to zero, one
or several stable quote-line IDs as appropriate; one line can address multiple
requests. Clarification cannot silently become included scope. Reviewed quote
issuance makes the snapshot visible to the buyer. Quote v2 compares option and
scope changes while quote v1 and the original inquiry retain their snapshots.

**Proposed records:** reviewed `OptionSet`, `RequestedPreference`, and
`QuoteScopeEntry` containing request/option/version references, disposition,
line IDs and rationale. Extend normalization, draft copying, comparison, reviewed
packets and adapter round trips together. Never infer resolution from label text.

**Boundaries:** one approved product/model/release identity for V1; no arbitrary
cross-model configurator, automated CPQ/pricing, stock checks, purchase acceptance
or geometry generation. Preference is not an order or a supplier promise. New
capabilities are opt-in for adapters and must reject lossy persistence.

**Acceptance:** F4-01 compare two options and confirm preference plus two details;
F4-02 browsing does not change selection, editing invalidates review; F4-03 one
request maps to two lines and another remains clarification in the draft until
the applicable issue blockers clear; F4-04 draft scope is
not buyer-visible before reviewed issue; F4-05 v1/v2 comparison preserves original
meaning; F4-06 missing/withdrawn options, invalid mappings, stale source and an
adapter dropping metadata fail explicitly. Existing commercial blockers still apply.

## 6. F5 — Change-impact review

**User outcome:** understand which work needs review after a source changes,
without replacing the evidence underlying an earlier agreement.

**Reuse:** current drawing A→B import, region confirmation, explicit project
adoption, stale quote protection and immutable history. Add an impact projection
over references, not another drawing-version system.

**Flow:** choose a candidate source/release change → list affected current
questions, follow-up steps and quote drafts → show old and candidate references
and the reason for each finding → inspect → confirm mapping, retain old source,
or mark unresolved → review adoption → apply only to the intended working copy.
Quote v2 may reference B after review; inquiry, discussion and quote v1 keep A.

**Proposed records:** `ImpactReview` pins source/target identities, project/draft
revisions and findings. Separate classification (`unchanged`, `changed`, `ambiguous`,
`missing`, `unavailable`) from review state (`pending`, `confirmed`, `retained`,
`omitted`). A resolution records actor role, decision, reason and checked reference.
Matching IDs alone cannot confirm an ambiguous mapping.

The current project-wide `activeDrawingContext` is insufficient for one active
question to keep A while another adopts B. Add a per-question/per-scope working
reference with original-context lineage and exact adopted target; keep it distinct
from the primary project reference and original immutable inquiry item. Reviewed
quote-scope snapshots retain these individual references. W31 must implement and
test this contract rather than assuming the existing global adoption handles it.

Changed page coordinates or removed actions invalidate dependent links until a
valid target is explicitly confirmed or the original retained. New geometry needs
a newly compatible capture/reference. Review alone cannot relabel an old saved
inspection with the new model revision.

**Boundaries:** deterministic declared-reference changes first. No automatic CAD
feature matching, engineering-equivalence claim, silent mass migration or external
notifications. Unrelated records should not be marked changed without evidence.
Historical unavailable assets retain metadata and explain their limitation.

**Acceptance:** F5-01 a source change lists only dependent records; F5-02 ambiguous
mapping requires a human decision; F5-03 stale review cannot apply; F5-04 adopting
B for a new draft leaves A inquiry/discussion/v1 readable; F5-05 unrelated projects
remain unchanged; F5-06 phone comparison and failed save recover without losing
the pending decisions. Run against actual existing SK08/linkrods A/B fixtures.

## 7. F6 — Question-level action workspace and conversion evidence

### F6a. Resolve specific questions

**Reuse:** Studio's project queue, buyer/seller messages, modification topics and
next-action ownership. The current domain serializes a pending clarification at
project level; supporting multiple questions needs domain changes before UI.

Create question threads sourced from immutable request items. Separate original
request, seller answer, clarification and buyer acknowledgement. Proposed visible
states are Open, Waiting on buyer, Waiting on seller, Answered and Resolved.
Answered does not mean accepted. Reopening creates an event rather than erasing
the old answer. A question can link to a reviewed quote-scope entry. Assignment
is by buyer/seller role in the demo, not a fictional identity/notification service.

Extend the existing project workspace with a concise Questions area, filters and
one contextual next action. Derive the project queue's status from unresolved
blocking work. Preserve legacy project-level clarification behavior for old
records. Define which question blocks quote issue or next-step acknowledgement;
only an explicit reviewed disposition can remove that blocker. Follow-up messages
cannot silently mark technical requirements satisfied.

Scope-affecting unresolved questions require a reviewed disposition before quote
issue. Purely informational questions need not all be closed to issue a quote;
their remaining status must stay visible. Legacy projects retain their existing
clarification gates rather than being silently promoted to the new policy.

**Proposed records:** stable `questionId`, source `requestItemId`, immutable
reference snapshot and append-only `QuestionEvent`; existing message and quote
records carry explicit links. Repository checks project revision and idempotency.
Multiple simultaneous pending questions need explicit reply targets and aggregate
state rules, not repeated use of the old single-question selector.

**Acceptance:** F6-01 two questions maintain independent owners/status;
F6-02 replying to one leaves the other open; F6-03 answer/acknowledgement/reopen
preserve history; F6-04 quote issue respects declared blockers; F6-05 legacy
single-question projects remain operable; F6-06 buyer and seller return to the
same detail on mobile after conflict/reload without duplicate messages.

### F6b. Minimal evidence, not a broad dashboard

Start with the existing Studio queue: pending questions, next responsible role,
last meaningful action and quote version. Add a small evidence view only after
event collection is reliable. Candidate events: explicit story start/complete,
reference opened, inquiry review/confirm, quote issue and next-step acknowledgement.
Deduplicate by operation/session identity. Do not treat hover, camera rotation,
hidden tabs or presenter auto-advance as customer interest or conversion.

Events record safe identifiers, event version, role/mode, timestamp and source
revision. No typed notes, contact details, screenshots or raw model payloads by
default. Presenter/demo and ordinary buyer events are distinguishable. Show local
sample counts and the available denominator; no revenue attribution, causal uplift
or real unique-customer metric is established by this browser demo.

Confirmed business events derive from successfully persisted project operations.
Optional interaction telemetry is a separate, bounded stream. Its failure cannot
block inquiry saving or confirmation. Missing telemetry means incomplete evidence;
it is not reconstructed as customer activity or a successful conversion.

**Acceptance:** F6-07 retries do not double-count; F6-08 presenter events are
separate; F6-09 no sensitive field enters the event envelope; F6-10 unavailable
history/denominators produce an explicit unknown rather than fabricated rates.

## 8. Foundation A — Product onboarding workbench

**User outcome:** another developer or agent can prepare a second sellable demo
through documented configuration and know what still needs human preparation.

**Reuse:** the generic offline rigid-GLB importer, stable package schema, source
attribution, linework preparation, policy configuration and deployment checks.
This importer does not understand arbitrary CAD or infer mechanics.

**V1:** a readiness record for source/license/units/part IDs/materials/hierarchy,
prepared actions, drawings, inquiry rules and commercial enablement; editable
mapping over already prepared assets; validation with fix location and severity;
preview through the existing viewer; export a reviewed configuration/definition
for the existing CLI/build pipeline. Product-specific rules belong in packages
and host descriptors. Separate visual-viewer readiness from quote-workflow readiness.

First prove the registry on a second prepared public model and a drawing-capable
product. Use an independent operator to follow the English instructions. Record
manual steps and active preparation time; asset cleanup and missing source
material remain visible costs. Preserve licenses and source/derived hashes.
Final onboarding qualification uses a fresh redistributable model, distinct from
the product used to implement the workbench. Source curation may require desktop
tools; mobile supports review and supported edits, without claiming mobile CAD preparation.

**Not included:** browser STEP kernel, arbitrary file conversion service, inferred
motion, automatic safety/DFM validation, private asset upload or real hosted publishing.

**Acceptance:** A-01 no model-ID renderer branch; A-02 invalid/duplicate IDs and
unsupported input fail atomically; A-03 missing motion/drawing disables only that
capability; A-04 second product imports/configures with preserved old products;
A-05 output passes source/license/build/subpath checks; A-06 another operator
completes the documented process and reports unresolved preparation work.

## 9. Foundation B — Supported integration kit

**User outcome:** a customer can keep its viewer and use the explanation/intake
capabilities it supports, with explicit limitations and a repeatable upgrade path.

**Reuse:** exact-origin iframe JSON controller, existing embed client, separate
asset-free inquiry distribution and repository-owned review/confirmation. MK is
one existing client integration, not proof of universal viewer compatibility.

**V1 deliverables:** versioned distributable/manifest and changelog; capability
matrix for inquiry-only, selected-part, captured-view, drawing-detail and story
support; viewer and repository adapter templates; compatibility checks; fixtures
for unsupported commands, error/retry, disposal and stale state; one independent
public viewer adapter; fresh host build and browser proof. Leave React peer/version
requirements explicit. Host callbacks exchange JSON, not internal Three objects.

Use a small separately implemented public viewer fixture, with its own selection
and camera contract, to prove inquiry/context reuse. It must not secretly embed
Annora's controller and be described as independent. Unsupported story/drawing
features stay unavailable. The host owns storage and the meaning of confirmation;
the library cannot create a second project store or silently drop new fields.

**Not included:** promise of every commercial viewer, same-document full Explorer
SDK, unreviewed npm publication, server-side 3D service or production auth/storage.
Client adoption is a separately versioned unit; changing Annora does not update MK.

**Acceptance:** B-01 distribution excludes models/Three/PDF/client assets;
B-02 old-capability host degrades explicitly without metadata loss; B-03 independent
capture/restore pins identity correctly; B-04 origins/sessions/retries/lifecycle
are checked; B-05 second host builds from English instructions; B-06 upgrade and
rollback preserve prior records and produce separate source/build/target receipts.

## 10. Production dependencies outside this demo program

Durable private sharing, real login, tenant/project permissions, attachment
storage, notifications, delivery receipts and external submission need the future
Annora service. Contracts should document server-side authorization, optimistic
concurrency, idempotency, immutable version retrieval and failure semantics.
Browser review tokens are not signatures or security controls. A later production
scope must assign service ownership, data handling and operational acceptance
before any customer-data claim. No production dates are assumed in this plan.
