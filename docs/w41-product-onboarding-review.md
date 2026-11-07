# W41 — New product onboarding

Published and verified on November 6, 2026 (Pacific). Application commit `1b116ea455c4d52218e4b113ea1a707b017220e3`; Pages workflow `42343263858`.

W41 turns prepared-file intake into a Studio workflow and qualifies it with a
new NEMA 17 motor bracket. The seller checks source evidence, confirms drawing
links, reviews a saved preview and exports one package. The deployment owner
applies that package through a generic command. Explorer and existing customer
projects keep their original behavior and identities.

Publication status and the verified application commit are recorded in
[`evidence/product-onboarding/release-receipt.json`](evidence/product-onboarding/release-receipt.json).
The browser export and local application receipt are not publication evidence.

## Review path

1. Open [Studio product setup](https://kyle-annora.github.io/annora-explorer/studio/#onboard).
   Inspect the original PDF/STEP, acknowledge source/license and units, then
   continue. Confirm the aperture, mounting-hole pattern and base-slot links.
2. Save and preview the exact source. Switch to 3D if useful, then review and
   explicitly confirm. Export the package. This rehearses preparation locally;
   it does not overwrite the already deployed example.
3. Open the [deployed motor-bracket Room](https://kyle-annora.github.io/annora-explorer/product-room/?model=nema17-bracket#explore).
   Start the story. Inspect the three technical details and their source PDF.
   Choose **Ask about this step**, review a fictional inquiry, and confirm it.
4. In that project, choose **View as seller**. Prepare and review a sample
   quotation before issuing it. The exact part, source PDF, mapping and overview
   remain attached to the inquiry and quotation.

## What is reusable

- A data recipe under `content/onboarding/<id>/candidate.json` identifies prepared
  files, source units, public names and supported sample commerce.
- Catalog discovery and a shared product descriptor create the same candidate
  for Studio, validation and the deployed Room. No new model-ID renderer branch.
- The review repository separates draft, saved preview, review and export.
  Editing or changing the source invalidates pending confirmation.
- `npm run apply:onboarding -- --file <reviewed-package.json>` validates actual
  bytes and exact versions before creating registration/release/receipt data.
  Duplicate products, stale packets and unsafe destinations fail before mutation.
- New drawing links target actual geometry-backed parts. Explorer root and group
  nodes remain navigable but cannot masquerade as drawing-linked geometry.
- The published technical story is rebuilt from confirmed mappings and pinned to
  its exact overview revision. Original source files are preserved.

The [operator workflow](product-onboarding.md) gives preparation, seller review,
deployment and recovery steps. The [API contract](onboarding-api.md) documents
the boundary for a future service. No backend, accounts or real transmission are
implemented.

## New source and preparation cost

The NEMA 17 bracket is one authentic rigid solid from build123d, with a paired
STEP and PDF pinned to the same published example. Source redistribution is
Apache-2.0. It has 3,396 triangles and approximately 30 KiB compressed model
geometry. It has no operating clip or separately modeled internal components;
the UI does not invent them.

Five manual preparation activities remained: source/license qualification,
offline CAD conversion, model definition/import, three proposed source-region
associations, and two technical compositions plus a source-derived poster. The
two compositions support three feature-specific reading views. Active operator
minutes were not instrumented, so this delivery makes no time-saving claim.

An independent operator followed the English instructions with the actual
browser export in an isolated checkout. Successful application changed four
intended data files: the drawing mapping and new registration, release and
receipt. No shared JavaScript edits or existing product changes were needed.
See [operator evidence](evidence/product-onboarding/independent-operator.json)
and [independent source audit](evidence/product-onboarding/source-audit.json).

## Acceptance and preservation

| Gate | Evidence |
| --- | --- |
| Source, units, original files and package identity | Original STEP/PDF hashes, composite model revision, geometry bounds and eight dimensions independently checked |
| Explicit association and review | Unconfirmed or non-geometry links block preview; changing a binding requires confirmation; stale title/style/source exports rejected |
| Atomic, bounded application | Duplicate, traversal, symlink and source-mutation rejection; injected write-failure rollback; four-file independent apply |
| Existing product isolation | Separate intake store; no original source overwrite; original crank/SK08 model and business data retained |
| Complete new-product journey | Technical detail → reviewed inquiry → reviewed quotation → product version 2 → original project and story still reopen |
| Mobile | 320/390 px source, drawing, model, review and export; no horizontal overflow, reachable controls, one on-demand model iframe |
| Publication | Successful Pages workflow plus exact live asset and browser checks in the release receipt |

Machine-readable results are in
[`evidence/product-onboarding/acceptance.json`](evidence/product-onboarding/acceptance.json).
Browser runners are under `scripts/review/product-onboarding/`; provide
`PLAYWRIGHT_MODULE` when Playwright is installed outside the checkout, and
`BASE_URL` for the compiled or public deployment.

## Practical limits

This version onboards prepared rigid geometry with one paired drawing package.
It does not convert arbitrary uploads in the browser or infer manufacturing
requirements. The automatic source drawing remains unreviewed reference material,
with missing general tolerance and incomplete source annotations disclosed.
Seller confirmation verifies an association, not manufacturing approval.

Poster and technical artwork are trusted repository inputs. A future service
must add authenticated operators, artifact identity and access checks; browser
fingerprints are not signatures. Phone viewport/touch emulation and a lightweight
model are not physical-device or ordinary-computer performance certification.
