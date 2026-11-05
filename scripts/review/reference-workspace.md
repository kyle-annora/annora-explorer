# Reference workspace browser review

Run from the repository root against the Hexapod reference workspace. This
optional review tool uses an externally installed Playwright and Google Chrome;
it adds no application or build dependency. Set `PLAYWRIGHT_MODULE` to a module
specifier or absolute module path when Playwright is installed outside the repo.

For a compiled build served under the deployment subpath:

```sh
DEV=0 BASE_URL=http://127.0.0.1:8134/annora-explorer/ LABEL=compiled \
  node scripts/review/reference-workspace.mjs
```

For the Vite development server:

```sh
BASE_URL=http://127.0.0.1:8095/ LABEL=dev \
  node scripts/review/reference-workspace.mjs
```

Configuration:

- `BASE_URL`: Explorer HTTP(S) URL, including its trailing slash. Defaults to
  `http://127.0.0.1:8095/`. A first positional argument or `ORIGIN` is also accepted.
- `OUTPUT_DIR`: evidence directory, default `work/reference-workspace-review`.
  A second positional argument is also accepted.
- `LABEL`: report and screenshot prefix, default `results`. Use a new label to
  preserve prior evidence.
- `DEV`: defaults to development instrumentation; `0` selects compiled assets.
- `ONLY`: optional case-name substring for a focused rerun.
- `PLAYWRIGHT_MODULE`: defaults to importing `playwright`.

The twelve cases cover 3D / Drawings / Compare roundtrips, selected assembly
and camera restoration in both modes, custom Demo camera retention when the
first view change happens in Explore, chapter changes in Drawings, paused
65% progress, mobile Compare fallback, and Escape popup priority. Every case
checks document identity, browser errors, exactly one WebGL context and no
context loss. Failures produce a nonzero exit code, a failed-state record and
a screenshot; a filter matching no cases also fails.

The JSON report is `<LABEL>.json`; screenshots use the same prefix. Read the
individual `pass`, `error`, `steps` and `final` fields rather than inferring
success from a screenshot or the number of files produced.

Camera observation is read-only and limited to the review browser session.
Development requests expose existing app camera getters. Compiled requests
expose the existing stage `captureView` function by instrumenting its returned
property in the fetched JavaScript response; files on disk and deployed assets
are unchanged. Free cameras use the existing scene DOM snapshot. If bundling
changes the capture-property shape, update the test hook before treating a
missing camera measurement as a product regression. The WebGL counter wraps
`getContext` and counts unique returned contexts without creating extra ones.

Use stable source while running: a Vite reload intentionally fails the document
identity check. Chrome viewport/touch emulation covers behavior and layout; it
does not establish physical phone compatibility, low-end GPU performance, drawing
accuracy, or broader Product Room/Studio and legacy-model regression coverage.
