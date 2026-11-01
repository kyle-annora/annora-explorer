import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { InteractionOutlinePass } from '../../src/explorer/interaction-outline.js';
import { APPEARANCE_PROFILES, getAppearanceProfile, displayChannels, interactionKeyline, engineeringBackgroundChannels } from '../../src/explorer/render-theme.js';
import { buildHierarchy } from '../../src/explorer/model-state.js';

test('Engineering tone mapping round-trips authored canvas colors without changing material exposure',()=>{
  // Independent forward evaluation of Three's fixed Neutral output transform.
  const neutral=color=>{
    const minimum=Math.min(...color),offset=minimum<.08?minimum-6.25*minimum*minimum:.04;
    color=color.map(value=>value-offset);const peak=Math.max(...color);
    if(peak<.76)return color;
    const newPeak=1-.24*.24/(peak+.24-.76),g=1-1/(.15*(peak-newPeak)+1);
    return color.map(value=>(value*newPeak/peak)*(1-g)+newPeak*g);
  };
  for(const {background} of Object.values(APPEARANCE_PROFILES)){
    const actual=neutral(engineeringBackgroundChannels(background)).map(value=>value<=.0031308?12.92*value:1.055*value**(1/2.4)-.055);
    displayChannels(background).forEach((expected,index)=>assert.ok(Math.abs(actual[index]-expected)<1e-7));
  }
});

test('one semantic mask keeps selection A and hover B without mutating engineering materials or geometry',()=>{
  const scene=new THREE.Scene(),geometry=new THREE.BoxGeometry(),material=new THREE.MeshStandardMaterial({color:'#456789',emissive:'#112233'});
  const a=new THREE.Mesh(geometry,material),b=new THREE.Mesh(geometry,material),context=new THREE.Mesh(geometry,material);scene.add(a,b,context);
  a.position.set(2,3,4);b.position.set(-1,2,3);
  const pass=new InteractionOutlinePass(new THREE.Vector2(100,100),scene,new THREE.PerspectiveCamera());
  pass.selectedObjects=[a];pass.hoveredObjects=[a,b];pass.occluderObjects=[a,b];pass.syncMask();
  assert.equal(pass.proxies.get(a).material,pass.maskMaterials[1],'selection wins on the same part');
  assert.equal(pass.proxies.get(b).material,pass.maskMaterials[2],'another part retains hover');
  assert.equal(pass.proxies.get(context).visible,false,'faint parent context cannot occlude active geometry');
  assert.equal(pass.proxies.get(a).geometry,geometry);assert.deepEqual(pass.proxies.get(a).matrix.toArray(),a.matrixWorld.toArray());
  assert.equal(a.material,material);assert.equal(material.emissive.getHexString(),'112233');assert.equal(material.color.getHexString(),'456789');
  const proxy=pass.proxies.get(b);pass.hoveredObjects=[];pass.syncMask();assert.equal(pass.proxies.get(b),proxy);assert.equal(proxy.material,pass.maskMaterials[0]);
  pass.setAppearance('dark');pass.syncMask();assert.equal(pass.proxies.size,3);assert.equal(a.material,material);
  let disposed=0;geometry.addEventListener('dispose',()=>disposed++);pass.dispose();assert.equal(disposed,0,'source geometry is caller-owned');geometry.dispose();material.dispose();
});

test('appearance changes use display-space colors and do not alter the requested accent',()=>{
  const pass=new InteractionOutlinePass(new THREE.Vector2(100,100),new THREE.Scene(),new THREE.PerspectiveCamera());
  pass.visibleEdgeColor.setRGB(...displayChannels('#ff3b5c'));
  for(const appearance of ['dark','light']){
    pass.setAppearance(appearance);
    assert.equal(pass.visibleEdgeColor.getHexString(THREE.LinearSRGBColorSpace),'ff3b5c');
    assert.deepEqual(pass.material.uniforms.keyline.value.toArray(),displayChannels(APPEARANCE_PROFILES[appearance].keyline));
  }
  assert.equal(getAppearanceProfile('unknown'),APPEARANCE_PROFILES.light);
  assert.equal(interactionKeyline('dark','#000000'),'#cbd0d4');assert.equal(interactionKeyline('dark','#ffffff'),'#101215');
  assert.equal(pass.material.blending,THREE.NormalBlending);
  assert.match(pass.material.fragmentShader,/mix\(color,accent,ink\)/,'stroke replaces display color rather than adding light');
  assert.match(pass.material.fragmentShader,/neighborDepth-0.000015/,'foreground-depth rejection remains present');
  pass.dispose();
});

test('semantic outline renders one shared mask and restores renderer state if interrupted',()=>{
  const scene=new THREE.Scene(),mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());scene.add(mesh);
  const pass=new InteractionOutlinePass(new THREE.Vector2(100,100),scene,new THREE.PerspectiveCamera());
  pass.selectedObjects=[mesh];pass.hoveredObjects=[mesh];
  let target={old:true},autoClear=true,color=new THREE.Color('#123456'),alpha=.3;const before=target,draws=[];
  const renderer={getRenderTarget:()=>target,setRenderTarget:v=>target=v,getClearColor:v=>v.copy(color),getClearAlpha:()=>alpha,setClearColor:(v,a)=>{color.set(v);alpha=a;},clear(){},render(s){draws.push(s);},get autoClear(){return autoClear;},set autoClear(v){autoClear=v;}};
  pass.render(renderer,{}, {texture:{}});assert.equal(draws.length,2);assert.equal(draws[0],pass.maskScene);assert.equal(target,before);assert.equal(autoClear,true);assert.equal(alpha,.3);assert.equal(color.getHexString(),'123456');
  renderer.render=()=>{throw new Error('interrupted');};assert.throws(()=>pass.render(renderer,{}, {texture:{}}),/interrupted/);assert.equal(target,before);assert.equal(autoClear,true);assert.equal(alpha,.3);
  pass.dispose();mesh.geometry.dispose();mesh.material.dispose();
});

test('touch interaction clears desktop hover and selects on tap without creating a hover state',async()=>{
  globalThis.window={matchMedia:()=>({matches:false})};
  const {AssemblyScene}=await import('../../src/explorer/scene.js');
  const handlers=new Map(),canvas={style:{},addEventListener:(type,handler)=>handlers.set(type,handler),getBoundingClientRect:()=>({left:0,top:0,width:200,height:200})};
  const hierarchy=buildHierarchy({root:{id:'root'},parts:[{id:'a',meshName:'A',group:'drive'}],groups:[{id:'drive',meshNames:['A']}]});
  let picked=0,cleared=0,selected=null;
  const scene=Object.create(AssemblyScene.prototype);
  Object.assign(scene,{renderer:{domElement:canvas},abort:new AbortController(),ready:true,benchmark:{active:false},scopeId:'root',nodes:hierarchy.nodes,pointer:new THREE.Vector2(),active:[],camera:{},raycaster:{setFromCamera(){},intersectObjects(){picked++;return[{object:{name:'A'}}];}},callbacks:{select:id=>selected=id},hideHover(){cleared++;this.hoveredId=null;},hoveredId:'drive'});
  scene.addPicking();
  const event={pointerId:1,pointerType:'touch',button:0,buttons:0,isPrimary:true,clientX:100,clientY:100};
  handlers.get('pointerdown')(event);handlers.get('pointermove')(event);handlers.get('pointerup')(event);
  assert.equal(cleared,1);assert.equal(scene.hoveredId,null);assert.equal(picked,1,'tap hits once; touch movement does not perform mouse hover picking');assert.equal(selected,'drive');
});
