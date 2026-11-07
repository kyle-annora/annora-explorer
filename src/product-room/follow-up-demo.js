import { BUNDLED_RELEASE, STUDIO_MODEL } from '../studio/seed.js';
import { contextForRelease } from './release-content.js';
import { createDemoProjectRepository, parseProjectStore } from './project-repository.js';
import { reviewInquiry, sameProjectValue } from './project-domain.js';
import { reviewReply } from './seller-domain.js';

export const FOLLOW_UP_DEMO_ID = 'crank-review-v1';
export const FOLLOW_UP_DEMO_KEY = `annora.follow-up.demo.${FOLLOW_UP_DEMO_ID}`;
const copy = value => JSON.parse(JSON.stringify(value));
const problem = message => Object.assign(new Error(message), { code: 'FOLLOW_UP_DEMO_UNAVAILABLE' });
const makeRepository = options => Object.freeze({ ...createDemoProjectRepository({ ...options, key: FOLLOW_UP_DEMO_KEY }), mode: 'follow-up-demo' });

/** A distributable fictional fixture only. Never accepts or exports a local customer project. */
export async function buildFollowUpDemo() {
  const memory = new Map(); let serial = 0;
  const repository = makeRepository({ storage: { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) },
    locks: null, makeId: prefix => `${prefix}-FOLLOWUP-EXAMPLE-${String(++serial).padStart(3, '0')}`, now: () => '2026-11-06T12:00:00.000Z' });
  const release = copy(BUNDLED_RELEASE);
  release.id = 'ROOM-kinetic-01-follow-up-example-v1';
  release.presentation.story = { version: 1, title: 'Motion and mounting', steps: STUDIO_MODEL.tour.chapters.slice(0, 2).map(chapter => ({
    id: `example-${chapter.id}`, kind: 'chapter', title: chapter.title, caption: chapter.caption,
    nodeId: chapter.selectedId, tourId: STUDIO_MODEL.tour.id, chapterId: chapter.id,
  })) };
  const context = contextForRelease(release);
  let draft = await repository.getDraft(context);
  draft.values = { ...draft.values, name: 'Alex Morgan', email: 'alex@example.com', company: 'Example Motion Works',
    application: 'Review a crank-slider study for a compact assembly demonstration.', quantity: '2' };
  draft.requestItems = [
    { id: 'example-motion', purpose: 'question', notes: 'Explain how rotary motion becomes straight travel.', context: { ...copy(context), part: { id: 'rod', title: 'Connecting rod' } } },
    { id: 'example-mounting', purpose: 'question', notes: 'Confirm the mounting approach before our engineering discussion.', context: { ...copy(context), part: { id: 'guide', title: 'Linear guide' } } },
  ];
  draft = await repository.saveDraft(draft);
  let project = await repository.submitInquiry(reviewInquiry(draft));
  project = await repository.createSampleQuote(project.id);
  project = await repository.sendReply(reviewReply(project, { kind: 'clarification', body: 'Which mounting envelope should we review for the demonstration?', changeId: null, resolutions: [] }));
  let followUp = await repository.getFollowUpDraft(project.id);
  followUp = await repository.saveFollowUpDraft({ ...followUp, title: 'Your motion and mounting review',
    introduction: 'See the motion, look inside the mechanism, then review quotation v1. This is a fictional project for demonstration.',
    stepIds: release.presentation.story.steps.map(step => `story:${step.id}`), requestItemIds: draft.requestItems.map(item => item.id),
    nextAction: { kind: 'quotation', quoteId: project.quotes[0].id, quoteVersion: 1 } });
  const published = await repository.publishFollowUp(await repository.reviewFollowUp(project.id), { confirmed: true });
  return { schemaVersion: 1, id: FOLLOW_UP_DEMO_ID, classification: 'public-fictional-example',
    projectId: project.id, followUpId: published.id, store: parseProjectStore(memory.get(FOLLOW_UP_DEMO_KEY)) };
}

/** An explicit fixture selects a separate namespace. Never falls back to normal projects. */
export async function loadFollowUpDemo(parameters = new URLSearchParams(globalThis.location?.search || ''), options = {}) {
  if (!parameters.has('followUpDemo')) return null;
  if (['followUpDemo', 'project', 'followUp', 'model', 'release'].some(key => parameters.getAll(key).length > 1)
      || parameters.get('followUpDemo') !== FOLLOW_UP_DEMO_ID || parameters.has('walkthrough') || parameters.has('studioPreview'))
    throw problem('This public follow-up example link is incomplete or contains conflicting versions. Existing projects have not been opened.');
  let storage;
  try { storage = options.storage || globalThis.localStorage; if (!storage) throw new Error(); }
  catch { throw problem('Browser storage is unavailable. Enable storage to open this isolated fictional example.'); }
  const fixture = await buildFollowUpDemo();
  const originalProject = fixture.store.projects.find(project => project.id === fixture.projectId);
  const originalFollowUp = fixture.store.followUps.find(followUp => followUp.id === fixture.followUpId);
  if (parameters.has('project') && parameters.get('project') !== fixture.projectId
      || parameters.has('model') && parameters.get('model') !== originalProject.context.modelId
      || parameters.has('release') && parameters.get('release') !== originalProject.context.roomReleaseId)
    throw problem('This example link names a different project or source version. Open the original fictional example link.');
  const requestedFollowUpId = parameters.has('followUp') ? parameters.get('followUp') : fixture.followUpId;
  function validateExample(store) {
    const project = store.projects.find(project => project.id === fixture.projectId);
    const baseline = store.followUps?.find(followUp => followUp.id === fixture.followUpId);
    if (!project || !sameProjectValue(project.context, originalProject.context)
        || !sameProjectValue(project.inquiry, originalProject.inquiry)
        || !sameProjectValue(project.quotes[0], originalProject.quotes[0])
        || !sameProjectValue(baseline, originalFollowUp))
      throw problem('The saved example does not match this published fixture. Its data has not been overwritten.');
    const selected = store.followUps.find(followUp => followUp.id === requestedFollowUpId);
    if (!selected || selected.projectId !== fixture.projectId)
      throw problem('This follow-up version is not saved in this browser. Open the original fictional example, or return to the browser where this version was created.');
  }
  const install = async () => {
    let raw;
    try { raw = storage.getItem(FOLLOW_UP_DEMO_KEY); }
    catch { throw problem('The saved example could not be read. Existing projects have not been changed.'); }
    if (raw === null) {
      validateExample(fixture.store);
      try { const encoded = JSON.stringify(fixture.store); storage.setItem(FOLLOW_UP_DEMO_KEY, encoded); if (storage.getItem(FOLLOW_UP_DEMO_KEY) !== encoded) throw new Error(); }
      catch { throw problem('The fictional example could not be saved. Enable browser storage and try again.'); }
    } else validateExample(parseProjectStore(raw));
  };
  const locks = Object.hasOwn(options, 'locks') ? options.locks : globalThis.navigator?.locks;
  if (locks?.request) await locks.request(`annora:${FOLLOW_UP_DEMO_KEY}`, install); else await install();
  return { repository: makeRepository({ storage, ...(Object.hasOwn(options, 'locks') ? { locks } : {}) }), projectId: fixture.projectId, followUpId: requestedFollowUpId };
}

export function followUpURL(release, base = globalThis.location?.href || 'http://localhost/studio/') {
  const url = new URL('../product-room/', base), source = new URL(base);
  if (source.searchParams.has('followUpDemo')) {
    if (source.searchParams.getAll('followUpDemo').length !== 1 || source.searchParams.get('followUpDemo') !== FOLLOW_UP_DEMO_ID || source.searchParams.has('walkthrough'))
      throw problem('This example link has conflicting identities. Reopen the original example before sharing a follow-up.');
    url.searchParams.set('followUpDemo', FOLLOW_UP_DEMO_ID);
  }
  if (source.searchParams.has('walkthrough')) url.searchParams.set('walkthrough', source.searchParams.get('walkthrough'));
  url.searchParams.set('model', release.context.modelId); url.searchParams.set('project', release.projectId);
  url.searchParams.set('followUp', release.id); url.hash = 'explore';
  return url.href;
}
