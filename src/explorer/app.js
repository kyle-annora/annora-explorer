import { createAssemblyPath } from './ui/assembly-path.js';
import { createDisplayUI } from './display-ui.js';
import { createAppearancePanel } from './ui/appearance-panel.js';
import { createOverlayCoordinator } from './ui/overlay-coordinator.js';
import { readDisplayPreferences, writeDisplayPreferences, normalizeDisplayPreferences } from './display-preferences.js';
import { PROJECT_CONFIG } from '../generated/project.js';
import { applyProjectBrand, openingTheme, preferenceNamespace } from './project-brand.js';
import { buildHierarchy, ancestors } from './model-state.js';
import { createNavigation, selectNode, enterScope, toggleBranch, resolveChapterInspectionTarget, createContextualInspectionHandoff } from './navigation-state.js';
import { MODEL_CATALOG, resolveModel, validatePackage } from './model-catalog.js';
import { AssemblyScene } from './scene.js';
import { GuidedTour } from './tour-ui.js';
import { presentationEntry } from './presentation-entry.js';
import spatialGuides, { referenceAssets } from 'virtual:annora-spatial-guides';
import { createOrbitalNavigation, hasOrbitalGuide } from './orbital-navigation.js';
import { createTimelineNavigation } from './timeline-navigation.js';
import { createViewerNavigation } from './ui/viewer-navigation.js';
import { createInquiryEntry } from './ui/inquiry-entry.js';
import commerce from '../../content/commerce.json';
import { readExplorationHandoff } from '../product-room/exploration-handoff.js';
import { createReferenceWorkspace } from './ui/reference-workspace.js';
import { canUseReferenceWorkspace, referenceChapterForNode } from './ui/reference-context.js';
import { getPresentationAssets, presentationMediaPath } from './presentation-assets.js';
import { ExplorerController } from './controller.js';
import { createPageLifecycle } from './controller/page-lifecycle.js';
import { createEmbedBridge, configuredParentOrigin } from './embed-bridge.js';
import { serializeBenchmark } from './performance.js';
import { createAssemblySearch, inspectionState, inspectionFacts } from './inspection-ui.js';
import { resolveTheme, applyThemeTokens, themeRoles } from './themes.js';

const $ = id => document.getElementById(id);
const shellAbort = new AbortController();
let treeAbort = new AbortController(), overlayObserver, overlayFrame, layoutFrame, disposeBridge;
const listen = (target, type, callback, options = {}) => target.addEventListener(type, callback, { ...options, signal: shellAbort.signal });
const listenTree = (target, type, callback) => target.addEventListener(type, callback, { signal: treeAbort.signal });
const icon = name => { const svg = document.createElementNS('http://www.w3.org/2000/svg','svg'); const use = document.createElementNS(svg.namespaceURI,'use'); use.setAttribute('href',`#i-${name}`); svg.append(use); return svg; };
const textNode = (tag,text) => { const node=document.createElement(tag);node.textContent=text;return node; };
const params = new URLSearchParams(location.search);
const embedded = params.get('embed') === '1', compactChrome = embedded && params.get('chrome') === 'compact';
document.body.dataset.embedded = String(embedded);
document.body.dataset.compactChrome = String(compactChrome);
const model = resolveModel(params.get('model'));
const presentationMedia=getPresentationAssets(model.id,model.tour?.id);
const spatialGuide = spatialGuides.find(guide => guide.modelId === model.id);
const topLevelViewer = !embedded && window.parent === window;
const offersOrbit = hasOrbitalGuide(model, spatialGuide, !topLevelViewer, params.get('guide'));
let orbital, timeline, viewerNavigation, lastViewerState, freeCamera, contextualInspection, referenceWorkspace, inquiryEntry;
const commercialProduct = commerce.products.find(item => item.modelId === model.id);
if (offersOrbit && presentationEntry(params, model)) document.body.dataset.openingOrbit = 'true';
const policy=model.allowedCapabilities, themeStorageKey=preferenceNamespace(PROJECT_CONFIG);
const displayStorageKey=`${themeStorageKey}.display.v1`;
let preferenceStorage;try{preferenceStorage=localStorage;}catch{}
let displayPreferences=readDisplayPreferences(preferenceStorage,displayStorageKey,params), appearance=displayPreferences.appearance;
const allowedStyles=policy.renderStyles;
const openingStyle=allowedStyles.includes(params.get('render'))?params.get('render'):allowedStyles.includes('engineering')?'engineering':allowedStyles[0];
let preferredRenderStyle=openingStyle;
applyProjectBrand(PROJECT_CONFIG,document);
let explorer, hierarchy, navigation=createNavigation(model.rootId), renderStyle='engineering', mode='explore';
let displayUI, appearanceUI, appearanceFrame;
const settingsOverlays=createOverlayCoordinator({document,signal:shellAbort.signal});
const closeDisplay=(restore=false)=>settingsOverlays.close('display',restore);
const closeTheme=(restore=false)=>settingsOverlays.close('appearance',restore);
let performanceReport,lastProgress=-1,lastFocus,operationState,guidedTour;
let searchAssembly, treeQuery='', treeSearchResult=null, lastDetailId;
let requestSequence = 0;
const controller = new ExplorerController({ model, port: {
  getScene: () => explorer, getTour: () => guidedTour, getHierarchy: () => hierarchy,
  getTheme: () => ({ id: clientTheme.id, revision: clientTheme.accent }),
  setTheme: (id,accent) => chooseTheme(resolveTheme(id,accent)), sync: () => { if (explorer?.ready && !shellAbort.signal.aborted) syncPresentationUI(); },
  focus: () => { closeTree(); },
  dispose: () => { shellAbort.abort(); contextualInspection?.cancel(); treeAbort.abort(); overlayObserver?.disconnect(); cancelAnimationFrame(overlayFrame); cancelAnimationFrame(layoutFrame); cancelAnimationFrame(appearanceFrame); orbital?.dispose(); timeline?.dispose(); inquiryEntry?.dispose(); inquiryPanel?.dispose(); inquiryMount?.remove(); viewerNavigation?.dispose(); referenceWorkspace?.dispose(); guidedTour?.dispose(); explorer?.dispose(); },
} });
function command(method, params = {}) {
  return controller.request({ requestId: `shell-${++requestSequence}`, method, params }).then(event => {
    if (event.payload.status === 'failed' && !shellAbort.signal.aborted) $('status-message').textContent = event.payload.error.message;
    return event;
  });
}
const mobileLayout=matchMedia(embedded?'(max-width:600px)':'(max-width:980px)');
const shortLandscape=matchMedia(embedded?'(max-width:600px) and (max-height:520px) and (orientation:landscape)':'(max-width:980px) and (max-height:520px) and (orientation:landscape)');
let storedTheme;
try { storedTheme=JSON.parse(localStorage.getItem(themeStorageKey)||'null'); } catch {}
let clientTheme=openingTheme(PROJECT_CONFIG,params,storedTheme);
document.documentElement.dataset.appearance=appearance;document.body.dataset.appearance=appearance;
applyThemeTokens(clientTheme,document.documentElement,appearance);
document.body.dataset.model=model.id;
document.title=model.title+' · '+PROJECT_CONFIG.title;
$('loading-label').textContent=`Preparing ${model.title}…`;
$('breadcrumbs').replaceChildren(textNode('span',model.title));
$('selection-title').textContent=model.title;
$('model-select').replaceChildren(...Object.values(MODEL_CATALOG).map(item=>{const option=textNode('option',item.shortTitle);option.value=item.id;return option;}));
$('model-select').value=model.id;
async function changeModel(id) {
  const nextModel = MODEL_CATALOG[id];
  if (!nextModel || id === model.id) return;
  if (inquiryPanel && !await inquiryPanel.beforeLeave()) { $('model-select').value=model.id; return; }
  contextualInspection?.cancel();
  const url = new URL(location.href);
  url.searchParams.set('model', id);
  url.searchParams.set('render', preferredRenderStyle);
  if (explorer?.quality) url.searchParams.set('quality', explorer.quality);
  if ((orbital?.active || guidedTour?.active) && nextModel.allowedCapabilities.tours.length) url.searchParams.set('presentation', '1');
  else url.searchParams.delete('presentation');
  url.searchParams.delete('guide');
  url.searchParams.delete('inspection');
  url.hash = '';
  location.assign(url);
}
function syncViewerNavigation() {
  const active = orbital?.active || guidedTour?.active;
  const state = { mode: active ? 'demo' : 'explore', pending: Boolean(contextualInspection?.pending || orbital?.state.pending || timeline?.state.pending || guidedTour?.pending || !explorer?.ready), canDemo: Boolean(policy.tours.length) };
  const key = JSON.stringify(state);
  if (key === lastViewerState) return;
  lastViewerState = key;
  viewerNavigation?.sync(state);
  if (!active && referenceWorkspace && hierarchy) referenceWorkspace.setChapter(referenceChapterForNode(spatialGuide,hierarchy,navigation.selectedId)?.id,navigation.selectedId);
}
function restoreFreeCamera() {
  if (!freeCamera || !explorer?.ready) return;
  explorer.resize();
  explorer.restoreCameraView(freeCamera, { animate: false });
  freeCamera = null;
}
if (topLevelViewer && offersOrbit) contextualInspection = createContextualInspectionHandoff({
  resolveTarget: () => resolveChapterInspectionTarget(hierarchy?.nodes, spatialGuide, orbital?.state.chapter),
  isDemoActive: () => Boolean(orbital?.active), closeDemo: () => orbital.close(),
  isDisposed: () => shellAbort.signal.aborted, onPending: syncViewerNavigation,
  async focusTarget({ nodeId }, owns) {
    if (!owns() || !explorer?.ready || !hierarchy.nodes.has(nodeId)) return false;
    // Contextual inspection starts with an assembled, unisolated scope. Ordinary
    // Explore continues to restore its original camera, pose and selection.
    if (explorer.mode !== 'explore' || explorer.fraction > .001) {
      const result = await command('setMode', { mode: 'explore' });
      if (!owns() || result.payload.status !== 'completed') return false;
    }
    if (explorer.isolated) {
      const result = await command('isolate', { nodeId: null });
      if (!owns() || result.payload.status !== 'completed') return false;
    }
    const result = await command('focus', { nodeId });
    return owns() && result.payload.status === 'completed';
  },
});
if (contextualInspection) {
  listen(window, 'popstate', () => contextualInspection.cancel());
  listen(window, 'hashchange', () => contextualInspection.cancel());
}
function inspectCurrentDemoAssembly() {
  return contextualInspection?.inspect().then(applied => {
    if (applied && !shellAbort.signal.aborted && !orbital?.active) $('viewer-explore')?.focus({ preventScroll: true });
    return applied;
  }).catch(error => {
    if (!shellAbort.signal.aborted) $('status-message').textContent = error.message || 'This assembly could not be opened. Please try again.';
    return false;
  });
}
if (topLevelViewer) viewerNavigation = createViewerNavigation({ model, models: MODEL_CATALOG,
  onModel: changeModel, onMode: () => orbital ? orbital.close() : timeline?.close() });
else listen($('model-select'), 'change', event => changeModel(event.target.value));

async function inquiryCommand(method, args = {}) {
  const event = await command(method, args);
  if (event.payload.status !== 'completed') throw Object.assign(new Error(event.payload.error?.message || 'The 3D reference could not be prepared.'), { code: event.payload.error?.code });
  return event.payload.result;
}
let restoredInquiryContext = null, inquiryPanel, inquiryMount, inquiryOpening;
let inquiryPanelState = {open:false, expanded:false};
async function captureCommercialContext() {
  const state = await inquiryCommand('getState');
  if (state.tour?.active && state.tour.status === 'playing') await inquiryCommand('pauseTour');
  if (state.operation?.status === 'playing') await inquiryCommand('pauseOperation');
  if (state.presentation?.separation?.playing) await inquiryCommand('pauseExplosion');
  let captured;
  for (let attempt = 0; attempt < 12; attempt++) {
    try { captured = await inquiryCommand('captureInspection'); break; }
    catch (error) {
      if (error.code !== 'BUSY_STATE' || attempt === 11) throw error;
      await new Promise(resolve => setTimeout(resolve, 180));
    }
  }
  if (shellAbort.signal.aborted) return;
  $('status-message').textContent = '3D view prepared. Check the attached reference in your inquiry.';
  const inspection = captured.inspection, selected = inspection.view?.selectedId || inspection.tour?.selectedId;
  let context = { productId:commercialProduct.productId, productTitle:model.title, modelId:model.id, modelRevision:model.revision, inspection };
  // A returned inquiry keeps its reviewed product content even if Studio has
  // published a newer release while the buyer was looking at the model.
  if (inquiryPanel?.getContext() || restoredInquiryContext) {
    const saved = inquiryPanel?.getContext() || restoredInquiryContext;
    if (saved.modelId === model.id && saved.modelRevision === model.revision && saved.roomReleaseId) {
      const {part,chapter,inspection:previousInspection,...release} = saved;
      context = {...release,inspection};
    }
  }
  if (selected && selected !== model.rootId) {
    const node = await inquiryCommand('getNode', {nodeId:selected});
    context.part = {id:node.id,title:node.title};
  }
  if (inspection.tour) {
    const tour = await inquiryCommand('getTour', {tourId:inspection.tour.tourId});
    const chapter = tour.chapters.find(item => item.id === inspection.tour.chapterId);
    if (chapter) context.chapter = {id:chapter.id,title:chapter.label || chapter.title || chapter.id,tourId:tour.id};
  }
  const { attachInquiryRelease } = await import('../product-room/explorer-inquiry-context.js');
  return attachInquiryRelease(context);
}
function syncInquiryOccupancy(state) {
  const changed = inquiryPanelState.expanded !== state.expanded;
  inquiryPanelState = state;
  document.body.dataset.inquiryExpanded = String(Boolean(state.open && state.expanded));
  document.body.dataset.inquiryOpen = String(Boolean(state.open));
  inquiryEntry?.setLabel(state.stage === 'confirmed' ? 'View inquiry' : state.hasDraft ? 'Continue request' : commercialProduct.label);
  if (changed && state.open && state.expanded) {
    closeTree(); closeDisplay(); closeTheme(); closePath(); closePerformance();
  }
  if (changed) {
    // Reflow once when the panel opens or closes. Typing and autosaving never
    // refit the model, and the inquiry's captured view remains immutable.
    explorer?.resize();
  }
}
async function ensureInquiryPanel() {
  if (inquiryPanel) return inquiryPanel;
  const { mountEmbeddedInquiry } = await import('../product-room/embedded-inquiry.jsx');
  if (shellAbort.signal.aborted) return null;
  inquiryMount = document.createElement('div');
  inquiryMount.id = 'embedded-inquiry-root'; document.body.append(inquiryMount);
  inquiryPanel = await mountEmbeddedInquiry(inquiryMount, {
    onCapture: captureCommercialContext,
    async onRestore(context) {
      if (!context.inspection) throw new Error('This request has no saved 3D view.');
      await inquiryCommand('restoreInspection', {inspection:context.inspection});
      const url = new URL(location.href);
      if (context.inspection.tour) url.searchParams.set('presentation','1');
      else url.searchParams.delete('presentation');
      history.replaceState(null,'',url); await timeline?.sync();
    },
    onProject(project) {
      const url = new URL('./product-room/', location.href);
      url.searchParams.set('model',model.id); url.hash = 'project&project=' + encodeURIComponent(project.id);
      location.assign(url);
    },
    onState: syncInquiryOccupancy,
  });
  return inquiryPanel;
}
async function openCommercialInquiry(entry = 'header', opener = $('viewer-request-quote')) {
  if (inquiryOpening) return inquiryOpening;
  inquiryOpening = (async () => {
    const panel = await ensureInquiryPanel();
    if (!panel || shellAbort.signal.aborted) return;
    // Re-entering never silently replaces the existing draft's pinned view.
    const context = panel.getContext() || await captureCommercialContext();
    if (!context || shellAbort.signal.aborted) return;
    await panel.open({context, opener, suggestedIntent:entry === 'header' ? 'quotation' : 'application-review'});
  })().finally(() => { inquiryOpening = null; });
  return inquiryOpening;
}
function contextualInquiryButton(id, label, target, entry) {
  const button = textNode('button',label); button.type='button'; button.id=id;
  button.className='contextual-inquiry-button'; target.append(button);
  listen(button,'click',async () => {
    if (button.disabled) return;
    button.disabled=true; button.setAttribute('aria-busy','true');
    try { await openCommercialInquiry(entry, button); }
    catch (error) { inquiryEntry?.showError(error); }
    finally { button.disabled=false; button.removeAttribute('aria-busy'); }
  });
  return button;
}
let componentInquiryButton;
if (topLevelViewer && commercialProduct && viewerNavigation) {
  inquiryEntry = createInquiryEntry({navigation:viewerNavigation,label:commercialProduct.label,onRequest:() => openCommercialInquiry()});
  componentInquiryButton = contextualInquiryButton('component-inquiry','Ask about this component',document.querySelector('.detail-panel'),'component');
  componentInquiryButton.hidden=true;
  contextualInquiryButton('chapter-inquiry','Discuss this application', $('tour-copy'),'chapter');
}

async function restoreIncomingInspection() {
  try {
    const context = readExplorationHandoff(params.get('inspection'));
    if (context.modelId !== model.id || context.modelRevision !== model.revision) throw new Error('The saved view belongs to another model version. Return to your project to open its original reference.');
    await inquiryCommand('restoreInspection',{inspection:context.inspection});
    restoredInquiryContext = context;
    const url = new URL(location.href);
    if (context.inspection.tour) url.searchParams.set('presentation','1');
    else url.searchParams.delete('presentation');
    history.replaceState(null,'',url);
    await timeline?.sync();
    $('status-message').textContent = 'Saved view restored. Your inquiry draft remains available.';
  } catch(error) {
    inquiryEntry?.showError(error);
    $('status-message').textContent = error.message;
  }
}
$('scene').setAttribute('aria-label',`Interactive ${model.title}. Drag to orbit, scroll to zoom, click to select. Use the assembly index to explore individual parts.`);
$('view-front').textContent=model.viewLabels[0];$('view-rear').textContent=model.viewLabels[1];
$('presentation-media-link').hidden=!presentationMedia;
if(presentationMedia)$('presentation-media-link').href=presentationMediaPath(model.id);
$('source-title').textContent=model.title;
const sourceDialog=$('source-dialog');
sourceDialog.querySelector('p:not(.source-note)').textContent=model.sourceDescription;
sourceDialog.querySelector('.source-note').textContent=model.sourceNote;
const sourceLink=sourceDialog.querySelector('a');sourceLink.hidden=!model.sourceUrl;if(model.sourceUrl)sourceLink.href=model.sourceUrl;sourceLink.replaceChildren(document.createTextNode(model.sourceLabel),icon('external'));
if(model.licenseUrl){const license=textNode('a','Read model license');license.href=model.licenseUrl;license.target='_blank';license.rel='noopener noreferrer';sourceDialog.append(license);}
$('open-sources').querySelector('span').textContent=model.attribution;
$('mode-explode').hidden=!PROJECT_CONFIG.features.explode;
$('mode-operate').hidden=!PROJECT_CONFIG.features.operation;
$('tour-start').hidden=!policy.tours.length;
$('perf-toggle').hidden=!PROJECT_CONFIG.features.quality;
$('perf-run').hidden=!PROJECT_CONFIG.features.explode;
document.querySelector('.benchmark-description').hidden=!PROJECT_CONFIG.features.explode;
for(const option of $('render-mode').options){option.hidden=!allowedStyles.includes(option.value);option.disabled=option.hidden;}
$('render-mode').hidden=true;


function viewportInsets(){
  const width=$('scene').clientWidth,height=$('scene').clientHeight;
  const rect=selector=>{const node=document.querySelector(selector);return node&&!node.hidden&&node.getClientRects().length&&getComputedStyle(node).visibility!=='hidden'?node.getBoundingClientRect():null;};
  const header=rect('.app-header'),heading=rect('.stage-heading');
  if (inquiryPanelState.open && inquiryPanelState.expanded) {
    const panel=rect('#embedded-inquiry-root > *');
    const top=Math.max(header?.bottom||0,heading?.bottom||0)+12;
    if (panel) return mobileLayout.matches ? {left:12,right:12,top,bottom:Math.max(12,height-panel.top+12)} : {left:12,right:Math.max(12,width-panel.left+12),top,bottom:100};
  }
  if(guidedTour?.active){
    const transport=rect('.tour-transport'),copy=rect('#tour-copy');
    const bottom=height-(mobileLayout.matches&&!shortLandscape.matches?Math.min(copy?.top||height,transport?.top||height):(transport?.top||height))+12;
    return shortLandscape.matches?{left:240,right:12,top:(header?.bottom||0)+8,bottom}:{left:12,right:12,top:Math.max(header?.bottom||0,heading?.bottom||0)+12,bottom};
  }
  if(referenceWorkspace?.view==='compare')return {left:12,right:12,top:Math.max(header?.bottom||0,heading?.bottom||0)+12,bottom:100};
  const dock=document.body.classList.contains('performance-open')&&mobileLayout.matches?null:rect('.stage-tools');
  const details=document.body.classList.contains('performance-open')?rect('#perf-panel'):guidedTour?.active?null:rect('.detail-panel'),tree=rect('.assembly-panel');
  const top=Math.max(header?.bottom||0,heading?.bottom||0)+12;
  if(shortLandscape.matches)return guidedTour?.active?{left:12,right:width-Math.min(details?.left||width,dock?.left||width)+12,top,bottom:52}:{left:12,right:width-(details?.left||width)+12,top,bottom:height-(dock?.top||height)+12};
  if(mobileLayout.matches)return {left:12,right:12,top,bottom:height-Math.min(dock?.top||height,details?.top||height)+12};
  const collapsed=document.body.classList.contains('details-collapsed');
  return {left:(tree?.right||0)+12,right:collapsed?12:width-(details?.left||width)+12,top,bottom:height-Math.min(dock?.top||height,collapsed?details?.top||height:height)+12};
}
function syncTreeAccess(){ $('assembly-panel').inert=!document.body.classList.contains('tree-open'); }
function setDetailsCollapsed(collapsed){
  document.body.classList.toggle('details-collapsed',collapsed);
  $('toggle-details').setAttribute('aria-expanded',String(!collapsed));$('toggle-details').setAttribute('aria-label',collapsed?'Show component details':'Collapse component details');$('toggle-details').title=collapsed?'Show component details':'Collapse component details';$('detail-body').inert=collapsed;
  cancelAnimationFrame(layoutFrame); layoutFrame=requestAnimationFrame(()=>{ if (!shellAbort.signal.aborted) explorer?.refitLayout(); });
}
listen(mobileLayout,'change',()=>{closeTree();explorer?.refitLayout();});
setDetailsCollapsed(true);syncTreeAccess();
function closeTree({restoreFocus=false}={}){
  const hadFocus=$('assembly-panel').contains(document.activeElement),wasOpen=document.body.classList.contains('tree-open');
  document.body.classList.remove('tree-open');$('tree-backdrop').hidden=true;$('toggle-tree').setAttribute('aria-expanded','false');$('toggle-tree').setAttribute('aria-label','Open assembly index');syncTreeAccess();
  if(restoreFocus||hadFocus)$('toggle-tree').focus({preventScroll:true});
  if(wasOpen)explorer?.refitLayout();
}
function closePerformance(){ $('perf-panel').hidden=true;document.body.classList.remove('performance-open');$('perf-toggle').setAttribute('aria-expanded','false');explorer?.refitLayout(); }
function chooseTheme(theme,persist=true){
  clientTheme=theme;explorer?.setTheme(applyThemeTokens(theme,document.documentElement,appearance));
  appearanceUI?.syncTheme();$('render-flat').textContent=`Flat ${theme.name==='Custom'?'accent':theme.name}`;
  displayUI?.sync();
  if(persist&&PROJECT_CONFIG.features.themes){try{localStorage.setItem(themeStorageKey,JSON.stringify({id:theme.id,accent:theme.accent}));}catch{}
    const url=new URL(location.href);url.searchParams.set('theme',theme.id);if(theme.id==='custom')url.searchParams.set('accent',theme.accent);else url.searchParams.delete('accent');history.replaceState(null,'',url);}
}
function saveDisplayPreferences(){displayPreferences=writeDisplayPreferences(preferenceStorage,displayStorageKey,displayPreferences);}
function syncAppearanceUI(){
  const value=explorer?.displayOptions?.appearance||appearance;
  const changed=appearance!==value;appearance=value;
  if(changed){
    cancelAnimationFrame(appearanceFrame);document.documentElement.classList.add('appearance-changing');
    appearanceFrame=requestAnimationFrame(()=>{appearanceFrame=requestAnimationFrame(()=>document.documentElement.classList.remove('appearance-changing'));});
  }
  document.documentElement.dataset.appearance=appearance;document.body.dataset.appearance=appearance;
  if(changed)chooseTheme(clientTheme,false);
  appearanceUI?.sync();
}
async function displayCommand(method,options={}){
  const preferenceStyle=explorer?.renderStyle;
  const event=await command(method,options);
  if(shellAbort.signal.aborted||event.payload.status!=='completed')return event;
  if(method==='setRenderStyle'){
    preferredRenderStyle=options.style;await command('setDisplayOptions',{options:{grid:displayPreferences.grids[options.style]}});
    if(!shellAbort.signal.aborted){const url=new URL(location.href);url.searchParams.set('render',options.style);history.replaceState(null,'',url);}
  }
  else if(method==='setDisplayOptions'&&typeof options.options?.grid==='boolean'){
    displayPreferences.grids[preferenceStyle]=options.options.grid;saveDisplayPreferences();
  }
  return event;
}
listen(window,'storage',async event=>{
  if(event.key===displayStorageKey){
    let incoming;try{incoming=JSON.parse(event.newValue||'null');}catch{return;}
    displayPreferences=normalizeDisplayPreferences(incoming);
    const url=new URL(location.href);url.searchParams.set('appearance',displayPreferences.appearance);history.replaceState(null,'',url);
    if(explorer?.ready)await command('setDisplayOptions',{options:{appearance:displayPreferences.appearance,grid:displayPreferences.grids[explorer.renderStyle]}});
    else appearance=displayPreferences.appearance;
    syncAppearanceUI();chooseTheme(clientTheme,false);
  }else if(event.key===themeStorageKey&&PROJECT_CONFIG.features.themes){
    let incoming;try{incoming=JSON.parse(event.newValue||'null');}catch{return;}
    chooseTheme(openingTheme(PROJECT_CONFIG,new URLSearchParams(),incoming),false);controller.notify({force:true});
    const url=new URL(location.href);url.searchParams.set('theme',clientTheme.id);if(clientTheme.id==='custom')url.searchParams.set('accent',clientTheme.accent);else url.searchParams.delete('accent');history.replaceState(null,'',url);
  }
});
// These snapshots expose no scene objects or mutable preference state to panels.
const appearanceState=()=>({ready:Boolean(explorer?.ready),appearance,theme:clientTheme});
const displayState=()=>({ready:Boolean(explorer?.ready),renderStyle:explorer?.renderStyle,displayOptions:{...explorer?.displayOptions}});
const reportPanelError=error=>{if(!shellAbort.signal.aborted)$('status-message').textContent=error.message;};
async function changeAppearance(value){
  const previous=displayPreferences.appearance;
  displayPreferences.appearance=value;saveDisplayPreferences();
  const url=new URL(location.href);url.searchParams.set('appearance',value);history.replaceState(null,'',url);
  const event=await command('setDisplayOptions',{options:{appearance:value}});
  if(shellAbort.signal.aborted)return;
  if(event.payload.status==='failed'){displayPreferences.appearance=previous;saveDisplayPreferences();url.searchParams.set('appearance',previous);history.replaceState(null,'',url);}
}
appearanceUI=createAppearancePanel({document,getState:appearanceState,command,changeAppearance,themesEnabled:PROJECT_CONFIG.features.themes,signal:shellAbort.signal,onError:reportPanelError});
settingsOverlays.register('appearance',{
  panel:$('theme-panel'),trigger:$('theme-trigger'),closeButton:$('theme-close'),initialFocus:appearanceUI.initialFocus,
  beforeToggle:()=>{closePerformance();closeTree();},restoreOnToggleClose:false,
});
const closePath = (restore = false) => settingsOverlays.close('path', restore);
const assemblyPath = createAssemblyPath({
  document, overlays: settingsOverlays, signal: shellAbort.signal, inspect,
  beforeOpen: () => {
    if (document.body.classList.contains('tree-open')) closeTree();
    if (!$('perf-panel').hidden) closePerformance();
  },
});
chooseTheme(clientTheme,false);syncAppearanceUI();
listen($('toggle-details'),'click',()=>setDetailsCollapsed(!document.body.classList.contains('details-collapsed')));

function renderTree(){
  if(!hierarchy)return;
  treeAbort.abort(); treeAbort = new AbortController();
  const tree=$('component-tree'), focused=document.activeElement;
  const focusId=focused?.dataset.node,focusRole=focused?.dataset.treeRole;
  treeSearchResult=searchAssembly(treeQuery);
  const search=treeSearchResult;
  $('clear-search').hidden=!treeQuery;
  $('tree-search-status').hidden=!search;
  $('tree-search-status').textContent=search?(search.total?`${search.total} ${search.total===1?'match':'matches'}${search.total>search.shown?` · First ${search.shown}. Refine your search.`:''}`:'No matching parts. Try another name.') : '';
  $('collapse-tree').disabled=Boolean(search);
  tree.replaceChildren();
  const render=(id,parent,depth)=>{
    if(search&&!search.visible.has(id))return;
    const node=hierarchy.nodes.get(id), row=textNode('div','');row.className='tree-row'+(id===hierarchy.root.id?' tree-root':'')+(id===navigation.selectedId?' is-selected':'');row.dataset.inScope=String(id===navigation.scopeId);row.style.setProperty('--depth',depth);
    const expanded=(search?search.expanded:navigation.expanded).has(id);
    if(node.children.length&&!search){const toggle=document.createElement('button');toggle.type='button';toggle.className='tree-toggle';toggle.dataset.node=id;toggle.dataset.treeRole='toggle';toggle.setAttribute('aria-label',`${expanded?'Collapse':'Expand'} ${node.title}`);toggle.setAttribute('aria-expanded',String(expanded));toggle.append(icon('chevron'));listenTree(toggle,'click',()=>{controller.takeover();navigation=toggleBranch(navigation,hierarchy.nodes,id);renderTree();});row.append(toggle);}
    else {const spacer=textNode('span','');spacer.className='tree-toggle-spacer';spacer.setAttribute('aria-hidden','true');row.append(spacer);}
    const button=document.createElement('button');button.type='button';button.className='tree-select';button.dataset.node=id;button.dataset.treeRole='select';button.title=node.title;
    const symbols=model.presentationPolicy.navigationIcons||{};
    const mark=icon(symbols[id]||(node.type==='component'?'cube':'layers'));mark.classList.add('node-icon');const label=textNode('span',id===hierarchy.root.id?(model.shortTitle||model.title||node.title):node.title);label.className='tree-label';button.append(mark,label);
    button.setAttribute('aria-pressed',String(id===navigation.selectedId));
    if(id===navigation.scopeId){const badge=textNode('small','');badge.className='tree-scope-badge';badge.title='Current view';badge.setAttribute('aria-label','Current view');badge.append(icon('focus'));button.append(badge);}
    listenTree(button,'click',()=>select(id));listenTree(button,'pointerenter',event=>{if(event.pointerType!=='touch')explorer?.highlight(id);});listenTree(button,'pointerleave',()=>explorer?.hideHover());listenTree(button,'focus',()=>explorer?.highlight(id));listenTree(button,'blur',()=>explorer?.hideHover());row.append(button);
    if(id===navigation.selectedId&&inspectionState(hierarchy.nodes,id,navigation.scopeId).canInspect){const enter=document.createElement('button');enter.type='button';enter.className='tree-enter';enter.dataset.node=id;enter.dataset.treeRole='enter';enter.setAttribute('aria-label','Inspect '+node.title);enter.title='Inspect '+node.title;enter.append(icon('arrow'));listenTree(enter,'click',()=>inspect(id,{restoreFocus:true}));row.append(enter);}
    parent.append(row);
    if(node.children.length&&expanded){const children=textNode('div','');children.className='tree-children';parent.append(children);node.children.forEach(child=>render(child,children,depth+1));}
  };
  render(hierarchy.root.id,tree,0);
  if(focusId&&focusRole)tree.querySelector(`[data-node="${CSS.escape(focusId)}"][data-tree-role="${focusRole}"]`)?.focus({preventScroll:true});
}
function clearSearch(){treeQuery='';$('assembly-search').value='';renderTree();}
// Arrow navigation changes focus/disclosure only. Enter selects; Inspect enters a scope.
listen($('component-tree'),'keydown',event=>{
  const item=event.target.closest('[data-tree-role="select"]');if(!item)return;
  const items=[...$('component-tree').querySelectorAll('[data-tree-role="select"]')],index=items.indexOf(item),node=hierarchy.nodes.get(item.dataset.node);
  let next;
  if(event.key==='ArrowDown')next=items[Math.min(items.length-1,index+1)];
  else if(event.key==='ArrowUp')next=items[Math.max(0,index-1)];
  else if(event.key==='Home')next=items[0];
  else if(event.key==='End')next=items.at(-1);
  else if(event.key==='ArrowRight'){
    if(node.children.length&&!navigation.expanded.has(node.id)&&!treeQuery){event.preventDefault();navigation=toggleBranch(navigation,hierarchy.nodes,node.id);renderTree();return;}
    if(node.children.length)next=items[index+1];
  }else if(event.key==='ArrowLeft'){
    if(node.children.length&&navigation.expanded.has(node.id)&&!treeQuery){event.preventDefault();navigation=toggleBranch(navigation,hierarchy.nodes,node.id);renderTree();return;}
    next=items.find(button=>button.dataset.node===node.parent);
  }
  if(next){event.preventDefault();next.focus();}
});
listen($('assembly-search'),'input',event=>{treeQuery=event.target.value;renderTree();});
listen($('assembly-search'),'keydown',event=>{if(event.key==='Escape'&&treeQuery){event.preventDefault();event.stopPropagation();clearSearch();}});
listen($('clear-search'),'click',()=>{clearSearch();$('assembly-search').focus();});
listen($('reveal-selection'),'click',()=>{
  treeQuery='';$('assembly-search').value='';navigation=selectNode(navigation,hierarchy.nodes,navigation.selectedId);renderTree();
  const item=$('component-tree').querySelector(`[data-node="${CSS.escape(navigation.selectedId)}"][data-tree-role="select"]`);item?.focus({preventScroll:true});item?.scrollIntoView({block:'nearest'});
});
listen($('collapse-tree'),'click',()=>{navigation={...navigation,expanded:new Set(ancestors(hierarchy.nodes,navigation.scopeId).map(node=>node.id))};renderTree();});
function renderDetails(){
  if(referenceWorkspace && !orbital?.active)referenceWorkspace.setChapter(referenceChapterForNode(spatialGuide,hierarchy,navigation.selectedId)?.id,navigation.selectedId);
  const state=inspectionState(hierarchy.nodes,navigation.selectedId,navigation.scopeId),{selected}=state,scopePath=ancestors(hierarchy.nodes,navigation.scopeId);
  if(lastDetailId!==selected.id){$('model-details').open=false;lastDetailId=selected.id;setDetailsCollapsed(selected.id===model.rootId||compactChrome);}
  assemblyPath.sync(hierarchy.nodes, state);
  const backTarget = state.parent || state.scopeParent;
  $('back-scope').hidden = !backTarget;
  if (backTarget) {
    $('back-scope').setAttribute('aria-label', `Back to ${backTarget.title}`);
    $('back-scope').title = `Back to ${backTarget.title}`;
  }
  if (componentInquiryButton) componentInquiryButton.hidden=selected.id===model.rootId;
  $('selection-title').textContent=selected.title;$('selection-description').textContent=mode==='operate'&&selected.id===model.rootId&&operationState?.stage?operationState.stage.description:selected.id===model.rootId?(model.presentationPolicy?.root?.description||selected.description):selected.description;$('selection-badge').textContent=state.kind;
  const context=$('selection-context');context.hidden=state.within&&!navigation.isolated;context.textContent=navigation.isolated&&selected.id===navigation.scopeId?'Isolated · Surrounding parts hidden.':state.context;context.dataset.outside=String(!state.within);
  $('selection-meta').replaceChildren();for(const[label,value]of inspectionFacts(state,model))$('selection-meta').append(textNode('dt',label),textNode('dd',value));
  const source=[['Source meshes',selected.meshNames.length.toLocaleString()]];
  const finish=explorer?.meshes.get(selected.meshName)?.userData.spec?.label;if(finish)source.push(['Display finish',finish]);
  if(selected.sourceName)source.push(['Source label',selected.sourceName]);
  $('source-meta').replaceChildren();for(const[label,value]of source)$('source-meta').append(textNode('dt',label),textNode('dd',value));
  $('focus-selection').dataset.action=state.canInspect?'inspect':'frame';$('focus-selection').dataset.compactLabel=state.canInspect?'Inspect':'Fit';$('focus-selection').setAttribute('aria-label',`${state.action}: ${selected.title}`);$('focus-selection').disabled=false;$('focus-selection').querySelector('span').textContent=state.action;$('focus-selection').title=state.canInspect?'Enter this item and bring it into view':'Center this selection without changing the assembly';$('focus-selection').querySelector('use').setAttribute('href',state.canInspect?'#i-arrow':'#i-focus');
  const isolatedSelection=navigation.isolated&&selected.id===navigation.scopeId;
  $('isolate-selection').setAttribute('aria-pressed',String(isolatedSelection));$('isolate-selection').querySelector('span').textContent=isolatedSelection?'Show context':'Isolate';$('isolate-selection').disabled=selected.id===model.rootId;$('isolate-selection').hidden=selected.id===model.rootId;
  $('isolate-selection').title=isolatedSelection?'Show the surrounding assembly':'View only this selection';
  $('status-message').textContent=state.canInspect?'Selected · Inspect to enter':state.context;
  document.body.dataset.selection=selected.id;document.body.dataset.scope=navigation.scopeId;document.body.dataset.depth=String(scopePath.length-1);
  const scope=hierarchy.nodes.get(navigation.scopeId),canSeparate=scope.type!=='component';
  $('mode-explode').disabled=!canSeparate;$('mode-explode').title=canSeparate?'Separate the current assembly':'Return to an assembly to separate its parts';
  $('explode-toggle').disabled=!canSeparate;$('explode-range').disabled=!canSeparate;
}
function select(id){
  if(!explorer?.ready||!hierarchy.nodes.has(id))return;
  command('select',{nodeId:id});
}
function inspect(id,{restoreFocus:requestedFocus=false}={}){
  if(!explorer?.ready||!hierarchy.nodes.has(id))return;
  const pathFocus=$('breadcrumbs').contains(document.activeElement)||document.activeElement===$('back-scope');
  const restoreFocus=(mobileLayout.matches||Boolean(guidedTour?.active))&&(requestedFocus||[$('assembly-panel'),document.querySelector('.detail-panel'),$('breadcrumbs')].some(panel=>panel.contains(document.activeElement)));
  command('focus',{nodeId:id}).then(()=>{if(pathFocus&&!shellAbort.signal.aborted)($('back-scope').hidden?(embedded?$('toggle-tree'):$('model-select')):$('back-scope')).focus({preventScroll:true});});closeTree({restoreFocus});
}
listen($('focus-selection'),'click',()=>{const state=inspectionState(hierarchy.nodes,navigation.selectedId,navigation.scopeId);if(state.canInspect)inspect(navigation.selectedId);else command('frame',{nodeId:navigation.selectedId});});
function returnToParent() {
  const state = inspectionState(hierarchy.nodes, navigation.selectedId, navigation.scopeId);
  const parent = state.parent || state.scopeParent;
  if (parent) inspect(parent.id);
}
listen($('back-scope'), 'click', returnToParent);
listen($('isolate-selection'),'click',()=>command('isolate',{nodeId:navigation.isolated&&navigation.selectedId===navigation.scopeId?null:navigation.selectedId}));
listen($('toggle-tree'),'click',()=>{
  if(document.body.classList.contains('tree-open')){closeTree();$('toggle-tree').focus({preventScroll:true});return;}
  guidedTour?.closeChapters();controller.takeover();closeDisplay();closePerformance();closeTheme();closePath();lastFocus=document.activeElement;
  document.body.classList.add('tree-open');syncTreeAccess();$('tree-backdrop').hidden=!mobileLayout.matches;$('toggle-tree').setAttribute('aria-expanded','true');$('toggle-tree').setAttribute('aria-label','Close assembly index');$('close-tree').focus({preventScroll:true});explorer?.refitLayout();
});
for(const id of ['close-tree','tree-backdrop'])listen($(id),'click',()=>{closeTree();lastFocus?.focus();});
listen(document,'keydown',event=>{
  if (event.defaultPrevented || inquiryMount?.contains(event.target)) return;
  if (event.key === 'Escape' && inquiryPanelState.open && inquiryPanelState.expanded) { event.preventDefault(); inquiryPanel?.minimize(); return; }
  if (orbital?.active) return;
  if(event.key==='Escape'){
    if(!$('path-panel').hidden){event.preventDefault();closePath(true);return;}
    if(sourceDialog.open){event.preventDefault();sourceDialog.close();return;}
    if(!$('perf-panel').hidden){closePerformance();explorer?.cancelBenchmark();$('perf-toggle').focus();return;}
    if(!$('theme-panel').hidden){closeTheme(true);return;}
    if(!$('display-panel').hidden){closeDisplay(true);return;}
    if(guidedTour?.closeChapters(true)){event.preventDefault();return;}
    if(document.body.classList.contains('tree-open')){closeTree();lastFocus?.focus();return;}
    if(guidedTour?.active){event.preventDefault();guidedTour.requestExit();return;}
  }
  const panel=document.body.classList.contains('tree-open')?$('assembly-panel'):!$('theme-panel').hidden?$('theme-panel'):!$('perf-panel').hidden?$('perf-panel'):!$('display-panel').hidden?$('display-panel'):!$('path-panel').hidden?$('path-panel'):null;
  if(event.key==='Tab'&&panel){const items=[...panel.querySelectorAll('button:not(:disabled),input,select')].filter(node=>node.getClientRects().length);const first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
});
listen($('open-sources'),'click',()=>{if(guidedTour?.active)command('pauseTour');$('source-dialog').showModal();});listen($('close-sources'),'click',()=>$('source-dialog').close());listen($('source-dialog'),'click',event=>{if(event.target===$('source-dialog'))$('source-dialog').close();});
function setView(reverse=false){if(!explorer?.ready)return;command('frame',{nodeId:navigation.scopeId,view:reverse?'rear':'front'});$('view-front').setAttribute('aria-pressed',String(!reverse));$('view-rear').setAttribute('aria-pressed',String(reverse));}
listen($('reset-view'),'click',()=>setView());listen($('view-front'),'click',()=>setView());listen($('view-rear'),'click',()=>setView(true));

function syncOperation(state){
  if(!state)return;operationState=state;mode=state.mode;document.body.dataset.mode=mode;document.body.dataset.playing=String(state.playing);document.body.dataset.operationProgress=String(state.progress);
  for(const value of ['explore','explode','operate'])$('mode-'+value).setAttribute('aria-pressed',String(mode===value));
  $('mode-operate').disabled=!state.available||!policy.operation;$('operation-availability').hidden=state.available||!PROJECT_CONFIG.features.operation;$('explode-controls').hidden=mode!=='explode'&&!state.separation?.playing&&!(state.separation?.available&&state.separation.progress<1);$('operation-controls').hidden=mode!=='operate';
  const separation=state.separation||{}, resumable=separation.available&&separation.progress>0&&separation.progress<1;
  const separationLabel=separation.playing?'Pause':resumable?'Resume':explorer?.fraction>.001?'Reassemble':'Separate';
  $('explode-toggle').querySelector('span').textContent=separationLabel;$('explode-toggle').setAttribute('aria-label',separationLabel+' assembly');$('explode-toggle').setAttribute('aria-pressed',String(Boolean(separation.playing)));$('explode-toggle').querySelector('use').setAttribute('href',separation.playing?'#i-pause':resumable?'#i-play':'#i-expand');
  $('explode-replay').disabled=!separation.available;
  $('operation-play').querySelector('span').textContent=state.playing?'Pause':state.progress>=1?'Replay cycle':state.progress>0?'Resume':'Run cycle';$('operation-play').querySelector('use').setAttribute('href',state.playing?'#i-pause':'#i-play');$('operation-play').setAttribute('aria-label',state.playing?'Pause operation':'Run one operating cycle');$('operation-play').setAttribute('aria-pressed',String(state.playing));
  $('operation-range').value=String(state.progress*100);$('operation-progress').value=`${state.time.toFixed(1)} / ${state.duration.toFixed(1)} s`;$('operation-range').setAttribute('aria-valuetext',`${Math.round(state.progress*100)} percent · ${state.stage?.title||'Ready'}`);
  $('operation-stage').textContent=state.stage?`${String(state.stage.index+1).padStart(2,'0')} / ${String(state.stage.count).padStart(2,'0')} · ${state.stage.title}`:'Ready to operate';$('operation-stage').title=state.stage?.description||'';$('operation-speed').value=String(state.speed);$('operation-follow').checked=Boolean(state.followCamera);
  if(hierarchy&&state.scopeId&&state.scopeId!==navigation.scopeId){navigation=enterScope(navigation,hierarchy.nodes,state.scopeId);renderTree();renderDetails();}
  if(hierarchy&&state.selectedId&&state.selectedId!==navigation.selectedId){navigation=selectNode(navigation,hierarchy.nodes,state.selectedId);renderTree();renderDetails();}
  if(hierarchy&&navigation.isolated!==state.isolated){navigation={...navigation,isolated:state.isolated};renderDetails();}
  if(hierarchy&&navigation.selectedId===model.rootId)$('selection-description').textContent=state.mode==='operate'&&state.stage?state.stage.description:(model.presentationPolicy?.root?.description||hierarchy.root.description);
}
for(const value of ['explore','explode','operate'])listen($('mode-'+value),'click',()=>command('setMode',{mode:value}));
listen($('operation-play'),'click',()=>command(explorer?.getOperationState().playing?'pauseOperation':'playOperation'));
listen($('operation-reset'),'click',()=>command('replayOperation'));
listen($('operation-speed'),'change',event=>command('setOperationSpeed',{speed:Number(event.target.value)}));
listen($('operation-follow'),'change',event=>command('setFollowCamera',{enabled:event.target.checked}));
listen($('operation-range'),'input',event=>command('seekOperation',{progress:Number(event.target.value)/100}));
listen($('explode-toggle'),'click',()=>{
  const state=explorer?.getSeparationState();
  if(state?.playing)command('pauseExplosion');
  else if(state?.available&&state.progress>0&&state.progress<1)command('resumeExplosion');
  else command('setExplosion',{progress:explorer?.fraction>.001?0:1});
});
listen($('explode-replay'),'click',()=>command('replayExplosion'));
listen($('explode-range'),'pointerdown',()=>{controller.takeover();explorer?.pauseCamera();});
listen($('explode-range'),'input',event=>command('setExplosion',{progress:Number(event.target.value)/100,transition:'immediate'}));
listen($('explode-range'),'change',()=>command('frame',{nodeId:navigation.scopeId}));
displayUI=createDisplayUI({document,command:displayCommand,getState:displayState,styles:allowedStyles,signal:shellAbort.signal,accentName:()=>clientTheme.name==='Custom'?'accent':clientTheme.name,onError:reportPanelError});
settingsOverlays.register('display',{
  panel:$('display-panel'),trigger:$('display-trigger'),closeButton:$('display-close'),initialFocus:displayUI.initialFocus,onOpen:()=>displayUI.sync(),
  beforeToggle:opening=>{if(opening){closePerformance();closeTree();}},
});

listen($('perf-toggle'),'click',()=>{const open=$('perf-panel').hidden;if(!open){closePerformance();return;}if(guidedTour?.active)command('pauseTour');closeDisplay();closeTheme();closePath();closeTree();$('perf-panel').hidden=false;document.body.classList.add('performance-open');$('perf-toggle').setAttribute('aria-expanded','true');$('perf-close').focus();explorer?.refitLayout();});
listen($('perf-close'),'click',()=>{closePerformance();$('perf-toggle').focus();});listen($('perf-quality'),'change',event=>command('setQuality',{profile:event.target.value}));
listen($('perf-run'),'click',async()=>{if(!explorer?.ready||!PROJECT_CONFIG.features.quality||!PROJECT_CONFIG.features.explode)return;if(guidedTour?.active)await command('exitTour');lastProgress=-1;performanceReport=null;$('perf-run').disabled=true;$('perf-quality').disabled=true;$('perf-cancel').hidden=false;$('perf-download').disabled=true;document.body.dataset.benchmark='running';explorer.startBenchmark();});
listen($('perf-cancel'),'click',()=>explorer?.cancelBenchmark());
listen($('perf-download'),'click',()=>{if(!performanceReport)return;const url=URL.createObjectURL(new Blob([serializeBenchmark(performanceReport)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download=`${model.id}-${performanceReport.mode}-${performanceReport.quality}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
function showReport(report){
  if(!report)return;performanceReport=report;document.body.dataset.benchmark=report.status;$('perf-run').disabled=false;$('perf-quality').disabled=false;$('perf-cancel').hidden=true;$('perf-download').disabled=false;$('perf-status').textContent=report.status==='completed'?'This browser · 12-second motion check':'Check cancelled';
  const dl=document.createElement('dl'),metric=(value,unit='')=>Number.isFinite(value)?`${value}${unit}`:'—';
  for(const[label,value]of [['Median frame rate',metric(report.frames.medianFps,' fps')],['Frame interval · p95',metric(report.frames.frameIntervalMs.p95,' ms')],['Draw calls / frame',metric(report.drawCallsPerRenderedFrame.p50)],['Frames over 50 ms',report.frames.over50Ms],['First linework frame',report.loading.firstTechnicalMs===undefined?'Not measured':report.loading.firstTechnicalMs+' ms']])dl.append(textNode('dt',label),textNode('dd',value));
  const details=document.createElement('details');details.append(textNode('summary','Measurement details'));const pre=textNode('pre',serializeBenchmark(report));pre.id='perf-json';details.append(pre);$('perf-results').replaceChildren(dl,textNode('p','Current browser only. Physical ordinary-device testing remains pending.'),details);
}

function syncPresentationUI(){
  if(!explorer)return;displayUI?.sync();
  const previousStyle=renderStyle;renderStyle=explorer.renderStyle||'engineering';
  if($('render-mode').value!==renderStyle)$('render-mode').value=renderStyle;
  document.body.dataset.technical=String(renderStyle!=='engineering');
  document.body.dataset.renderStyle=renderStyle;
  syncAppearanceUI();
  if(previousStyle!==renderStyle)$('status-message').textContent=$('render-mode').selectedOptions[0].textContent;
  // The scene already emits operation/scope changes; avoid rebuilding DOM at frame rate.
  if(!guidedTour?.active)syncOperation(explorer.getOperationState());
}

async function start(){
  try{
    controller.setLifecycle('loading');
    const response=await fetch(model.metadataUrl,{signal:shellAbort.signal});if(!response.ok)throw new Error('Model metadata could not be loaded.');const metadata=await response.json();validatePackage(metadata,model);if(shellAbort.signal.aborted)return;hierarchy=buildHierarchy(metadata,model.presentationPolicy);searchAssembly=createAssemblySearch(hierarchy.nodes);
    const config={...model,operation:metadata.operation?{...metadata.operation,cameraDirection:model.defaultDirection}:null};
    explorer=new AssemblyScene($('scene'),metadata,hierarchy,{
      select,inspect,operation:syncOperation,insets:viewportInsets,theme:themeRoles(clientTheme,appearance),
      tourTick:time=>guidedTour?.tick(time)||false,frame:()=>{guidedTour?.updateAnnotations();controller.notify();},interact:()=>controller.takeover(),
      edgeStatus(state){if(state==='loading')$('status-message').textContent='Preparing technical linework…';},
      quality(requested,effective){$('perf-status').textContent=requested===effective?'Quality: '+requested:'Balanced adapted to Performance for smoother motion';document.body.dataset.quality=effective;},
      benchmarkScope(){navigation=enterScope(navigation,hierarchy.nodes,model.rootId);renderTree();renderDetails();closeTree();},
      benchmarkSelection(id){navigation=selectNode(navigation,hierarchy.nodes,id);renderTree();renderDetails();},report:showReport,
      benchmarkProgress(value){const progress=Math.floor(value*10)*10;if(progress!==lastProgress){lastProgress=progress;$('perf-status').textContent='Motion check · '+progress+'%';}},
      hover(node,position){const label=$('hover-label');label.hidden=!node;if(node){label.textContent=node.title;label.style.left=Math.min(position.x,$('viewport').clientWidth-200)+'px';label.style.top=Math.min(position.y,$('viewport').clientHeight-70)+'px';}},
      explosion(fraction){const percent=Math.round(fraction*100);$('explode-range').value=String(percent);$('explode-value').value=percent+'%';document.body.dataset.explosion=fraction.toFixed(4);},
    },config);
    await explorer.load(model.modelUrl,progress=>{$('loading-progress').style.width=Math.round(progress*100)+'%';$('loading-label').textContent=progress<1?`Loading ${model.shortTitle} · ${Math.round(progress*100)}%`:'Preparing materials and lighting…';});
    if(policy.qualityProfiles.includes(params.get('quality')))explorer.setQuality(params.get('quality'));
    if(openingStyle!=='engineering')await explorer.setRenderStyle(openingStyle);
    explorer.setDisplayOptions({appearance,grid:displayPreferences.grids[openingStyle]});
    if(shellAbort.signal.aborted)return;syncPresentationUI();
    if(topLevelViewer && offersOrbit && canUseReferenceWorkspace(spatialGuide)) {
      referenceWorkspace=createReferenceWorkspace({main:$('main-content'),guide:spatialGuide,assets:referenceAssets[model.id],
        beforeChange(){closePath();closeDisplay();closeTheme();closeTree();closePerformance();},
        freeAdapter:{pause(){controller.takeover();explorer.pausePresentation();},capture:()=>explorer.captureCameraView(),restore:view=>explorer.restoreCameraView(view,{animate:false}),resize:()=>explorer.resize(),reframe:()=>explorer.fit(false,explorer.currentDirection(true))}});
      referenceWorkspace.setChapter(referenceChapterForNode(spatialGuide,hierarchy,navigation.selectedId)?.id,navigation.selectedId);
    }
    if (offersOrbit) orbital = createOrbitalNavigation({
      model, guide: spatialGuide, browser: window, listen, load: () => import('./orbital/ui.js'),
      mount({ mountOrbitalUI }, chapter, navigate, exit, checkpoints) {
        contextualInspection?.cancel();
        controller.takeover();
        explorer.pausePresentation();
        referenceWorkspace?.checkpoint();
        freeCamera = explorer.captureCameraView();
        closePath(); closeDisplay(); closeTheme();
        if (!$('perf-panel').hidden) closePerformance();
        return mountOrbitalUI({ explorer, guide: spatialGuide, assets: referenceAssets[model.id], getAccent: () => clientTheme.accent, chapter, navigate, exit, checkpoints, navigationHost: viewerNavigation?.context, inspectAssembly: inspectCurrentDemoAssembly, referenceWorkspace });
      },
      onPending(pending) {
        $('tour-start').disabled = pending;
        if (!pending) delete document.body.dataset.openingOrbit;
      },
      onExit() {
        syncTreeAccess();
        restoreFreeCamera();
        const focus = document.body.classList.contains('tree-open') ? $('close-tree') : $('tour-start');
        focus.focus({ preventScroll: true });
      },
      onChange: syncViewerNavigation,
      onFailure(error) {
        restoreFreeCamera();
        console.error('Orbital presentation unavailable:', error);
        $('status-message').textContent = 'The presentation could not open. You can still explore the model.';
      }
    });
    if (topLevelViewer && !orbital && policy.tours.length) timeline = createTimelineNavigation({ browser: window, listen, getTour: () => guidedTour,
      start: () => command('startTour', { tourId: model.tour.id }), exit: options => command('exitTour', options),
      onChange: syncViewerNavigation, onFailure: error => { console.error('Presentation unavailable:', error); $('status-message').textContent = 'The demo could not open. You can still explore the model.'; } });
    const tourEntry = orbital ? { label: spatialGuide.chapters.length + ' chapters', open: orbital.open } : timeline ? { open: timeline.open, exit: timeline.close } : null;
    if(policy.tours.length)guidedTour=new GuidedTour({scene:explorer,model,command,stateChange:()=>{controller.notify();syncViewerNavigation();},entry:tourEntry,captureNavigation:()=>({...navigation,expanded:new Set(navigation.expanded)}),restoreNavigation:saved=>{navigation=saved;renderTree();renderDetails();},syncScene:syncPresentationUI,closeOverlays:()=>{closePath();closeDisplay();closeTree();closeTheme();closePerformance();},syncLayout:()=>{syncTreeAccess();explorer.refitLayout();}});
    if (timeline) viewerNavigation?.bindTimelineChapters();
    renderTree();renderDetails();syncOperation(explorer.getOperationState());$('assembly-search').disabled=false;$('reveal-selection').disabled=false;$('loading').hidden=true;document.body.dataset.ready='true';$('perf-run').disabled=!PROJECT_CONFIG.features.explode;controller.setLifecycle('ready');
    overlayObserver=new ResizeObserver(()=>{if(!explorer.ready||shellAbort.signal.aborted)return;cancelAnimationFrame(overlayFrame);overlayFrame=requestAnimationFrame(()=>{document.documentElement.style.setProperty('--dock-height',`${document.querySelector('.stage-tools').getBoundingClientRect().height}px`);explorer.refitLayout();$('breadcrumbs').scrollLeft=$('breadcrumbs').scrollWidth;});});
    for(const selector of ['.detail-panel','.assembly-panel','.stage-tools','.stage-heading','#perf-panel','#tour-panel','#tour-copy','.tour-transport'])overlayObserver.observe(document.querySelector(selector));
    listen($('scene'),'keydown',event=>{
      if (orbital?.active) return;
      if(guidedTour?.active){
        if(event.code==='Space'){event.preventDefault();const state=guidedTour.player.state();if(state.status==='playing')command('pauseTour');else if(guidedTour.reducedMotion){const chapter=guidedTour.tour.chapters[state.index+1];command(chapter?'goToTourChapter':'seekTour',chapter?{chapterId:chapter.id}:{seconds:guidedTour.tour.duration});}else command('resumeTour');}
        else if(event.key.toLowerCase()==='r')command('frame',{nodeId:navigation.scopeId});return;
      }
      if(event.key==='Escape'&&!$('back-scope').hidden)returnToParent();
      if(event.key.toLowerCase()==='r')command('frame',{nodeId:navigation.scopeId});
      if(event.code==='Space'&&mode==='operate'){event.preventDefault();command(explorer.getOperationState().playing?'pauseOperation':'playOperation');}
    });
    const entry=presentationEntry(params,model);
    if (topLevelViewer && params.has('inspection')) await restoreIncomingInspection();
    else if (orbital) { await orbital.sync(); delete document.body.dataset.openingOrbit; }
    else if (timeline) await timeline.sync();
    else if(entry&&!shellAbort.signal.aborted)await command('startTour',entry);
    syncViewerNavigation();
    inquiryEntry?.setReady(true);
  }catch(error){if(shellAbort.signal.aborted)return;controller.setLifecycle('error',error);explorer?.dispose();console.error(error);$('loading-label').textContent='The model could not be loaded. Reload this page to try again.';$('status-message').textContent='Model unavailable';document.body.dataset.error=error.message;}
}
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
controller.setEnvironment({visible:!document.hidden,reducedMotion:reducedMotion.matches});
listen(document,'visibilitychange',()=>controller.setEnvironment({visible:!document.hidden}));
listen(reducedMotion,'change',event=>controller.setEnvironment({reducedMotion:event.matches}));
const parentOrigin=configuredParentOrigin(location);
if(parentOrigin)disposeBridge=createEmbedBridge({controller,parentOrigin,window});
const pageLifecycle=createPageLifecycle({controller,getScene:()=>explorer,getTour:()=>guidedTour,disposeBridge:()=>disposeBridge?.()});
listen(window,'pagehide',event=>pageLifecycle.hide(event));
listen(window,'pageshow',event=>pageLifecycle.show(event));
start();
