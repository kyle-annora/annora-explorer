# Exploration-to-quote delivery verification

Date: 2026-11-05 (America/Los_Angeles)

## Scope

The crank's standalone Demo and Explore now hand a versioned inspection to a
reviewed Product Room inquiry. Studio can reopen it and carry it through issued
quotation versions. Commercial scope is an explicit buyer choice.

This record covers browser-local fictional data only. No real submission or
backend integration was performed.

## Evidence

Local detailed evidence is retained under `work/exploration-quote-review/` and is
not part of the public build. The checked-in source tests are reproducible with
`npm run verify`.

| Suite | Evidence | Result |
| --- | --- | --- |
| Inspection API | `api-browser/results.json`, `compiled/api/results.json` | Free view, paused tour, exact source/camera, mobile and reduced-motion restore; invalid references fail without mutation; real nonblank raster preview |
| Buyer UI | `ui/results.json` | 1440px, 390px and 320px; scope survives edit/review; one compact preview; no workspace WebGL renderer |
| Reference adoption | `ui/adoption-results.json` | A newer incoming view cannot overwrite the pending draft; explicit adoption resets component scope for a changed component |
| Immediate quote entry | `ui/immediate-cta-results.json` | Ready-state click succeeds at 320px, 390px and 1440px |
| Return navigation | `room-navigation/results.json` | Six live cases plus 37 focused tests; saved draft survives Overview/Specs and model inspection |
| Existing compiled Explorer | `compiled/summary.json` | 12 state/navigation cases and nine UI cases passed; eight measured camera round trips unchanged; one WebGL context, no losses |
| Inquiry through quotation v2 | `v2-ui/results.json` | Actual UI journey through inquiry, v1, buyer revision, seller v2 and buyer comparison; exact inspection retained, original inquiry and v1 unchanged; mobile comparison has no overflow |
| Final compiled commercial journey | `compiled/journey/results.json` | Complete v1 to v2 flow passed again under `/annora-explorer/`, with one reference disclosure and unchanged historical records |
| Compiled missing-reference recovery | `room-navigation/compiled-negative-paths.json` | Five checks passed: fresh capture after a failed Explorer restore; invalid Room handoff cannot expose a contextless confirmation |

Full verification completed with **705 passing tests, zero failures, and one
pre-existing skip** (`Studio reports an unavailable prepared model without
initializing a draft`), followed by a successful production build.

Compiled regression was run from the actual `/annora-explorer/` repository subpath
with plain browser checks. The camera measurement suite exposes an existing
capture function solely for observation; the UI and inspection API checks use
unmodified compiled responses.

## Issues found and resolved

- Immediate tour restore could reuse a pose key and then pause before its
  transforms had settled. Restore now resamples the exact source pose.
- Generic Explore navigation could return to a default view. It now follows the
  actual workspace reference after its save gate, including a blank draft.
- Failed handoff creation could leave controls disabled. Failed navigation now
  releases that gate and presents an explicit error.
- Starting a new inquiry from a saved project's view could retain the old
  project route. Temporary draft attribution and durable project routes are now
  kept separate.
- Buyer review repeated the same reference disclosure. The reviewed summary now
  contains the full reference once.

## Qualification limits

Headless Chrome on the development Mac was used for desktop/mobile viewport and
reduced-motion checks. These are functional and layout checks, not physical-phone
or low-end hardware performance certification. No new renderer, CAD kernel or
continuous capture loop was added. The existing large-bundle build warning
remains and is not represented as resolved by this change.

## Publication target

Review entry: [Crank demonstration](https://kyle-annora.github.io/annora-explorer/?model=kinetic-01&presentation=1).
Source: [annora-explorer](https://github.com/kyle-annora/annora-explorer).

This document records candidate verification. The completed deployment run,
source revision and subsequent public-site smoke results are captured separately
in `work/exploration-quote-review/release.json` at delivery; publication is only
claimed after that target check.
