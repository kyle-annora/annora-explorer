// Optional release check. Provide Playwright via PLAYWRIGHT_MODULE or the normal module resolver.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2];
if (!base?.endsWith('/')) throw new Error('Pass the HTTP preview URL, including its trailing slash.');
const out = process.argv[3] || 'work/orbit-review';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = { base, browser: browser.version(), cases: [], errors: [] };
const station = (p, id) => p.locator('[data-chapter-target="' + id + '"]');
const slider = p => p.locator('#progress');
async function ready(page) {
  await page.waitForSelector('body[data-ready="true"]', { timeout: 60000 });
  assert.equal(await page.locator('canvas').count(), 1);
}
async function chapter(page, id) { await page.waitForSelector('body[data-chapter="' + id + '"]'); }
async function hit(page, selector) {
  return page.locator(selector).evaluate(el => {
    const r = el.getBoundingClientRect();
    return { width: r.width, height: r.height, hit: el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)) };
  });
}
async function open(width, height, touch, reduce, hash='') {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: touch ? 2 : 1, isMobile: touch, hasTouch: touch, reducedMotion: reduce ? 'reduce' : 'no-preference' });
  const p = await ctx.newPage();
  p.on('pageerror', e => report.errors.push(e.message));
  p.on('response', r => { if (r.status() >= 400) report.errors.push(r.status() + ' ' + r.url()); });
  // Observe actual WebGL draws without adding production diagnostics or a second clock.
  await p.addInitScript(() => {
    window.draws = 0;
    const proto = WebGL2RenderingContext.prototype;
    for (const name of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
      const original = proto[name];
      proto[name] = function(...args) {
        if (this.canvas.id === 'scene') window.draws++;
        return original.apply(this, args);
      };
    }
  });
  await p.goto(base + hash);
  await ready(p);
  return [ctx, p];
}
async function idle(p) {
  await p.waitForTimeout(200);
  const draws = await p.evaluate(() => window.draws);
  await p.waitForTimeout(260);
  assert.equal(await p.evaluate(() => window.draws), draws);
  assert.ok(draws > 0);
}
async function drag(p, touch=false) {
  const r = await p.locator('#scene').boundingBox();
  const x = Math.round(r.x + r.width / 2), y = Math.round(r.y + r.height / 2);
  if (touch) {
    const cdp = await p.context().newCDPSession(p);
    for (const [type, offset] of [['touchStart',0],['touchMove',28],['touchMove',54],['touchEnd',0]])
      await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x:x+offset,y,force:1,id:1}]});
    await cdp.detach();
  } else {
    await p.mouse.move(x,y); await p.mouse.down(); await p.mouse.move(x+65,y+12,{steps:6}); await p.mouse.up();
  }
}
async function viaIndex(p, id) {
  await p.locator('#index-trigger').click();
  await p.locator('[data-index-target="'+id+'"]').click();
}
async function enter(p, id) {
  if (await station(p,id).isVisible()) await station(p,id).click({ timeout: 1700 }).catch(() => viaIndex(p,id));
  else await viaIndex(p,id);
}
async function localChapter(p, id) {
  await enter(p,id);
  await chapter(p, id);
  assert.equal(await p.locator('#orbit-nav').evaluate(el => el.inert), true);
  await p.waitForFunction(() => Number(document.querySelector('#progress').value) > 80);
}
async function reviewDesktop() {
  const [ctx,p] = await open(1440,900,false,false);
  const rot = p.locator('#rotation');
  assert.equal(await rot.getAttribute('aria-pressed'), 'true');
  await rot.click(); await idle(p);
  await rot.click(); await drag(p); assert.equal(await rot.getAttribute('aria-pressed'),'false'); await idle(p);
  await p.screenshot({ path:path.join(out,'desktop-overview.png') });
  for (const id of ['leg','electronics']) {
    await localChapter(p,id);
    await p.locator('#playback').click();
    assert.equal(await p.locator('#playback').getAttribute('data-mode'),'play');
    await idle(p);
    await slider(p).fill('460');
    const at = await slider(p).inputValue();
    await p.waitForTimeout(150); assert.equal(await slider(p).inputValue(),at);
    await p.locator('#playback').click();
    await drag(p); assert.equal(await p.locator('#playback').getAttribute('data-mode'),'play');
    await slider(p).fill('990');
    await p.locator('#playback').click(); await p.waitForSelector('#playback[data-mode="replay"]');
    await idle(p); await p.screenshot({ path:path.join(out,'desktop-'+id+'.png') });
    await p.locator('#playback').click();
    await p.waitForFunction(()=>Number(document.querySelector('#progress').value)>100);
    assert.ok(Number(await slider(p).inputValue()) < 850);
    await p.keyboard.press('Escape'); await chapter(p,'overview');
    assert.ok(await p.evaluate(id => document.activeElement.dataset.chapterTarget === id || document.activeElement.id === 'index-trigger', id));
    await p.goForward(); await chapter(p,id);
    await p.locator('#back-overview').click(); await chapter(p,'overview');
  }
  const resources = await p.evaluate(()=>performance.getEntriesByType('resource').map(r=>r.name));
  assert.equal(resources.filter(x => /\/model.*\.gz$/.test(x)).length,1);
  assert.equal(resources.filter(x => /\/model.*\.glb$/.test(x)).length,0);
  assert.match(await (await p.request.get(base+'LICENSES.txt')).text(),/CERN Open Hardware/);
  report.cases.push('Desktop: three chapters, one compressed model, rotation, takeover, idle WebGL, scrub, replay, focus return, browser forward/back, credits');
  await ctx.close();
}
async function reviewMobile(width,height) {
  const [ctx,p]=await open(width,height,true,true);
  for (const id of ['overview','leg','electronics']) {
    const tag = station(p,id);
    if (await tag.isVisible()) {
      const stationHit = await hit(p, '[data-chapter-target="'+id+'"]');
      assert.ok(stationHit.height>=44 && stationHit.width>=44, 'station at '+width);
      if (stationHit.hit) await tag.tap();
      else await viaIndex(p,id);
    } else await viaIndex(p,id);
    await chapter(p,id);
    if(id!=='overview'){
      assert.equal(await p.locator('#playback').getAttribute('data-mode'),'play');
      for (const sel of ['#playback','#progress','#back-overview']) {
        const h=await hit(p,sel);assert.ok(h.height>=44 && h.hit, sel+' at '+width);
      }
      await slider(p).fill(id==='leg'?'480':'1000');
      await p.locator('#playback').tap(); await p.waitForFunction(()=>document.querySelector('#playback').dataset.mode==='pause');
      await drag(p,true);
      assert.equal(await p.locator('#playback').getAttribute('data-mode'), 'play');
      await slider(p).fill(id==='leg'?'480':'1000');
    } else {
      assert.equal(await p.locator('#rotation').getAttribute('aria-pressed'),'false');
      await p.locator('#rotation').tap(); await drag(p,true);
      assert.equal(await p.locator('#rotation').getAttribute('aria-pressed'),'false');
    }
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await p.screenshot({path:path.join(out,width+'-'+id+'.png')});
    if(id!=='overview'){await p.locator('#back-overview').tap();await chapter(p,'overview');}
  }
  report.cases.push(width+'×'+height+': actual touch events, all three chapter targets, reduced motion, scrub/takeover, portrait or landscape layout');
  await ctx.close();
}
// Read the physical anchor from its adjacent projected label, then bypass the
// label entirely. The DOM element at the exact pick coordinate must be canvas.
async function projectedNode(p,id) {
  return station(p,id).evaluate(el=>{
    const rect=document.querySelector('#scene').getBoundingClientRect();
    return {x:rect.left+parseFloat(el.style.left)+(el.dataset.side.endsWith('left')?8:-8),y:rect.top+parseFloat(el.style.top)};
  });
}
async function spatialControls(width,height,touch=false) {
  const [ctx,p]=await open(width,height,touch,true);
  const node=await projectedNode(p,'leg');
  assert.ok(await p.evaluate(({x,y})=>document.elementFromPoint(x,y)?.id==='scene',node));
  if (touch) await p.touchscreen.tap(node.x,node.y); else await p.mouse.click(node.x,node.y);
  await chapter(p,'leg'); await p.locator('#back-overview').click(); await chapter(p,'overview');
  const before=await projectedNode(p,'leg');
  await p.locator('#scene').focus(); await p.keyboard.press('ArrowRight');
  await p.waitForTimeout(100);
  const after=await projectedNode(p,'leg');
  assert.ok(Math.hypot(after.x-before.x,after.y-before.y)>2, 'station must travel with camera');
  if(!touch){
    await p.mouse.move(after.x,after.y); await p.mouse.down();
    await p.mouse.move(after.x+85,after.y+16,{steps:8}); await p.mouse.up(); await chapter(p,'overview');
    await viaIndex(p,'leg'); await chapter(p,'leg');
    await viaIndex(p,'electronics'); await chapter(p,'electronics');
    await p.locator('#back-overview').click(); await chapter(p,'overview');
  }
  report.cases.push(width+'px: direct 3D bead pick, perspective tracking and index navigation');await ctx.close();
}
async function deepLink() {
  const [ctx,p] = await open(960,700,false,true,'#electronics');
  await chapter(p,'electronics'); await slider(p).focus(); await p.keyboard.press('End');
  assert.equal(await slider(p).inputValue(),'1000');
  await p.locator('#back-overview').click(); await chapter(p,'overview');
  assert.equal(new URL(p.url()).hash,'');
  await p.locator('#scene').focus(); await p.keyboard.press('ArrowRight'); await idle(p);
  report.cases.push('Direct electronics entry, keyboard seek and orbit, safe return to overview');await ctx.close();
}
try {
  await reviewDesktop();
  for(const [w,h] of [[320,568],[390,844],[844,390]]) await reviewMobile(w,h);
  await spatialControls(1440,900); await spatialControls(390,844,true);
  await deepLink(); assert.deepEqual(report.errors,[]);
} catch(error) { report.failure=error.stack; process.exitCode=1; }
finally {await browser.close();await writeFile(path.join(out,'qa.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report,null,2));
