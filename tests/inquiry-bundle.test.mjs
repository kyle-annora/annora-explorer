import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { build } from 'vite';
import config from '../vite.inquiry.config.js';
import { assertInquiryModules } from '../scripts/lib/inquiry-build.mjs';

test('client inquiry builds independently without sample assets, renderer, PDF runtime, or Studio UI',async()=>{
  const result=await build({...config,configFile:false,logLevel:'silent',build:{...config.build,write:false}});
  const outputs=(Array.isArray(result)?result[0]:result).output,chunk=outputs.find(item=>item.fileName==='inquiry.js');
  assert.ok(chunk);assert.ok(chunk.exports.includes('mountEmbeddedInquiry'));assert.ok(chunk.exports.includes('createInquirySession'));
  assert.ok(chunk.exports.includes('normalizeInspectionReference'));
  assertInquiryModules(Object.keys(chunk.modules));
  assert.ok(chunk.imports.every(id=>/^(react|react-dom)(\/|$)/.test(id)));
  assert.deepEqual(outputs.map(item=>item.fileName).sort(),['LICENSES.txt','inquiry.css','inquiry.js','manifest.json']);
  const manifest=JSON.parse(outputs.find(item=>item.fileName==='manifest.json').source);
  assert.equal(manifest.assetsIncluded,false);assert.match(manifest.sourceTreeSha256,/^[a-f0-9]{64}$/);
  assert.equal(manifest.external.react,'19.3.1');
  for(const artifact of manifest.outputs) {
    const output=outputs.find(item=>item.fileName===artifact.file);
    assert.equal(artifact.sha256,createHash('sha256').update(output.type==='chunk'?output.code:output.source).digest('hex'));
  }
  assert.equal(manifest.outputs.length,2);
  assert.ok(manifest.sources.some(item=>item.path==='src/product-room/inquiry-session.js'));
});

test('asset boundary rejects renderer and customer/product package imports',()=>{
  for(const id of ['/repo/content/models/customer/model.glb','/repo/src/generated/catalog.js','/repo/node_modules/three/src/Three.js','/repo/node_modules/pdfjs-dist/build/pdf.mjs','/repo/src/studio/app.jsx'])
    assert.throws(()=>assertInquiryModules([id]),/asset-free boundary/);
});
