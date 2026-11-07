# Customer follow-up

## Scope

A seller prepares a short follow-up inside a confirmed crank-slider customer project. It combines selected steps from the project's published product story, compatible saved inspection views, and the customer's original request items. The buyer can pause, replay, explore freely, resume, and continue to one exact quotation or pending clarification in the same project.

This is an additive browser-local demonstration. It does not send messages, create accounts, publish private projects to a server, or record an agreement. Backend delivery, authorization, tenant isolation and cross-device persistence remain future adapter responsibilities.

## Review path

1. Open Studio → Customer projects → the project → **Prepare follow-up**.
2. Edit the opening, choose and order existing story steps or saved views, and select the original customer requests being addressed.
3. Select one exact quotation version or the currently unanswered clarification.
4. Preview the buyer experience. Return to the same draft to edit.
5. Review the complete content and exact next action. Explicitly confirm before publishing a local version.
6. Open that version as buyer. Explore or replay, then enter the referenced quotation or reply flow. The existing commercial review/confirmation gates still apply.

Projects whose pinned product release has no story or compatible saved inspection will have no available steps. Publishing a new global product version does not silently upgrade those inquiries. This first delivery does not offer a migration of confirmed inquiry content.

## Identity and history

The follow-up stores the exact project, model revision, product release, ordered source snapshots, original request-item snapshots and target identity. A quotation target is its ID plus version. A clarification target is its original message ID and is actionable only while that message still awaits a reply.

Each confirmed follow-up is immutable. A second version does not modify the first, the global product release, the confirmed inquiry, or any issued quotation. Step position is stored separately for each follow-up version and is not a read receipt, acceptance or business transition. If a target is no longer actionable, the original follow-up remains readable and the interface returns the visitor to the project without redirecting to a different target.

Review uses the persisted draft and project revisions. Concurrent project or draft changes invalidate confirmation. The seller must explicitly reload/review the current project. Missing sources and incompatible model versions produce unavailable states; they never fall back to the current release.

## Public fictional example

Buyer: `product-room/?followUpDemo=crank-review-v1#explore`

Seller: `studio/?followUpDemo=crank-review-v1`

The allowlisted example is generated from bundled public assets with fictional contact and project data. Its dedicated storage key is `annora.follow-up.demo.crank-review-v1`; opening it does not read, overwrite or seed ordinary customer projects. Subsequent visits retain the example's own progress and additional follow-up versions. An unknown or conflicting example parameter fails closed.

The public example link can open in a fresh browser because its prepared data ships with the application. A local follow-up link contains only record identities and requires those records in the same browser; it is not a private sharing service. The two behaviors must remain visibly distinct.

To export the prepared fictional package for review, run `node scripts/export-follow-up-example.mjs /absolute/path/crank-review-v1.json`. It refuses an existing output file and accepts no customer data. This JSON is an audit/handoff artifact; it does not upload or publish a browser-local project. Deploying the repository publishes the allowlisted example route with its bundled assets. A new public example requires a reviewed code/package change and normal deployment.

Change the fixture identifier when changing its bundled project or asset versions. Existing fixture stores are validated against the original immutable example; they are never silently overwritten with a changed package under the same identifier.

## Adapter contract

The existing project repository exposes the optional `supportsFollowUps` capability and these async methods:

| Method | Purpose |
| --- | --- |
| `getFollowUpDraft(projectId)` | Read the saved draft or create an unsaved identity. |
| `saveFollowUpDraft(draft)` | Persist incomplete edits with optimistic revision checks. |
| `reviewFollowUp(projectId)` | Produce a snapshot/token from the saved draft and exact current project. |
| `publishFollowUp(review, {confirmed: true})` | Idempotently create the immutable local release after explicit confirmation. |
| `listFollowUps(projectId)` / `getFollowUp(id)` | Read immutable versions by exact identity. |
| `getFollowUpProgress(id)` | Read a version's local position without writing. |
| `saveFollowUpProgress(id, progress)` | Save step ID and paused/exploring/complete mode independently. |

`follow-up-domain.js` owns normalization, source eligibility, review and live target availability. `follow-up-repository.js` adds operations to the existing project store. No second commercial state machine or project database is introduced.

The buyer player calls the existing story controller and JSON Explorer interface. Camera transitions and animation time remain owned by Explorer. No second render loop, model runtime or automatic acceptance action is added. Preview uses the same player with inert business actions.

Future network adapters must enforce tenant/project authorization server-side, immutable source snapshots, optimistic concurrency, idempotent confirmation and exact quote/question targets. A client-generated review token is a consistency guard, not an authorization credential or signature.

## Verification and limits

Release evidence belongs in `docs/delivery/` and `work/product-expansion/W10/`; this contract alone is not evidence of a live deployment. The acceptance scope is F3-01–06 in `product-expansion/evaluation.md`, including version A/B preservation, draft/save failures, stale review, public versus local availability, exact target reopening and desktop/mobile takeover/resume.

New product/model import, unconfirmed inquiry resumption, multi-question clarification queues, real delivery, production accounts and analytics are outside W10. The existing Explorer and inquiry/quotation workflow remain the underlying experience.
