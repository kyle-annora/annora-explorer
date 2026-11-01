import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyRoomRelease } from '../scripts/apply-room-release.mjs';
import { BUNDLED_RELEASE, STUDIO_ASSETS, STUDIO_MODEL } from '../src/studio/seed.js';

const studioTest = STUDIO_MODEL ? test : test.skip;

const packet = () => ({
  schemaVersion: 1, kind: 'annora-room-release', release: structuredClone(BUNDLED_RELEASE),
  assetManifest: STUDIO_ASSETS.map(({ id, fileName, type }) => ({ id, fileName, type })),
});
studioTest('reviewed Room export is portable, applies content only and requires explicit replacement', async () => {
  const root = await mkdtemp(join(tmpdir(), 'annora-room-release-'));
  try {
    const first = packet();
    const result = await applyRoomRelease(first, { root });
    assert.equal(result.changed, true);
    const saved = JSON.parse(await readFile(result.target, 'utf8'));
    assert.equal(saved.id, first.release.id);
    assert.equal(saved.source, 'bundled');
    assert.deepEqual(saved.inquiryProfile, first.release.inquiryProfile);
    assert.equal((await applyRoomRelease(first, { root })).changed, false);
    const rewritten = packet(); rewritten.release.content.description = 'Different content with the same released identity.';
    await assert.rejects(applyRoomRelease(rewritten, { root, replace: true }), /new version/);
    const second = packet(); second.release.id += '-next'; second.release.version += 1;
    second.release.content.description = 'A reviewed product introduction for the next content version.';
    await assert.rejects(applyRoomRelease(second, { root }), /--replace/);
    assert.equal(JSON.parse(await readFile(result.target, 'utf8')).id, first.release.id);
    await applyRoomRelease(second, { root, replace: true });
    assert.equal(JSON.parse(await readFile(result.target, 'utf8')).id, second.release.id);
  } finally { await rm(root, { recursive: true, force: true }); }
});

studioTest('Room importer rejects previews and incompatible assets or models without writing a release', async () => {
  const root = await mkdtemp(join(tmpdir(), 'annora-room-release-'));
  try {
    const preview = packet(); preview.release.source = 'preview';
    await assert.rejects(applyRoomRelease(preview, { root }), /Review and confirm/);
    const changedModel = packet(); changedModel.release.modelRevision = 'different-geometry';
    await assert.rejects(applyRoomRelease(changedModel, { root }), /model revision/);
    const missingFile = packet(); missingFile.assetManifest = [];
    await assert.rejects(applyRoomRelease(missingFile, { root }), /missing or incompatible/);
    await assert.rejects(readFile(join(root, 'content/rooms/kinetic-01/release.json')), { code: 'ENOENT' });
  } finally { await rm(root, { recursive: true, force: true }); }
});
