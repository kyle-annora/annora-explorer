# Integration kit 0.1.0

Keep an existing 3D viewer and attach the selected part and saved camera to a reviewed inquiry. The viewer remains responsible for rendering and selection. The host owns persistence and network delivery. This package does not contain a renderer, model, document, customer data, or backend.

The first qualified host is the independently implemented Three.js example in `examples/existing-viewer`. Other viewer products need their own adapter and qualification; compatibility is not implied.

## Try the independent example

[Open the example](https://kyle-annora.github.io/annora-explorer/integrations/existing-viewer/).

Select a crank part in the canvas or part list. Choose **Request a quote**, describe the need, and continue to **Review inquiry**. Check the exact part and view, then **Confirm demo inquiry**. Open **Saved inquiries** to restore the original camera. A changed live selection never silently replaces an attached reference.

The fictional records stay in `annora.integration-example.projects.v1`. They do not share storage with Explorer, Product Room or Studio. Nothing is sent. The example shows a static pose, without pretending to simulate the mechanism. Drawing details and guided stories are explicitly unavailable in this viewer.

## Install the distribution

Requirements: Node 22.13 or newer; React and React DOM **19.3.1**. Other peer versions are not qualified in 0.1.0.

Download the tarball and `release.json` from the published `integration-kit/` directory. Check its SHA-256 against `release.json`, then install:

```sh
npm install ./annora-integration-kit-0.1.0.tgz react@19.3.1 react-dom@19.3.1
```

Import `@annora/integration-kit/style.css` once. The example uses Vite; the library is an ES module, with React as a peer dependency. No registry publication is claimed.

```js
import { createIntegrationController, mountEmbeddedInquiry } from '@annora/integration-kit';
import '@annora/integration-kit/style.css';

const controller = createIntegrationController({ adapter: yourViewerAdapter, context: exactProductContext });
const inquiry = await mountEmbeddedInquiry(mountElement, {
  repository: yourRepository,
  onCapture: () => controller.captureContext(),
  onRestore: context => controller.restoreContext(context),
  onProject: project => openYourProject(project),
});
await inquiry.open({ context: await controller.captureContext(), opener: requestButton });
```

Do not create a second renderer for this integration. The adapter exchanges bounded JSON only, without Three.js objects. Use `templates/viewer-adapter.js` and `templates/repository-adapter.js` inside the package as the connection points. See [the API contract](integration-kit-api.md) for identities, capabilities, failure handling and lifecycle.

## Run a fresh, independently built host

From a fresh checkout of the template:

```sh
npm ci
npm run build:integration
npm run build:integration-example
```

The second command creates `dist-integration/annora-integration-kit-0.1.0.tgz`. The third prepares the public, licensed crank model, installs the packed library in the independent example, and builds it. It copies the built host to `dist/integrations/existing-viewer/` and the tarball/receipt to `dist/integration-kit/`.

To move the host to another repository, copy `examples/existing-viewer` **including its prepared `public` files**, excluding `node_modules`, `dist` and `package-lock.json`. Copy the tarball alongside it. Change the package's `file:` dependency to your tarball's relative location, run `npm install`, then `npm run build`. Serve that host's `dist` on any static host. Its build needs no Annora source, source aliases, Explorer iframe, or parent repository. Keep the model license with the assets.

For an existing application, use your own model and adapter instead of the example viewer. Replace the demo repository with your API adapter. Do not put credentials in a public browser bundle.

## Version and lifecycle rules

- Pin product ID/revision, model ID/revision, viewer adapter version and coordinate frame. Do not reinterpret a saved camera against a different model.
- Capability flags are explicit: inquiry, selected part, captured view, drawing detail, story. An unsupported capability must not appear functional or silently discard metadata.
- External snapshots use `viewerReference` version 1. Annora's native `inspection` remains unchanged. Unknown versions fail closed.
- Repositories supporting external snapshots declare `supportedViewerReferenceVersions: ['1']` and preserve the entire request. The declaration is checked alongside returned data; it is not a substitute for round-trip validation.
- Await `inquiry.beforeLeave()` before replacing the host. `inquiry.dispose()` can refuse when a draft cannot save. Dispose the controller, subscriptions and your viewer only after navigation is allowed.
- Capture/restore operations have a timeout, cancellation and stale-result protection. Adapters must honor their AbortSignal before mutating the viewer.
- Confirmation is a distinct action after review. A saved draft or URL never supplies consent.

## Scope of 0.1.0

The example qualifies part selection, capture/restore and a two-step inquiry in a same-document external viewer. Drawing and chapter context can be carried by capable adapters using the existing version contracts; those renderer features are not added to this example. Existing Annora iframe transport keeps its separate exact-origin/session checks. This kit is not an arbitrary iframe receiver and is not a full same-document Explorer SDK.

An explicit browser-only sample adapter is available from `@annora/integration-kit/demo-repository`. It requires a namespace and storage object. Production hosts supply their own repository API.

This is the first package version. Reinstall/rollback qualification proves compatibility with the same package and saved data; it does not claim a tested migration from a nonexistent earlier package.

## Build evidence and release checks

`manifest.json` contains source-module and output hashes, bundled dependency versions, peer versions, protocol and package version. `release.json` identifies the packed artifact. The asset boundary fails the build if it pulls in model/content packages, Three.js, PDF.js or Studio/Explorer runtime.

Run `node scripts/review/integration-kit/fresh-host.mjs` to install and build the packed library in an external temporary directory. See [acceptance gates](integration-kit-acceptance.md). Deployment receipts distinguish source, build, browser checks and actual public availability.

## Changelog

### 0.1.0

First versioned viewer-independent package: explicit capability contract, external snapshot identities, capture/restore lifecycle, reviewed floating inquiry, opt-in demo repository, independent crank fixture and installation evidence.
