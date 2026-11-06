import test from 'node:test';
import assert from 'node:assert/strict';
import { openWorkspaceReference } from '../../src/product-room/reference-navigation.js';
import { createExplorationHandoff, readExplorationHandoff } from '../../src/product-room/exploration-handoff.js';
import { createDemoProjectRepository } from '../../src/product-room/project-repository.js';
import { contextForRelease } from '../../src/product-room/release-content.js';
import { BUNDLED_RELEASE } from '../../src/studio/seed.js';

const context = selectedId => {
  const value = contextForRelease(BUNDLED_RELEASE), model = {id:value.modelId,revision:value.modelRevision};
  value.part = {id:selectedId,title:selectedId === 'rod' ? 'Connecting rod' : 'Slider guide'};
  value.inspection = {version:'1',model,view:{viewVersion:'0.1',model,coordinateFrame:'normalized-assembly-v1',selectedId,scopeId:'kinetic-root',isolated:true,mode:'explore',renderStyle:'engineering',displayOptions:{appearance:'light',grid:true,ambientOcclusion:true,featureEdges:true,hiddenEdges:false,lineWeight:'standard'},separation:0,operation:null,camera:{position:[2,3,8],target:[0,0,0],up:[0,1,0],projection:{kind:'perspective',verticalFovDegrees:42,zoom:1,offsetX:0,offsetY:0},viewport:{width:1200,height:800}}}};
  return value;
};
const storage = () => { const data = new Map(); return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)}; };

test('top-level Explore returns a direct handoff with its exact view and product release', async () => {
  const store = storage(), source = context('rod');
  const incoming = readExplorationHandoff(createExplorationHandoff(source,{storage:store}),{storage:store});
  let saved = false, returned;
  const workspace = {getContext:()=>structuredClone(incoming),async beforeLeave(route){assert.equal(route.view,'explore');saved=true;return true;}};
  assert.equal(await openWorkspaceReference({workspace,modelId:'kinetic-01',open:reference=> {
    assert.equal(saved,true);
    returned = readExplorationHandoff(createExplorationHandoff(reference,{storage:store}),{storage:store});
  }}),true);
  assert.deepEqual(returned,source);
});

test('a pending original draft wins over a newer incoming view and saves typed values before leaving', async () => {
  const repo = createDemoProjectRepository({storage:storage(),locks:null}), original = context('rod'), incoming = context('guide');
  let draft = await repo.getDraft(original);
  draft.values.application = 'Original buyer requirement'; draft.values.quantity = '12';
  await repo.saveDraft(draft);
  draft = await repo.getDraft(incoming);
  assert.equal(draft.context.part.id,'rod');
  draft.values.application = 'Latest typed requirement';
  let opened;
  const workspace = {getContext:()=>structuredClone(draft.context),async beforeLeave(){draft=await repo.saveDraft(draft);return true;}};
  await openWorkspaceReference({workspace,modelId:'kinetic-01',open:reference=>{opened=reference;}});
  assert.deepEqual(opened.inspection,original.inspection);
  assert.equal((await repo.getDraft(incoming)).values.application,'Latest typed requirement');
  assert.deepEqual((await repo.getDraft(incoming)).context,original);
});

test('a retained draft reference survives an intermediate reading page but never overrides another model', async () => {
  const source = context('rod'); let opened = 0, saves = 0;
  const workspace = {getContext:()=>structuredClone(source),async beforeLeave(){saves++;return true;}};
  assert.equal(await openWorkspaceReference({workspace,modelId:'apollo',open(){opened++;}}),false);
  assert.equal(saves,0); assert.equal(opened,0);
  assert.equal(await openWorkspaceReference({workspace,modelId:'kinetic-01',open:reference=>{opened++;assert.deepEqual(reference,source);}}),true);
  assert.equal(opened,1);
});

test('save refusal, loading and handoff failure never open a replacement view or lock the draft', async () => {
  const source = context('rod'); let opened = 0, unlocked = 0;
  const blocked = {getContext:()=>source,beforeLeave:async()=>false};
  assert.equal(await openWorkspaceReference({workspace:blocked,modelId:'kinetic-01',open(){opened++;}}),true);
  assert.equal(opened,0);
  const loading = {getContext(){throw new Error('Reference is loading');}};
  await assert.rejects(openWorkspaceReference({workspace:loading,modelId:'kinetic-01',open(){opened++;}}),/loading/);
  const failed = {...blocked,beforeLeave:async()=>true,cancelLeave(){unlocked++;}};
  await assert.rejects(openWorkspaceReference({workspace:failed,modelId:'kinetic-01',open(){throw new Error('Storage unavailable');}}),/Storage unavailable/);
  assert.equal(unlocked,1); assert.equal(opened,0);
});
