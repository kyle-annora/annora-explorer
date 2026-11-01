import test from 'node:test';
import assert from 'node:assert/strict';
import { displayOptions, DISPLAY_DEFAULTS } from '../../src/explorer/display-profiles.js';

test('display preferences reject malformed input and merge partial changes without mutating defaults',()=>{
  const options=displayOptions({lineWeight:'bold',hiddenEdges:true});
  assert.equal(displayOptions({grid:true},options).lineWeight,'bold');
  assert.equal(DISPLAY_DEFAULTS.hiddenEdges,false);assert.equal(options.grid,false);
  for(const input of [null,[],{lineWeight:'heavy'},{hiddenEdges:1},{wireframe:true}])assert.throws(()=>displayOptions(input),TypeError);
});


test('appearance is a validated independent preference and partial patches retain its state',()=>{
  const dark=displayOptions({appearance:'dark',grid:true});
  assert.equal(displayOptions({lineWeight:'bold'},dark).appearance,'dark');
  assert.equal(displayOptions({appearance:'light'},dark).grid,true);
  for(const appearance of [true,null,'auto','LIGHT',{},[]])assert.throws(()=>displayOptions({appearance}),TypeError);
});
