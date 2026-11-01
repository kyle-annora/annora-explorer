# Link rods: prepared technical presentations

`technical-main.svg` and `technical-main.json` add readable views of the existing
reference drawing. They do not change the source package, drawing revision,
association version, model, inquiry snapshot or manufacturing status.

## Source and scope

The geometry comes from page 1 of the pinned `sheet.pdf` published in the
draftwright examples snapshot `c4c72a71`. The paired OCCT STEP, source review and
license remain in this directory. The files remain covered by the existing
Open CASCADE source notice and GNU LGPL 2.1 with the Open CASCADE exception.

| Original file | SHA-256 |
| --- | --- |
| `sheet.pdf` | `20799c4c0107c3cc7998f7c56c014b91533b83b413e85954710801a6bc0e7c08` |
| `sheet.svg` | `836ff6ef0a8adf40d0b27790ea8d5f55c396754ac41bff376d6a7e9b17de6c2d` |
| `linkrods.step` | `3674e4b01ee0e983c81ed170f0574cda201ad08e0f7b46e05e4f4613400fd5f7` |

The source is an unreviewed automatic drawing. It supplies no manufacturer
revision, material, tolerance or approval. Its incomplete freeform dimensioning
and other recorded source-review findings remain applicable. The small nominal
dimensions are the original sample's millimetre values; the asset is not scaled
to resemble a production-sized rod.

## Presentation contract

The profile contains five presentations. Each declares an annotation variant,
crop and complete region list. Every selected region retains a canonical source
sheet/region ID. The original `package.json` supplies the business reference.

| Presentation ID | Label | Canonical region |
| --- | --- | --- |
| `top` | Top view | `overview`, `large-bore`, `small-bore`, `connecting-web` |
| `large-bore` | Large bore | `large-bore` |
| `small-bore` | Small bore | `small-bore` |
| `web` | Connecting web | `connecting-web` |
| `isometric` | Isometric view | `overview` |

The useful hole/web projection is the source **top** view. The isometric is an
alternate whole-part view taken from the same source page. Its link to
`overview` does not relocate that canonical association: the source overview
bounds remain `[62, 137, 267, 119]` in the top projection. All features belong to
the one real solid `linkrod-body`.

The SVG has two separate artboards within one `0 0 2300 740` coordinate frame.
The top and feature views crop the left artboard; the isometric crops the right.
The renderer must use the selected presentation's `viewBox` and `regions`
together, while showing only the matching `data-presentation` annotation group.
The SVG contains no raster images, runtime scripts, external resources or style
elements. All geometry uses non-scaling strokes.

Circle records describe bore hit targets. Their highlight paths are the exact
source bore curves, rather than newly generated circles. Web and overview
records use source path outlines and prepared bounds. Those prepared coordinates
are presentation metadata, not revised canonical mapping coordinates.

## Geometry and annotation provenance

The generator retains all 1,306 selected vector paths without simplification:

- Top contour: source PDF drawing operations 703-1135, inclusive (433 paths).
- Top centers: operations 2-5, inclusive (4 paths).
- Isometric contour: operations 2135-3003, inclusive (869 paths).
- Large bore highlight: operations 790 and 791.
- Small bore highlight: operations 744 and 745.
- Connecting web highlight: operations 837, 850, 851 and 852.

Contour and center line roles are preserved; neutral color and stroke hierarchy
replace the source drawing's page styling. The selected projections contain no
hidden-edge paths. The generator applies only recorded uniform transforms to
source path commands. It does not reconstruct the model or invent geometry.

Dimension leaders are recomposed for legibility. Values are taken directly from
the source: horizontal spacing `3.875`, center offset `0.125`, through bores
`Ø1.034` and `Ø0.440`, and outside diameters `Ø1.5` and `Ø0.791`. The small center
offset is written as a source note in the top view, avoiding a misleading
enlarged geometric offset. The web and isometric receive no new dimensions.

The source explicitly prints scale 10:1 for the orthographic drawing and
identifies the isometric as not to scale. Source-path checks recover the
horizontal spacing as 3.8749998 mm and center offset as 0.1249999 mm. The bore
paths agree with the source STEP radii to within 0.00001 mm. Printed bore and
outside diameters retain the source's rounded values.

## Reproduce and validate

From the repository root, with PyMuPDF installed:

```sh
python3 content/drawings/linkrods/source-tools/make-technical-svg.py
node content/drawings/linkrods/source-tools/verify-source.mjs
```

The generator verifies the original hashes before extraction, checks printed
values and geometry against the source, and asserts that every original file
remains unchanged. It writes only `technical-main.svg` and
`technical-main.json`. Path indices, transforms, canonical region bounds and
numeric checks are recorded in the generated profile.

Review the top, both bore details, web and isometric on desktop and mobile.
Check that each view keeps its proper source identity when used in an inquiry.
The source PDF remains available as the authoritative published reference.
