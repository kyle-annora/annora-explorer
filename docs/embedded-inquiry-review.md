# Embedded inquiry · review record

## Candidate

Review the [crank Explorer](https://kyle-annora.github.io/annora-explorer/?model=kinetic-01)
or its [guided demo](https://kyle-annora.github.io/annora-explorer/?model=kinetic-01&presentation=1).

Select a component and choose **Ask about this component**, or choose
**Discuss this application** in a chapter. The header remains available. All
three entries open the same in-context inquiry.

## Acceptance results

Validated on November 5, 2026 using Chrome desktop and touch/viewport emulation.

| Area | Evidence/result |
| --- | --- |
| Repository verification | 734 tests: 733 passed, 0 failed, 1 existing skip; assets validated; production build passed |
| Component quotation | Inline entry, draft save/resume, explicit scope, editable review and confirmation passed |
| Application consultation | Unknown quantity remains blank; seller cannot issue a quotation without an explicit valid quantity |
| Same draft across entries | Minimize, close, reload, header and component entries retain one draft ID and pinned reference |
| Reference update | Only explicit Use current view changes the reference; new component clears the old part scope |
| Buyer/seller history | Confirmed inquiry → seller reviewed quote v1/v2 → buyer comparison passed; inquiry and issued v1 unchanged |
| Mobile | 320×740, 390×844 and 844×390: no horizontal overflow, actions reachable, one canvas, reference view and project handoff passed |
| Appearance | Light and dark panel; measured dark primary contrast 15.28:1 |
| Recovery | Injected save failure retains input; Retry saves. Concurrent tab update requires explicit replacement of local edits |
| Keyboard | Escape preserves paused chapter/progress; focus returns to the invoking component/chapter/header action |
| Deployment path | Buyer/seller journeys passed against compiled `/annora-explorer/` subpath |

The existing skip is the unavailable-prepared-model Studio case. The build still
reports the existing large catalog bundle warning. This work adds no renderer or
animation clock; inquiry UI loads when first opened. Ordinary physical computers,
physical phone keyboard behavior and first-time customer comprehension have not
been measured by these browser checks.

## Evidence and release boundary

Local evidence, screenshots and reusable browser runners are under
`work/embedded-inquiry-review/`. Initial failures remain preserved alongside their
retests, including whitespace save status, capture retry status and focus return.
The release receipt is `work/embedded-inquiry-review/release.json`; it records the
actual deployed source revision, Actions run, target asset identity and live
checks. Publication is claimed only after that receipt is written from the target.

This is the first crank pilot. Other models and legacy request routes remain
available with their existing behavior. Drawing-region entry and arbitrary
external-viewer adapters remain subsequent work. All requests, messages and
quotations are fictional browser-local records; no backend or real delivery was
added.
