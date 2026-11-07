/** Verify the public deployment against the reviewed build, without browser state. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname,posix} from 'node:path';
const base=new URL(process.env.BASE_URL||'https://kyle-annora.github.io/annora-explorer/');
const expected=process.env.EXPECTED_COMMIT;
assert.ok(expected,'Set EXPECTED_COMMIT to the published application commit.');
const out=resolve(process.env.OUT||'work/commercial-polish/public-target.json');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const routes=['index.html','walkthrough/index.html','product-room/index.html','studio/index.html','integrations/existing-viewer/index.html','integration-kit/release.json'];
const seen=new Set(), pending=[...routes], results=[];
function normalizedHTML(html){return JSON.stringify({body:html.replace(/<link\b[^>]*>/gi,'').replace(/\s+/g,' ').trim(),links:[...html.matchAll(/<link\b[^>]*>/gi)].map(m=>m[0]).sort()});}
function dependencies(text,path){
  const refs=path.endsWith('.html')?[...text.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css))["']/g)].map(m=>m[1]):path.endsWith('.js')?[...text.matchAll(/["']((?:\.{1,2}\/)?[^"'\s]+\.(?:js|css))["']/g)].map(m=>m[1]):[];
  return refs.flatMap(ref=>{// Vite's PDF asset map also contains source module keys, not fetch URLs.
    if(/^https?:|^data:|^\/node_modules\//.test(ref))return[];const result=posix.normalize(posix.join(posix.dirname(path),ref));return result.startsWith('../')?[]:[result];});
}
async function inspect(path){
  const record={path};results.push(record);
  try{
    const local=await readFile(resolve('dist',path));
    const response=await fetch(new URL(path,base),{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(45000)});
    record.httpStatus=response.status;assert.ok(response.ok,`HTTP ${response.status}`);
    const remote=Buffer.from(await response.arrayBuffer());
    record.localSha256=hash(local);record.publicSha256=hash(remote);record.bytes=remote.length;
    record.identical=local.equals(remote);
    if(path.endsWith('.html'))record.sameDocumentAndLinkSet=normalizedHTML(local.toString())===normalizedHTML(remote.toString());
    assert.ok(record.identical||record.sameDocumentAndLinkSet,`${path} differs from the reviewed build`);
    if(path==='integration-kit/release.json'){
      const release=JSON.parse(remote);assert.equal(release.sourceRevision,expected);record.sourceRevision=release.sourceRevision;
      pending.push('integration-kit/'+release.file);
    }
    pending.push(...dependencies(local.toString(),path));record.status='passed';
  }catch(error){record.status='failed';record.error=error.message;}
}
while(pending.length){const batch=[];while(pending.length&&batch.length<6){const path=pending.shift();if(!seen.has(path)){seen.add(path);batch.push(path);}}await Promise.all(batch.map(inspect));}
const failed=results.filter(r=>r.status!=='passed');const result={capturedAt:new Date().toISOString(),expectedCommit:expected,base:String(base),status:failed.length?'failed':'passed',checks:results.length,results};
await mkdir(dirname(out),{recursive:true});await writeFile(out,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({status:result.status,checks:results.length,failed},null,2));if(failed.length)process.exitCode=1;
