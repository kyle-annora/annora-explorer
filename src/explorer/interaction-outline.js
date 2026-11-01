import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { displayChannels, interactionKeyline } from './render-theme.js';

/** One visible-surface semantic mask for both selection and hover. It shares source
 * geometry and poses, never changes source materials, and composites in display space. */
export class InteractionOutlinePass extends Pass {
  constructor(resolution, scene, camera) {
    super(); this.scene=scene; this.camera=camera; this.selectedObjects=[]; this.hoveredObjects=[]; this.occluderObjects=null;
    this.visibleEdgeColor=new THREE.Color();this.hiddenEdgeColor=new THREE.Color();this.downSampleRatio=1;
    this.maskScene=new THREE.Scene();this.proxies=new Map();
    this.maskMaterials=[0x000000,0xff0000,0x00ff00].map(color=>new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,toneMapped:false}));
    this.mask=new THREE.WebGLRenderTarget(1,1,{minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,depthBuffer:true});
    this.mask.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);
    this.previousColor=new THREE.Color();
    this.material=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,uniforms:{
      source:{value:null},mask:{value:this.mask.texture},depth:{value:this.mask.depthTexture},texel:{value:new THREE.Vector2(1,1)},
      accent:{value:this.visibleEdgeColor},keyline:{value:new THREE.Color()},scale:{value:1},hasState:{value:false}
    },vertexShader:'varying vec2 uvPoint; void main(){uvPoint=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:`
      uniform sampler2D source; uniform sampler2D mask; uniform sampler2D depth;
      uniform vec2 texel; uniform vec3 accent; uniform vec3 keyline; uniform float scale; uniform bool hasState;
      varying vec2 uvPoint;
      vec2 edgeAt(vec2 center,float centerDepth,float radius){
        vec2 found=vec2(0.0);
        for(int i=0;i<8;i++){
          float angle=float(i)*0.78539816339;
          vec2 p=uvPoint+vec2(cos(angle),sin(angle))*radius*scale*texel;
          vec2 neighbor=texture2D(mask,p).rg;
          float neighborDepth=texture2D(depth,p).r;
          // Do not paint a rear part's contour across a foreground occluder.
          float visible=step(neighborDepth-0.000015,centerDepth);
          found=max(found,max(center-neighbor,(neighbor-center)*visible));
        }
        return found;
      }
      void main(){
        vec4 original=texture2D(source,uvPoint);
        if(!hasState){gl_FragColor=original;return;}
        vec2 state=texture2D(mask,uvPoint).rg;float z=texture2D(depth,uvPoint).r;
        vec2 thin=edgeAt(state,z,0.80),thick=edgeAt(state,z,1.45),outer=edgeAt(state,z,2.15);
        float ink=max(max(thin.r,thin.g),thick.r);
        float backing=max(outer.r,thick.g);
        vec3 color=mix(original.rgb,keyline,backing*.85);
        gl_FragColor=vec4(mix(color,accent,ink),original.a);
      }`});
    this.quad=new FullScreenQuad(this.material);this.setAppearance('light');this.setSize(resolution.x,resolution.y);
  }
  setAppearance(mode){this.appearance=mode;this.material.uniforms.keyline.value.setRGB(...displayChannels(interactionKeyline(mode,'#'+this.visibleEdgeColor.getHexString(THREE.LinearSRGBColorSpace))));}
  setPixelRatio(ratio){this.material.uniforms.scale.value=Math.min(2,Math.max(1,ratio));}
  setSize(width,height){this.mask.setSize(Math.max(1,width),Math.max(1,height));this.material.uniforms.texel.value.set(1/Math.max(1,width),1/Math.max(1,height));}
  syncMask(){
    this.scene.updateMatrixWorld(true);
    const selected=new Set(this.selectedObjects),hovered=new Set(this.hoveredObjects),active=this.occluderObjects&&new Set(this.occluderObjects);
    this.scene.traverse(source=>{
      if(!source.isMesh)return;
      let mesh=this.proxies.get(source);
      if(!mesh){mesh=new THREE.Mesh(source.geometry,this.maskMaterials[0]);mesh.matrixAutoUpdate=false;mesh.frustumCulled=false;this.proxies.set(source,mesh);this.maskScene.add(mesh);}
      mesh.matrix.copy(source.matrixWorld);mesh.matrixWorld.copy(source.matrixWorld);
      mesh.visible=source.visible&&(!active||active.has(source))&&(source.material.opacity??1)>.02;
      mesh.material=this.maskMaterials[selected.has(source)?1:hovered.has(source)?2:0];
    });
  }
  render(renderer,writeBuffer,readBuffer){
    const target=renderer.getRenderTarget(),autoClear=renderer.autoClear,alpha=renderer.getClearAlpha();renderer.getClearColor(this.previousColor);
    this.material.uniforms.source.value=readBuffer.texture;this.setAppearance(this.appearance);
    const hasState=this.selectedObjects.length>0||this.hoveredObjects.length>0;this.material.uniforms.hasState.value=hasState;
    try{
      renderer.autoClear=false;
      if(hasState){this.syncMask();renderer.setRenderTarget(this.mask);renderer.setClearColor(0x000000,0);renderer.clear(true,true,false);renderer.render(this.maskScene,this.camera);}
      renderer.setRenderTarget(this.renderToScreen?null:writeBuffer);this.quad.render(renderer);
    }finally{renderer.autoClear=autoClear;renderer.setClearColor(this.previousColor,alpha);renderer.setRenderTarget(target);}
  }
  dispose(){this.mask.dispose();this.material.dispose();this.quad.dispose();this.maskMaterials.forEach(material=>material.dispose());this.maskScene.clear();this.proxies.clear();}
}
