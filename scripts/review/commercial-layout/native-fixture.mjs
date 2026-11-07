/** Isolated native-workspace fixtures created through the existing domain API.
 * They deliberately do not transplant an external-viewer walkthrough record. */
import { createDemoProjectRepository, PROJECT_STORAGE_KEY } from '../../../src/product-room/project-repository.js';
import { reviewQuote } from '../../../src/product-room/seller-domain.js';
import { reviewRevision, reviewNextStep } from '../../../src/product-room/project-domain.js';

export async function nativeCommercialFixture(context) {
  const map = new Map();
  const storage = { getItem: key => map.get(key) || null, setItem: (key, value) => map.set(key, value) };
  const repository = createDemoProjectRepository({storage,locks:null});
  const snapshot = () => JSON.parse(map.get(PROJECT_STORAGE_KEY));
  const nativeContext = Object.fromEntries(['productId','modelId','modelRevision','productTitle','part'].filter(key => context[key] !== undefined).map(key => [key,context[key]]));
  const project = await repository.createSampleInquiry(nativeContext);
  const inquiryStore = snapshot();
  let draft = await repository.getQuoteDraft(project.id);
  draft.values.lineItems[0].unitPrice = '185';
  draft = await repository.saveQuoteDraft(draft);
  const reviewStore = snapshot(), draftId = draft.id;
  await repository.issueQuote(reviewQuote(await repository.getProject(project.id), draft));
  draft = await repository.getQuoteDraft(project.id);
  draft.values.quantity = '30'; draft.values.lineItems[0].quantity = '30'; draft.values.lineItems[0].unitPrice = '175';
  draft = await repository.saveQuoteDraft(draft);
  await repository.issueQuote(reviewQuote(await repository.getProject(project.id), draft));
  const finalStore = snapshot(), current = await repository.getProject(project.id), latest = current.quotes.at(-1);
  await repository.requestRevision(reviewRevision(current, latest.id, {quantity:'35',targetWeeks:'5',notes:'Confirm the revised mounting scope.'}));
  const changeStore = snapshot();
  map.set(PROJECT_STORAGE_KEY, JSON.stringify(finalStore));
  await repository.confirmNextStep(reviewNextStep(await repository.getProject(project.id), latest.id, {intent:'engineering-review',message:'Review the mounting interfaces with engineering.'}));
  const nextStore = snapshot();
  return {projectId:project.id,draftId,inquiryStore,reviewStore,finalStore,changeStore,nextStore};
}
