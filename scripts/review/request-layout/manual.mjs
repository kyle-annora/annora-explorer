/** Ordinary-workspace request editing/review acceptance. Fictional records only. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { nativeCommercialFixture } from '../commercial-layout/native-fixture.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = new URL(process.env.BASE_URL || 'http://127.0.0.1:8190/annora-explorer/');
if (!base.pathname.endsWith('/')) base.pathname += '/';
const out = path.resolve(process.env.OUT || 'work/request-layout/manual');
const requested = new Set((process.env.PROFILES || 'desktop,mobile,compact,landscape').split(','));
const profiles = [
  { name:'desktop', width:1280, height:900 },
  { name:'mobile', width:390, height:844, isMobile:true, hasTouch:true },
  { name:'compact', width:320, height:740, isMobile:true, hasTouch:true },
  { name:'landscape', width:844, height:390, isMobile:true, hasTouch:true },
].filter(profile => requested.has(profile.name));
const nativeContext = {productId:'kinetic-01',productTitle:'Crank-slider mechanism',modelId:'kinetic-01',modelRevision:'sha256:6b8de14cd5f65835670aa6bf8b1f3b42f8d46f2192601d9c852c06e5564572b9',part:{id:'kinetic-node-001',title:'Connecting rod'}};
await fs.mkdir(out, {recursive:true});
const browser = await chromium.launch({channel:'chrome',headless:true});
const results = [];

async function run(profile) {
  const context = await browser.newContext({viewport:{width:profile.width,height:profile.height},deviceScaleFactor:1,isMobile:Boolean(profile.isMobile),hasTouch:Boolean(profile.hasTouch)});
  const page = await context.newPage(); page.setDefaultTimeout(30000);
  const dir = path.join(out,profile.name); await fs.mkdir(dir,{recursive:true});
  const errors=[], checkpoints=[]; let stage='entry';
  page.on('pageerror',error => errors.push({stage,message:error.message}));
  let key='annora.drawing-preview.projects.v1';
  const store=() => page.evaluate(key=>JSON.parse(localStorage.getItem(key)||'{"projects":[],"drafts":[]}'),key);
  const primary=() => page.locator('.ar-project-primary:visible button').first();
  async function click(locator) {
    await locator.scrollIntoViewIfNeeded();
    assert.equal(await locator.evaluate(el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return el===hit||el.contains(hit);}),true,`${stage}: pointer reaches action`);
    await locator.click();
  }
  async function checkpoint(name,{floating=false,recordVersion}={}) {
    stage=name;
    assert.equal(await page.locator('.wt-handoff:visible').count(),0,`${name}: standalone workspaces do not require the guide`);
    assert.equal(await page.locator('.ar-project-context:visible').count(),1,`${name}: one project context`);
    assert.equal(await page.locator('.ar-project-primary:visible').count(),1,`${name}: native primary remains available`);
    assert.equal(await page.locator('.pw-progress:visible,.ei-progress:visible').count(),0,`${name}: no redundant stepper`);
    assert.equal(await page.locator('.ar-project-task h1:visible,.ei-task h2:visible').count(),1,`${name}: one task title`);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${name}: no horizontal overflow`);
    if(recordVersion) assert.match(await page.locator('.ar-project-context').getAttribute('data-record-label'),new RegExp(`v${recordVersion}\\b`),`${name}: exact quotation reference`);
    await primary().scrollIntoViewIfNeeded();
    const control=await primary().evaluate(el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{width:r.width,height:r.height,hit:el===hit||el.contains(hit)};});
    assert.ok(control.width>=44&&control.height>=44,`${name}: minimum touch target`);assert.equal(control.hit,true,`${name}: primary is not obscured`);
    if(floating)await page.locator('.ei-scroll').evaluate(el=>{el.scrollTop=0;});else await page.evaluate(()=>scrollTo(0,0));
    await page.screenshot({path:path.join(dir,`${name}.png`),animations:'disabled'});
    if(!floating)await page.screenshot({path:path.join(dir,`${name}-full.png`),animations:'disabled',fullPage:true});
    checkpoints.push({name,url:page.url(),recordVersion,control});console.log(`${profile.name}: ${name}`);
  }
  async function seed(data,url) {
    await page.goto(new URL('product-room/?model=kinetic-01#projects',base).href,{waitUntil:'domcontentloaded'});
    await page.evaluate(({key,data})=>{sessionStorage.clear();localStorage.setItem(key,JSON.stringify(data));},{key,data});
    await page.goto(new URL(url,base).href,{waitUntil:'domcontentloaded'});
    await page.locator('.ar-project-context').waitFor();
  }
  try {
    // Product Room opens its floating host; the original full-page form remains
    // exposed by the drawing host with its own properly versioned repository.
    await page.goto(new URL('drawing-preview/?product=sk08&detail=shaft-bore&view=drawings#inquiry',base).href,{waitUntil:'domcontentloaded'});
    await page.locator('#pw-inquiry-form').waitFor();
    await click(primary());
    await page.locator('[aria-invalid="true"]').first().waitFor();
    assert.equal((await store()).projects.length,0,'Invalid inquiry cannot create a project');
    await checkpoint('01-native-inquiry-validation');
    await click(page.getByRole('button',{name:'Use sample details',exact:true}));
    assert.equal(await page.locator('.room-workspace [aria-invalid="true"]').count(),0,'Sample replacement clears stale field validation');
    assert.equal(await page.locator('.room-workspace [role="alert"]').count(),0,'Valid sample does not retain the old validation alert');
    await checkpoint('02-native-inquiry-fill');
    const application=await page.locator('[name="application"]').inputValue();
    const drawingContext=structuredClone((await store()).drafts[0].context);
    await click(primary());
    await page.getByRole('heading',{name:'Check your request.',exact:true}).waitFor();
    assert.equal((await store()).projects.length,0,'Inquiry review does not confirm');
    await checkpoint('03-native-inquiry-review');
    await click(page.getByRole('button',{name:/Edit requirements/}));
    assert.equal(await page.locator('[name="application"]').inputValue(),application,'Review/edit retains inquiry');
    await click(primary());await page.getByRole('heading',{name:'Check your request.',exact:true}).waitFor();await click(primary());
    await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)||'{"projects":[]}').projects.length===1,key);
    const inquiry=(await store()).projects[0];assert.equal(inquiry.inquiry.values.application,application);
    assert.deepEqual(inquiry.context,drawingContext,'Native inquiry preserves its exact model, drawing, mapping and overview versions');
    assert.equal(inquiry.context.drawing.regionId,'shaft-bore','Confirmed native inquiry keeps its drawing detail');
    key='annora.product-room.projects.v1';
    if(process.env.NATIVE_ONLY !== '1') {
    const fixture=await nativeCommercialFixture(nativeContext),latest=fixture.finalStore.projects[0].quotes.at(-1);
    const projectURL=`product-room/?model=kinetic-01#project&project=${fixture.projectId}&tab=quotation&quote=${latest.id}`;
    for(const mode of ['revision','next']) {
      await seed(fixture.finalStore,`${projectURL}&mode=${mode}`);
      await page.locator('#pw-change-form').waitFor();
      if(mode==='revision') {await page.getByLabel('Quantity',{exact:false}).fill('35');await page.getByLabel('What needs to change?',{exact:false}).fill('Fictional review: please confirm the mounting holes for the revised quantity.');}
      else await page.getByLabel('Message',{exact:false}).fill('Fictional next step: review the mounting interfaces with engineering.');
      await checkpoint(mode==='revision'?'04-buyer-change-fill':'07-buyer-next-fill',{recordVersion:2});
      await click(primary());
      await page.getByRole('heading',{name:mode==='revision'?'Review your requested changes.':'Review your next step.',exact:true}).waitFor();
      assert.equal((await store()).projects[0][mode==='revision'?'changes':'nextSteps'].length,0,'Request review does not submit');
      await checkpoint(mode==='revision'?'05-buyer-change-review':'08-buyer-next-review',{recordVersion:2});
      await click(primary());
      await page.waitForFunction(({key,list})=>JSON.parse(localStorage.getItem(key)).projects[0][list].length===1,{key,list:mode==='revision'?'changes':'nextSteps'});
      const record=(await store()).projects[0];assert.deepEqual(record.quotes,fixture.finalStore.projects[0].quotes,'Confirmed request does not rewrite quoted history');
      checkpoints.push({name:mode==='revision'?'06-change-confirmed':'09-next-confirmed',quotedHistoryPreserved:true});
    }

    for(const [kind,data,action,label] of [['change',fixture.changeStore,'Respond to changes','Message to the customer'],['next',fixture.nextStore,'Confirm next step','Next-step confirmation']]) {
      const old=data.projects[0].quotes[0];
      await seed(data,`studio/?product=kinetic-01#project?id=${fixture.projectId}&tab=quotation&quote=${old.id}`);
      await click(page.getByRole('button',{name:action,exact:true}));
      await page.locator('.customer-message-page').waitFor();
      const textarea=page.locator('.customer-message-page textarea').first();
      await textarea.fill(kind==='next'?'We will arrange a joint engineering review of the mounting interface.':'We can review the new mounting scope before revising the quotation.');
      const topicReplies=page.locator('.customer-response-topic textarea');
      for(let index=0;index<await topicReplies.count();index++)await topicReplies.nth(index).fill('Please confirm this requirement in the next engineering review.');
      await checkpoint(kind==='next'?'12-seller-next-fill':'10-seller-reply-fill',{recordVersion:2});
      const prior=(await store()).projects[0];
      await click(primary());await page.locator('.customer-message-review').waitFor();
      assert.deepEqual((await store()).projects[0].messages,prior.messages,'Seller review does not send');
      assert.deepEqual((await store()).projects[0].replies,prior.replies,'Seller review does not reply');
      await checkpoint(kind==='next'?'13-seller-next-review':'11-seller-reply-review',{recordVersion:2});
      await click(primary());
      await page.waitForFunction(({key,messages,replies})=>{const p=JSON.parse(localStorage.getItem(key)).projects[0];return p.messages.length>messages||p.replies.length>replies;},{key,messages:prior.messages.length,replies:prior.replies.length});
      assert.deepEqual((await store()).projects[0].quotes,prior.quotes,'Seller confirmation preserves issued quotations');
      const confirmed=JSON.stringify((await store()).projects[0]);await page.reload({waitUntil:'domcontentloaded'});await page.locator('.ar-project-context').waitFor();
      assert.equal(JSON.stringify((await store()).projects[0]),confirmed,'Final reload preserves confirmation');
    }

    await page.goto(new URL('integrations/existing-viewer/',base).href,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.annoraExampleDiagnostics?.().state.ready,null,{timeout:90000});
    await page.locator('#part').selectOption('kinetic-node-001');await click(page.locator('#inquire-part'));
    await page.locator('.ei-panel [name="application"]').waitFor();
    await checkpoint('14-floating-manual-fill',{floating:true});
    await click(primary());await page.locator('.ei-panel [aria-invalid="true"]').first().waitFor();
    await page.locator('.ei-panel [name="application"]').fill('Fictional standalone inquiry for the connecting rod.');
    await page.locator('.ei-panel [name="intent"]').selectOption('quotation');
    await page.locator('.ei-panel [name="quoteScope"]').selectOption('part');
    await page.locator('.ei-panel [name="quantity"]').fill('20');
    await click(primary());await page.locator('.ei-panel[data-stage="review"]').waitFor();
    await checkpoint('15-floating-manual-review',{floating:true});
    await click(page.getByRole('button',{name:'Edit details',exact:true}));
    assert.equal(await page.locator('.ei-panel [name="application"]').inputValue(),'Fictional standalone inquiry for the connecting rod.');
    await click(primary());await page.locator('.ei-panel[data-stage="review"]').waitFor();await click(primary());
    await page.locator('.ei-panel[data-stage="confirmed"]').waitFor();await checkpoint('16-floating-manual-receipt',{floating:true});
    }
    assert.deepEqual(errors,[]);
    await fs.writeFile(path.join(dir,'result.json'),JSON.stringify({status:'passed',profile,checkpoints,errors,limitations:'Chromium viewport/touch emulation, not physical-device performance.'},null,2));
    results.push({profile:profile.name,status:'passed',checkpoints:checkpoints.length});
  } catch(error) {
    await page.screenshot({path:path.join(dir,'failure.png')}).catch(()=>{});
    await fs.writeFile(path.join(dir,'failure.json'),JSON.stringify({status:'failed',stage,profile,error:{message:error.message,stack:error.stack},url:page.url(),body:await page.locator('body').innerText().catch(()=>''),checkpoints,errors},null,2));
    results.push({profile:profile.name,status:'failed',stage,message:error.message});console.error(`${profile.name}: ${stage}: ${error.message}`);
  } finally {await context.close();}
}
try {for(const profile of profiles)await run(profile);}finally{await browser.close();await fs.writeFile(path.join(out,'summary.json'),JSON.stringify({base:base.href,results,timestamp:new Date().toISOString()},null,2));}
console.log(JSON.stringify(results,null,2));if(results.some(result=>result.status!=='passed'))process.exitCode=1;
