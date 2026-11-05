import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleMotionProgress, activeExplanationJoint } from '../../src/explorer/orbital/motion-timing.js';

test('authored holds preserve clip start, midpoint and return; reverse scrubbing is absolute', () => {
  const window = [.14, .86];
  for (const [chapter, clip] of [[0,0],[.14,0],[.5,.5],[.86,1],[1,1],[.5,.5],[.14,0]]) {
    assert.ok(Math.abs(sampleMotionProgress(chapter, window) - clip) < 1e-9);
  }
  assert.equal(sampleMotionProgress(-1, window), 0);
  assert.equal(sampleMotionProgress(2, window), 1);
});
test('existing chapters retain their full clip timing', () => {
  for (const p of [0,.1,.5,.8,1]) assert.equal(sampleMotionProgress(p), p);
});
test('joint explanation follows chapter time and clears during the return', () => {
  const cues = [[0,0],[.32,1],[.5,-1]];
  assert.equal(activeExplanationJoint(.31,cues),0);
  assert.equal(activeExplanationJoint(.32,cues),1);
  assert.equal(activeExplanationJoint(.5,cues),-1);
  assert.equal(activeExplanationJoint(1,cues),-1);
  assert.equal(activeExplanationJoint(.2,cues),0);
  assert.equal(activeExplanationJoint(.2),-1);
});
