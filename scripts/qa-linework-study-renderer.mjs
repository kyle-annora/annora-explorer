// Run against a local Vite dev server so the control can instantiate the exact
// production AssemblyScene. Optional Playwright install: PLAYWRIGHT_MODULE.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = new URL(process.argv[2] || "http://127.0.0.1:8095/");
const out = path.resolve(process.argv[3] || "work/linework-review/renderer-evidence");
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const viewport = { width: 1280, height: 800 };
const report = { browser: browser.version(), viewport, deviceScaleFactor: 1, controls: {}, rotation: {}, errors: [] };

async function harness(kind) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  page.on("pageerror", error => report.errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") report.errors.push(message.text()); });
  await page.route("**/__study_probe", route => route.fulfill({
    contentType: "text/html", body: '<body style="margin:0"><div id="scene" style="position:fixed;inset:0"></div></body>',
  }));
  await page.goto(new URL("__study_probe", base).href);
  await page.evaluate(async ({ kind, base }) => {
    const module = name => import(new URL(name, base).href);
    const { STUDY_MODEL, STUDY_VIEWS } = await module("src/linework-study/study-model.js");
    const { buildHierarchy } = await module("src/explorer/model-state.js");
    const Scene = kind === "production"
      ? (await module("src/explorer/scene.js")).AssemblyScene
      : (await module("src/linework-study/study-scene.js")).StudyScene;
    const metadata = await (await fetch(STUDY_MODEL.metadataUrl)).json();
    const scene = new Scene(document.getElementById("scene"), metadata, buildHierarchy(metadata, STUDY_MODEL.presentationPolicy),
      { axisElements: [], theme: { outline: "#ff6840" } }, STUDY_MODEL);
    await scene.load();
    await scene.setRenderStyle("linework");
    window.probe = {
      async view(id) {
        const view = STUDY_VIEWS[id];
        scene.pauseCamera(); scene.setScope(view.scope); scene.setIsolated(true); scene.explode(view.explosion, false);
        const names = new Set(view.meshes || scene.nodes.get(view.scope).meshNames);
        scene.active = Array.from(scene.meshes.values()).filter(mesh => names.has(mesh.name));
        scene.contextMeshes = [];
        for (const mesh of scene.meshes.values()) {
          const show = names.has(mesh.name);
          mesh.userData.visibility.to([show ? 1 : 0], true); mesh.visible = show;
        }
        scene.setSelected(STUDY_MODEL.rootId);
        scene.fitMeshes(scene.active, false, scene.camera.position.clone().fromArray(view.direction).normalize());
        scene.syncEdges(); scene.invalidate();
        await scene.whenSettled({ settle: true });
        return { camera: scene.captureCameraView(), activeMeshes: scene.active.map(mesh => mesh.name) };
      },
      async setVariant(id) {
        scene.setStudyVariant?.(id); await scene.whenSettled({ settle: true });
        return scene.getStudyStats?.();
      },
      async angle(reference, degrees) {
        const pose = structuredClone(reference);
        const dx = pose.position[0] - pose.target[0], dz = pose.position[2] - pose.target[2], a = degrees * Math.PI / 180;
        pose.position[0] = pose.target[0] + dx * Math.cos(a) + dz * Math.sin(a);
        pose.position[2] = pose.target[2] - dx * Math.sin(a) + dz * Math.cos(a);
        scene.restoreCameraView(pose, { animate: false }); await scene.whenSettled({ settle: true });
      },
      dispose: () => scene.dispose(),
    };
  }, { kind, base: base.href });
  return { ctx, page };
}

async function capture(page, save) {
  const bytes = await page.locator("#scene canvas").screenshot();
  if (save) await fs.writeFile(path.join(out, save + ".png"), bytes);
  return page.evaluate(async base64 => {
    const blob = await (await fetch("data:image/png;base64," + base64)).blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height), context = canvas.getContext("2d");
    context.drawImage(bitmap, 0, 0); bitmap.close();
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let ink = 0;
    for (let i = 0; i < data.length; i += 4) ink += Math.max(0, 243 - data[i]) + Math.max(0, 243 - data[i + 1]) + Math.max(0, 241 - data[i + 2]);
    const hash = await crypto.subtle.digest("SHA-256", data);
    return { hash: Array.from(new Uint8Array(hash), n => n.toString(16).padStart(2, "0")).join(""),
      equivalentInkPixels: ink / (243 + 243 + 241) };
  }, bytes.toString("base64"));
}

try {
  for (const kind of ["production", "study"]) {
    const { ctx, page } = await harness(kind);
    try {
      for (const view of ["overview", "leg", "electronics"]) {
        await page.evaluate(() => window.probe.setVariant("baseline"));
        const { camera, activeMeshes } = await page.evaluate(view => window.probe.view(view), view);
        assert.equal(activeMeshes.length, { overview: 92, leg: 14, electronics: 3 }[view]);
        const initial = await capture(page, kind + "-" + view);
        if (kind === "production") {
          report.controls[view] = { production: initial, activeMeshes, camera };
          continue;
        }
        report.controls[view].baseline = initial;
        assert.equal(initial.hash, report.controls[view].production.hash, "Production parity: " + view);
        report.controls[view].variants = {};
        for (const id of ["clarity", "density", "combined"]) {
          const stats = await page.evaluate(id => window.probe.setVariant(id), id);
          report.controls[view].variants[id] = { stats, pixels: await capture(page, view + "-" + id) };
          assert.notEqual(report.controls[view].variants[id].pixels.hash, initial.hash);
          if (view === "overview" || id === "clarity") continue;
          const samples = [];
          for (const degrees of [-2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2]) {
            await page.evaluate(([camera, angle]) => window.probe.angle(camera, angle), [camera, degrees]);
            samples.push({ degrees, ...await capture(page, degrees === 2 ? view + "-" + id + "-yaw2" : null) });
          }
          await page.evaluate(camera => window.probe.angle(camera, 0), camera);
          const returned = await capture(page);
          assert.equal(returned.hash, samples[4].hash, "Return to the same yaw: " + view + "/" + id);
          const steps = samples.slice(1).map((sample, i) => Math.abs(sample.equivalentInkPixels - samples[i].equivalentInkPixels) / samples[i].equivalentInkPixels * 100);
          report.rotation[view + "/" + id] = { samples, maxAdjacentInkChangePercent: Math.max(...steps), returned };
        }
      }
    } finally {
      await page.evaluate(() => window.probe.dispose());
      await ctx.close();
    }
  }
  assert.deepEqual(report.errors, []);
} catch (error) {
  report.failure = error.message; process.exitCode = 1;
} finally {
  await fs.writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2) + "\n");
  await browser.close();
}
console.log(JSON.stringify({ views: Object.keys(report.controls), rotation: Object.keys(report.rotation),
  errors: report.errors, failure: report.failure, out }, null, 2));
