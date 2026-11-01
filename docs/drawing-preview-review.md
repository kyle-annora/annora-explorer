# Linked drawing preview: release review

Review route: `/drawing-preview/`. Date: 2026-11-01.

## Verified behavior

- The original STEP and published drawing retain their pinned SHA-256 identities.
  The derived GLB and vector sheet are traced to those source files.
- Clicking the visible 3D rod locates its drawing view. Bore and web regions select
  the real parent solid; an explicit Locate in 3D action frames the chosen detail.
- The same public Explorer controller serves Engineering, Linework and Flat.
  Detail cameras preserve the rendering mode. Camera transitions settle before
  further restoration; a bounded second pass handles a changed floating-UI layout.
- The initial page fits the full drawing. Deep links preserve a chosen region
  even when the model finishes loading later. Keyboard, drag, zoom and pinch
  interactions were exercised at 1440, 390 and 320px widths.
- An explicit inquiry action attaches the selected part, sheet, region, drawing
  version, original PDF hash and model revision. Review creates no project;
  confirmation creates the browser-local record. Saved inquiries reopen their
  exact drawing selection. Refresh and browser Back preserve the route.
- A real seeded crank inquiry/quotation fixture and Studio storage remained
  byte-for-byte unchanged through the desktop and mobile drawing inquiry flow.
- The existing Explorer runtime was not edited. The drawing host owns its route,
  vector viewer and isolated inquiry repository. The additional model is a normal
  imported model package; the default remains the crank mechanism.

## Performance evidence

One model, one iframe, one renderer. The model has 15,242 triangles; its prepared
GLB is approximately 197 KB compressed. Drawing zoom and pan are event-driven,
with no continuous rendering loop. The STEP CAD parser is an offline preparation
step and is not shipped as a browser runtime.

Local headless Chromium measurements, warm local assets, desktop and 390px:
model ready approximately 0.28–0.36s; simulated 4× CPU slowdown approximately
0.69s. First detail location approximately 1.9s, including authored camera
settling and one bounded layout correction. Rendering changes were below 60ms
in that simulation. These measurements are not a low-end-device certification
or an estimate of public-network load time.

## Boundaries

The source drawing is automatic and unreviewed. It has no manufacturer revision,
material, general tolerance or approval. The source review records missing
annotations and other limitations. Preserve that status when replacing sample
content. This is a linked-reference and inquiry preview, not CAD editing,
manufacturing approval or an exact measurement tool.

Close-up contour rendering may show broken segments on curved surfaces in the
existing Linework renderer. The original vector sheet is the drawing reference.
The isolated preview supports the reviewed buyer inquiry; seller quotations
remain in the existing crank Product Room/Studio demonstration.

Original PDF and STEP downloads were checked under the compiled repository
subpath, including exact file hashes. The source, attribution and license travel
with the assets; template code remains MIT and the CAD assets keep their OCCT
LGPL terms and exception.
