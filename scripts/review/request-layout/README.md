# Request and confirmation layout qualification

Run against the built site under its deployment subpath. These scripts use a new
headless Chrome context and fictional records. They never open a user profile.
Only one browser qualification process should run at a time.

```sh
BASE_URL=http://127.0.0.1:8190/annora-explorer/ \
OUT=work/request-layout/w60 LAYOUT_REVIEW=request \
node scripts/review/integration-walkthrough/browser-journey.mjs

BASE_URL=http://127.0.0.1:8190/annora-explorer/ \
OUT=work/request-layout/manual \
node scripts/review/request-layout/manual.mjs

BASE_URL=http://127.0.0.1:8190/annora-explorer/ \
OUT=work/request-layout/navigation \
node scripts/review/integration-walkthrough/navigation-branches.mjs
```

Set `PLAYWRIGHT_MODULE` to an installed Playwright module when it is not locally
resolvable. `PROFILES` selects desktop, mobile, compact and landscape; the
navigation suite supports desktop and compact.

The existing end-to-end journey remains the authority for eight separate
business confirmations, exact external-viewer references, original inquiry and
v1 preservation, storage recovery, reload and isolated namespaces. The opt-in
layout checks add one project context, one task, one guided primary, no duplicate
stepper and keyboard-operable supporting references. No business guard is
bypassed by the layout checks.

The manual suite covers native inquiry validation, editing and explicit review;
buyer revision and next-step requests; seller reply and acknowledgement from an
older selected quotation; and the ordinary floating inquiry without a guide.
Native fixtures are created through the repository API. External records are
never transplanted into a native store. All primary actions are checked for real
pointer reachability and 44 px targets, including narrow layouts.

The full-page inquiry is exercised through the SK08 drawing host. Product Room's
inquiry route correctly uses the shared floating surface. Set `NATIVE_ONLY=1`
for a bounded recheck of validation, sample replacement, review, edit and
confirmation; it also verifies the exact drawing reference remains unchanged.

Results and screenshots go to `OUT`. Chromium viewport and touch emulation do
not establish physical-phone or ordinary-computer performance.
