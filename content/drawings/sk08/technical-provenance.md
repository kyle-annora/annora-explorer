# SK08 technical presentation

`technical-front.svg` is an editable vector presentation of the front projection in the original `source.pdf`. It is a derived reference, not a manufacturing drawing or an engineering revision. The original PDF, STEP, model, drawing package and saved inquiry references are unchanged.

## Geometry and source identity

The generator requires the exact source PDF SHA-256 `db5468501a8a7c61b840db481786161313b0befbcbd31fe1c910054033a73ca2` and STEP SHA-256 `bb89218f5cd90ce713b08359d4d719f4297483039ef55d2abb33eb5af65d9cd5`. The files were published together in the pinned [draftwright example package](https://github.com/pzfreo/dw-examples/tree/c4c72a71c6440f0c824678660b59d0474f105e71/drawings/sk08). SK08 geometry is by hasecilu, FreeCAD library, CC BY 3.0; source drawing output is by draftwright. Existing attribution and source licensing continue to apply.

The 38 geometry paths are extracted directly from the PDF, including the original Bezier bore contour, open clamp slot, hidden edges and center marks. No geometry is regenerated or traced from a bitmap. The generator pins source path indices and checks their original classifications. A uniform affine transform moves PDF page coordinates into the presentation canvas; the transform and full source identities are in `technical-front.json`.

At the source's printed 1:1 scale, PDF coordinates use `72 / 25.4` points per millimetre. Extraction checks the 42 mm width, 32.8 mm height, 18 mm neck, 6 mm base, 21/20 mm bore location and 1 mm slot to within 0.0001 mm of the source values. The shaft bore's 4 mm radius is also described by STEP cylindrical surface #427 in the existing reviewed mapping. The highlighted feature is the source cylinder; its visible outline deliberately retains the slot opening.

## Presentation changes

The prepared SVG separates `contour`, `hidden`, `center` and `dimensions` groups. Strokes use neutral graphite and `vector-effect="non-scaling-stroke"`. Dimension leaders, arrows and text have been recomposed for screen viewing, using only printed source values. The optional 12 mm source dimension is omitted from this focused presentation. No tolerance, finish, machining requirement or approval has been added. Screen zoom is not a physical drawing scale.

The front canvas is `[0, 0, 1000, 720]`. The detail viewport is `[330, 90, 315, 340]`. Both display the same geometry. The detail presentation hides the full-view dimensions and shows only its own `Ø8 THRU` leader so unrelated annotations are not cut off at the viewport edge. Groups use `data-presentation="front"` and `data-presentation="detail"`; the detail group starts with `display="none"`. There are no embedded rasters, scripts, external resources or global style rules.

`technical-front.json` maps the prepared bore to canonical `sheet-1` / `shaft-bore` / `sk08-body`. Its circle is an invisible selection target; `featureOutlinePathIds` identifies the exact two visible source bore paths for an Ember highlight that leaves the clamp slot open. This presentation is eligible only for the pinned source edition. An imported PDF revision requires its own reviewed presentation; it must not inherit this one by product name alone.

## Regeneration and checks

Run `python3 content/drawings/sk08/source-tools/make-technical-svg.py` with PyMuPDF installed. The script checks hashes, path classification, source dimension text and coordinate measurements before producing the SVG and JSON. It writes only `technical-front.svg` and `technical-front.json`.

The asset was visually inspected in Chromium at 600 and 350 CSS pixels, including its dedicated bore-detail viewport. Runtime fit, 2×/4× zoom, selection and original-document switching are verified in the host integration separately.
