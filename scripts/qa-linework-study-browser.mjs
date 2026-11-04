// Run against the focused static preview. Install Playwright separately, or set
// PLAYWRIGHT_MODULE to its entry module. Use --performance for 8 × 12s sweeps.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv.find(value => /^https?:/.test(value)) || 'http://127.0.0.1:8191/';
const out = path.resolve('work/linework-study-evidence');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = { browser: browser.version(), base, comparisons: [], mobile: [], performance: [], errors: [] };
function nearCamera(a, b) {
  return ['position','target','up'].every(key => a[key].every((v,i) => Math.abs(v-b[key][i]) < 1e-9)) && JSON.stringify(a.projection) === JSON.stringify(b.projection);
}
async function open(viewport, dpr = 1, touch = false) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: dpr, hasTouch: touch, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  await page.goto(base);
  await page.waitForFunction(() => document.body.dataset.ready === 'true', null, { timeout: 90000 });
  return { page, context };
}
async function state(page) { return page.evaluate(() => window.lineworkStudy.getState()); }
try {
  const { page, context } = await open({ width: 1440, height: 900 });
  for (const view of ['overview','leg','electronics']) {
    await page.locator(`button[data-scope="${view}"]`).click();
    await page.waitForFunction(() => !window.lineworkStudy.getState().busy);
    const original = await state(page);
    assert.equal(original.activeMeshes.length, { overview: 92, leg: 14, electronics: 3 }[view]);
    for (const variant of ['baseline','clarity','density','combined']) {
      await page.locator(`button[data-variant="${variant}"]`).click();
      await page.mouse.move(5,5); await page.waitForTimeout(150);
      const current = await state(page);
      assert.ok(nearCamera(current.camera, original.camera));
      assert.deepEqual(current.activeMeshes, original.activeMeshes);
      assert.equal(await page.locator('canvas').count(), 1);
      await page.screenshot({ path: path.join(out, `${view}-${variant}.png`) });
      report.comparisons.push({ view, variant, cameraUnchanged: true, meshes: current.activeMeshes.length, stats: current.stats });
    }
  }
  await page.locator('#rotate-toggle').click(); await page.waitForTimeout(400);
  assert.ok((await state(page)).moving);
  await page.locator('#rotate-toggle').click(); assert.equal((await state(page)).moving, false);
  await page.locator('#reset-view').click(); await page.locator('#rotate-toggle').click();
  const box = await page.locator('#scene').boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2); await page.mouse.down();
  await page.mouse.move(box.x+box.width/2+80,box.y+box.height/2+25,{steps:8}); await page.mouse.up();
  assert.equal((await state(page)).moving, false);
  await page.locator('#reset-view').click();
  await page.waitForTimeout(700); const frames = (await state(page)).stats.renderedFrames;
  await page.waitForTimeout(700); assert.equal((await state(page)).stats.renderedFrames, frames);
  report.rotationPause = report.pointerTakeover = report.idleRenderStops = true;
  await context.close();
  for (const [width,height] of [[320,740],[390,844],[844,390]]) {
    const { page, context } = await open({width,height},2,true);
    for (const view of ['overview','leg','electronics']) {
      await page.locator(`button[data-scope="${view}"]`).tap();
      await page.waitForFunction(() => !window.lineworkStudy.getState().busy);
      for (const appearance of ['light','dark']) {
        if ((await state(page)).appearance !== appearance) await page.locator('#appearance-toggle').tap();
        await page.waitForTimeout(150);
        const layout = await page.evaluate(() => ({
          overflow: document.documentElement.scrollWidth > innerWidth,
          hits: [...document.querySelectorAll('button[data-variant],button[data-scope],.tools button')].map(button => {
            const r=button.getBoundingClientRect();return { height:r.height, hit:button.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)) };
          }),
        }));
        assert.equal(layout.overflow,false); assert.ok(layout.hits.every(item => item.height >= 44 && item.hit));
        await page.screenshot({path:path.join(out,`${width}-${height}-${view}-${appearance}.png`)});
        report.mobile.push({width,height,view,appearance,controls:layout.hits.length});
      }
    }
    await context.close();
  }
  if (process.argv.includes('--performance')) {
    const { page, context } = await open({width:1280,height:800});
    report.hardware = await page.evaluate(() => {
      const gl=document.querySelector('canvas').getContext('webgl2'), extension=gl.getExtension('WEBGL_debug_renderer_info');
      return {gpu:extension?gl.getParameter(extension.UNMASKED_RENDERER_WEBGL):'Unavailable',concurrency:navigator.hardwareConcurrency};
    });
    const cdp=await context.newCDPSession(page);
    for (const rate of [1,4]) {
      await cdp.send('Emulation.setCPUThrottlingRate',{rate});
      for (const variant of ['baseline','clarity','density','combined']) {
        await page.locator(`button[data-variant="${variant}"]`).click();await page.waitForTimeout(500);
        const camera=(await state(page)).camera;
        await page.evaluate(() => {document.body.dataset.measurement='running';window.lineworkStudy.startMotion(true)});
        await page.waitForFunction(() => document.body.dataset.measurement==='complete',null,{timeout:90000});
        const result=await state(page);assert.ok(nearCamera(camera,result.camera));
        report.performance.push({cpuThrottle:rate,cameraRestored:true,...result.lastReport});
        console.log(variant,rate,result.lastReport.medianFps.toFixed(1),result.lastReport.frameIntervalMs.p95.toFixed(1));
      }
    }
    await context.close();
  }
  assert.deepEqual(report.errors,[]);
} catch(error) { report.failure=error.message;process.exitCode=1; }
finally { await writeFile(path.join(out,'browser-report.json'),JSON.stringify(report,null,2)+'\n');await browser.close(); }
console.log(JSON.stringify({comparisons:report.comparisons.length,mobile:report.mobile.length,performance:report.performance.length,failure:report.failure,errors:report.errors}));
