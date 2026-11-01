import { pendingClarification, pendingProjectChange } from '../product-room/project-state.js';

export const WALKTHROUGH_CHAPTERS = [
  {id:1, title:'Understand the product', short:'Product'},
  {id:2, title:'Get a quotation', short:'Quotation'},
  {id:3, title:'Resolve and move forward', short:'Next step'},
];

/** Presentation guidance reads the case. It never submits or creates a record. */
export function walkthroughFlow(project, {hasDraft = false} = {}) {
  if (!project) return {chapter:hasDraft ? 2 : 1, role:'buyer', state:hasDraft ? 'inquiry' : 'explore',
    title:hasDraft ? 'Review a request grounded in the product.' : 'Start with the mechanism.',
    note:hasDraft ? 'Use sample details for 20 assemblies. Review the request, then confirm it below.' : 'Run one short cycle. Select Connecting rod, then start an inquiry from that context.',
    focus:hasDraft ? ['Review inquiry','Confirm demo inquiry'] : ['Request a quote','Inquire']};
  const quote = project.quotes.at(-1), question = pendingClarification(project), change = pendingProjectChange(project);
  if (question) return {chapter:3,role:'buyer',state:'question',title:'Answer the seller’s question.',note:'The reply stays with this project and its quotation. Review it before confirming.',focus:['Reply to question','Review reply','Confirm demo reply']};
  if (change) return {chapter:3,role:'seller',state:'revision',title:'Respond with a revised quotation.',note:'Update to 30 assemblies. Address quantity and requested timing; proposed delivery remains a separate commitment.',focus:['Prepare next version','Continue quotation','Review quotation','Issue demo quotation']};
  if (!quote) return {chapter:2,role:'seller',state:'quotation',title:'Turn the inquiry into a reviewed quotation.',note:'Use demo pricing and propose 6–8 weeks after technical review. Save a draft, review it, then issue v1.',focus:['Continue quotation','Prepare quotation','Review quotation','Issue demo quotation']};
  const step = project.nextSteps.filter(item=>item.quoteId===quote.id).at(-1);
  if (step) {
    const confirmed = project.messages.some(item=>item.kind==='next-step-confirmation' && item.nextStepId===step.id);
    return confirmed ? {chapter:3,role:'buyer',state:'complete',title:'The next step is agreed.',note:'The product reference, inquiry, quotation versions and confirmed discussion stay together. No order or payment has been created.',focus:['View conversation']}
      : {chapter:3,role:'seller',state:'acknowledge',title:'Close the loop on the next action.',note:'Acknowledge the customer’s requested engineering discussion. Review your response before confirming.',focus:['Confirm next step','Review response','Confirm demo response']};
  }
  if (quote.version > 1) return {chapter:3,role:'buyer',state:'compare',title:'See what changed, then agree on the next step.',note:'Compare v1 and v2. Request an engineering review of the mounting interface and application load.',focus:['Choose next step','Review request','Confirm demo request']};
  return {chapter:3,role:'buyer',state:'change',title:'Keep a change inside the same conversation.',note:'Request 30 assemblies and an earlier delivery using sample changes. Review and confirm the request.',focus:['Request a change','Review request','Confirm demo request']};
}

export function walkthroughDestination(flow, project, baseURL, sessionId) {
  const url = new URL(flow.role==='seller' ? '../studio/' : '../product-room/', baseURL);
  url.searchParams.set('walkthrough',sessionId);
  if (flow.role==='buyer') url.searchParams.set('model','kinetic-01');
  if (!project) url.hash=flow.state==='inquiry' ? 'inquiry' : 'explore';
  else if (flow.role==='seller') {
    const params=new URLSearchParams({id:project.id});
    if(flow.state==='revision') params.set('tab','quotation');
    url.hash=`project?${params}`;
  } else {
    const params=new URLSearchParams({project:project.id,tab:flow.state==='question'||flow.state==='complete' ? 'activity' : 'quotation'});
    if(project.quotes.at(-1)) params.set('quote',project.quotes.at(-1).id);
    url.hash=`project&${params}`;
  }
  return url;
}
