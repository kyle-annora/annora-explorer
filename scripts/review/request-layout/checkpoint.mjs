/** Presentation acceptance layered on the unchanged W60 business journey. */
import assert from 'node:assert/strict';

export async function requestLayoutCheckpoint(page, name) {
  const panel = page.locator('.ei-panel:visible');
  const workspace = page.locator('.pw-review-task:visible, .customer-message-page:visible');
  const root = await panel.count() ? panel : await workspace.count() ? workspace : null;
  if (!root) return null;
  assert.equal(await page.locator('.ar-project-context:visible').count(), 1, `${name}: one project identity`);
  assert.equal(await root.locator('.ar-project-primary:visible').count(), 0, `${name}: guided primary is not duplicated`);
  assert.equal(await root.locator('.pw-progress:visible, .ei-progress:visible').count(), 0, `${name}: no competing stepper`);
  assert.equal(await root.locator('.ei-task h2:visible, .ar-project-task h1:visible').count(), 1, `${name}: one current task`);
  const details = root.locator('.ar-project-details:visible');
  // Error and stage changes deliberately focus their heading on the next frame.
  // Let that app-owned focus settle before exercising a fresh keyboard action.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const records = () => page.evaluate(() => JSON.stringify(Object.fromEntries(Object.keys(localStorage).filter(key => key.includes('projects')).map(key => {
    try { return [key, JSON.parse(localStorage.getItem(key)).projects || []]; } catch { return [key, null]; }
  }))));
  const initial = await records();
  if (await details.count()) {
    const detail = details.last();
    if (await detail.getAttribute('open') === null) {
      const summary = detail.locator(':scope > summary');
      await summary.focus();
      assert.equal(await summary.evaluate(el => el === document.activeElement), true, `${name}: reference receives focus`);
      await page.keyboard.press('Enter');
      await detail.evaluate(el => new Promise(resolve => requestAnimationFrame(resolve)));
      assert.notEqual(await detail.getAttribute('open'), null, `${name}: reference details open by keyboard`);
      assert.equal(await summary.evaluate(el => el === document.activeElement), true, `${name}: reference retains focus`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${name}: expanded reference fits`);
      await page.keyboard.press('Space');
      assert.equal(await detail.getAttribute('open'), null, `${name}: reference closes by keyboard`);
    }
  }
  assert.equal(await records(), initial, `${name}: reading references cannot change confirmed records`);
  if (await panel.count()) await panel.locator('.ei-scroll').evaluate(el => { el.scrollTop = 0; });
  else await page.evaluate(() => scrollTo(0, 0));
  return { oneContext: true, oneTask: true, noDuplicatePrimary: true, noCompetingStepper: true, keyboardReference: true };
}
