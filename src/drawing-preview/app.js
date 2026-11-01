import './styles.css';
import drawing from '../../content/drawings/linkrods/drawing.json';
import { MODEL_CATALOG } from '../generated/catalog.js';
import { createRoomViewer } from '../product-room/viewer.js';
import { createDrawingProjectRepository } from '../product-room/drawing-inquiry.js';
import { readBuyerRoute, buyerRouteHash } from '../product-room/navigation.js';
import { createDrawingContext } from './context.js';
import { createDrawingView } from './drawing-view.js';
import { focusDrawingRegion } from './model-views.js';

const $ = id => document.getElementById(id);
const sheet = drawing.sheets[0];
const regions = new Map(sheet.regions.map(region => [region.id, region]));
const mobile = matchMedia('(max-width:850px)');
const svgURL = new URL('../../content/drawings/linkrods/sheet.svg', import.meta.url).href;
const pdfURL = new URL('../../content/drawings/linkrods/sheet.pdf', import.meta.url).href;
const stepURL = new URL('../../content/drawings/linkrods/linkrods.step', import.meta.url).href;
const repository = createDrawingProjectRepository();
const modelEntry = MODEL_CATALOG[drawing.modelId];
let regionId = 'overview', view = mobile.matches ? '3d' : 'compare', page = 'explore';
let workspace, workspaceLoading, modelLoading, modelInitializing = false, selectionSync = 0, lastSelected, activeContext, navigation = 0, noticeTimer;
let currentRoute = {view:'explore'}, returnRoute;

function notice(message) {
  clearTimeout(noticeTimer); $('dp-notice').textContent = message; $('dp-notice').hidden = false;
  noticeTimer = setTimeout(() => { $('dp-notice').hidden = true; }, 7000);
}
function updateURL({replace = false} = {}) {
  const url = new URL(location.href);
  url.searchParams.set('view', view); url.searchParams.set('detail', regionId);
  url.searchParams.set('drawing', drawing.revision); url.hash = buyerRouteHash(currentRoute);
  history[replace ? 'replaceState' : 'pushState']({...history.state}, '', url);
}
function readSelection() {
  const query = new URLSearchParams(location.search);
  const requested = query.get('detail');
  if (query.get('drawing') && query.get('drawing') !== drawing.revision) {
    regionId = 'overview'; notice('That drawing version is not available here. The current reference is shown; saved inquiries keep their original version.');
  } else if (requested && !regions.has(requested)) {
    regionId = 'overview'; notice('That detail is not available in this drawing. Showing the part overview.');
  } else regionId = requested || 'overview';
  if (['3d','drawings','compare'].includes(query.get('view'))) view = query.get('view');
  if (mobile.matches && view === 'compare') view = '3d';
  if (!modelEntry) view = 'drawings';
}
function renderSelection() {
  const region = regions.get(regionId);
  $('dp-detail').value = regionId;
  $('dp-detail-name').textContent = region.label;
  $('dp-dimension').textContent = region.dimension || 'Feature of the same CAD solid';
  $('dp-detail-note').textContent = regionId === 'overview'
    ? 'Select the rod in 3D or choose a drawing detail. Both views refer to the same CAD solid.'
    : `${region.dimension ? `${region.dimension} · ` : ''}Linked to the connecting rod body. Source annotations are reference information, not confirmed requirements.`;
  document.body.dataset.detail = regionId;
}
const drawingView = createDrawingView({
  mount:$('dp-sheet'), assetURL:svgURL, sheet,
  onSelect:id => { void selectRegion(id,{origin:'drawing'}); },
  onViewChange:state => {
    $('dp-zoom').textContent = `${Math.round(state.zoom * 100)}%`;
    $('dp-zoom-in').disabled = !state.canZoomIn; $('dp-zoom-out').disabled = !state.canZoomOut;
  },
  onError:() => notice('The vector sheet could not load. You can still open the original PDF.'),
});
const viewer = createRoomViewer({
  mount:$('dp-viewer'), explorerURL:new URL('../',location.href).href,
  onState(state) {
    if (state.lifecycle !== 'ready') return;
    if (state.model?.id !== drawing.modelId) {
      notice('This paired preview stays with its source model. Other models are available in the standalone Explorer.');
      void ensureViewer(true).catch(error => notice(error.message)); return;
    }
    $('dp-loading').hidden = true; $('dp-model-error').hidden = true;
    const selected = state.navigation?.selectedId;
    if (modelInitializing || selectionSync || page !== 'explore') { lastSelected = selected; return; }
    if (['linkrod-body','link-body'].includes(selected) && selected !== lastSelected) {
      lastSelected = selected;
      void selectRegion('overview',{origin:'model',focus:true});
    } else lastSelected = selected;
  },
  onError(error) { $('dp-loading').hidden = true; $('dp-model-error').hidden = false; notice(error.message); },
});
function ensureViewer(force = false) {
  if (!modelEntry) return Promise.reject(new Error('The paired model is not included in this deployment. The original drawing is available.'));
  if (!force && viewer.state?.lifecycle === 'ready' && viewer.state.model?.id === drawing.modelId) return Promise.resolve();
  if (modelLoading) return modelLoading;
  $('dp-loading').hidden = false; $('dp-model-error').hidden = true;
  modelInitializing = true;
  modelLoading = viewer.mountModel(drawing.modelId).then(async () => {
    if (regionId !== 'overview') await viewer.request('select',{nodeId:'linkrod-body'});
    lastSelected = viewer.state?.navigation?.selectedId;
  }).finally(() => { modelLoading = null; modelInitializing = false; });
  return modelLoading;
}
async function selectRegion(id,{origin='controls',focus=false} = {}) {
  if (!regions.has(id)) return;
  regionId = id; renderSelection(); drawingView.select(id,{focus}); updateURL({replace:true});
  if (origin !== 'model' && viewer.state?.lifecycle === 'ready') {
    selectionSync++;
    try { await viewer.request('select',{nodeId:'linkrod-body'}); }
    catch(error) { notice(error.message); }
    finally { selectionSync--; lastSelected = 'linkrod-body'; }
  }
}
function syncView() {
  $('dp-stage').dataset.view = view;
  for (const button of document.querySelectorAll('[data-view]')) {
    if (button.tagName === 'BUTTON') button.setAttribute('aria-pressed',String(button.dataset.view === view && page === 'explore'));
  }
  $('dp-model-pane').inert = page !== 'explore' || view === 'drawings';
  $('dp-drawing-pane').inert = page !== 'explore' || view === '3d';
  if (page !== 'explore' || view === 'drawings') void viewer.pause().catch(() => {});
  requestAnimationFrame(() => drawingView.resize());
}
async function ensureWorkspace() {
  if (workspace) return workspace;
  if (!workspaceLoading) workspaceLoading = import('../product-room/workspace-entry.jsx').then(({createWorkspace}) => {
    workspace = createWorkspace($('dp-workspace'),{
      repository,
      onNavigate:route => { void navigate(route).catch(error => notice(error.message)); },
      onExplore:async context => {
        if (context.modelRevision !== MODEL_CATALOG.linkrods.revision || context.drawing?.assetRevision !== drawing.assetRevision || context.drawing?.revision !== drawing.revision || !regions.has(context.drawing?.regionId)) {
          notice('This saved reference uses a different revision. Its original record is preserved; the current drawing will not replace it.'); return;
        }
        returnRoute = {...currentRoute}; regionId = context.drawing.regionId;
        $('dp-return-project').hidden = false;
        view = mobile.matches ? 'drawings' : 'compare';
        await navigate({view:'explore'});
        drawingView.select(regionId,{focus:true});
      },
    }); return workspace;
  }).catch(error => { workspaceLoading = null; throw error; });
  return workspaceLoading;
}
async function navigate(route,{record=true} = {}) {
  const turn = ++navigation;
  if (workspace && page !== 'explore' && !(await workspace.beforeLeave(route))) { updateURL({replace:true}); return; }
  if (turn !== navigation) return;
  const next = modelEntry && ['inquiry','project','projects','components'].includes(route.view) ? route.view : 'explore';
  page = next; currentRoute = {...route,view:next};
  $('dp-preview').hidden = next !== 'explore'; $('dp-workspace-page').hidden = next === 'explore';
  $('dp-inquire').hidden = next !== 'explore';
  $('dp-projects').setAttribute('aria-current',next === 'projects' ? 'page' : 'false');
  renderSelection(); drawingView.select(regionId); syncView();
  updateURL({replace:!record});
  if (next === 'explore') {
    if (view !== 'drawings') await ensureViewer();
    return;
  }
  await viewer.pause().catch(()=>{});
  const host = await ensureWorkspace();
  if (turn !== navigation) return;
  const context = route.context || createDrawingContext({drawing,regionId,modelRevision:MODEL_CATALOG.linkrods.revision});
  await host.open({...currentRoute,context});
  $('drawing-main').focus({preventScroll:true});
  window.scrollTo({top:0});
}
async function setView(next) {
  view = mobile.matches && next === 'compare' ? '3d' : next;
  await navigate({view:'explore'});
}
async function locate3D() {
  const id = regionId;
  if (view === 'drawings') await setView('3d');
  else if (page !== 'explore') await navigate({view:'explore'});
  await ensureViewer();
  lastSelected = 'linkrod-body';
  await focusDrawingRegion(viewer,regions.get(id));
}
for (const region of sheet.regions) {
  const option = document.createElement('option'); option.value = region.id; option.textContent = region.label; $('dp-detail').append(option);
}
for (const button of document.querySelectorAll('button[data-view]')) button.addEventListener('click',() => { void setView(button.dataset.view).catch(error=>notice(error.message)); });
$('dp-detail').addEventListener('change',() => { void selectRegion($('dp-detail').value,{focus:true}); });
$('dp-show-3d').addEventListener('click',() => { void locate3D().catch(error=>notice(error.message)); });
$('dp-show-drawing').addEventListener('click',async () => { try { if(view === '3d') await setView('drawings'); drawingView.select(regionId,{focus:true}); } catch(error) { notice(error.message); } });
$('dp-inquire').addEventListener('click',() => {
  activeContext = createDrawingContext({drawing,regionId,modelRevision:MODEL_CATALOG.linkrods.revision});
  void navigate({view:'inquiry',context:activeContext}).catch(error=>notice(error.message));
});
$('dp-projects').addEventListener('click',() => { void navigate({view:'projects'}).catch(error=>notice(error.message)); });
$('dp-back').addEventListener('click',() => { void navigate({view:'explore'}).catch(error=>notice(error.message)); });
$('dp-home').addEventListener('click',event => { event.preventDefault(); void navigate({view:'explore'}).catch(error=>notice(error.message)); });
$('dp-return-project').addEventListener('click',() => { void navigate(returnRoute || {view:'projects'}).catch(error=>notice(error.message)); });
$('dp-retry').addEventListener('click',() => { void ensureViewer(true).catch(error=>notice(error.message)); });
$('dp-fit').addEventListener('click',() => drawingView.fit());
$('dp-zoom-in').addEventListener('click',() => drawingView.zoomBy(1.4));
$('dp-zoom-out').addEventListener('click',() => drawingView.zoomBy(1/1.4));
$('dp-pdf').href = pdfURL; $('dp-original').href = pdfURL; $('dp-step').href = stepURL;
$('dp-provenance').href = drawing.sourceURL;
$('dp-source').addEventListener('click',() => $('dp-source-dialog').showModal());
$('dp-source-close').addEventListener('click',() => $('dp-source-dialog').close());
$('dp-source-dialog').addEventListener('click',event => { if(event.target === $('dp-source-dialog')) { const r=event.target.getBoundingClientRect(); if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)event.target.close(); } });
window.addEventListener('annora:routechange',() => { currentRoute = {...readBuyerRoute(),context:activeContext}; });
window.addEventListener('popstate',() => { readSelection(); activeContext = null; void navigate(readBuyerRoute(),{record:false}).catch(error=>notice(error.message)); });
document.addEventListener('visibilitychange',() => { if(document.hidden)void viewer.pause().catch(()=>{}); });
mobile.addEventListener('change',() => { if(mobile.matches && view === 'compare')view='3d'; syncView();updateURL({replace:true}); });
window.addEventListener('pagehide',event => { if(!event.persisted)drawingView.dispose(); });
readSelection(); renderSelection(); drawingView.select(regionId);
if (!modelEntry) {
  for (const id of ['dp-inquire','dp-projects','dp-show-3d']) $(id).disabled = true;
  for (const button of document.querySelectorAll('button[data-view]')) button.disabled = button.dataset.view !== 'drawings';
  notice('The paired model is not configured in this deployment. You can still inspect and download the source drawing.');
}
void navigate(readBuyerRoute(),{record:false}).catch(error=>notice(error.message));
