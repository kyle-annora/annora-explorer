import { ProjectError, cloneProjectValue as copy, sameProjectValue, assertReview } from './project-domain.js';
import { createFollowUpDraft, normalizeFollowUpDraft, assertFollowUpProject, reviewFollowUp,
  createFollowUpRelease, createFollowUpProgress, normalizeFollowUpProgress } from './follow-up-domain.js';

/** Additive adapter: uses the existing project transaction, lock and storage boundary. */
export function createFollowUpRepositoryMethods({ read, change, findProject, now, makeId }) {
  const findRelease = (store, id) => {
    const release = (store.followUps || []).find(item => item.id === id);
    if (!release) throw new ProjectError('NOT_FOUND', 'This follow-up is not saved in this browser. Open the project to choose an available follow-up.');
    return release;
  };
  const methods = {
    supportsFollowUps: true,
    async getFollowUpDraft(projectId) {
      const { store } = read(), project = findProject(store, projectId);
      return copy((store.followUpDrafts || []).find(item => item.projectId === projectId) || createFollowUpDraft(project, makeId('FOLLOW-UP-DRAFT')));
    },
    async saveFollowUpDraft(input) {
      const draft = normalizeFollowUpDraft(input);
      return change(store => {
        const project = findProject(store, draft.projectId);
        assertFollowUpProject(project, draft, 'CONFLICT');
        const previous = (store.followUpDrafts || []).find(item => item.projectId === draft.projectId);
        if (previous ? previous.id !== draft.id || previous.revision !== draft.revision : draft.revision !== 0)
          throw new ProjectError('CONFLICT', 'Another editor changed this follow-up. Reopen the saved draft before continuing. Your current input has not been submitted.');
        if (previous && sameProjectValue(previous, draft)) return previous;
        const saved = { ...draft, revision: draft.revision + 1, updatedAt: now() };
        store.followUpDrafts = [...(store.followUpDrafts || []).filter(item => item.projectId !== draft.projectId), saved];
        return saved;
      });
    },
    async reviewFollowUp(projectId) {
      const { store } = read(), project = findProject(store, projectId);
      const draft = (store.followUpDrafts || []).find(item => item.projectId === projectId);
      if (!draft) throw new ProjectError('STALE_REVIEW', 'Save the follow-up before reviewing it.');
      return reviewFollowUp(project, draft);
    },
    async publishFollowUp(review, { confirmed = false } = {}) {
      if (!confirmed) throw new ProjectError('CONFIRMATION_REQUIRED', 'Review the follow-up and explicitly confirm this local version.');
      const packet = assertReview(review, 'follow-up');
      return change(store => {
        const previous = (store.followUps || []).find(item => item.reviewToken === review.token);
        if (previous) return previous;
        const project = findProject(store, packet.draft.projectId);
        assertFollowUpProject(project, packet.draft);
        const saved = (store.followUpDrafts || []).find(item => item.projectId === project.id);
        if (!saved || !sameProjectValue(saved, packet.draft) || !sameProjectValue(reviewFollowUp(project, saved), review))
          throw new ProjectError('STALE_REVIEW', 'The saved follow-up changed after review. Review the current draft again before confirming.');
        const release = createFollowUpRelease(review, { id: makeId('FOLLOW-UP'),
          version: (store.followUps || []).filter(item => item.projectId === project.id).length + 1, createdAt: now() });
        store.followUps = [...(store.followUps || []), release];
        // Keep the editable draft for a later revision; published snapshots never change.
        return release;
      });
    },
    async listFollowUps(projectId) {
      const { store } = read(); findProject(store, projectId);
      return copy((store.followUps || []).filter(item => item.projectId === projectId));
    },
    async getFollowUp(id) { return copy(findRelease(read().store, id)); },
    async getFollowUpProgress(id) {
      const { store } = read(), release = findRelease(store, id);
      return copy((store.followUpProgress || []).find(item => item.followUpId === id) || createFollowUpProgress(release));
    },
    async saveFollowUpProgress(id, input) {
      return change(store => {
        const release = findRelease(store, id), progress = normalizeFollowUpProgress(release, input);
        const previous = (store.followUpProgress || []).find(item => item.followUpId === id);
        if ((previous?.revision || 0) !== progress.revision)
          throw new ProjectError('CONFLICT', 'Your saved place changed in another tab. Reopen this follow-up before saving a new position.');
        if (previous && previous.stepId === progress.stepId && previous.mode === progress.mode) return previous;
        const saved = { ...progress, revision: progress.revision + 1, updatedAt: now() };
        store.followUpProgress = [...(store.followUpProgress || []).filter(item => item.followUpId !== id), saved];
        return saved;
      });
    },
  };
  return methods;
}
