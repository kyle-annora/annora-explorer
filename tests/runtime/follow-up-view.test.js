import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { STUDIO_MODEL as model, STUDIO_PARTS as parts } from '../../src/studio/seed.js';

// Node runs the same UI controller without a stylesheet pipeline. Browser QA
// covers layout, native focus/disabled interactions and the actual iframe.
register(`data:text/javascript,${encodeURIComponent("export async function load(url,context,next){if(url.endsWith('.css'))return{format:'module',source:'export {};',shortCircuit:true};return next(url,context);}")}`, import.meta.url);
const { createFollowUpView } = await import('../../src/product-room/follow-up-view.js');

class Element extends EventTarget {
  constructor(doc, tag) {
    super(); this.ownerDocument = doc; this.tagName = tag.toUpperCase(); this.children = []; this.dataset = {};
    this.attributes = new Map(); this.className = ''; this.classList = { add: name => { this.className += ` ${name}`; } };
  }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute(key,value) { this.attributes.set(key,String(value)); }
  getAttribute(key) { return this.attributes.get(key) ?? null; }
  querySelectorAll(selector) { return this.children.flatMap(node => [...(node.tagName.toLowerCase() === selector ? [node] : []),...node.querySelectorAll(selector)]); }
}
const clone = value => JSON.parse(JSON.stringify(value));
const deferred = () => { let resolve,reject; const promise = new Promise((yes,no) => {resolve=yes;reject=no;}); return {promise,resolve,reject}; };
const settle = async () => { for(let i=0;i<4;i++) await nextTurn(); };
const click = node => { assert.equal(Boolean(node.disabled),false, 'the selected control must be enabled'); node.dispatchEvent(new Event('click')); };
function fixture(overrides = {}) {
  const doc = {createElement:tag=>new Element(doc,tag),createElementNS:(_,tag)=>new Element(doc,tag)};
  const mount = new Element(doc,'div'), calls = [], saves = [], errors = [], opens = [];
  const story = {version:1,title:'Motion and mounting',steps:model.tour.chapters.slice(0,2).map(chapter => ({
    id:`story:${chapter.id}`,kind:'chapter',title:chapter.title,caption:chapter.caption,nodeId:chapter.selectedId,tourId:model.tour.id,chapterId:chapter.id,
  }))};
  const release = {id:'FOLLOW-UP-1',version:1,title:'Your review',introduction:'Review two points, then continue.',story,
    context:{roomSnapshot:{version:1}},agenda:[{id:'request-one',purpose:'question',notes:'Confirm the guide.',context:{part:{title:'Guide'},roomSnapshot:{version:1}}}]};
  const state = {lifecycle:'ready',model:{id:model.id,revision:model.revision},tour:{active:false},navigation:{selectedId:model.rootId}};
  const viewer = {state,pause:async()=>{calls.push(['pause']);state.tour.status='paused';},request:async(method,params={})=>{
    calls.push([method,clone(params)]);
    if(method==='startTour') Object.assign(state.tour,{active:true,tourId:params.tourId,controls:params.controls,status:'paused'});
    if(method==='goToTourChapter') Object.assign(state.tour,{chapterId:params.chapterId,time:model.tour.chapters.find(item=>item.id===params.chapterId).start});
    if(method==='resumeTour') state.tour.status='playing';
    if(method==='exitTour') state.tour.active=false;
    if(method==='setTourControls') state.tour.controls=params.controls;
  }};
  let page;
  page=createFollowUpView({mount,viewer,release,model,parts,progress:{revision:0,stepId:story.steps[0].id,mode:'paused'},
    actionAvailability:{available:true,label:'Review quotation v1'},
    onSaveProgress:async value=>{saves.push(clone(value));return {...value,revision:value.revision+1};},
    onOpenReference:async item=>opens.push(item),onNextAction:async()=>opens.push('quote'),onBack:async()=>opens.push('project'),onError:error=>errors.push(error),...overrides});
  const button = label => mount.querySelectorAll('button').find(node=>!node.hidden && (node.textContent===label || node.getAttribute('aria-label')===label));
  const primary = () => mount.querySelectorAll('button').find(node=>node.className.includes('room-button-primary'));
  return {page,mount,viewer,state,calls,saves,errors,opens,story,button,primary};
}

test('follow-up starts explicitly, takes over without camera commands, and resumes the saved step', async () => {
  const f=fixture(); assert.deepEqual(f.calls,[]); assert.equal(f.primary().textContent,'Start follow-up');
  click(f.primary()); await settle(); assert.equal(f.primary().textContent,'Next step');
  click(f.primary()); await settle(); assert.equal(f.primary().textContent,'Review quotation v1');
  click(f.button('Explore freely')); await settle();
  assert.equal(f.primary().textContent,'Resume step 2'); assert.equal(f.saves.at(-1).mode,'exploring');
  f.calls.length=0; f.page.update(f.state); assert.deepEqual(f.calls,[],'a frame update cannot recapture the camera');
  click(f.primary()); await settle();
  assert.equal(f.calls.find(item=>item[0]==='goToTourChapter')[1].chapterId,f.story.steps[1].chapterId);
  assert.equal(f.saves.at(-1).stepId,f.story.steps[1].id); f.page.dispose();
});

test('progress is persisted before guarded navigation and a delayed next callback cannot double-submit', async () => {
  const gate=deferred(); let actions=0; let f;
  f=fixture({onNextAction:async()=>{actions++;assert.equal(await f.page.beforeLeave(),true);await gate.promise;}});
  click(f.primary());await settle();click(f.primary());await settle();
  click(f.primary());await settle();assert.equal(actions,1);assert.equal(f.primary().disabled,true);
  assert.equal(f.saves.at(-1).mode,'complete');gate.resolve(false);await settle();
  assert.equal(actions,1);assert.equal(f.primary().textContent,'Resume step 2');f.page.dispose();
});

test('failed save blocks leaving; storage retry succeeds without replaying the action', async () => {
  let failed=true;const saves=[];
  const f=fixture({onSaveProgress:async value=>{if(failed)throw new Error('Storage full');saves.push(value);return {...value,revision:value.revision+1};}});
  click(f.primary());await settle();assert.equal(await f.page.beforeLeave(),false);
  const actions=f.calls.filter(item=>item[0]==='goToTourChapter').length;
  failed=false;click(f.button('Retry saving place'));await settle();assert.equal(await f.page.beforeLeave(),true);
  assert.equal(f.calls.filter(item=>item[0]==='goToTourChapter').length,actions);assert.ok(saves.length);f.page.dispose();
});

test('another tab conflict loads its saved place explicitly without overwriting or moving the camera', async () => {
  let saves=0;let saved;
  const f=fixture({onSaveProgress:async()=>{saves++;throw Object.assign(new Error('Changed in another tab'),{code:'CONFLICT'});},
    onReloadProgress:async()=>saved});
  saved={revision:3,stepId:f.story.steps[1].id,mode:'paused'};
  click(f.primary());await settle();assert.equal(await f.page.beforeLeave(),false);
  const actions=f.calls.filter(item=>item[0]==='goToTourChapter').length;
  click(f.button('Load saved place'));await settle();assert.equal(f.primary().textContent,'Resume step 2');
  assert.equal(f.calls.filter(item=>item[0]==='goToTourChapter').length,actions);assert.equal(saves,1);assert.equal(await f.page.beforeLeave(),true);f.page.dispose();
});

test('a resolved clarification disables the final action while project and reference navigation remain available', async () => {
  const f=fixture();click(f.primary());await settle();click(f.primary());await settle();
  f.page.setActionAvailability({available:false,label:'Reply to the clarification',reason:'This clarification is no longer awaiting a reply.'});
  assert.equal(f.primary().disabled,true);assert.ok(f.button('View project'));assert.ok(f.button('View reference'));
  click(f.button('View reference'));await settle();assert.equal(f.opens[0].id,'request-one');assert.equal(f.primary().textContent,'Resume step 2');f.page.dispose();
});

test('native selection yields the follow-up and an explicit resume restores the step', async () => {
  const f=fixture();click(f.primary());await settle();
  f.state.tour.active=false;f.state.navigation.selectedId='rod';f.calls.length=0;
  f.page.update(f.state);await settle();assert.equal(f.primary().textContent,'Resume step 1');
  assert.equal(f.calls.some(item=>item[0]==='goToTourChapter'),false);assert.equal(f.saves.at(-1).mode,'exploring');f.page.dispose();
});

test('seller preview neither persists progress nor executes a buyer action', async () => {
  let persisted=0,next=0,back=0;
  const f=fixture({preview:true,onSaveProgress:async()=>persisted++,onNextAction:async()=>next++,onBack:async()=>back++});
  click(f.primary());await settle();click(f.primary());await settle();assert.equal(f.primary().textContent,'Finish preview');
  click(f.primary());await settle();assert.equal(persisted,0);assert.equal(next,0);assert.equal(back,1);f.page.dispose();
});
