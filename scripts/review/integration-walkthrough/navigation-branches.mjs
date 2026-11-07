/** Focused WTI route/review qualification. Requires the browser lease. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=new URL(process.env.BASE_URL || 'http://127.0.0.1:8159/annora-explorer/');
if(!base.pathname.endsWith('/'))base.pathname+='/';
const out=path.resolve(process.env.OUT || 'work/product-expansion/W60/navigation-branches');
const requested=new Set((process.env.PROFILES || 'desktop,compact').split(','));
const profiles=[{name:'desktop',width:1280,height:900},{name:'compact',width:320,height:740,isMobile:true,hasTouch:true}].filter(value=>requested.has(value.name));
assert.ok(profiles.length,'Select desktop or compact for navigation branches');
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const results=[];
async function run(profile){
  const context=await browser.newContext({viewport:{width:profile.width,height:profile.height},isMobile:Boolean(profile.isMobile),hasTouch:Boolean(profile.hasTouch),deviceScaleFactor:1});
  const page=await context.newPage();page.setDefaultTimeout(30000);
  const dir=path.join(out,profile.name);await fs.mkdir(dir,{recursive:true});
  const checkpoints=[],errors=[];let stage='entry',sessionId,namespace;
  page.on('pageerror',error=>errors.push({stage,message:error.message}));
  const store=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)||'{"drafts":[],"projects":[]}'),namespace);
  const bytes=()=>page.evaluate(key=>localStorage.getItem(key),namespace);
  const wait=async(ids,disabled=false)=>{ids=Array.isArray(ids)?ids:[ids];await page.waitForFunction(({ids,disabled})=>{const el=document.querySelector('.wt-handoff');return el&&ids.includes(el.dataset.step)&&el.disabled===disabled;},{ids,disabled},{timeout:90000});};
  const advance=async(from,to,confirm=false)=>{stage=from;await wait(from);assert.equal(await page.locator('.wt-handoff').getAttribute('data-confirmation'),String(confirm));await page.locator('.wt-handoff').click();await wait(to);};
  async function capture(name){stage=name;assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(dir,`${name}.png`),animations:'disabled'});checkpoints.push({name,url:page.url(),step:await page.locator('.wt-handoff').getAttribute('data-step'),role:await page.locator('.wt-role').innerText()});console.log(`${profile.name}: ${name}`);}
  async function chapter(number){await page.locator('.wt-tools > summary').click();await page.locator(`.wt-chapters [data-chapter="${number}"]`).click();}
  try{
    await page.goto(new URL('walkthrough/?viewer=independent&new=1',base).href,{waitUntil:'domcontentloaded'});await wait('independent-select');
    sessionId=new URL(page.url()).searchParams.get('walkthrough');namespace=`annora.walkthrough.independent.projects.v1.${sessionId}`;
    const viewerURL=new URL(page.url());viewerURL.hash='inquiry';
    await page.goto(viewerURL.href,{waitUntil:'domcontentloaded'});await wait('inquiry-review');
    await page.locator('.ei-panel [name="application"]').fill('Fictional branch check: keep the saved component when returning to the product.');
    await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)||'{"drafts":[]}').drafts[0]?.values.application?.includes('Fictional branch check'),namespace);
    const draft=(await store()).drafts[0];assert.ok(draft.context.viewerReference);assert.equal(draft.context.part.id,'kinetic-node-001');assert.equal((await store()).projects.length,0);
    await capture('01-direct-inquiry-creates-visible-draft');
    await chapter(1);await wait('inquiry-open');
    assert.equal(new URL(page.url()).hash,'#explore');await page.locator('.ei-panel').waitFor({state:'hidden'});assert.equal((await store()).drafts[0].id,draft.id);assert.equal(await page.locator('#viewer canvas').count(),1);
    await capture('02-guide-product-keeps-draft-minimized');
    await page.reload({waitUntil:'domcontentloaded'});await wait('inquiry-open');assert.equal(new URL(page.url()).hash,'#explore');await page.locator('.ei-panel').waitFor({state:'hidden'});
    assert.deepEqual((await store()).drafts[0].context,draft.context);await capture('03-explicit-explore-survives-refresh');
    await chapter(2);await wait('inquiry-review');assert.equal((await store()).drafts[0].id,draft.id);await page.locator('.ei-panel').waitFor();await capture('04-guide-inquiry-resumes-same-draft');
    await advance('inquiry-review','inquiry-confirm');assert.equal((await store()).projects.length,0);
    await advance('inquiry-confirm','inquiry-project',true);await advance('inquiry-project','handoff-seller-quotation');await advance('handoff-seller-quotation','seller-review-sample-quotation');await advance('seller-review-sample-quotation','seller-confirm-quotation');
    const sellerReview=new URL(page.url()),beforeReference=await bytes();assert.equal((await store()).projects[0].quotes.length,0);
    await capture('05-unissued-seller-quotation-review');
    await page.getByRole('link',{name:'Reopen saved view',exact:true}).first().click();await wait('reference-return');
    assert.equal(await page.locator('.wt-role').innerText(),'Seller view');assert.equal(await page.locator('.wt-handoff').getAttribute('data-confirmation'),'false');
    assert.equal(await page.locator('#return-project').evaluate(link=>{const p=document.querySelector('.intro p').getBoundingClientRect(),r=link.getBoundingClientRect();return r.top>=p.bottom-1&&r.height>=44;}),true,'Return link clears the reference description');
    assert.equal(new URL(page.url()).searchParams.get('returnView'),sellerReview.hash);await capture('06-reference-retains-seller-review-role');
    await advance('reference-return','seller-confirm-quotation');
    assert.equal(new URL(page.url()).pathname,sellerReview.pathname);assert.equal(new URL(page.url()).hash,sellerReview.hash);assert.equal(await bytes(),beforeReference);assert.equal((await store()).projects[0].quotes.length,0);
    await capture('07-continue-returns-to-unissued-review');
    const savedProject=(await store()).projects[0],stable=await bytes();
    const invalidViewer=new URL('integrations/existing-viewer/',base);invalidViewer.search=new URLSearchParams({walkthrough:sessionId,project:'PRJ-MISSING',returnRole:'seller'});invalidViewer.hash='explore';
    const invalidRoom=new URL('product-room/',base);invalidRoom.search=new URLSearchParams({walkthrough:sessionId,model:'kinetic-01'});invalidRoom.hash='project&project=PRJ-MISSING';
    const invalidStudio=new URL('studio/',base);invalidStudio.search=new URLSearchParams({walkthrough:sessionId});invalidStudio.hash='project?id=PRJ-MISSING';
    for(const[label,url]of[['viewer',invalidViewer],['buyer',invalidRoom],['seller',invalidStudio]]){
      await page.goto(url.href,{waitUntil:'domcontentloaded'});await wait('error',true);assert.equal(await bytes(),stable);assert.equal((await store()).projects[0].id,savedProject.id);await capture(`08-invalid-${label}-project-fails-closed`);
    }
    assert.deepEqual(errors,[]);const result={status:'passed',profile,base:base.href,timestamp:new Date().toISOString(),sessionId,checkpoints,errors,protectedHistory:true};await fs.writeFile(path.join(dir,'result.json'),JSON.stringify(result,null,2));results.push({profile:profile.name,status:'passed',checkpoints:checkpoints.length});
  }catch(error){await fs.writeFile(path.join(dir,'failure.json'),JSON.stringify({status:'failed',profile,stage,url:page.url(),error:{message:error.message,stack:error.stack},checkpoints,errors,body:await page.locator('body').innerText().catch(()=>''),store:namespace?await store().catch(()=>null):null},null,2));await page.screenshot({path:path.join(dir,'failure.png')}).catch(()=>{});results.push({profile:profile.name,status:'failed',stage,message:error.message});console.error(error.message);}
  finally{await context.close();}
}
try{for(const profile of profiles)await run(profile);}finally{await fs.writeFile(path.join(out,'summary.json'),JSON.stringify({base:base.href,results},null,2));await browser.close();}
console.log(JSON.stringify(results,null,2));if(results.some(value=>value.status!=='passed'))process.exitCode=1;
