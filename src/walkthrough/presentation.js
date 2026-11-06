import { WALKTHROUGH_CHAPTERS } from './flow.js';

const actionTitles = Object.freeze({
  'inquiry-review': 'Prepare your inquiry',
  'inquiry-confirm': 'Review your inquiry',
  'inquiry-resume': 'Continue your saved inquiry',
  'inquiry-recovery': 'Resolve the saved draft',
  'inquiry-project': 'Open your saved project',
  'seller-review-sample-quotation': 'Prepare the quotation',
  'seller-review-current-quotation': 'Review your draft',
  'seller-confirm-quotation': 'Review the quotation',
  'change-review': 'Request a revision',
  'change-confirm': 'Review requested changes',
  'next-review': 'Choose the next step',
  'next-confirm': 'Review your next step',
  'seller-review-acknowledgement': 'Reply to the next-step request',
  'seller-confirm-response': 'Review your response',
  'seller-review-current-reply': 'Review your reply',
  'reply-review': 'Prepare your reply',
  'reply-confirm': 'Review your reply',
  'latest-quotation': 'Open the latest quotation',
  'completed-conversation': 'View the agreed next step',
  'return-to-project': 'Return to your project',
});

/** Labels only: the host still owns every review, confirmation and handoff. */
export function walkthroughPresentation({ role, chapter, action = {}, flow = {}, locked = false }) {
  const currentChapter = WALKTHROUGH_CHAPTERS.find(item => item.id === chapter)
    || WALKTHROUGH_CHAPTERS[0];
  const nextRole = /^handoff-(buyer|seller)-/.exec(action.id || '')?.[1];
  return {
    chapterLabel: `${currentChapter.id} / ${WALKTHROUGH_CHAPTERS.length} · ${currentChapter.title}`,
    title: nextRole ? `Continue as ${nextRole}.` : action.title || actionTitles[action.id] || flow.title || '',
    roleLabel: role === 'seller' ? 'Seller view' : 'Buyer view',
    nextRoleLabel: nextRole ? `Next: ${nextRole}` : '',
    buttonLabel: locked ? 'Please wait…'
      : action.id === 'complete' ? 'Demo complete'
      : action.confirmation ? 'Confirm & continue' : 'Continue demo',
  };
}
