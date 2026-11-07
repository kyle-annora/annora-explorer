# Confirmed design and architecture decisions

These decisions describe the approved baseline. Change them explicitly, with
visual and functional evidence, rather than gradually drifting across projects.

| ID | Decision | Consequence |
| --- | --- | --- |
| D-01 | Oxide informs compact floating controls and mechanical exploration | The model remains dominant; controls stay out of its focal region |
| D-02 | Atlas informs crisp, occlusion-aware linework | No lit solid shading in pure linework; no generic triangle wireframe |
| D-03 | Engineering is the default treatment | Components use curated finish families and controlled contrast |
| D-04 | Flat Ember is available alongside pure linework | Selection communicates component identity without bloom or blur |
| D-05 | Ember remains the default accent; brand accent is configurable | Color is a project setting, not a client-specific renderer fork |
| D-06 | Hierarchy represents assembly relationships | Stable semantic IDs support tree, breadcrumbs, selection and focus |
| D-07 | Explosion is explanatory, not physical disassembly | Author offsets; restore exact source rest poses |
| D-08 | Operation uses real authored source clips | Never infer engineering motion or claim physical validity from geometry |
| D-09 | One player coordinates camera, highlight and captions | Pause, seek, chapter access, reduced motion and manual takeover remain available |
| D-10 | Guides use short English text and no default narration | Captions remain concise; the mechanism carries the explanation |
| D-11 | One render loop owns scene and animation time | Hidden-page handling, transition interruption and cleanup remain coherent |
| D-12 | Desktop and mobile share capabilities, with compact disclosure | No hover-only requirement; controls must remain reachable on small screens |
| D-13 | Performance is part of content acceptance | Lazy line data, bounded pixel density and adaptive quality precede new effects |
| D-14 | Public control is JSON and revision-scoped | Hosts do not mutate Three.js objects or embedded DOM |
| D-15 | Reuse is configuration plus prepared packages | A new model must work without adding runtime ID switches |
| D-16 | Customer content stays outside the public starter | Source history, assets and documentation are explicitly allowlisted |
| D-17 | Inquiry can begin beside the selected 3D context | Component, chapter and header entries share a floating intake and the existing project repository |
| D-18 | Request intent determines relevant questions | Quotation requires quantity; application review may leave it unknown; every branch retains editable review and explicit confirmation |
| D-19 | Live exploration and attached inquiry context are separate | Changing selection cannot silently change the request; explicit reference replacement invalidates review |
| D-20 | Product Room follows the request; Studio handles seller work | Saving an in-Explorer inquiry preserves one project identity and its historical versions |
| D-21 | Hosts reuse one inquiry surface while retaining their own repositories | Ordinary, drawing, preview and walkthrough records remain in their established namespaces; navigation awaits the active editor's save boundary |
| D-22 | Presenter actions finish the visible review or receipt before suggesting a role switch | Continue demo cannot bypass confirmation, conflict recovery or the inquiry receipt |
| D-23 | Drawing requests retain source, association and overview identities independently | Viewing another detail never adopts it; source B needs explicit review and adoption while older records keep A |
| D-24 | An inquiry may collect independently referenced questions | Each item owns its purpose, note and exact context; browsing never replaces an attached item; one complete final review confirms the collection |
| D-25 | Seller-authored explanations reuse prepared actions and the existing player | Studio may arrange held inspections and approved short actions; draft preview and reviewed release remain distinct |
| D-26 | Product growth follows a phased program | The six approved extensions and two reuse foundations have separate acceptance and delivery states; no backend or real-sharing claim is implied |

The first scope and reference lock for D-17–D-20 are recorded in
[In-context inquiry](embedded-inquiry.md).
The continuing scope and acceptance gates are in the
[Explorer-to-quotation program](explorer-to-quote-program.md), with the shared
[host integration contract](embedded-inquiry-integration.md).
The November 6 expansion is tracked in [the product program](product-expansion-program.md).

## Skill structure

The repository skill is `.agents/skills/explorer-project/SKILL.md`. It routes an
agent to the task, current contracts and verification commands; it does not
replace those documents with duplicate instructions. It carries no publishing
permission of its own. Additional animation/design skills may help a contributor,
but installing them is not required to build or deploy this template.

Separate content changes from runtime changes. Keep a short record of the
trigger, chosen behavior, affected boundary and evaluation evidence in a PR or
release note. A visible regression should block publication even when static
validation passes.

## W40 — Prepared products and technical explanation

- Product capability descriptors own parts, documents, authored actions, technical
  references and inquiry profiles. Studio and Product Room inject that descriptor;
  the Explorer renderer remains unchanged. Missing motion disables movement
  authoring, while static and drawing explanations remain available.
- Technical story steps pin the source PDF/hash, sheet/page/rotation, part, region,
  mapping and overview. Optional held 3D views must match the same part/model
  revision. A missing original source fails visibly; it never resolves to latest.
- On mobile and short landscape, one switch chooses 3D or Drawings for the current
  step. The same iframe stays measurable; no second WebGL renderer is introduced.
  Studio can preview a technical drawing before its lazy mobile 3D model loads.
- Asking about a step attaches its exact drawing and product release to the
  existing inquiry/review path. Beginning an inquiry clears the reading companion
  after capture, so the floating form does not compete with another panel.
- SK08 is a reference-only, single-body source with no operating animation. Its
  published preparation/association status is distinct from engineering approval.
  Fictional quotations remain browser-local and explicitly reviewed.
- Each additional prepared product has separate Studio and customer demo storage.
  Existing crank keys and archived records are preserved. The release importer
  accepts registered products and writes only their reviewed content package.

See [prepared-product integration](prepared-products.md), [technical story API](technical-story-api.md)
and [W40 review](w40-prepared-product-review.md).

## W50 — Integrate an existing viewer

- The kit owns neither rendering nor persistence. A host supplies an explicit JSON
  viewer adapter and repository; a separate example keeps its own Three.js canvas.
- External cameras retain their original coordinate system in `viewerReference`
  v1, pinned to product, model and adapter revisions. Existing native `inspection`
  semantics and historical record keys remain unchanged.
- Unsupported drawing/story capabilities are explicit. Capture never invents
  these references. Unknown versions and lossy repositories fail closed.
- Review and confirmation remain separate. Browsing does not mutate attached
  references; replacing a view invalidates prior review.
- A packed, asset-free library and a fresh independently built host are the
  qualification boundary. The package excludes models, Three.js and PDF.js.
- Sample browser storage is opt-in and isolated. Backend, authentication and
  arbitrary commercial-viewer support remain outside this release.

See [integration kit](integration-kit.md) and [W50 qualification](w50-integration-kit-review.md).
