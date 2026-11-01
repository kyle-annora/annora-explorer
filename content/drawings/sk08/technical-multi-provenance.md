# Additional SK08 technical views

These assets extend the approved front presentation with top, side, and isometric source views. They are derived references, not manufacturing drawings or engineering revisions. The original PDF, STEP, model, drawing package, reference PDF, and approved front SVG/JSON remain unchanged.

## Source and extraction

The generator pins the original PDF SHA-256 `db5468501a8a7c61b840db481786161313b0befbcbd31fe1c910054033a73ca2` and STEP SHA-256 `bb89218f5cd90ce713b08359d4d719f4297483039ef55d2abb33eb5af65d9cd5`. Both were published in the same [draftwright source snapshot](https://github.com/pzfreo/dw-examples/tree/c4c72a71c6440f0c824678660b59d0474f105e71/drawings/sk08). SK08 geometry is by hasecilu, FreeCAD library, CC BY 3.0. Existing source attribution applies.

All visible geometry is extracted from the source PDF's original vector commands. Uniform transforms reposition these commands in a 1000 × 720 presentation canvas. Bezier control points, clamp-slot edges, hidden edges, concentric rim outlines, and original isometric occlusion are retained. Nothing is traced from a bitmap or regenerated from inferred dimensions.

| Asset | Source contour paths | Hidden paths | Center paths | Canonical association |
| --- | --- | --- | --- | --- |
| `technical-top.svg` | 28–47 | 121–132 | 5–10 | `sheet-1` / `mounting-holes` |
| `technical-side.svg` | 48–56 | 133–140 | 11–14 | `sheet-1` / `cross-bore` |
| `technical-iso.svg` | 57–94 | None in source | None in source | `sheet-1` / `overview` |
| `technical-footprint.json` | Reuses approved front artwork; highlights 17, 18, 19, 26, 27 | Unchanged front artwork | Unchanged front artwork | `sheet-2` / `mounting-footprint-detail` |

The side profile also declares the existing `sheet-2` / `cross-bore-detail` alias. Sheet 2 is an enlargement of these same original front and side views, as recorded by `make-reference-pdf.py`; it is not a different engineering revision. Alias metadata changes neither saved canonical references nor the source package.

## Dimensions and feature identity

The top presentation repeats only the source's `5`, `37`, `7`, and `2× Ø5.5 THRU` annotations. Source coordinates verify the 42 mm overall width, 14 mm depth, 5/37 mm mounting-hole positions, and 7 mm row location within 0.0001 mm. Both inner mounting circles are checked against their 5.5 mm source diameter and STEP cylindrical surfaces #1079/#1109, radius 2.75 mm. Their larger original rims remain visible; no new counterbore or chamfer requirement is inferred.

The side presentation repeats only `7`, `14`, `27.8`, and `Ø7 THRU`. Source coordinates verify the 14 mm depth, 32.8 mm height, and 7/27.8 mm cross-bore position within 0.0001 mm. Its inner circle matches the 7 mm source diameter and STEP cylindrical surface #212, radius 3.5 mm. The existing concentric rim is preserved without adding a dimension.

The isometric presentation retains the source's **not-to-scale** status. It adds no measurements, hidden lines, or centerlines. All 38 original contours form its selectable overview.

The mounting-footprint profile uses the full, unchanged front artwork and its existing dimensions. Highlighting follows only the original base contours. It does not introduce a false horizontal edge through the neck or make a clipped section drawing.

## Rendering and selection

Each SVG separates contour, hidden, center, and dimension groups where those groups exist in the source. Neutral graphite colors and non-scaling strokes match the approved front view. Printed dimension values are recomposed with larger, readable labels; source-blue annotation paths and sheet furniture are excluded. No tolerance, finish, machining instruction, or approval has been added.

Profiles carry both canonical source-region bounds and exact prepared-coordinate geometry. `featureOutlinePathIds` identifies the visible source paths to highlight. The top's compound selection selects both actual holes together; the side's circle identifies the true inner bore; the isometric overview uses its original path group. Compound/path bounds are interaction targets, not fabricated geometric outlines. The footprint profile declares `artworkFile: "technical-front.svg"` and pins that artwork's hash.

These prepared assets are eligible only for the pinned source edition. A different uploaded PDF must retain its own original reader unless a separate matching presentation has been reviewed.

## Regeneration and checks

Run `python3 content/drawings/sk08/source-tools/make-technical-views.py` with PyMuPDF installed. It writes only the three new SVG/profile pairs and the footprint profile. Hashes, source path classifications, printed labels, source dimensions, and SVG structure are checked before output. The approved front assets are read only.

The assets were visually inspected in Chromium at 600 and 350 CSS pixels. All geometry stays vector-based; the files contain no raster images, scripts, external resources, inline styles, or global style rules. Host integration separately verifies fit, zoom, selection, original-document switching, and source-version eligibility.
