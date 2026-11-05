import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Vector3 } from 'three';
import { createModelAction } from '../../src/explorer/orbital/model-action.js';

const base = new URL('../../content/models/hexapod/', import.meta.url);
const [bytes, metadata, guide] = await Promise.all([
  readFile(new URL('model.glb',base)),
  readFile(new URL('metadata.json',base),'utf8').then(JSON.parse),
  readFile(new URL('spatial-guide.json',base),'utf8').then(JSON.parse),
]);
const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');

test('Hexapod diagram uses actual joint pivots and a stable rest pose through holds, rewind and chapter return', () => {
  const action = createModelAction(gltf,metadata,guide,'#ff6840');
  try {
    action.setChapter('leg');
    const initial = action.explanationFrame();
    const rest = structuredClone(initial.restPoints);
    assert.equal(initial.points.length,3);
    assert.deepEqual(initial.points,rest);
    assert.equal(initial.trace.length,91);
    for (const progress of [0,.14,.25,.32,.5,.75,.86,1,.25]) {
      action.setProgress(progress);
      const frame = action.explanationFrame();
      assert.deepEqual(frame.restPoints,rest);
      for (const [i,name] of ['HexJoint_leg_1_femur','HexJoint_leg_1_tibia'].entries()) {
        const point = gltf.scene.getObjectByName(name).getWorldPosition(new Vector3());
        assert.deepEqual(frame.points[i],gltf.scene.worldToLocal(point).toArray());
      }
      if (progress === .5) assert.ok(frame.points[2][1] > rest[2][1] + .03,'shown foot lifts over30mm in native units');
      if (progress === 1 || progress === 0) assert.ok(frame.points[2].every((n,i)=>Math.abs(n-rest[2][i])<1e-7));
    }
    action.setChapter('electronics');
    assert.equal(action.explanationFrame(),null);
    action.setChapter('leg');
    action.setProgress(.65);
    assert.deepEqual(action.explanationFrame().restPoints,rest);
  } finally { action.dispose(); }
});
