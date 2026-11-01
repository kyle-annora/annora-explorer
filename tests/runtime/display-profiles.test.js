import test from 'node:test';
import assert from 'node:assert/strict';
import { displayOptions, DISPLAY_DEFAULTS } from '../../src/explorer/display-profiles.js';

test('display preferences reject malformed input and merge partial changes without mutating defaults',()=>{
  const options=displayOptions({lineWeight:'bold',hiddenEdges:true});
  assert.equal(displayOptions({grid:true},options).lineWeight,'bold');
  assert.equal(DISPLAY_DEFAULTS.hiddenEdges,false);assert.equal(options.grid,false);
  for(const input of [null,[],{lineWeight:'heavy'},{hiddenEdges:1},{wireframe:true}])assert.throws(()=>displayOptions(input),TypeError);
});
