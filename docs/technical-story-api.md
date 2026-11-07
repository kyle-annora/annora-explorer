# Technical steps in a product story

W40 extends the existing version 1 story union. Existing `chapter` and
`inspection` steps keep their behavior. A `technical` step holds an exact drawing
reference and may pair it with a compatible saved 3D inspection. It does not
generate geometry, dimensions, motion or an engineering approval.

## Prepared content

```js
const technical = createTechnicalStoryReference({
  context: drawingContext, // from the existing createDrawingContext boundary
  pdfPage: sheet.pdfPage || 1,
  rotation: sheet.rotation || 0,
  viewId: preparedOverviewView.id, // null explicitly selects the original source
});
const choice = { id: 'front-bore', title: 'Front view · shaft bore',
  nodeId: drawingContext.part.id, technical };
const step = { id: 'read-bore', kind: 'technical', nodeId: choice.nodeId,
  title: 'Locate the shaft bore', caption: 'Review the highlighted source detail.',
  technical: choice.technical };
```

The helper saves only the model, part and drawing portion of the context. The
commercial Room snapshot is supplied by the release when an inquiry is created;
it is not duplicated in every story step. The drawing reference retains:

- Drawing, source-file and model revision identities, including the file hash.
- Sheet, source PDF page, page rotation, selected region and confirmed mapping revision.
- The exact overview snapshot and revision, or explicit `null` for a source-only
  presentation. A technical view must contain the selected confirmed region.

Prepared reference descriptors are supplied as `technicalReferences` to
`validateProductStory` and `createStoryController`. New previews and publication
must match one descriptor exactly by source identity. Label changes do not rebase
the source. A changed file, page, association or overview requires a new explicit
choice and the normal release review.

`historical: true` validates stored structure and model identity without requiring
the old source to remain in today's catalog. Reading that history still resolves
its exact source; missing assets show an unavailable state. No current reference
is substituted. Manufacturing approval remains separate from a confirmed
presentation association.

## Host adapter

```js
createStoryController({
  viewer, model, parts, story, technicalReferences,
  async showTechnicalReference(technical, { signal, isCurrent, step }) {
    // Resolve the exact saved source and overview through the drawing repository.
    const resource = await resolveExactReference(technical.context);
    if (signal.aborted || !isCurrent()) { resource.dispose?.(); return; }
    // Mount one existing drawing reader; retain this step when mobile switches
    // between the 3D pane and the drawing pane.
    showReader(resource, technical, step);
  },
  clearTechnicalReference() { closeReaderAndReleaseAssets(); },
});
```

The host must check both cancellation and current ownership after asynchronous
work, before presenting a reader. It must release source URL leases on cleanup.
The callback must reject unavailable or incompatible references instead of
showing another file. When no callback exists, selection reports
`UNSUPPORTED_CAPABILITY` before changing the viewer.

The controller pauses the existing viewer, exits an active tour, opens the exact
technical source, then restores an optional inspection or focuses the linked
part through the existing JSON API. It creates no renderer or animation clock.
Changing steps, closing, manual takeover and disposal abort pending reading work
and clear the technical pane. A stale load cannot issue a later camera command.
Technical steps do not expose an animation timeline or invent playback duration.

## Checks

`tests/runtime/technical-story.test.js` covers source/page/mapping/overview
mismatch, exact historical pins, optional compatible 3D capture, missing host,
source failure, cleanup and late-load cancellation. Existing story repository,
release-review and motion controls remain covered by
`tests/runtime/product-story.test.js`. Browser acceptance separately verifies
the host reader, mobile pane switching and the inquiry/quotation handoff.
