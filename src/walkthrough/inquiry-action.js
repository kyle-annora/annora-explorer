/** A presenter activation performs one visible step, never review and confirm together. */
export function inquiryWalkthroughAction({ state, panel }) {
  if (!state || !panel || state.busy) return { id: 'inquiry-loading', busy: true, disabled: true, run: () => {} };
  if (!state.open || !state.expanded) return {
    id: 'inquiry-resume', note: 'Reopen the saved inquiry before reviewing or confirming it.', run: () => panel.resume(),
  };
  if (state.stage === 'confirmed') return {
    id: 'inquiry-project', note: 'Open the saved project to continue the buyer and seller conversation.', run: () => panel.openProject(),
  };
  if (['CONFLICT', 'STALE_REVIEW', 'RELOAD_FAILED', 'DRAFT_UNAVAILABLE', 'REVIEW_UNAVAILABLE'].includes(state.errorCode)) return {
    id: 'inquiry-recovery', disabled: true, note: 'Keep your entries or explicitly load the saved draft in the inquiry panel.', run: () => {},
  };
  if (!state.hasDraft) return { id: 'inquiry-loading', disabled: true, run: () => {} };
  return state.stage === 'review' ? {
    id: 'inquiry-confirm', confirmation: true, note: 'Confirm the complete inquiry shown beside the product. Nothing is sent.', run: () => panel.confirm(),
  } : {
    id: 'inquiry-review', note: 'Fill empty fields with fictional sample details, then review the complete inquiry before confirming.', run: () => panel.review({ fillSample: true }),
  };
}
