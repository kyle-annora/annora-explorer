import { ProjectError, cloneProjectValue as copy, sameProjectValue as same, normalizeProjectContext, reviewedProjectValue, assertReview } from './project-domain.js';

const text = value => typeof value === 'string' ? value.trim() : '';
const fail = (message, fields = {}) => { throw new ProjectError('VALIDATION', message, fields); };
const requireProject = project => { if (!project?.id || !Number.isSafeInteger(project.revision)) fail('Open a saved project first.'); };
const ids = values => Array.isArray(values) && values.every(value => text(value) === value && value) && new Set(values).size === values.length;
const validDate = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
export const SCOPE_DISPOSITIONS = Object.freeze([
  {value:'included',label:'Included'}, {value:'optional',label:'Optional'},
  {value:'excluded',label:'Excluded'}, {value:'needs-clarification',label:'Needs clarification'}
]);

export function normalizeOptionSet(input) {
  if (!input || !text(input.id) || input.version !== 1 || input.kind !== 'scope-packages' || !text(input.title) || !text(input.disclaimer) || !Array.isArray(input.options) || input.options.length !== 2) fail('Choose two approved demonstration scope packages with a clear source and disclaimer.');
  const result = {id:text(input.id),version:1,kind:'scope-packages',title:text(input.title),disclaimer:text(input.disclaimer),context:normalizeProjectContext(input.context),options:input.options.map(option => {
    if (!text(option.id) || !text(option.title) || !text(option.description) || !['available','withdrawn'].includes(option.status) || !ids(option.requestItemIds) || !Array.isArray(option.facts) || option.facts.length > 8 || option.facts.some(fact => !text(fact.label) || !text(fact.value))) fail('Each approved package needs an identity, description, availability and source-linked details.');
    return {id:text(option.id),title:text(option.title),description:text(option.description),status:option.status,facts:option.facts.map(fact=>({label:text(fact.label),value:text(fact.value)})),requestItemIds:[...option.requestItemIds]};
  })};
  if (result.options[0].id === result.options[1].id || [result.id,result.title,result.disclaimer,...result.options.flatMap(option=>[option.id,option.title,option.description,...option.facts.flatMap(fact=>[fact.label,fact.value])])].some(value=>value.length>2000)) fail('Keep package identities distinct and descriptions concise.');
  return result;
}
export function reviewOptionSet(project, input) {
  requireProject(project);
  const optionSet = normalizeOptionSet(input);
  if (!same(optionSet.context,project.context)) fail('Approved packages must retain the original inquiry product and release.');
  const requestIds = new Set((project.inquiry.requestItems || []).map(item=>item.id));
  if (optionSet.options.some(option=>option.requestItemIds.some(id=>!requestIds.has(id)))) fail('A package refers to a detail outside this inquiry.');
  if (project.approvedOptionSet) throw new ProjectError('CONFLICT','This project already has an immutable approved package comparison.');
  return reviewedProjectValue({kind:'option-set',projectId:project.id,projectRevision:project.revision,optionSet});
}
export function reviewOptionPreference(project, input) {
  requireProject(project);
  if (!project.approvedOptionSet) throw new ProjectError('UNSUPPORTED_OPTIONS','No approved package comparison is available for this project.');
  const optionSet = normalizeOptionSet(project.approvedOptionSet), choice = input?.choice, notes = text(input?.notes);
  const optionId = choice === 'help-me-decide' ? null : text(input?.optionId);
  if (!['option','help-me-decide'].includes(choice)) fail('Choose a package or ask for help deciding.',{choice:'Choose a preference before reviewing.'});
  if (notes.length > 2000) fail('Keep the preference note within 2,000 characters.',{notes:'Shorten your note.'});
  if (choice === 'option' && !optionSet.options.some(option=>option.id===optionId&&option.status==='available')) fail('This package is missing or withdrawn. Choose an available package.',{optionId:'Choose an available package.'});
  if (!same(optionSet.context,project.context)) throw new ProjectError('STALE_REVIEW','The approved package source no longer matches this inquiry.');
  return reviewedProjectValue({kind:'option-preference',projectId:project.id,projectRevision:project.revision,optionSetId:optionSet.id,optionSetVersion:optionSet.version,choice,optionId,notes,context:copy(project.context)});
}
export function optionPreferenceLabel({optionSet, preference} = {}) {
  if (!preference) return 'No preference recorded';
  if (preference.choice==='help-me-decide') return 'Help me decide';
  return optionSet?.options.find(option=>option.id===preference.optionId)?.title || 'Unavailable package';
}
function sourceEntries(project, preference) {
  return [...(project.inquiry.requestItems || []).map(item=>({id:`request:${item.id}`,requestItemId:item.id,context:copy(item.context)})),
    ...(preference ? [{id:'preference',requestItemId:null,context:copy(project.context)}] : [])];
}
export function createQuoteScopeSelection(project, previous) {
  if (!project.approvedOptionSet) return undefined;
  const preference = project.optionPreferences?.at(-1) || null;
  return {optionSet:copy(project.approvedOptionSet),preference:copy(preference),entries:sourceEntries(project,preference).map(source=>{
    const entry = previous?.entries?.find(item=>item.id===source.id && same(item.context,source.context));
    const reusable = entry && same(previous.optionSet,project.approvedOptionSet) && (source.id!=='preference' || same(previous.preference,preference));
    return {...source,disposition:reusable?entry.disposition:'needs-clarification',lineIds:reusable?[...entry.lineIds]:[],rationale:reusable?entry.rationale:''};
  })};
}
export function adoptCurrentOptionPreference(project, draft) {
  if (!project.approvedOptionSet) throw new ProjectError('UNSUPPORTED_OPTIONS','No approved comparison is available.');
  return {...copy(draft),projectRevision:project.revision,scopeSelection:createQuoteScopeSelection(project,draft.scopeSelection)};
}
export function normalizeQuoteScopeSelection(input) {
  if (!input || !Array.isArray(input.entries) || input.entries.length > 13) fail('Keep every scope decision attached to its original request.');
  const optionSet = normalizeOptionSet(input.optionSet);
  const preference = input.preference === null ? null : copy(input.preference);
  if (preference !== null && (!preference?.id || !Number.isSafeInteger(preference.version) || !['option','help-me-decide'].includes(preference.choice))) fail('The quotation preference snapshot is invalid.');
  const entries=input.entries.map(entry=>{
    if (!text(entry.id) || (entry.requestItemId!==null&&!text(entry.requestItemId)) || !SCOPE_DISPOSITIONS.some(item=>item.value===entry.disposition) || !ids(entry.lineIds) || entry.lineIds.length>30 || text(entry.rationale).length>2000) fail('Check the scope disposition, linked lines and explanation.');
    return {id:text(entry.id),requestItemId:entry.requestItemId,context:normalizeProjectContext(entry.context),disposition:entry.disposition,lineIds:[...entry.lineIds],rationale:text(entry.rationale)};
  });
  if (new Set(entries.map(entry=>entry.id)).size!==entries.length) fail('Each requested detail needs exactly one scope decision.');
  return {optionSet,preference,entries};
}
/** Current-source check is for drafts; issued snapshots are checked against historical events. */
export function quoteScopeErrors(project,draft,{requireResolved=true,current=true}={}) {
  const fields={};
  if (!project.approvedOptionSet && !draft.scopeSelection) return fields;
  if (!draft.scopeSelection || !project.approvedOptionSet) return {scopeSelection:'This adapter must retain the approved comparison and quote scope metadata.'};
  let selection;
  try { selection=normalizeQuoteScopeSelection(draft.scopeSelection); } catch(error) { return {scopeSelection:error.message}; }
  if (!same(selection.optionSet,project.approvedOptionSet)) fields.scopeSelection='The approved package snapshot changed. Reopen the project.';
  const preference=selection.preference;
  if (preference && !(project.optionPreferences || []).some(event=>same(event,preference))) fields.scopeSelection='The preference does not match a confirmed event in this project.';
  if (current && !same(preference,project.optionPreferences?.at(-1)||null)) fields.scopeSelection='Review and explicitly adopt the latest customer preference before issuing this quotation.';
  if (requireResolved && !preference) fields.scopeSelection='Wait for a confirmed preference or Help me decide before issuing the scoped quotation.';
  const expected=sourceEntries(project,preference), lineIds=new Set((draft.values?.lineItems || draft.lineItems || []).map(line=>line.id));
  if (selection.entries.length!==expected.length || expected.some(source=>!selection.entries.some(entry=>entry.id===source.id&&entry.requestItemId===source.requestItemId&&same(entry.context,source.context)))) fields.scopeSelection='Keep every original requested detail and its exact source in the quotation.';
  for(const entry of selection.entries){
    const key=`scopeSelection.entries.${entry.id}`;
    if(entry.lineIds.some(id=>!lineIds.has(id))) fields[key]='A linked quote line was removed. Choose its replacement or explicitly change this scope decision.';
    else if(['included','optional'].includes(entry.disposition)&&!entry.lineIds.length) fields[key]='Link at least one quotation line to this scope decision.';
    else if(['excluded','needs-clarification'].includes(entry.disposition)&&entry.lineIds.length) fields[key]='An excluded or unresolved request cannot be included through a quotation line.';
    else if(entry.disposition==='excluded'&&!entry.rationale) fields[key]='Explain why this request is excluded.';
    else if(requireResolved&&entry.disposition==='needs-clarification') fields[key]='Resolve this requested detail or explicitly exclude it with an explanation before issuing.';
  }
  return fields;
}
export function assertQuoteScopeSource(project,draft) {
  // Incomplete decisions are valid saved work. Missing metadata and changed sources are not.
  const fields=quoteScopeErrors(project,draft,{requireResolved:false});
  if(fields.scopeSelection) throw new ProjectError('SCOPE_REVIEW_REQUIRED',fields.scopeSelection,{scopeSelection:fields.scopeSelection});
}
export function validateOptionScopeProject(project, drafts=[]) {
  if (!project.approvedOptionSet) {
    if(project.optionSetApproval || project.optionPreferences?.length || project.quotes.some(quote=>quote.scopeSelection) || drafts.some(draft=>draft.scopeSelection)) fail('Scope history has no approved comparison.');
    return;
  }
  const set=normalizeOptionSet(project.approvedOptionSet), approval=project.optionSetApproval;
  if(!same(set,project.approvedOptionSet)||!same(set.context,project.context)||!approval||!Number.isSafeInteger(approval.projectRevision)||approval.projectRevision<2||approval.projectRevision>project.revision||!validDate(approval.createdAt)) fail('The approved comparison has invalid provenance.');
  const approved=assertReview({...JSON.parse(approval.reviewToken),token:approval.reviewToken},'option-set');
  if(approved.projectId!==project.id||approved.projectRevision!==approval.projectRevision-1||!same(approved.optionSet,set)) fail('The approved comparison changed after confirmation.');
  reviewOptionSet({...project,approvedOptionSet:undefined},set);
  if(!Array.isArray(project.optionPreferences)) fail('The preference history is missing.');
  for(const [index,event] of project.optionPreferences.entries()){
    if(!event.id||event.version!==index+1||event.projectId!==project.id||!Number.isSafeInteger(event.projectRevision)||event.projectRevision<=approval.projectRevision||event.projectRevision>project.revision||!validDate(event.createdAt)||(index&&event.projectRevision<=project.optionPreferences[index-1].projectRevision)) fail('Preference history is invalid.');
    const expected=reviewOptionPreference({...project,revision:event.projectRevision-1},event), payload=assertReview({...JSON.parse(event.reviewToken),token:event.reviewToken},'option-preference');
    if(!same(expected,{...payload,token:event.reviewToken})||!same({...payload,id:event.id,version:event.version,projectRevision:event.projectRevision,createdAt:event.createdAt,reviewToken:event.reviewToken,kind:undefined}, {...event,kind:undefined})) fail('A confirmed preference snapshot changed.');
  }
  if(new Set(project.optionPreferences.map(event=>event.id)).size!==project.optionPreferences.length) fail('Preference identities must remain unique.');
  for(const quote of project.quotes){
    if(!quote.scopeSelection){if(quote.source==='seller-demo'&&quote.issuedProjectRevision>approval.projectRevision)fail('An issued quotation lost its scope metadata.');continue;}
    const fields=quoteScopeErrors(project,quote,{current:false});
    const historicalPreference=project.optionPreferences.filter(event=>event.projectRevision<quote.issuedProjectRevision).at(-1)||null;
    if(!same(quote.scopeSelection.preference,historicalPreference))fail('An issued quotation did not retain the preference current at its review.');
    if(Object.keys(fields).length || quote.scopeSelection.preference.projectRevision>=quote.issuedProjectRevision) fail('An issued quotation changed its reviewed scope.');
    const review=assertReview({...JSON.parse(quote.reviewToken),token:quote.reviewToken},'issue-quote');
    if(!same(review.draft.scopeSelection,quote.scopeSelection)) fail('An issued scope snapshot differs from its review.');
  }
  for(const draft of drafts){
    if(draft.scopeSelection){
      const fields=quoteScopeErrors(project,draft,{current:false,requireResolved:false});
      // Saved unfinished drafts may retain removed lines, never changed source identities.
      if(fields.scopeSelection)fail(fields.scopeSelection);
    }else if(draft.projectRevision>=approval.projectRevision)fail('A scoped quotation draft lost its comparison metadata.');
  }
}
