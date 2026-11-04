// Pass a served Pages subpath (trailing slash), then an optional output directory.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { LEG_POSES } from '../orbit-preview/leg-poses.js';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const [base, out = 'work/leg-study-review'] = process.argv.slice(2);
if (!base?.endsWith('/')) throw new Error('Pass the preview URL with its trailing slash.');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const results = { base, browser: browser.version(), checks: [], errors: [] };
const study = '?study=leg-orbit#leg';

async function open(width, height, touch, reduce, route = study) {
  const context = await browser.newContext({
    viewport: { width, height }, deviceScaleFactor: touch ? 2 : 1, isMobile: touch, hasTouch: touch,
    reducedMotion: reduce ? 'reduce' : 'no-preference'
  });
  const page = await context.newPage();
  page.on('pageerror', error => results.errors.push(error.message));
  page.on('response', res => { if (res.status() >= 400) results.errors.push(res.status() + ' ' + res.url()); });
  page.on('console', msg => { if (msg.type() === 'error') results.errors.push(msg.text()); });
  // Count actual draws without making a diagnostic or continuous timer part of the product.
  await page.addInitScript(() => {
    window.studyDraws = 0;
    for (const name of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
      const original = WebGL2RenderingContext.prototype[name];
      WebGL2RenderingContext.prototype[name] = function(...args) {
        if (this.canvas.id === 'scene') window.studyDraws++;
        return original.apply(this, args);
      };
    }
  });
  await page.goto(base + route);
  await page.waitForSelector('body[data-ready="true"]', { timeout: 60000 });
  assert.equal(await page.locator('canvas').count(), 1);
  return { context, page };
}

const control = (page, label) => page.getByRole('button', { name: label, exact: true });
const capture = (page, name) => page.screenshot({ path: path.join(out, name + '.png') });
async function settled(page) {
  await page.waitForTimeout(300);
  const draws = await page.evaluate(() => window.studyDraws);
  await page.waitForTimeout(170);
  assert.ok(draws > 0 && await page.evaluate(() => window.studyDraws) === draws, 'Paused study must stop drawing');
}
async function canvasImage(page) {
  return (await page.locator('#scene').screenshot({ scale: 'css' })).toString('base64');
}

// Compare actual rendered frames. The densest block of changed pixels locates
// the focused 3D marker. Matching interior hardware pixels check the camera and
// pose independently of the changing arc and stroke antialiasing.
async function compare(page, before, after) {
  return page.evaluate(async ([first, second]) => {
    const pixels = await Promise.all([first, second].map(async src => {
      const bmp = await createImageBitmap(await (await fetch('data:image/png;base64,' + src)).blob());
      const canvas = new OffscreenCanvas(bmp.width, bmp.height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bmp, 0, 0);
      bmp.close();
      return ctx.getImageData(0, 0, canvas.width, canvas.height);
    }));
    const [{ data: a, width, height }, { data: b, width: newWidth, height: newHeight }] = pixels;
    if (width !== newWidth || height !== newHeight) throw new Error('Switching layers changed the stage dimensions.');
    const emphasis = new Uint8Array(width * height);
    let interior = 0, preserved = 0, changed = 0;
    for (let i = 0; i < emphasis.length; i++) {
      const off = i * 4;
      const diff = Math.max(...[0, 1, 2].map(c => Math.abs(a[off+c] - b[off+c])));
      if (diff > 20) changed++;
      const newEmber = b[off] - b[off+1], oldEmber = a[off] - a[off+1];
      const darkening = (a[off]+a[off+1]+a[off+2]) - (b[off]+b[off+1]+b[off+2]);
      if ((newEmber > 35 && newEmber - oldEmber > 15) || (Math.abs(newEmber) < 30 && darkening > 70)) emphasis[i] = 1;
      if (a[off] < 160 && a[off+1] < 160 && a[off+2] < 160 && Math.max(a[off], a[off+1], a[off+2]) - Math.min(a[off], a[off+1], a[off+2]) < 35) {
        interior++;
        if (diff <= 8) preserved++;
      }
    }
    let best = 0, point;
    for (let y = 2; y < height-2; y++) for (let x = 2; x < width-2; x++) {
      if (!emphasis[y*width+x]) continue;
      let score = 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) score += emphasis[(y+dy)*width+x+dx];
      if (score > best) { best = score; point = { x, y }; }
    }
    return { changed, best, point, modelMatch: preserved / interior };
  }, [before, after]);
}

async function trackComparison(page, width) {
  const slider = page.locator('#progress');
  await slider.fill('520');
  await control(page, 'Single').click();
  assert.equal(await control(page, 'Single').getAttribute('aria-pressed'), 'true');
  await settled(page);
  const single = await canvasImage(page);
  await capture(page, width+'-single');
  await control(page, 'Layered').click();
  assert.equal(await control(page, 'Layered').getAttribute('aria-pressed'), 'true');
  await settled(page);
  assert.equal(await slider.inputValue(), '520');
  const layered = await canvasImage(page);
  const diff = await compare(page, single, layered);
  assert.ok(diff.changed > 50, 'Layered must add visible geometry');
  assert.ok(diff.modelMatch > .97, 'Track switch reframed or moved hardware: ' + JSON.stringify(diff));
  await capture(page, width+'-layered');
}

async function pickPose(page, touch, pose) {
  const target = control(page, pose.label);
  const slider = page.locator('#progress');
  const expected = Math.round(pose.progress*1000);
  // Use a different start pose. Focusing the text fallback alone must not seek.
  await slider.fill(pose.id === 'lift' ? '920' : '120');
  await page.keyboard.press('Tab');
  await control(page, 'Layered').focus();
  await page.mouse.move(1, 1);
  await settled(page);
  const normal = await canvasImage(page);
  await target.focus();
  await settled(page);
  const highlight = await compare(page, normal, await canvasImage(page));
  assert.ok(highlight.best >= 3, 'No visible focused 3D ' + pose.label + ' node: ' + JSON.stringify(highlight));
  const rect = await page.locator('#scene').boundingBox();
  const x = rect.x + highlight.point.x, y = rect.y + highlight.point.y;
  assert.ok(await page.evaluate(({x,y}) => document.elementFromPoint(x,y)?.id === 'scene', {x,y}));
  if (!touch) {
    await page.mouse.move(x, y);
    assert.equal(await target.getAttribute('data-hovered'), '');
  }
  if (pose.id === 'reach') {
    await page.locator('#playback').click();
    await page.waitForFunction(() => Number(document.querySelector('#progress').value) > 160);
    assert.equal(await page.locator('#playback').getAttribute('data-mode'), 'pause');
  }
  if (touch) await page.touchscreen.tap(x,y); else await page.mouse.click(x,y);
  await page.waitForFunction(value => Number(document.querySelector('#progress').value) === value, expected, { timeout: 3000 })
    .catch(error => { throw new Error(pose.label + ' pick at ' + x + ', ' + y + ' did not reach ' + expected, { cause: error }); });
  const mode = await page.locator('#playback').getAttribute('data-mode');
  assert.notEqual(mode, 'pause', 'Picking a pose pauses playback');
  assert.equal(await target.getAttribute('aria-pressed'), 'true');
  await settled(page);
  await slider.fill('110');
  if (touch) await target.tap(); else { await target.focus(); await page.keyboard.press('Enter'); }
  assert.equal(Number(await slider.inputValue()), expected);
}

async function inspect(width, height, touch) {
  const { context, page } = await open(width, height, touch, true);
  try {
    await page.waitForSelector('body[data-chapter="leg"][data-track-mode="layered"]');
    await settled(page);
    assert.equal(await page.locator('#progress').inputValue(), '0');
    for (const button of [control(page, 'Single'), control(page, 'Layered'), ...LEG_POSES.map(pose => control(page, pose.label))]) {
      const rect = await button.boundingBox();
      assert.ok(rect && rect.height >= 44 && rect.width >= 44, 'Reachable controls at ' + width);
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await trackComparison(page, width);
    for (const pose of LEG_POSES) await pickPose(page, touch, pose);
    const moved = await canvasImage(page);
    await page.locator('#scene').focus(); await page.keyboard.press('ArrowRight');
    await settled(page);
    assert.ok((await compare(page, moved, await canvasImage(page))).changed > 100, 'Manual camera control is available');
    await page.locator('#back-overview').click();
    await page.waitForSelector('body[data-chapter="overview"]');
    assert.ok(!await control(page, 'Layered').isVisible());
    const compressed = await page.evaluate(() => performance.getEntriesByType('resource').filter(r=>/\/model[^/]*\.gz$/.test(r.name)).length);
    assert.equal(compressed, 1);
    results.checks.push(width+'×'+height+' comparison, motion pose taps/clicks, fallback, idle WebGL, camera and chapter exit');
  } finally { await context.close(); }
}

async function autoplay() {
  const { context, page } = await open(1160,760,false,false);
  try {
    await page.waitForSelector('#playback[data-mode="replay"]', { timeout: 16000 });
    assert.equal(await page.locator('#progress').inputValue(), '1000');
    assert.equal(await page.locator('#timecode').innerText(), '2.5 s');
    await page.locator('#playback').click();
    await page.waitForFunction(() => Number(document.querySelector('#progress').value) > 15 && Number(document.querySelector('#progress').value) < 850);
    await page.locator('#playback').click();
    await settled(page);
    await page.locator('#progress').fill('450');
    assert.equal(await page.locator('#progress').inputValue(), '450');
    results.checks.push('Uninterrupted autoplay completes in the authored 2.5s timeline, replay, pause and scrubbing');
    for (const route of ['#leg','?study=leg-orbit#electronics']) {
      await page.goto(base+route); await page.waitForSelector('body[data-ready="true"]');
      assert.ok(!await control(page,'Layered').isVisible());
      assert.ok(!await control(page,'Lift').isVisible());
    }
    results.checks.push('Baseline and electronics chapter have no comparison controls');
  } finally { await context.close(); }
}
try {
  for (const [w,h,touch] of [[1440,900,false],[390,844,true],[844,390,true]]) await inspect(w,h,touch);
  await autoplay();
  assert.deepEqual(results.errors, []);
} catch (error) { results.failure = error.stack; process.exitCode = 1; }
finally {
  await browser.close();
  await writeFile(path.join(out,'report.json'),JSON.stringify(results,null,2)+'\n');
}
console.log(JSON.stringify(results,null,2));
