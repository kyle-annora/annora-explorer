const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const base = process.argv[2] || "http://127.0.0.1:8175/annora-explorer/";
const label = process.argv[3] || "baseline";
const root = path.resolve("work/panel-review");
const out = path.join(root, label);
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const report = {
  base,
  label,
  browser: browser.version(),
  timestamp: new Date().toISOString(),
  cases: [],
  errors: [],
};
const checks = [];
const record = (name, result = true) => checks.push({ name, result });
const viewports = [
  { width: 1280, height: 720 },
  { width: 390, height: 844 },
  { width: 320, height: 740 },
  { width: 844, height: 390 },
];
async function snapshot(page, name) {
  await page.waitForTimeout(250);
  const state = await page.evaluate(() => {
    const ids = [
      "theme-trigger",
      "theme-panel",
      "appearance-light",
      "appearance-dark",
      "theme-options",
      "custom-accent",
      "custom-accent-hex",
      "accent-validation",
      "display-trigger",
      "display-panel",
      "display-options",
      "display-current",
      "display-legend",
      "display-engineering",
      "display-linework",
      "display-grid",
      "display-ambientOcclusion",
      "display-featureEdges",
      "display-hiddenEdges",
      "display-lineWeight",
      "display-reset",
    ];
    const data = {
      appearance: document.documentElement.dataset.appearance,
      theme: document.documentElement.dataset.theme,
      render: document.body.dataset.renderStyle,
      active:
        document.activeElement.id ||
        document.activeElement.dataset.style ||
        document.activeElement.dataset.theme ||
        document.activeElement.tagName,
      overflow: document.documentElement.scrollWidth > innerWidth,
      canvasCount: document.querySelectorAll("#scene canvas").length,
    };
    data.elements = ids.map((id) => {
      const e = document.getElementById(id),
        r = e.getBoundingClientRect(),
        style = getComputedStyle(e);
      return {
        id,
        hidden: e.hidden,
        disabled: e.disabled ?? null,
        value: e.value ?? null,
        checked: e.checked ?? null,
        pressed: e.getAttribute("aria-pressed"),
        expanded: e.getAttribute("aria-expanded"),
        invalid: e.getAttribute("aria-invalid"),
        busy: e.getAttribute("aria-busy"),
        text: e.textContent.trim().replace(/\s+/g, " "),
        rect: [r.x, r.y, r.width, r.height].map(
          (v) => Math.round(v * 100) / 100,
        ),
        color: style.color,
        background: style.backgroundColor,
        border: style.borderColor,
        font: style.font,
      };
    });
    data.presets = [...document.querySelectorAll(".theme-option")].map((e) => ({
      id: e.dataset.theme,
      pressed: e.getAttribute("aria-pressed"),
      disabled: e.disabled,
    }));
    data.styles = [...document.querySelectorAll(".display-option")].map(
      (e) => ({
        id: e.dataset.style,
        pressed: e.getAttribute("aria-pressed"),
        disabled: e.disabled,
      }),
    );
    return data;
  });
  await page.screenshot({
    path: path.join(out, name + ".png"),
    animations: "disabled",
  });
  await fs.writeFile(
    path.join(out, name + ".json"),
    JSON.stringify(state, null, 2),
  );
  record(name + " no overflow", !state.overflow);
  record(name + " one canvas", state.canvasCount === 1);
  return state;
}
async function ready(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => document.body.dataset.ready === "true",
    null,
    { timeout: 90000 },
  );
  await page.waitForTimeout(800);
}
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport,
      deviceScaleFactor: 1,
      hasTouch: viewport.width < 1000,
    });
    const page = await context.newPage();
    page.on("pageerror", (e) =>
      report.errors.push({ viewport, message: e.message }),
    );
    const prefix = viewport.width + "x" + viewport.height;
    await ready(
      page,
      base + "?model=kinetic-01&appearance=light&theme=ember&quality=balanced",
    );
    await snapshot(page, prefix + "-closed");
    await page.locator("#theme-trigger").click();
    assert.equal(
      await page.evaluate(() => document.activeElement.id),
      "appearance-light",
    );
    record(prefix + " appearance initial focus");
    await snapshot(page, prefix + "-appearance-light");
    await page.locator("#appearance-dark").click();
    await page.waitForFunction(
      () => document.documentElement.dataset.appearance === "dark",
    );
    await snapshot(page, prefix + "-appearance-dark");
    await page.locator("#custom-accent-hex").fill("oops");
    await page.locator("#custom-accent-hex").press("Enter");
    assert.equal(
      await page.locator("#custom-accent-hex").getAttribute("aria-invalid"),
      "true",
    );
    record(prefix + " invalid accent");
    await snapshot(page, prefix + "-invalid-accent");
    await page.locator("#custom-accent-hex").fill("#4385ff");
    await page.locator("#custom-accent-hex").press("Enter");
    await page.waitForFunction(
      () => document.documentElement.dataset.theme === "custom",
    );
    record(prefix + " valid custom accent");
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#theme-panel").isVisible(), false);
    assert.equal(
      await page.evaluate(() => document.activeElement.id),
      "theme-trigger",
    );
    record(prefix + " appearance escape return");
    await page.locator("#display-trigger").click();
    assert.equal(
      await page.evaluate(() => document.activeElement.dataset.style),
      "engineering",
    );
    record(prefix + " display initial focus");
    await snapshot(page, prefix + "-display-engineering");
    await page.locator('[data-style="linework"]').click();
    await page.waitForFunction(
      () =>
        document.body.dataset.renderStyle === "linework" &&
        document.getElementById("display-panel").getAttribute("aria-busy") ===
          "false",
    );
    await snapshot(page, prefix + "-display-linework");
    await page.locator("#display-hiddenEdges").check();
    await page.locator("#display-lineWeight").selectOption("bold");
    record(prefix + " display detail inputs");
    await page.locator('[data-style="flat"]').click();
    await page.waitForFunction(
      () =>
        document.body.dataset.renderStyle === "flat" &&
        document.getElementById("display-panel").getAttribute("aria-busy") ===
          "false",
    );
    await snapshot(page, prefix + "-display-flat");
    await page.locator("#display-reset").focus();
    await page.keyboard.press("Tab");
    assert.equal(
      await page.evaluate(() => document.activeElement.id),
      "display-close",
    );
    await page.keyboard.press("Shift+Tab");
    assert.equal(
      await page.evaluate(() => document.activeElement.id),
      "display-reset",
    );
    record(prefix + " display tab containment");
    await page.keyboard.press("Escape");
    assert.equal(
      await page.evaluate(() => document.activeElement.id),
      "display-trigger",
    );
    record(prefix + " display escape return");
    // Explicit keyboard activation can reach the peer trigger even when a panel overlaps it.
    await page.locator("#theme-trigger").focus();
    await page.keyboard.press("Enter");
    await page.locator("#display-trigger").focus();
    await page.keyboard.press("Enter");
    assert.equal(await page.locator("#theme-panel").isVisible(), false);
    assert.equal(await page.locator("#display-panel").isVisible(), true);
    record(prefix + " appearance to display exclusion");
    await page.locator("#theme-trigger").focus();
    await page.keyboard.press("Enter");
    assert.equal(await page.locator("#display-panel").isVisible(), false);
    assert.equal(await page.locator("#theme-panel").isVisible(), true);
    record(prefix + " display to appearance exclusion");
    await page.mouse.click(5, Math.floor(viewport.height / 2));
    assert.equal(await page.locator("#theme-panel").isVisible(), false);
    record(prefix + " outside pointer close");
    await page.locator("#toggle-tree").click();
    if (viewport.width < 980) {
      assert.equal(await page.locator("#tree-backdrop").isVisible(), true);
      await page.keyboard.press("Escape");
      record(prefix + " mobile tree dismisses before settings");
    }
    await page.locator("#theme-trigger").click();
    assert.equal(
      await page.evaluate(() => document.body.classList.contains("tree-open")),
      false,
    );
    record(prefix + " settings after tree");
    await page.keyboard.press("Escape");
    await page.reload();
    await page.waitForFunction(
      () => document.body.dataset.ready === "true",
      null,
      { timeout: 90000 },
    );
    assert.equal(
      await page.evaluate(() => document.documentElement.dataset.appearance),
      "dark",
    );
    assert.equal(
      await page.evaluate(() => document.documentElement.dataset.theme),
      "custom",
    );
    assert.equal(
      await page.evaluate(() => document.body.dataset.renderStyle),
      "flat",
    );
    record(prefix + " reload preferences");
    report.cases.push({ viewport, checks: checks.splice(0) });
    await context.close();
  }
} catch (error) {
  report.failure = { message: error.message, stack: error.stack };
  report.pendingChecks = checks;
  process.exitCode = 1;
} finally {
  await fs.writeFile(
    path.join(out, "report.json"),
    JSON.stringify(report, null, 2),
  );
  if (report.errors.length || report.cases?.some(item => item.checks?.some(check => !check.result))) process.exitCode = 1;
    console.log(JSON.stringify(report, null, 2));
  await browser.close();
}
