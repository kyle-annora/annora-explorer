import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { matchesTechnicalSource } from '../src/drawing-preview/technical-policy.js';

const root = new URL('../content/drawings/sk08/', import.meta.url);
const read = name => fs.readFileSync(new URL(name, root), 'utf8');
const source = JSON.parse(read('package.json'));
const profile = JSON.parse(read('technical-front.json'));

test('prepared technical view is confined to its exact source, model and association edition', () => {
  assert.equal(matchesTechnicalSource(source, source), true);
  assert.equal(matchesTechnicalSource(source, source, true), false);
  for (const key of ['id', 'revision', 'modelRevision', 'mappingRevision']) {
    assert.equal(matchesTechnicalSource({ ...source, [key]: 'different' }, source), false, key);
  }
  for (const mutate of [
    value => { value.assets[0].sha256 = 'replacement PDF'; },
    value => { value.assets[1].sha256 = 'replacement reference'; },
    value => { value.sheets[0].regions[1].bounds[0] += 1; },
    value => { value.sheets[0].regions[1].partId = 'another-part'; },
    value => { value.sheets[0].regions[1].mappingStatus = 'needs-review'; },
    value => { value.sheets[0].rotation = 90; },
    value => { value.sheets[0].pdfPage = 2; },
  ]) {
    const changed = structuredClone(source);
    mutate(changed);
    assert.equal(matchesTechnicalSource(changed, source), false);
  }
});

test('derived source hashes and canonical bore link remain independently verifiable', () => {
  const hash = name => crypto.createHash('sha256').update(fs.readFileSync(new URL(name, root))).digest('hex');
  assert.equal(profile.sourceSha256, hash('source.pdf'));
  assert.equal(profile.sourceStepSha256, hash('sk08.step'));
  const sheet = source.sheets.find(item => item.id === profile.canonical.sheetId);
  const bore = sheet.regions.find(item => item.id === profile.canonical.regionId);
  assert.deepEqual(profile.canonical.bounds, bore.bounds);
  assert.equal(profile.regions[0].partId, bore.partId);
  const svg = read('technical-front.svg');
  assert.doesNotMatch(svg, /<(?:image|script|foreignObject)\b/);
  assert.ok(svg.includes('data-layer="contour"'));
  for (const path of profile.featureOutlinePathIds) assert.ok(svg.includes(`id="${path}"`));
});
