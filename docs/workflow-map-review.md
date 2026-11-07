# Visual workflow guide

Status: published and verified.

[Open the shareable workflow guide](https://kyle-annora.github.io/annora-explorer/workflows/).

Deployed application: `d759fad96d7baef4e6d1de6eba526c4faf198d73`. See the
[release receipt](evidence/workflow-map/release-receipt.json) for workflow, target
and browser verification. This documentation-only follow-up does not redeploy the app.

## Intended use

Patrick and Wesley can explain Annora through one project: understand a product,
request a quotation, then resolve a change and agree on the next step.

The standalone `workflows/` page places that three-chapter map first. Every step
names its actor; review and confirmation remain visible. Opening a step explains
its input and outcome. A direct v1-to-next-step path makes revisions optional.

Five supporting maps expand on demand: contextual inquiry, preference and scope,
drawing change, product preparation and existing-viewer integration. Each branch
includes its decision rules and a relevant existing example. A step or branch
can be shared through its URL fragment.

The header opens the independent-viewer walkthrough in another tab. This guide
contains no project mutations, authentication, renderer, models or API calls.
The existing demo retains its controls and navigation.

## Presentation

Start with the three chapter headings. Expand a step only when its ownership or
review boundary needs explaining. Use the relevant branch for a customer's
question, then open the live walkthrough to show the same commercial path.

The scope disclosure explains browser-local sample data and production-service
boundaries. Exact versions, a saved view and one project remain the main message.
The guide does not claim automatic engineering validation, delivered messages or
an order. The underlying source maps are in [user workflow maps](user-workflow-maps.md).

## Implementation boundary

- New entry: `workflows/index.html`.
- Isolated presentation module: `src/workflow-map/`.
- One additional Vite entry; no imports from the Explorer or commercial runtime.
- No localStorage/sessionStorage reads or writes. Disclosure state uses the URL.
- All copy, accessibility labels and documentation are English.
- Native disclosure semantics, keyboard focus, 44 px controls, responsive reading
  layouts and a print view with expanded explanations.

The established Annora neutral/Ember system remains authoritative. Research and
surface decisions are recorded in `workflows/DESIGN.md`.

## Verification

The review covers main and branch disclosures, direct fragments and Back/reload,
keyboard use, mobile/landscape, zoom, reduced motion, live links and project-store
preservation. Existing product source/asset hashes are compared with the previous
release. Public-target checks and source identity belong in the release receipt.

The existing build regenerates integration-kit 0.2.0 with release metadata and
packaged documentation. An archive hash change alone does not indicate a runtime
change. The prior 0.1.0 archive remains immutable.

Candidate verification: 100 browser checks passed, plus the existing mobile
commercial walkthrough (23 checkpoints and eight explicit confirmations). The
project verification passed 1,002 tests with one existing conditional skip.
Printing retains the demo scope and restores disclosure states afterward.
See [acceptance evidence](evidence/workflow-map/acceptance.json).

## Published verification

The live page passed all 100 browser checks. Its walkthrough entry passed nine
additional checks, opening a fresh independent-viewer session with one visible
Continue demo action and no business records created. Fourteen live captures
match the reviewed local captures exactly.

Public verification checked 64 artifacts. All 59 existing runtime, entry and
fixture artifacts compared against the previous published application are
byte-identical. The integration-kit 0.2.0 release records the new source revision;
its packaged source is verified separately. The 0.1.0 archive remains unchanged.

Mobile checks use Chromium viewport and touch emulation, not physical-device
performance measurements. The page adds no backend or customer data.
