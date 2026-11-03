const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const base = process.argv[2] || "http://127.0.0.1:8187/annora-explorer/",
  label = process.argv[3] || "candidate";
const out = path.join(path.resolve("work/panel-review"), label);
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const report = {
  base,
  label,
  browser: browser.version(),
  models: [],
  crossTab: [],
  errors: [],
};
async function ready(page, model) {
  await page.goto(
    base +
      "?model=" +
      model +
      "&appearance=light&theme=ember&quality=performance",
    { waitUntil: "domcontentloaded" },
  );
  await page.waitForFunction(
    () => document.body.dataset.ready === "true",
    null,
    { timeout: 120000 },
  );
}
try {
  for (const model of process.argv[4]?.split(",") || [
    "kinetic-01",
    "apollo",
    "linkrods",
    "sk08",
    "open-duck",
    "hexapod",
    "dropbear",
  ]) {
    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
      }),
      page = await context.newPage();
    page.on("pageerror", (e) =>
      report.errors.push({ model, message: e.message }),
    );
    await ready(page, model);
    let tour = null;
    assert.equal(await page.locator("#scene canvas").count(), 1);
    await page.locator("#theme-trigger").click();
    assert.equal(
      await page.evaluate(() => document.activeElement.id),
      "appearance-light",
    );
    await page.keyboard.press("Escape");
    await page.locator("#display-trigger").click();
    assert.equal(
      await page.evaluate(() => document.activeElement.dataset.style),
      "engineering",
    );
    await page.keyboard.press("Escape");
    if (["apollo", "open-duck"].includes(model)) {
      await page.locator("#tour-start").click();
      await page.waitForFunction(
        () => document.body.classList.contains("tour-active"),
        null,
        { timeout: 120000 },
      );
      const expected = model === "apollo" ? "steps" : "continuous";
      assert.equal(
        await page.evaluate(() => document.body.dataset.tourPlayback),
        expected,
      );
      if (model === "apollo") {
        await page.locator("#tour-play").click();
        await page.waitForFunction(
          () => document.body.dataset.tourStatus === "playing",
        );
      }
      await page.locator("#theme-trigger").click();
      const before = await page.evaluate(() => ({
        status: document.body.dataset.tourStatus,
        time: document.body.dataset.tourTime,
      }));
      await page.locator("#appearance-dark").click();
      await page.waitForFunction(
        () => document.documentElement.dataset.appearance === "dark",
      );
      await page.waitForTimeout(200);
      const after = await page.evaluate(() => ({
        status: document.body.dataset.tourStatus,
        time: document.body.dataset.tourTime,
        reason: document.body.dataset.tourReason,
      }));
      if (model === "open-duck") {
        assert.equal(after.status, "playing");
        assert.ok(Number(after.time) > Number(before.time));
      }
      assert.equal(await page.locator("#display-trigger").isVisible(), false);
      await page.keyboard.press("Escape");
      assert.equal(
        await page.evaluate(() =>
          document.body.classList.contains("tour-active"),
        ),
        true,
      );
      assert.equal(
        await page.evaluate(() => document.activeElement.id),
        "theme-trigger",
      );
      if (
        await page.evaluate(
          () => document.body.dataset.tourStatus === "playing",
        )
      )
        await page.locator("#tour-play").click();
      await page.waitForFunction(
        () => document.body.dataset.tourStatus !== "playing",
      );
      const paused = await page.evaluate(() => document.body.dataset.tourTime);
      await page.locator("#theme-trigger").click();
      await page.locator('[data-theme="laser-red"]').click();
      await page.keyboard.press("Escape");
      await page.waitForTimeout(200);
      assert.equal(
        await page.evaluate(() => document.body.dataset.tourTime),
        paused,
      );
      await page.locator("#tour-exit").click();
      await page.waitForFunction(
        () => !document.body.classList.contains("tour-active"),
      );
      assert.equal(await page.locator("#display-trigger").isVisible(), true);
      tour = { expected, before, after, paused, exit: true };
    }
    report.models.push({
      model,
      ready: true,
      canvasCount: await page.locator("#scene canvas").count(),
      tour,
    });
    await context.close();
  }
  const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    }),
    first = await context.newPage(),
    second = await context.newPage();
  for (const page of [first, second])
    page.on("pageerror", (e) =>
      report.errors.push({ model: "cross-tab", message: e.message }),
    );
  await ready(first, "kinetic-01");
  await ready(second, "kinetic-01");
  await first.bringToFront();
  await first.locator("#theme-trigger").click();
  await first.locator('[data-theme="ion-blue"]').click();
  await first.locator("#appearance-dark").click();
  await first.keyboard.press("Escape");
  await first.locator("#display-trigger").click();
  await first.locator("#display-grid").uncheck();
  await second.bringToFront();
  await second.waitForFunction(
    () =>
      document.documentElement.dataset.theme === "ion-blue" &&
      document.documentElement.dataset.appearance === "dark" &&
      !document.getElementById("display-grid").checked,
    null,
    { timeout: 15000 },
  );
  report.crossTab.push({
    direction: "first → second",
    state: await second.evaluate(() => ({
      appearance: document.documentElement.dataset.appearance,
      theme: document.documentElement.dataset.theme,
      grid: document.getElementById("display-grid").checked,
      url: location.search,
    })),
  });
  await second.locator("#theme-trigger").click();
  await second.locator("#custom-accent-hex").fill("#b66bff");
  await second.locator("#custom-accent-hex").press("Enter");
  await first.bringToFront();
  await first.waitForFunction(
    () =>
      document.documentElement.dataset.theme === "custom" &&
      document.getElementById("custom-accent-hex").value === "#b66bff",
  );
  report.crossTab.push({
    direction: "second → first",
    accent: await first.locator("#custom-accent-hex").inputValue(),
  });
  await context.close();
} catch (error) {
  report.failure = { message: error.message, stack: error.stack };
  process.exitCode = 1;
} finally {
  await fs.writeFile(
    path.join(out, "model-report.json"),
    JSON.stringify(report, null, 2),
  );
  if (report.errors.length || report.cases?.some(item => item.checks?.some(check => !check.result))) process.exitCode = 1;
    console.log(JSON.stringify(report, null, 2));
  await browser.close();
}
