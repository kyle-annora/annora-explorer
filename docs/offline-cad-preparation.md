# Offline CAD preparation experiment

Decision: **keep Replicad as an optional offline preparation candidate. Do not use its STEP import result as persistent product, assembly, part or face identity. Do not ship its kernel to buyer pages.**

This bounded phase 4 experiment implements the trial in [the open-source plan](drawing-open-source-plan.md). It does not replace the current Explorer, source drawings or published model packages. The actual single-solid import and derived projection passed the narrow checks below. A real customer multipart assembly still needs separate validation.

## Inputs and reproducibility

The executed wrapper was `replicad@1.2.0`, npm git head `6ef8ae10f7cb708ec34c74b37f3be255c3c2dbc8`, matching the previously inspected source snapshot. Its kernel package was `replicad-opencascadejs@1.1.0`, git head `e4b05f67dc4e2393a876ce8c5064a9c93db05bf1`. The exact WASM hash and size are recorded in [diagnostics](../tools/cad-experiment/evidence/diagnostics.json).

1. **Actual source:** the existing, unchanged OCCT `linkrods.step`, SHA-256 `3674e4b01ee0e983c81ed170f0574cda201ad08e0f7b46e05e4f4613400fd5f7`. Its source declaration uses millimeters. Provenance and licensing remain in the existing Linkrods package.
2. **Explicit algorithm fixture:** two separated boxes named `Fixture housing` and `Fixture shaft`, exported to a STEP in millimeters by this harness. Geometry is authored only to test multi-solid transport and identity loss. It is **not** a real machine, customer assembly, paired drawing dataset or evidence of production assembly support. The exported source bytes are preserved beside the report. Re-running the exporter can change timestamps and therefore the file hash.

No real multipart source with independently verified licensing and assembly semantics was selected within this bounded experiment. That acceptance gate remains open; the fixture does not substitute for it.

Run in an isolated dependency directory:

```sh
npm install --prefix /tmp/annora-replicad-experiment --save-exact \
  replicad@1.2.0 replicad-opencascadejs@1.1.0 --ignore-scripts
node tools/cad-experiment/run.mjs
```

`CAD_EXPERIMENT_MODULES` may point to another isolated `node_modules` directory. An optional first argument selects an output directory. Nothing was added to the application package dependencies, build inputs or browser runtime. The experiment script and evidence are not part of the buyer deployment bundle.

## Observed result

The recorded run used macOS arm64, **Apple M5 Pro, 48 GiB RAM, Node 26.3.0**. It is a one-shot process measurement, not a benchmark on ordinary client hardware. It includes a second import and meshing pass to test identity instability. Values below are rounded; JSON retains the original values.

| Check | Actual Linkrods STEP | Authored two-solid fixture |
| --- | ---: | ---: |
| STEP size | 1.79 MB | 31.1 KB |
| Import time | 276 ms | 5.45 ms |
| Tessellation time | 78.2 ms | 1.01 ms |
| Visible/hidden projection time | 124 ms | 1.85 ms |
| Returned shape | Solid | Compound |
| Solids retained | 1 | 2 |
| Faces | 37 | 12 |
| Mesh triangles | 14,454 | 24 |
| Visible paths | 30 | 6 |
| Hidden paths | 38 | 6 |
| Derived SVG size | 34.1 KB | 822 bytes |

Kernel startup took **78.6 ms**. The WASM file is **22.98 MB**. Process RSS grew from **50.5 MiB** before initialization to **175.2 MiB** after initialization; the process peak reached **569.8 MiB** across both inputs and repeat imports. Total harness time was **1.13 seconds**. These figures support a short-lived offline worker, not an assumption that the kernel is cheap enough to add to the current buyer page.

Linkrods imported bounds in millimeters are approximately `[3.125, 2.5, 0]` to `[8.1452848, 4, 2]`. Applying the existing package's `[x,y,z] mm → [x,z,-y] m` transform yields a maximum absolute bound difference of **1.47 × 10⁻¹⁰ meters** against the current prepared model. The solid and face counts also agree with its provenance. This checks unit interpretation and overall geometry; it does not certify every curve, tolerance or drawing annotation.

The prepared mesh JSON uses source millimeters and records the source hash. It is research output, not a new released Explorer package. The SVG contains separate dark visible edges and muted dashed hidden edges. It has no automatically added dimensions, tolerances, sections, sheet scale, approval or commercial requirements. It remains distinct from the supplied PDF.

## Identity gate: fail for persistent assembly import

The inspected and executed Replicad importer uses `STEPControl_Reader`, `TransferRoots()` and **`OneShape()`**. This aggregates imported topology into one returned shape. The two-solid fixture retained two solids; geometry was not fused or reduced to one solid. However, its two named STEP products were not returned as a product/assembly/name tree. The returned wrapper exposes the OCCT wrapper and shape handle, not supplier product identities or assembly occurrences.

A second import of the identical bytes produced different numeric `faceId` values for both inputs. The JSON records representative first/second IDs. These are runtime-local topology identifiers. They must never become an inquiry's part ID, a quotation's drawing reference, or an automatic cross-revision feature match.

Acceptance policy:

- Allow offline visible/hidden projections and tessellation as explicitly derived assets, with pinned source hashes and conversion versions.
- Keep Annora's authored stable part IDs, exact model revisions and confirmed drawing associations as the commercial boundary.
- Reject automatic assembly publication when the source has multiple products or occurrences but the importer cannot return their identities and transforms.
- Do not reinterpret `shape.solids` order or runtime hashes as a BOM or persistent assembly structure.
- Require a separate assembly-preserving importer and a real licensed assembly fixture before claiming that capability.

## Next bounded experiment

If an actual customer needs generated drawing views, run this adapter in an isolated, memory/time-limited worker. Accept an original source asset and emit a manifest, mesh, visible/hidden SVG and diagnostic report. Write to a new derived revision; retain the original supplied drawing as authoritative. Use explicit unit checks, expected bounding boxes, actual source part counts and an identity-capability gate.

Projection fidelity still needs a real technical review against supplied views. This run establishes that the algorithm returns usable visible/hidden geometry and agrees on bounds; it does not establish production drawing quality. Detail/section views, dimension authoring and page layouts warrant the separately planned FreeCAD or drawing-tool evaluation.

## Evidence and licenses

- [Executed harness](../tools/cad-experiment/run.mjs)
- [Machine-readable timings, bounds and identity diagnostics](../tools/cad-experiment/evidence/diagnostics.json)
- [Derived Linkrods projection](../tools/cad-experiment/evidence/linkrods.svg)
- [Derived Linkrods mesh](../tools/cad-experiment/evidence/linkrods.mesh.json)
- [Explicit two-solid fixture STEP](../tools/cad-experiment/evidence/two-solid-algorithm-fixture.step)
- [Fixture projection](../tools/cad-experiment/evidence/two-solid-algorithm-fixture.svg)

The harness and authored fixture use this repository's MIT license. Linkrods-derived geometry retains the source's OCCT attribution and LGPL-2.1 with Open CASCADE exception terms; see [the existing source package license](../content/models/linkrods/LICENSE.txt). Replicad wrapper code is MIT. The installed OCCT package is LGPL-2.1-only; it remains isolated outside this repository and is not distributed by this experiment. Any later distribution of that kernel needs its own complete license/source-offer review.

Primary implementation reference: [Replicad's pinned STEP importer](https://github.com/sgenoud/replicad/blob/6ef8ae10f7cb708ec34c74b37f3be255c3c2dbc8/packages/replicad/src/importers.ts) and [pinned hidden-line projection](https://github.com/sgenoud/replicad/blob/6ef8ae10f7cb708ec34c74b37f3be255c3c2dbc8/packages/replicad/src/projection/makeProjectedEdges.ts).
