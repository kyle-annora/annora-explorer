import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {createDesignViewer} from './viewer.js';
import {StudioInspector, InquiryPreviewDialog} from './StudioInspector.jsx';
import {ROOM_CONTENT} from '../product-room/content.js';
import {Icon} from './icons.jsx';
import './styles.css';

const content = ROOM_CONTENT['kinetic-01'];
const rootId = 'kinetic-01';
const screenNames = {product:'Product', detail:'Inspect', studio:'Studio'};
const readScreen = () => {const value = new URL(location.href).searchParams.get('screen'); return screenNames[value] ? value : 'product';};
const initialDraft = {
 title:content.title, subtitle:'Rotary motion.\nLinear precision.', description:content.description,
 inquiryPrompt:'Tell us what your application needs.', technicalOptional:true,
 partNotes:{rod:'The connecting rod transfers the crank’s rotation to the sliding carriage. Follow the two pin joints to see how the motion changes.'},
 documentLinks:{rod:['kinetic-brief']},
};
const partFacts = {crank:['Crank radius','35 mm'],rod:['Pin spacing','110 mm'],carriage:['Full stroke','70 mm'],guide:['Guidance','Two fixed rails'],frame:['Role','Fixed support']};
const shortNames = {crank:'Crank',rod:'Connecting rod',carriage:'Carriage',guide:'Guide rails',frame:'Frame'};

function App() {
 const mount = useRef(null), viewer = useRef(null), main = useRef(null), lastTrigger = useRef(null);
 const [screen,setScreen] = useState(readScreen), [state,setState] = useState(null), [ready,setReady] = useState(false);
 const [progress,setProgress] = useState(0), [error,setError] = useState(''), [commandError,setCommandError] = useState('');
 const [nodes,setNodes] = useState([]), [selected,setSelected] = useState(null), [hotspots,setHotspots] = useState([]);
 const [scopeNodes,setScopeNodes] = useState([]);
 const [drawer,setDrawer] = useState(null), [section,setSection] = useState('product'), [draft,setDraft] = useState(initialDraft);
 const [mobile,setMobile] = useState(() => window.innerWidth <= 700), [editorOpen,setEditorOpen] = useState(false);
 const [inquiryPreview,setInquiryPreview] = useState(false);
 const layout = useRef({});
 layout.current = {screen,mobile,editorOpen};
 const renderStyle = state?.presentation?.renderStyle || 'engineering';
 const running = state?.operation?.status === 'playing';
 const exploded = (state?.presentation?.explosionTarget || state?.presentation?.explosion || 0) > .5;
 const selectedId = state?.navigation?.selectedId;
 const scopeId = state?.navigation?.scopeId || rootId;
 const visiblePart = selected?.id !== rootId ? selected : null;
 const focused = scopeId !== rootId;

 const request = async (method,params={}) => {
   try {setCommandError(''); return await viewer.current?.request(method,params);}
   catch (cause) {if(cause.code !== 'CANCELLED') setCommandError(cause.message);}
 };
 const closeDrawer = () => {setDrawer(null); lastTrigger.current?.focus();};
 const openDrawer = (name,event) => {lastTrigger.current=event.currentTarget;setDrawer(current=>current===name?null:name);};
 const changeScreen = next => {
   if(next===layout.current.screen)return;
   setScreen(next); setDrawer(null); setEditorOpen(false);
   const url = new URL(location.href);url.searchParams.set('screen',next);history.pushState({},'',url);
 };
 const selectPart = async id => {
   if(scopeId!==rootId && scopeId!==id && !scopeNodes.some(node=>node.id===id)) await request('focus',{nodeId:rootId});
   await request('select',{nodeId:id}); if(drawer==='parts')closeDrawer();else setDrawer(null);
   if(screen==='product') changeScreen('detail');
   if(screen==='studio') {setSection('part');setEditorOpen(true);}
 };

 useEffect(() => {
   const media=window.matchMedia('(max-width: 700px)');
   const resize=()=>setMobile(media.matches), pop=()=>{setScreen(readScreen());setDrawer(null);setEditorOpen(false);};
   media.addEventListener('change',resize);window.addEventListener('popstate',pop);
   return()=>{media.removeEventListener('change',resize);window.removeEventListener('popstate',pop);};
 },[]);
 useEffect(() => {
   const escape=event=>{if(event.key==='Escape'&&!document.querySelector('dialog[open]')){if(drawer)closeDrawer();else setEditorOpen(false);}};
   window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape);
 },[drawer]);
 useEffect(()=>{
   if(drawer) document.querySelector(drawer==='parts'?'.dv-full-model':'.dv-render-option')?.focus();
 },[drawer]);
 useEffect(()=>{if(document.activeElement===document.body)main.current?.focus({preventScroll:true});},[screen]);
 useEffect(() => {
   const api=createDesignViewer({mount:mount.current,onState:setState,onProgress:setProgress,onHotspots:setHotspots,
     onError:cause=>setError(cause.message),insets:()=>{
       const {screen:current,mobile:small,editorOpen:editing}=layout.current;
       if(small) return {left:18,right:18,top:current==='studio'?124:72,bottom:current==='product'?340:current==='detail'?384:editing?350:158};
       return {left:current==='studio'?246:48,right:current==='product'?48:350,top:70,bottom:current==='product'?218:112};
     }});
   viewer.current=api;
   let active=true;
   api.ready.then(async()=>{
     const parts=await api.request('getChildren',{nodeId:rootId});
     if(!active)return;
     setNodes(parts);setReady(true);
   }).catch(()=>{});
   return()=>{active=false;api.dispose();viewer.current=null;};
 },[]);
 useEffect(() => {
   if(!ready)return;
   request('pauseOperation');
   if(screen==='product') {
     request('focus',{nodeId:rootId});
   } else if(!selectedId || selectedId===rootId) request('select',{nodeId:'rod'});
   viewer.current.refit();
 },[screen,ready]);
 useEffect(()=>{if(ready)viewer.current.refit();},[mobile,editorOpen,ready]);
 useEffect(()=>{
   if(!ready)return;
   let active=true;
   viewer.current.request('getChildren',{nodeId:scopeId}).then(items=>{if(active)setScopeNodes(items);}).catch(()=>{});
   return()=>{active=false;};
 },[scopeId,ready]);
 useEffect(()=>{
   if(!ready)return;
   let active=true;
   if(!selectedId){setSelected(null);return;}
   viewer.current.request('getNode',{nodeId:selectedId}).then(node=>{if(active)setSelected(node);}).catch(()=>{});
   return()=>{active=false;};
 },[selectedId,ready]);
 useEffect(()=>{if(ready && screen==='product' && selectedId && selectedId!==rootId) changeScreen('detail');},[selectedId]);
 useEffect(()=>{if(ready)viewer.current.setHotspotIds(screen==='product'?['crank','rod']:[]);},[screen,ready]);

 const roomURL = `../product-room/?model=kinetic-01#explore${visiblePart?`&part=${encodeURIComponent(visiblePart.id)}`:''}`;
 const play = () => request(running?'pauseOperation':'replayOperation');
 const fact = partFacts[visiblePart?.id];
 const linkedDocs = content.documents.filter(doc => (draft.documentLinks[visiblePart?.id] || []).includes(doc.id));

 return <div className={`dv-app dv-${screen} ${renderStyle!=='engineering'?'dv-dark':''} ${editorOpen?'dv-editor-open':''}`}>
   <header className="dv-header">
     <a className="dv-brand" href="?screen=product" onClick={e=>{e.preventDefault();changeScreen('product');}} aria-label="Annora product preview"><span className="dv-mark" aria-hidden="true">a</span><span>annora</span></a>
     <nav className="dv-screens" aria-label="Design preview views">
       {Object.entries(screenNames).map(([id,title],index)=><button key={id} aria-current={screen===id?'page':undefined} onClick={()=>changeScreen(id)}><span className="dv-step">0{index+1}</span>{title}</button>)}
     </nav>
     <a className="dv-current" href="../?model=kinetic-01" target="_blank" rel="noreferrer">Current Explorer <Icon name="external" /></a>
     <span className="dv-mobile-preview">Preview</span>
   </header>

   <main ref={main} tabIndex={-1} className="dv-main" aria-label={`${screenNames[screen]} design preview`}>
     <div ref={mount} className="dv-canvas" aria-label="Interactive crank-slider mechanism" />
     {!ready && <div className="dv-loading" role="status"><span className="dv-kicker">KINETIC / 01</span><h1>{error?'The model could not load.':'Preparing the mechanism.'}</h1>{error?<><p>{error}</p><button onClick={()=>location.reload()}>Try again <Icon name="replay" /></button></>:<><progress max="1" value={progress}/><p>Loading the 3D model · {Math.round(progress*100)}%</p></>}</div>}

     <div className="dv-tools">
       <button className="dv-tool" disabled={!ready} onClick={event=>openDrawer('parts',event)} aria-expanded={drawer==='parts'} aria-controls="dv-parts"><Icon name="parts"/><span>Parts</span></button>
       <button className="dv-tool dv-square" disabled={!ready} onClick={()=>request('frame',{nodeId:scopeId})} aria-label="Fit model to view" title="Fit model to view"><Icon name="fit"/></button>
       {focused && <button className="dv-tool dv-up" aria-label="Full assembly" title="Full assembly" onClick={()=>request('focus',{nodeId:rootId})}><Icon name="back"/><span>Full assembly</span></button>}
     </div>
     <div className="dv-display-control"><button className="dv-tool" disabled={!ready} onClick={event=>openDrawer('display',event)} aria-expanded={drawer==='display'} aria-controls="dv-display"><Icon name="display"/><span>{renderStyle==='engineering'?'Engineering':renderStyle==='linework'?'Linework':'Flat Ember'}</span><Icon name="chevron" className="dv-down" /></button></div>

     {drawer==='parts' && <aside id="dv-parts" className="dv-popover dv-part-list" aria-label="Mechanism parts"><div className="dv-panel-heading"><span>Mechanism parts</span><button className="dv-icon" onClick={closeDrawer} aria-label="Close parts"><Icon name="close"/></button></div>
       <button className="dv-full-model" onClick={()=>{request('focus',{nodeId:rootId});closeDrawer();}}><Icon name="parts"/>Full assembly<span>05</span></button>
       {(scopeId===rootId?nodes:scopeNodes).map((node,index)=><button className="dv-part-row" key={node.id} aria-pressed={selectedId===node.id} onClick={()=>selectPart(node.id)}><span className="dv-number">{String(index+1).padStart(2,'0')}</span><span>{shortNames[node.id]||node.title}</span><Icon name="chevron"/></button>)}
       <p className="dv-list-hint">Select a part to learn what it does.</p>
     </aside>}

     {drawer==='display' && <aside id="dv-display" className="dv-popover dv-display-menu" aria-label="Display settings"><div className="dv-panel-heading"><span>Appearance</span><button className="dv-icon" onClick={closeDrawer} aria-label="Close display settings"><Icon name="close"/></button></div>
       {[['engineering','Engineering','Material & light'],['linework','Linework','Clear technical edges'],['flat','Flat Ember','Emphasis without shading']].map(([id,title,desc])=><button key={id} className="dv-render-option" aria-pressed={renderStyle===id} onClick={()=>{request('setRenderStyle',{style:id});closeDrawer();}}><span className={`dv-render-sample dv-sample-${id}`} aria-hidden="true"/><span><strong>{title}</strong><small>{desc}</small></span>{renderStyle===id&&<Icon name="check"/>}</button>)}
       <label className="dv-performance">Performance<select value={state?.appearance?.quality || 'balanced'} onChange={e=>request('setQuality',{profile:e.target.value})}><option value="balanced">Balanced</option><option value="performance">Lighter</option><option value="quality">Higher detail</option></select></label>
     </aside>}

     {screen==='product' && ready && <div className="dv-hotspots">{hotspots.filter(point=>point.visible).map(point=><button key={point.id} className="dv-hotspot" style={{left:point.x,top:point.y}} onClick={()=>selectPart(point.id)} aria-label={`Select ${point.title}`}><span className="dv-hotspot-dot"><Icon name="plus"/></span><span className="dv-hotspot-label">{shortNames[point.id]||point.title}</span></button>)}</div>}

     {screen==='product' && <>
       <div className="dv-product-intro"><span className="dv-kicker">KINETIC / 01 <span>MECHANISM STUDY</span></span><h1>{draft.subtitle || draft.title}</h1><p>{draft.title}</p></div>
       <div className="dv-next"><p>See how the parts work together.</p><button className="dv-primary" disabled={!ready} onClick={()=>changeScreen('detail')}>Explore the mechanism <Icon name="arrow"/></button><span>5 assemblies · Interactive 3D</span></div>
     </>}

     {screen==='detail' && <aside className="dv-detail-panel dv-surface" aria-label="Selected part information"><div className="dv-detail-scroll"><div className="dv-detail-top"><span className="dv-kicker">{visiblePart?'SELECTED PART':'FULL ASSEMBLY'}</span><span className="dv-accent-dot"/></div>
       <h1>{visiblePart?(shortNames[visiblePart.id]||visiblePart.title):draft.title}</h1>
       <p className="dv-detail-description">{visiblePart?(draft.partNotes[visiblePart.id]||visiblePart.description):draft.description}</p>
       {fact&&<dl className="dv-fact"><dt>{fact[0]}</dt><dd>{fact[1]}<small>Model geometry</small></dd></dl>}
       {visiblePart&&<div className="dv-detail-actions"><button className="dv-outline" disabled={!ready} onClick={()=>request('frame',{nodeId:visiblePart.id})}><Icon name="fit"/>Focus view</button>{Boolean(visiblePart.childIds?.length)&&scopeId!==visiblePart.id&&<button className="dv-text" disabled={!ready} onClick={()=>request('focus',{nodeId:visiblePart.id})}>Inspect assembly <Icon name="chevron"/></button>}</div>}
       {linkedDocs.length>0&&<div className="dv-documents">{linkedDocs.map(doc=><a key={doc.id} href={doc.url} target="_blank" rel="noreferrer"><Icon name="document"/><span>Mechanism brief<small>{doc.revision}</small></span><Icon name="external"/></a>)}</div>}
       </div><div className="dv-detail-footer"><a className="dv-primary" href={roomURL}>Open Product Room <Icon name="arrow"/></a></div>
     </aside>}

     {screen==='studio' && <>
       <aside className="dv-studio-nav dv-surface" aria-label="Studio sections"><div className="dv-studio-title"><span>Product workspace</span><small>Session draft</small></div>
         {[['product','Product details','edit'],['part','Parts & documents','parts'],['inquiry','Inquiry setup','settings']].map(([id,label,icon])=><button key={id} aria-current={section===id?'page':undefined} onClick={()=>{setSection(id);setEditorOpen(true);if(id==='part'&&!visiblePart)request('select',{nodeId:'rod'});}}><Icon name={icon}/><span>{label}</span><Icon name="chevron"/></button>)}
         <div className="dv-studio-parts"><span className="dv-kicker">ASSEMBLY</span>{nodes.map(node=><button key={node.id} aria-pressed={selectedId===node.id} onClick={()=>selectPart(node.id)}><span className="dv-part-dot"/>{shortNames[node.id]||node.title}</button>)}</div>
         <p>One product. One shared view.</p>
       </aside>
       {(!mobile||editorOpen)&&<aside className="dv-editor dv-surface" aria-label="Studio editor"><div className="dv-editor-mobile-heading"><span>{section==='part'?'Part information':section==='inquiry'?'Inquiry preferences':'Product details'}</span><button className="dv-editor-close dv-icon" aria-label="Close editor" onClick={()=>setEditorOpen(false)}><Icon name="close"/></button></div><div className="dv-editor-scroll"><StudioInspector section={section} draft={draft} onChange={setDraft} selectedPart={visiblePart}/></div><div className="dv-editor-action"><button className="dv-primary" onClick={()=>section==='inquiry'?setInquiryPreview(true):changeScreen(section==='part'?'detail':'product')}>Preview as customer <Icon name="eye"/></button></div></aside>}
       {!editorOpen&&mobile&&<button className="dv-mobile-edit dv-primary" onClick={()=>setEditorOpen(true)}><Icon name="edit"/>Edit {section==='part'?'selected part':section==='inquiry'?'inquiry setup':'product'}</button>}
     </>}

     <div className="dv-playback" aria-label="Model controls">
       <div className="dv-control-row"><button className="dv-play" disabled={!ready} onClick={play} aria-label={running?'Pause motion':'Play one motion cycle'}><Icon name={running?'pause':'play'}/><span>{running?'Pause':'Play motion'}</span></button>
         <button className="dv-icon" disabled={!ready} onClick={()=>request('replayOperation')} aria-label="Replay motion" title="Replay motion"><Icon name="replay"/></button><span className="dv-control-divider"/>
         <button className="dv-explode" disabled={!ready} aria-pressed={exploded} onClick={()=>request('setExplosion',{progress:exploded?0:1,transition:'animate'})}><Icon name="explode"/><span>{exploded?'Reassemble':'Explode'}</span></button>
       </div>
       <div className="dv-scrub"><input type="range" min="0" max="1" step=".001" value={state?.operation?.progress||0} disabled={!ready} aria-label="Motion progress" onPointerDown={()=>request('pauseOperation')} onChange={event=>request('seekOperation',{progress:Number(event.target.value)})}/><span>2.5s</span></div>
     </div>

     <footer className="dv-stage-note"><span>Drag to rotate · Scroll to zoom</span><a href={content.source?.url || 'https://github.com/pr9868/scene-acceptance'} target="_blank" rel="noreferrer">Illustrative model <Icon name="external"/></a></footer>
     {commandError&&<div role="status" className="dv-command-error">{commandError}<button className="dv-icon" onClick={()=>setCommandError('')} aria-label="Dismiss message"><Icon name="close"/></button></div>}
     {inquiryPreview&&<InquiryPreviewDialog draft={draft} onClose={()=>setInquiryPreview(false)}/>}
   </main>
 </div>;
}

createRoot(document.getElementById('root')).render(<App/>);
