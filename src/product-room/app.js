import './styles.css';
import { ROOM_CONTENT, DEFAULT_ROOM_ID } from './content.js';
import { MODEL_CATALOG } from '../generated/catalog.js';
import { createRoomViewer } from './viewer.js';
import { createRequestFlow } from './request.js';
import crankImage from './assets/crank.png';
import apolloImage from './assets/apollo.png';

const $ = id => document.getElementById(id);
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const images = { 'kinetic-01': crankImage, apollo: apolloImage };
const pages = ['explore', 'overview', 'specs'];
const workspacePages = ['projects', 'inquiry', 'project', 'components'];
const readRoute = () => {
  const [view, ...params] = location.hash.slice(1).split('&');
  return { view: view || 'explore', projectId: new URLSearchParams(params.join('&')).get('project') || undefined };
};
function boot() {
  const configuredRooms = Object.keys(ROOM_CONTENT).filter(id => MODEL_CATALOG[id]);
  $('room-product').replaceChildren(...configuredRooms.map(id => { const option = document.createElement('option'); option.value = id; option.textContent = ROOM_CONTENT[id].shortTitle; return option; }));
  if (!configuredRooms.length) {
    $('room-loading').hidden = true; $('room-error').hidden = false; $('room-retry').hidden = true;
    $('room-error').querySelector('h1').textContent = 'No Product Room configured.';
    $('room-error-message').textContent = 'This project has an Explorer, but no matching Product Room content yet.';
    const link = $('room-error').querySelector('a'); link.href = '../'; link.textContent = 'Open Explorer';
    document.querySelector('.room-nav').hidden = true; $('room-discuss').hidden = true; $('room-product').disabled = true;
    return;
  }
  let productId = new URL(location.href).searchParams.get('model');
  if (!configuredRooms.includes(productId)) productId = configuredRooms.includes(DEFAULT_ROOM_ID) ? DEFAULT_ROOM_ID : configuredRooms[0];
  let page = 'explore', navigation = 0, action = 0, loading = null, mountedModel = null, noticeTimer;
  let workspace, workspaceLoading, currentRoute = readRoute();
  const flow = createRequestFlow({ dialog: $('room-request') });
  const viewer = createRoomViewer({
    mount: $('room-viewer'), explorerURL: new URL('../', location.href).href,
    onState(state) {
      const id = state.model?.id;
      if (productId === mountedModel && ROOM_CONTENT[id] && id !== productId) {
        productId = id; mountedModel = id; renderContent(); updateURL(true);
      }
      $('room-viewer').dataset.lifecycle = state.lifecycle;
      if (state.lifecycle === 'loading') $('room-loading').hidden = false;
    },
    onReady({state}) {
      mountedModel = state.model.id; $('room-loading').hidden = true; $('room-error').hidden = true;
      if (page !== 'explore' || document.hidden || $('room-request').open) void viewer.pause().catch(()=>{});
    },
    onError(error) {
      $('room-loading').hidden = true; $('room-error').hidden = false;
      $('room-error-message').textContent = `${error.message} Product information and documents remain available.`;
    }
  });

  function updateURL(replace = false) {
    const url = new URL(location.href); url.searchParams.set('model', productId);
    url.hash = page + (page === 'project' && currentRoute.projectId ? `&project=${encodeURIComponent(currentRoute.projectId)}` : '');
    history[replace ? 'replaceState' : 'pushState']({}, '', url);
    document.title = `${ROOM_CONTENT[productId].title} · Product Room`;
  }
  function baseContext(id = productId) {
    const room = ROOM_CONTENT[id];
    return { productId:id, productTitle:room.title, modelId:id, modelRevision:MODEL_CATALOG[id].revision };
  }
  async function ensureWorkspace() {
    if (workspace) return workspace;
    if (!workspaceLoading) workspaceLoading = import('./workspace-entry.jsx').then(({createWorkspace}) => {
      workspace = createWorkspace($('room-workspace'), {
        onNavigate: route => { ++action; void showPage(route.view, {route,focus:true}).catch(error=>notice(error.message)); },
        onExplore: async context => {
          if (!configuredRooms.includes(context.modelId)) { notice('This project’s model is not available in this deployment.'); return; }
          ++action;
          if (context.modelRevision !== MODEL_CATALOG[context.modelId].revision) {
            await showPage('overview', {focus:true,modelId:context.modelId});
            notice('The model has changed since this inquiry. The saved inquiry keeps its original revision.'); return;
          }
          if (context.part?.id) await showTarget({kind:'part',nodeId:context.part.id},context.modelId);
          else if (context.chapter) await showTarget({kind:'chapter',tourId:context.chapter.tourId,chapterId:context.chapter.id},context.modelId);
          else await showPage('explore',{modelId:context.modelId});
        }
      });
      return workspace;
    }).catch(error => { workspaceLoading = null; throw error; });
    return workspaceLoading;
  }
  function notice(message) {
    clearTimeout(noticeTimer); $('room-notice').textContent = message; $('room-notice').hidden = false;
    noticeTimer = setTimeout(()=> { $('room-notice').hidden = true; }, 6500);
  }
  function ensureViewer(force = false) {
    if (!force && mountedModel === productId && viewer.state?.lifecycle === 'ready') return Promise.resolve();
    if (!force && mountedModel === productId && loading) return loading;
    if (!force && mountedModel === productId && viewer.iframe && viewer.state?.lifecycle === 'loading') return viewer.whenReady();
    mountedModel = productId; $('room-loading').hidden = false; $('room-error').hidden = true;
    const pending = viewer.mountModel(productId); loading = pending;
    pending.finally(()=> { if (loading === pending) loading = null; }).catch(()=>{});
    return pending;
  }
  async function showPage(next, {record = true, focus = false, route = {view:next}, modelId} = {}) {
    const turn = ++navigation;
    if (workspace && workspacePages.includes(page) && !(await workspace.beforeLeave())) {
      if (turn === navigation) { renderContent(); updateURL(true); }
      return;
    }
    if (turn !== navigation) return;
    if (next !== 'explore') await viewer.pause().catch(()=>{});
    if (turn !== navigation) return;
    const desiredModel = workspacePages.includes(next) && configuredRooms.includes('kinetic-01') ? 'kinetic-01' : modelId;
    if (configuredRooms.includes(desiredModel) && productId !== desiredModel) { productId = desiredModel; renderContent(); }
    page = [...pages,...workspacePages].includes(next) ? next : 'explore';
    currentRoute = {...route,view:page};
    for (const name of pages) $(`page-${name}`).hidden = name !== page;
    $('page-workspace').hidden = !workspacePages.includes(page);
    $('room-discuss').hidden = workspacePages.includes(page);
    document.body.toggleAttribute('data-workspace', workspacePages.includes(page));
    document.body.dataset.page = page;
    for (const link of document.querySelectorAll('[data-page]')) {
      if (link.dataset.page === page || link.dataset.page === 'projects' && ['project','inquiry'].includes(page)) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
    }
    if (record) updateURL(); else updateURL(true);
    if (focus && page !== 'explore') $('room-main').focus({preventScroll:true});
    if (page === 'explore') await ensureViewer();
    else if (workspacePages.includes(page)) {
      try {
        const host = await ensureWorkspace();
        if (turn !== navigation) return;
        host.open({...currentRoute, context:route.context || baseContext(configuredRooms.includes('kinetic-01') ? 'kinetic-01' : productId)});
      } catch (error) { notice(`The project workspace could not open. ${error.message} Please try again.`); }
    }
  }
  function renderContent() {
    const room = ROOM_CONTENT[productId]; $('room-product').value = productId;
    $('room-discuss').querySelector('.room-discuss-full').textContent = productId === 'kinetic-01' ? 'Request a quote' : 'Discuss application';
    $('room-discuss').querySelector('.room-discuss-short').textContent = productId === 'kinetic-01' ? 'Inquire' : 'Discuss';
    const source = `<div class="room-source"><span class="room-eyebrow">SOURCE & SCOPE</span><p>${escape(room.source.note)}</p><a href="${escape(room.source.url)}" target="_blank" rel="noopener">${escape(room.source.label)} <span aria-hidden="true">↗</span></a><small>${escape(room.source.license)} · ${escape(room.roomRevision)}</small></div>`;
    $('page-overview').innerHTML = `
      <div class="room-content"><div class="room-overview-hero">
        <div class="room-intro"><p class="room-eyebrow">${escape(room.eyebrow)}</p><h1>${escape(room.tagline)}</h1><p class="room-lede">${escape(room.description)}</p><a class="room-button room-button-secondary" href="#explore">Explore the assembly <span aria-hidden="true">↗</span></a></div>
        <figure class="room-product-image" data-model="${productId}"><div class="room-image-crop"><img src="${images[productId]}" width="704" height="450" alt="Engineering view of the ${escape(room.title.toLowerCase())}" loading="lazy"></div><figcaption>${escape(room.title)} <span>Engineering view</span></figcaption></figure>
      </div><dl class="room-highlights">${room.highlights.map(item=>`<div><dt>${escape(item.label)}</dt><dd>${escape(item.value)}</dd></div>`).join('')}</dl>
      <section class="room-questions"><div><p class="room-eyebrow">UNDERSTAND THE PRODUCT</p><h2>${escape(room.summary)}</h2><p>Choose a question. Go straight to the relevant part or explanation in 3D.</p></div><ol>${room.questions.map((item,index)=>`<li><span class="room-number">0${index+1}</span><div><h3>${escape(item.title)}</h3><p>${escape(item.description)}</p><button class="room-text-button" data-question="${escape(item.id)}">${escape(item.actionLabel)} <span aria-hidden="true">↗</span></button></div></li>`).join('')}</ol></section>
      <div class="room-bottom"><p>${escape(room.demoNotice)}</p><a href="#specs" class="room-button room-button-secondary">Specs & documents <span aria-hidden="true">→</span></a></div>${source}</div>`;
    $('page-specs').innerHTML = `<div class="room-content"><header class="room-page-title"><div><p class="room-eyebrow">${escape(room.shortTitle)} / REFERENCE</p><h1>Details to build on.</h1></div><p>${escape(room.demoNotice)}</p></header>
      <div class="room-reference-layout"><div class="room-facts">${room.specGroups.map(group=>`<section><h2>${escape(group.title)}</h2><dl>${group.facts.map(fact=>`<div><dt>${escape(fact.label)}</dt><dd><strong>${escape(fact.value)}</strong>${fact.note?`<p>${escape(fact.note)}</p>`:''}${fact.nodeId?`<button class="room-text-button room-part-link" data-node="${escape(fact.nodeId)}">Locate in 3D <span aria-hidden="true">↗</span></button>`:''}<small>${escape(fact.source)}</small></dd></div>`).join('')}</dl></section>`).join('')}</div>
      <aside class="room-documents"><p class="room-eyebrow">DOCUMENT LIBRARY</p><h2>Take a closer look.</h2>${room.documents.map(doc=>`<article><span class="room-document-type">${escape(doc.type)} · ${escape(doc.revision)}</span><h3>${escape(doc.title)}</h3><p>${escape(doc.description)}</p><small>Updated ${escape(doc.date)} · Sample document</small><div class="room-document-actions"><a class="room-button room-button-secondary" href="${escape(doc.url)}" target="_blank" rel="noopener">Open brief <span aria-hidden="true">↗</span></a><a class="room-text-button" href="${escape(doc.url)}" download="${escape(doc.fileName)}">Download <span aria-hidden="true">↓</span></a></div><button class="room-text-button" data-document="${escape(doc.id)}">Ask about this document <span aria-hidden="true">→</span></button></article>`).join('')}<p class="room-document-note">Printable reference briefs for this demo. Production specifications would be supplied and approved by the product owner.</p></aside></div>${source}</div>`;
  }
  async function openRequest(documentId) {
    const turn = ++action, id = productId, room = ROOM_CONTENT[id];
    $('room-discuss').disabled = true;
    try {
      await viewer.pause().catch(()=>{});
      const context = viewer.state?.lifecycle === 'ready' ? await viewer.context().catch(()=>null) : null;
      if (turn !== action || id !== productId) return;
      const matched = context?.modelId === id;
      const doc = room.documents.find(item=>item.id === documentId);
      const request = {productId:id,productTitle:room.title,modelId:id,
        modelRevision: matched ? context.modelRevision : MODEL_CATALOG[id].revision,
        ...(matched && context.part ? {part:context.part}:{}),
        ...(matched && context.chapter ? {chapter:context.chapter}:{}),
        ...(doc ? {document:{id:doc.id,title:doc.title}}:{})};
      if (id === 'kinetic-01') await showPage('inquiry',{route:{view:'inquiry',context:request},focus:true});
      else flow.open(request);
    } catch { notice('The request could not be opened. Please try again.'); }
    finally { $('room-discuss').disabled = false; }
  }
  async function showTarget(target, targetProductId = productId) {
    const turn = ++action, id = targetProductId;
    const current = () => turn === action && id === productId && page === 'explore' && !$('room-request').open;
    try {
      await showPage('explore',{modelId:id});
      if (!current()) return;
      await viewer.pause();
      if (!current()) return;
      if (viewer.state?.tour?.active) await viewer.request('exitTour', {restore:false});
      if (!current()) return;
      if (target.kind === 'part') await viewer.request('focus',{nodeId:target.nodeId});
      else {
        await viewer.request('startTour',{tourId:target.tourId});
        if (!current()) return;
        await viewer.request('goToTourChapter',{chapterId:target.chapterId});
        if (!current()) return;
        notice('Explanation ready. Press Play when you are ready.');
      }
    } catch (error) { if (!['SUPERSEDED','CANCELLED'].includes(error.code)) notice(error.message || 'This view could not be opened. Please try again.'); }
  }
  document.addEventListener('click',event=> {
    const link = event.target.closest('a[href^="#"]');
    if (link && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0 && [...pages,...workspacePages].includes(link.hash.slice(1))) { event.preventDefault(); ++action; void showPage(link.hash.slice(1),{focus:true}).catch(()=>{}); return; }
    const question = event.target.closest('[data-question]');
    if (question) void showTarget(ROOM_CONTENT[productId].questions.find(item=>item.id===question.dataset.question).target);
    const part = event.target.closest('[data-node]'); if (part) void showTarget({kind:'part',nodeId:part.dataset.node});
    const doc = event.target.closest('[data-document]'); if (doc) void openRequest(doc.dataset.document);
  });
  $('room-product').addEventListener('change',()=> {
    ++action;
    void showPage(workspacePages.includes(page) ? 'overview' : page,{focus:true,modelId:$('room-product').value}).catch(()=>{});
  });
  $('room-discuss').addEventListener('click',()=>void openRequest());
  $('room-retry').addEventListener('click',()=>void ensureViewer(true).catch(()=>{}));
  window.addEventListener('popstate',()=> {
    ++action; const id = new URL(location.href).searchParams.get('model');
    const route = readRoute(); void showPage(route.view,{record:false,route,modelId:id}).catch(()=>{});
  });
  document.addEventListener('visibilitychange',()=> { if (document.hidden) void viewer.pause().catch(()=>{}); });
  window.addEventListener('pagehide',event=> { if (!event.persisted) { flow.dispose(); workspace?.dispose(); void viewer.dispose(); } else void viewer.pause().catch(()=>{}); });
  renderContent(); const route = readRoute(); void showPage(route.view,{record:false,route}).catch(()=>{});

}
boot();
