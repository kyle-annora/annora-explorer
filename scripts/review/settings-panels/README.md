# Settings panel browser review

Run from the repository root. These optional review scripts use an externally
installed Playwright with Chrome; they add no runtime or build dependency.
Set `PLAYWRIGHT_MODULE` to its absolute `index.mjs` path if Playwright is not
resolvable locally. Install browser tooling in a separate tools directory if
needed. PNG comparison requires Python with Pillow.

Serve the baseline and candidate production builds at separate origins, both
under `/annora-explorer/`. Pass each base URL and evidence label explicitly:

```sh
node scripts/review/settings-panels/panel-browser-qa.mjs http://127.0.0.1:8175/annora-explorer/ baseline
node scripts/review/settings-panels/host-panel-qa.mjs http://127.0.0.1:8175/annora-explorer/ baseline
node scripts/review/settings-panels/panel-browser-qa.mjs http://127.0.0.1:8187/annora-explorer/ candidate
node scripts/review/settings-panels/host-panel-qa.mjs http://127.0.0.1:8187/annora-explorer/ candidate
node scripts/review/settings-panels/model-panel-qa.mjs http://127.0.0.1:8187/annora-explorer/ candidate
python3 scripts/review/settings-panels/compare-panels.py baseline candidate
```

Reports and screenshots go to ignored `work/panel-review/<label>/`. Use new
labels to preserve an earlier result. Every script opens isolated browser
contexts; it does not use visitor storage. The model script accepts a fourth
argument containing comma-separated model IDs for a focused rerun.

Check `failure`, `errors`, case counts and individual assertions in each report.
Compare panel geometry, style, focus, controls and pixel regions. Whole-model
contact shadows can differ slightly between sessions; a nonzero whole-image
difference alone is not evidence of a panel regression. Physical mobile/GPU
qualification requires separate devices.
