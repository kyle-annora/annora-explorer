# Hexapod linework performance record

Recorded 2026-11-03. Independent preview, Balanced profile, light background,
exploded assembly. One warm-up interval (500 ms) after changing treatment,
then one 12-second repeatable yaw sweep per case. Each sweep restores its
starting camera. No other browser comparison probes were running.

Browser: Chrome 156.0.8078.80. Renderer: ANGLE (Apple, ANGLE Metal Renderer: Apple M5 Pro, Unspecified Version).
Viewport: 1280 × 800 CSS pixels; DPR 1; model stage 1188 × 531.

| CPU slowdown | Treatment | Buffer | MSAA | Median FPS | p95 frame interval | Frames over 50 ms | Camera restored |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| 1× | baseline | 1188 × 531 | 0 | 59.9 | 17.5 ms | 0 | Yes |
| 1× | clarity | 2079 × 929 | 2 | 59.9 | 17.6 ms | 0 | Yes |
| 1× | density | 1188 × 531 | 0 | 59.9 | 17.5 ms | 0 | Yes |
| 1× | combined | 2079 × 929 | 2 | 59.9 | 17.5 ms | 0 | Yes |
| 4× | baseline | 1188 × 531 | 0 | 59.9 | 17.7 ms | 0 | Yes |
| 4× | clarity | 2079 × 929 | 2 | 59.9 | 17.6 ms | 0 | Yes |
| 4× | density | 1188 × 531 | 0 | 60.2 | 17.8 ms | 0 | Yes |
| 4× | combined | 2079 × 929 | 2 | 59.9 | 17.5 ms | 0 | Yes |

All cases use four draw calls. The 4× slowdown applies to the browser CPU;
the Apple GPU remains unchanged. These results establish a repeatable
workstation baseline, not a physical midrange-PC or phone performance claim.
A 60 Hz browser ceiling also hides any GPU headroom above that rate.

The preview caps rendering allocations and renders on demand when idle.
Physical lower-end GPU checks remain necessary before replacing production.
Use Performance check → Run check → Export report on a representative device.
Compare Original and Combined at the same viewport and camera; record the
device, browser, sustained motion, thermal conditions and battery mode.

Raw local output: `work/linework-study-evidence/performance.json`. Reproduce
with `scripts/qa-linework-study-browser.mjs --performance` against a static
preview. Frame intervals include scheduling and compositing; they are not
isolated GPU timings. No browser errors were recorded.
