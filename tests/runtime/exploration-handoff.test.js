import test from 'node:test';
import assert from 'node:assert/strict';
import { createExplorationHandoff, readExplorationHandoff } from '../../src/product-room/exploration-handoff.js';
import { BUNDLED_RELEASE } from '../../src/studio/seed.js';
import { contextForRelease } from '../../src/product-room/release-content.js';
const context = () => {
  const value = contextForRelease(BUNDLED_RELEASE), model = {id:value.modelId,revision:value.modelRevision};
  value.inspection = {version:'1',model,view:{viewVersion:'0.1',model,coordinateFrame:'normalized-assembly-v1',selectedId:'kinetic-root',scopeId:'kinetic-root',isolated:false,mode:'explore',renderStyle:'engineering',displayOptions:{appearance:'light',grid:true,ambientOcclusion:true,featureEdges:true,hiddenEdges:false,lineWeight:'standard'},separation:0,operation:null,camera:{position:[2,3,8],target:[0,0,0],up:[0,1,0],projection:{kind:'perspective',verticalFovDegrees:42,zoom:1,offsetX:0,offsetY:0},viewport:{width:1200,height:800}}}};
  return value;
};
const fixture=()=>{const data=new Map();return {data,storage:{setItem:(k,v)=>data.set(k,v),getItem:k=>data.get(k)??null}};};
test('same-tab handoff preserves immutable Room release, inspection and semantic references',()=>{
  const {storage}=fixture(), source=context(), token=createExplorationHandoff(source,{storage,now:1000});
  const saved=readExplorationHandoff(token,{storage,now:2000});
  assert.equal(saved.roomReleaseId,source.roomReleaseId);assert.deepEqual(saved.roomSnapshot,source.roomSnapshot);assert.deepEqual(saved.inspection,source.inspection);
  saved.inspection.view.camera.target[0]=9;assert.equal(readExplorationHandoff(token,{storage,now:2000}).inspection.view.camera.target[0],0);
});
test('missing, expired, malformed and another-tab references fail explicitly',()=>{
  const {storage,data}=fixture(), token=createExplorationHandoff(context(),{storage,now:1000});
  for(const id of ['bad', '00000000-0000-0000-0000-000000000000'])assert.throws(()=>readExplorationHandoff(id,{storage}),{code:'HANDOFF_UNAVAILABLE'});
  assert.throws(()=>readExplorationHandoff(token,{storage,now:8*24*60*60*1000}),{code:'HANDOFF_UNAVAILABLE'});
  assert.throws(()=>readExplorationHandoff(token,{storage:fixture().storage,now:1000}),{code:'HANDOFF_UNAVAILABLE'});
  data.set([...data.keys()][0],'{broken');assert.throws(()=>readExplorationHandoff(token,{storage}),{code:'HANDOFF_UNAVAILABLE'});
});
test('blocked writes never produce a usable handoff or silently discard the view',()=>{
  for(const storage of [{setItem(){throw Error('quota');},getItem(){return null;}},{setItem(){},getItem(){return null;}}])assert.throws(()=>createExplorationHandoff(context(),{storage}),{code:'HANDOFF_UNAVAILABLE'});
  const noView=context();delete noView.inspection;assert.throws(()=>createExplorationHandoff(noView,{storage:fixture().storage}),{code:'HANDOFF_UNAVAILABLE'});
});
