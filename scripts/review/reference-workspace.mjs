const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const base = process.env.BASE_URL || process.env.ORIGIN || process.argv[2] || "http://127.0.0.1:8095/";
const url = new URL(base);
if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash || !base.endsWith("/")) throw new Error("Pass an HTTP(S) Explorer base URL with a trailing slash, without credentials, query or hash.");
const dev = process.env.DEV !== "0";
const folder = path.resolve(process.env.OUTPUT_DIR || process.argv[3] || "work/reference-workspace-review") + path.sep;
const label = process.env.LABEL || "results";
if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$/.test(label)) throw new Error("LABEL must be a short filename-safe identifier.");
await mkdir(folder, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true }), results = [];
function delta(a, b) {
  const key = a.viewMatrix && b.viewMatrix ? "viewMatrix" : "target";
  return Math.max(...a.position.map((v, i) => Math.abs(v - b.position[i])), ...a[key].map((v, i) => Math.abs(v - b[key][i])));
}
async function state(p) {
  return p.evaluate(() => window.__refQA ? window.__refQA() : { documentId: window.__refDocument, mode: document.body.dataset.viewerMode, view: document.body.dataset.referenceView, chapter: document.body.dataset.orbitChapter, progress: Number(document.querySelector("#orbit-progress")?.value), play: document.querySelector("#orbit-play")?.textContent.trim(), readerChapter: document.querySelector(".explorer-reference-reader")?.dataset.chapter, projection: document.querySelector(".explorer-reference-reader")?.dataset.projection, image: document.querySelector(".explorer-reference-canvas image")?.getAttribute("href"), scope: document.body.dataset.scope, selected: document.body.dataset.selection, camera: document.body.dataset.viewerMode === "explore" ? (() => {
    const c = JSON.parse(document.querySelector("#scene").dataset.cameraState);
    return { position: c.position, target: c.target, offset: c.offset };
  })() : window.__refStageCapture?.(), cameraMeasurement: document.body.dataset.viewerMode === "explore" ? "scene DOM snapshot" : "compiled stage captureView hook", gl: { created: window.__glStats.created, lost: window.__glStats.lost }, focus: document.activeElement?.id || document.activeElement?.dataset.viewType });
}
async function stable(p) {
  let last = await state(p);
  for (let i = 0; i < 20; i++) {
    await p.waitForTimeout(100);
    const next = await state(p);
    if (last.camera && next.camera && delta(last.camera, next.camera) < 1e-7) return next;
    last = next;
  }
  return last;
}
async function view(p, id) {
  await p.locator(`[data-view-type="${id}"]`).click();
  await p.waitForFunction((id2) => document.body.dataset.referenceView === id2, id);
  await p.waitForTimeout(200);
  if (id !== "3d") await p.waitForFunction(() => document.querySelector(".explorer-reference-reader")?.getAttribute("aria-busy") === "false");
  return stable(p);
}
async function mode(p, id) {
  await p.locator(id === "demo" ? "#tour-start" : "#viewer-explore").click();
  await p.waitForFunction((id2) => document.body.dataset.viewerMode === id2 && document.querySelector(".viewer-navigation").getAttribute("aria-busy") === "false", id);
  await p.waitForTimeout(200);
  return stable(p);
}
async function chapter(p, id) {
  await p.locator("#viewer-context summary").click();
  await p.locator(`[data-orbit-target="${id}"]`).click();
  await p.waitForFunction((id2) => document.body.dataset.orbitChapter === id2, id);
  await p.waitForTimeout(800);
}
async function scrub(p, n = 650) {
  await p.locator("#orbit-progress").evaluate((el, n2) => {
    el.value = String(n2);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, n);
  await p.waitForTimeout(150);
}
async function inspectLeg(p) {
  await p.locator("#toggle-tree").click();
  await p.locator('.tree-select[data-node="hex-leg-1"]').click();
  await p.locator('.tree-enter[data-node="hex-leg-1"]').click();
  await p.waitForFunction(() => document.body.dataset.scope === "hex-leg-1" && document.querySelector("#scene").dataset.motion === "settled");
}
async function shot(p, name) {
  await p.mouse.move(2, 450);
  await p.screenshot({ path: folder + label + "-" + name + ".png" });
}
async function test(name, modeName, fn, { mobile = false } = {}) {
  if (process.env.ONLY && !name.includes(process.env.ONLY)) return;
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 }), p = await context.newPage(), row = { name, steps: [], errors: [] };
  p.setDefaultTimeout(25e3);
  p.on("pageerror", (e) => row.errors.push(e.message));
  await context.addInitScript(() => {
    window.__refDocument = crypto.randomUUID();
    window.__glStats = { created: 0, lost: 0 };
    const contexts = /* @__PURE__ */ new WeakSet(), original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      const result = original.call(this, type, ...args);
      if (result && ["webgl", "webgl2", "experimental-webgl"].includes(type) && !contexts.has(result)) {
        contexts.add(result);
        window.__glStats.created++;
        this.addEventListener("webglcontextlost", () => window.__glStats.lost++);
      }
      return result;
    };
  });
  if (!dev) await p.route("**/assets/*.js*", async (route) => {
    const response = await route.fetch();
    let body = await response.text();
    body = body.replace(/captureChapterFrame:([\w$]+),captureView:([\w$]+),restoreView:/g, "captureChapterFrame:$1,captureView:(window.__refStageCapture=$2),restoreView:");
    await route.fulfill({ response, body });
  });
  if (dev) await p.route("**/src/explorer/app.js*", async (route) => {
    const response = await route.fetch();
    let body = await response.text();
    assert(body.includes("return mountOrbitalUI({"));
    body = body.replace("return mountOrbitalUI({", "return window.__refDemo = mountOrbitalUI({");
    body += '\nwindow.__refQA=()=>({documentId:window.__refDocument,mode:document.body.dataset.viewerMode,view:referenceWorkspace?.view,chapter:document.body.dataset.orbitChapter,progress:Number(document.querySelector("#orbit-progress")?.value),play:document.querySelector("#orbit-play")?.textContent.trim(),readerChapter:document.querySelector(".explorer-reference-reader")?.dataset.chapter,projection:document.querySelector(".explorer-reference-reader")?.dataset.projection,image:document.querySelector(".explorer-reference-canvas image")?.getAttribute("href"),scope:navigation.scopeId,selected:navigation.selectedId,camera:orbital?.active?window.__refDemo?.captureState()?.view:explorer.captureCameraView(),gl:window.__glStats,focus:document.activeElement?.id||document.activeElement?.dataset.viewType});';
    await route.fulfill({ response, body });
  });
  try {
    await p.goto(`${base}?model=hexapod${modeName === "demo" ? "&presentation=1#leg" : ""}`, { waitUntil: "domcontentloaded" });
    await p.waitForFunction((mode2) => document.body.dataset.ready === "true" && document.body.dataset.viewerMode === mode2 && document.querySelector(".viewer-navigation")?.getAttribute("aria-busy") === "false", modeName, { timeout: 12e4 });
    if (modeName === "demo") {
      await scrub(p);
      await p.waitForTimeout(800);
    }
    const initial = await state(p);
    row.document = initial.documentId;
    await fn(p, row);
    const final = await state(p);
    assert.equal(final.documentId, row.document, "dev document reloaded during test");
    assert.equal(final.gl.created, 1, "more than one WebGL context created");
    assert.equal(final.gl.lost, 0, "the live WebGL context was lost");
    assert.deepEqual(row.errors, []);
    row.final = final;
    row.pass = true;
  } catch (e) {
    row.pass = false;
    process.exitCode = 1;
    row.error = e.stack;
    row.failedState = await state(p).catch(() => null);
    await shot(p, name + "-FAIL").catch(() => {
    });
  } finally {
    results.push(row);
    await writeFile(folder + label + ".json", JSON.stringify(results, null, 2));
    console.log(JSON.stringify({ name, pass: row.pass, error: row.error?.split("\n")[0], steps: row.steps }));
    await context.close();
  }
}
try {
  await test("demo-view-roundtrip", "demo", async (p, r) => {
    const before = await stable(p);
    r.steps.push({ at: "before", ...before });
    await view(p, "drawings");
    await view(p, "compare");
    const after = await view(p, "3d");
    r.steps.push({ at: "after", ...after, cameraDelta: delta(before.camera, after.camera) });
    assert.equal(after.progress, 650);
    assert.equal(after.chapter, "leg");
    assert(delta(before.camera, after.camera) < 1e-5, "Demo full-size camera changed after representation roundtrip");
    await shot(p, "demo-view-roundtrip");
  });
  await test("explore-view-roundtrip", "explore", async (p, r) => {
    await inspectLeg(p);
    const before = await stable(p);
    await view(p, "compare");
    await view(p, "drawings");
    const after = await view(p, "3d");
    r.steps.push({ before, after, cameraDelta: delta(before.camera, after.camera) });
    assert.equal(after.scope, before.scope);
    assert.equal(after.selected, before.selected);
    assert.equal(after.readerChapter, "leg");
    assert(delta(before.camera, after.camera) < 1e-5, "Explore full-size camera changed after representation roundtrip");
    await shot(p, "explore-view-roundtrip");
  });
  await test("chapter-change-in-drawings", "demo", async (p, r) => {
    await view(p, "drawings");
    await chapter(p, "electronics");
    await p.waitForFunction(() => document.querySelector(".explorer-reference-reader").dataset.chapter === "electronics" && document.querySelector(".explorer-reference-reader").getAttribute("aria-busy") === "false");
    const drawing = await state(p);
    r.steps.push({ at: "new-drawing", ...drawing });
    assert.equal(drawing.view, "drawings");
    assert(drawing.image.includes("electronics-"), "reader displays a stale chapter asset");
    assert.equal(drawing.progress, 0);
    const after = await view(p, "3d");
    r.steps.push({ at: "3d", ...after });
    assert.equal(after.chapter, "electronics");
    assert.equal(after.progress, 0);
    await shot(p, "chapter-change-in-drawings");
  });
  for (const representation of ["drawings", "compare"]) await test("free-camera-through-demo-" + representation, "explore", async (p, r) => {
    await inspectLeg(p);
    const before = await stable(p);
    await mode(p, "demo");
    await chapter(p, "leg");
    await scrub(p);
    await view(p, representation);
    await mode(p, "explore");
    const hiddenFree = await state(p);
    const after = await view(p, "3d");
    r.steps.push({ before, hiddenFree, after, cameraDelta: delta(before.camera, after.camera) });
    assert.equal(after.scope, before.scope);
    assert.equal(after.selected, before.selected);
    assert(delta(before.camera, after.camera) < 1e-5, "original free workspace camera lost after closing Demo in " + representation);
    await shot(p, "free-camera-through-demo-" + representation);
  });
  for (const representation of ["drawings", "compare"]) await test("demo-camera-through-explore-" + representation, "demo", async (p, r) => {
    const authored = await stable(p), box = await p.locator("#viewport").boundingBox();
    await p.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.45);
    await p.mouse.down();
    await p.mouse.move(box.x + box.width * 0.73, box.y + box.height * 0.51, { steps: 10 });
    await p.mouse.up();
    const before = await stable(p);
    assert(delta(authored.camera, before.camera) > 1e-3, "custom Demo orbit did not change the camera");
    await mode(p, "explore");
    await view(p, representation);
    await mode(p, "demo");
    const represented = await state(p);
    assert.equal(represented.view, representation);
    assert.equal(represented.chapter, "leg");
    assert.equal(represented.progress, 650);
    const after = await view(p, "3d");
    r.steps.push({ before, represented, after, cameraDelta: delta(before.camera, after.camera) });
    assert(delta(before.camera, after.camera) < 1e-5, "custom Demo camera lost after first representation change in Explore");
    await shot(p, "demo-camera-through-explore-" + representation);
  });
  for (const representation of ["drawings", "compare"]) await test("mode-retention-" + representation, "explore", async (p, r) => {
    await inspectLeg(p);
    await mode(p, "demo");
    await chapter(p, "leg");
    await scrub(p);
    const full = await stable(p);
    await view(p, representation);
    const before = await state(p);
    await mode(p, "explore");
    const free = await state(p);
    assert.equal(free.view, representation);
    assert.equal(free.scope, "hex-leg-1");
    assert.equal(free.readerChapter, "leg");
    await mode(p, "demo");
    const resumed = await state(p);
    r.steps.push({ full, before, free, resumed });
    assert.equal(resumed.view, representation);
    assert.equal(resumed.chapter, "leg");
    assert.equal(resumed.progress, 650);
    assert.match(resumed.play, /Resume|Replay/);
    const after = await view(p, "3d");
    r.steps.push({ at: "full-size-return", ...after, cameraDelta: delta(full.camera, after.camera) });
    assert(delta(full.camera, after.camera) < 1e-5, "original full-size Demo camera lost across mode+representation switches");
    await shot(p, "mode-retention-" + representation);
  });
  await test("mobile-drawings-escape", "demo", async (p, r) => {
    assert.equal(await p.locator('[data-view-type="compare"]').isVisible(), false);
    await p.locator('[data-view-type="drawings"]').tap();
    await p.waitForFunction(() => document.body.dataset.referenceView === "drawings");
    await p.locator("#viewer-context summary").tap();
    await p.locator('[data-orbit-target="electronics"]').tap();
    await p.waitForFunction(() => document.querySelector(".explorer-reference-reader").dataset.chapter === "electronics");
    await p.keyboard.press("Escape");
    await p.waitForFunction(() => document.body.dataset.referenceView === "3d");
    const after = await stable(p);
    r.steps.push(after);
    assert.equal(after.mode, "demo");
    assert.equal(after.chapter, "electronics");
    assert.equal(after.focus, "3d");
    await shot(p, "mobile-drawings-escape");
  }, { mobile: true });
  await test("escape-menu-priority", "demo", async (p, r) => {
    await view(p, "drawings");
    await p.locator("#viewer-context summary").click();
    await p.keyboard.press("Escape");
    const first = await state(p);
    const menu = await p.locator("#orbit-menu").evaluate((e) => e.open);
    r.steps.push({ at: "close-menu", ...first, menu });
    assert.equal(menu, false);
    assert.equal(first.view, "drawings");
    assert.equal(first.mode, "demo");
    await p.keyboard.press("Escape");
    await p.waitForFunction(() => document.body.dataset.referenceView === "3d");
    const second = await state(p);
    assert.equal(second.mode, "demo");
    assert.equal(second.focus, "3d");
    r.steps.push({ at: "return-3d", ...second });
  });
  await test("compare-mobile-fallback", "demo", async (p, r) => {
    await view(p, "compare");
    await p.setViewportSize({ width: 390, height: 844 });
    await p.waitForFunction(() => document.body.dataset.referenceView === "drawings");
    const compact = await state(p);
    r.steps.push({ at: "compact", ...compact });
    assert.equal(await p.locator('[data-view-type="compare"]').isVisible(), false);
    assert.equal(compact.focus, "drawings");
    await p.keyboard.press("Escape");
    await p.waitForFunction(() => document.body.dataset.referenceView === "3d");
    const after = await stable(p);
    r.steps.push({ at: "escape", ...after });
    assert.equal(after.mode, "demo");
    assert.equal(after.progress, 650);
    assert.equal(after.focus, "3d");
    await shot(p, "compare-mobile-fallback");
  });
} finally {
  if (!results.length) {
    process.exitCode = 1;
    console.error("No review cases matched ONLY.");
  }
  await browser.close();
}
