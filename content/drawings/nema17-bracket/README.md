# NEMA 17 motor bracket reference package

A fresh one-solid product used to exercise the prepared-product onboarding workflow. This is a motor bracket, not a motor or an operating assembly. The original geometry and drawing remain independently accessible.

## Provenance and permitted use

- Geometry: [build123d documentation STEP, commit 742a3dcc](https://github.com/gumyr/build123d/blob/742a3dccb372a39d50cb231de481f3add34efcd9/docs/topology_selection/examples/nema-17-bracket.step), copyright build123d contributors, Apache License 2.0.
- Paired assets: [dw-examples commit 16789983](https://github.com/pzfreo/dw-examples/tree/1678998387693c9a96c7033123f849411e061c93). `steps/build123d/nema-17-bracket.step` and `drawings/nema17-bracket/nema17-bracket.pdf` are the paired model/drawing inputs.
- `source-attribution.md` preserves the source repository's exact attribution and STEP identity. `LICENSE.txt` preserves its Apache license.
- `source-review.json` is the unchanged upstream review. The automatic draftwright v0.2.9 drawing is **unreviewed reference material**, with no manufacturer revision or approval. Its general tolerance is blank; the through-step feature is incompletely dimensioned and two extension lines cross slots. Annora does not invent missing requirements.

## Source identity

| Asset | SHA-256 |
| --- | --- |
| `nema17-bracket.step` | `bc7b546d7062b56d93ad3a82fc90f25aa44e3930a9e98bdc93c5d409e4a84c2d` |
| `source.pdf` | `27466fb32d5761b83ca3c563d6dcad3c671eeb5f9da9bd504294099b3ed64c14` |
| Prepared `model.glb` | `0352481427da9a0e3e15eca6a184aeb27015be9350136d9de9885757d189eae1` |

The model package revision used by drawing/business references is `sha256:7606153455cb7659be54549a18d6cb0bf2b4d998050dfb6b556f16c2a281ab74`, as computed by `loadProject` across the manifest and all model assets. This is distinct from the GLB file checksum above.

The source contains one `MANIFOLD_SOLID_BREP` (#15). Its dimensions are 35 × 41 × 51 mm. Tessellation uses occt-import-js 0.0.23 with 0.006 mm linear and 0.2 radian angular deflection. The displayed mesh has 3,436 vertices and 3,396 triangles. Coordinates convert from `[x,y,z]` millimeters to `[x,z,-y]/1000` meters. The satin display finish is illustrative; no operating animation or separate internal parts are supplied.

## Files and immutable associations

- `intake-source.json`: immutable initial drawing package. Three proposed associations are `needs-review` until an operator confirms them.
- `package.json`: publishable working package written by the reviewed onboarding release process. Never treat intake as a confirmed release.
- `source.pdf`, `nema17-bracket.step`, `source-review.json`: preserved originals.
- `sheet-1.svg`: original drawing vector fallback; retains the source sheet and annotations.
- `technical-front.*`: original front projection with the motor aperture and four-hole pattern.
- `technical-base.*`: original base projection with six slots.
- `overview-views.json`: three prepared reading views in order: motor aperture, motor mounting pattern and base slots. The first two share exact front artwork but each exposes only its own linked feature, avoiding competing hit rectangles.
- `poster.svg`: original source isometric vectors, reframed for a product thumbnail.
- `model-definition.json`: data-only definition used by the generic model importer.

All three drawing regions identify `nema17-bracket-body`. They are features of one rigid solid. The central aperture comes from STEP cylinder #306 (radius 16 mm); the mounting pattern comes from #213, #244, #275 and #337 (radius 1.65 mm); the six slots use 2.25 mm radius ends. Front and base reading artwork copies PDF vector paths directly. The front projection has two feature-specific reading variants. They move existing annotation values and change line styling, without adding geometry, dimensions, tolerances or an engineering revision. Eight unit/dimension checks in `source-tools/prepare-drawings.py` compare PDF vector extents at the printed 2:1 scale against the original dimensions.

## Reproduction

Run from the repository root, with Python, NumPy, PyMuPDF and occt-import-js 0.0.23 installed. The CAD kernel is only an offline preparation dependency.

```sh
node content/drawings/nema17-bracket/source-tools/tessellate-step.cjs /path/to/occt-import-js content/drawings/nema17-bracket/nema17-bracket.step /tmp/nema17-mesh.json
python3 content/drawings/nema17-bracket/source-tools/make-preview-glb.py /tmp/nema17-mesh.json /tmp/nema17-model.glb
npm run import:model -- --source /tmp/nema17-model.glb --definition content/drawings/nema17-bracket/model-definition.json --out /tmp/nema17-prepared-model
```

The importer never overwrites an existing output. Register the model manifest before preparing its drawing so the model revision can be resolved by `loadProject`. To reproduce the reading assets, use an isolated repository copy with this drawing folder and prepared model, then run `source-tools/prepare-drawings.py`. It refuses to replace a package containing confirmed mappings. Onboarding review/publication belongs to the generic operator flow; regenerating artwork is not permission to rebind an existing customer's record.

## Preparation boundary

This is a reusable onboarding demonstration for **prepared** geometry and drawing assets. It is not a claim that arbitrary CAD files can be imported without preparation. This product required five preparation activities: source/license qualification, offline STEP conversion, a model definition, three draft feature associations, and two technical view compositions plus a source isometric poster. The operator must then confirm each of the three feature links and review the proposed release. No shared renderer or existing product code was changed to add this source package.

The source PDF still contains naturally overlapping feature bounding rectangles. Its explicit linked-detail list disambiguates the aperture and hole pattern; their original coordinates are not shifted to simulate separation.
