import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createDrawingRepository} from '../../../../src/studio/drawing-repository.js';
import {confirmDrawingPairing} from '../../../../src/studio/drawing-domain.js';
const base=JSON.parse(await readFile('content/drawings/sk08/package.json','utf8'));
const metadata=JSON.parse(await readFile('content/models/sk08/metadata.json','utf8'));
const model={id:'sk08',title:'SK08 shaft support',shortTitle:'SK08 shaft support',revision:base.modelRevision,parts:metadata.parts};
const b=structuredClone(base),sha=createHash('sha256').update(await readFile('content/drawings/sk08/demo-revision-b.pdf')).digest('hex');
b.revision='annora-sk08-demo-b-1';b.revisionLabel='Demo B · rearranged discussion sheet';b.mappingRevision='annora-sk08-demo-b-map-1';b.pdfFile='demo-revision-b.pdf';b.assetRevision=sha;
b.statusNote='Fictional document edition B: page 1 preserves the original source; page 2 rearranges the same source views and adds a bore-inspection question. Geometry, fit, tolerances and engineering approval are unchanged or unprovided.';
b.assets=b.assets.map(a=>a.id==='reference-pdf'?{...a,file:'demo-revision-b.pdf',sha256:sha}:a);
b.sheets.forEach(s=>delete s.svgFile);
b.sheets[1].title='Rearranged discussion details · Demo B';
const transforms=(bounds,clip,dest)=>{const scale=Math.min((dest[2]-dest[0])/(clip[2]-clip[0]),(dest[3]-dest[1])/(clip[3]-clip[1]));const x=dest[0]+((dest[2]-dest[0])-(clip[2]-clip[0])*scale)/2;const y=dest[1]+((dest[3]-dest[1])-(clip[3]-clip[1])*scale)/2;return [x+(bounds[0]-clip[0])*scale,y+(bounds[1]-clip[1])*scale,bounds[2]*scale,bounds[3]*scale].map(n=>Math.round(n*1e4)/1e4);};
b.sheets[1].regions=['shaft-bore','cross-bore'].map(id=>{const r=structuredClone(base.sheets[0].regions.find(r=>r.id===id));r.id+='-detail';r.label=id==='shaft-bore'?'Shaft bore · review requested':'Clamp cross-bore · relocated view';r.bounds=id==='shaft-bore'?transforms(r.bounds,[70,320,295,535],[444,156,795,462]):transforms(r.bounds,[350,325,469,520],[48,156,380,462]);r.note='Repositioned vector crop of the same original source. Confirm this new document location for the quoted scope; no geometric change is implied.';return r;});
for(const [label,pkg] of [['a',base],['b',b]]){
 const memory=new Map();let serial=0;const entry={id:'sk08',model,package:pkg};
 const repo=createDrawingRepository({packages:[entry],storage:{getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)},locks:null,now:()=> '2026-11-06T21:00:00.000Z',makeId:p=>`${p}-SK08-IMPACT-${label.toUpperCase()}-${++serial}`});
 let draft=await repo.getDraft('sk08');draft=confirmDrawingPairing(draft,entry,'Prepared public workflow fixture: the unchanged SK08 STEP/model source is paired with the same source PDF vectors. B is the existing fictional layout edition, not an engineering revision or manufacturer approval.');
 draft=await repo.saveDraft(draft);let release=await repo.publishReviewed(await repo.reviewDraft(draft),{confirmed:true});release={...release,source:'bundled',...(label==='b'?{presentationSnapshot:null}:{})};
 await writeFile(`content/drawings/sk08/release-impact-${label}.json`,JSON.stringify(release,null,2)+'\n');
}
console.log('Prepared exact A/B fixture releases; original default package unchanged.');
