/** Fixed guide / floating inquiry geometry qualification. Requires the browser lease.
 * BASE_URL includes the deployed repository subpath. Every profile starts with
 * a fresh browser context and reaches review through the actual guide controls.
 * Optional EMULATE_VISUAL_VIEWPORT=1 tests a synthetic 390x540 visual viewport
 * inside the 390x844 layout viewport. It is geometry emulation, not a real keyboard.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = new URL(process.env.BASE_URL || 'http://127.0.0.1:8190/annora-explorer/');
if (!base.pathname.endsWith('/')) base.pathname += '/';
const out = path.resolve(process.env.OUT || 'work/commercial-polish/guide-layout');
const requested = new Set((process.env.PROFILES || 'intermediate,landscape,mobile,compact').split(','));
const profiles = [
  { name:'intermediate', width:700, height:900 },
  { name:'landscape', width:844, height:390, isMobile:true, hasTouch:true },
  { name:'mobile', width:390, height:844, isMobile:true, hasTouch:true },
  { name:'compact', width:320, height:568, isMobile:true, hasTouch:true },
].filter(profile => requested.has(profile.name));
assert.ok(profiles.length, 'Select intermediate, landscape, mobile or compact');
await fs.mkdir(out, { recursive:true });
const browser = await chromium.launch({ channel:'chrome', headless:true });
const results = [];

async function run(profile) {
  const dir = path.join(out, profile.name);
  await fs.mkdir(dir, { recursive:true });
  const context = await browser.newContext({
    viewport:{ width:profile.width, height:profile.height }, deviceScaleFactor:1,
    isMobile:Boolean(profile.isMobile), hasTouch:Boolean(profile.hasTouch),
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  let stage = 'entry', namespace, sessionId;
  const errors = [], checkpoints = [], advances = [], emulations = [];
  page.on('pageerror', error => errors.push({ stage, message:error.message }));
  const store = () => page.evaluate(key => JSON.parse(localStorage.getItem(key) || '{"drafts":[],"projects":[]}'), namespace);
  const waitStep = step => page.waitForFunction(step => {
    const action = document.querySelector('.wt-handoff');
    return action?.dataset.step === step && !action.disabled && action.getAttribute('aria-busy') !== 'true';
  }, step, { timeout:90000 });
  const settle = async () => {
    await page.waitForFunction(() => {
      const style = getComputedStyle(document.documentElement);
      return parseFloat(style.getPropertyValue('--walkthrough-height')) > 0
        && parseFloat(style.getPropertyValue('--walkthrough-action-height')) > 0;
    });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  };
  async function pointerTarget(locator) {
    return locator.evaluate(element => {
      const r = element.getBoundingClientRect();
      const target = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return { x:r.x, y:r.y, top:r.top, bottom:r.bottom, left:r.left, right:r.right,
        width:r.width, height:r.height, hit:element === target || element.contains(target),
        hitElement:target ? `${target.tagName.toLowerCase()}.${target.className?.baseVal || target.className || ''}` : null };
    });
  }
  async function advance(from, to) {
    stage = `advance-${from}`;
    await waitStep(from);
    const action = page.locator('.wt-handoff');
    assert.equal(await action.getAttribute('data-confirmation'), 'false', `${from}: this step cannot confirm`);
    assert.equal(await page.locator('.wt-handoff:visible').count(), 1, `${from}: one guide action`);
    const geometry = await pointerTarget(action);
    assert.ok(geometry.width >= 44 && geometry.height >= 44, `${from}: 44px action target`);
    assert.equal(geometry.hit, true, `${from}: pointer reaches the actual guide action`);
    await action.click();
    await waitStep(to);
    advances.push({ from, to });
  }
  async function checkpoint(name, expectedStage, { emulated = false } = {}) {
    stage = name;
    await page.locator(`.ei-panel[data-stage="${expectedStage}"]`).waitFor();
    await page.locator('.ei-scroll').evaluate(element => { element.scrollTop = 0; });
    await settle();
    const geometry = await page.evaluate(() => {
      const bounds = selector => {
        const element = document.querySelector(selector), r = element.getBoundingClientRect();
        return { top:r.top, bottom:r.bottom, left:r.left, right:r.right, width:r.width, height:r.height };
      };
      const scroll = document.querySelector('.ei-scroll');
      return {
        panel:bounds('.ei-panel'), strip:bounds('.walkthrough-strip'), bar:bounds('.wt-actionbar'),
        scroll:{ clientHeight:scroll.clientHeight, scrollHeight:scroll.scrollHeight, clientWidth:scroll.clientWidth, scrollWidth:scroll.scrollWidth },
        viewport:{ width:innerWidth, height:innerHeight, visualHeight:visualViewport?.height ?? innerHeight, visualOffsetTop:visualViewport?.offsetTop ?? 0 },
        documentWidth:document.documentElement.scrollWidth,
        stage:document.querySelector('.ei-panel').dataset.stage,
        confirmation:document.querySelector('.wt-handoff').dataset.confirmation,
      };
    });
    const control = await pointerTarget(page.locator('.wt-handoff'));
    // Save the evidence before assertions so failed geometry is reviewable.
    await page.screenshot({ path:path.join(dir, `${name}.png`), animations:'disabled' });
    const entry = { name, url:page.url(), geometry, control, emulated };
    checkpoints.push(entry);
    assert.ok(geometry.scroll.clientHeight >= 100, `${name}: inquiry reading area is at least 100px (${geometry.scroll.clientHeight}px)`);
    assert.ok(control.width >= 44 && control.height >= 44, `${name}: guide action is at least 44x44px`);
    assert.equal(control.hit, true, `${name}: action center is unobscured`);
    assert.ok(geometry.panel.bottom <= geometry.bar.top + 1, `${name}: panel footer clears guide bar`);
    assert.ok(geometry.panel.top >= geometry.strip.bottom - 1, `${name}: panel header clears top guide`);
    assert.ok(geometry.documentWidth <= geometry.viewport.width + 1, `${name}: no page horizontal overflow`);
    assert.ok(geometry.scroll.scrollWidth <= geometry.scroll.clientWidth + 1, `${name}: no inquiry horizontal overflow`);
    assert.ok(geometry.panel.left >= -1 && geometry.panel.right <= geometry.viewport.width + 1, `${name}: panel stays within layout viewport`);
    assert.ok(geometry.bar.bottom <= geometry.viewport.visualOffsetTop + geometry.viewport.visualHeight + 1, `${name}: guide bar stays above the visual viewport bottom`);
    assert.equal(geometry.confirmation, expectedStage === 'review' ? 'true' : 'false', `${name}: visible stage retains its confirmation boundary`);
    console.log(`${profile.name}: ${name}`);
  }
  async function inspectGuide(name) {
    stage = name;
    const summary = page.locator('.wt-tools > summary');
    await summary.click();
    await page.locator('.wt-tools[open] .wt-restart').waitFor();
    const restart = page.getByRole('button', { name:'Start a new sample', exact:true });
    await restart.scrollIntoViewIfNeeded();
    await settle();
    const control = await pointerTarget(restart);
    const geometry = await page.evaluate(() => {
      const menu = document.querySelector('.wt-menu'), r = menu.getBoundingClientRect();
      return { menu:{ top:r.top, bottom:r.bottom, left:r.left, right:r.right, width:r.width, clientHeight:menu.clientHeight, scrollHeight:menu.scrollHeight, scrollTop:menu.scrollTop },
        actionTop:document.querySelector('.wt-actionbar').getBoundingClientRect().top,
        documentWidth:document.documentElement.scrollWidth, viewportWidth:innerWidth };
    });
    await page.screenshot({ path:path.join(dir, `${name}.png`), animations:'disabled' });
    checkpoints.push({ name, url:page.url(), control, geometry, restartClicked:false });
    assert.ok(control.width >= 44 && control.height >= 44, `${name}: last guide control retains a 44px target`);
    assert.equal(control.hit, true, `${name}: pointer reaches last guide control after menu scrolling`);
    assert.ok(control.top >= geometry.menu.top - 1 && control.bottom <= geometry.menu.bottom + 1, `${name}: last control is inside the menu scrollport`);
    assert.ok(control.bottom <= geometry.actionTop + 1, `${name}: last guide control is fully above the action bar`);
    assert.ok(geometry.menu.left >= -1 && geometry.menu.right <= geometry.viewportWidth + 1, `${name}: the whole guide menu stays within horizontal viewport bounds`);
    assert.ok(geometry.documentWidth <= geometry.viewportWidth + 1, `${name}: guide introduces no horizontal overflow`);
    // Focus and Escape exercise access without activating the destructive restart.
    await restart.focus();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.wt-tools[open]').count(), 0, `${name}: Escape closes Guide`);
    assert.equal(await summary.evaluate(element => document.activeElement === element), true, `${name}: Escape restores summary focus`);
    console.log(`${profile.name}: ${name}`);
  }
  async function inspectReviewEnd(name) {
    stage = name;
    const note = page.locator('.ei-review .ei-confirm-note');
    await note.scrollIntoViewIfNeeded();
    await settle();
    const reading = await note.evaluate(element => {
      const scroll = document.querySelector('.ei-scroll'), r = scroll.getBoundingClientRect(), n = element.getBoundingClientRect();
      return { text:element.textContent, fontSize:parseFloat(getComputedStyle(element).fontSize),
        note:{ top:n.top, bottom:n.bottom }, scroll:{ top:r.top, bottom:r.bottom, scrollTop:scroll.scrollTop, clientHeight:scroll.clientHeight },
        values:[...document.querySelectorAll('.ei-specifications dd')].map(value => ({ text:value.textContent, fontSize:parseFloat(getComputedStyle(value).fontSize) })) };
    });
    await page.screenshot({ path:path.join(dir, `${name}.png`), animations:'disabled' });
    checkpoints.push({ name, url:page.url(), reading });
    assert.ok(reading.note.top >= reading.scroll.top - 1 && reading.note.bottom <= reading.scroll.bottom + 1, `${name}: the final review consequence is fully readable after scrolling`);
    assert.ok(reading.scroll.scrollTop > 0, `${name}: the inner inquiry scroll reaches later review content`);
    assert.match(reading.text, /Engineering suitability/, `${name}: the engineering review condition remains visible`);
    assert.ok(reading.values.length > 0 && reading.values.every(value => value.fontSize >= 14), `${name}: reviewed specifications retain readable type`);
    console.log(`${profile.name}: ${name}`);
  }
  async function emulateVisualViewport() {
    if (process.env.EMULATE_VISUAL_VIEWPORT !== '1' || profile.name !== 'mobile') return;
    stage = 'visual-viewport-emulation';
    const emulation = await page.evaluate(() => {
      const viewport = window.visualViewport;
      if (!viewport) return { status:'skipped', reason:'VisualViewport is unavailable' };
      const originalHeight = Object.getOwnPropertyDescriptor(viewport, 'height');
      const originalOffset = Object.getOwnPropertyDescriptor(viewport, 'offsetTop');
      try {
        Object.defineProperty(viewport, 'height', { configurable:true, get:() => 540 });
        Object.defineProperty(viewport, 'offsetTop', { configurable:true, get:() => 0 });
      } catch (error) {
        if (originalHeight) Object.defineProperty(viewport, 'height', originalHeight); else delete viewport.height;
        if (originalOffset) Object.defineProperty(viewport, 'offsetTop', originalOffset); else delete viewport.offsetTop;
        return { status:'skipped', reason:error.message };
      }
      window.__restoreGuideLayoutViewport = () => {
        if (originalHeight) Object.defineProperty(viewport, 'height', originalHeight); else delete viewport.height;
        if (originalOffset) Object.defineProperty(viewport, 'offsetTop', originalOffset); else delete viewport.offsetTop;
        viewport.dispatchEvent(new Event('resize'));
        viewport.dispatchEvent(new Event('scroll'));
        delete window.__restoreGuideLayoutViewport;
      };
      viewport.dispatchEvent(new Event('resize'));
      viewport.dispatchEvent(new Event('scroll'));
      return { status:'emulated', layoutHeight:innerHeight, visualHeight:viewport.height, visualOffsetTop:viewport.offsetTop,
        limitation:'Synthetic VisualViewport getters/events only. Screenshot includes the full layout viewport; no actual keyboard or physical device was used.' };
    });
    emulations.push(emulation);
    if (emulation.status !== 'emulated') return;
    try {
      await checkpoint('05-review-visual-viewport-emulation', 'review', { emulated:true });
      await inspectGuide('06-guide-visual-viewport-emulation');
    } finally {
      await page.evaluate(() => window.__restoreGuideLayoutViewport?.());
      await settle();
    }
  }
  try {
    await page.goto(new URL('walkthrough/?viewer=independent&new=1', base).href, { waitUntil:'domcontentloaded' });
    await waitStep('independent-select');
    sessionId = new URL(page.url()).searchParams.get('walkthrough');
    assert.ok(sessionId, 'Fresh walkthrough has an isolated session');
    namespace = `annora.walkthrough.independent.projects.v1.${sessionId}`;
    await advance('independent-select', 'inquiry-open');
    await advance('inquiry-open', 'inquiry-review');
    await checkpoint('01-inquiry-details', 'details');
    await inspectGuide('02-guide-details');
    const initial = await store(), pinned = initial.drafts[0]?.context;
    assert.equal(initial.projects.length, 0, 'Opening an inquiry creates no confirmed project');
    assert.equal(pinned?.part?.title, 'Connecting rod', 'The real guide attaches the selected part');
    await advance('inquiry-review', 'inquiry-confirm');
    await checkpoint('03-inquiry-review', 'review');
    const reviewed = await store();
    assert.equal(reviewed.projects.length, 0, 'Review cannot automatically confirm');
    assert.deepEqual(reviewed.drafts[0].context, pinned, 'Review preserves the exact attached reference');
    assert.ok(reviewed.drafts[0].values.application?.trim(), 'The guide populated the sample application');
    assert.ok(Number(reviewed.drafts[0].values.quantity) > 0, 'The guide populated sample quantity');
    await inspectReviewEnd('03b-inquiry-review-end');
    await inspectGuide('04-guide-review');
    await emulateVisualViewport();
    assert.deepEqual(errors, [], 'No uncaught browser errors');
    const result = { status:'passed', profile, base:base.href, timestamp:new Date().toISOString(), sessionId,
      advances, checkpoints, emulations, errors,
      limitations:'Isolated headless Chromium viewport/touch emulation, not physical-device or operating-system keyboard validation. No inquiry was confirmed.' };
    await fs.writeFile(path.join(dir, 'result.json'), JSON.stringify(result, null, 2));
    results.push({ profile:profile.name, status:'passed', checkpoints:checkpoints.length, emulations });
  } catch (error) {
    await page.screenshot({ path:path.join(dir, 'failure.png'), animations:'disabled' }).catch(() => {});
    await fs.writeFile(path.join(dir, 'failure.json'), JSON.stringify({ status:'failed', profile, stage,
      url:page.url(), error:{ message:error.message, stack:error.stack }, advances, checkpoints, emulations, errors,
      body:await page.locator('body').innerText().catch(() => ''), store:namespace ? await store().catch(() => null) : null }, null, 2));
    results.push({ profile:profile.name, status:'failed', stage, message:error.message });
    console.error(`${profile.name}: ${error.message}`);
  } finally { await context.close(); }
}

try { for (const profile of profiles) await run(profile); }
finally {
  await fs.writeFile(path.join(out, 'summary.json'), JSON.stringify({ base:base.href, results }, null, 2));
  await browser.close();
}
console.log(JSON.stringify(results, null, 2));
if (results.some(result => result.status !== 'passed')) process.exitCode = 1;
