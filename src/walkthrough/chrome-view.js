import './chrome.css';
import {walkthroughPresentation} from './presentation.js';
import {createWalkthroughRepository, walkthroughViewer} from './session.js';
import {WALKTHROUGH_CHAPTERS, walkthroughFlow, walkthroughDestination, walkthroughRootURL, walkthroughViewerURL} from './flow.js';
import {getWalkthroughAction, subscribeWalkthroughActions, createAdvanceGuard, isWalkthroughActionCurrent, walkthroughHostOwnsStep} from './actions.js';

export function mountWalkthrough(sessionId) {
  const repository=createWalkthroughRepository(sessionId);
  const seller=location.pathname.includes('/studio/');
  const parameters=new URLSearchParams(location.search);
  const externalReference=walkthroughViewer(sessionId)==='independent' && location.pathname.includes('/integrations/existing-viewer/') && parameters.has('project');
  const role=seller || externalReference && parameters.get('returnRole')==='seller' ? 'seller' : 'buyer';
  const strip=document.createElement('aside');
  strip.className='walkthrough-strip';strip.setAttribute('aria-label','Demo walkthrough');
  strip.innerHTML=`<div class="wt-main"><div class="wt-context" aria-live="polite" aria-atomic="true"><span class="wt-current-chapter"></span><strong class="wt-current-step">Opening the demo…</strong></div><div class="wt-role-context" aria-live="polite" aria-atomic="true"><span class="wt-role">${role==='seller'?'Seller':'Buyer'} view</span><span class="wt-next-role" hidden></span></div><button type="button" class="wt-handoff" disabled data-step="loading"><span class="wt-action-label">Continue demo</span><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 12h15m-6-6 6 6-6 6"/></svg></button><details class="wt-tools"><summary aria-label="Demo guide">Guide</summary><div class="wt-menu"><p class="wt-menu-note"></p><nav class="wt-chapters" aria-label="Demonstration chapters"></nav><button type="button" class="wt-navigation" aria-expanded="false">Show workspace navigation</button><p class="wt-sample-note">Fictional sample · Saved in this browser. Nothing is sent.</p><button type="button" class="wt-restart">Start a new sample</button></div></details></div><p id="wt-next-action" class="wt-sr-only"></p><p class="wt-error" role="alert" hidden></p>`;
  document.body.prepend(strip);document.body.dataset.walkthrough='true';document.body.dataset.walkthroughViewer=walkthroughViewer(sessionId);
  const resize=new ResizeObserver(()=>document.documentElement.style.setProperty('--walkthrough-height',`${strip.getBoundingClientRect().height}px`));resize.observe(strip);
  const steps=strip.querySelector('.wt-chapters');
  for(const chapter of WALKTHROUGH_CHAPTERS) {
    const b=document.createElement('button');b.type='button';b.dataset.chapter=chapter.id;
    b.innerHTML=`<span class="wt-step">0${chapter.id}</span><span class="wt-chapter-title-long">${chapter.title}</span><span class="wt-chapter-title-short">${chapter.short}</span>`;
    b.setAttribute('aria-label',`Chapter ${chapter.id}: ${chapter.title}`);steps.append(b);
  }
  let project=null, flow=null, currentChapter=1, generation=0, timer, currentAction=null, actionURL='', running=false, errorSource=null;
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
    const url=new URL('product-room/',walkthroughRootURL(location.href));url.searchParams.set('walkthrough',sessionId);url.searchParams.set('model','kinetic-01');return url;
  }
  function chapterURL(chapter) {
    if(chapter===1) {
      const url=walkthroughViewerURL(location.href,sessionId);url.searchParams.set('demoChapter','1');
      if(project) {url.hash=`explore&project=${encodeURIComponent(project.id)}`;if(walkthroughViewer(sessionId)==='independent')url.searchParams.set('project',project.id);url.searchParams.set('returnRole',role);url.searchParams.set('returnView',location.hash);}
      else url.hash='explore';
      return url;
    }
    if(chapter===2 && !project && walkthroughViewer(sessionId)==='independent') {const url=walkthroughViewerURL(location.href,sessionId);url.hash='inquiry';return url;}
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
    if(externalReference) currentAction=host?.id==='reference-return'?host:{id:'loading',disabled:true,note:'Restoring this saved reference…'};
    else if(host?.busy && (is3D||inWorkspace)) currentAction=host;
    else if(host?.id==='buyer-refresh' && inWorkspace) currentAction=host;
    // A native editor/review remains the current task even when the saved
    // project would otherwise suggest changing roles. Never skip its gate.
    else if(inWorkspace && walkthroughHostOwnsStep(host)) currentAction=host;
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
    const presentation=walkthroughPresentation({role,chapter:currentChapter,action:currentAction,flow,locked});
    handoff.querySelector('.wt-action-label').textContent=presentation.buttonLabel;
    strip.querySelector('.wt-current-chapter').textContent=presentation.chapterLabel;
    strip.querySelector('.wt-current-step').textContent=presentation.title;
    strip.querySelector('.wt-role').textContent=presentation.roleLabel;
    const nextRole=strip.querySelector('.wt-next-role');
    nextRole.textContent=presentation.nextRoleLabel;
    nextRole.hidden=!presentation.nextRoleLabel;
    const note=currentAction.note || flow.note;
    strip.querySelector('#wt-next-action').textContent=note;
    strip.querySelector('.wt-menu-note').textContent=note;
    actionURL=location.href;
    if(!handoff.disabled && restoreKeyboardFocus && !document.querySelector('dialog[open], .ei-panel[role="dialog"]')) {
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
      if(errorSource==='refresh') {strip.querySelector('.wt-error').hidden=true;errorSource=null;}
      const params=new URLSearchParams(location.hash.replace(/^#project[?&]/,''));
      const currentId=params.get('project')||params.get('id')||new URLSearchParams(location.search).get('project');
      if(currentId && walkthroughViewer(sessionId)==='independent' && !projects.some(item=>item.id===currentId)) throw new Error('This saved project is unavailable. Open a valid project reference or start a new sample from Guide.');
      project=projects.find(item=>item.id===currentId)||projects[0]||null;
      flow=walkthroughFlow(project,{hasDraft:drafts.length>0,viewer:walkthroughViewer(sessionId)});
      const is3D=!seller&&location.hash.startsWith('#explore');
      // A chapter link is navigation, not a persistent override of progress.
      // Issuing v1 must always reveal chapter 3, including on a resumed visit.
      const chapter=is3D?1:!project&&!seller?2:flow.chapter;
      currentChapter=chapter;
      for(const button of steps.children){const n=Number(button.dataset.chapter);button.disabled=n===3&&!project?.quotes.length;button.toggleAttribute('aria-current',n===chapter);if(n===chapter)button.setAttribute('aria-current','step');}
      renderAction(is3D);
    } catch(error) {
      if(turn!==generation)return;
      strip.querySelector('.wt-current-step').textContent='The sample could not be opened.';
      strip.querySelector('#wt-next-action').textContent=error.message;
      strip.querySelector('.wt-menu-note').textContent=error.message;
      const output=strip.querySelector('.wt-error');output.textContent=error.message;output.hidden=false;
      errorSource='refresh';
      handoff.disabled=true;handoff.dataset.step="error";
    }
  }
  const menu=strip.querySelector('.wt-tools');
  const navigation=strip.querySelector('.wt-navigation');
  navigation.addEventListener('click',()=>{
    const show=!document.body.hasAttribute('data-wt-navigation');
    document.body.toggleAttribute('data-wt-navigation',show);
    navigation.setAttribute('aria-expanded',String(show));
    navigation.textContent=show?'Hide workspace navigation':'Show workspace navigation';
    menu.open=false;
    if(show) document.querySelector('.room-header a, .studio-header a')?.focus({preventScroll:true});
    else menu.querySelector('summary').focus({preventScroll:true});
  });
  strip.addEventListener('keydown',event=>{
    if(event.key==='Escape' && menu.open){menu.open=false;menu.querySelector('summary').focus();}
  });
  const closeMenu=event=>{if(menu.open&&!menu.contains(event.target)) menu.open=false;};
  document.addEventListener('pointerdown',closeMenu);
  handoff.addEventListener('click',async event=>{
    menu.open=false;
    if(event.detail>1 || handoff.disabled || !currentAction?.run || guard.blocked)return;
    // Back/Forward and native editing can retire an action before a debounced
    // guidance refresh. A cached confirmation must never run on another view.
    if(!isWalkthroughActionCurrent(currentAction,actionURL,location.href)) {invalidate();return;}
    const action=currentAction;
    if(event.detail===0) {
      restoreKeyboardFocus=true;
      try {sessionStorage.setItem(keyboardKey,'continue');} catch {}
    }
    running=true;strip.querySelector('.wt-error').hidden=true;errorSource=null;
    handoff.disabled=true;handoff.setAttribute('aria-busy','true');
    handoff.querySelector('.wt-action-label').textContent='Please wait…';
    try {await guard.run(action.run);}
    catch(error){const output=strip.querySelector('.wt-error');output.textContent=error.message||'This step could not finish. Try again.';output.hidden=false;errorSource='action';}
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
  steps.addEventListener('click',event=>{const button=event.target.closest('button');if(!button||button.disabled||!flow)return;const n=Number(button.dataset.chapter);menu.open=false;if(n===2&&!project&&document.getElementById('room-discuss')&&!document.getElementById('room-discuss').hidden)document.getElementById('room-discuss').click();else navigate(chapterURL(n));});
  strip.querySelector('.wt-restart').addEventListener('click',()=>navigate(new URL(`walkthrough/?new=1${walkthroughViewer(sessionId)==='independent'?'&viewer=independent':''}`,walkthroughRootURL(location.href))));
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
  window.addEventListener('pagehide',event=>{if(!event.persisted){unsubscribe();resize.disconnect();clearTimeout(timer);document.removeEventListener('pointerdown',closeMenu);}});
  void refresh();
}
