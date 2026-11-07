# W50 — Existing viewer to reviewed inquiry

The integration kit makes the product-to-inquiry boundary independently installable. A customer's viewer can keep its rendering, camera and selection logic; Annora attaches those references to a reviewed request. Published and verified on November 6, 2026 (Pacific), application commit `7a82541cf17c8cba0431e85977e08b27c535e7bb`. The exact deployed source and public artifact are recorded in the [release receipt](evidence/integration-kit/release-receipt.json); a local build is not publication evidence.

## Review path

1. Open the [independent viewer example](https://kyle-annora.github.io/annora-explorer/integrations/existing-viewer/).
2. Select **Connecting rod** in the model or part list. Rotate the mechanism and choose **Request a quote**.
3. Describe a fictional application, quantity and requested scope. Minimize the inquiry, select another part, and reopen it: the original reference stays attached. Replacing it requires **Use current view**.
4. Choose **Review inquiry**. Inspect the selected part and saved reference, then explicitly **Confirm demo inquiry**.
5. Open **View saved inquiry** / **Saved inquiries**, then **View saved reference**. The original part and camera return, including after reload.

The host has one independent Three.js viewer, not an Annora Explorer iframe. The library carries no renderer or model. This fixture supports selection and saved views; drawings and guided stories are explicitly unavailable. The crank is a public mechanism study in a static pose, not a simulated machine.

## Delivery

- Versioned `@annora/integration-kit` 0.1.0 ES-module package, stylesheet, manifest, licenses, viewer/repository templates and English documentation.
- Exact product/model/adapter/coordinate-frame references. External snapshots use `viewerReference` v1 and never masquerade as Annora `inspection` snapshots.
- Capability checks, timeout/retry, cancellation, stale-response rejection and safe disposal. Unsupported versions and lossy repositories cannot silently replace a saved reference.
- Existing floating inquiry with review before confirmation. Host-owned persistence remains explicit; the browser-local sample repository requires a namespace and storage object.
- Separate Vite example builds against the packed artifact. No parent-source imports, aliases or hidden renderer substitution. Its public model and license belong to the host, not the kit.
- Existing inquiry/quote/change/discussion records preserve external references. Historical native records keep their existing keys and shapes.

Start from the [integration guide](integration-kit.md), [API contract](integration-kit-api.md), and [acceptance matrix](integration-kit-acceptance.md). The [downloadable package](https://kyle-annora.github.io/annora-explorer/integration-kit/annora-integration-kit-0.1.0.tgz) and [artifact manifest](https://kyle-annora.github.io/annora-explorer/integration-kit/release.json) are published with the site.

## Validation

- Repository checks and all 988 tests completed: **987 pass**, one pre-existing conditional skip, no failures. Main application, inquiry-only library, integration package and independent host builds pass.
- A fresh host outside the repository installs and builds the tarball. **14 installed-artifact checks** exercise supported/unsupported capabilities, exact restore, stale/timeout/cancel/dispose, missing original model, incompatible stores, explicit review/confirmation and same-version reinstall with unchanged data.
- **44 independent-host browser checkpoints**, at 1280×900, 390×844, 320×740 and 844×390: forced save failure and recovery, stable attached reference, review/edit/confirm, exact saved-camera restore, reload, navigation, inaccessible storage and one-canvas/no-iframe checks. No horizontal overflow or page errors. No frames rendered during the 400 ms observed idle window.
- Existing crank walkthrough: **32 checkpoints** across desktop/mobile, retaining all eight confirmation gates per run, quote v1/v2 and archived context. SK08 mobile A→B: **15 checkpoints**, retaining original inquiry/questions/v1 while only reviewed references advance to B.
- Independent visual finish review: mobile selector clipping and token mismatches corrected. The inherited shared inquiry and Explorer visual system remain unchanged.

These are automated/local-browser results, not customer acceptance. Real Chrome Back navigation passed; genuine bfcache restoration did not occur in the test environment, so the retained-page branch was tested synthetically. Mobile tests use browser emulation, not physical phones. No ordinary-PC hardware performance claim is made.

The public target passed a further **22 browser checkpoints** on desktop/mobile. All seven example assets match the qualified build. The publicly downloaded tarball was hash-verified, installed into a fresh external host, rebuilt and passed all 14 artifact checks again.

## Preservation and limits

Explorer runtime, model packages and product configuration are unchanged. The example uses `annora.integration-example.projects.v1`; existing Room, Studio and customer project namespaces are untouched. C&B/MK private material is excluded. No production API, account, email or external submission is added.

This is a supported first adapter and bounded contract, not certification of every commercial viewer. React/React DOM 19.3.1 are the qualified peers. This first release proves same-version reinstall, not a cross-version production migration. A future adapter must pass its own identity, capability, lifecycle, accessibility and performance qualification.
