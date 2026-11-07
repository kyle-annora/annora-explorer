/** Compiled independent-host journey; run only while holding the browser lease. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = (process.env.BASE_URL || 'http://127.0.0.1:8167/annora-explorer/integrations/existing-viewer/').replace(/\/?$/, '/');
const width = Number(process.env.WIDTH || 1280), height = Number(process.env.HEIGHT || (width < 600 ? 844 : 900));
const out = process.env.OUT || `work/product-expansion/W50/browser-${width}x${height}`;
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, isMobile: width < 600, hasTouch: width < 600 });
const page = await context.newPage(), errors = [], failedRequests = [], checkpoints = [];
page.on('pageerror', error => errors.push(error.message));
page.on('requestfailed', request => failedRequests.push({ url: request.url(), failure: request.failure()?.errorText }));
const namespace = 'annora.integration-example.projects.v1';
const readStore = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), namespace);
const diagnostics = () => page.evaluate(() => window.annoraExampleDiagnostics());
async function capture(name) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  assert.equal(overflow, false, `${name}: horizontal overflow`);
  assert.equal(await page.locator('#viewer canvas').count(), 1);
  assert.equal(await page.locator('iframe').count(), 0);
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: false });
  checkpoints.push({ name, width, height, overflow, canvasCount: 1 });
  console.log(`PASS ${name}`);
}
async function clickVisible(locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox(); assert.ok(box, 'Action has a box');
  const receivesPointer = await locator.evaluate(element => {
    const rect = element.getBoundingClientRect(), hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return hit === element || element.contains(hit);
  });
  assert.equal(receivesPointer, true, 'The action center receives pointer input');
  await locator.click();
}
let result;
try {
  await page.goto(base);
  await page.locator('#request:enabled').waitFor({ timeout: 60000 });
  await page.evaluate(() => localStorage.setItem('annora.product-room.projects.v1:qualification-sentinel', 'existing-records-unchanged'));
  await capture('independent-viewer-ready');
  let state = await diagnostics();
  assert.equal(state.capabilities.drawingDetail, false); assert.equal(state.capabilities.story, false);
  if (width < 600) assert.ok(state.viewer.drawingBufferDpr <= 1.5);
  await page.locator('#part').selectOption('kinetic-node-001');
  await clickVisible(page.locator('#fit'));
  await clickVisible(page.locator('#request'));
  const panel = page.locator('.ei-panel'); await panel.waitFor();
  const attached = (await diagnostics()).context;
  assert.equal(attached.part.id, 'kinetic-node-001');
  assert.equal(attached.viewerReference.adapter.id, 'annora-example-three-viewer');
  assert.equal(await panel.locator('[name="quoteScope"]').inputValue(), 'part');
  await panel.locator('[name="application"]').fill('Fictional request: review this connecting rod and its saved camera reference.');
  await panel.locator('[name="quantity"]').fill('4');
  await capture('details-selected-part-pinned');
  await page.evaluate(key => {
    window.__qualificationOriginalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(name, value) {
      if (name === key) throw new DOMException('Qualification storage failure', 'QuotaExceededError');
      return window.__qualificationOriginalSetItem.call(this, name, value);
    };
  }, namespace);
  await panel.locator('[name="application"]').fill('Fictional request: keep this connecting rod reference when saving fails.');
  await clickVisible(panel.getByRole('button', { name: 'Keep exploring', exact: true }));
  await panel.waitFor();
  assert.equal(await panel.locator('[name="application"]').inputValue(), 'Fictional request: keep this connecting rod reference when saving fails.');
  assert.equal((await diagnostics()).context.part.id, 'kinetic-node-001');
  assert.equal(await page.locator('.ei-minimized').count(), 0, 'Failed save prevents minimizing');
  await capture('failed-save-retains-editor');
  await page.evaluate(() => { Storage.prototype.setItem = window.__qualificationOriginalSetItem; delete window.__qualificationOriginalSetItem; });
  await clickVisible(panel.getByRole('button', { name: 'Keep exploring', exact: true }));
  await page.locator('.ei-minimized').waitFor();
  await page.locator('#part').selectOption('kinetic-node-002');
  assert.equal((await diagnostics()).context.part.id, 'kinetic-node-001', 'Exploration cannot replace attached context');
  await clickVisible(page.locator('.ei-resume')); await panel.waitFor();
  await clickVisible(panel.getByRole('button', { name: 'Review inquiry', exact: false }));
  await page.getByRole('heading', { name: 'Review your request.', exact: true }).waitFor();
  assert.equal((await readStore()).projects.length, 0, 'Review does not submit');
  await capture('review-before-confirmation');
  await clickVisible(panel.getByRole('button', { name: 'Edit details', exact: true }));
  await panel.locator('[name="quantity"]').fill('6');
  await clickVisible(panel.getByRole('button', { name: 'Review inquiry', exact: false }));
  await clickVisible(panel.getByRole('button', { name: 'Confirm demo inquiry', exact: true }));
  await page.getByRole('heading', { name: 'Inquiry saved.', exact: true }).waitFor();
  const original = structuredClone((await readStore()).projects[0]);
  assert.equal(original.inquiry.values.quantity, '6');
  assert.deepEqual(original.context, attached);
  assert.equal((await readStore()).projects.length, 1);
  await capture('confirmed-local-inquiry');
  await clickVisible(panel.getByRole('button', { name: 'View saved inquiry', exact: false }));
  await page.locator('#saved:not([hidden])').waitFor();
  await capture('saved-project-and-version');
  await clickVisible(page.locator('#saved-close'));
  await clickVisible(page.locator('#reset'));
  await clickVisible(page.locator('#saved-open'));
  await clickVisible(page.getByRole('button', { name: 'View saved reference', exact: true }));
  assert.equal(await page.locator('#part').inputValue(), 'kinetic-node-001');
  state = await diagnostics();
  assert.ok(state.viewer.camera, 'Read-only camera evidence is available');
  const expected = original.context.viewerReference.snapshot.camera;
  for (const key of ['position', 'target', 'up'])
    expected[key].forEach((value, index) => assert.ok(Math.abs(value - state.viewer.camera[key][index]) < 1e-8, `Saved ${key}[${index}] restored`));
  assert.deepEqual(state.viewer.camera.projection, expected.projection);
  assert.deepEqual((await readStore()).projects[0], original);
  await capture('exact-saved-camera-restored');
  const beforeIdle = (await diagnostics()).viewer.renderCount;
  await page.waitForTimeout(400);
  const afterIdle = (await diagnostics()).viewer.renderCount;
  assert.ok(afterIdle - beforeIdle <= 2, 'No continuous idle rendering');
  await page.reload(); await page.locator('#request:enabled').waitFor({ timeout: 60000 });
  await clickVisible(page.locator('#saved-open'));
  assert.equal(await page.locator('#saved-list article').count(), 1);
  assert.deepEqual((await readStore()).projects[0], original);
  assert.equal(await page.evaluate(() => localStorage.getItem('annora.product-room.projects.v1:qualification-sentinel')), 'existing-records-unchanged');
  await capture('reload-preserves-local-history');
  await clickVisible(page.locator('#saved-close'));
  await page.evaluate(() => {
    dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
    dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  });
  assert.equal((await diagnostics()).state.ready, true, 'A retained page keeps its viewer alive');
  await page.locator('#part').selectOption('kinetic-node-002');
  assert.equal((await diagnostics()).state.selectedPart.id, 'kinetic-node-002');
  await capture('retained-page-still-interactive');
  await page.evaluate(() => { window.__qualificationPageShowPersisted = false; addEventListener('pageshow', event => { window.__qualificationPageShowPersisted = event.persisted; }); });
  await page.goto('about:blank'); await page.goBack(); await page.locator('#request:enabled').waitFor({ timeout: 60000 });
  const actualBackForwardCache = await page.evaluate(() => window.__qualificationPageShowPersisted === true);
  assert.equal((await diagnostics()).state.ready, true);
  assert.deepEqual((await readStore()).projects[0], original);
  await capture('real-back-navigation');
  const validBytes = await page.evaluate(key => localStorage.getItem(key), namespace);
  await page.evaluate(key => localStorage.setItem(key, '{"schemaVersion":999,"unsupported":true}'), namespace);
  await page.reload(); await page.locator('#request:enabled').waitFor({ timeout: 60000 });
  await page.locator('#host-error:not([hidden])').waitFor();
  assert.equal((await diagnostics()).state.ready, true, 'Storage failure does not destroy the viewer');
  assert.equal(await page.evaluate(key => localStorage.getItem(key), namespace), '{"schemaVersion":999,"unsupported":true}');
  await capture('unsupported-store-preserved-viewer-remains');
  await page.evaluate(({ key, bytes }) => localStorage.setItem(key, bytes), { key: namespace, bytes: validBytes });
  assert.deepEqual(errors, []); assert.deepEqual(failedRequests, []);
  result = { status: 'passed', base, width, height, checkpoints, projectId: original.id, context: original.context, diagnostics: state,
    idleFramesOver400ms: afterIdle - beforeIdle, actualBackForwardCache, syntheticRetainedPagePassed: true, storageFailurePassed: true,
    pageErrors: errors, failedRequests, existingStoreSentinelUnchanged: true,
    limitation: 'Chrome emulation on this machine; not a physical-mobile or ordinary-PC benchmark.' };
} catch (error) {
  result = { status: 'failed', base, width, height, checkpoints, error: { message: error.message, stack: error.stack }, pageErrors: errors, failedRequests };
  await page.screenshot({ path: `${out}/failure.png`, fullPage: true }).catch(() => {});
  await writeFile(`${out}/failure.txt`, await page.locator('body').innerText()).catch(() => {});
  process.exitCode = 1; console.error(error);
} finally {
  await writeFile(`${out}/result.json`, JSON.stringify(result, null, 2) + '\n');
  await browser.close();
}
