import { ProjectError, cloneProjectValue as copy, sameProjectValue as same, assertReview } from './project-domain.js';
import { reviewOptionSet, reviewOptionPreference } from './option-scope-domain.js';

/** Additive, browser-local adapter operations. A production host must opt in and retain every snapshot. */
export function createOptionScopeRepositoryMethods({read,change,findProject,now,makeId}) {
  return {
    supportsOptionScope:true,
    async approveOptionSet(review,{confirmed=false}={}) {
      if(!confirmed)throw new ProjectError('CONFIRMATION_REQUIRED','Review the comparison and explicitly confirm the approved packages.');
      const packet=assertReview(review,'option-set');
      return change(store=>{
        const project=findProject(store,packet.projectId);
        if(project.optionSetApproval?.reviewToken===review.token)return project;
        if(project.revision!==packet.projectRevision)throw new ProjectError('STALE_REVIEW','The project changed. Review the package sources again.');
        if(!same(reviewOptionSet(project,packet.optionSet),review))throw new ProjectError('STALE_REVIEW','The comparison changed after review.');
        const createdAt=now();
        project.approvedOptionSet=copy(packet.optionSet);
        project.optionSetApproval={projectRevision:project.revision+1,createdAt,reviewToken:review.token};
        project.optionPreferences=[];project.revision++;project.updatedAt=createdAt;
        return project;
      });
    },
    async reviewOptionPreference(projectId,input) {return reviewOptionPreference(findProject(read().store,projectId),input);},
    async confirmOptionPreference(review,{confirmed=false}={}) {
      if(!confirmed)throw new ProjectError('CONFIRMATION_REQUIRED','Review your preference and explicitly confirm it.');
      const packet=assertReview(review,'option-preference');
      return change(store=>{
        const project=findProject(store,packet.projectId);
        if((project.optionPreferences || []).some(event=>event.reviewToken===review.token))return project;
        if(project.revision!==packet.projectRevision||!same(reviewOptionPreference(project,packet),review))throw new ProjectError('STALE_REVIEW','The project or available packages changed. Review your preference again.');
        const {kind,...payload}=packet,createdAt=now();
        project.optionPreferences=[...(project.optionPreferences || []),{...payload,id:makeId('PREFERENCE'),version:(project.optionPreferences || []).length+1,projectRevision:project.revision+1,createdAt,reviewToken:review.token}];
        project.revision++;project.updatedAt=createdAt;
        return project;
      });
    }
  };
}

/** Hosts must fail before losing optional metadata through an older adapter. */
export function assertOptionScopeRepository(repository) {
  if(repository?.supportsOptionScope!==true||!['getProject','getQuoteDraft','saveQuoteDraft','issueQuote','confirmOptionPreference'].every(method=>typeof repository[method]==='function'))
    throw new ProjectError('UNSUPPORTED_OPTIONS','This project adapter does not support reviewed preferences and quotation scope.');
  return repository;
}
export function assertOptionScopeRoundTrip(expected,actual) {
  if(!same(expected?.scopeSelection,actual?.scopeSelection))throw new ProjectError('SCOPE_DATA_LOSS','The project adapter did not retain the reviewed package and scope references. Nothing can be issued until the exact snapshot is preserved.');
  return actual;
}

export function assertOptionPreferenceRoundTrip(review,project) {
  const {kind,...packet}=assertReview(review,'option-preference');
  const event=project?.optionPreferences?.find(item=>item.reviewToken===review.token);
  if(!event || project.id!==packet.projectId || !same(Object.fromEntries(Object.keys(packet).filter(key=>key!=='projectRevision').map(key=>[key,event[key]])),Object.fromEntries(Object.entries(packet).filter(([key])=>key!=='projectRevision'))) || event.projectRevision!==packet.projectRevision+1)
    throw new ProjectError('SCOPE_DATA_LOSS','The project adapter did not retain your confirmed preference and original references. Reopen the saved project before continuing.');
  return project;
}
