/** Offline-only research harness. Never import into Explorer or buyer bundles. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { performance } from 'node:perf_hooks';

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'../..');
const dependencies=process.env.CAD_EXPERIMENT_MODULES || '/tmp/annora-replicad-experiment/node_modules';
const out=path.resolve(process.argv[2] || path.join(here,'evidence'));
await mkdir(out,{recursive:true});
const load=relative=>import(pathToFileURL(path.join(dependencies,relative)).href);
const sha=value=>createHash('sha256').update(value).digest('hex');
const rss=()=>process.memoryUsage().rss;
const baselineRSS=rss(), start=performance.now();
const r=await load('replicad/dist/replicad.js');
const {default:initOC}=await load('replicad-opencascadejs/dist/replicad_single.js');
const wasm=await readFile(path.join(dependencies,'replicad-opencascadejs/dist/replicad_single.wasm'));
const oc=await initOC({wasmBinary:wasm,print:()=>{},printErr:()=>{}});r.setOC(oc);
const initializedRSS=rss(), kernelInitializeMs=performance.now()-start;
const report={schemaVersion:1,generatedAt:new Date().toISOString(),purpose:'Offline preparation experiment; not a manufacturing drawing or persistent assembly importer',
 environment:{platform:os.platform(),architecture:os.arch(),cpu:os.cpus()[0].model,physicalMemoryBytes:os.totalmem(),node:process.version},
 tools:{replicad:'1.2.0',replicadGitHead:'6ef8ae10f7cb708ec34c74b37f3be255c3c2dbc8',opencascadePackage:'replicad-opencascadejs@1.1.0',opencascadeGitHead:'e4b05f67dc4e2393a876ce8c5064a9c93db05bf1',wasmSha256:sha(wasm),wasmBytes:wasm.length},
 kernelInitializeMs,baselineRSS,initializedRSS,inputs:[]};

async function measure(id,bytes,source){
 const inputStart=performance.now(),beforeRSS=rss();
 const shape=await r.importSTEP(new Blob([bytes]));
 const importMs=performance.now()-inputStart, bounds=shape.boundingBox.bounds;
 const solids=shape.solids,faces=shape.faces,edges=shape.edges;
 const meshStart=performance.now(),mesh=shape.mesh({tolerance:.006,angularTolerance:.2}),meshMs=performance.now()-meshStart;
 const projectionStart=performance.now(),projection=r.drawProjection(shape,'front'),projectionMs=performance.now()-projectionStart;
 const visible=projection.visible.toSVGPaths().flat(),hidden=projection.hidden.toSVGPaths().flat(),viewBox=projection.visible.toSVGViewBox(.5);
 const maxExtent=Math.max(...bounds[1].map((value,i)=>value-bounds[0][i])),stroke=maxExtent/650;
 const paths=items=>items.map(d=>`<path d="${d}"/>`).join('\n');
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img" aria-label="Derived projection of ${id}; reference only"><title>Derived visible and hidden edges; no dimensions or approval</title><g fill="none" stroke="#9a9a9a" stroke-width="${stroke*.7}" stroke-dasharray="${stroke*5} ${stroke*4}">${paths(hidden)}</g><g fill="none" stroke="#222222" stroke-width="${stroke}">${paths(visible)}</g></svg>`;
 await writeFile(path.join(out,`${id}.svg`),svg);
 await writeFile(path.join(out,`${id}.mesh.json`),JSON.stringify({schemaVersion:1,sourceSha256:sha(bytes),units:'mm',status:'research-derived',vertices:mesh.vertices,triangles:mesh.triangles,faceGroupsAreRuntimeLocal:true,faceGroups:mesh.faceGroups}));
 const secondStart=performance.now(),second=await r.importSTEP(new Blob([bytes])),secondMesh=second.mesh({tolerance:.006,angularTolerance:.2});
 const firstIds=mesh.faceGroups.map(group=>group.faceId),secondIds=secondMesh.faceGroups.map(group=>group.faceId);
 const products=[...bytes.toString('utf8').matchAll(/PRODUCT\s*\(\s*'([^']*)'\s*,\s*'([^']*)'/g)].map(match=>({id:match[1],name:match[2]}));
 const result={id,source,sourceSha256:sha(bytes),sourceBytes:bytes.length,sourceUnitEvidence:bytes.toString('utf8').match(/SI_UNIT\([^;]+METRE[^;]+/g)?.slice(0,4),
 importMs,meshMs,projectionMs,repeatImportAndMeshMs:performance.now()-secondStart,beforeRSS,afterRSS:rss(),shapeType:shape.constructor.name,solidCount:solids.length,faceCount:faces.length,edgeCount:edges.length,
 boundsMm:bounds,mesh:{vertexCount:mesh.vertices.length/3,triangleCount:mesh.triangles.length/3,faceGroupCount:mesh.faceGroups.length},projection:{plane:'front',visiblePathCount:visible.length,hiddenPathCount:hidden.length,svgBytes:Buffer.byteLength(svg)},
 identity:{sourceProducts:products,returnedObjectKeys:Object.keys(shape),returnsOneShape:true,assemblyNamesExposed:false,persistentAssemblyIdentitySupported:false,firstImportFaceIds:firstIds.slice(0,8),secondImportFaceIds:secondIds.slice(0,8),faceIdsIdenticalAcrossRepeatImport:JSON.stringify(firstIds)===JSON.stringify(secondIds)}};
 if(id==='linkrods'){
  const metadata=JSON.parse(await readFile(path.join(repo,'content/models/linkrods/metadata.json')));
  const transformed=[[bounds[0][0]/1000,bounds[0][2]/1000,-bounds[1][1]/1000],[bounds[1][0]/1000,bounds[1][2]/1000,-bounds[0][1]/1000]];
  result.geometryComparison={transform:'[x,y,z] millimeters -> [x,z,-y] meters',preparedModelBounds:metadata.bounds,importedTransformedBounds:transformed,maxAbsoluteBoundDifferenceMeters:Math.max(...transformed.flatMap((row,i)=>row.map((v,j)=>Math.abs(v-metadata.bounds[i][j]))))};
 }
 shape.delete();second.delete();for(const item of [...solids,...faces,...edges])item.delete();
 report.inputs.push(result);return result;
}
await measure('linkrods',await readFile(path.join(repo,'content/drawings/linkrods/linkrods.step')),{kind:'actual-single-solid-source',provenance:'Existing unchanged OCCT linkrods STEP; see content/drawings/linkrods/provenance.json and source license'});
// Original deterministic algorithm fixture, not a customer assembly or paired source.
const a=r.makeBox([0,0,0],[20,10,5]),b=r.makeBox([30,0,0],[40,6,8]);
const fixture=r.exportSTEP([{shape:a,name:'Fixture housing'},{shape:b,name:'Fixture shaft'}],{unit:'MM',modelUnit:'MM'});
const fixtureBytes=Buffer.from(await fixture.arrayBuffer());
await writeFile(path.join(out,'two-solid-algorithm-fixture.step'),fixtureBytes);
await measure('two-solid-algorithm-fixture',fixtureBytes,{kind:'authored-algorithm-fixture',license:'MIT, same as this repository',description:'Two separated named boxes, authored only to test multi-solid import and identity loss. Not a real machine or paired manufacturing dataset.'});a.delete();b.delete();
report.finalRSS=rss();report.processPeakRSSBytes=process.resourceUsage().maxRSS*1024;report.totalMs=performance.now()-start;
report.decision={offlineProjection:'Promising bounded offline derivative only',assemblyImport:'Rejected as a persistent assembly/part identity source: STEPControl_Reader.OneShape aggregates topology and the import result exposes no product/name tree.',buyerKernel:'Excluded from buyer/runtime dependencies and bundles',limitations:['One real single-solid and one explicit algorithm fixture only; not a real multipart assembly validation.','Measurements are a one-shot run on this machine, not ordinary-client hardware certification.','Projection output has no supplied dimensions, tolerances, approval or persistent source-face correspondence.','Runtime face IDs must never enter inquiry or quotation identities.']};
await writeFile(path.join(out,'diagnostics.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
