const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import { mkdir, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';

const repo = process.cwd();
const output = path.resolve(repo, process.env.OUT || 'work/workflow-map/browser');
const base = process.env.WORKFLOW_MAP_URL || 'http://127.0.0.1:8190/annora-explorer/workflows/';
await mkdir(output, { recursive: true });
const report = { url: base, startedAt: new Date().toISOString(), checks: [], screenshots: [], layouts: [], requests: [], errors: [], storageMutations: [] };
const check = (name, pass, detail) => { report.checks.push({name, pass: Boolean(pass), detail}); };
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: {width:1440,height:1000}, deviceScaleFactor:1 });
await context.exposeBinding('__recordStorageWrite', (_source, mutation) => report.storageMutations.push(mutation));
await context.addInitScript(() => {
  window.__storageWrites = [];
  for (const method of ['setItem','removeItem','clear']) {
    const original = Storage.prototype[method];
    Storage.prototype[method] = function(...args) { const mutation={method,args,store:this===localStorage?'local':'session'}; window.__storageWrites.push(mutation); window.__recordStorageWrite(mutation); return original.apply(this,args); };
  }
});
const page = await context.newPage();
page.on('pageerror', error => report.errors.push(String(error)));
page.on('console', message => { if (message.type()==='error') report.errors.push(message.text()); });
page.on('response', async response => {
  const request = response.request();
  const entry = {url:response.url(),type:request.resourceType(),status:response.status()};
  try { entry.bytes=(await response.body()).length; } catch {}
  report.requests.push(entry);
});
const shot = async (name, fullPage=false) => { const target=path.join(output,`${name}.png`); await page.screenshot({path:target,fullPage,animations:'disabled'}); report.screenshots.push({name,path:target}); };
const visit = async (hash='') => { await page.goto(`${base}${hash}`, {waitUntil:'networkidle'}); };
const opened = async kind => page.locator(`[data-disclosure="${kind}"][open]`).evaluateAll(nodes=>nodes.map(node=>node.id));
const inspectLayout = async name => {
  const value = await page.evaluate(() => {
    const width=innerWidth;
    const outOfBounds=[...document.querySelectorAll('body *')].filter(node=>node.getClientRects().length && getComputedStyle(node).position!=='fixed').map(node=>({tag:node.tagName, class:node.className?.baseVal??node.className, text:(node.textContent||'').trim().slice(0,80), left:node.getBoundingClientRect().left,right:node.getBoundingClientRect().right})).filter(box=>box.left< -1 || box.right > width+1);
    return {viewport:{width:innerWidth,height:innerHeight},scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,outOfBounds};
  });
  report.layouts.push({name,...value});
  check(`${name}: no horizontal overflow`,value.scrollWidth<=value.clientWidth+1 && value.outOfBounds.length===0,value);
};
try {
  await visit();
  await shot('desktop-1440-top');
  await shot('desktop-1440-full',true);
  check('Page is English',await page.locator('html').getAttribute('lang')==='en');
  check('Ten main steps',await page.locator('[data-disclosure="step"]').count()===10);
  check('Five branches, closed initially',await page.locator('[data-disclosure="branch"]').count()===5 && (await opened('branch')).length===0);
  check('Main steps closed initially',(await opened('step')).length===0);
  check('Main journey precedes branches',await page.locator('#journey').evaluate(node=>Boolean(node.compareDocumentPosition(document.querySelector('#branches')) & Node.DOCUMENT_POSITION_FOLLOWING)));
  const steps=await page.locator('[data-disclosure="step"]').evaluateAll(nodes=>nodes.map(node=>node.id));
  for (const id of steps) {
    await page.locator(`#${id}>summary`).click();
    const state=await opened('step');
    check(`Step opens exclusively: ${id}`,state.length===1 && state[0]===id && new URL(page.url()).hash===`#${id}`,state);
    check(`Step has visible explanation: ${id}`,await page.locator(`#${id} .step-body`).isVisible());
  }
  await page.locator('#agree-next-step').scrollIntoViewIfNeeded();
  await shot('desktop-expanded-step');
  const branches=await page.locator('[data-disclosure="branch"]').evaluateAll(nodes=>nodes.map(node=>node.id));
  for (const id of branches) {
    await page.locator(`#${id}>summary`).click();
    const state=await opened('branch');
    check(`Branch opens exclusively: ${id}`,state.length===1 && state[0]===id && new URL(page.url()).hash===`#${id}`,state);
    check(`Branch flow visible: ${id}`,await page.locator(`#${id} .branch-flow`).isVisible());
  }
  await visit('#clarify-scope');
  check('Direct branch link opens branch',(await opened('branch')).join(',')==='clarify-scope');
  await page.reload({waitUntil:'networkidle'});
  check('Branch survives reload',(await opened('branch')).join(',')==='clarify-scope');
  await shot('desktop-expanded-branch');
  await page.locator('#drawing-change>summary').click();
  await page.goBack();
  check('Back restores preceding branch',(await opened('branch')).join(',')==='clarify-scope',await opened('branch'));
  await page.locator('#clarify-scope>summary').click();
  check('Closing branch writes section hash',(await opened('branch')).length===0 && new URL(page.url()).hash==='#branches');
  await page.goBack();
  check('Back reopens closed branch',(await opened('branch')).join(',')==='clarify-scope');
  await visit('#confirm-inquiry');
  check('Direct step link opens step',(await opened('step')).join(',')==='confirm-inquiry');
  await page.reload({waitUntil:'networkidle'});
  check('Step survives reload',(await opened('step')).join(',')==='confirm-inquiry');
  await page.locator('#issue-v1>summary').click();
  await page.goBack();
  check('Back restores preceding step',(await opened('step')).join(',')==='confirm-inquiry');
  await page.locator('#confirm-inquiry>summary').click();
  check('Closing step writes journey hash',(await opened('step')).length===0 && new URL(page.url()).hash==='#journey');
  await page.locator('#demo-scope>summary').click();
  check('Demo scope opens',await page.locator('#demo-scope').getAttribute('open')!==null && await page.locator('#demo-scope p').first().isVisible());
  const linkSpecs=await page.locator('a[href]').evaluateAll(nodes=>nodes.map(node=>({href:node.href,text:node.textContent.trim(),target:node.target,rel:node.rel})));
  for (const item of linkSpecs) {
    const url=new URL(item.href);
    if (url.hash && url.origin===new URL(base).origin && url.pathname===new URL(base).pathname) continue;
    if (url.hostname==='github.com') {
      const rel=url.pathname.split('/blob/main/')[1];
      let exists=false; try { exists=(await stat(path.join(repo,rel))).isFile(); } catch {}
      check(`Source link exists: ${rel}`,exists);
    } else if (url.origin===new URL(base).origin) {
      const response=await context.request.get(url.href);
      check(`Example route responds: ${url.pathname}${url.search}${url.hash}`,response.status()===200,response.status());
    }
    check(`New-tab link is safe: ${item.text.slice(0,50)}`,item.target==='_blank' && item.rel.includes('noopener') && item.rel.includes('noreferrer'));
  }
  for (const [width,height] of [[1440,1000],[1280,900],[390,844],[320,740],[844,390]]) {
    await page.setViewportSize({width,height}); await visit();
    await inspectLayout(`${width}x${height} collapsed`);
    if (width!==1440) await shot(`${width}x${height}-top`);
    if (width===390 || width===320) await shot(`${width}x${height}-full`,true);
    await page.locator('#agree-next-step>summary').click();
    await inspectLayout(`${width}x${height} expanded step`);
    if (width===390) await shot('mobile-expanded-step');
    await page.locator('#clarify-scope>summary').click();
    await inspectLayout(`${width}x${height} expanded branch`);
    if (width===390) await shot('mobile-expanded-branch');
  }
  await page.setViewportSize({width:720,height:500}); await visit();
  await inspectLayout('200% equivalent layout (1440x1000 physical / 720x500 CSS)');
  await shot('zoom-200-layout');
  await page.locator('#clarify-scope>summary').click();
  await inspectLayout('200% equivalent expanded branch');
  await page.setViewportSize({width:1280,height:900}); await visit();
  await page.keyboard.press('Tab');
  check('First keyboard stop is skip link',await page.evaluate(()=>document.activeElement.className)==='skip-link');
  await shot('keyboard-skip-focus');
  await page.keyboard.press('Enter');
  check('Skip link focuses main',await page.evaluate(()=>document.activeElement.id)==='main');
  await page.locator('#explore-product>summary').focus();
  await page.keyboard.press('Enter');
  check('Enter opens step',(await opened('step')).join(',')==='explore-product');
  const outline=await page.locator('#explore-product>summary').evaluate(node=>({style:getComputedStyle(node).outlineStyle,width:getComputedStyle(node).outlineWidth}));
  check('Keyboard disclosure focus is visible',outline.style!=='none' && outline.width!=='0px',outline);
  await page.keyboard.press('Space');
  check('Space closes step',(await opened('step')).length===0);
  await page.locator('#contextual-inquiry>summary').focus();
  await page.keyboard.press('Enter');
  check('Enter opens branch',(await opened('branch')).join(',')==='contextual-inquiry');
  await page.keyboard.press('Space');
  check('Space closes branch',(await opened('branch')).length===0);
  await page.emulateMedia({reducedMotion:'reduce'});
  const motion=await page.locator('#explore-product>summary').evaluate(node=>({reduced:matchMedia('(prefers-reduced-motion:reduce)').matches,transition:getComputedStyle(node).transitionDuration,scroll:getComputedStyle(document.documentElement).scrollBehavior}));
  check('Reduced motion disables transitions',motion.reduced && motion.transition==='0s' && motion.scroll==='auto',motion);
  await page.emulateMedia({reducedMotion:'no-preference'});
  const beforePrint=await page.locator('details').evaluateAll(nodes=>nodes.map(node=>node.open));
  await page.evaluate(()=>dispatchEvent(new Event('beforeprint')));
  check('Print reveals all detail content',await page.locator('details:not([open])').count()===0);
  await page.evaluate(()=>dispatchEvent(new Event('afterprint')));
  check('Print restores screen disclosure state',JSON.stringify(await page.locator('details').evaluateAll(nodes=>nodes.map(node=>node.open)))===JSON.stringify(beforePrint));
  check('No canvas or iframe',await page.locator('canvas,iframe').count()===0);
  const storage=await page.evaluate(()=>({writes:window.__storageWrites,local:{...localStorage},session:{...sessionStorage}}));
  check('No browser storage mutations',report.storageMutations.length===0 && storage.writes.length===0 && Object.keys(storage.local).length===0 && Object.keys(storage.session).length===0,storage);
  const heavy=report.requests.filter(request=>request.bytes>1_000_000 || /\.(?:glb|gltf|fbx|obj|stl|step|stp)(?:[?#]|$)/i.test(request.url));
  check('No 3D or large downloads',heavy.length===0,heavy);
  check('No runtime or console errors',report.errors.length===0,report.errors);
} catch (error) {
  report.errors.push(String(error.stack||error));
  check('QA completed without unhandled exception',false,String(error));
} finally {
  report.finishedAt=new Date().toISOString();
  report.summary={passed:report.checks.filter(check=>check.pass).length,failed:report.checks.filter(check=>!check.pass).length};
  await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  await browser.close();
}
console.log(JSON.stringify({summary:report.summary,failures:report.checks.filter(check=>!check.pass),screenshots:report.screenshots.map(item=>item.name)},null,2));
process.exitCode=report.summary.failed?1:0;
