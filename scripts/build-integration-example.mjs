import { copyFile, mkdir, readFile, writeFile, cp, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
const root = fileURLToPath(new URL('../', import.meta.url));
const example = resolve(root,'examples/existing-viewer');
await mkdir(resolve(example,'public'),{recursive:true});
await copyFile(resolve(root,'content/models/kinetic-01/model.glb'),resolve(example,'public/model.glb'));
await copyFile(resolve(root,'content/models/kinetic-01/LICENSE.txt'),resolve(example,'public/MODEL-LICENSE.txt'));
// The example resolves the packed distribution, never the repository source tree.
await rm(resolve(example,'node_modules/@annora/integration-kit'),{recursive:true,force:true});
// A rebuilt local tarball keeps its release filename. Invalidate only its npm
// resolution so a previous lock/cache entry cannot reinstall an older artifact.
try {
  const lockPath=resolve(example,'package-lock.json'), lock=JSON.parse(await readFile(lockPath,'utf8'));
  if(lock.packages) delete lock.packages['node_modules/@annora/integration-kit'];
  await writeFile(lockPath,JSON.stringify(lock,null,2)+'\n');
} catch(error) { if(error.code!=='ENOENT') throw error; }
execFileSync('npm',['install','--ignore-scripts','--no-audit','--no-fund'],{cwd:example,stdio:'inherit'});
const expected=await readFile(resolve(root,'dist-integration/package/manifest.json'),'utf8');
const installed=await readFile(resolve(example,'node_modules/@annora/integration-kit/manifest.json'),'utf8');
if(expected!==installed) throw new Error('The host installed a stale integration artifact. Reinstall the current tarball before publication.');
execFileSync('npm',['run','build'],{cwd:example,stdio:'inherit'});
const target=resolve(root,'dist/integrations/existing-viewer');
await rm(target,{recursive:true,force:true});
await cp(resolve(example,'dist'),target,{recursive:true});
await cp(resolve(root,'releases/integration-kit'),resolve(root,'dist/integration-kit'),{recursive:true});
const release=JSON.parse(await readFile(resolve(root,'dist-integration/release.json'),'utf8'));
for(const name of [release.file,'release.json']) await copyFile(resolve(root,'dist-integration',name),resolve(root,'dist/integration-kit',name));
console.log('Independent viewer built from the packed integration kit.');
