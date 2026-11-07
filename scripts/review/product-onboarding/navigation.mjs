// Shared navigation guards and preview invalidation acceptance. Uses an isolated browser context.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const base=(process.env.BASE_URL||'http://127.0.0.1:8161/').replace(/\/?$/,'/');
const width=Number(process.env.WIDTH||320),height=width<600?844:900;
const out=process.env.OUT||`work/product-expansion/W41/ui/navigation-${width}`;await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}); const results=[];
try {
 const page=await browser.newPage({viewport:{width,height},isMobile:width<600,hasTouch:width<600});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'studio/#onboard');await page.getByLabel('Summary',{exact:true}).fill('Review the mounting interfaces and discuss the application.');
 await page.locator('.onboard-header').getByRole('button',{name:'Products',exact:true}).click();await page.getByRole('dialog',{name:'Keep this product setup?',exact:true}).waitFor();
 await page.getByRole('button',{name:'Save & continue',exact:true}).click();await page.waitForURL(url=>url.hash==='#products');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:`${out}/products-return.png`,fullPage:true});
 await page.getByRole('button',{name:'Add prepared product',exact:true}).click();await page.getByLabel('Summary',{exact:true}).waitFor();assert.equal(await page.getByLabel('Summary',{exact:true}).inputValue(),'Review the mounting interfaces and discuss the application.');results.push('Local back saves through shared guard and returns; add-product entry resumes draft');
 await page.getByLabel('Short title',{exact:true}).fill('Draft title');await page.evaluate(()=>{location.hash='#projects';});
 await page.getByRole('dialog',{name:'Keep this product setup?',exact:true}).waitFor();await page.getByRole('button',{name:'Keep editing',exact:true}).click();await page.waitForURL(url=>url.hash==='#onboard');results.push('Direct hash navigation is guarded and keep-editing restores route');
 await page.getByLabel('I checked the source, license and prepared files.').check();await page.getByLabel('I checked the source units and the conversion shown above.').check();await page.getByRole('button',{name:'Continue to details',exact:true}).click();
 const rows=page.locator('.onboard-mapping');await rows.first().waitFor();for(let i=0;i<await rows.count();i++){await rows.nth(i).locator('.onboard-mapping-select').click();await page.getByRole('button',{name:'Confirm this link',exact:true}).click();}
 await page.getByRole('button',{name:'Save and preview',exact:true}).click();await page.getByRole('button',{name:'Review this package',exact:true}).waitFor();await page.getByRole('button',{name:'Review this package',exact:true}).click();await page.getByRole('button',{name:'Confirm review',exact:true}).waitFor();
 await page.getByRole('button',{name:'Check sources',exact:true}).click();await page.getByLabel('Summary',{exact:true}).fill('Changed after preview; a new review must be created.');assert.equal(await page.getByRole('button',{name:'Confirm review',exact:true}).count(),0);
 await page.getByRole('button',{name:'Continue to details',exact:true}).click();await page.getByRole('button',{name:'Save and preview',exact:true}).click();await page.getByText('Changed after preview; a new review must be created.',{exact:true}).waitFor();
 results.push('Editing after review discards prior preview/review and requires a new saved preview');
 const targets=await page.locator('.studio-onboarding button:visible').evaluateAll(nodes=>nodes.map(n=>({label:n.textContent.trim(),height:n.getBoundingClientRect().height,width:n.getBoundingClientRect().width})).filter(n=>n.height<44));assert.deepEqual(targets,[]);
 results.push(`All visible onboarding buttons have at least 44px height at ${width}px`);assert.deepEqual(errors,[]);
 await writeFile(`${out}/navigation-result.json`,JSON.stringify({results,browserErrors:errors},null,2));console.log(JSON.stringify({results,errors}));
} finally {await browser.close();}
