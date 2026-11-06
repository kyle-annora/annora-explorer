import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { relative, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

export function assertInquiryModules(ids) {
  const prohibited = ids.filter(value => {
    const id = value.replaceAll('\\','/');
    return /\/(content|src\/generated)\//.test(id) || /\/node_modules\/(three|pdfjs-dist)\//.test(id)
      || /\/src\/studio\//.test(id) && !id.endsWith('/src/studio/value.js')
      || /\/src\/explorer\//.test(id) && !/\/(inspection-reference|display-profiles)\.js$/.test(id);
  });
  if (prohibited.length) throw new Error(`Inquiry bundle crossed its asset-free boundary:\n${prohibited.join('\n')}`);
}

export function inquiryBuildBoundary(root) {
  return {
    name:'inquiry-asset-boundary', enforce:'post',
    async generateBundle(_options,bundle) {
      const ids = [...this.getModuleIds()].filter(id=>!id.startsWith('\0'));
      assertInquiryModules(ids);
      const sourceIds = ids.filter(id=>id.startsWith(resolve(root,'src')+'/')).sort();
      const sources = await Promise.all(sourceIds.map(async id=>({path:relative(root,id),sha256:createHash('sha256').update(await readFile(id)).digest('hex')})));
      const packages = new Map();
      for (const id of ids) {
        const match = id.replaceAll('\\','/').match(/^(.*\/node_modules\/(?:@[^/]+\/)?[^/]+)\//);
        if (match) packages.set(match[1],true);
      }
      const notices = [await readFile(resolve(root,'LICENSE'),'utf8')];
      const dependencies = [];
      for (const directory of [...packages.keys()].sort()) {
        const info=JSON.parse(await readFile(resolve(directory,'package.json'),'utf8'));
        dependencies.push({name:info.name,version:info.version});
        let license;
        for (const file of ['LICENSE','LICENSE.md','LICENSE.txt','license']) {
          try { license=await readFile(resolve(directory,file),'utf8');break; } catch(error) { if(error.code!=='ENOENT')throw error; }
        }
        if (!license) throw new Error(`Missing redistribution notice for ${info.name}.`);
        notices.push(`${info.name} ${info.version}\n\n${license}`);
      }
      const assets = Object.values(bundle).filter(item=>item.type==='asset');
      if (assets.some(item=>!item.fileName.endsWith('.css'))) throw new Error('The inquiry library must contain no model, document or media assets.');
      const outputs = Object.values(bundle).map(item=>({file:item.fileName,sha256:createHash('sha256').update(item.type==='chunk'?item.code:item.source).digest('hex')}));
      const project=JSON.parse(await readFile(resolve(root,'package.json'),'utf8'));
      let sourceRevision=null;
      try { sourceRevision=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim(); } catch { /* Source archives are identified by the source tree digest. */ }
      this.emitFile({type:'asset',fileName:'LICENSES.txt',source:notices.join('\n\n---\n\n')});
      this.emitFile({type:'asset',fileName:'manifest.json',source:JSON.stringify({format:'annora-inquiry-bundle-v1',
        sourceRevision,sourceTreeSha256:createHash('sha256').update(JSON.stringify(sources)).digest('hex'),sources,dependencies,
        external:{react:project.dependencies.react,'react-dom':project.dependencies['react-dom']},outputs,assetsIncluded:false},null,2)+'\n'});
    },
  };
}
