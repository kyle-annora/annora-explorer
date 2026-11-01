import './chrome.css';
import {readWalkthroughSession, createWalkthroughRepository} from './session.js';
import {WALKTHROUGH_CHAPTERS, walkthroughFlow, walkthroughDestination} from './flow.js';

const id=readWalkthroughSession();
// Studio's embedded draft preview already has its own preview controls. It must
// not display a second commercial guide or expose the session's customer case.
if(id && !new URLSearchParams(location.search).has('studioPreview')) mountWalkthrough(id);

function mountWalkthrough(sessionId) {
  const repository=createWalkthroughRepository(sessionId);
  const seller=location.pathname.includes('/studio/'), role=seller?'seller':'buyer';
  const strip=document.createElement('aside');
  strip.className='walkthrough-strip';strip.setAttribute('aria-label','Demo walkthrough');
  strip.innerHTML=`<div class="wt-main"><div class="wt-identity"><span class="wt-label">Demo walkthrough</span><span class="wt-role">Viewing as ${role}</span></div><nav class="wt-chapters" aria-label="Demonstration chapters"></nav><div class="wt-actions"><a class="wt-handoff" href="#" hidden></a><details class="wt-tools"><summary>Guide</summary><div class="wt-menu"><p class="wt-menu-title"></p><p class="wt-menu-note"></p><p>One fictional crank project. Actions stay in this browser; nothing is sent. Existing projects are separate.</p><button type="button" class="wt-restart">Start a new sample</button></div></details></div></div><div class="wt-guide"><strong></strong><p></p></div>`;
  document.body.prepend(strip);document.body.dataset.walkthrough='true';
  const resize=new ResizeObserver(()=>document.documentElement.style.setProperty('--walkthrough-height',`${strip.getBoundingClientRect().height}px`));resize.observe(strip);
  const steps=strip.querySelector('.wt-chapters');
  for(const chapter of WALKTHROUGH_CHAPTERS) {
    const b=document.createElement('button');b.type='button';b.dataset.chapter=chapter.id;
    b.innerHTML=`<span class="wt-step">0${chapter.id}</span><span class="wt-chapter-title-long">${chapter.title}</span><span class="wt-chapter-title-short">${chapter.short}</span>`;
    b.setAttribute('aria-label',`Chapter ${chapter.id}: ${chapter.title}`);steps.append(b);
  }
  let project=null, flow=null, generation=0, timer;
  const handoff=strip.querySelector('.wt-handoff');
  function navigate(url) {
    const detail={url:String(url),handled:false};
    window.dispatchEvent(new CustomEvent('annora:walkthrough-navigate',{detail}));
    if(!detail.handled) location.assign(detail.url);
  }
  function roomURL() {
    const url=new URL('../product-room/',location.href);url.searchParams.set('walkthrough',sessionId);url.searchParams.set('model','kinetic-01');return url;
  }
  function chapterURL(chapter) {
    if(chapter===1) {
      const url=roomURL();url.searchParams.set('demoChapter','1');
      if(project) {url.hash=`explore&project=${encodeURIComponent(project.id)}`;url.searchParams.set('returnRole',role);url.searchParams.set('returnView',location.hash);}
      else url.hash='explore';
      return url;
    }
    const selected=chapter===2 ? {role:project&&!project.quotes.length?'seller':'buyer',state:project?'quotation':'inquiry'} : flow;
    const url=walkthroughDestination(selected,project,location.href,sessionId);url.searchParams.set('demoChapter',String(chapter));
    if(chapter===2 && project?.quotes.length) url.hash=`project&${new URLSearchParams({project:project.id,tab:'quotation',quote:project.quotes[0].id})}`;
    return url;
  }
  function focusAction() {
    const labels=[...flow.focus].reverse();
    // Shared buttons keep an invisible pending label mounted to preserve width.
    // Match the active label, not the concatenated text of both states.
    const labelOf=el=>(el.querySelector('.ar-button-label')?.textContent||el.getAttribute('aria-label')||el.innerText).replace(/[→↗]/g,'').replace(/\s+/g,' ').trim();
    const available=el=>el.getClientRects().length&&!el.disabled&&el.getAttribute('aria-disabled')!=='true'&&el.getAttribute('aria-busy')!=='true';
    const controls=[...document.querySelectorAll('main button, .customer-workspace button')].filter(available);
    const found=labels.map(label=>controls.find(el=>labelOf(el)===label)).find(Boolean);
    if(found){found.scrollIntoView({block:'center',behavior:'instant'});found.focus({preventScroll:true});return;}
    // A quotation can be reached without creating a new business action.
    const tab=controls.find(el=>el.closest('.pw-project-tabs,.customer-tabs')&&/^Quotation(?:\s|\d|v\d|$)/.test(labelOf(el)));
    if(tab) {tab.click();setTimeout(()=>{const target=[...document.querySelectorAll('button')].find(el=>available(el)&&labels.includes(labelOf(el)));target?.scrollIntoView({block:'center',behavior:'instant'});target?.focus({preventScroll:true});},50);}
  }
  async function refresh() {
    const turn=++generation;
    try {
      const [projects,drafts]=await Promise.all([repository.listProjects(),repository.listDrafts()]);
      if(turn!==generation)return;
      const params=new URLSearchParams(location.hash.replace(/^#project[?&]/,''));
      const currentId=params.get('project')||params.get('id');
      project=projects.find(item=>item.id===currentId)||projects[0]||null;
      flow=walkthroughFlow(project,{hasDraft:drafts.length>0});
      if(!seller && params.get('quote') && project?.quotes.some(item=>item.id===params.get('quote')) && params.get('quote')!==project.quotes.at(-1)?.id) {
        flow={...flow,title:'You are viewing an earlier quotation.',note:'This version stays unchanged. Open the latest quotation to continue the conversation.',focus:['Open latest quotation']};
      }
      const is3D=!seller&&location.hash.startsWith('#explore');
      const requested=Number(new URL(location.href).searchParams.get('demoChapter'));
      const chapter=is3D?1:[1,2,3].includes(requested)?requested:flow.chapter;
      for(const button of steps.children){const n=Number(button.dataset.chapter);button.disabled=n===3&&!project?.quotes.length;button.toggleAttribute('aria-current',n===chapter);if(n===chapter)button.setAttribute('aria-current','step');}
      const title=is3D?'Understand the mechanism together.':flow.title;
      const note=is3D?'Run a short cycle, select Connecting rod, and carry that reference into the inquiry.':flow.note;
      strip.querySelector('.wt-guide strong').textContent=title;strip.querySelector('.wt-guide p').textContent=note;
      strip.querySelector('.wt-menu-title').textContent=title;strip.querySelector('.wt-menu-note').textContent=note;
      handoff.hidden=false;
      handoff.dataset.action='navigate';
      if(role!==flow.role) {handoff.textContent=`Continue as ${flow.role}`;handoff.href=walkthroughDestination(flow,project,location.href,sessionId);}
      else if(flow.state==='complete') {handoff.textContent='View completed project';handoff.href=walkthroughDestination(flow,project,location.href,sessionId);}
      else if(is3D&&!project) {handoff.textContent='Start an inquiry';handoff.href=chapterURL(2);handoff.dataset.action='inquire';}
      else if(is3D&&project || (seller&&!location.hash.startsWith('#project?')) || (!seller&&!/^#(project|inquiry)/.test(location.hash))) {handoff.textContent='Continue this project';handoff.href=walkthroughDestination(flow,project,location.href,sessionId);}
      else {handoff.textContent='Find next action';handoff.href='#';handoff.dataset.action='focus';}
    } catch(error) {
      if(turn!==generation)return;
      strip.querySelector('.wt-guide strong').textContent='The sample could not be opened.';
      strip.querySelector('.wt-guide p').textContent=error.message;
      strip.querySelector('.wt-menu-title').textContent='Sample data unavailable';strip.querySelector('.wt-menu-note').textContent=error.message;
      handoff.hidden=true;
    }
  }
  handoff.addEventListener('click',event=>{
    event.preventDefault();
    if(handoff.dataset.action==='focus') focusAction();
    else if(handoff.dataset.action==='inquire'&&document.getElementById('room-discuss')) document.getElementById('room-discuss').click();
    else navigate(handoff.href);
  });
  steps.addEventListener('click',event=>{const button=event.target.closest('button');if(!button||button.disabled||!flow)return;const n=Number(button.dataset.chapter);if(n===2&&!project&&document.getElementById('room-discuss')&&!document.getElementById('room-discuss').hidden)document.getElementById('room-discuss').click();else navigate(chapterURL(n));});
  strip.querySelector('.wt-restart').addEventListener('click',()=>navigate(new URL('../walkthrough/?new=1',location.href)));
  const schedule=()=>{clearTimeout(timer);timer=setTimeout(refresh,80);};
  for(const event of ['annora:walkthrough-change','annora:routechange','popstate','hashchange','focus']) window.addEventListener(event,schedule);
  window.addEventListener('storage',event=>{if(!event.key||event.key===repository.storageKey)schedule();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule();});
  void refresh();
}
