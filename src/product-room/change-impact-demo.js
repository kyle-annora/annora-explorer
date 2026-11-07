import releaseA from '../../content/drawings/sk08/release-impact-a.json' with { type: 'json' };
import releaseB from '../../content/drawings/sk08/release-impact-b.json' with { type: 'json' };
import metadata from '../../content/models/sk08/metadata.json' with { type: 'json' };
import { createDrawingContext } from '../drawing-preview/context.js';
import { createDemoProjectRepository, parseProjectStore } from './project-repository.js';
import { reviewInquiry, sameProjectValue } from './project-domain.js';
import { reviewQuote } from './seller-domain.js';
import { reviewQuestion, reviewQuestionReply, reviewQuestionResolution } from './question-domain.js';

export const CHANGE_IMPACT_DEMO_ID = 'sk08-a-b-v1';
export const CHANGE_IMPACT_DEMO_KEY = `annora.impact.demo.${CHANGE_IMPACT_DEMO_ID}`;
export const CHANGE_IMPACT_RELEASES = Object.freeze([releaseA, releaseB]);
const copy = value => JSON.parse(JSON.stringify(value));
const problem = message => Object.assign(new Error(message), { code: 'IMPACT_DEMO_UNAVAILABLE' });
const model = { id:'sk08', title:'SK08 shaft support', shortTitle:'SK08 shaft support', revision:releaseA.modelRevision, parts:metadata.parts };
export function changeImpactContext(release = releaseA, regionId = 'shaft-bore-detail', sheetId = 'sheet-2') {
  return createDrawingContext({ drawing:release.packageSnapshot, sheetId, regionId, modelRevision:release.modelRevision, model, ...(release.presentationSnapshot !== undefined ? {presentationSnapshot:copy(release.presentationSnapshot)} : {}) });
}
const makeRepository = options => Object.freeze({ ...createDemoProjectRepository({ ...options, key:CHANGE_IMPACT_DEMO_KEY, drawingWorkflow:true, requireDrawingImpact:true,
  getDrawingRelease:async id => { const release=CHANGE_IMPACT_RELEASES.find(item=>item.id===id); if(!release)throw problem('This exact prepared drawing release is unavailable.');return copy(release); } }),
  supportsFollowUps:false, mode:'impact-demo' });

/** An isolated fictional project already has an A quotation. B changes the document layout, not engineering geometry. */
export async function buildChangeImpactDemo() {
  const memory=new Map();let serial=0;
  const repository=makeRepository({storage:{getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value)},locks:null,
    makeId:prefix=>`${prefix}-IMPACT-EXAMPLE-${String(++serial).padStart(3,'0')}`,now:()=> '2026-11-06T21:30:00.000Z'});
  const context=changeImpactContext(),cross=changeImpactContext(releaseA,'cross-bore-detail'),general=copy(context);delete general.drawing;delete general.part;
  let draft=await repository.getDraft(context);
  draft.values={...draft.values,name:'Alex Morgan',email:'alex@example.com',company:'Example Motion Works',quantity:'4',
    application:'Review the shaft bore and clamp cross-bore inspection scope for the SK08 reference drawing.',notes:'Fictional review only. No revised dimensions, fit or tolerances are inferred.'};
  draft.requestItems=[
    {id:'shaft-bore-request',purpose:'review',notes:'Confirm which document view supports the bore inspection discussion.',context},
    {id:'cross-bore-request',purpose:'review',notes:'Keep the clamp cross-bore inspection reference explicit.',context:cross},
    {id:'handoff-request',purpose:'question',notes:'Include an online handoff of the review findings.',context:general},
  ];
  draft=await repository.saveDraft(draft);let project=await repository.submitInquiry(reviewInquiry(draft));
  for(const request of [
    {id:'shaft-bore-request',body:'Which shaft-bore drawing view will be used for the inspection discussion?',answer:'The enlarged shaft-bore detail on drawing A is the initial discussion reference.'},
    {id:'cross-bore-request',body:'Which clamp cross-bore reference is included in this scope?',answer:'The enlarged clamp cross-bore detail on drawing A is included for discussion; no fit or tolerance has been approved.'},
    {id:'handoff-request',body:'Can we include an online handoff?',answer:'One fictional online handoff is included; it does not depend on a drawing view.'},
  ]) {
    project=await repository.confirmQuestion(reviewQuestion(project,{requestItemId:request.id,body:request.body,blocking:true}),{confirmed:true});
    const questionId=project.questions.at(-1).id;
    project=await repository.confirmQuestionReply(reviewQuestionReply(project,{questionId,authorRole:'seller',kind:'answer',body:request.answer}),{confirmed:true});
    project=await repository.confirmQuestionResolution(reviewQuestionResolution(project,{questionId,authorRole:'seller',body:'Seller reviewed this answer for the initial A quotation. Later document changes require a separate impact review.'}),{confirmed:true});
  }
  let quote=await repository.getQuoteDraft(project.id);
  quote.values={...quote.values,scope:'Drawing A: shaft-bore and clamp cross-bore reference review, plus an online handoff. No manufacturing or dimensional approval.',
    lineItems:[{id:'bore-review',label:'Shaft-bore reference review',quantity:'1',unitPrice:''},{id:'cross-bore-review',label:'Clamp cross-bore reference review',quantity:'1',unitPrice:''},{id:'online-handoff',label:'Online handoff',quantity:'1',unitPrice:''}]};
  quote=await repository.saveQuoteDraft(quote);project=await repository.issueQuote(reviewQuote(project,quote));
  const workingDraft=await repository.getQuoteDraft(project.id);await repository.saveQuoteDraft(workingDraft);
  return {schemaVersion:1,id:CHANGE_IMPACT_DEMO_ID,classification:'public-fictional-example',projectId:project.id,store:parseProjectStore(memory.get(CHANGE_IMPACT_DEMO_KEY))};
}

export async function loadChangeImpactDemo(parameters=new URLSearchParams(globalThis.location?.search||''),options={}) {
  if(!parameters.has('impactDemo'))return null;
  if(parameters.get('impactDemo')!==CHANGE_IMPACT_DEMO_ID || ['impactDemo','project','model','release','quote','compare'].some(key=>parameters.getAll(key).length>1)
    || ['walkthrough','studioPreview','followUpDemo','followUp','optionDemo'].some(key=>parameters.has(key)))throw problem('This drawing-impact example link contains conflicting identities. Existing projects have not been opened.');
  let storage;try{storage=options.storage||globalThis.localStorage;if(!storage)throw Error();}catch{throw problem('Browser storage is unavailable. Allow storage to open this separate fictional example.');}
  const fixture=await buildChangeImpactDemo(),original=fixture.store.projects.find(item=>item.id===fixture.projectId);
  if(parameters.has('project')&&parameters.get('project')!==fixture.projectId || parameters.has('model')&&parameters.get('model')!==original.context.modelId || parameters.has('release')&&parameters.get('release')!==original.context.roomReleaseId)
    throw problem('This drawing-impact link names another project or product. Open the original example link.');
  const validate=store=>{const project=store.projects.find(item=>item.id===fixture.projectId);if(store.projects.length!==1 || store.drafts.length || !project || !sameProjectValue(project.context,original.context) || !sameProjectValue(project.inquiry,original.inquiry) || !sameProjectValue(project.quotes[0],original.quotes[0]))
    throw problem('The saved drawing-impact example does not match its original source. Its data has not been overwritten.');};
  const install=async()=>{let raw;try{raw=storage.getItem(CHANGE_IMPACT_DEMO_KEY);}catch{throw problem('The saved example could not be read. Try again.');}
    if(raw===null){validate(fixture.store);try{const encoded=JSON.stringify(fixture.store);storage.setItem(CHANGE_IMPACT_DEMO_KEY,encoded);if(storage.getItem(CHANGE_IMPACT_DEMO_KEY)!==encoded)throw Error();}catch{throw problem('The drawing-impact example could not be saved. Allow storage or free space and try again.');}}
    else validate(parseProjectStore(raw));};
  const locks=Object.hasOwn(options,'locks')?options.locks:globalThis.navigator?.locks;
  if(locks?.request)await locks.request(`annora:${CHANGE_IMPACT_DEMO_KEY}`,install);else await install();
  const repository=makeRepository({storage,...(Object.hasOwn(options,'locks')?{locks}:{})});
  const outside=async()=>{throw problem('This example keeps one drawing-impact project. Open the regular Product Room to create another inquiry.');};
  return {repository:Object.freeze({...repository,getDraft:outside,saveDraft:outside,submitInquiry:outside,createSampleInquiry:outside}),projectId:fixture.projectId,releases:CHANGE_IMPACT_RELEASES};
}
