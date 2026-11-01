import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TourPlayer } from '../../src/explorer/tour-player.js';
import { sampleTour } from '../../src/explorer/tour-content.js';

const tour = JSON.parse(readFileSync(new URL('../../content/models/kinetic-01/motion-study.json', import.meta.url)));
function advance(player, seconds) {
  player.tick(0);
  for (let ms = 100; ms <= seconds * 1000 + 100; ms += 100) player.tick(ms);
}

test('a single action stops at the exact endpoint and cannot advance itself', () => {
  const player = new TourPlayer(tour, { pauseAtChapterEnd: true });
  player.start(); advance(player, 3);
  assert.equal(player.time, 2.5);
  assert.equal(player.state().index, 0);
  assert.equal(player.status, 'paused');
  assert.equal(player.reason, 'chapter-end');
  player.tick(7000);
  assert.equal(player.time, 2.5);
  const end = sampleTour(tour, player.time, { chapterIndex: player.state().index });
  assert.equal(end.operationProgress, 1);
  assert.equal(end.explosion, 0);
  assert.equal(end.chapterId, 'motion');
});

test('replay restarts the held action instead of advancing into the next view', () => {
  const player = new TourPlayer(tour, { pauseAtChapterEnd: true });
  player.seek(2.5); player.resume(); advance(player, 3);
  assert.equal(player.state().index, 1);
  assert.equal(player.time, 5);
  assert.equal(sampleTour(tour, player.time, { chapterIndex: 1 }).explosion, .58);
  player.resume();
  assert.equal(player.time, 2.5);
  assert.equal(player.state().index, 1);
  assert.equal(player.status, 'playing');
});

test('backward scrubbing samples exact source phases without accumulated transforms', () => {
  for (const phase of [1, .75, .25, 0, .5, 1, 0]) {
    const frame = sampleTour(tour, phase * 2.5, { chapterIndex: 0 });
    assert.equal(frame.operationProgress, phase);
    assert.equal(frame.explosion, 0);
    assert.deepEqual(frame.camera.direction, [0.12, 1.7, 1.15]);
  }
});

test('final restore is exact and a replay remains possible at the final boundary', () => {
  const player = new TourPlayer(tour, { pauseAtChapterEnd: true });
  player.seek(5); player.resume(); advance(player, 3);
  assert.equal(player.state().index, 2);
  assert.equal(player.time, 7.5);
  const frame = sampleTour(tour, player.time, { chapterIndex: 2 });
  assert.equal(frame.explosion, 0);
  assert.equal(frame.operationProgress, null);
  player.resume(); assert.equal(player.time, 5); assert.equal(player.status, 'playing');
});

test('pause preserves phase and background time never skips a short action', () => {
  const player = new TourPlayer(tour, { pauseAtChapterEnd: true });
  player.start(); player.tick(0); player.tick(750); player.pause();
  assert.equal(player.time, .75); player.tick(900); assert.equal(player.time, .75);
  player.resume(); player.tick(1200); player.tick(91200); assert.equal(player.time, .75);
  player.tick(91450); assert.equal(player.time, 1);
});

test('normal tours retain their continuous playback and boundary selection', () => {
  const player = new TourPlayer(tour);
  player.start(); advance(player, 3);
  assert.equal(player.status, 'playing');
  assert.equal(player.state().index, 1);
  assert.equal(sampleTour(tour, 2.5).chapterId, 'inside');
});
