# Shared workspace visual rollout

Status: compiled release acceptance and hosted commercial/drawing verification passed.

## Approved direction

This release applies the approved [independent design preview](design-preview.md)
to the production Explorer, Product Room and Studio. Pedestal remains the dominant
composition reference: a continuous neutral product canvas, compact shared header,
contextual floating panels and a stable main action. Existing Oxide-informed
assembly navigation and Atlas-informed linework retain their established roles.
The rendered model, source drawing and commercial record remain the content.

## Applied layout

- **Explorer:** compact white header, continuous neutral canvas, on-demand Parts
  tree, contextual information and a compact action dock. Camera and rendering
  preferences share the Display panel. Embedded viewers omit duplicate branding.
- **Product Room:** the same header, surface and control vocabulary; compact
  project and inquiry layouts; mobile product references open on demand. Review
  and confirmation remain explicit, with the main action in a stable bottom area.
- **Studio:** navigation, a persistent product model and the editing inspector
  share one workspace. Mobile starts with editing fields and loads 3D only when
  requested. Drawing views, source versions and publication actions keep their
  established responsibilities, with fewer competing panels.
- Shared presentation tokens live in `src/shared/workspace-tokens.css`. The
  production surfaces have scoped layout styles; saved records and renderer
  internals are not part of the visual layer.

The change concerns presentation and layout. It preserves selection versus entry,
engineering/linework/flat rendering, short operating actions, tours, confirmed
publication and the existing buyer/seller review gates. Mobile panels may change
their arrangement; the underlying action and its meaning remain the same.

## Preservation boundaries

- Existing product and project namespaces remain unchanged. The redesign does not
  migrate, clear or recreate saved customer records.
- A saved inquiry, issued quotation or discussion keeps its model, source drawing,
  mapping and overview versions. A later release cannot silently replace them.
- Source A to B adoption remains a separate, human-reviewed project action.
- Quotation drafts remain seller-only until review and explicit issue. Customer
  change requests and next-step requests retain confirmation.
- Browser-local demonstration data, fictional pricing and API boundaries remain
  as before. No backend, account, email or manufacturer submission is introduced.
- The existing controller, one scene and demand-rendered animation clock remain
  the integration boundary. Hosts do not access renderer internals.

## Acceptance paths

| Path | Required evidence |
| --- | --- |
| Explorer | Both assemblies; select, enter and return; all rendering styles; explode/reassemble; operation pause/replay/seek; tour and restoration; keyboard and touch controls |
| Crank commercial walkthrough | One project from product selection through reviewed inquiry, saved seller draft, issued v1, reviewed customer change, seller v2, historical comparison and confirmed next step |
| Existing records | A protected ordinary customer store and an independently authored Studio release remain byte-identical through the isolated walkthrough |
| Source drawing A to B | Import actual B PDF, manually confirm its source pairing and regions, publish, explicitly adopt B in the same project and issue v2; old quotation and discussion still reference A |
| Overview v1 to v2 | Publish an overview, create reviewed inquiry and quote, change order/title and publish v2; a new inquiry uses v2 while existing inquiry and quotation snapshots stay deep-equal |
| History | Historical inline preview, open drawing, reload, original PDF, buyer/seller return and explicit latest-quotation action |
| Mobile | 390 and 320 px; visible primary actions, contained scrolling, no horizontal overflow, readable version comparison, keyboard focus return |
| Performance | One model/context per active Explorer, no repeated asset load on simple UI changes, idle rendering stops, reduced-motion and hidden-tab behavior retained |
| Delivery | Repository checks/tests/build, exact compiled repository subpath, successful GitHub deployment and hosted route rehearsal |

## Baseline and verification method

The baseline is commit `8f72c133964108aebacebc59876f1cf367762967`, the release
containing the approved independent preview. Baseline captures cover Explorer,
Product Room, Studio and the SK08 drawing workspace at 1440, 390 and 320 px. All
twelve baseline pages opened without browser exceptions or horizontal overflow.

The baseline behavioral rehearsal also passed the full crank commercial path,
source A to B adoption, and overview v1 to v2 publication for SK08 at 390 px and
the connecting rod at 320 px. A separate 390 px rehearsal used only the visible
Continue demo / Confirm & continue control through 21 states, ending with one
project, two quotations, one change request and one confirmed next step.

Behavioral checks reuse the existing release acceptance harnesses. Their selectors
are updated only when an existing visible label or arrangement changed; they do
not bypass UI confirmation or construct a new commercial workflow. In particular,
the older walkthrough harness predates the current single Continue demo control.

Temporary evidence and scripts are kept under `/tmp/annora-production-rollout/`.
Additional established harnesses cover the SK08/connecting-rod overview editor
and the full drawing revision sequence. Tests use isolated browser contexts and
fictional inputs, never a reviewer's existing browser profile.

## Results

The updated application was served at the exact `/annora-explorer/` repository
subpath. Repository verification passed: 549 tests, 548 passed, one existing
conditional skip, no failures, followed by a successful production build.

| Compiled acceptance check | Result |
| --- | --- |
| Full crank walkthrough, desktop 1440 px and mobile 390 px | Passed: selection, inquiry review/confirmation, saved quotation draft, browser Back from review, issued v1, buyer change, seller v2, historical reload, reviewed next-step request and seller acknowledgment |
| Ordinary records during isolated walkthrough | Existing customer store and separately authored Studio product release stayed byte-identical |
| Original commercial records | Original inquiry, product context and issued quotation v1 remained unchanged after v2 and completion |
| 320 px one-button walkthrough | All 21 states completed through the actual Continue demo / Confirm & continue control; one project, two quotations, one change request and one confirmed next step |
| Same-project source A to B | Actual B PDF imported, source/region associations manually confirmed, reviewed release published, adoption separately reviewed and confirmed, v2 issued against B |
| Historical A after B adoption | Original inquiry and entire issued quotation v1 stayed deep-equal; the earlier customer change and seller response retained A; exact historical PDF reopened and reloaded |
| SK08 overview at 390 px and connecting rod at 320 px | v1 publication, reviewed inquiry and quotation, v2 publication and new inquiry/quotation all passed; earlier records and releases retained their exact overview |
| Drawing interaction/history | Configured initial view, original PDF, 1×/2×/4× zoom, inline historical preview, open drawing and reload passed |
| Mobile comparison at 390 and 320 px | Five changed fields and thirteen total fields rendered without horizontal overflow; include unchanged, changed-only and hide/show controls worked; saved project bytes were unchanged |
| Mobile source disclosure | Source & version expands to expose Product, Source version and Import new PDF; closing it retains access to Review release and does not alter existing project data |
| Browser failures | No page exceptions in the completed journeys; no failed asset responses in the overview journeys |

Compiled evidence includes:

- `/tmp/annora-walkthrough-release/evidence/rollout-built-desktop-results.json`
- `/tmp/annora-walkthrough-release/evidence/rollout-built-mobile-results.json`
- `/tmp/annora-production-rollout/built-one-button-320.json`
- `/tmp/annora-production-rollout/built-revision.log`
- `/tmp/annora-production-rollout/overview-built/results.json`
- `/tmp/annora-production-rollout/mobile-details-results.json`

## Explorer rendering and performance checks

The compiled Product Room and Studio were exercised in Chrome at 1440 × 950
with 4× CPU throttling and at 390 × 844 with touch and reduced motion. Each
active Explorer retained one canvas and one WebGL context while switching
Engineering, Linework and Flat rendering and exercising play, pause, replay and
40% seeking. Draw and clear counters remained unchanged across settled one-second
and 800 ms idle intervals. Touch dragging changed the model view on both mobile
routes. Embedded identity and model selectors remained hidden; their existing
controls remained available. Studio loads its mobile 3D preview only after the
seller opens Product model.

A focused follow-up verified the Studio visibility correction on the rebuilt
application: an active operation pauses when the host receives a hidden-document
visibility event, its progress remains fixed, and returning does not autoplay.
Product Room passed the same pause check. These checks synthesize the visibility
event; they do not certify operating-system tab suspension behavior. The change
uses the existing host pause boundary and does not change the renderer.

Evidence: `/tmp/explorer-production-built-performance.json` records the four
initial route passes; `/tmp/studio-hide-pause-final.json` records the Studio
follow-up after the visibility fix. Screenshots are
`/tmp/production-built-{room,studio}-{cpu4,mobile}.png`. Browser viewport
emulation and CPU throttling are regression checks, not physical-phone or
low-end GPU performance measurements.

## Hosted verification

The production rollout was tested on GitHub Pages at commit
`f9f1526135df325e7a7db938feedf5bb54addd56`, following successful deployment
[41342813064](https://github.com/kyle-annora/annora-explorer/actions/runs/41342813064).
The public [walkthrough](https://kyle-annora.github.io/annora-explorer/walkthrough/)
and the complete source drawing revision workflow both passed in new browser
contexts.

- At 320 × 740 px, the actual Continue demo / Confirm & continue control completed
  all 21 states. Review gates remained explicit; the completed case contained one
  project, two quotations, one customer change and one confirmed next step with
  a seller acknowledgment. The control remained reachable and the page had no
  horizontal overflow.
- The source workflow imported the actual demonstration B PDF, manually confirmed
  the source pairing and regions, reviewed and published the release, explicitly
  adopted B in the same project, and issued quotation v2 against B. The original
  inquiry, product context and entire issued v1 remained unchanged. Earlier
  discussions retained A, and the exact historical PDFs opened and reloaded.
- Both hosted journeys completed without page exceptions. A separate hosted
  presentation check confirmed the deployed Product Room's white 64 px header,
  neutral `#f3f3f1` canvas and new compiled stylesheet, with no desktop overflow.

Hosted evidence:

- `/tmp/annora-production-rollout/live-one-button-320.json`
- `/tmp/annora-production-rollout/live-one-button-320.png`
- `/tmp/annora-production-rollout/live-revision.log`
- `/tmp/annora-production-rollout/live-css.json`
- `/tmp/annora-production-rollout/live-room-css.png`

Browser viewport emulation and CPU throttling do not establish physical-phone or
low-end GPU performance.
