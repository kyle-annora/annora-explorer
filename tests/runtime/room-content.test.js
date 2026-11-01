import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, realpathSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOM_CONTENT, DEFAULT_ROOM_ID } from '../../src/product-room/content.js';
import { MODEL_CATALOG } from '../../src/generated/catalog.js';
import { buildHierarchy } from '../../src/explorer/model-state.js';
import { requestContext } from '../../src/product-room/request-state.js';
import { loadProject } from '../../scripts/lib/project-config.mjs';

const root = new URL('../../', import.meta.url);
const json = url => JSON.parse(readFileSync(url, 'utf8'));
const config = json(new URL('project.config.json', root));
const configured = await loadProject(fileURLToPath(root));
// Sample content remains testable when a template owner enables a third model.
const packages = new Map(Object.values(ROOM_CONTENT).map(room => {
  const manifestURL = new URL(`content/models/${room.modelId}/manifest.json`, root), manifest = json(manifestURL);
  return [manifest.id, {
    manifest,
    metadata: json(new URL(manifest.assets.metadata, manifestURL)),
    tour: manifest.tour ? json(new URL(manifest.tour, manifestURL)) : null
  }];
}));
const facts = room => room.specGroups.flatMap(group => group.facts);
const fact = (room, label) => {
  const matches = facts(room).filter(item => item.label === label);
  assert.equal(matches.length, 1, `${room.id}: one factual entry for ${label}`);
  return matches[0];
};
const highlight = (room, label) => {
  const matches = room.highlights.filter(item => item.label === label);
  assert.equal(matches.length, 1, `${room.id}: one highlight for ${label}`);
  return matches[0].value;
};

test('Product Room samples retain exact package identities without requiring them all to be configured', () => {
  const ids = configured.models.map(model => model.manifest.id).sort();
  assert.deepEqual(Object.keys(MODEL_CATALOG).sort(), ids, 'run prepare:project after changing model configuration');
  assert.ok(MODEL_CATALOG[config.defaultModel]);
  assert.ok(ROOM_CONTENT[DEFAULT_ROOM_ID]);
  for (const [id, room] of Object.entries(ROOM_CONTENT)) {
    assert.equal(room.id, id);
    assert.equal(room.modelId, packages.get(id).manifest.id);
    assert.equal(room.title, packages.get(id).manifest.title);
    assert.ok(room.roomRevision, `${id}: published content needs a room revision`);
    if (MODEL_CATALOG[id]) assert.notEqual(room.roomRevision, MODEL_CATALOG[id].revision, 'editorial and prepared-model revisions have different meanings');
  }
});

test('enabled Room products use the current configured package revision for request context', () => {
  for (const prepared of configured.models) {
    const model = MODEL_CATALOG[prepared.manifest.id];
    assert.equal(model.revision, prepared.revision, 'model bytes or authored policies changed without regenerating the catalog');
    const room = ROOM_CONTENT[model.id];
    if (!room) continue;
    assert.equal(model.packageId, room.modelId);
    const context = requestContext({
      productId: room.id, productTitle: room.title,
      modelId: model.id, modelRevision: model.revision,
      document: { id: room.documents[0].id, title: room.documents[0].title }
    });
    assert.equal(context.productId, room.id);
    assert.equal(context.modelId, prepared.manifest.id);
    assert.equal(context.modelRevision, model.revision);
  }
});

for (const [id, room] of Object.entries(ROOM_CONTENT)) {
  test(`${id}: every buyer question, technical reference and document points to its own live model package`, () => {
    const { metadata, manifest, tour } = packages.get(id), model = MODEL_CATALOG[id];
    const { nodes } = buildHierarchy(metadata, manifest.presentationPolicy);
    const checkNode = nodeId => assert.ok(nodes.has(nodeId), `${id}: unknown visible part ${nodeId}`);
    assert.equal(new Set(room.questions.map(question => question.id)).size, room.questions.length, 'question links must be unambiguous');
    for (const question of room.questions) {
      assert.ok(question.title && question.actionLabel, `${id}: a question needs a label and action`);
      if (question.target.kind === 'part') checkNode(question.target.nodeId);
      else {
        assert.equal(question.target.kind, 'chapter', `${id}: unsupported question action`);
        assert.equal(question.target.tourId, tour?.id, 'buyer questions cannot jump to another product tour');
        const sourceChapter = tour.chapters.find(chapter => chapter.id === question.target.chapterId);
        assert.ok(sourceChapter, `${id}: chapter is absent from authored tour`);
        if (model) {
          const publishedChapter = model.tour?.chapters.find(chapter => chapter.id === question.target.chapterId);
          assert.ok(publishedChapter, `${id}: chapter is absent from generated catalog`);
          assert.deepEqual(publishedChapter, sourceChapter, 'Room must open the authored explanation rather than a stale generated chapter');
        }
        if (sourceChapter.scopeId) checkNode(sourceChapter.scopeId);
        if (sourceChapter.selectedId) checkNode(sourceChapter.selectedId);
      }
    }
    for (const item of facts(room)) {
      assert.ok(item.label && item.value && item.source, `${id}: claims need a value and source`);
      if (item.nodeId) checkNode(item.nodeId);
    }
    for (const document of room.documents) if (document.nodeId) checkNode(document.nodeId);
  });

  test(`${id}: buyer-facing source identity is the same as the model provenance`, () => {
    const { manifest } = packages.get(id);
    assert.equal(room.source.url, manifest.provenance.url);
    assert.equal(room.source.author, manifest.provenance.author);
    assert.equal(room.source.license, manifest.provenance.license);
    if (MODEL_CATALOG[id]) assert.equal(MODEL_CATALOG[id].sourceUrl, room.source.url);
    assert.match(room.demoNotice, /sample/i);
    assert.match(room.demoNotice, /illustrati/i);
    assert.match(room.demoNotice, /specifications/i);
  });

  test(`${id}: technical briefs are real local English sample documents with traceable sources`, () => {
    assert.ok(room.documents.length > 0);
    assert.equal(new Set(room.documents.map(document => document.id)).size, room.documents.length);
    for (const document of room.documents) {
      const url = new URL(document.url), file = realpathSync(fileURLToPath(url));
      assert.equal(url.protocol, 'file:', 'build input must be a local document, not an external download');
      assert.equal(dirname(file), resolve(fileURLToPath(root), 'product-room/files'));
      assert.equal(basename(file), document.fileName);
      const html = readFileSync(file, 'utf8');
      assert.equal(document.type, 'HTML');
      assert.equal(document.sample, true);
      assert.match(html, /<html\s+lang="en"/i);
      assert.match(html, /SAMPLE DOCUMENT/);
      assert.ok(html.includes(document.title));
      assert.ok(html.includes(document.revision));
      assert.ok(html.includes(room.source.url), 'download retains its source link independently of the Room');
      for (const author of room.source.author.split(' / ')) assert.ok(html.includes(author), `missing author credit: ${author}`);
      assert.match(html, /not (?:a )?manufacturer|not mechanically verified|does not supply.*specifications/i);
      assert.doesNotMatch(html, /[\u3400-\u9fff]/, 'client delivery remains English');
      assert.doesNotMatch(html, /<(?:iframe|script|img)\b|<link\b[^>]*rel=["']stylesheet/i, 'brief remains self-contained and cannot load external assets or telemetry');
    }
  });
}

test('Kinetic geometry and viewing cadence remain distinct and agree with prepared source data', () => {
  const room = ROOM_CONTENT['kinetic-01'], { metadata, manifest, tour } = packages.get(room.modelId);
  for (const [label, key] of [['Carriage stroke', 'sliderStrokeMm'], ['Crank radius', 'crankRadiusMm'], ['Rod pin spacing', 'rodPinSpacingMm']]) {
    assert.equal(fact(room, label).value, `${metadata.dimensions[key]} mm`);
  }
  assert.equal(highlight(room, 'Model stroke'), `${metadata.dimensions.sliderStrokeMm} mm`);
  assert.equal(highlight(room, 'Main assemblies'), String(metadata.groups.length));
  assert.equal(highlight(room, 'Preview cycle'), `${manifest.presentationPolicy.actionDuration} s`);
  assert.equal(fact(room, 'Prepared components').value, String(metadata.stats.meshCount));
  assert.equal(fact(room, 'Source animation duration').value, `${metadata.operation.duration} seconds`);
  assert.match(fact(room, 'Source animation duration').note, /Neither duration specifies a real machine operating rate/);
  assert.equal(tour.chapters.find(chapter => chapter.id === 'motion').operation.sourceDuration, metadata.operation.duration);
  if (MODEL_CATALOG[room.modelId]) assert.equal(MODEL_CATALOG[room.modelId].operationClipId, metadata.operation.clipName);
  assert.match(room.source.note, /not manufacturer CAD|procedural mechanism study/i);
});

test('Apollo counts follow the source hierarchy and do not promise unsupported mechanical operation', () => {
  const room = ROOM_CONTENT.apollo, { metadata, manifest, tour } = packages.get(room.modelId);
  const latches = metadata.groups.find(group => group.id === 'latches');
  const example = latches.children.find(node => node.id === fact(room, 'Parts in example latch').nodeId);
  assert.equal(fact(room, 'Main navigation groups').value, String(metadata.groups.length));
  assert.equal(fact(room, 'Perimeter latch assemblies').value, String(latches.children.length));
  assert.equal(fact(room, 'Parts in example latch').value, String(example.meshNames.length));
  assert.equal(fact(room, 'Prepared components').value, String(metadata.stats.meshCount));
  assert.equal(highlight(room, 'Prepared components'), String(metadata.stats.meshCount));
  assert.equal(highlight(room, 'Latch assemblies'), String(latches.children.length));
  assert.equal(highlight(room, 'Main groups'), String(metadata.groups.length));
  assert.equal(fact(room, 'Short presentation actions').value, `${manifest.presentationPolicy.actionDuration} seconds`);
  assert.equal(metadata.operation, undefined);
  if (MODEL_CATALOG.apollo) assert.equal(MODEL_CATALOG.apollo.capabilities.operation, false);
  assert.ok(tour.chapters.every(chapter => !chapter.operation));
  assert.equal(fact(room, 'Operating animation').value, 'Not supplied');
  assert.match(fact(room, 'Operating animation').note, /not mechanically verified/);
  assert.match(room.source.note, /does not imply endorsement/);
  assert.match(room.source.note, /rather than a manufacturer parts list/);
  const briefText = readFileSync(new URL(room.documents[0].url), 'utf8').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
  assert.match(briefText, /Mechanically verified operating animation Not supplied/i);
});

test('each Product Room ships its own distinct technical brief', () => {
  const documents = Object.values(ROOM_CONTENT).flatMap(room => room.documents);
  assert.equal(documents.length, 2);
  assert.equal(new Set(documents.map(document => realpathSync(fileURLToPath(document.url)))).size, 2);
});
