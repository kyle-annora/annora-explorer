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
const slider = p => p.locator('#progress');
async function ready(page) {
  await page.waitForSelector('body[data-ready="true"]', { timeout: 60000 });
  assert.equal(await page.locator('canvas').count(), 1);
  assert.equal(await page.locator('.visual-stage button, .visual-stage nav').count(), 0);
  assert.equal(await page.locator('.visual-stage').innerText(), '');
  assert.equal(await page.locator('#orbit-caption').evaluate(el => !el.closest('.visual-stage')), true);
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
async function localChapter(p, id) {
  await viaIndex(p, id);
  await chapter(p, id);
  assert.equal(await p.locator('#orbit-caption').isVisible(), false);
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
    assert.equal(await p.evaluate(() => document.activeElement.id), 'index-trigger');
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
    await p.locator('#index-trigger').tap();
    const link = '[data-index-target="'+id+'"]';
    const item = await hit(p, link);
    assert.ok(item.height>=44 && item.width>=44 && item.hit, 'Chapter target at ' + width);
    await p.locator(link).tap();
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
// Find a tangible station from the rendered stage, the way a sighted visitor
// can locate it. Focus through the index, capture its Ember emphasis, then
// close the menu and use a real pointer or touch on the canvas.
async function locateLeg(p) {
  const caption = p.locator('#orbit-caption');
  const canvas = p.locator('#scene');
  await p.locator('#index-trigger').focus();
  await p.keyboard.press('Enter');
  await p.keyboard.press('Tab');
  await p.keyboard.press('Tab');
  assert.equal(await p.evaluate(() => document.activeElement.dataset.indexTarget), 'leg');
  await p.waitForFunction(() => document.querySelector('#orbit-caption').textContent.trim() === 'Leg motion');
  const rect = await canvas.boundingBox();
  const menu = await p.locator('#chapter-list').boundingBox();
  const bytes = await canvas.screenshot({ scale: 'css' });
  const node = await p.evaluate(async ({data,rect,menu}) => {
    const bitmap = await createImageBitmap(await (await fetch('data:image/png;base64,'+data)).blob());
    const surface = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = surface.getContext('2d');
    ctx.drawImage(bitmap,0,0);
    const {data:pixels,width,height}=ctx.getImageData(0,0,bitmap.width,bitmap.height);
    bitmap.close();
    const mask = new Uint8Array(width*height);
    for(let i=0;i<mask.length;i++){
      const r=pixels[4*i],g=pixels[4*i+1],b=pixels[4*i+2];
      mask[i]=Number(r>125 && r-g>55 && r-b>70);
    }
    // The station's filled bead produces a compact patch, while the fine
    // adjacent track and leader draw only one or two pixels across.
    let best=0, position=null;
    for(let y=3;y<height-3;y++) for(let x=3;x<width-3;x++){
      if(!mask[y*width+x]) continue;
      const sx=rect.x+x,sy=rect.y+y;
      if(sx>=menu.x && sx<=menu.x+menu.width && sy>=menu.y && sy<=menu.y+menu.height)continue;
      let score=0;
      for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++)score+=mask[(y+dy)*width+x+dx];
      if(score>best){best=score;position={x:sx+.5,y:sy+.5};}
    }
    if(best<8) throw new Error('Could not find the emphasized station on the rendered track');
    return position;
  },{data:bytes.toString('base64'),rect,menu});
  await p.keyboard.press('Escape');
  assert.equal(await p.locator('#chapter-menu').getAttribute('open'),null);
  await p.mouse.move(1,1);
  await p.waitForFunction(() => document.querySelector('#orbit-caption').textContent.trim() !== 'Leg motion');
  assert.match(await caption.innerText(), /orbit/i);
  // Opening the index may reduce canvas height. At constant vertical FOV,
  // points expand from the image center in proportion to the new height.
  const closed = await canvas.boundingBox();
  const scale = closed.height / rect.height;
  const target={
    x:closed.x+closed.width/2+(node.x-rect.x-rect.width/2)*scale,
    y:closed.y+(node.y-rect.y)*scale,
  };
  assert.equal(await p.evaluate(({x,y})=>document.elementFromPoint(x,y)?.id,target),'scene');
  return target;
}
async function spatialControls(width,height,touch=false) {
  const [ctx,p]=await open(width,height,touch,true);
  const node=await locateLeg(p);
  if(touch) {
    await p.touchscreen.tap(node.x,node.y);
  } else {
    await p.mouse.move(node.x,node.y);
    await p.waitForFunction(() => document.querySelector('#orbit-caption').textContent.trim() === 'Leg motion');
    await p.mouse.click(node.x,node.y);
  }
  await chapter(p,'leg');
  await p.locator('#back-overview').click(); await chapter(p,'overview');
  await p.locator('#scene').focus();
  await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowRight');
  await p.waitForTimeout(100);
  const moved=await locateLeg(p);
  assert.ok(Math.hypot(moved.x-node.x,moved.y-node.y)>5, 'station should move with the camera');
  if(!touch){
    await p.mouse.move(moved.x,moved.y); await p.mouse.down();
    await p.mouse.move(moved.x+80,moved.y+10,{steps:8}); await p.mouse.up();
    await chapter(p,'overview');
    await viaIndex(p,'leg'); await chapter(p,'leg');
    await viaIndex(p,'electronics'); await chapter(p,'electronics');
    await p.locator('#back-overview').click(); await chapter(p,'overview');
  }
  report.cases.push(width+'px: unobstructed canvas, exterior caption, rendered station tracking and direct '+(touch?'one-tap touch':'mouse pick'));
  await ctx.close();
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
