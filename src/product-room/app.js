import './styles.css';
import { ROOM_CONTENT, DEFAULT_ROOM_ID } from './content.js';
import { MODEL_CATALOG } from '../generated/catalog.js';
import { createRoomViewer } from './viewer.js';
import { createRequestFlow } from './request.js';
import { createStudioRepository } from '../studio/repository.js';
import { readBuyerRoute, buyerRouteHash, projectReturnURL } from './navigation.js';
import { readWalkthroughSession, hasWalkthroughRequest, createWalkthroughRepository, withWalkthroughSession, walkthroughStorageKey } from '../walkthrough/session.js';
import { BUNDLED_RELEASE, resolveStudioContent } from '../studio/seed.js';
import { loadRoomRelease, contextForRelease, createPreviewProjectRepository } from './release-content.js';
import { createWalkthroughViewerAction } from '../walkthrough/viewer-action.js';
import { createExplorationHandoff, readExplorationHandoff } from './exploration-handoff.js';
import { openWorkspaceReference } from './reference-navigation.js';
import crankImage from './assets/crank.png';
import apolloImage from './assets/apollo.png';

const $ = id => document.getElementById(id);
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const images = { 'kinetic-01': crankImage, apollo: apolloImage };
const pages = ['explore', 'overview', 'specs'];
const workspacePages = ['projects', 'inquiry', 'project', 'components'];
const readRoute = readBuyerRoute;
async function boot() {
  const rooms = {...ROOM_CONTENT}, releaseByProduct = {};
  const parameters = new URL(location.href).searchParams;
  const initialRoute = readRoute();
  const walkthrough = readWalkthroughSession(parameters);
  const walkthroughRepository = walkthrough ? createWalkthroughRepository(walkthrough) : null;
  const customerRepository = walkthroughRepository || undefined;
  const referenceProjectId = initialRoute.view === 'explore' && initialRoute.projectId || parameters.get('project');
  const versionIdentity = params => JSON.stringify([params.get('studioPreview'),params.get('release'),params.get('project'),params.get('walkthrough'),params.get('handoff'),params.get('inspection')]);
  let referenceProject = null, handoffContext = null, restoredContext = null, savedInquiryContext = null;
  let releaseState = {preview:false,pinned:false}, releaseWarning = '';
  try {
    if (hasWalkthroughRequest(parameters) && !walkthrough) throw new Error('This demonstration link is invalid. Return to the walkthrough to open a separate sample session.');
    if (parameters.has('handoff')) {
      if (referenceProjectId || parameters.has('studioPreview') || parameters.has('release') || walkthrough)
        throw new Error('This link mixes the saved Explorer view with another product reference. Return to Explorer and open the inquiry again.');
      handoffContext = readExplorationHandoff(parameters.get('handoff'));
      if (handoffContext.productId !== 'kinetic-01' || handoffContext.modelId !== 'kinetic-01' || !handoffContext.inspection)
        throw new Error('This saved Explorer view is not a complete crank product reference. Return to Explorer and try again.');
      if (MODEL_CATALOG[handoffContext.modelId]?.revision !== handoffContext.modelRevision)
        throw new Error('The model revision saved with this Explorer view is not available. Return to Explorer to start from the current model.');
      parameters.set('model',handoffContext.modelId);
    }
    if (parameters.has('inspection')) {
      if (parameters.has('handoff') || parameters.has('studioPreview') || referenceProjectId) throw new Error('This link contains more than one saved 3D reference. Open the view from the inquiry again.');
      restoredContext = readExplorationHandoff(parameters.get('inspection'));
      if (restoredContext.productId !== 'kinetic-01' || restoredContext.modelId !== 'kinetic-01' || MODEL_CATALOG[restoredContext.modelId]?.revision !== restoredContext.modelRevision)
        throw new Error('The exact model revision saved with this inquiry is not available. The original inquiry remains unchanged.');
      if (parameters.has('release') && restoredContext.roomReleaseId !== parameters.get('release'))
        throw new Error('This link mixes the saved 3D view with another product version. Open the view from the inquiry again.');
      parameters.set('model',restoredContext.modelId);
    }
    savedInquiryContext = handoffContext?.roomSnapshot ? handoffContext : restoredContext?.roomSnapshot ? restoredContext : null;
    if (savedInquiryContext) releaseState = {release:savedInquiryContext.roomSnapshot,preview:false,pinned:true};
    if (referenceProjectId) {
      if (parameters.has('studioPreview') || parameters.has('release')) throw new Error('This link mixes a customer project with another product version. Open the 3D reference from the project again.');
      const {createDemoProjectRepository} = await import('./project-repository.js');
      referenceProject = await (customerRepository || createDemoProjectRepository()).getProject(referenceProjectId);
      const context = referenceProject.context, model = MODEL_CATALOG[context.modelId];
      if (context.productId !== 'kinetic-01') throw new Error('The customer-project reference is available for the prepared crank product only. The original project has not been changed.');
      if (!model || model.revision !== context.modelRevision) throw new Error('The exact model revision saved with this project is not included in this deployment. Your original inquiry and quotations remain available in My projects.');
      parameters.set('project', referenceProject.id);
      parameters.set('model', context.modelId);
      if (context.roomSnapshot) releaseState = {release:context.roomSnapshot,preview:false,pinned:true};
      else { releaseState = {release:BUNDLED_RELEASE,preview:false,pinned:true}; releaseWarning = 'This earlier project did not record a product version. Showing the bundled product reference; the saved inquiry remains unchanged.'; }
    }
    if (MODEL_CATALOG['kinetic-01']) {
      try {
        if (!referenceProject && !savedInquiryContext) {
          const explicitVersion = parameters.has('studioPreview') || parameters.has('release');
          releaseState = walkthrough && !explicitVersion
            ? {release:BUNDLED_RELEASE,preview:false,pinned:true}
            : await loadRoomRelease(createStudioRepository(walkthrough ? {key:walkthroughStorageKey(walkthrough) + '.studio'} : {}),parameters);
        }
      }
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
      if (handoffContext?.roomReleaseId && handoffContext.roomReleaseId !== releaseState.release.id)
        throw new Error('The product version saved with this Explorer view is not available. Return to Explorer and open a new inquiry.');
      if (restoredContext?.roomReleaseId && restoredContext.roomReleaseId !== releaseState.release.id)
        throw new Error('The product version saved with this inquiry is not available. Open the 3D view from the inquiry again.');
    } else if (parameters.has('studioPreview') || parameters.has('release')) throw new Error('This deployment does not include the model for this product version.');
  } catch (error) {
    $('room-loading').hidden = true; $('room-error').hidden = false;
    $('room-error').querySelector('h1').textContent = parameters.has('handoff') || parameters.has('inspection') ? 'Saved 3D view unavailable.' : 'Product version unavailable.';
    $('room-error-message').textContent = error.message;
    $('room-retry').textContent = 'Try again'; $('room-retry').addEventListener('click', () => location.reload());
    const link = $('room-error').querySelector('a');
    if (parameters.has('handoff') || parameters.has('inspection') && !referenceProjectId) {
      link.href = '../?model=kinetic-01'; link.textContent = 'Return to Explorer';
    } else if (parameters.has('studioPreview') && (!hasWalkthroughRequest(parameters) || walkthrough)) {
      link.href = walkthrough ? withWalkthroughSession(new URL('../studio/',location.href),walkthrough).href : '../studio/';
      link.target = '_top'; link.textContent = 'Return to Studio';
    } else {
      link.href = walkthrough || hasWalkthroughRequest(parameters) ? '../walkthrough/' : '../studio/';
      link.textContent = walkthrough || hasWalkthroughRequest(parameters) ? 'Open walkthrough' : 'Return to Studio';
    }
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
  let workspace, workspaceLoading, currentRoute = readRoute(), walkthroughProject = null, walkthroughViewer, retrySavedContext;
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
      walkthroughViewer?.sync();
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
      $('room-error').querySelector('h1').textContent = '3D is unavailable right now.';
      $('room-error-message').textContent = `${error.message} Product information and documents remain available.`;
    }
  });
  if (walkthrough && !releaseState.preview) walkthroughViewer = createWalkthroughViewerAction({
    viewer, sessionId:walkthrough, isActive:()=>page === 'explore' && !walkthroughProject,
    openInquiry:()=>openRequest(),
  });

  function updateURL(replace = false) {
    const url = new URL(location.href); url.searchParams.set('model', productId);
    const referenceModel = (handoffContext || restoredContext)?.modelId;
    if (page === 'project' && currentRoute.projectId || ['projects','components'].includes(page) || referenceModel && referenceModel !== productId) {
      for (const key of ['handoff','inspection']) { parameters.delete(key); url.searchParams.delete(key); }
      handoffContext = null; restoredContext = null;
      if (referenceModel && referenceModel !== productId) savedInquiryContext = null;
    }
    for (const key of ['studioPreview','release','project','handoff','inspection','returnRole','returnView']) { if (parameters.has(key)) url.searchParams.set(key,parameters.get(key)); else url.searchParams.delete(key); }
    url.hash = buyerRouteHash({...currentRoute,view:page});
    history[replace ? 'replaceState' : 'pushState'](replace ? history.state : {}, '', url);
    window.dispatchEvent(new Event('annora:routechange'));
    document.title = `${rooms[productId].title} · Product Room`;
  }
  function baseContext(id = productId) {
    const room = rooms[id];
    return releaseByProduct[id] ? contextForRelease(releaseByProduct[id]) : { productId:id, productTitle:room.title, modelId:id, modelRevision:MODEL_CATALOG[id].revision };
  }
  function rememberDraftInspection(context) {
    if (releaseState.preview || !context.inspection) return;
    const token = createExplorationHandoff(context);
    for (const key of ['project','handoff','returnRole','returnView']) parameters.delete(key);
    parameters.set('inspection',token);
    handoffContext = null; restoredContext = context; referenceProject = null;
    savedInquiryContext = context.roomSnapshot ? context : null;
    renderContent();
  }
  async function exploreContext(context, {leaveChecked = false, record = true, allowStandalone = true} = {}) {
    if (!configuredRooms.includes(context.modelId)) { if (leaveChecked) workspace?.cancelLeave(); notice('This project’s model is not available in this deployment.'); return; }
    ++action;
    if (context.modelRevision !== MODEL_CATALOG[context.modelId].revision) {
      if (leaveChecked) workspace?.cancelLeave();
      notice('The exact model revision saved with this inquiry is unavailable. The saved inquiry remains unchanged.'); return;
    }
    if (allowStandalone && parameters.has('handoff') && !currentRoute.projectId && context.inspection) {
      if (!leaveChecked && workspace && !(await workspace.beforeLeave())) return;
      try {
        const token = createExplorationHandoff(context);
        const url = new URL('../',location.href);
        url.searchParams.set('model',context.modelId); url.searchParams.set('inspection',token);
        location[record ? 'assign' : 'replace'](url.href);
      } catch (error) { workspace?.cancelLeave(); notice(`The saved view could not be reopened. ${error.message} Please try again.`); }
      return;
    }
    // Projects carry their own immutable product snapshot. Resolve it from
    // that record even if its original Studio release is no longer listed.
    if (currentRoute.projectId && !releaseState.preview) {
      if (!leaveChecked && workspace && !(await workspace.beforeLeave())) return;
      await viewer.pause().catch(()=>{});
      const url = new URL('../product-room/',location.href);
      url.searchParams.set('model',context.modelId);
      url.searchParams.set('returnRole','buyer');
      url.searchParams.set('returnView',location.hash);
      if (walkthrough) url.searchParams.set('walkthrough',walkthrough);
      url.hash = `explore&project=${encodeURIComponent(currentRoute.projectId)}`;
      location[record ? 'assign' : 'replace'](url.href); return;
    }
    if (context.roomSnapshot && context.modelId === 'kinetic-01' && context.roomReleaseId !== releaseByProduct['kinetic-01']?.id) {
      if (!leaveChecked && workspace && !(await workspace.beforeLeave())) return;
      await viewer.pause().catch(()=>{});
      const url = new URL(location.href); url.searchParams.set('model',context.modelId);
      for (const key of ['studioPreview','handoff','project','returnRole','returnView']) url.searchParams.delete(key);
      url.searchParams.set('release',context.roomReleaseId);
      // Drafts can carry a product snapshot before a project ID exists.
      // Keep their exact saved view across this product-version reload.
      const destination = new URLSearchParams();
      if (context.inspection) {
        try { url.searchParams.set('inspection',createExplorationHandoff(context)); }
        catch (error) { workspace?.cancelLeave(); notice(`The saved view could not be reopened. ${error.message} Please try again.`); return; }
      } else if (context.part?.id) destination.set('part',context.part.id);
      else if (context.chapter) { destination.set('chapter',context.chapter.id); destination.set('tour',context.chapter.tourId); }
      url.hash = 'explore' + (destination.size ? `&${destination}` : '');
      location[record ? 'assign' : 'replace'](url.href); return;
    }
    try { rememberDraftInspection(context); }
    catch (error) { workspace?.cancelLeave(); notice(`The saved view could not be reopened. ${error.message} Please try again.`); return; }
    await showSavedContext(context,{record,leaveChecked});
  }
  async function openExplore(options = {}) {
    const turn = ++action;
    try {
      if (await openWorkspaceReference({workspace,modelId:productId,open:context => {
        if (turn !== action) return;
        return exploreContext(context,{...options,leaveChecked:true});
      }})) return;
      if (turn !== action) return;
      const context = referenceProject?.context || restoredContext || handoffContext;
      if (context?.modelId === productId) await showSavedContext(context,options);
      else await showPage('explore',{focus:true,...options});
    } catch (error) { notice(`The saved view could not be reopened. ${error.message} Please try again.`); }
  }
  async function ensureWorkspace() {
    if (workspace) return workspace;
    if (!workspaceLoading) workspaceLoading = import('./workspace-entry.jsx').then(({createWorkspace}) => {
      workspace = createWorkspace($('room-workspace'), {
        ...(previewRepository || customerRepository ? {repository:previewRepository || customerRepository} : {}),
        onNavigate: route => { ++action; void showPage(route.view, {route,focus:true}).catch(error=>notice(error.message)); },
        onExplore: context => exploreContext(context),
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
  async function showPage(next, {record = true, focus = false, route = {view:next}, modelId, leaveChecked = false} = {}) {
    const turn = ++navigation;
    if (walkthrough && !releaseState.preview && next === 'inquiry') {
      walkthroughProject = (await walkthroughRepository.listProjects())[0] || null;
      if (walkthroughProject) { next = 'project'; route = {view:'project',projectId:walkthroughProject.id}; }
    }
    if (turn !== navigation) return;
    if (!leaveChecked && workspace && workspacePages.includes(page) && !(await workspace.beforeLeave(route))) {
      if (turn === navigation) { renderContent(); updateURL(true); }
      return;
    }
    if (turn !== navigation) return;
    if (next === 'inquiry' && route.context?.inspection) {
      try { rememberDraftInspection(route.context); }
      catch (error) { workspace?.cancelLeave(); throw error; }
    }
    if (next !== 'explore') await viewer.pause().catch(()=>{});
    if (turn !== navigation) return;
    const desiredModel = workspacePages.includes(next) && configuredRooms.includes('kinetic-01') ? 'kinetic-01' : modelId;
    if (configuredRooms.includes(desiredModel) && productId !== desiredModel) { productId = desiredModel; renderContent(); }
    page = [...pages,...workspacePages].includes(next) ? next : 'explore';
    walkthroughViewer?.sync();
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
        const productContext = baseContext(configuredRooms.includes('kinetic-01') ? 'kinetic-01' : productId);
        const incoming = handoffContext || restoredContext;
        const incomingContext = page === 'inquiry' && incoming ? {...productContext,...incoming,productTitle:productContext.productTitle} : productContext;
        host.open({...currentRoute, context:route.context || incomingContext});
      } catch (error) { notice(`The project workspace could not open. ${error.message} Please try again.`); }
    }
  }
  function renderContent() {
    const room = rooms[productId]; $('room-product').value = productId;
    const release = releaseByProduct[productId];
    versionBanner.hidden = !release || walkthrough && !referenceProject && !releaseWarning && !parameters.has('studioPreview') && !parameters.has('release') || release.source === 'bundled' && !releaseState.preview && !releaseState.pinned && !releaseWarning;
    if (release) versionBanner.innerHTML = `<span><strong>${referenceProject ? 'Saved project reference' : savedInquiryContext ? 'Saved inquiry reference' : releaseWarning ? 'Local product reference unavailable' : releaseState.preview ? 'Draft preview' : release.source === 'demo' ? `Demo product version ${release.version}` : 'Product reference'}</strong> · ${releaseWarning ? escape(releaseWarning) : referenceProject || savedInquiryContext ? `Product version ${release.version} · Kept with the original inquiry.` : releaseState.preview ? 'Test inquiries stay in this preview and disappear when it closes.' : release.source === 'demo' ? 'Published in this browser only.' : 'Sample product information.'}</span><a href="${referenceProject ? escape(projectReturnURL({base:location.href,projectId:referenceProject.id,role:parameters.get('returnRole'),returnView:parameters.get('returnView'),session:walkthrough}).href) : walkthrough ? escape(withWalkthroughSession(new URL('../studio/',location.href),walkthrough).href) : '../studio/'}"${releaseState.preview ? ' target="_top"' : ''}>${referenceProject ? 'Back to customer project' : releaseState.preview ? 'Return to Studio' : 'Open Studio'} <span aria-hidden="true">↗</span></a>`;
    renderSelectedPart(viewer.state);
    $('room-discuss').querySelector('.room-discuss-full').textContent = walkthroughProject ? 'View project' : productId === 'kinetic-01' ? 'Request a quote' : 'Discuss application';
    $('room-discuss').querySelector('.room-discuss-short').textContent = walkthroughProject ? 'Project' : productId === 'kinetic-01' ? 'Inquire' : 'Discuss';
    const source = `<details class="room-source"><summary>Source & scope</summary><p>${escape(room.source.note)}</p><a href="${escape(room.source.url)}" target="_blank" rel="noopener">${escape(room.source.label)} <span aria-hidden="true">↗</span></a><small>${escape(room.source.license)} · ${escape(room.roomRevision)}</small></details>`;
    $('page-overview').innerHTML = `
      <div class="room-content"><div class="room-overview-hero">
        <div class="room-intro"><p class="room-eyebrow">${escape(room.eyebrow)}</p><h1>${escape(room.tagline)}</h1><p class="room-lede">${escape(room.description)}</p><a class="room-button room-button-secondary" href="#explore">Explore the assembly <span aria-hidden="true">↗</span></a></div>
        <figure class="room-product-image" data-model="${productId}"><div class="room-image-crop"><img src="${images[productId]}" width="704" height="450" alt="Engineering view of the ${escape(room.title.toLowerCase())}" loading="lazy"></div><figcaption>${escape(room.title)} <span>Engineering view</span></figcaption></figure>
      </div><dl class="room-highlights">${room.highlights.map(item=>`<div><dt>${escape(item.label)}</dt><dd>${escape(item.value)}</dd></div>`).join('')}</dl>
      <section class="room-questions"><div><p class="room-eyebrow">UNDERSTAND THE PRODUCT</p><h2>${escape(room.summary)}</h2><p>Choose a question. Go straight to the relevant part or explanation in 3D.</p></div><ol>${room.questions.map((item,index)=>`<li><span class="room-number">0${index+1}</span><div><h3>${escape(item.title)}</h3><p>${escape(item.description)}</p><button class="room-text-button" data-question="${escape(item.id)}">${escape(item.actionLabel)} <span aria-hidden="true">↗</span></button></div></li>`).join('')}</ol></section>
      <div class="room-bottom"><p>${escape(room.demoNotice)}</p><a href="#specs" class="room-button room-button-secondary">Specs & documents <span aria-hidden="true">→</span></a></div>${source}</div>`;
    $('page-specs').innerHTML = `<div class="room-content"><header class="room-page-title"><div><p class="room-eyebrow">${escape(room.shortTitle)} / REFERENCE</p><h1>Details to build on.</h1></div><p>${escape(room.demoNotice)}</p></header>
      <div class="room-reference-layout"><div class="room-facts">${renderPartLibrary(room)}${room.specGroups.map(group=>`<section><h2>${escape(group.title)}</h2><dl>${group.facts.map(fact=>`<div><dt>${escape(fact.label)}</dt><dd><strong>${escape(fact.value)}</strong>${fact.note?`<p>${escape(fact.note)}</p>`:''}${fact.nodeId?`<button class="room-text-button room-part-link" data-node="${escape(fact.nodeId)}">Locate in 3D <span aria-hidden="true">↗</span></button>`:''}<small>${escape(fact.source)}${fact.status ? ` · ${escape(fact.status)}` : ''}</small></dd></div>`).join('')}</dl></section>`).join('')}</div>
      <aside class="room-documents"><p class="room-eyebrow">DOCUMENT LIBRARY</p><h2>Take a closer look.</h2>${room.documents.map(doc=>`<details class="room-document-row"><summary><span>${escape(doc.title)}</span><small>${escape(doc.type)} · ${escape(doc.revision)}</small></summary><div class="room-document-body"><p>${escape(doc.description)}</p><small>Updated ${escape(doc.date)} · Sample document</small><div class="room-document-actions"><a class="room-button room-button-secondary" href="${escape(doc.url)}" target="_blank" rel="noopener">Open brief <span aria-hidden="true">↗</span></a><a class="room-text-button" href="${escape(doc.url)}" download="${escape(doc.fileName)}">Download <span aria-hidden="true">↓</span></a></div><button class="room-text-button" data-document="${escape(doc.id)}">Ask about this document <span aria-hidden="true">→</span></button></div></details>`).join('')}<p class="room-document-note">Printable reference briefs for this demo. Production specifications would be supplied and approved by the product owner.</p></aside></div>${source}</div>`;
  }
  function renderPartLibrary(room) {
    const parts = room.partContent || [];
    return parts.length ? `<section class="room-part-library"><h2>Component information</h2>${parts.map(part => `<details class="room-part-row"><summary>${escape(part.title)}</summary><div><p>${escape(part.description)}</p><button class="room-text-button" data-node="${escape(part.nodeId)}">Locate in 3D <span aria-hidden="true">↗</span></button>${(part.documentIds || []).map(id => { const doc = room.documents.find(item => item.id === id); return doc ? `<p><a href="${escape(doc.url)}" target="_blank" rel="noopener">${escape(doc.title)} · ${escape(doc.revision)} ↗</a></p>` : ''; }).join('')}</div></details>`).join('')}</section>` : '';
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
      if (id === 'kinetic-01') await ensureViewer();
      else await viewer.pause();
      const context = viewer.state?.lifecycle === 'ready' ? await viewer.context({includeInspection:id === 'kinetic-01'}) : null;
      if (id === 'kinetic-01' && !context) throw new Error('Wait for the 3D model to finish loading, then try again.');
      if (turn !== action || id !== productId) return;
      const matched = context?.modelId === id;
      if (context && !matched) throw new Error('The product changed while its 3D view was being saved. Please try again.');
      const doc = room.documents.find(item=>item.id === documentId);
      const request = {...baseContext(id),
        modelRevision: matched ? context.modelRevision : MODEL_CATALOG[id].revision,
        ...(matched && context.part ? {part:context.part}:{}),
        ...(matched && context.chapter ? {chapter:context.chapter}:{}),
        ...(matched && context.inspection ? {inspection:context.inspection}:{}),
        ...(doc ? {document:{id:doc.id,title:doc.title,revision:doc.revision}}:{})};
      if (id === 'kinetic-01') {
        await showPage('inquiry',{route:{view:'inquiry',context:request},focus:true});
      }
      else flow.open(request);
    } catch (error) { if (error.code !== 'SUPERSEDED') notice(`The selected 3D reference could not be attached. ${error.message || 'Please try again.'} Choose Request a quote again to retry.`); }
    finally { $('room-discuss').disabled = false; }
  }
  async function showSavedContext(context, options = {}) {
    const turn = ++action, id = context.modelId;
    try {
      const route = {view:'explore',...(referenceProject ? {projectId:referenceProject.id} : {})};
      await showPage('explore',{modelId:id,...options,route});
      if (turn !== action || id !== productId || page !== 'explore') return;
      await viewer.restoreContext(context);
      if (turn !== action || id !== productId || page !== 'explore') return;
      retrySavedContext = null; $('room-error').hidden = true;
      if (context.inspection) notice('Saved 3D view restored. Playback is paused.');
    } catch (error) {
      if (turn !== action || ['SUPERSEDED','CANCELLED'].includes(error.code)) return;
      retrySavedContext = context;
      $('room-loading').hidden = true; $('room-error').hidden = false;
      $('room-error').querySelector('h1').textContent = 'Saved 3D view could not open.';
      $('room-error-message').textContent = `${error.message || 'Please try again.'} The saved inquiry has not changed.`;
      $('room-retry').textContent = 'Retry saved view';
    }
  }
  async function showTarget(target, targetProductId = productId, options = {}) {
    const turn = ++action, id = targetProductId;
    const current = () => turn === action && id === productId && page === 'explore' && !$('room-request').open;
    try {
      retrySavedContext = null; $('room-error').hidden = true; $('room-retry').textContent = 'Try loading again';
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
    if (link && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0 && [...pages,...workspacePages].includes(link.hash.slice(1))) {
      event.preventDefault();
      if (link.hash === '#explore') void openExplore();
      else { ++action; void showPage(link.hash.slice(1),{focus:true}).catch(error=>notice(error.message)); }
      return;
    }
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
  $('room-retry').addEventListener('click',()=>void (retrySavedContext ? showSavedContext(retrySavedContext,{record:false}) : ensureViewer(true)).catch(error=>notice(error.message)));
  window.addEventListener('annora:walkthrough-navigate',event=> {
    const detail = event.detail;
    if (!walkthrough || !detail?.url) return;
    detail.handled = true;
    void (async()=> { if (!workspace || await workspace.beforeLeave()) { await viewer.pause().catch(()=>{}); location.assign(detail.url); } })().catch(error=>notice(error.message));
  });
  window.addEventListener('annora:routechange',()=> { currentRoute = {...readRoute(),context:currentRoute.context}; });
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
      if (route.view === 'explore' && referenceProject) await showSavedContext(referenceProject.context,{record:false});
      else if (route.view === 'explore' && restoredContext) await showSavedContext(restoredContext,{record:false});
      else if (route.view === 'explore' && route.target) await showTarget(route.target,id,{record:false});
      else if (route.view === 'explore' && id === productId) await openExplore({record:false,allowStandalone:false});
      else await showPage(route.view,{record:false,route,modelId:id});
    })().catch(error=>notice(error.message));
  });
  document.addEventListener('visibilitychange',()=> { if (document.hidden) void viewer.pause().catch(()=>{}); });
  window.addEventListener('pagehide',event=> { if (!event.persisted) { walkthroughViewer?.dispose(); hostSize.disconnect(); flow.dispose(); workspace?.dispose(); void viewer.dispose(); } else void viewer.pause().catch(()=>{}); });
  if (walkthrough && !releaseState.preview) {
    walkthroughProject = (await walkthroughRepository.listProjects())[0] || null;
    window.addEventListener('annora:walkthrough-change',()=> { void walkthroughRepository.listProjects().then(items=> { walkthroughProject=items[0] || null; renderContent(); }).catch(error=>notice(error.message)); });
  }
  renderContent(); const route = readRoute();
  if (route.view === 'explore' && referenceProject) void showSavedContext(referenceProject.context,{record:false});
  else if (route.view === 'explore' && restoredContext) void showSavedContext(restoredContext,{record:false});
  else if (route.view === 'explore' && handoffContext) void showSavedContext(handoffContext,{record:false});
  else if (route.view === 'explore' && route.target) void showTarget(route.target,productId,{record:false}).catch(error=>notice(error.message));
  else void showPage(route.view,{record:false,route}).catch(()=>{});

}
boot();
