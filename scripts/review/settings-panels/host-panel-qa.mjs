const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const base = process.argv[2] || "http://127.0.0.1:8175/annora-explorer/",
  label = process.argv[3] || "baseline";
const root = path.resolve("work/panel-review"),
  out = path.join(root, label);
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const report = { base, label, cases: [], errors: [] };
try {
  for (const host of ["product-room/", "studio/"])
    for (const viewport of [
      { width: 1280, height: 720 },
      { width: 390, height: 844 },
    ]) {
      const context = await browser.newContext({
          viewport,
          deviceScaleFactor: 1,
          hasTouch: viewport.width < 1000,
        }),
        page = await context.newPage();
      page.on("pageerror", (e) =>
        report.errors.push({ host, viewport, message: e.message }),
      );
      await page.goto(base + host, { waitUntil: "domcontentloaded" });
      if (host === "studio/")
        await page.getByText("Open product", { exact: true }).click();
      await page
        .locator('iframe[title="Interactive 3D product explorer"]')
        .waitFor({ state: "attached", timeout: 60000 });
      const frame = await page
        .locator('iframe[title="Interactive 3D product explorer"]')
        .contentFrame();
      await frame
        .locator('body[data-ready="true"]')
        .waitFor({ timeout: 90000 });
      await frame.locator("#theme-trigger").click();
      await frame.locator("#appearance-dark").click();
      await frame.locator('html[data-appearance="dark"]').waitFor();
      const prefix = host.replace("/", "") + "-" + viewport.width;
      await page.screenshot({
        path: path.join(out, prefix + "-appearance.png"),
        animations: "disabled",
      });
      await frame.locator("#theme-close").click();
      await frame.locator("#display-trigger").click();
      await frame.locator('[data-style="linework"]').click();
      await frame.locator('body[data-render-style="linework"]').waitFor();
      await frame.locator('#display-panel[aria-busy="false"]').waitFor();
      await page.screenshot({
        path: path.join(out, prefix + "-display.png"),
        animations: "disabled",
      });
      const state = await frame
        .locator("body")
        .evaluate(() => ({
          appearance: document.documentElement.dataset.appearance,
          render: document.body.dataset.renderStyle,
          theme: document.documentElement.dataset.theme,
          canvas: document.querySelectorAll("#scene canvas").length,
          overflow: document.documentElement.scrollWidth > innerWidth,
          displayHidden: document.getElementById("display-panel").hidden,
          themeHidden: document.getElementById("theme-panel").hidden,
          iframeSize: [innerWidth, innerHeight],
        }));
      assert.equal(state.canvas, 1);
      assert.equal(state.overflow, false);
      assert.equal(state.themeHidden, true);
      assert.equal(state.displayHidden, false);
      const hostOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      );
      assert.equal(hostOverflow, false);
      report.cases.push({ host, viewport, state, hostOverflow });
      await context.close();
    }
} catch (error) {
  report.failure = { message: error.message, stack: error.stack };
  process.exitCode = 1;
} finally {
  await fs.writeFile(
    path.join(out, "host-report.json"),
    JSON.stringify(report, null, 2),
  );
  if (report.errors.length || report.cases?.some(item => item.checks?.some(check => !check.result))) process.exitCode = 1;
    console.log(JSON.stringify(report, null, 2));
  await browser.close();
}
