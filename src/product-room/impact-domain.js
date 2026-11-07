import { ProjectError, cloneProjectValue as copy, sameProjectValue as same, normalizeProjectContext, reviewedProjectValue, assertReview } from './project-domain.js';
import { projectDrawingContext, drawingReferenceKey, drawingVersionKey } from './drawing-context.js';
import { validatePublishedDrawingContext, projectContextAtRevision } from './drawing-revision.js';
import { createDrawingContext } from '../drawing-preview/context.js';

const text = value => typeof value === 'string' ? value.trim() : '';
const fail = message => { throw new ProjectError('IMPACT_REVIEW_REQUIRED', message); };
const key = context => context?.drawing ? drawingReferenceKey(context) : null;
const sameSource = (left,right) => left?.drawing && right?.drawing && same([left.modelId,left.modelRevision,...drawingVersionKey(left)],[right.modelId,right.modelRevision,...drawingVersionKey(right)]);
const validRevision = value => Number.isSafeInteger(value) && value > 0;
const date = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const kinds = ['question','scope'];

function sourceRecords(project) {
  return [
    ...(project.inquiry.requestItems || []).map(item => ({id:`scope:request:${item.id}`,kind:'scope',recordId:item.id,label:item.context.drawing?.regionLabel || item.context.part?.title || 'Requested scope',originalContext:copy(item.context)})),
    ...(project.questions || []).map(question => ({id:`question:${question.id}`,kind:'question',recordId:question.id,label:question.body,originalContext:copy(question.context)})),
  ];
}
function entriesAtRevision(project, revision=project.revision) {
  const entries = new Map();
  for (const record of project.impactReviews || []) {
    if (record.projectRevision > revision) continue;
    for (const decision of record.review.decisions) {
      const finding = record.review.findings.find(item => item.id === decision.id);
      entries.set(finding.id, {...copy(Object.fromEntries(['id','kind','recordId','label','originalContext'].map(name=>[name,finding[name]]))),
        context:copy(decision.context),decision:decision.decision,reason:decision.reason,lineIds:copy(decision.lineIds),
        reviewId:record.id,reviewedProjectRevision:record.projectRevision,authorRole:'seller'});
    }
  }
  return [...entries.values()];
}
export function workingImpactReference(project, kind, recordId) {
  return entriesAtRevision(project).find(entry => entry.kind === kind && entry.recordId === recordId) || null;
}
export function createImpactScope(project) {
  if (!project.impactPolicy) return undefined;
  const latest = project.impactReviews.at(-1);
  return {version:1,reviewId:latest.id,projectRevision:latest.projectRevision,entries:entriesAtRevision(project)};
}
export function adoptCurrentImpact(project,draft) {
  if (!project.impactPolicy || draft.projectId !== project.id) fail('Open this project’s reviewed drawing impact before adopting its references.');
  return {...copy(draft),projectRevision:project.revision,impactScope:createImpactScope(project)};
}

/** Build only contexts that the published package can validate. Stable IDs propose a candidate; they never approve it. */
export function impactReleaseContexts(release, baseContext) {
  const pkg=release?.packageSnapshot;
  if (!pkg || release.modelId !== baseContext.modelId || release.modelRevision !== baseContext.modelRevision || release.productId !== baseContext.productId)
    fail('Review a published source for this exact product and model version. A changed CAD model needs a separately compatible capture.');
  return pkg.sheets.flatMap(sheet => sheet.regions.map(region => {
    const context=createDrawingContext({drawing:pkg,sheetId:sheet.id,regionId:region.id,modelRevision:release.modelRevision,
      model:{id:baseContext.modelId,title:baseContext.productTitle || baseContext.roomSnapshot?.content.title || pkg.title,
        shortTitle:baseContext.roomSnapshot?.content.shortTitle || baseContext.productTitle || pkg.title,
        parts:release.partIds.map(id=>({id,title:baseContext.part?.id===id ? baseContext.part.title : id}))},
      ...(release.presentationSnapshot !== undefined ? {presentationSnapshot:copy(release.presentationSnapshot)} : {})});
    return validatePublishedDrawingContext(context,release);
  }));
}
export function proposeDrawingImpact(project,input,release,quoteDraft) {
  if (!project.context?.drawing || !quoteDraft || quoteDraft.projectId !== project.id || quoteDraft.revision < 1)
    fail('Prepare and save the quotation draft before reviewing a source change and its affected scope.');
  const all=impactReleaseContexts(release,project.context);
  const context=input?.context ? validatePublishedDrawingContext(input.context,release) : all.find(item=>item.drawing.regionId===projectDrawingContext(project).drawing.regionId) || all[0];
  if (!context) fail('This published source has no confirmed detail to review.');
  const previous=projectDrawingContext(project), current=new Map(entriesAtRevision(project).map(item=>[item.id,item]));
  const findings=[];
  for (const source of sourceRecords(project)) {
    const prior=current.get(source.id), from=prior ? prior.context : source.originalContext;
    if (!from?.drawing || from.productId !== release.productId || from.modelId !== release.modelId || from.drawing.id !== release.packageSnapshot.id) continue;
    const candidates=impactReleaseContexts(release,from).filter(item=>item.part.id===from.part.id);
    const staleLines=source.kind==='scope' && prior && prior.lineIds.some(id=>!quoteDraft.values.lineItems.some(line=>line.id===id));
    const priorReview=prior && project.impactReviews?.find(record=>record.id===prior.reviewId);
    const previouslyRetained=prior?.decision==='retained' && same(priorReview?.review.release,release);
    if ((candidates.some(item=>key(item)===key(from)) || previouslyRetained) && !staleLines) continue;
    const matched=candidates.filter(item=>item.drawing.sheetId===from.drawing.sheetId && item.drawing.regionId===from.drawing.regionId);
    const classification=!candidates.length ? 'missing' : matched.length===1 ? 'changed' : 'ambiguous';
    const candidateContext=matched.length===1 ? matched[0] : null;
    findings.push({...source,fromContext:copy(from),candidateContext,candidates,
      classification,reason:staleLines ? 'A previously reviewed quotation line was removed. Confirm the current scope-to-line association.' : classification==='changed' ? 'The source or association edition changed. Inspect the new detail before using it.' : classification==='missing' ? 'No confirmed detail for this part is available in the selected source.' : 'The saved detail has no unique matching sheet and region. Choose and inspect the replacement manually.',
      lineIds:copy(prior?.lineIds || quoteDraft.scopeSelection?.entries.find(entry=>entry.requestItemId===source.recordId)?.lineIds || [])});
  }
  if (!findings.length && key(previous)===key(context)) fail('This source has no changed dependent references to review.');
  return {kind:'drawing-impact-proposal',projectId:project.id,projectRevision:project.revision,fromContext:copy(previous),context:copy(context),
    release:copy(release),quoteDraft:copy(quoteDraft),findings};
}
export function reviewDrawingImpact(proposal,input,reviewedAt) {
  const reason=text(input?.note);
  if (!reason || reason.length>2000) fail('Explain why this project should use the reviewed source in 1–2,000 characters.');
  if (!Array.isArray(input?.decisions) || input.decisions.length!==proposal.findings.length || new Set(input.decisions.map(item=>item.id)).size!==input.decisions.length)
    fail('Review every affected question and quotation scope once.');
  const validLines=new Set(proposal.quoteDraft.values.lineItems.map(item=>item.id));
  const decisions=proposal.findings.map(finding=>{
    const supplied=input.decisions.find(item=>item.id===finding.id),decision=supplied?.decision,note=text(supplied?.reason);
    if (!['confirmed','retained','omitted'].includes(decision) || !note || note.length>2000) fail('Choose an outcome and give a reason for each affected reference.');
    if (decision==='omitted' && finding.kind!=='scope') fail('Keep a question’s source history; a question cannot be omitted by a source change.');
    let context=decision==='retained' ? finding.fromContext : decision==='confirmed' ? validatePublishedDrawingContext(supplied.context,proposal.release) : null;
    if (context && (context.modelId!==finding.originalContext.modelId || context.modelRevision!==finding.originalContext.modelRevision || context.part.id!==finding.originalContext.part.id))
      fail('The reviewed detail must belong to the same saved part and model version.');
    const lineIds=Array.isArray(supplied.lineIds) ? [...supplied.lineIds] : [];
    if (new Set(lineIds).size!==lineIds.length || lineIds.some(id=>!validLines.has(id)) || (finding.kind==='scope' && decision!=='omitted' && !lineIds.length) || ((finding.kind==='question' || decision==='omitted') && lineIds.length))
      fail('Link each retained or adopted scope to valid quotation lines; omitted scope has no quoted lines.');
    return {id:finding.id,decision,context:copy(context),reason:note,lineIds,authorRole:'seller'};
  });
  return reviewedProjectValue({...copy(proposal),kind:'drawing-impact',note:reason,decisions,reviewedAt});
}
export function normalizeImpactScope(input) {
  if (!input || input.version!==1 || !text(input.reviewId) || !validRevision(input.projectRevision) || !Array.isArray(input.entries) || input.entries.length>64 || new Set(input.entries.map(item=>item.id)).size!==input.entries.length)
    fail('Keep the quotation’s reviewed drawing references and individual decisions intact.');
  for (const entry of input.entries) {
    if (!kinds.includes(entry.kind) || entry.id!==(entry.kind==='question' ? `question:${entry.recordId}` : `scope:request:${entry.recordId}`) || !text(entry.label)
      || entry.authorRole!=='seller' || !text(entry.reason) || !text(entry.reviewId) || !validRevision(entry.reviewedProjectRevision) || entry.reviewedProjectRevision>input.projectRevision
      || !['confirmed','retained','omitted'].includes(entry.decision) || !Array.isArray(entry.lineIds) || new Set(entry.lineIds).size!==entry.lineIds.length
      || (entry.decision==='omitted' ? entry.context!==null || entry.kind!=='scope' || entry.lineIds.length : !entry.context)) fail('A reviewed drawing reference is incomplete.');
    if (!same(normalizeProjectContext(entry.originalContext),entry.originalContext) || (entry.context && !same(normalizeProjectContext(entry.context),entry.context))) fail('A reviewed source identity changed.');
  }
  return copy(input);
}
export function quoteImpactErrors(project,draft,{current=true,requireLines=true}={}) {
  if (!project.impactPolicy) return draft.impactScope ? {impactScope:'This project has no confirmed source impact review.'} : {};
  if (!draft.impactScope) return {impactScope:'Review and apply the affected drawing references before issuing this quotation.'};
  const errors={};let snapshot;
  try {snapshot=normalizeImpactScope(draft.impactScope);} catch(error) {return {impactScope:error.message};}
  const review=project.impactReviews.find(item=>item.id===snapshot.reviewId);
  const expected=review ? {version:1,reviewId:review.id,projectRevision:review.projectRevision,entries:entriesAtRevision(project,review.projectRevision)} : null;
  if (!same(expected,snapshot) || (current && !same(createImpactScope(project),snapshot))) errors.impactScope='The quotation must use the exact confirmed source-impact decisions. Review the latest evidence.';
  if (current && requireLines) {
    const active=projectDrawingContext(project),reviewedIds=new Set(snapshot.entries.map(entry=>entry.id));
    for (const record of sourceRecords(project)) if (record.originalContext.drawing?.id===active.drawing?.id && !reviewedIds.has(record.id) && !sameSource(record.originalContext,active))
      errors[`impactScope.${record.id}`]='This new record still refers to an earlier drawing. Review its source impact before issuing this quotation.';
  }
  const lineIds=new Set((draft.values?.lineItems || draft.lineItems || []).map(item=>item.id));
  for (const entry of snapshot.entries) if (requireLines && entry.kind==='scope' && entry.decision!=='omitted' && (!entry.lineIds.length || entry.lineIds.some(id=>!lineIds.has(id)))) errors[`impactScope.${entry.id}`]='A reviewed scope lost its quoted line. Review the source impact again.';
  return errors;
}
export function assertImpactScopeSource(project,draft) {
  const errors=quoteImpactErrors(project,draft,{requireLines:false});
  if (Object.keys(errors).length) throw new ProjectError('IMPACT_REVIEW_REQUIRED','Review the drawing impact before saving or issuing this quotation.',errors);
}
export function validateImpactProject(project,drafts=[]) {
  if (!project.impactPolicy) {
    if (project.impactReviews!==undefined || project.impactReviewIndex!==undefined || [...project.quotes,...drafts].some(record=>record.impactScope!==undefined)) fail('Drawing-impact evidence requires its reviewed project history.');
    return;
  }
  if (!same(project.impactPolicy,{version:1}) || !Array.isArray(project.impactReviews) || !project.impactReviews.length || project.impactReviews.length>40) fail('The source-impact review history is incomplete.');
  if (!same(project.impactReviewIndex,project.impactReviews.map(record=>({id:record.id,projectRevision:record.projectRevision,reviewToken:record.reviewToken})))) fail('The source-impact history index identifies a missing or changed review.');
  let prior=0;const ids=new Set(), tokens=new Set();
  for (const record of project.impactReviews) {
    if (!text(record.id) || ids.has(record.id) || tokens.has(record.reviewToken) || !validRevision(record.projectRevision) || record.projectRevision<=prior || record.projectRevision>project.revision || !date(record.createdAt)) fail('The source-impact review order is invalid.');
    const packet=assertReview({...record.review,token:record.reviewToken},'drawing-impact');
    if (record.projectRevision!==packet.projectRevision+1 || packet.projectId!==project.id || !date(packet.reviewedAt)) fail('The source-impact receipt does not match this project.');
    if (!same(packet.fromContext,projectContextAtRevision(project,packet.projectRevision))) fail('The impact review started from a different project source.');
    const replay={...copy(project),revision:packet.projectRevision,impactReviews:project.impactReviews.filter(item=>item.projectRevision<record.projectRevision),
      questions:(project.questions||[]).filter(question=>question.events[0].projectRevision<=packet.projectRevision).map(question=>({...copy(question),events:question.events.filter(event=>event.projectRevision<=packet.projectRevision)})),
      activeDrawingContext:copy(packet.fromContext)};
    const proposal=proposeDrawingImpact(replay,packet,packet.release,packet.quoteDraft);
    if (!same(reviewDrawingImpact(proposal,packet,packet.reviewedAt),{...packet,token:record.reviewToken})) fail('A source-impact decision changed after review.');
    if (key(packet.fromContext)!==key(packet.context) && !project.drawingRevisions?.some(change=>change.reviewToken===record.reviewToken && change.projectRevision===record.projectRevision && same(change.context,packet.context))) fail('The source-impact adoption lost its drawing-reference receipt.');
    ids.add(record.id);tokens.add(record.reviewToken);prior=record.projectRevision;
  }
  const first=project.impactReviews[0].projectRevision;
  for (const quote of project.quotes) {
    if (!quote.impactScope && quote.issuedProjectRevision<first) continue;
    if (!quote.impactScope || quote.impactScope.projectRevision>=quote.issuedProjectRevision || Object.keys(quoteImpactErrors(project,quote,{current:false})).length) fail('An issued quotation lost its reviewed source-impact snapshot.');
    const packet=assertReview({...JSON.parse(quote.reviewToken),token:quote.reviewToken},'issue-quote');
    if (!same(packet.draft.impactScope,quote.impactScope)) fail('Issued drawing-impact evidence differs from its quotation review.');
    const historical={...project,revision:quote.issuedProjectRevision-1,activeDrawingContext:projectContextAtRevision(project,quote.issuedProjectRevision-1),
      impactReviews:project.impactReviews.filter(item=>item.projectRevision<quote.issuedProjectRevision),
      questions:(project.questions || []).filter(question=>question.events[0].projectRevision<quote.issuedProjectRevision)};
    if (Object.keys(quoteImpactErrors(historical,quote)).length) fail('An issued quotation contains a source-dependent record that was not individually reviewed.');
    const latest=project.impactReviews.filter(item=>item.projectRevision<quote.issuedProjectRevision).at(-1);
    if (quote.impactScope.reviewId!==latest.id) fail('An issued quotation used obsolete source-impact evidence.');
  }
  for (const draft of drafts) if (draft.impactScope && Object.keys(quoteImpactErrors(project,draft,{current:false,requireLines:false})).length || !draft.impactScope && draft.projectRevision>=first) fail('A saved quotation lost its source-impact evidence.');
}
