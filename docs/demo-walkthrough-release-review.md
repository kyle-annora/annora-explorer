# Walkthrough release verification

November 1, 2026. Scope: the crank conversation across the existing Explorer,
Product Room and Studio. The [walkthrough guide](demo-walkthrough.md) describes
the customer presentation and implementation boundaries.

## Automated checks

`npm run verify` passed: project validation, 404 tests, and production build.
403 tests passed, zero failed, and one conditional unavailable-model test was
skipped because the configured deployment includes the crank model. New tests
cover buyer/seller route identities, demonstration namespace isolation, safe
restart and presentation guidance derived from recorded state.

The Explorer runtime and model-package directories have no changes in this release.

## Browser rehearsal

The compiled production build was served under `/annora-explorer/`, matching the
GitHub Pages repository subpath. The full journey passed at desktop 1440 pixels
and mobile 390 pixels through the actual controls:

1. A short mechanism cycle and Connecting rod selection.
2. Sample inquiry details, review, then explicit confirmation.
3. Same-tab seller handoff, draft save, Back to editor, review and issue v1.
4. Reviewed buyer request changing 20 assemblies to 30 and requested timing.
5. Seller topic responses and reviewed v2, preserving v1 and the original inquiry.
6. Buyer historical-version refresh, changes-first comparison and reviewed
   engineering-review request, followed by seller acknowledgment.
7. Public-entry resume into the same completed case.

The scripts verified one project, one session and one browser tab. A separate
ordinary customer store and an independently authored ordinary Studio product
release remained byte-identical. No page errors or horizontal overflow appeared
in these paths.

Focused checks also passed at 320 and 390 pixels: mobile comparison toggles,
reachable return controls, unsaved input guards, role-aware 3D return, historical
quotation selection, and editor/review reload. An issued draft's old review URL
returns to the project instead of opening an unintended new quotation.

The Product Room header was additionally checked at 14 widths between 320 and
1440 pixels. Its two-row navigation now begins at the tablet breakpoint, keeping
the inquiry control inside the viewport. Guide-action focusing was checked on
the historical-version control and each request/reply review and confirmation
control; it ignores the shared button's hidden pending label.

## Recovery and isolation

- Guide restart creates an empty new sample namespace and preserves the completed
  sample as well as ordinary project and product stores.
- Reopening the entry resumes the new sample without submitting anything.
- Malformed walkthrough query values show recovery in both hosts; they never
  open the ordinary customer repository.
- Unchanged window focus does not raise a stale-project warning.
- Draft saves do not become buyer-visible issued quotations. All final actions
  retain their review step.

## Screenshots

- [Product understanding](evidence/walkthrough-release/product.png)
- [Quotation review](evidence/walkthrough-release/quotation-review.png)
- [Mobile changes and next action](evidence/walkthrough-release/mobile-comparison.png)
- [The confirmed next step](evidence/walkthrough-release/complete.png)

## Publication check

The [public entry](https://kyle-annora.github.io/annora-explorer/walkthrough/)
passed the complete desktop and 390 pixel journey after deployment of `5324e36`.
The online checks included the guide's historical-version focus target, the
synchronized completion message, and all recovery/isolation checks above.
Walkthrough, Product Room and Studio returned HTTP 200 with the same production
asset references as the verified local build.

A focused follow-up also checks optional Studio authoring within a demonstration:
an edited title appears in its isolated draft preview and explicit release;
preview inquiries remain disposable; the main three-chapter Room stays bundled;
ordinary product and customer stores remain unchanged. The embedded preview has
its own controls rather than a duplicate presentation strip.

## Limits

This is a static, browser-local demonstration. It adds no backend, accounts,
cross-device synchronization or real message delivery. Viewport emulation and
desktop Chromium checks do not establish physical-phone, screen-reader or
lower-end GPU performance. The existing Explorer remains unchanged.
