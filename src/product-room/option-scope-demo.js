import { BUNDLED_RELEASE } from '../studio/seed.js';
import { contextForRelease } from './release-content.js';
import { createDemoProjectRepository, parseProjectStore } from './project-repository.js';
import { reviewInquiry, sameProjectValue } from './project-domain.js';
import { reviewOptionSet } from './option-scope-domain.js';

export const OPTION_SCOPE_DEMO_ID = 'crank-options-v1';
export const OPTION_SCOPE_DEMO_KEY = `annora.options.demo.${OPTION_SCOPE_DEMO_ID}`;
const copy = value => JSON.parse(JSON.stringify(value));
const problem = message => Object.assign(new Error(message), {code:'OPTION_DEMO_UNAVAILABLE'});
const makeRepository = options => Object.freeze({...createDemoProjectRepository({...options,key:OPTION_SCOPE_DEMO_KEY}),supportsFollowUps:false,mode:'options-demo'});

/** Public fictional example, never derived from a visitor's saved customer data. */
export async function buildOptionScopeDemo() {
  const memory = new Map(); let serial = 0;
  const repository = makeRepository({storage:{getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value)},locks:null,
    makeId:prefix=>`${prefix}-OPTIONS-EXAMPLE-${String(++serial).padStart(3,'0')}`,now:()=> '2026-11-06T16:00:00.000Z'});
  const context = contextForRelease(copy(BUNDLED_RELEASE));
  let draft = await repository.getDraft(context);
  draft.values = {...draft.values,name:'Alex Morgan',email:'alex@example.com',company:'Example Motion Works',quantity:'2',
    application:'Compare the support scope for a crank-slider demonstration before an engineering discussion.'};
  draft.requestItems = [
    {id:'motion-detail',purpose:'question',notes:'Explain the connecting rod motion and include a guided handoff.',context:{...copy(context),part:{id:'rod',title:'Connecting rod'}}},
    {id:'mounting-detail',purpose:'question',notes:'Review the linear guide mounting interface and identify what remains to confirm.',context:{...copy(context),part:{id:'guide',title:'Linear guide'}}},
  ];
  draft = await repository.saveDraft(draft);
  let project = await repository.submitInquiry(reviewInquiry(draft));
  const common = {status:'available',requestItemIds:['motion-detail','mounting-detail']};
  project = await repository.approveOptionSet(reviewOptionSet(project,{
    id:'crank-support-options',version:1,kind:'scope-packages',title:'Choose the support that fits your project',context:copy(context),
    disclaimer:'Fictional service packages for this demonstration. The same mechanism is shown in both. Pricing, compatibility and delivery require a reviewed quotation.',
    options:[
      {...common,id:'guided-handoff',title:'Guided handoff',description:'Understand the motion and collect the mounting questions for your team.',facts:[
        {label:'Motion handoff',value:'Prepared demonstration and one guided review'},
        {label:'Mounting review',value:'Interface questions documented for your team'},
        {label:'Follow-up support',value:'Optional, to scope separately'},
        {label:'Price & timing',value:'To confirm in the quotation'},
      ]},
      {...common,id:'engineering-support',title:'Engineering support',description:'Add a mounting discussion and a follow-up review to the guided handoff.',facts:[
        {label:'Motion handoff',value:'Prepared demonstration and one guided review'},
        {label:'Mounting review',value:'Dedicated interface review with your team'},
        {label:'Follow-up support',value:'One follow-up review proposed'},
        {label:'Price & timing',value:'To confirm in the quotation'},
      ]},
    ],
  }),{confirmed:true});
  return {schemaVersion:1,id:OPTION_SCOPE_DEMO_ID,classification:'public-fictional-example',projectId:project.id,store:parseProjectStore(memory.get(OPTION_SCOPE_DEMO_KEY))};
}

export async function loadOptionScopeDemo(parameters = new URLSearchParams(globalThis.location?.search||''),options = {}) {
  if (!parameters.has('optionDemo')) return null;
  if (parameters.get('optionDemo')!==OPTION_SCOPE_DEMO_ID || ['optionDemo','project','model','release','quote','compare'].some(key=>parameters.getAll(key).length>1)
      || ['walkthrough','studioPreview','followUpDemo','followUp'].some(key=>parameters.has(key)))
    throw problem('This comparison example link contains conflicting identities. Existing projects have not been opened.');
  let storage;
  try {storage=options.storage||globalThis.localStorage;if(!storage)throw new Error();}
  catch {throw problem('Browser storage is unavailable. Enable storage to open this separate fictional example.');}
  const fixture=await buildOptionScopeDemo(), original=fixture.store.projects.find(item=>item.id===fixture.projectId);
  if (parameters.has('project')&&parameters.get('project')!==fixture.projectId
      ||parameters.has('model')&&parameters.get('model')!==original.context.modelId
      ||parameters.has('release')&&parameters.get('release')!==original.context.roomReleaseId)
    throw problem('This comparison link names a different project or product version. Open the original example link.');
  const validate = store => {
    const project=store.projects.find(item=>item.id===fixture.projectId);
    if (store.projects.length !== 1 || store.drafts.length || !project || !sameProjectValue(project.context,original.context) || !sameProjectValue(project.inquiry,original.inquiry)
        ||!sameProjectValue(project.approvedOptionSet,original.approvedOptionSet)||!sameProjectValue(project.optionSetApproval,original.optionSetApproval))
      throw problem('The saved comparison does not match the published example. Its data has not been overwritten.');
  };
  const install=async()=>{
    let raw;try {raw=storage.getItem(OPTION_SCOPE_DEMO_KEY);}catch{throw problem('The saved example could not be read. Please try again.');}
    if(raw===null){validate(fixture.store);try{const encoded=JSON.stringify(fixture.store);storage.setItem(OPTION_SCOPE_DEMO_KEY,encoded);if(storage.getItem(OPTION_SCOPE_DEMO_KEY)!==encoded)throw new Error();}catch{throw problem('The comparison example could not be saved. Enable browser storage and try again.');}}
    else validate(parseProjectStore(raw));
  };
  const locks=Object.hasOwn(options,'locks')?options.locks:globalThis.navigator?.locks;
  if(locks?.request)await locks.request(`annora:${OPTION_SCOPE_DEMO_KEY}`,install);else await install();
  const repository=makeRepository({storage,...(Object.hasOwn(options,'locks')?{locks}: {})});
  const outsideExample=async()=>{throw problem('This example keeps one comparison project. Open the regular Product Room or Studio to create another inquiry.');};
  return {repository:Object.freeze({...repository,getDraft:outsideExample,saveDraft:outsideExample,submitInquiry:outsideExample,createSampleInquiry:outsideExample}),projectId:fixture.projectId};
}
