import { ProjectError, cloneProjectValue as copy, sameProjectValue as same, assertReview } from './project-domain.js';
import { drawingReferenceKey } from './drawing-context.js';
import { proposeDrawingImpact, reviewDrawingImpact, createImpactScope, validateImpactProject } from './impact-domain.js';

/** The existing project transaction owns these writes. A production adapter must authorize the seller and revalidate the release. */
export function createImpactRepositoryMethods({read,change,findProject,now,makeId,drawingRelease,sellerProjection,enabled}) {
  const requireEnabled=()=>{if (!enabled) throw new ProjectError('UNSUPPORTED_IMPACT','This adapter has not opted into reviewed drawing-impact references.');};
  return {
    supportsDrawingImpact:enabled,
    async proposeDrawingImpact(projectId,input) {
      requireEnabled();const release=await drawingRelease(input),{store}=read(),project=findProject(store,projectId);
      return proposeDrawingImpact(project,input,release,store.quoteDrafts.find(item=>item.projectId===projectId));
    },
    async reviewDrawingImpact(projectId,input) {
      requireEnabled();const release=await drawingRelease(input),{store}=read(),project=findProject(store,projectId),draft=store.quoteDrafts.find(item=>item.projectId===projectId);
      if (input.projectRevision!==project.revision || !same(input.quoteDraft,draft)) throw new ProjectError('STALE_REVIEW','The project or quotation changed while you inspected this source. Keep your decisions and check the latest impact again.');
      return reviewDrawingImpact(proposeDrawingImpact(project,input,release,draft),input,now());
    },
    async confirmDrawingImpact(review,{confirmed=false}={}) {
      requireEnabled();if (!confirmed) throw new ProjectError('CONFIRMATION_REQUIRED','Review each affected reference and explicitly confirm the source change.');
      const packet=assertReview(review,'drawing-impact'),release=await drawingRelease(packet);
      return change(store=>{
        const project=findProject(store,packet.projectId);
        if (project.impactReviews?.some(record=>record.reviewToken===review.token)) return sellerProjection(store,project);
        const saved=store.quoteDrafts.find(item=>item.projectId===project.id);
        if (project.revision!==packet.projectRevision || !same(saved,packet.quoteDraft)) throw new ProjectError('STALE_REVIEW','The project or quotation draft changed after impact review. Check the latest source impact before applying your decisions.');
        const expected=reviewDrawingImpact(proposeDrawingImpact(project,packet,release,saved),packet,packet.reviewedAt);
        if (!same(expected,review)) throw new ProjectError('STALE_REVIEW','The exact source or impact decisions changed after review. Review them again.');
        const createdAt=now(),revision=project.revision+1;
        if (drawingReferenceKey(packet.fromContext)!==drawingReferenceKey(packet.context)) {
          project.activeDrawingContext=copy(packet.context);project.drawingRevisions ||= [];
          project.drawingRevisions.push({id:makeId('DRAWING-ADOPTION'),status:'adopted',projectRevision:revision,fromContext:copy(packet.fromContext),context:copy(packet.context),release:copy(release),note:packet.note,quoteDraftAction:'keep',reviewedAt:packet.reviewedAt,createdAt,reviewToken:review.token});
        }
        project.impactPolicy ||= {version:1};project.impactReviews ||= [];
        project.impactReviews.push({id:makeId('IMPACT'),projectRevision:revision,createdAt,reviewToken:review.token,review:copy(packet)});
        project.impactReviewIndex ||= [];
        project.impactReviewIndex.push({id:project.impactReviews.at(-1).id,projectRevision:revision,reviewToken:review.token});
        project.revision=revision;project.updatedAt=createdAt;
        saved.context=copy(packet.context);saved.projectRevision=revision;saved.impactScope=createImpactScope(project);saved.revision++;saved.updatedAt=createdAt;
        validateImpactProject(project,[saved]);
        return sellerProjection(store,project);
      });
    },
  };
}
export function assertImpactScopeRoundTrip(expected,actual) {
  if (!same(expected?.impactScope,actual?.impactScope)) throw new ProjectError('IMPACT_DATA_LOSS','The adapter did not preserve the reviewed drawing-impact evidence. Reopen the saved draft before continuing.');
  return actual;
}
export function assertImpactRoundTrip(review,project) {
  const packet=assertReview(review,'drawing-impact'),record=project?.impactReviews?.find(item=>item.reviewToken===review.token);
  try {
    if (!record || project.id!==packet.projectId || record.projectRevision!==packet.projectRevision+1 || !same(record.review,packet)) throw Error();
    validateImpactProject(project,project.quoteDraft ? [project.quoteDraft] : []);
    if (!project.quoteDraft || !same(project.quoteDraft.values,packet.quoteDraft.values) || project.quoteDraft.revision!==packet.quoteDraft.revision+1 || !same(project.quoteDraft.context,packet.context) || !same(project.quoteDraft.impactScope,createImpactScope(project))) throw Error();
  } catch { throw new ProjectError('IMPACT_DATA_LOSS','The adapter did not preserve the confirmed source impact and quotation draft. Reopen the saved project before continuing.'); }
  return project;
}

export const assertDrawingImpactRoundTrip = assertImpactRoundTrip;
export function assertDrawingImpactRepository(repository) {
  if (repository?.supportsDrawingImpact !== true || !['proposeDrawingImpact','reviewDrawingImpact','confirmDrawingImpact','getSellerProject','saveQuoteDraft','issueQuote'].every(name=>typeof repository[name]==='function')) throw new ProjectError('UNSUPPORTED_IMPACT','This adapter cannot preserve reviewed source-impact decisions.');
  return repository;
}
