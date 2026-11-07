/** W60 compiled-site qualification. Run only while holding the browser lease.
 * Business mutations use rendered controls; controlled test preconditions use a
 * fresh isolated browser context. No real customer browser profile is opened. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = new URL(process.env.BASE_URL || 'http://127.0.0.1:8159/annora-explorer/');
if (!base.pathname.endsWith('/')) base.pathname += '/';
const out = path.resolve(process.env.OUT || 'work/product-expansion/W60/browser');
const requested = new Set((process.env.PROFILES || 'desktop,mobile,compact,landscape').split(','));
const profiles = [
  { name:'desktop', width:1280, height:900 },
  { name:'mobile', width:390, height:844, isMobile:true, hasTouch:true },
  { name:'compact', width:320, height:740, isMobile:true, hasTouch:true },
  { name:'landscape', width:844, height:390, isMobile:true, hasTouch:true },
].filter(value => requested.has(value.name));
assert.ok(profiles.length, 'Select desktop, mobile, compact or landscape');
await fs.mkdir(out, { recursive:true });
const browser = await chromium.launch({ channel:'chrome', headless:true });
const summary = [];
const protectedBytes = {
  'annora.product-room.projects.v1': JSON.stringify({ schemaVersion:2, revision:41, drafts:[], projects:[], quoteDrafts:[], qualification:'ordinary-projects' }),
  'annora.integration-example.projects.v1': JSON.stringify({ schemaVersion:2, revision:42, drafts:[], projects:[], quoteDrafts:[], qualification:'standalone-example' }),
  'annora.studio.products.v1': JSON.stringify({ schemaVersion:1, revision:43, drafts:[], releases:[], previews:[], publishedId:null, qualification:'studio-product-releases' }),
  'annora.walkthrough.projects.v1.WT-qualification-protected-0001': JSON.stringify({ schemaVersion:2, revision:44, drafts:[], projects:[], quoteDrafts:[], qualification:'native-walkthrough' }),
};

async function run(profile) {
  const dir = path.join(out, profile.name); await fs.mkdir(dir, { recursive:true });
  const context = await browser.newContext({ viewport:{ width:profile.width, height:profile.height }, deviceScaleFactor:1, isMobile:Boolean(profile.isMobile), hasTouch:Boolean(profile.hasTouch) });
  const page = await context.newPage(); page.setDefaultTimeout(30000);
  const errors=[], failedRequests=[], checkpoints=[], advances=[], assertions=[];
  let stage='entry', sessionId, namespace, projectId, exactContext, originalInquiry, quoteV1, idleFrames;
  page.on('pageerror', error => errors.push({ stage, message:error.message }));
  page.on('requestfailed', request => { const error=request.failure()?.errorText; if (error !== 'net::ERR_ABORTED') failedRequests.push({ stage, url:request.url(), error }); });
  const panel=() => page.locator('.ei-panel');
  const field=name => panel().locator(`[name="${name}"]`);
  const store=() => page.evaluate(key => JSON.parse(localStorage.getItem(key) || '{"drafts":[],"projects":[]}'), namespace);
  const project=async() => (await store()).projects.find(value => value.id===projectId);
  const diagnostics=() => page.evaluate(() => window.annoraExampleDiagnostics());
  const action=() => page.locator('.wt-handoff');
  const button=name => page.getByRole('button', { name, exact:true });
  async function waitStep(expected, { disabled=false }={}) {
    const ids=expected ? (Array.isArray(expected)?expected:[expected]) : null;
    await page.waitForFunction(({ids,disabled}) => { const el=document.querySelector('.wt-handoff'); return el && (!ids || ids.includes(el.dataset.step)) && (disabled?el.disabled:!el.disabled); }, {ids,disabled}, {timeout:90000});
    return action().getAttribute('data-step');
  }
  async function click(locator) {
    await locator.scrollIntoViewIfNeeded();
    assert.equal(await locator.evaluate(el => { const r=el.getBoundingClientRect(), hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2); return el===hit || el.contains(hit); }),true,'Action center must receive pointer input');
    await locator.click();
  }
  async function advance(expected,next,{confirmation=false,double=false}={}) {
    stage=`advance-${expected}`; const actual=await waitStep(expected);
    assert.equal(await action().getAttribute('data-confirmation'),String(confirmation),`${actual}: confirmation contract`);
    assert.equal((await action().innerText()).trim(),confirmation?'Confirm & continue':'Continue demo');
    const before=await store();
    if(double) await action().dblclick({delay:25}); else await click(action());
    if(next) await waitStep(next,{disabled:next==='complete'});
    else await page.waitForFunction(previous => {const el=document.querySelector('.wt-handoff');return el&&!el.disabled&&el.dataset.step!==previous;},actual,{timeout:90000});
    const after=await store();
    advances.push({action:actual,confirmation,next:await action().getAttribute('data-step'),projectsBefore:before.projects.length,projectsAfter:after.projects.length,quotesBefore:before.projects[0]?.quotes.length||0,quotesAfter:after.projects[0]?.quotes.length||0});
  }
  async function checkpoint(name,{inquiry=false,independent=false}={}) {
    stage=name;
    const layout=await page.evaluate(() => {
      const box=selector=>{const el=document.querySelector(selector);if(!el||!el.getClientRects().length)return null;const r=el.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
      return {width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth,panel:box('.ei-panel'),footer:box('.ei-footer'),guide:box('.walkthrough-strip'),action:box('.wt-handoff'),role:document.querySelector('.wt-role')?.textContent,step:document.querySelector('.wt-handoff')?.dataset.step,confirmation:document.querySelector('.wt-handoff')?.dataset.confirmation};
    });
    assert.equal(layout.overflow,false,`${name}: horizontal overflow`);
    const canvases=[];for(const frame of page.frames()){const count=await frame.locator('canvas').count();if(count)canvases.push({url:frame.url(),count});}
    assert.ok(canvases.reduce((n,value)=>n+value.count,0)<=1,`${name}: extra renderer`);
    if(independent){assert.equal(await page.locator('#viewer canvas').count(),1);assert.equal(await page.locator('iframe').count(),0);}
    if(inquiry){assert.ok(layout.panel,'Inquiry panel visible');assert.ok(layout.panel.x>=-1&&layout.panel.right<=layout.width+1&&layout.panel.y>=-1&&layout.panel.bottom<=layout.height+1,'Inquiry stays inside viewport');if(layout.guide)assert.ok(layout.panel.y>=layout.guide.bottom-1,'Guide does not obscure inquiry');}
    assert.ok(layout.action?.height>=44,`${name}: Continue touch target`);
    const viewer=independent?(await diagnostics()).viewer:null;
    if(independent&&profile.width<600)assert.ok(viewer.drawingBufferDpr<=1.5,'Mobile drawing buffer stays bounded');
    const item={name,url:page.url(),layout,canvases,...(viewer?{viewer}: {})};checkpoints.push(item);
    await page.screenshot({path:path.join(dir,`${name}.png`),animations:'disabled'});
    await fs.writeFile(path.join(dir,`${name}.json`),JSON.stringify(item,null,2));
    console.log(`${profile.name}: ${name}`);
  }
  async function assertReferences(record) {
    assert.deepEqual(record.context,exactContext,'Project external reference changed');
    assert.deepEqual(record.inquiry,originalInquiry,'Original inquiry changed');
    for(const entry of [...record.quotes,...record.changes,...record.replies,...record.messages,...record.nextSteps]) assert.deepEqual(entry.context,exactContext,`External reference lost on ${entry.kind||entry.id}`);
    if(quoteV1)assert.deepEqual(record.quotes[0],quoteV1,'Issued v1 was rewritten');
  }
  async function assertProtected() {
    assert.deepEqual(await page.evaluate(keys=>Object.fromEntries(keys.map(key=>[key,localStorage.getItem(key)])),Object.keys(protectedBytes)),protectedBytes,'Unrelated local namespaces changed');
  }
  function assertDestination(expected) {
    const actual=new URL(page.url()), saved=new URL(expected);
    assert.equal(actual.origin, saved.origin);assert.equal(actual.pathname,saved.pathname);assert.equal(actual.hash,saved.hash);
    assert.equal(actual.searchParams.get('walkthrough'),saved.searchParams.get('walkthrough'));
  }
  async function verifyRestored(label, expected=exactContext) {
    await page.waitForFunction(()=>window.annoraExampleDiagnostics?.().state.ready,null,{timeout:90000});
    assert.match(page.url(),/\/integrations\/existing-viewer\//);
    const state=await diagnostics(), camera=expected.viewerReference.snapshot.camera;
    assert.equal(state.state.selectedPart.id,expected.part.id);
    for(const name of ['position','target','up'])camera[name].forEach((value,index)=>assert.ok(Math.abs(value-state.viewer.camera[name][index])<1e-8,`${label}: exact ${name}[${index}]`));
    assert.deepEqual(state.viewer.camera.projection,camera.projection);
    await checkpoint(label,{independent:true});
  }
  try {
    // Synthetic storage preconditions are isolated from the user's browser.
    await page.goto(new URL('product-room/?model=kinetic-01#projects',base).href,{waitUntil:'domcontentloaded'});
    await page.evaluate(entries=>{for(const[key,value]of entries)localStorage.setItem(key,value);},Object.entries(protectedBytes));
    await page.goto(new URL('walkthrough/?viewer=independent&new=1',base).href,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.annoraExampleDiagnostics?.().state.ready,null,{timeout:90000});
    sessionId=new URL(page.url()).searchParams.get('walkthrough');assert.match(sessionId,/^WTI-/);
    namespace=`annora.walkthrough.independent.projects.v1.${sessionId}`;
    assert.equal((await diagnostics()).namespace,namespace);
    const first=await waitStep('independent-select');
    await checkpoint('01-independent-product',{independent:true});
    await advance(first,'inquiry-open');
    assert.equal((await diagnostics()).state.selectedPart.id,'kinetic-node-001');
    await advance('inquiry-open','inquiry-review');
    await field('application').waitFor();
    const retained=await page.locator('#viewer canvas').elementHandle();
    const initialDraft=structuredClone((await store()).drafts[0]);
    exactContext=structuredClone(initialDraft.context);
    assert.equal(exactContext.part.id,'kinetic-node-001');
    assert.equal(exactContext.viewerReference.adapter.id,'annora-example-three-viewer');
    assert.equal(exactContext.viewerReference.product.revision,'independent-viewer-product-v1');
    assert.equal(exactContext.inspection,undefined,'Independent context is not a native inspection');
    await field('application').fill('Fictional walkthrough: review this connecting rod for a compact inspection fixture.');
    await checkpoint('02-floating-inquiry',{inquiry:true,independent:true});

    await page.evaluate(key=>{window.__w60OriginalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(name,value){if(name===key)throw new DOMException('Qualification save failure','QuotaExceededError');return window.__w60OriginalSet.call(this,name,value);};},namespace);
    await field('application').fill('Fictional walkthrough: preserve this connecting rod when saving fails.');
    await click(panel().getByRole('button',{name:'Minimize inquiry',exact:true}));
    await panel().waitFor();
    assert.equal(await field('application').inputValue(),'Fictional walkthrough: preserve this connecting rod when saving fails.');
    assert.equal(await page.locator('.ei-minimized').count(),0);
    await checkpoint('03-failed-save-keeps-editor',{inquiry:true,independent:true});
    await page.evaluate(()=>{Storage.prototype.setItem=window.__w60OriginalSet;delete window.__w60OriginalSet;});
    await click(panel().getByRole('button',{name:'Minimize inquiry',exact:true}));
    await waitStep('inquiry-resume');
    assert.equal(await retained.evaluate(el=>el.isConnected),true);
    await page.locator('#part').selectOption('kinetic-node-002');
    assert.deepEqual((await diagnostics()).context,exactContext);
    await checkpoint('04-minimized-reference-pinned',{independent:true});
    await advance('inquiry-resume','inquiry-review');
    assert.equal((await store()).drafts[0].id,initialDraft.id);
    await advance('inquiry-review','inquiry-confirm');
    assert.equal((await store()).projects.length,0);
    await checkpoint('05-inquiry-review',{inquiry:true,independent:true});
    await advance('inquiry-confirm','inquiry-project',{confirmation:true,double:true});
    assert.equal((await store()).projects.length,1,'Double activation submitted at most once');
    const created=(await store()).projects[0];projectId=created.id;originalInquiry=structuredClone(created.inquiry);
    assert.deepEqual(created.context,exactContext);
    await checkpoint('06-inquiry-receipt',{inquiry:true,independent:true});
    await advance('inquiry-project','handoff-seller-quotation');
    assert.match(await page.locator('.wt-role-context').innerText(),/Buyer view[\s\S]*Next: seller/);
    await advance('handoff-seller-quotation','seller-review-sample-quotation');

    const sellerUrl=page.url();
    await click(page.getByRole('link',{name:'Reopen saved view',exact:true}).first());
    await verifyRestored('06b-seller-external-reference');
    assert.equal(new URL(page.url()).searchParams.get('returnRole'),'seller');
    await click(page.locator('#return-project'));await waitStep('seller-review-sample-quotation');
    assertDestination(sellerUrl);

    await page.getByLabel('Customer project section',{exact:true}).selectOption('inquiry');
    await click(button('Ask for clarification'));
    await page.getByLabel('Question for the customer',{exact:true}).fill('Please confirm the mounting interface and application load before we prepare the quotation.');
    await advance('seller-review-current-reply','seller-confirm-response');
    assert.equal((await project()).messages.length,0);
    await checkpoint('07-seller-clarification-review');
    await advance('seller-confirm-response','handoff-buyer-question',{confirmation:true});
    const clarification=(await project()).messages.find(value=>value.kind==='clarification');assert.ok(clarification);
    await advance('handoff-buyer-question','reply-review');
    await advance('reply-review','reply-confirm');
    assert.equal((await project()).messages.filter(value=>value.replyTo===clarification.id).length,0);
    await checkpoint('08-buyer-reply-review');
    await advance('reply-confirm','handoff-seller-quotation',{confirmation:true});
    await advance('handoff-seller-quotation','seller-review-sample-quotation');
    await advance('seller-review-sample-quotation','seller-confirm-quotation');
    assert.equal((await project()).quotes.length,0);
    await checkpoint('09-seller-v1-review');

    const reviewUrl=page.url();
    await page.reload({waitUntil:'domcontentloaded'});
    const resumed=await waitStep(['seller-review-current-quotation','seller-review-sample-quotation','seller-confirm-quotation']);
    assert.equal((await project()).quotes.length,0,'Refresh cannot issue a reviewed quote');
    if(resumed!=='seller-confirm-quotation')await advance(resumed,'seller-confirm-quotation');
    assert.equal(page.url(),reviewUrl,'Review refresh retains the same project URL');
    await checkpoint('10-review-after-refresh');
    await advance('seller-confirm-quotation','handoff-buyer-change',{confirmation:true});
    quoteV1=structuredClone((await project()).quotes[0]);assert.equal(quoteV1.version,1);assert.equal(quoteV1.quantity,20);
    await advance('handoff-buyer-change','change-review');

    // Reopen a pinned quotation in the external host, then return to that record.
    const v1Url=page.url();
    const reopen=page.getByRole('button',{name:'Reopen saved view',exact:true}).first();
    await reopen.waitFor();
    await click(reopen);await verifyRestored('11-v1-external-reference');
    assert.equal(new URL(page.url()).searchParams.get('referenceQuote'),quoteV1.id);
    const beforeIdle=(await diagnostics()).viewer.renderCount;await page.waitForTimeout(400);idleFrames=(await diagnostics()).viewer.renderCount-beforeIdle;assert.ok(idleFrames<=2);
    await page.goBack({waitUntil:'domcontentloaded'});
    await waitStep('change-review');assert.equal(page.url(),v1Url);
    await assertReferences(await project());
    await checkpoint('12-return-to-v1');

    await advance('change-review','change-confirm');
    assert.equal((await project()).changes.length,0);
    await checkpoint('13-buyer-change-review');
    await advance('change-confirm','handoff-seller-revision',{confirmation:true});
    await advance('handoff-seller-revision','seller-review-sample-quotation');
    await advance('seller-review-sample-quotation','seller-confirm-quotation');
    assert.equal((await project()).quotes.length,1);
    await checkpoint('14-seller-v2-review');
    await advance('seller-confirm-quotation','handoff-buyer-compare',{confirmation:true});
    await advance('handoff-buyer-compare','next-review');
    await page.getByRole('heading',{name:'What changed from v1',exact:true}).waitFor();
    const revised=await project();assert.equal(revised.quotes[1].quantity,30);assert.equal(revised.quotes[1].previousQuoteId,quoteV1.id);await assertReferences(revised);
    await checkpoint('15-v2-comparison');
    const v2Url=page.url();
    await click(page.getByRole('button',{name:'Reopen saved view',exact:true}).first());
    await verifyRestored('16-v2-external-reference');
    assert.equal(new URL(page.url()).searchParams.get('referenceQuote'),revised.quotes[1].id);
    await click(page.locator('#return-project'));await waitStep('next-review');assertDestination(v2Url);
    await page.getByLabel('Quote version',{exact:true}).selectOption(quoteV1.id);
    await page.getByRole('heading',{name:'An earlier quotation.',exact:true}).waitFor();await waitStep('latest-quotation');
    await checkpoint('17-historical-v1');
    const historicalUrl=page.url();
    await click(page.getByRole('button',{name:'Reopen saved view',exact:true}).first());
    await verifyRestored('17b-historical-v1-external-reference');
    assert.equal(new URL(page.url()).searchParams.get('referenceQuote'),quoteV1.id);
    await page.goBack({waitUntil:'domcontentloaded'});await waitStep('latest-quotation');assert.equal(page.url(),historicalUrl);
    await assertReferences(await project());
    await advance('latest-quotation','next-review');
    await advance('next-review','next-confirm');assert.equal((await project()).nextSteps.length,0);
    await checkpoint('18-next-step-review');
    await advance('next-confirm','handoff-seller-acknowledge',{confirmation:true});
    await advance('handoff-seller-acknowledge','seller-review-acknowledgement');
    await advance('seller-review-acknowledgement','seller-confirm-response');
    assert.equal((await project()).messages.filter(value=>value.kind==='next-step-confirmation').length,0);
    await checkpoint('19-seller-acknowledgement-review');
    await advance('seller-confirm-response','handoff-buyer-complete',{confirmation:true});
    await advance('handoff-buyer-complete','complete');
    const complete=structuredClone(await project());await assertReferences(complete);await assertProtected();
    assert.equal(complete.quotes.length,2);assert.equal(complete.changes.length,1);assert.equal(complete.nextSteps.length,1);
    assert.equal(complete.messages.filter(value=>value.kind==='next-step-confirmation').length,1);
    assert.equal(advances.filter(value=>value.confirmation).length,8);
    await checkpoint('20-completed');
    await page.reload({waitUntil:'domcontentloaded'});await waitStep('complete',{disabled:true});
    assert.deepEqual(await project(),complete);await assertProtected();
    await checkpoint('21-completed-reload');
    assert.deepEqual(errors,[]);assert.deepEqual(failedRequests,[]);
    assertions.push('Independent viewer remains its own canvas and adapter.','All eight business confirmations follow separate visible reviews.','Exact external context survives quotations v1/v2, clarification, reply, change and next step.','Save failure, minimize/resume, real Back and review/completion refresh preserve work.','All four protected namespace byte strings remain unchanged.');
    await fs.writeFile(path.join(dir,'project.json'),JSON.stringify(complete,null,2));
    const result={status:'passed',profile,base:base.href,browser:browser.version(),timestamp:new Date().toISOString(),sessionId,namespace,projectId,checkpoints,advances,assertions,externalContext:exactContext,idleFramesOver400ms:idleFrames,errors,failedRequests,limitation:'Chrome emulation on this machine, not a physical-phone or ordinary-PC benchmark.'};
    await fs.writeFile(path.join(dir,'result.json'),JSON.stringify(result,null,2));summary.push({profile:profile.name,status:'passed',sessionId,projectId,checkpoints:checkpoints.length,confirmations:8});
  }catch(error){
    const failure={status:'failed',profile,stage,url:page.url(),sessionId,namespace,projectId,error:{message:error.message,stack:error.stack},errors,failedRequests,checkpoints,advances,body:await page.locator('body').innerText().catch(()=>''),store:namespace?await store().catch(()=>null):null};
    await fs.writeFile(path.join(dir,'failure.json'),JSON.stringify(failure,null,2));await page.screenshot({path:path.join(dir,'failure.png')}).catch(()=>{});
    summary.push({profile:profile.name,status:'failed',stage,message:error.message});console.error(`${profile.name}: ${stage}: ${error.message}`);
  }finally{await context.close();}
}
try{for(const profile of profiles)await run(profile);}finally{await fs.writeFile(path.join(out,'summary.json'),JSON.stringify({base:base.href,timestamp:new Date().toISOString(),results:summary},null,2));await browser.close();}
console.log(JSON.stringify(summary,null,2));if(summary.some(value=>value.status!=='passed'))process.exitCode=1;
