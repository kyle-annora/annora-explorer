import { createStudioRepository } from '../studio/repository.js';
import { contextForRelease } from './release-content.js';

/** Resolve commercial content only when intake is opened. Existing drafts keep
 * their captured release; a later Studio publication never updates them here. */
export async function attachInquiryRelease(context, { repository = createStudioRepository() } = {}) {
  if (context.roomSnapshot && context.roomReleaseId) return context;
  const release = await repository.getPublished(context.productId);
  if (!release || release.productId !== context.productId ||
      release.content.modelId !== context.modelId || release.modelRevision !== context.modelRevision)
    throw new Error('This product release does not match the model you are viewing. Open its current product reference before starting a request.');
  return contextForRelease(release, context);
}
