# One-button walkthrough review

November 1, 2026. Follow-up to the three-chapter customer walkthrough.

## Presenter experience

Open [a fresh guided sample](https://kyle-annora.github.io/annora-explorer/walkthrough/?new=1)
and keep using **Continue demo** in the top strip. At each full review, it becomes
**Confirm & continue**. The same fictional project carries the Connecting rod
reference through inquiry, quotation v1, requested changes, quotation v2 and an
agreed engineering discussion. The normal entry resumes the existing sample.

The standard path uses 20 presses on that one control, including six explicit
confirmations and six same-tab role handoffs. No manual sample entry or search
for page controls is required. The presenter can pause on any document or use the
normal controls to edit it. Saved and manually entered terms are preserved.

The end is **The next step is agreed**: the buyer can see the seller's
acknowledgment alongside both quotation versions. This is not an order, contract
acceptance or payment.

## Boundaries

- Host views supply their current action through an in-memory registry. The
  guide invokes the same review and confirmation handlers as native controls.
  It does not click controls by text or write directly to the project store.
- Preparing a review and confirming it require separate activations. Busy,
  repeat-click and retired-action guards prevent accidental progression.
- Route and host changes immediately retire the previous action. Returning to
  the editor cannot execute a cached confirmation from the preceding review.
- Keyboard focus returns to the fixed control after an advance, including role
  changes. Existing form and Explorer controls remain available.
- The first action uses the public Explorer controller for one short cycle and
  rod selection. Reduced motion shows a paused pose. Renderer, model packages,
  player controls and animation clock are unchanged.
- Walkthrough records stay in their existing isolated local namespace. There is
  no backend, real customer data, account or external delivery.

## Verification

`npm run verify`: 409 tests, 408 passed, zero failed and one conditional skip
because the prepared crank model is available. Project checks and production
build passed.

The compiled build was tested under `/annora-explorer/`, matching GitHub Pages.
Desktop 1440 × 1000 and mobile 390 × 844 completed the full path using only the
fixed button. Checks established:

- Six visible reviews preceded six separate final confirmations.
- A rapid repeat on review preparation did not submit the new review.
- One case, one session and one browser tab throughout all role handoffs.
- Original inquiry, product reference and v1 stayed unchanged after v2.
- v1 priced subtotal: $3,950; v2: $5,500. Final totals remain unconfirmed.
- Ordinary customer and Studio stores stayed byte-identical.
- Reload/resume, restart without deleting the old sample, malformed-link
  recovery and historical-version return to the current agreement worked.
- Fourteen widths from 320 to 1440 pixels had no horizontal overflow; the fixed
  action remained visible and at least 40 pixels high (44 on small screens).
- Browser Back into the inquiry editor could not execute a stale confirmation.
- Keyboard Enter/Space advances retained focus through nine actions and both
  role transitions; manually edited buyer fields survived guided review.
- No page errors occurred in the rehearsed paths.

Evidence: [desktop results](evidence/one-button-walkthrough/built-desktop-results.json),
[mobile results](evidence/one-button-walkthrough/built-mobile-results.json),
[responsive results](evidence/one-button-walkthrough/built-responsive-results.json),
[quotation review](evidence/one-button-walkthrough/quotation-review.png),
[mobile comparison](evidence/one-button-walkthrough/mobile-comparison.png), and
[agreed next step](evidence/one-button-walkthrough/complete.png).

These are Chromium browser and viewport checks on the development computer,
not physical-phone, screen-reader or lower-end GPU measurements.
