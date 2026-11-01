import './chrome.css';
import {readWalkthroughSession, createWalkthroughRepository} from './session.js';
import {WALKTHROUGH_CHAPTERS, walkthroughFlow, walkthroughDestination} from './flow.js';
import {getWalkthroughAction, subscribeWalkthroughActions, createAdvanceGuard, isWalkthroughActionCurrent} from './actions.js';

const id=readWalkthroughSession();
// Studio's embedded draft preview already has its own preview controls. It must
// not display a second commercial guide or expose the session's customer case.
if(id && !new URLSearchParams(location.search).has('studioPreview')) mountWalkthrough(id);

function mountWalkthrough(sessionId) {
  const repository=createWalkthroughRepository(sessionId);
  const seller=location.pathname.includes('/studio/'), role=seller?'seller':'buyer';
  const strip=document.createElement('aside');
  strip.className='walkthrough-strip';strip.setAttribute('aria-label','Demo walkthrough');
  strip.innerHTML=`<div class="wt-main"><div class="wt-identity"><span class="wt-label">Demo walkthrough</span><span class="wt-role">Viewing as ${role}</span></div><nav class="wt-chapters" aria-label="Demonstration chapters"></nav><div class="wt-actions"><button type="button" class="wt-handoff" disabled data-step="loading"><span class="wt-action-label">Continue demo</span><span aria-hidden="true">→</span></button><details class="wt-tools"><summary>Guide</summary><div class="wt-menu"><p class="wt-menu-title"></p><p class="wt-menu-note"></p><p>One fictional crank project. Actions stay in this browser; nothing is sent. Existing projects are separate.</p><button type="button" class="wt-restart">Start a new sample</button></div></details></div></div><div class="wt-guide" aria-live="polite"><strong></strong><p id="wt-next-action"></p></div><p class="wt-error" role="alert" hidden></p>`;
  document.body.prepend(strip);document.body.dataset.walkthrough='true';
  const resize=new ResizeObserver(()=>document.documentElement.style.setProperty('--walkthrough-height',`${strip.getBoundingClientRect().height}px`));resize.observe(strip);
  const steps=strip.querySelector('.wt-chapters');
  for(const chapter of WALKTHROUGH_CHAPTERS) {
    const b=document.createElement('button');b.type='button';b.dataset.chapter=chapter.id;
    b.innerHTML=`<span class="wt-step">0${chapter.id}</span><span class="wt-chapter-title-long">${chapter.title}</span><span class="wt-chapter-title-short">${chapter.short}</span>`;
    b.setAttribute('aria-label',`Chapter ${chapter.id}: ${chapter.title}`);steps.append(b);
  }
  let project=null, flow=null, generation=0, timer, currentAction=null, actionURL='', running=false;
  const keyboardKey=`annora.walkthrough.keyboard.${sessionId}`;
  let restoreKeyboardFocus=false;
  try { restoreKeyboardFocus=sessionStorage.getItem(keyboardKey)==='continue'; } catch {}
  const guard=createAdvanceGuard();
  const handoff=strip.querySelector('.wt-handoff');
  handoff.setAttribute('aria-describedby','wt-next-action');
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
  function renderAction(is3D) {
    const host=getWalkthroughAction(is3D?'buyer-viewer':`${role}-workspace`);
    const inWorkspace=seller?location.hash.startsWith('#project?'):/^#(project|inquiry)/.test(location.hash);
    // An in-flight native action may have changed saved state before its host has
    // settled. Keep its lock instead of offering an early role handoff.
    if(host?.busy && (is3D||inWorkspace)) currentAction=host;
    else if(host?.id==='buyer-refresh' && inWorkspace) currentAction=host;
    else if(is3D && !project && host) currentAction=host;
    else if(role!==flow.role) currentAction={id:`handoff-${flow.role}-${flow.state}`,note:`Next: view this project as ${flow.role}.`,run:()=>navigate(walkthroughDestination(flow,project,location.href,sessionId))};
    else if(is3D || !inWorkspace) currentAction={id:'return-to-project',note:'Next: return to the current step in this project.',run:()=>navigate(walkthroughDestination(flow,project,location.href,sessionId))};
    else if(host?.id==='latest-quotation' || flow.state==='complete' && host?.id==='completed-conversation' && !location.hash.includes('tab=activity')) currentAction=host;
    else if(flow.state==='complete') currentAction={id:'complete',label:'Demo complete',disabled:true,title:'The next step is agreed.',note:'The buyer and seller share the revised quotation and confirmed engineering discussion.'};
    else if(host) currentAction=host;
    else currentAction={id:'loading',disabled:true,note:'Opening the next action…'};
    const locked=running||guard.blocked||currentAction.busy;
    handoff.dataset.step=currentAction.id;
    handoff.dataset.confirmation=String(Boolean(currentAction.confirmation));
    handoff.disabled=Boolean(locked||currentAction.disabled);
    handoff.setAttribute('aria-busy',String(Boolean(locked)));
    handoff.querySelector('.wt-action-label').textContent=locked?'Please wait…':currentAction.id==='complete'?'Demo complete':currentAction.confirmation?'Confirm & continue':'Continue demo';
    const title=currentAction.title || flow.title;
    const note=currentAction.note || flow.note;
    strip.querySelector('.wt-guide strong').textContent=title;
    strip.querySelector('.wt-guide p').textContent=note;
    strip.querySelector('.wt-menu-title').textContent=title;
    strip.querySelector('.wt-menu-note').textContent=note;
    actionURL=location.href;
    if(!handoff.disabled && restoreKeyboardFocus && !document.querySelector('dialog[open]')) {
      restoreKeyboardFocus=false;
      try {sessionStorage.removeItem(keyboardKey);} catch {}
      handoff.focus({preventScroll:true});
    }
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
      const is3D=!seller&&location.hash.startsWith('#explore');
      // A chapter link is navigation, not a persistent override of progress.
      // Issuing v1 must always reveal chapter 3, including on a resumed visit.
      const chapter=is3D?1:!project&&!seller?2:flow.chapter;
      for(const button of steps.children){const n=Number(button.dataset.chapter);button.disabled=n===3&&!project?.quotes.length;button.toggleAttribute('aria-current',n===chapter);if(n===chapter)button.setAttribute('aria-current','step');}
      renderAction(is3D);
    } catch(error) {
      if(turn!==generation)return;
      strip.querySelector('.wt-guide strong').textContent='The sample could not be opened.';
      strip.querySelector('.wt-guide p').textContent=error.message;
      strip.querySelector('.wt-menu-title').textContent='Sample data unavailable';strip.querySelector('.wt-menu-note').textContent=error.message;
      handoff.disabled=true;handoff.dataset.step="error";
    }
  }
  handoff.addEventListener('click',async event=>{
    if(event.detail>1 || handoff.disabled || !currentAction?.run || guard.blocked)return;
    // Back/Forward and native editing can retire an action before a debounced
    // guidance refresh. A cached confirmation must never run on another view.
    if(!isWalkthroughActionCurrent(currentAction,actionURL,location.href)) {invalidate();return;}
    const action=currentAction;
    if(event.detail===0) {
      restoreKeyboardFocus=true;
      try {sessionStorage.setItem(keyboardKey,'continue');} catch {}
    }
    running=true;strip.querySelector('.wt-error').hidden=true;
    handoff.disabled=true;handoff.setAttribute('aria-busy','true');
    handoff.querySelector('.wt-action-label').textContent='Please wait…';
    try {await guard.run(action.run);}
    catch(error){const output=strip.querySelector('.wt-error');output.textContent=error.message||'This step could not finish. Try again.';output.hidden=false;}
    finally {
      running=false;
      // A second click from the same gesture must not confirm the review that
      // the first click just opened. No scheduled business action follows it.
      setTimeout(()=>void refresh(),850);
      void refresh();
    }
  });
  // Holding Enter is one gesture, not consent to the review that just opened.
  handoff.addEventListener('keydown',event=>{if(event.repeat && ['Enter',' '].includes(event.key))event.preventDefault();});
  steps.addEventListener('click',event=>{const button=event.target.closest('button');if(!button||button.disabled||!flow)return;const n=Number(button.dataset.chapter);if(n===2&&!project&&document.getElementById('room-discuss')&&!document.getElementById('room-discuss').hidden)document.getElementById('room-discuss').click();else navigate(chapterURL(n));});
  strip.querySelector('.wt-restart').addEventListener('click',()=>navigate(new URL('../walkthrough/?new=1',location.href)));
  const schedule=()=>{clearTimeout(timer);timer=setTimeout(refresh,80);};
  function invalidate() {
    ++generation;currentAction=null;handoff.disabled=true;
    schedule();
  }
  for(const event of ['annora:walkthrough-change','annora:routechange','popstate','hashchange']) window.addEventListener(event,invalidate);
  window.addEventListener('focus',schedule);
  window.addEventListener('storage',event=>{if(!event.key||event.key===repository.storageKey)schedule();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule();});
  const unsubscribe=subscribeWalkthroughActions(invalidate);
  window.addEventListener('pagehide',event=>{if(!event.persisted){unsubscribe();resize.disconnect();clearTimeout(timer);}});
  void refresh();
}
