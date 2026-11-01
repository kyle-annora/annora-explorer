# Annora Studio

Studio is the seller-facing authoring workspace for Product Room. This first release edits the prepared crank product using fictional content and browser-local records. It reuses the Product Room component library and the unchanged Explorer controller.

**[Open Studio](https://kyle-annora.github.io/annora-explorer/studio/)** · **[Open Product Room](https://kyle-annora.github.io/annora-explorer/product-room/)**

## What to review

1. Open the crank product from the Products list.
2. Edit its introduction and a sourced technical fact. Save the draft.
3. Open Parts & documents. Select the connecting rod in the existing 3D Explorer, add a buyer-facing explanation and associate the application checklist.
4. Adjust an optional inquiry field label/help text or hide an unused field. Application and quantity remain required. The details/review/confirmation boundary is fixed.
5. Open the actual buyer preview. Check Overview, Specs & documents and the inquiry at desktop and phone widths. Preview projects are isolated from normal customer projects.
6. Review the content changes and any validation issues. Explicitly publish a demo version only after reviewing the saved draft.
7. Open the released demo Room in this browser. A new inquiry retains that exact Room release, model revision, document revision and inquiry profile.
8. Return to an older project. Its inquiry and quotation history must remain unchanged.

The product editor starts from an existing prepared model package. Selecting a component does not edit geometry or confirm engineering performance. Engineering finishes remain illustrative unless the product owner supplies verified specifications.

## Drafts, previews and releases

- **Draft:** editable seller content. Saved separately from customer projects.
- **Preview:** a fixed snapshot of a saved draft, rendered by the same Product Room page. A later edit requires a new preview. Its project repository is isolated.
- **Demo release:** a reviewed, immutable content version selected for the current browser. It is not a cloud or website deployment.
- **Bundled release:** a reviewed release included in the source build and hosted through GitHub Pages.

Do not share a browser-local preview/release URL as a cross-device project. A recipient without that snapshot receives an unavailable-version message. Use the hosted baseline for a shared review, or apply the exported package and deploy it.

The Studio storage adapter is replaceable. Real accounts, authorization, private assets, shared drafts, supplier approvals, durable delivery and collaboration belong to future Annora services. No production credentials or customer information belong in this public template.

## Deploy an exported release

Export the reviewed release package from Studio. In a checkout of this repository:

```sh
npm ci
npm run prepare:project
npm run apply:room-release -- --file /absolute/path/to/reviewed-release.json
npm run verify
```

The importer validates the product, exact model revision, component links, managed assets and inquiry configuration. It writes only `content/rooms/kinetic-01/release.json`. It does not modify customer projects, model geometry or the Explorer. If a bundled release already exists, review the change before using the explicit `--replace` option.

Review the resulting diff, commit and push to `main`. The existing GitHub workflow validates and deploys the static site. Confirm that the workflow succeeded and open the Pages URL before describing a release as published online. An exported file or local receipt alone is not evidence of deployment.

To recover an earlier hosted content version, restore its reviewed release file in Git and deploy again. Preserve release identity and document/profile snapshots; do not relabel customer history as the latest version.

## Version rules

Room content revision and model revision are separate. Changing copy or inquiry wording does not change the 3D model. Replacing geometry requires explicit validation of every affected component reference.

New customer records capture the Room release and inquiry profile used for their request. Earlier records without those fields remain legacy/unversioned. They are not silently assigned the current release. Saved inquiries, quotations and customer responses remain immutable history.

## Implementation boundaries

- `src/studio/`: authoring domain, replaceable repository, managed sample assets and editor UI.
- `src/product-room/ui/`: shared presentation primitives and scoped tokens.
- `src/product-room/`: buyer renderer, inquiry/project workflow and release consumption.
- `content/rooms/`: optional reviewed content bundled through the static pipeline.
- `src/explorer/`: unchanged renderer, floating controls, camera, material modes and playback.

Read [Studio API](studio-api.md), [design decisions](studio-design.md), [Product Room API](product-room-api.md) and [deployment](deployment.md) for the relevant contracts.
