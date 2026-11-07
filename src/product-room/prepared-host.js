import { createDemoProjectRepository } from './project-repository.js';

/** Product-scoped demo storage. Existing crank and customer stores keep their keys. */
export function preparedProjectRepository(product, options = {}) {
  if (!product || product.id === 'kinetic-01') return createDemoProjectRepository(options);
  const repository = createDemoProjectRepository({
    key: `annora.prepared-product.${product.id}.projects.v1`,
    drawingWorkflow: Boolean(product.technicalReferences?.length),
    commercialProduct: product.capabilities?.quotation?.available ? {id:product.id, modelRevision:product.model.revision} : undefined,
    ...options,
  });
  function assertContext(context) {
    if (context?.productId !== product.id || context?.modelId !== product.model.id || context?.modelRevision !== product.model.revision)
      throw Object.assign(new Error('This request belongs to another prepared product or model version. Open its original Product Room; saved records have not changed.'), { code: 'INCOMPATIBLE_PRODUCT' });
  }
  // The host's product switch cannot accidentally write a different model into
  // this product's store. Existing history stays readable under its own identity.
  return Object.freeze({ ...repository,
    async getDraft(context) { assertContext(context); return repository.getDraft(context); },
    async saveDraft(draft) { assertContext(draft?.context); return repository.saveDraft(draft); },
    async submitInquiry(review) { assertContext(review?.draft?.context); return repository.submitInquiry(review); },
    async createSampleInquiry(context) { assertContext(context); return repository.createSampleInquiry(context); },
  });
}
