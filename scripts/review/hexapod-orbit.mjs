// Run against either a built repository subpath or the public Pages deployment.
// PLAYWRIGHT_MODULE=... node scripts/review/hexapod-orbit.mjs https://host/annora-explorer/ work/orbit-review
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const [base, out = 'work/hexapod-orbit-review'] = process.argv.slice(2);
if (!base?.endsWith('/')) throw new Error('Pass the Explorer HTTP URL including its trailing slash.');
const browser = await chromium.launch({ channel: 'chrome' });
const report = { base, browser: browser.version(), cases: [], errors: [] };
await mkdir(out, { recursive: true });
const label = { leg: 'Leg motion', electronics: 'Electronics' };
const demo = '?model=hexapod&presentation=1';
async function open(width, height, touch, suffix, reduce = true) {
  const context = await browser.newContext({
    viewport: { width, height }, deviceScaleFactor: touch ? 2 : 1, isMobile: touch, hasTouch: touch,
    reducedMotion: reduce ? 'reduce' : 'no-preference',
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !m.location().url.endsWith('/favicon.ico')) report.errors.push(m.text() + ' ' + m.location().url); });
  page.on('response', r => { if (r.status() >= 400) report.errors.push(r.status() + ' ' + r.url()); });
  await page.goto(base + suffix, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('body[data-ready="true"]', { timeout: 90000 });
  assert.equal(await page.locator('#scene canvas').count(), 1);
  return { page, context };
}
async function chapter(page, id) {
  await page.waitForSelector('body.orbital-demo[data-orbit-chapter="' + id + '"]');
  assert.equal(new URL(page.url()).searchParams.get('presentation'), '1');
  if (id !== 'overview') assert.equal(new URL(page.url()).hash, '#' + id);
}
async function free(page) {
  await page.waitForSelector('body:not(.orbital-demo) #tour-start:visible');
  assert.equal(new URL(page.url()).searchParams.has('presentation'), false);
}
const screenshot = (page, id) => page.screenshot({ path: path.join(out, id + '.png') });
async function selectTree(page, id) {
  await page.locator('#toggle-tree').click();
  await page.locator('.tree-select[data-node="' + id + '"]').click();
  await page.waitForSelector('body[data-selection="' + id + '"]');
  await page.locator('#close-tree').click();
}
// Use the rendered station itself. The public app does not expose a test-only picker.
async function renderedBead(page, approximate) {
  const png = await page.screenshot({ scale: 'css' });
  return await page.evaluate(async ({ data, approximate }) => {
    const bitmap = await createImageBitmap(await (await fetch('data:image/png;base64,' + data)).blob());
    const ctx = new OffscreenCanvas(bitmap.width, bitmap.height).getContext('2d');
    ctx.drawImage(bitmap, 0, 0);
    const { data: pixels, width, height } = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    bitmap.close();
    const mask = new Uint8Array(width * height);
    for (let i = 0; i < mask.length; i++) {
      const r = pixels[4*i], g = pixels[4*i + 1], b = pixels[4*i + 2];
      mask[i] = approximate ? r < 105 && g < 105 && g-r > 3 && g-b > 1 : r > 120 && r-g > 55 && r-b > 65;
    }
    let best = -Infinity, center;
    for (let y = 3; y < height - 3; y++) for (let x = 3; x < width - 3; x++) {
      if (!mask[y * width + x]) continue;
      const d = approximate ? Math.hypot(x - approximate.x, y - approximate.y) : 0;
      if (d > 105) continue;
      let coverage = 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) coverage += mask[(y + dy) * width + x + dx];
      if (coverage < 5) continue;
      const score = coverage - d / 6;
      if (score <= best || document.elementFromPoint(x, y)?.tagName !== 'CANVAS') continue;
      best = score; center = { x: x + 0.5, y: y + 0.5 };
    }
    if (!center) throw new Error('Station was not visible on the rendered canvas.');
    return center;
  }, { data: png.toString('base64'), approximate });
}
async function stationPoint(page, id) {
  await page.locator('#orbit-menu > summary').click();
  const option = page.locator('[data-orbit-target="' + id + '"]');
  await option.focus();
  await option.hover();
  await page.waitForFunction(text => document.querySelector('#orbit-caption')?.textContent.includes(text), label[id]);
  // The index changes the stage height. Identify the emphasized bead first,
  // then find its neutral center in the final, closed composition.
  const highlighted = await renderedBead(page);
  await page.keyboard.press('Escape');
  await page.mouse.move(2, 2);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const point = await renderedBead(page, highlighted);
  await page.mouse.move(point.x, point.y);
  await page.waitForFunction(text => document.querySelector('#orbit-caption')?.textContent.includes(text), label[id]);
  return point;
}
async function assertMotion(page) {
  const slider = page.locator('#orbit-progress');
  const play = page.locator('#orbit-play');
  const { min, max } = await slider.evaluate(el => ({ min: Number(el.min), max: Number(el.max) }));
  const pose = async fraction => {
    await slider.fill(String(Math.round(min + fraction * (max - min))));
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    // Compare the model alone, excluding the changing transport and explanation.
    const r = await page.locator('#scene canvas').boundingBox();
    return await page.screenshot({ clip: {
      x: Math.round(r.x + .15 * r.width), y: Math.round(r.y + .22 * r.height),
      width: Math.round(.7 * r.width), height: Math.round(.54 * r.height),
    } });
  };
  const firstPose = await pose(.03), secondPose = await pose(.61);
  assert.ok(!firstPose.equals(secondPose), 'The rendered mechanism must move when scrubbed.');
  await play.click();
  await page.waitForFunction(() => {
    const s = document.querySelector('#orbit-progress'); return Number(s.value) > Number(s.max) * .65;
  });
  await play.click();
  const paused = await slider.inputValue();
  await page.waitForTimeout(180);
  assert.equal(await slider.inputValue(), paused, 'Pause holds the pose');
  await slider.fill(String(max));
  await play.click();
  await page.waitForFunction(() => {
    const s = document.querySelector('#orbit-progress'); return Number(s.value) > 0 && Number(s.value) < .5 * Number(s.max);
  });
}
async function walkthrough(width, height, touch) {
  const { page, context } = await open(width, height, touch, '?model=hexapod');
  try {
    await selectTree(page, 'hex-leg-1');
    const originalCanvas = await page.locator('#scene canvas').elementHandle();
    await page.locator('#tour-start').click();
    await chapter(page, 'overview');
    assert.equal(await page.locator('#orbit-rotation').getAttribute('aria-pressed'), 'false');
    assert.equal(await page.locator('#toggle-tree').isVisible(), false);
    await page.waitForTimeout(400);
    const frames = () => page.locator('#scene').getAttribute('data-rendered-frames');
    const draws = await frames();
    await page.waitForTimeout(250);
    assert.ok(Number(draws) > 0 && draws === await frames(), 'Paused overview should stop rendering');
    await screenshot(page, width + '-overview');
    for (const id of ['leg', 'electronics']) {
      const pt = await stationPoint(page, id);
      if (touch) await page.touchscreen.tap(pt.x, pt.y); else await page.mouse.click(pt.x, pt.y);
      await chapter(page, id);
      await assertMotion(page);
      await screenshot(page, width + '-' + id);
      const back = page.locator('#orbit-back');
      assert.equal(await back.isVisible(), id === 'leg', 'The last chapter has one Whole model return.');
      await (id === 'leg' ? back : page.locator('#orbit-next')).click();
      await chapter(page, 'overview');
    }
    await page.locator('#orbit-exit').click();
    await free(page);
    assert.equal(await page.locator('body').getAttribute('data-selection'), 'hex-leg-1');
    assert.equal(await originalCanvas.evaluate(el => el === document.querySelector('#scene canvas')), true);
    await selectTree(page, 'hex-body');
    await page.locator('#tour-start').click(); await chapter(page, 'overview');
    await page.locator('#orbit-next').click(); await chapter(page, 'leg');
    await page.locator('#orbit-next').click(); await chapter(page, 'electronics');
    await page.goBack(); await chapter(page, 'leg');
    await page.goForward(); await chapter(page, 'electronics');
    await page.locator('#orbit-next').click(); await chapter(page, 'overview');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const files = await page.evaluate(() => performance.getEntriesByType('resource').map(r => new URL(r.name).pathname));
    assert.equal(files.filter(url => /\/model(?:\.[^/]+)?(?:-[A-Za-z0-9_-]+)?\.(?:glb|gz)$/.test(url)).length, 1, 'Use one model download');
    report.cases.push(width + '×' + height + ': actual 3D click/tap for each chapter, visible pose changes, play/pause/replay, same canvas, same selected part, tree navigation, chapter sequence and browser history.');
  } finally { await context.close(); }
}
async function landscapeMotion() {
  const { page, context } = await open(844, 390, true, demo, false);
  try {
    await chapter(page, 'overview');
    const rotation = page.locator('#orbit-rotation');
    assert.equal(await rotation.getAttribute('aria-pressed'), 'true');
    const stage = page.locator('#scene canvas');
    const center = await stage.boundingBox();
    const x = Math.round(center.x + center.width * .53), y = Math.round(center.y + center.height * .49);
    const session = await context.newCDPSession(page);
    for (const [type, dx] of [['touchStart', 0], ['touchMove', 25], ['touchMove', 62], ['touchEnd', 0]]) {
      await session.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: x + dx, y, id: 1 }] });
    }
    await session.detach();
    assert.equal(await rotation.getAttribute('aria-pressed'), 'false', 'Dragging takes over automatic rotation');
    await page.locator('#orbit-next').tap(); await chapter(page, 'leg');
    await page.waitForFunction(() => Number(document.querySelector('#orbit-progress').value) > 50);
    await page.locator('#orbit-next').tap(); await chapter(page, 'electronics');
    for (const id of ['orbit-play','orbit-progress','orbit-next','orbit-exit']) {
      const inside = await page.locator('#' + id).evaluate(el => {
        const r = el.getBoundingClientRect();
        return r.width >= 44 && r.height >= 44 && el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
      });
      assert.ok(inside, id + ' must be a reachable touch target in landscape');
    }
    await screenshot(page, '844-electronics');
    report.cases.push('844×390 touch: slow rotation, drag takeover, automatic leg playback, reachable electronics controls.');
  } finally { await context.close(); }
}
async function compatibility() {
  for (const [suffix, target] of [
    [demo + '#electronics', 'electronics'], [demo + '#leg', 'leg'],
    ['?model=open-duck&presentation=1', 'legacy'], ['?embed=1&model=hexapod&presentation=1', 'legacy'],
    [demo + '&guide=timeline', 'legacy'],
  ]) {
    const { page, context } = await open(920, 650, false, suffix);
    try {
      if (target === 'legacy') {
        await page.waitForSelector('body.tour-active #tour-panel');
        assert.equal(await page.locator('body.orbital-demo').count(), 0);
      } else {
        await chapter(page, target);
        await page.keyboard.press('Escape'); await chapter(page, 'overview');
        await page.keyboard.press('Escape'); await free(page);
        await selectTree(page, 'hex-leg-1');
      }
      report.cases.push(suffix + ' opens the intended player and navigation.');
    } finally { await context.close(); }
  }
}
try {
  await walkthrough(1440, 900, false);
  await walkthrough(390, 844, true);
  await landscapeMotion();
  await compatibility();
  assert.deepEqual(report.errors, []);
} catch (err) {
  report.failure = err.stack;
  process.exitCode = 1;
} finally {
  await browser.close();
  await writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify(report, null, 2));
