# Linked 3D / Drawings preview

## Scope and reference lock

This independent preview loads configured drawing packages for the OCCT connecting
rod and FreeCAD SK08 support. Each pairs its original STEP solid with the drawing
generated from that exact source. It uses the existing Explorer through its public embed
controller; no renderer or Explorer controls are replaced. Existing customer,
Studio and walkthrough records remain in their original storage namespaces.

Visual authority: the current Annora Product Room. Retain silver surfaces,
graphite chrome, Ember selection, 4px corners, compact metadata and 44px controls.
The document toolbar borrows fit/zoom/document framing from the
[Missive document viewer](https://refero.design/pages/b14045d0-6f3d-4e2e-8a9d-ca581cf66a61).
[Linear](https://linear.app/changelog) informs compact separation and secondary
metadata only. Its palette, pills and marketing layout are not imported.

## Decisions

- A drawing detail belongs to a real CAD part. Bores and the connecting web are
  features of one solid, not fabricated assembly components.
- Selection is observational. Only an explicit inquiry action attaches it to a
  draft; review and confirmation remain separate actions.
- The immutable PDF hash and source snapshot identify this drawing. Its blank
  manufacturer revision is never replaced with an invented Rev A.
- The source drawing is automatic, unreviewed reference output. Its dimensions
  are not inferred requirements and the preview does not claim manufacturing
  approval. See the paired asset README and source review.
- Desktop supports comparison. Mobile presents one view at a time, with the same
  selection and a persistent route back. The hidden 3D view is paused.
- The browser loads a prepared mesh and a lazily loaded original PDF (or prepared SVG), not a CAD kernel. There is
  one Explorer iframe and no additional WebGL renderer.

## Review path

Open `/drawing-preview/`. Select a bore in the drawing and locate its parent part
in 3D. Select the rod in 3D and locate its drawing view. Choose a detail, start an
inquiry, review it, confirm the local demo save, then reopen its drawing reference.
The drawing version and selected detail must remain attached throughout.

Choose a product and sheet from the compact toolbars. Rotation does not change
stored region coordinates. Studio can edit associations, preview, review and
publish immutable local releases. The full seller quotation and revision loop
shares the same pinned reference. See [the package and reader contract](drawing-reader-integration.md)
and [Studio drawing authoring](studio-drawing-workspace.md).

The source files, hashes, conversion procedure and limitations are documented in
`content/drawings/linkrods/README.md`. The inquiry boundary is documented in
`docs/drawing-inquiry-api.md`.

## Evaluation gates

Check bidirectional selection without event loops; unknown and stale references;
zoom, pan, keyboard and touch; explicit draft attachment and review confirmation;
saved-record return navigation; isolation from existing projects; desktop and
320/390px layouts; original PDF/STEP downloads; compiled repository subpath;
all existing tests; and the deployed Pages route. Record measured results in the
release evidence rather than claiming untested hardware performance.

See [release review](drawing-preview-review.md) for completed checks and measured limits.
