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
    const url = new URL(location.href); url.searchParams.set('model', productId); url.hash = page;
    history[replace ? 'replaceState' : 'pushState']({}, '', url);
    document.title = `${ROOM_CONTENT[productId].title} · Product Room`;
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
  async function showPage(next, {record = true, focus = false} = {}) {
    const turn = ++navigation;
    if (next !== 'explore') await viewer.pause().catch(()=>{});
    if (turn !== navigation) return;
    page = pages.includes(next) ? next : 'explore';
    for (const name of pages) $(`page-${name}`).hidden = name !== page;
    document.body.dataset.page = page;
    for (const link of document.querySelectorAll('[data-page]')) {
      if (link.dataset.page === page) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
    }
    if (record) updateURL(); else updateURL(true);
    if (focus && page !== 'explore') $('room-main').focus({preventScroll:true});
    if (page === 'explore') await ensureViewer();
  }
  function renderContent() {
    const room = ROOM_CONTENT[productId]; $('room-product').value = productId;
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
      flow.open({productId:id,productTitle:room.title,modelId:id,
        modelRevision: matched ? context.modelRevision : MODEL_CATALOG[id].revision,
        ...(matched && context.part ? {part:context.part}:{}),
        ...(matched && context.chapter ? {chapter:context.chapter}:{}),
        ...(doc ? {document:{id:doc.id,title:doc.title}}:{})});
    } catch { notice('The request could not be opened. Please try again.'); }
    finally { $('room-discuss').disabled = false; }
  }
  async function showTarget(target) {
    const turn = ++action, id = productId;
    const current = () => turn === action && id === productId && page === 'explore' && !$('room-request').open;
    try {
      await showPage('explore');
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
    if (link && pages.includes(link.hash.slice(1))) { event.preventDefault(); ++action; void showPage(link.hash.slice(1),{focus:true}).catch(()=>{}); return; }
    const question = event.target.closest('[data-question]');
    if (question) void showTarget(ROOM_CONTENT[productId].questions.find(item=>item.id===question.dataset.question).target);
    const part = event.target.closest('[data-node]'); if (part) void showTarget({kind:'part',nodeId:part.dataset.node});
    const doc = event.target.closest('[data-document]'); if (doc) void openRequest(doc.dataset.document);
  });
  $('room-product').addEventListener('change',()=> {
    ++action; productId = $('room-product').value; renderContent(); updateURL();
    if (page === 'explore') void ensureViewer().catch(()=>{});
  });
  $('room-discuss').addEventListener('click',()=>void openRequest());
  $('room-retry').addEventListener('click',()=>void ensureViewer(true).catch(()=>{}));
  window.addEventListener('popstate',()=> {
    ++action; const id = new URL(location.href).searchParams.get('model');
    if (productId === mountedModel && ROOM_CONTENT[id] && id !== productId) { productId = id; renderContent(); }
    void showPage(location.hash.slice(1),{record:false}).catch(()=>{});
  });
  document.addEventListener('visibilitychange',()=> { if (document.hidden) void viewer.pause().catch(()=>{}); });
  window.addEventListener('pagehide',event=> { if (!event.persisted) { flow.dispose(); void viewer.dispose(); } else void viewer.pause().catch(()=>{}); });
  renderContent(); void showPage(location.hash.slice(1),{record:false}).catch(()=>{});

}
boot();
