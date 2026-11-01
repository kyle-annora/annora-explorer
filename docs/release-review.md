# Template delivery review

Review date: October 31, 2026.

## Scope

Standalone, public-template packaging of the approved Explorer. Project branding,
model registration, feature policy, generic model preparation, English handoff
material and an agent skill are added. The original customer repository is not
part of this repository or its history.

## Completed local evidence

- Full template verification: 247 tests pass; configured packages validate and
  production build succeeds. Dependency audit reports zero known vulnerabilities
  at review time. The bundled skill passes its structural validator.
- The original stylesheet, appearance system, line renderer, tour UI/player,
  motion and source-operation sampler remain byte-identical to the approved
  runtime. Integration changes affect project configuration and controller policy.
- Independent agent onboarding from English instructions creates a separately
  branded, one-model project without editing the shared runtime.
- Third model: original MIT bench vise, 58 meshes, six groups, 12,174 triangles;
  848,488-byte GLB / 141,781-byte gzip. Generic import preserves source bytes and
  deterministically generates line data. A 5.5-second authored clip and 60-second
  English tour exercise the same scene and player.
- Independent browser review covers engineering, pure linework, flat Ember,
  component focus, explosion, operation, restoration, the complete tour and a
  nested deployment path. 390×844 viewport reviewed; no browser warnings/errors.
- Tests cover invalid packages, path/symlink containment, unsafe branding URLs,
  exact compression, capability narrowing, stale command cancellation and transport
  origin/session boundaries. No private customer references were found in source,
  generated configuration or the embedded GLB metadata.
- Full runtime/model license notices are included in the deployed build.

## Publication evidence

- [Source template](https://github.com/kyle-annora/annora-explorer) is public and
  marked as a GitHub template. [Live Explorer](https://kyle-annora.github.io/annora-explorer/)
  serves the configured Apollo and crank-slider packages.
- Application and configuration baseline: `889ded549867540fa45abe95e631acd0b1ea0cb4`.
  [Pages run 41256175682](https://github.com/kyle-annora/annora-explorer/actions/runs/41256175682)
  passed all 247 tests, validated the packages, built and deployed the site on Node 22.
- The [independent bench-vise project](https://github.com/kyle-annora/annora-explorer-bench-vise)
  was created with GitHub's template-generation API, then cloned into a new
  checkout. GitHub reports `kyle-annora/annora-explorer` as its template source.
  Its initial generated commit is `dd22cdf3efa135efee1216f964675f9376b1bc0a`.
- The documented importer, project configuration and English instructions produced
  the independently branded [Workshop preview](https://kyle-annora.github.io/annora-explorer-bench-vise/).
  Application baseline `37ac8c8d435299f8e4199fae44fc1cb1696b0042` passed 247 tests and
  deployed in [Pages run 41256328703](https://github.com/kyle-annora/annora-explorer-bench-vise/actions/runs/41256328703).
  The build includes only the configured vise package. No shared runtime file was
  edited; the runtime tree remains `d6d5d51cec414e58e527df8dd6c59bc912e06f2f`.
- The live template's root page, embed page, license notice and all 27 deployed
  assets return HTTP 200. Published HTML and license notices match the reviewed
  build. Source and artifact scans found no private customer content.
- Live template browser review confirms component selection and hierarchical
  focus, linework and flat highlights, explosion/reassembly, the crank operating
  cycle, switching to Apollo and uninterrupted completion of both 60-second
  tours. The review recorded no browser warnings or errors.
- Live bench-vise review confirms all three rendering styles, focus/isolation,
  explosion/restore, authored operation, full tour completion and manual takeover.
  Portrait 390×844 and landscape 844×390 layouts have no horizontal overflow.
  A host on a separate localhost origin controls the deployed Pages iframe through
  the JSON interface: capability discovery, selection/focus, motion/tour controls,
  bookmark capture/restore, revision rejection and disconnect/remount all pass.

The independent project's [release review](https://github.com/kyle-annora/annora-explorer-bench-vise/blob/main/docs/release-review.md)
and [onboarding evidence](https://github.com/kyle-annora/annora-explorer-bench-vise/blob/main/docs/onboarding-evidence.json)
record the source hash, configuration, browser checks and publication results.
Later documentation-only commits do not change these reviewed application baselines.

## Limits

This release accepts prepared rigid, untextured GLB input; it does not convert
arbitrary CAD, infer operating mechanisms or generate a reliable tour from
geometry alone. The public interface is a versioned iframe/JSON boundary, not a
same-document SDK, npm package, backend or MCP service.

The local review used desktop Chrome and viewport emulation. Physical-phone and
ordinary-laptop GPU/thermal qualification remains open. Apollo is a larger
optional sample; its transfer and frame-rate costs should be measured on target
hardware before making a production performance promise.


## Short-action integration

See [short-action release evidence](short-actions.md) for the integrated 2.5-second
crank and Apollo actions, mobile checks and updated API behavior. Earlier evidence
above describes the previous continuous-tour release.
