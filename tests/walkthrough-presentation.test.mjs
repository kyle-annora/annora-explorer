import test from 'node:test';
import assert from 'node:assert/strict';
import { walkthroughPresentation } from '../src/walkthrough/presentation.js';

test('the visible step follows the host review instead of the broader commercial stage', () => {
  const action = Object.freeze({
    id: 'inquiry-confirm', title: 'Review your inquiry.', confirmation: true,
    run() { throw new Error('Presentation must never execute an action.'); },
  });
  const flow = Object.freeze({ title: 'Get a quotation.' });
  assert.deepEqual(walkthroughPresentation({ role: 'buyer', chapter: 2, action, flow }), {
    chapterLabel: '2 / 3 · Get a quotation',
    title: 'Review your inquiry.',
    roleLabel: 'Buyer view',
    nextRoleLabel: '',
    buttonLabel: 'Confirm & continue',
  });
});

test('both handoff directions identify the current and next role before activation', () => {
  for (const [role, nextRole] of [['buyer', 'seller'], ['seller', 'buyer']]) {
    const result = walkthroughPresentation({ role, chapter: 3,
      action: { id: `handoff-${nextRole}-revision`, title: 'A broader instruction.' },
      flow: { title: 'Respond to a change.' },
    });
    assert.equal(result.roleLabel, role === 'seller' ? 'Seller view' : 'Buyer view');
    assert.equal(result.nextRoleLabel, `Next: ${nextRole}`);
    assert.equal(result.title, `Continue as ${nextRole}.`);
    assert.equal(result.buttonLabel, 'Continue demo');
  }
});

test('ordinary steps fall back to flow guidance without implying a role switch', () => {
  const result = walkthroughPresentation({ role: 'buyer', chapter: 1,
    action: { id: 'mechanism-cycle' }, flow: { role: 'seller', title: 'Start with the mechanism.' },
  });
  assert.equal(result.chapterLabel, '1 / 3 · Understand the product');
  assert.equal(result.title, 'Start with the mechanism.');
  assert.equal(result.nextRoleLabel, '');
  assert.equal(result.buttonLabel, 'Continue demo');
});

test('untitled host actions distinguish preparation from the current review boundary', () => {
  const flow = { title: 'Turn the inquiry into a reviewed quotation.' };
  for (const [id, title] of [
    ['inquiry-review', 'Prepare your inquiry'],
    ['inquiry-confirm', 'Review your inquiry'],
    ['seller-review-sample-quotation', 'Prepare the quotation'],
    ['seller-confirm-quotation', 'Review the quotation'],
    ['change-confirm', 'Review requested changes'],
    ['next-confirm', 'Review your next step'],
    ['seller-confirm-response', 'Review your response'],
  ]) {
    assert.equal(walkthroughPresentation({ role: 'buyer', chapter: 2, action: { id }, flow }).title, title);
  }
  assert.equal(walkthroughPresentation({ role: 'buyer', chapter: 1,
    action: { id: 'mechanism-cycle', title: 'See the motion, then discuss the part.' }, flow,
  }).title, 'See the motion, then discuss the part.');
});

test('all review boundaries keep a distinct confirmation label', () => {
  for (const id of ['inquiry-confirm', 'seller-confirm-quotation', 'change-confirm', 'next-confirm', 'seller-confirm-response', 'reply-confirm']) {
    const result = walkthroughPresentation({ role: 'seller', chapter: 3, action: { id, confirmation: true } });
    assert.equal(result.buttonLabel, 'Confirm & continue', id);
    assert.equal(result.nextRoleLabel, '', id);
  }
});

test('busy presentation takes priority, and completion never looks like another confirmation', () => {
  for (const action of [{ id: 'complete' }, { id: 'inquiry-confirm', confirmation: true }]) {
    assert.equal(walkthroughPresentation({ role: 'buyer', chapter: 3, action, locked: true }).buttonLabel, 'Please wait…');
  }
  const result = walkthroughPresentation({ role: 'buyer', chapter: 3,
    action: { id: 'complete', confirmation: true }, flow: { title: 'The next step is agreed.' },
  });
  assert.equal(result.buttonLabel, 'Demo complete');
  assert.equal(result.chapterLabel, '3 / 3 · Resolve and move forward');
  assert.equal(result.title, 'The next step is agreed.');
});
