import './chrome.css';
import {resumeWalkthroughSession,restartWalkthroughSession,createWalkthroughRepository} from './session.js';
import {walkthroughFlow,walkthroughDestination} from './flow.js';

async function open() {
  const params=new URL(location.href).searchParams;
  const viewer=params.get('viewer')==='independent'?'independent':'explorer';
  try {
    const session=params.get('new')==='1'?restartWalkthroughSession({viewer}):resumeWalkthroughSession({viewer});
    const repository=createWalkthroughRepository(session.id);
    const [projects,drafts]=await Promise.all([repository.listProjects(),repository.listDrafts()]);
    const project=projects[0]||null, flow=walkthroughFlow(project,{hasDraft:drafts.length>0,viewer});
    location.replace(walkthroughDestination(flow,project,location.href,session.id));
  } catch(error) {
    const main=document.querySelector('main');
    main.querySelector('h1').textContent='Your sample needs attention.';
    main.querySelector('[role="status"]').textContent=error.message;
    const link=document.createElement('a');link.href=`?new=1${viewer==='independent'?'&viewer=independent':''}`;link.textContent='Start a new sample';main.append(link);
    const note=document.createElement('p');note.textContent='Starting a new sample keeps previous demonstration data and existing projects unchanged.';main.append(note);
  }
}
void open();
