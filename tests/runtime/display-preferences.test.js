import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDisplayPreferences, readDisplayPreferences, writeDisplayPreferences } from '../../src/explorer/display-preferences.js';

test('new visitors get an engineering reference grid and independent clean linework defaults', () => {
  assert.deepEqual(normalizeDisplayPreferences(),{appearance:'light',grids:{engineering:true,linework:false,flat:false}});
});
test('visitor display preferences reject invalid mode and grid values without touching input', () => {
  const source={appearance:'css(red)',grids:{engineering:'false',linework:true,flat:0},project:{id:'private'}};
  assert.deepEqual(normalizeDisplayPreferences(source),{appearance:'light',grids:{engineering:true,linework:true,flat:false}});
  assert.equal(source.grids.engineering,'false');
});
test('display preference persistence is isolated and unavailable storage remains optional', () => {
  const values=new Map([['projects','unchanged']]);
  const store={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};
  const expected={appearance:'dark',grids:{engineering:false,linework:true,flat:false}};
  writeDisplayPreferences(store,'display',expected);
  assert.deepEqual(readDisplayPreferences(store,'display'),expected);
  assert.equal(values.get('projects'),'unchanged');
  assert.equal(readDisplayPreferences(store,'display',new URLSearchParams('appearance=light')).appearance,'light');
  assert.equal(readDisplayPreferences(store,'display',new URLSearchParams('appearance=invalid')).appearance,'dark');
  assert.deepEqual(readDisplayPreferences(undefined,'display'),normalizeDisplayPreferences());
  assert.deepEqual(writeDisplayPreferences(undefined,'display',expected),expected);
});
test('malformed saved JSON cannot prevent the viewer opening', () => {
  assert.deepEqual(readDisplayPreferences({getItem:()=>'{broken'},'display'),normalizeDisplayPreferences());
});
