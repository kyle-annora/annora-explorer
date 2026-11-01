import './styles.css';
import { ROOM_CONTENT, DEFAULT_ROOM_ID } from './content.js';
import { MODEL_CATALOG } from '../generated/catalog.js';
import { createRoomViewer } from './viewer.js';
import { createRequestFlow } from './request.js';
import { createStudioRepository } from '../studio/repository.js';
import { BUNDLED_RELEASE, resolveStudioContent } from '../studio/seed.js';
import { loadRoomRelease, contextForRelease, createPreviewProjectRepository } from './release-content.js';
import crankImage from './assets/crank.png';
import apolloImage from './assets/apollo.png';

const $ = id => document.getElementById(id);
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const images = { 'kinetic-01': crankImage, apollo: apolloImage };
const pages = ['explore', 'overview', 'specs'];
const workspacePages = ['projects', 'inquiry', 'project', 'components'];
const readRoute = () => {
  const [view, ...params] = location.hash.slice(1).split('&');
  const query = new URLSearchParams(params.join('&'));
  const target = query.get('part') ? {kind:'part',nodeId:query.get('part')} : query.get('chapter') && query.get('tour') ? {kind:'chapter',chapterId:query.get('chapter'),tourId:query.get('tour')} : undefined;
  return { view: view || 'explore', projectId: query.get('project') || undefined, ...(target ? {target} : {}) };
};
async function boot() {
  const rooms = {...ROOM_CONTENT}, releaseByProduct = {};
  const parameters = new URL(location.href).searchParams;
  const initialRoute = readRoute();
  const referenceProjectId = initialRoute.view === 'explore' && initialRoute.projectId || parameters.get('project');
  const versionIdentity = params => JSON.stringify([params.get('studioPreview'),params.get('release'),params.get('project')]);
  let referenceProject = null;
  let releaseState = {preview:false,pinned:false}, releaseWarning = '';
  try {
    if (referenceProjectId) {
      if (parameters.has('studioPreview') || parameters.has('release')) throw new Error('This link mixes a customer project with another product version. Open the 3D reference from the project again.');
      const {createDemoProjectRepository} = await import('./project-repository.js');
      referenceProject = await createDemoProjectRepository().getProject(referenceProjectId);
      const context = referenceProject.context, model = MODEL_CATALOG[context.modelId];
      if (context.productId !== 'kinetic-01') throw new Error('The customer-project reference is available for the prepared crank product only. The original project has not been changed.');
      if (!model || model.revision !== context.modelRevision) throw new Error('The exact model revision saved with this project is not included in this deployment. Your original inquiry and quotations remain available in My projects.');
      parameters.set('project', referenceProject.id);
      parameters.set('model', context.modelId);
      if (context.roomSnapshot) releaseState = {release:context.roomSnapshot,preview:false,pinned:true};
      else { releaseState = {release:BUNDLED_RELEASE,preview:false,pinned:true}; releaseWarning = 'This earlier project did not record a product version. Showing the bundled product reference; the saved inquiry remains unchanged.'; }
    }
    if (MODEL_CATALOG['kinetic-01']) {
      try { if (!referenceProject) releaseState = await loadRoomRelease(createStudioRepository(), parameters); }
      catch (error) {
        if (parameters.has('studioPreview') || parameters.has('release')) throw error;
        releaseState = {release:BUNDLED_RELEASE,preview:false,pinned:false};
        releaseWarning = 'Local product edits could not be read. Showing the bundled product reference; saved customer projects have not been changed.';
      }
      if (releaseState.release.modelRevision !== MODEL_CATALOG['kinetic-01'].revision) {
        if (releaseState.pinned) throw new Error('This product version uses a different model revision. Return to Studio to review the model reference.');
        releaseState.release = BUNDLED_RELEASE;
        releaseWarning = 'The saved demo product uses a different model revision. Showing the current bundled reference; earlier customer projects keep their original information.';
      }
      releaseByProduct['kinetic-01'] = releaseState.release;
      rooms['kinetic-01'] = resolveStudioContent(releaseState.release.content);
    } else if (parameters.has('studioPreview') || parameters.has('release')) throw new Error('This deployment does not include the model for this product version.');
  } catch (error) {
    $('room-loading').hidden = true; $('room-error').hidden = false;
    $('room-error').querySelector('h1').textContent = 'Product version unavailable.';
    $('room-error-message').textContent = error.message;
    $('room-retry').textContent = 'Try again'; $('room-retry').addEventListener('click', () => location.reload());
    const link = $('room-error').querySelector('a'); link.href = '../studio/'; link.target = '_top'; link.textContent = 'Return to Studio';
    document.querySelector('.room-nav').hidden = true; $('room-discuss').hidden = true; $('room-product').disabled = true;
    return;
  }
  const loadedVersionIdentity = versionIdentity(parameters);
  const previewRepository = releaseState.preview ? createPreviewProjectRepository() : undefined;
  const versionBanner = document.createElement('aside'); versionBanner.id = 'room-version-banner'; versionBanner.className = 'room-version-banner';
  document.querySelector('.room-header').after(versionBanner);
  const hostSize = new ResizeObserver(() => document.body.style.setProperty('--room-host-chrome', `${versionBanner.offsetHeight + $('room-part-information').offsetHeight}px`));
  hostSize.observe(versionBanner); hostSize.observe($('room-part-information'));
  const configuredRooms = Object.keys(rooms).filter(id => MODEL_CATALOG[id]);
  $('room-product').replaceChildren(...configuredRooms.map(id => { const option = document.createElement('option'); option.value = id; option.textContent = rooms[id].shortTitle; return option; }));
  if (!configuredRooms.length) {
    $('room-loading').hidden = true; $('room-error').hidden = false; $('room-retry').hidden = true;
    $('room-error').querySelector('h1').textContent = 'No Product Room configured.';
    $('room-error-message').textContent = 'This project has an Explorer, but no matching Product Room content yet.';
    const link = $('room-error').querySelector('a'); link.href = '../'; link.textContent = 'Open Explorer';
    document.querySelector('.room-nav').hidden = true; $('room-discuss').hidden = true; $('room-product').disabled = true;
    return;
  }
  let productId = parameters.get('model');
  if (!configuredRooms.includes(productId)) productId = configuredRooms.includes(DEFAULT_ROOM_ID) ? DEFAULT_ROOM_ID : configuredRooms[0];
  if (releaseState.preview || releaseState.pinned) { productId = 'kinetic-01'; $('room-product').disabled = true; }
  let page = 'explore', navigation = 0, action = 0, loading = null, mountedModel = null, noticeTimer;
  let workspace, workspaceLoading, currentRoute = readRoute();
  const flow = createRequestFlow({ dialog: $('room-request') });
  const viewer = createRoomViewer({
    mount: $('room-viewer'), explorerURL: new URL('../', location.href).href,
    onState(state) {
      const id = state.model?.id;
      if (productId === mountedModel && rooms[id] && id !== productId && !releaseState.preview && !releaseState.pinned) {
        productId = id; mountedModel = id; renderContent(); updateURL(true);
      }
      $('room-viewer').dataset.lifecycle = state.lifecycle;
      if (state.lifecycle === 'ready') renderSelectedPart(state);
      if (state.lifecycle === 'loading') $('room-loading').hidden = false;
    },
    onReady({state}) {
      if ((releaseState.preview || releaseState.pinned) && state.model.id !== productId) {
        notice('This product preview keeps its reviewed model. Open the standalone Explorer to browse other models.');
        void ensureViewer(true).catch(error => notice(error.message));
        return;
      }
      mountedModel = state.model.id; $('room-loading').hidden = true; $('room-error').hidden = true;
      renderSelectedPart(state);
      const defaultStyle = releaseByProduct[state.model.id]?.presentation?.defaultRenderStyle;
      if (defaultStyle && state.presentation?.renderStyle !== defaultStyle) void viewer.request('setRenderStyle', {style:defaultStyle}).catch(error => notice(error.message));
      if (page !== 'explore' || document.hidden || $('room-request').open) void viewer.pause().catch(()=>{});
    },
    onError(error) {
      $('room-loading').hidden = true; $('room-error').hidden = false;
      $('room-error-message').textContent = `${error.message} Product information and documents remain available.`;
    }
  });

  function updateURL(replace = false) {
    const url = new URL(location.href); url.searchParams.set('model', productId);
    for (const key of ['studioPreview','release','project']) { if (parameters.has(key)) url.searchParams.set(key,parameters.get(key)); else url.searchParams.delete(key); }
    const destination = new URLSearchParams();
    if (page === 'project' && currentRoute.projectId) destination.set('project',currentRoute.projectId);
    if (page === 'explore' && currentRoute.target) { const target = currentRoute.target; if (target.kind === 'part') destination.set('part',target.nodeId); else { destination.set('chapter',target.chapterId); destination.set('tour',target.tourId); } }
    url.hash = page + (destination.size ? `&${destination}` : '');
    history[replace ? 'replaceState' : 'pushState']({}, '', url);
    document.title = `${rooms[productId].title} · Product Room`;
  }
  function baseContext(id = productId) {
    const room = rooms[id];
    return releaseByProduct[id] ? contextForRelease(releaseByProduct[id]) : { productId:id, productTitle:room.title, modelId:id, modelRevision:MODEL_CATALOG[id].revision };
  }
  async function ensureWorkspace() {
    if (workspace) return workspace;
    if (!workspaceLoading) workspaceLoading = import('./workspace-entry.jsx').then(({createWorkspace}) => {
      workspace = createWorkspace($('room-workspace'), {
        ...(previewRepository ? {repository:previewRepository} : {}),
        onNavigate: route => { ++action; void showPage(route.view, {route,focus:true}).catch(error=>notice(error.message)); },
        onExplore: async context => {
          if (!configuredRooms.includes(context.modelId)) { notice('This project’s model is not available in this deployment.'); return; }
          ++action;
          if (context.modelRevision !== MODEL_CATALOG[context.modelId].revision) {
            await showPage('overview', {focus:true,modelId:context.modelId});
            notice('The model has changed since this inquiry. The saved inquiry keeps its original revision.'); return;
          }
          // Projects carry their own immutable product snapshot. Resolve it from
          // that record even if its original Studio release is no longer listed.
          if (currentRoute.projectId && !releaseState.preview) {
            if (workspace && !(await workspace.beforeLeave())) return;
            await viewer.pause().catch(()=>{});
            const url = new URL('../product-room/',location.href);
            url.searchParams.set('model',context.modelId);
            url.hash = `explore&project=${encodeURIComponent(currentRoute.projectId)}`;
            location.assign(url.href); return;
          }
          if (context.roomSnapshot && context.modelId === 'kinetic-01' && context.roomReleaseId !== releaseByProduct['kinetic-01']?.id) {
            if (workspace && !(await workspace.beforeLeave())) return;
            await viewer.pause().catch(()=>{});
            const url = new URL(location.href); url.searchParams.set('model',context.modelId);
            url.searchParams.delete('studioPreview'); url.searchParams.set('release',context.roomReleaseId);
            const destination = new URLSearchParams();
            if (context.part?.id) destination.set('part',context.part.id);
            else if (context.chapter) { destination.set('chapter',context.chapter.id); destination.set('tour',context.chapter.tourId); }
            url.hash = 'explore' + (destination.size ? `&${destination}` : '');
            location.assign(url.href); return;
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
    renderSelectedPart(viewer.state);
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
    const room = rooms[productId]; $('room-product').value = productId;
    const release = releaseByProduct[productId];
    versionBanner.hidden = !release || release.source === 'bundled' && !releaseState.preview && !releaseState.pinned && !releaseWarning;
    if (release) versionBanner.innerHTML = `<span><strong>${referenceProject ? 'Saved project reference' : releaseWarning ? 'Local product reference unavailable' : releaseState.preview ? 'Draft preview' : release.source === 'demo' ? `Demo product version ${release.version}` : 'Product reference'}</strong> · ${releaseWarning ? escape(releaseWarning) : referenceProject ? `Product version ${release.version} · Kept with the original inquiry.` : releaseState.preview ? 'Test inquiries stay in this preview and disappear when it closes.' : release.source === 'demo' ? 'Published in this browser only.' : 'Sample product information.'}</span><a href="${referenceProject ? `../studio/#project?id=${encodeURIComponent(referenceProject.id)}` : '../studio/'}" target="_top">${referenceProject ? 'Back to customer project' : releaseState.preview ? 'Return to Studio' : 'Open Studio'} <span aria-hidden="true">↗</span></a>`;
    renderSelectedPart(viewer.state);
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
      <div class="room-reference-layout"><div class="room-facts">${renderPartLibrary(room)}${room.specGroups.map(group=>`<section><h2>${escape(group.title)}</h2><dl>${group.facts.map(fact=>`<div><dt>${escape(fact.label)}</dt><dd><strong>${escape(fact.value)}</strong>${fact.note?`<p>${escape(fact.note)}</p>`:''}${fact.nodeId?`<button class="room-text-button room-part-link" data-node="${escape(fact.nodeId)}">Locate in 3D <span aria-hidden="true">↗</span></button>`:''}<small>${escape(fact.source)}${fact.status ? ` · ${escape(fact.status)}` : ''}</small></dd></div>`).join('')}</dl></section>`).join('')}</div>
      <aside class="room-documents"><p class="room-eyebrow">DOCUMENT LIBRARY</p><h2>Take a closer look.</h2>${room.documents.map(doc=>`<article><span class="room-document-type">${escape(doc.type)} · ${escape(doc.revision)}</span><h3>${escape(doc.title)}</h3><p>${escape(doc.description)}</p><small>Updated ${escape(doc.date)} · Sample document</small><div class="room-document-actions"><a class="room-button room-button-secondary" href="${escape(doc.url)}" target="_blank" rel="noopener">Open brief <span aria-hidden="true">↗</span></a><a class="room-text-button" href="${escape(doc.url)}" download="${escape(doc.fileName)}">Download <span aria-hidden="true">↓</span></a></div><button class="room-text-button" data-document="${escape(doc.id)}">Ask about this document <span aria-hidden="true">→</span></button></article>`).join('')}<p class="room-document-note">Printable reference briefs for this demo. Production specifications would be supplied and approved by the product owner.</p></aside></div>${source}</div>`;
  }
  function renderPartLibrary(room) {
    const parts = room.partContent || [];
    return parts.length ? `<section class="room-part-library"><h2>Component information</h2>${parts.map(part => `<article><h3>${escape(part.title)}</h3><p>${escape(part.description)}</p><button class="room-text-button" data-node="${escape(part.nodeId)}">Locate in 3D <span aria-hidden="true">↗</span></button>${(part.documentIds || []).map(id => { const doc = room.documents.find(item => item.id === id); return doc ? `<p><a href="${escape(doc.url)}" target="_blank" rel="noopener">${escape(doc.title)} · ${escape(doc.revision)} ↗</a></p>` : ''; }).join('')}</article>`).join('')}</section>` : '';
  }
  function renderSelectedPart(state) {
    const panel = $('room-part-information');
    if (!panel) return;
    const selected = state?.navigation?.selectedId;
    const room = rooms[productId];
    const part = room?.partContent?.find(item => item.nodeId === selected);
    panel.hidden = !part || page !== 'explore';
    const partKey = part ? `${releaseByProduct[productId]?.id}:${part.nodeId}:${part.description}:${part.documentIds?.join(',')}` : '';
    if (panel.dataset.partKey === partKey) return;
    panel.dataset.partKey = partKey;
    if (part) panel.innerHTML = `<details><summary>${escape(part.title)} · Product information</summary><p>${escape(part.description)}</p>${(part.documentIds || []).map(id => { const doc = room.documents.find(item => item.id === id); return doc ? `<a href="${escape(doc.url)}" target="_blank" rel="noopener">${escape(doc.title)} · ${escape(doc.revision)} ↗</a>` : ''; }).join('')}</details>`;
  }
  async function openRequest(documentId) {
    const turn = ++action, id = productId, room = rooms[id];
    $('room-discuss').disabled = true;
    try {
      await viewer.pause().catch(()=>{});
      const context = viewer.state?.lifecycle === 'ready' ? await viewer.context().catch(()=>null) : null;
      if (turn !== action || id !== productId) return;
      const matched = context?.modelId === id;
      const doc = room.documents.find(item=>item.id === documentId);
      const request = {...baseContext(id),
        modelRevision: matched ? context.modelRevision : MODEL_CATALOG[id].revision,
        ...(matched && context.part ? {part:context.part}:{}),
        ...(matched && context.chapter ? {chapter:context.chapter}:{}),
        ...(doc ? {document:{id:doc.id,title:doc.title,revision:doc.revision}}:{})};
      if (id === 'kinetic-01') await showPage('inquiry',{route:{view:'inquiry',context:request},focus:true});
      else flow.open(request);
    } catch { notice('The request could not be opened. Please try again.'); }
    finally { $('room-discuss').disabled = false; }
  }
  async function showTarget(target, targetProductId = productId, options = {}) {
    const turn = ++action, id = targetProductId;
    const current = () => turn === action && id === productId && page === 'explore' && !$('room-request').open;
    try {
      await showPage('explore',{modelId:id,...options,route:{view:'explore',target}});
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
    if (question) void showTarget(rooms[productId].questions.find(item=>item.id===question.dataset.question).target);
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
    ++action;
    void (async () => {
      const nextURL = new URL(location.href), route = readRoute();
      if (versionIdentity(nextURL.searchParams) !== loadedVersionIdentity || route.view === 'explore' && route.projectId && route.projectId !== referenceProject?.id) {
        if (workspace && !(await workspace.beforeLeave())) { updateURL(true); return; }
        await viewer.pause().catch(()=>{});
        location.reload(); return;
      }
      const id = nextURL.searchParams.get('model');
      if (route.view === 'explore' && route.target) await showTarget(route.target,id,{record:false});
      else await showPage(route.view,{record:false,route,modelId:id});
    })().catch(error=>notice(error.message));
  });
  document.addEventListener('visibilitychange',()=> { if (document.hidden) void viewer.pause().catch(()=>{}); });
  window.addEventListener('pagehide',event=> { if (!event.persisted) { hostSize.disconnect(); flow.dispose(); workspace?.dispose(); void viewer.dispose(); } else void viewer.pause().catch(()=>{}); });
  renderContent(); const route = readRoute();
  if (referenceProject && route.view === 'explore' && !route.target) {
    const context = referenceProject.context;
    if (context.part?.id) route.target = {kind:'part',nodeId:context.part.id};
    else if (context.chapter) route.target = {kind:'chapter',chapterId:context.chapter.id,tourId:context.chapter.tourId};
  }
  if (route.view === 'explore' && route.target) void showTarget(route.target,productId,{record:false}).catch(error=>notice(error.message));
  else void showPage(route.view,{record:false,route}).catch(()=>{});

}
boot();
