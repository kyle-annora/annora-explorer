# Independent viewer fixture

This host owns a small Three.js viewer. It does not import Annora's Explorer,
embed its iframe, or reuse its camera normalization, component tree or renderer.
The integration kit receives JSON through the adapter below. All geometry and
Three.js objects stay private to this viewer.

The fixture uses the public **Kinetic 01** mechanism by Pradeep Kaushik, MIT,
pinned to source commit `c361b9ad46f91ba960c708c2510aa204ad45605b`. Preserve
`public/MODEL-LICENSE.txt` and `public/fixture.json` when redistributing it. The
GLB is byte-identical to its published source. This viewer verifies its SHA-256
before loading: `5356cb1e7dcf85874c1f2152795b7011f43f01c2bfc899a5fa75a198687204ad`.
The package model revision is separately pinned in `fixture.json`; source bytes
alone do not establish all semantic part identities.

## Host API

```js
import { createExistingViewer } from './viewer.js';

const viewer = await createExistingViewer({
  element: document.querySelector('#model'), // Container with an explicit height, or a canvas.
  modelUrl: './model.glb',
  fixtureUrl: './fixture.json',
  onSelection: part => console.log(part), // { id, title, group } or null.
});

const unsubscribe = viewer.subscribe(state => console.log(state.selectedPart));
viewer.selectPart('kinetic-node-001'); // Connecting rod; stable in this pinned revision.
viewer.fitSelection();
const captured = await viewer.capture({ signal: new AbortController().signal });
await viewer.restore(captured.snapshot);
// Keep this viewer mounted while the host opens, minimizes or reviews an inquiry.
unsubscribe();
viewer.dispose();
```

The returned object implements adapter `version: '1'`, ID
`annora-example-three-viewer`, implementation `adapterVersion: '1'`, and
coordinate frame `source-meters-y-up-v1`. It supports inquiry, selected-part and
captured-view context. Drawing details and story chapters are **unsupported**;
the host must not present them as attached context.

`capture()` returns `{ part?, snapshot }`. `part` is omitted when the whole
model is selected. The vendor snapshot is plain JSON containing schema version
`1`, model ID/revision, coordinate frame, selected part ID (or `null`), camera
position/target/up and perspective `fov`, `zoom`, `near`, `far`. It uses the
source model's metres and Y-up orientation. The integration kit wraps that
payload with adapter identity. Do not translate it into Annora's normalized
assembly coordinates.

`restore()` rejects a missing or different model revision, unknown part,
unsupported snapshot schema/frame, or invalid camera. It never substitutes the
latest model. Aborted capture/restore reject with `AbortError` before mutation.
An initial `signal` cancels loading; the host still calls `dispose()` when
unmounting a successfully loaded viewer.

Other host methods are `getState()`, `getParts()`, `reset()` (whole-model camera,
retaining selected context), `fitSelection()`, `selectPart(id | null)`,
`subscribe(listener)` (returns unsubscribe) and `dispose()`. The non-business
`getDiagnostics()` provides render count, canvas count, DPR, meshes and triangles
for qualification; these diagnostics are never attached to an inquiry.

## Scope and performance

This example shows a static source pose with neutral presentation materials.
It does not claim operating simulation or play the source's authored animation.
Material colors are visualization choices, not manufacturing specifications.
Source parts remain individually selectable; the example does not fabricate
technical drawings, dimensions or documentation.

- One canvas, no post-processing, shadows, CAD kernel or continuous idle render loop.
- Orbit damping schedules frames only while the camera changes; hidden documents stop rendering.
- Pointer picking is coalesced to a frame; feature-edge highlights are built lazily per hovered/selected part.
- DPR is capped at 1.5 on coarse-pointer or narrow viewports and 2 on desktop.
- The 107 meshes contain 74,572 triangles. The GLB is 2,574,332 bytes, or 595,025
  bytes when served with the existing gzip encoding. Hosting without transport
  compression transfers the raw bytes; a `.gz` sibling alone is insufficient.
- Cleanup removes listeners and observers, cancels frames/loading, disposes
  controls/geometries/materials and releases the viewer's WebGL context.

These limits are implementation choices, not measured phone or low-end GPU
benchmarks. Qualification must record the actual browser, viewport and device.
