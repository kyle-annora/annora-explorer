# Integration kit API

`@annora/integration-kit` **0.1.0** adds a viewer-independent inquiry boundary.
It does not replace the host's renderer, navigation, product catalog or project
store. Adapter contract **`'1'`**, saved-view reference **`'1'`**, product revision
and model revision are separate version identities.

The package has an ES module entry, `./style.css`, and an explicitly optional
`./demo-repository` entry. React and React DOM are external peers; install the
versions specified in the package manifest. The qualified host uses **19.3.1**.
Three.js, PDF rendering, models and product documents belong to the host, not the
kit. This release is a downloadable package, not an npm registry publication.

## Composition

```js
import {
  createIntegrationController,
  mountEmbeddedInquiry,
} from '@annora/integration-kit';
import '@annora/integration-kit/style.css';

const integration = createIntegrationController({
  adapter: existingViewerAdapter,
  context: {
    productId: 'example-product',
    productTitle: 'Example product',
    productRevision: 'product-r1',
    modelId: 'example-model',
    modelRevision: 'model-r1',
  },
});

const inquiry = await mountEmbeddedInquiry(inquiryElement, {
  repository: hostProjectRepository,
  onCapture: () => integration.captureContext(),
  onRestore: context => integration.restoreContext(context),
  onProject: project => openHostProject(project.id),
});

// Attach on an intentional action, not on hover or every camera frame.
await inquiry.open({
  context: await integration.captureContext(),
  opener: requestButton,
  suggestedIntent: 'quotation',
});
```

The context must identify the product and model versions the adapter actually
has loaded. Keep those identities fixed for that controller's lifetime. Before
changing product, version or route, await `inquiry.beforeLeave()`. A false result
means saving failed: retain the editor and current route. Dispose the panel and
integration when departure succeeds. The host remains responsible for disposing
its own viewer and any network resources.

## Viewer adapter

```js
const existingViewerAdapter = {
  version: '1',
  id: 'example-viewer',
  adapterVersion: '1',
  coordinateFrame: 'source-meters-y-up-v1',
  capabilities: {
    inquiry: true,
    selectedPart: true,
    capturedView: true,
    drawingDetail: false,
    story: false,
  },
  async capture({ signal }) {
    signal.throwIfAborted();
    return {
      part: { id: 'stable-part-id', title: 'Connecting rod' },
      snapshot: capturePlainViewerState(),
    };
  },
  async restore(snapshot, { signal }) {
    // Validate the exact source, schema, part IDs and coordinate frame first.
    validateSavedViewerState(snapshot);
    signal.throwIfAborted();
    await restorePlainViewerState(snapshot, { signal });
  },
};
```

All five capability flags are explicit booleans. `inquiry` must be true. An
enabled contextual capability requires `capture`; `capturedView` also requires
`restore`. An inquiry-only adapter needs neither method. Returning a field for an
undeclared capability fails instead of dropping that field.

| Capability | Allowed capture fields | Meaning and limitation |
| --- | --- | --- |
| `inquiry` | None required | Product/version inquiry without claiming a saved view |
| `selectedPart` | `part: {id, title}` | Stable source identity, not a mesh index or current label |
| `capturedView` | `snapshot` | Bounded opaque JSON understood by this adapter; required when advertised |
| `drawingDetail` | `drawing`, `document` | Complete existing exact-version drawing context, not a screenshot alias |
| `story` | `chapter` | Existing chapter identity including its `tourId`; not automatic playback support |

Capture may omit a selected part when nothing is selected. A `story` or drawing
flag describes context that can be attached; it does not add playback, drawing
rendering, authoring or an external asset resolver. The independent example
supports product inquiry, selected parts and saved camera views. Drawing and
story capabilities remain unavailable there.

The adapter must reject unknown historical sources and unavailable parts before
changing its scene. It must respect the supplied abort signal, including after
asynchronous work. The controller rejects late results, but cannot undo scene
mutations performed by a host adapter that ignores cancellation.

## Controller methods

| Method | Contract |
| --- | --- |
| `createIntegrationController({adapter, context, timeoutMs})` | Validates adapter and pinned context; timeout defaults to 8 seconds, permitted range 1–60,000 ms |
| `capabilities()` | Copy of the five declared flags |
| `descriptor()` | Copy of contract, adapter and coordinate-frame identities |
| `captureContext({signal}?)` | Validated product context with only supported references; inquiry-only returns the pinned product context |
| `restoreContext(context, {signal}?)` | Requires captured-view support, exact product/model and adapter identity; returns the unchanged saved context after restore |
| `cancel()` | Aborts the active operation; saved references stay unchanged |
| `dispose()` | Idempotently cancels work and rejects later operations; does not dispose the host viewer or save an inquiry |

A newer capture/restore supersedes the older operation. Timeout, cancellation
and disposal cannot attach a late capture to the inquiry. Retry is a fresh
explicit action. This is a same-document adapter: it adds no iframe handshake or
cross-origin permission mechanism. Hosts embedding the Annora Explorer continue
to use the existing [exact-origin JSON bridge](https://github.com/kyle-annora/annora-explorer/blob/main/docs/integration.md).

## Saved external view

An external snapshot uses `ProductContext.viewerReference`; it is not relabeled
as an Annora `inspection`.

```json
{
  "version": "1",
  "adapter": {
    "id": "example-viewer",
    "version": "1",
    "coordinateFrame": "source-meters-y-up-v1"
  },
  "product": { "id": "example-product", "revision": "product-r1" },
  "model": { "id": "example-model", "revision": "model-r1" },
  "snapshot": {
    "schemaVersion": 1,
    "selectedPartId": "stable-part-id",
    "camera": { "position": [1, 1, 1], "target": [0, 0, 0] }
  }
}
```

The `snapshot` above is illustrative; its schema belongs to the adapter. The
kit copies inert JSON only: finite numbers, strings, booleans, null, plain
objects and dense arrays. Limits are 64 KiB UTF-8, depth 10, 4,096 visited values,
256 entries per array, 128 keys per object and 8,192 characters per string.
Functions, Three objects, accessors, cycles, sparse arrays and dangerous keys
are rejected. No silent truncation occurs.

An exact adapter version and coordinate frame are required to restore. There is
no automatic adapter migration, latest-source fallback or substitution of a
current camera for an unavailable saved view. Product/model versions, drawing
versions and saved reference versions remain distinct. Legacy records keep their
original shape rather than acquiring today's attribution.

## Repository ownership and confirmation

`mountEmbeddedInquiry` requires the host's repository. It never implicitly opts
an external client into the ordinary Annora sample store. For external views,
the repository must declare `supportedViewerReferenceVersions: ['1']` and retain
the full reference at draft save, review, confirmation and historical reads.
Support declarations are checked against returned records; a reference that
disappears during a round trip is an error. Multi-question contexts require
`supportsRequestItems: true` as well.

Required methods are `getDraft(context)`, `saveDraft(draft)` and
`submitInquiry(review)`. `prepareInquiryReview(draft)` is optional but must return
the same saved draft in its reviewed packet. See the
[repository contract](https://github.com/kyle-annora/annora-explorer/blob/main/docs/product-room-api.md) for concurrency, immutable history and
the later seller workflow. The optional demo repository is browser-local fake
data; it is not a backend, delivery receipt, account or access-control system.

The panel keeps **Details → Review → explicit confirmation**. Capturing a view
never submits an inquiry, selecting a part never declares quote scope, and
reviewing never confirms. A failed save retains editable input and blocks
departure. A failed confirmation keeps its reviewed packet available for an
idempotent retry. An unsupported repository must be upgraded or replaced
explicitly; the kit cannot strip a reference to make it fit.

## Failure handling

| Error | Host behavior |
| --- | --- |
| `UNSUPPORTED_ADAPTER_VERSION`, `INVALID_ADAPTER` | Do not mount misleading contextual controls; correct the adapter |
| `UNSUPPORTED_CAPABILITY` | Explain that the action is unavailable; preserve the existing attachment |
| `INVALID_REFERENCE`, `UNSUPPORTED_REFERENCE_VERSION` | Keep original bytes and refuse reinterpretation or reset |
| `IDENTITY_MISMATCH`, `INCOMPATIBLE_ADAPTER` | Open the original compatible source or report unavailable; never restore latest instead |
| `VIEWER_TIMEOUT` | Keep input and reference; offer retry |
| `STALE_OPERATION`, `CANCELLED`, `DISPOSED` | Ignore superseded completion; do not show a success receipt |
| Repository validation, conflict or storage failure | Keep the reviewed/editor state; resolve explicitly before departure or confirmation |

Adapters may return a more specific unavailable-source error. Display its useful
message without turning an unavailable historical source into an empty inquiry.
Validation errors at the shared domain boundary can surface as `VALIDATION`;
do not depend on an inner implementation exception to decide whether to save.

## Upgrade boundary

Pin the package artifact, host application, viewer adapter and snapshot schema
independently. Back up the host-owned store and qualify old drafts, confirmations
and exact restore before deploying. Retain the previous application artifact for
rollback. Unsupported versions must fail without clearing or normalizing away
stored fields.

Version 0.1.0 is the first kit release. Its qualification includes a fresh build,
compatible same-version reinstall and unsupported-version preservation. Those
checks do not claim a production migration from an earlier kit release. See
[acceptance and limitations](integration-kit-acceptance.md).
