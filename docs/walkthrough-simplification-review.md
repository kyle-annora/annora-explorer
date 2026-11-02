# Compact walkthrough review

Status: local acceptance passed on November 1, 2026. Hosted verification follows deployment.

## Scope and reference lock

Refine the existing three-chapter walkthrough with the same content-first,
on-demand controls approved for Studio and Product Room. Preserve the current
charcoal guide, neutral workspace, Ember action, existing Explorer, local sample
namespace, business states and explicit review handlers.

| Decision | Evidence | Boundary |
| --- | --- | --- |
| One compact guide above the content | User-approved Studio simplification; user request for one Continue demo | Current chapter, exact action and current role remain visible |
| One primary advance, separate review confirmation | Existing walkthrough guard contract; [ElevenLabs onboarding](https://refero.design/flows/8717) | Borrow clear progress and one advance; never auto-confirm |
| Secondary controls in one guide menu | Approved drawing/editor pattern; [Linear reference](https://refero.design/pages/1a493a2c-7d09-4143-b0dd-745781ea7991) | Chapter jumps, restart, detailed explanation and workspace navigation remain accessible |
| Current role plus an explicit handoff destination | User request and existing six buyer/seller handoffs | Never infer a switch from accent color alone |
| Restrained action emphasis | Refero Linear style `554b801c-3b31-4086-a7e5-ae613cdd618b` | Borrow density and action hierarchy only; retain Annora colors and typography |
| Hide the repeated app header during guided presentation | User request to reduce stacked navigation | Show workspace navigation from Guide; normal non-walkthrough pages unchanged |

The expanded help and chapter navigation do not participate in commercial state.
Native editing, Back, review and confirmation controls remain available. Continue
uses the existing guarded registered action; a review and its confirmation still
require separate deliberate activations.

## Delivered behavior

- A compact top strip shows the chapter, exact current step, current role and one
  primary advance button. Desktop height is 65 px including its border.
- `Continue demo` becomes `Confirm & continue` only at an existing review gate.
  The six confirmations remain separate from preparation and role handoff.
- `Next: buyer` or `Next: seller` appears before each of the six role changes.
- Guide contains chapter navigation, the longer explanation, sample disclosure,
  workspace navigation and restart. Complete workspace navigation can be shown
  on demand; ordinary pages outside the walkthrough retain their headers.
- The menu closes on Escape, outside pointer input or an advance. Closing the
  workspace navigation restores keyboard focus to Guide. Recovered loading
  errors clear without suppressing action errors.

## Acceptance

| Check | Result |
| --- | --- |
| One complete fresh sample | Passed: 3D motion and connecting rod → inquiry → seller quotation v1 → buyer change → seller v2 → buyer next-step request → seller acknowledgement → buyer conversation with Demo complete |
| Explicit review gates | All six observed: inquiry, v1, change request, v2, next-step request and seller response |
| Version history | v1 retained 20 units / $3,950; v2 showed 30 units / $5,500; requested 5 weeks remained distinct from proposed 6–8 weeks |
| Return to edit | Inquiry review returned to populated requirements; Continue reopened review without confirming |
| Repeated input | Double-click on preparation stopped at review; no inquiry was submitted by the second click |
| Role handoff | Buyer → seller via Enter restored focus to Continue; all six destinations visibly named |
| Secondary navigation | Show/hide workspace navigation, Escape, chapter 1 revisit and return to the completed project passed |
| Desktop and mobile | Desktop 3D first screen and compact bar checked; inquiry review through completion rehearsed at 390 px; 320 px role-handoff checked; no horizontal page overflow; primary target remained 44 px high |
| Mobile comparison | v2 review displayed changed fields as stacked comparisons and retained Back to editing |
| Production subpath | Built application loaded from /annora-explorer/ with the model, compact guide and operating cycle |
| Regression checks | npm run verify passed: 571 tests, 570 passed, 1 existing skip, 0 failures; package checks and production build passed |
| Design detector | No findings for the three walkthrough source files |
| Browser console | No application errors observed; unrelated browser-extension errors excluded |

The walkthrough sample used isolated project `PRJ-DEMO-2149A991`. No production
data, APIs, Explorer rendering, model packages, drawing snapshots or existing
project records were changed. This pass adds no dependencies or animation loops.

## Review entry

- [Walkthrough](https://kyle-annora.github.io/annora-explorer/walkthrough/)
- [Start a fresh isolated sample](https://kyle-annora.github.io/annora-explorer/walkthrough/?new=1)

Use the top Continue button throughout. Inspect the content at every review and
press Confirm & continue deliberately. The final screen is the buyer's shared
conversation, showing both quotation versions and the agreed engineering review.
