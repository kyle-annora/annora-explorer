/** Focused commercial-page presentation review. All actions run in a fresh,
 * isolated Chromium context with fictional records. The existing W60 journey
 * separately verifies the complete confirmation and historical-reference flow. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { nativeCommercialFixture } from './native-fixture.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = new URL(process.env.BASE_URL || 'http://127.0.0.1:8190/annora-explorer/');
if (!base.pathname.endsWith('/')) base.pathname += '/';
const out = path.resolve(process.env.OUT || 'work/commercial-layout/candidate');
const requested = new Set((process.env.PROFILES || 'desktop,mobile,compact,landscape,zoom200').split(','));
const profiles = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'zoom200', width: 640, height: 450, deviceScaleFactor: 2, note: '200%-equivalent layout viewport from 1280x900; browser-native zoom is not available in headless Chromium.' },
  { name: 'mobile', width: 390, height: 844, isMobile: true, hasTouch: true },
  { name: 'compact', width: 320, height: 740, isMobile: true, hasTouch: true },
  { name: 'landscape', width: 844, height: 390, isMobile: true, hasTouch: true },
].filter(profile => requested.has(profile.name));
assert.ok(profiles.length, 'Select a supported viewport');
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];

async function run(profile) {
  const dir = path.join(out, profile.name);
  await fs.mkdir(dir, { recursive: true });
  const context = await browser.newContext({ viewport: { width: profile.width, height: profile.height }, deviceScaleFactor: profile.deviceScaleFactor || 1, isMobile: Boolean(profile.isMobile), hasTouch: Boolean(profile.hasTouch) });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  let stage = 'entry', sessionId, namespace, projectId, originalInquiry, originalContext, originalQuote;
  const checkpoints = [], advances = [], errors = [], networkErrors = [];
  page.on('pageerror', error => errors.push({ stage, message: error.message }));
  page.on('requestfailed', request => { if (request.failure()?.errorText !== 'net::ERR_ABORTED') networkErrors.push({ stage, url: request.url(), error: request.failure()?.errorText }); });
  const store = () => page.evaluate(key => JSON.parse(localStorage.getItem(key) || '{"projects":[],"drafts":[]}'), namespace);
  const project = async () => (await store()).projects.find(record => record.id === projectId);
  const waitStep = async (step, disabled = false) => {
    await page.waitForFunction(({ step, disabled }) => {
      const button = document.querySelector('.wt-handoff');
      return button?.dataset.step === step && button.disabled === disabled;
    }, { step, disabled }, { timeout: 90000 });
  };
  async function click(locator) {
    await locator.scrollIntoViewIfNeeded();
    assert.equal(await locator.evaluate(element => {
      const rect = element.getBoundingClientRect();
      const target = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
      return element === target || element.contains(target);
    }), true, 'The action receives pointer input');
    await locator.click();
  }
  async function advance(from, to, confirmation = false) {
    stage = from;
    await waitStep(from);
    const button = page.locator('.wt-handoff');
    assert.equal(await button.getAttribute('data-confirmation'), String(confirmation));
    assert.equal((await button.innerText()).trim(), confirmation ? 'Confirm & continue' : 'Continue demo');
    await click(button);
    await waitStep(to);
    advances.push({ from, to, confirmation });
  }
  async function checkHistory() {
    const record = await project();
    assert.deepEqual(record.context, originalContext, 'Original product context is preserved');
    assert.deepEqual(record.inquiry, originalInquiry, 'Original inquiry is preserved');
    if (originalQuote) assert.deepEqual(record.quotes[0], originalQuote, 'Issued quotation v1 is unchanged');
  }
  async function checkpoint(name, { role, quoteVersion, comparison = false } = {}) {
    stage = name;
    await page.evaluate(() => scrollTo(0, 0));
    const bars = page.locator('.ar-project-context:visible');
    assert.equal(await bars.count(), 1, `${name}: one shared project context`);
    const bar = bars.first();
    assert.equal(await bar.getAttribute('data-project-id'), projectId, `${name}: same project`);
    if (role) assert.equal(await bar.getAttribute('data-role'), role, `${name}: explicit role`);
    const recordLabel = await bar.getAttribute('data-record-label');
    if (quoteVersion) assert.match(recordLabel || '', new RegExp(`(?:v|version |quotation )${quoteVersion}\\b`, 'i'), `${name}: correct record version`);
    assert.match(await bar.innerText(), /Crank-slider mechanism/);
    assert.match(await bar.innerText(), /Connecting rod/);
    assert.equal(await page.locator('.wt-handoff:visible').count(), 1, `${name}: one walkthrough action`);
    assert.equal(await page.locator('.ar-project-primary:visible').count(), 0, `${name}: duplicate native primary hidden in guided view`);
    assert.equal(await page.locator('.pw-progress:visible').count(), 0, `${name}: no competing project progress`);
    const layout = await page.evaluate(() => {
      const bounds = selector => {
        const element = document.querySelector(selector);
        if (!element || !element.getClientRects().length) return null;
        const rect = element.getBoundingClientRect();
        return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height };
      };
      return {
        width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth,
        guide: bounds('.walkthrough-strip'), action: bounds('.wt-handoff'),
        context: bounds('.ar-project-context'), task: bounds('.ar-project-task'),
        comparison: bounds('.ar-comparison'),
        content: bounds('.customer-inquiry-summary') || bounds('.customer-quote-summary') || bounds('.pw-document'),
        headings: [...document.querySelectorAll('h1,h2,h3')].filter(el => el.getClientRects().length).map(el => ({ level: el.tagName, text: el.textContent, top: el.getBoundingClientRect().top })),
      };
    });
    assert.ok(layout.scrollWidth <= layout.width + 1, `${name}: no horizontal overflow`);
    assert.ok(layout.action && layout.action.height >= 44 && layout.action.width >= 44, `${name}: Continue target`);
    assert.ok(layout.action.y >= 0 && layout.action.bottom <= layout.height + 1, `${name}: Continue inside viewport`);
    assert.ok(layout.context.y >= layout.guide.bottom - 1, `${name}: context clears guide`);
    const taskHeadings = await page.locator('.ar-project-task h1:visible').count();
    assert.equal(taskHeadings, 1, `${name}: one task title`);
    if (comparison) {
      const tables = page.getByRole('table').filter({ has: page.getByRole('columnheader', { name: /v1|version 1/i }) });
      assert.ok(await tables.count() > 0, `${name}: comparison has version labels`);
      const table = tables.first();
      assert.match(await table.innerText(), /20 units/);
      assert.match(await table.innerText(), /30 units/);
    }
    await checkHistory();
    await page.screenshot({ path: path.join(dir, `${name}.png`), animations: 'disabled' });
    await page.screenshot({ path: path.join(dir, `${name}-full.png`), animations: 'disabled', fullPage: true });
    checkpoints.push({ name, role, quoteVersion, recordLabel, url: page.url(), layout });
    console.log(`${profile.name}: ${name}`);
  }
  async function inspectDisclosures() {
    const before = JSON.stringify(await project());
    const details = page.locator('.ar-project-details:visible');
    for (let index = 0; index < await details.count(); index++) {
      const detail = details.nth(index);
      const wasOpen = await detail.getAttribute('open');
      if (wasOpen === null) {
        const summary = detail.locator(':scope > summary');
        await summary.focus();
        await page.keyboard.press('Enter');
        assert.equal(await summary.evaluate(element => element === document.activeElement), true, 'Disclosure retains keyboard focus');
        assert.notEqual(await detail.getAttribute('open'), null);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'Expanded details remain in viewport');
        await page.keyboard.press('Space');
        assert.equal(await detail.getAttribute('open'), null, 'Space closes the disclosure');
      }
    }
    assert.equal(JSON.stringify(await project()), before, 'Reading details cannot mutate project records');
  }
  async function manualActions() {
    const {projectId:manualId,draftId,inquiryStore,reviewStore,finalStore,changeStore,nextStore} = await nativeCommercialFixture(originalContext);
    const manualContext = await browser.newContext({ viewport: { width: profile.width, height: profile.height }, deviceScaleFactor: profile.deviceScaleFactor || 1, isMobile: Boolean(profile.isMobile), hasTouch: Boolean(profile.hasTouch) });
    const manual = await manualContext.newPage();
    manual.setDefaultTimeout(30000);
    manual.on('pageerror', error => errors.push({stage:'manual',message:error.message}));
    const key = 'annora.product-room.projects.v1';
    const record = () => manual.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
    const nativeCheck = async name => {
      stage = name;
      await manual.locator('.ar-project-context').waitFor();
      assert.equal(await manual.locator('.wt-handoff:visible').count(), 0, `${name}: no walkthrough controls`);
      assert.ok(await manual.locator('.ar-project-primary:visible button').count() > 0, `${name}: native primary remains available`);
      assert.equal(await manual.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${name}: no overflow`);
      const before = JSON.stringify(await record());
      await manual.reload({waitUntil:'domcontentloaded'});
      await manual.locator('.ar-project-context').waitFor();
      assert.equal(JSON.stringify(await record()), before, `${name}: reload preserves stored records`);
      await manual.screenshot({path:path.join(dir, `${name}.png`),animations:'disabled',fullPage:true});
    };
    try {
      await manual.goto(base.href, {waitUntil:'domcontentloaded'});
      await manual.evaluate(({key,data}) => localStorage.setItem(key, JSON.stringify(data)), {key,data:inquiryStore});
      await manual.goto(new URL(`studio/?product=kinetic-01#project?id=${encodeURIComponent(manualId)}&tab=inquiry`,base).href,{waitUntil:'domcontentloaded'});
      await nativeCheck('08-manual-seller-inquiry');
      const inquiryPrimary = manual.locator('.ar-project-primary:visible button').first();
      assert.equal(await inquiryPrimary.isEnabled(), true);
      await inquiryPrimary.click();
      await manual.waitForFunction(() => new URLSearchParams(location.hash.split('?')[1]).get('mode') === 'edit');
      assert.equal((await record()).projects[0].quotes.length, 0, 'Preparing a manual draft does not issue');
      await manual.evaluate(({key,data}) => localStorage.setItem(key, JSON.stringify(data)), {key,data:reviewStore});
      const review = new URL(`studio/?product=kinetic-01#project?id=${encodeURIComponent(manualId)}&tab=quotation&mode=quote-review&draft=${encodeURIComponent(draftId)}`,base);
      await manual.goto(review.href,{waitUntil:'domcontentloaded'});
      await nativeCheck('09-manual-seller-review');
      assert.equal((await record()).projects[0].quotes.length, 0, 'Manual review awaits confirmation');
      await manual.getByRole('button',{name:'Issue demo quotation',exact:true}).click();
      await manual.waitForFunction(key => JSON.parse(localStorage.getItem(key)).projects[0].quotes.length === 1,key);
      await manual.evaluate(({key,data}) => localStorage.setItem(key, JSON.stringify(data)), {key,data:finalStore});
      const latest = finalStore.projects[0].quotes.at(-1);
      await manual.goto(new URL(`product-room/?model=kinetic-01#project&project=${encodeURIComponent(manualId)}&tab=quotation&quote=${encodeURIComponent(latest.id)}`,base).href,{waitUntil:'domcontentloaded'});
      await nativeCheck('10-manual-buyer-quotation');
      const prior = JSON.stringify((await record()).projects[0]);
      await manual.getByRole('button',{name:/Choose next step/}).click();
      await manual.getByRole('heading',{name:/next step/i}).first().waitFor();
      assert.equal(JSON.stringify((await record()).projects[0]), prior, 'Opening a manual response cannot submit it');
      checkpoints.push({name:'manual-native-actions',sellerDraft:true,sellerReviewConfirmation:true,buyerResponse:true,reload:true});
      for (const [kind,data,buttonName,mode] of [['change',changeStore,'Respond to changes','reply'],['next',nextStore,'Confirm next step','ack']]) {
        stage = `manual-v1-to-v2-${kind}`;
        await manual.evaluate(({key,data}) => localStorage.setItem(key, JSON.stringify(data)), {key,data});
        const old = data.projects[0].quotes[0];
        await manual.goto(new URL(`studio/?product=kinetic-01&qa=${kind}#project?id=${encodeURIComponent(manualId)}&tab=quotation&quote=${encodeURIComponent(old.id)}`,base).href,{waitUntil:'domcontentloaded'});
        await manual.locator('.ar-project-context').waitFor();
        assert.match(await manual.locator('.ar-project-context').getAttribute('data-record-label'),/v1\b/);
        await manual.getByRole('button',{name:buttonName,exact:true}).click();
        await manual.waitForFunction(mode => new URLSearchParams(location.hash.split('?')[1]).get('mode') === mode,mode);
        assert.match(await manual.locator('.ar-project-context').getAttribute('data-record-label'),/v2\b/, 'Reply/ack context follows the actual v2 request, not the older selected quotation');
        const preserved = JSON.stringify(await record());
        await manual.reload({waitUntil:'domcontentloaded'});
        await manual.locator('.ar-project-context').waitFor();
        assert.match(await manual.locator('.ar-project-context').getAttribute('data-record-label'),/v2\b/);
        assert.equal(JSON.stringify(await record()),preserved,'Opening/reloading a response cannot mutate records');
        await manual.screenshot({path:path.join(dir,`11-${kind}-v2-context.png`),animations:'disabled'});
        checkpoints.push({name:`native-v1-selection-to-v2-${kind}`,preserved:true});
      }
    } catch (error) {
      await manual.screenshot({path:path.join(dir,'manual-failure.png'),animations:'disabled'}).catch(()=>{});
      await fs.writeFile(path.join(dir,'manual-failure.txt'), await manual.locator('body').innerText().catch(()=>''));
      throw error;
    } finally { await manualContext.close(); }
  }
  try {
    await page.goto(new URL('walkthrough/?viewer=independent&new=1', base).href, { waitUntil: 'domcontentloaded' });
    await waitStep('independent-select');
    sessionId = new URL(page.url()).searchParams.get('walkthrough');
    namespace = `annora.walkthrough.independent.projects.v1.${sessionId}`;
    await advance('independent-select', 'inquiry-open');
    await advance('inquiry-open', 'inquiry-review');
    await advance('inquiry-review', 'inquiry-confirm');
    assert.equal((await store()).projects.length, 0, 'Review does not submit');
    await advance('inquiry-confirm', 'inquiry-project', true);
    const created = (await store()).projects[0];
    projectId = created.id; originalInquiry = structuredClone(created.inquiry); originalContext = structuredClone(created.context);
    await advance('inquiry-project', 'handoff-seller-quotation');
    await advance('handoff-seller-quotation', 'seller-review-sample-quotation');
    await checkpoint('01-seller-inquiry', { role: 'seller' });
    await inspectDisclosures();
    await advance('seller-review-sample-quotation', 'seller-confirm-quotation');
    assert.equal((await project()).quotes.length, 0, 'Seller review cannot issue automatically');
    await checkpoint('02-seller-v1-review', { role: 'seller', quoteVersion: 1 });
    await inspectDisclosures();
    await advance('seller-confirm-quotation', 'handoff-buyer-change', true);
    originalQuote = structuredClone((await project()).quotes[0]);
    await advance('handoff-buyer-change', 'change-review');
    await checkpoint('03-buyer-v1', { role: 'buyer', quoteVersion: 1 });
    await inspectDisclosures();
    await advance('change-review', 'change-confirm');
    assert.equal((await project()).changes.length, 0, 'Change review remains unconfirmed');
    await advance('change-confirm', 'handoff-seller-revision', true);
    await advance('handoff-seller-revision', 'seller-review-sample-quotation');
    await advance('seller-review-sample-quotation', 'seller-confirm-quotation');
    assert.equal((await project()).quotes.length, 1, 'Revised review cannot issue automatically');
    await checkpoint('04-seller-v2-review', { role: 'seller', quoteVersion: 2, comparison: true });
    await advance('seller-confirm-quotation', 'handoff-buyer-compare', true);
    await advance('handoff-buyer-compare', 'next-review');
    await checkpoint('05-buyer-v2-comparison', { role: 'buyer', quoteVersion: 2, comparison: true });
    const version = page.getByLabel('Quote version', { exact: true });
    await version.selectOption(originalQuote.id);
    await waitStep('latest-quotation');
    await checkpoint('06-buyer-historical-v1', { role: 'buyer', quoteVersion: 1 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitStep('latest-quotation');
    await checkpoint('07-historical-reload', { role: 'buyer', quoteVersion: 1 });
    await advance('latest-quotation', 'next-review');
    await checkHistory();
    assert.equal((await project()).quotes.length, 2);
    assert.equal((await project()).changes.length, 1);
    await manualActions();
    assert.deepEqual(errors, []); assert.deepEqual(networkErrors, []);
    const result = { status: 'passed', profile, base: base.href, timestamp: new Date().toISOString(), sessionId, projectId, checkpoints, advances, errors, networkErrors, limitations: ['Chromium emulation; not a physical-phone or ordinary-computer benchmark.', 'Full commercial confirmation and reference-return coverage lives in the existing W60 journey.'] };
    await fs.writeFile(path.join(dir, 'result.json'), JSON.stringify(result, null, 2));
    results.push({ profile: profile.name, status: 'passed', checkpoints: checkpoints.length });
  } catch (error) {
    const failure = { status: 'failed', stage, profile, url: page.url(), error: { message: error.message, stack: error.stack }, checkpoints, advances, errors, networkErrors, body: await page.locator('body').innerText().catch(() => '') };
    await fs.writeFile(path.join(dir, 'failure.json'), JSON.stringify(failure, null, 2));
    await page.screenshot({ path: path.join(dir, 'failure.png'), animations: 'disabled' }).catch(() => {});
    results.push({ profile: profile.name, status: 'failed', stage, message: error.message });
    console.error(`${profile.name}: ${stage}: ${error.message}`);
  } finally { await context.close(); }
}
try { for (const profile of profiles) { await run(profile); if (process.env.FAIL_FAST === '1' && results.at(-1)?.status === 'failed') break; } }
finally { await fs.writeFile(path.join(out, 'summary.json'), JSON.stringify({ base: base.href, results }, null, 2)); await browser.close(); }
console.log(JSON.stringify(results, null, 2));
if (results.some(result => result.status !== 'passed')) process.exitCode = 1;
