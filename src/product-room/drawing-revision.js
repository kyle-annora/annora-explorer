import { ProjectError, cloneProjectValue as copy, normalizeProjectContext, sameProjectValue as same, reviewedProjectValue } from './project-domain.js';
import { projectDrawingContext, recordContext, drawingReferenceKey } from './drawing-context.js';
import { normalizeDrawingPackage, releaseDiagnostic } from '../drawings/package.js';

export { projectDrawingContext, recordContext } from './drawing-context.js';

const text = value => typeof value === 'string' ? value.trim() : '';
const fail = message => { throw new ProjectError('DRAWING_REFERENCE_INVALID', message); };

/** Validate against a published repository snapshot, not labels supplied by a form.
 * Human source confirmation is required for changing an existing commercial project.
 * This remains a browser-local review gate; a production adapter verifies authorization
 * and durable source objects on the server. */
export function validatePublishedDrawingContext(input, release) {
  const context = normalizeProjectContext(input);
  if (!context.drawing || release?.kind !== 'annora-drawing-release' || !['demo','bundled'].includes(release.source)
      || !text(release.id) || !Number.isInteger(release.version) || release.version < 1)
    fail('Choose a published drawing release. Drafts and previews cannot change a customer project.');
  let pkg;
  try { pkg = normalizeDrawingPackage(release.packageSnapshot); }
  catch { fail('This drawing release has an invalid source package.'); }
  if (pkg.pairing.status !== 'human-confirmed') fail('A person must confirm the source pairing before this release can replace a project reference.');
  if (!Array.isArray(release.partIds) || !releaseDiagnostic(pkg,{partIds:release.partIds,modelRevision:release.modelRevision}).valid)
    fail('Resolve every missing or uncertain drawing association before adopting this release.');
  if (release.productId !== context.productId || release.modelId !== context.modelId || pkg.modelId !== context.modelId
      || release.modelRevision !== context.modelRevision || pkg.modelRevision !== context.modelRevision
      || release.sourceRevision !== pkg.revision || release.mappingRevision !== pkg.mappingRevision)
    fail('The proposed reference does not match this published product and model version.');
  const drawing=context.drawing,sheets=pkg.sheets.filter(sheet=>sheet.id===drawing.sheetId);
  const regions=sheets.flatMap(sheet=>sheet.regions.filter(region=>region.id===drawing.regionId).map(region=>({sheet,region})));
  if (regions.length!==1) fail('Select exactly one available detail from the published sheet.');
  const {sheet,region}=regions[0],asset=pkg.assets.find(item=>item.id===sheet.assetId);
  if (region.mappingStatus!=='confirmed' || !release.partIds.includes(region.partId)) fail('Confirm this detail and its part before adoption.');
  const expected={id:pkg.id,title:pkg.title,revision:pkg.revision,assetId:asset.id,assetRevision:asset.sha256,
    partId:region.partId,sheetId:sheet.id,sheetTitle:sheet.title,regionId:region.id,regionLabel:region.label,
    sourceURL:pkg.sourceURL,mappingRevision:pkg.mappingRevision,
    ...(drawing.revisionLabel!==undefined ? {revisionLabel:pkg.revisionLabel} : {}),
    ...(release.presentationSnapshot !== undefined ? {
      presentationSnapshot: copy(release.presentationSnapshot),
      ...(release.presentationSnapshot ? { presentationRevision: release.presentationSnapshot.revision } : {}),
    } : {})};
  if (!same(drawing,expected) || context.part?.id!==region.partId) fail('The selected detail, part, source hash or association version differs from the published release.');
  return context;
}

export function proposeProjectDrawingRevision(project,input,release,quoteDraft=null) {
  const context=validatePublishedDrawingContext(input?.context,release),previous=projectDrawingContext(project);
  if (!project.context?.drawing || project.context.productId!==context.productId || project.context.modelId!==context.modelId)
    fail('Use a published reference for the same product and model family.');
  const referenceChanged=drawingReferenceKey(previous)!==drawingReferenceKey(context);
  const note=text(input.note),quoteDraftAction=input.quoteDraftAction || 'keep';
  if (!referenceChanged && !(quoteDraftAction==='replace' && quoteDraft && !same(recordContext(project,quoteDraft),previous))) fail('This project already uses the selected drawing reference.');
  if (!note || note.length>2000) throw new ProjectError('VALIDATION','Explain the reference change in 1–2,000 characters.',{note:'Explain why this project should use the new drawing reference.'});
  if (!['keep','replace'].includes(quoteDraftAction)) throw new ProjectError('VALIDATION','Choose whether to retain or replace the existing quotation draft.');
  return {kind:'drawing-revision-proposal',status:'proposed',projectId:project.id,projectRevision:project.revision,
    fromContext:copy(previous),context,referenceChanged,release:copy(release),note,quoteDraftAction,quoteDraft:quoteDraft?copy(quoteDraft):null};
}
export function reviewProjectDrawingRevision(proposal,reviewedAt) {
  return reviewedProjectValue({...copy(proposal),kind:'drawing-revision',status:'reviewed',reviewedAt});
}

/** Local history is append-only. The submitted inquiry context is never replaced. */
export function validateProjectDrawingHistory(project) {
  if(project.lastDrawingReviewToken!==undefined && !text(project.lastDrawingReviewToken))fail('The drawing review receipt is incomplete.');
  if (project.activeDrawingContext===undefined && project.drawingRevisions===undefined) return;
  if (!project.context.drawing || !Array.isArray(project.drawingRevisions) || !project.drawingRevisions.length) fail('This project has no complete drawing-reference history.');
  let current=project.context,revision=1;const ids=new Set();
  for(const change of project.drawingRevisions){
    if(!text(change.id)||ids.has(change.id)||change.status!=='adopted'||!text(change.reviewToken)
       ||!text(change.note)||!Number.isFinite(Date.parse(change.createdAt))||!Number.isFinite(Date.parse(change.reviewedAt))
       ||!Number.isInteger(change.projectRevision)||change.projectRevision<=revision||change.projectRevision>project.revision
       ||!['keep','replace'].includes(change.quoteDraftAction)||!same(change.fromContext,current)) fail('The drawing-reference history is inconsistent.');
    const next=validatePublishedDrawingContext(change.context,change.release);
    if(next.productId!==project.context.productId||next.modelId!==project.context.modelId||drawingReferenceKey(next)===drawingReferenceKey(current))fail('A drawing transition must stay with this product and explicitly change its reference.');
    ids.add(change.id);current=next;revision=change.projectRevision;
  }
  if(!same(current,project.activeDrawingContext))fail('The active drawing reference does not match the last confirmed adoption.');
}

export function projectContextAtRevision(project,revision) {
  return (project.drawingRevisions || []).filter(change=>change.projectRevision<=revision).at(-1)?.context || project.context;
}
export function validateRecordDrawingContext(project,record,expected) {
  if(!record.context) {
    if(expected && !same(expected,project.context)) fail('This later record is missing its pinned drawing reference.');
    return;
  }
  const normalized=normalizeProjectContext(record.context),allowed=[project.context,...(project.drawingRevisions||[]).map(change=>change.context)];
  if(!same(normalized,record.context)||!allowed.some(context=>same(context,normalized))||(expected&&!same(expected,normalized)))fail('A saved commercial record has a different drawing reference from its reviewed source.');
}
