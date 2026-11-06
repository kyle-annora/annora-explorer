# Product expansion: first delivery review

This delivery covers contextual request items and the first Studio story editor.
The remaining approved roadmap is in [the expansion program](product-expansion-program.md).
It is not a claim that all six product extensions and both foundations are complete.

## Review routes

- [Explorer: crank mechanism](https://kyle-annora.github.io/annora-explorer/?model=kinetic-01)
- [Technical drawings: SK08](https://kyle-annora.github.io/annora-explorer/drawing-preview/?product=sk08&view=drawings)
- [Studio: Presentation](https://kyle-annora.github.io/annora-explorer/studio/#edit/presentation)
- [Product Room: crank mechanism](https://kyle-annora.github.io/annora-explorer/product-room/?model=kinetic-01#explore)
- [Existing commercial walkthrough](https://kyle-annora.github.io/annora-explorer/walkthrough/?new=1)

## Collect two requests

Select a component and open its inquiry. Add current view, choose a purpose and
write a short question. Keep exploring, select another component, resume the
same inquiry and attach the second view. Both references remain independent.
For SK08, repeat with the shaft bore and cross-bore.

Review both items, then confirm separately. Open the project and view it as the
seller. Each request can return to its own part or drawing region. The seller
still reviews requested items before including them in a quotation.

## Author and release a story

In Studio → Presentation, add a prepared short action and a captured view. Give
each a concise title and explanation. Reorder them and save the draft. On mobile,
capture from the visible model with Capture view and return.

Use Preview → Preview options → 3D Explorer to run the sequence. Check replay,
pause, progress and Explore freely. Review release changes, check the explicit
confirmation and publish the demo version. Open the released Room and use Ask
about this step to start an inquiry with the selected part and product release.

This local release is visible in the same browser only. A hosted product release
continues to use the existing release export and deployment workflow. No new
story is silently inserted into existing customer projects or old releases.

## Scope and limits

- Stories currently author the existing prepared crank product. They reuse its
  2–3 second actions or exact free-view captures, with at most eight steps.
- Request lists support up to twelve independently pinned references. Legacy
  single-reference projects retain their meaning.
- Model motion, engineering materials, linework, drawing associations and the
  existing quotation/change/confirmation workflow remain in place.
- Browser storage and fake data are the only persistence. The API seam is ready
  for an explicitly capable adapter; there is no backend or external submission.
- Customer-specific sharing, approved alternatives, change-impact review,
  action-level sales workspaces and onboarding/integration tooling remain planned.
- Browser-emulated mobile checks are not physical-device or ordinary-PC
  performance measurements. Customer comprehension and conversion are unmeasured.

## Validation and publication

The compiled candidate passed the following checks:

| Check | Result |
| --- | --- |
| Required `npm run verify` | 781 passed, 1 existing skip; asset checks and site build passed |
| Distributable inquiry build | Passed, including the shared request-item UI |
| Two independent crank references and two SK08 holes | Desktop and phone: collection, review, confirmation, buyer/seller display and exact reopen passed |
| Story authoring and local release | Desktop, phone, narrow phone and short landscape: action + captured view, ordering, preview, review, release and inquiry handoff |
| Original commercial walkthrough | 1440, 390 and 320 px; 21 checkpoints and 8 explicit confirmation gates per run |
| Failure/history cases | Adapter data loss, failed save/restore, stale review, archived story versions and native takeover covered |

The browser checks use Chrome desktop and touch emulation. All tested routes
retained their reference identity without page errors or horizontal overflow.
The authoring sequence uses the existing animation player. Buyer stories show
one set of playback controls; native Explorer and single-step Studio previews
retain their controls. Short landscape puts the story beside the model.

Visual evidence: [request review on phone](evidence/product-expansion/request-review-mobile.png)
and [authored story on desktop](evidence/product-expansion/authored-story-desktop.png).

Publication is pending a successful GitHub Pages run and target verification.
The local evidence directory is `work/product-expansion/`; it contains retained
failed probes as well as the corrected acceptance runs, so failed intermediate
test assumptions are not mistaken for final product failures.
