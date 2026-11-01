import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TourPlayer } from '../../src/explorer/tour-player.js';
import { sampleTour } from '../../src/explorer/tour-content.js';
import { SeparationPlayer } from '../../src/explorer/separation-player.js';

const read = model => JSON.parse(readFileSync(new URL(`../../content/models/${model}/tour.json`, import.meta.url)));
const near = (a,b) => assert.ok(Math.abs(a-b)<1e-7, `${a} != ${b}`);
const advance = player => { player.tick(0); for(let t=100;t<=2600;t+=100) player.tick(t); };

for (const model of ['kinetic-01','apollo']) {
  const tour = read(model);
  test(`${model}: every short step holds its own exact endpoint without auto-advancing`, () => {
    const player = new TourPlayer(tour);
    for (let index=0;index<tour.chapters.length;index++) {
      const chapter=tour.chapters[index];
      assert.ok(chapter.duration>=2&&chapter.duration<=3);
      player.seek(chapter.start);player.resume();advance(player);
      const state=player.state();assert.equal(state.index,index);assert.equal(state.status,'paused');near(state.time,chapter.end);
      const end=sampleTour(tour,state.time,{chapterIndex:state.index});near(end.explosion,chapter.explosion[1]);
      player.tick(9000);near(player.time,chapter.end);
      player.resume();near(player.time,chapter.start);
    }
  });
  test(`${model}: exact local endpoint seeks and reverse scrubs are deterministic`, () => {
    const player=new TourPlayer(tour);
    for(let index=0;index<tour.chapters.length;index++) {
      const chapter=tour.chapters[index];
      const samples=[0,.1,.25,.5,.9,1].map(t=>sampleTour(tour,chapter.start+t*chapter.duration,{chapterIndex:index}));
      for(let i=samples.length-1;i>=0;i--) assert.deepEqual(sampleTour(tour,samples[i].time,{chapterIndex:index}),samples[i]);
      player.seek(chapter.end,{chapterIndex:index});assert.equal(player.state().index,index);
      assert.equal(player.state().status,'paused');
    }
    const final=sampleTour(tour,tour.duration);
    assert.equal(final.explosion,0);assert.equal(final.renderStyle,'engineering');
    assert.equal(final.scopeId,tour.chapters[0].scopeId);
  });
}

test('the crank runs one complete source cycle in 2.5 seconds with a fixed camera', () => {
  const tour=read('kinetic-01'),chapter=tour.chapters.find(c=>c.operation),camera=chapter.camera;
  assert.equal(chapter.operation.sourceDuration,4);
  for(const progress of [0,.1,.25,.5,.75,1]) {
    const frame=sampleTour(tour,chapter.start+progress*2.5,{chapterIndex:tour.chapters.indexOf(chapter)});
    near(frame.operationProgress,progress);assert.deepEqual(frame.camera,camera);assert.equal(frame.explosion,0);
  }
});

test('Apollo scopes change only after reassembly and never invent operating motion', () => {
  const chapters=read('apollo').chapters;
  for(let i=0;i<chapters.length;i++) {
    assert.equal(chapters[i].operation,undefined);
    if(i&&chapters[i-1].scopeId!==chapters[i].scopeId) assert.equal(chapters[i-1].explosion[1],0);
  }
});

test('separation and restoration each stop exactly at 2.5 seconds and replay their direction', () => {
  const player=new SeparationPlayer();
  for(const [from,to] of [[0,1],[1,0],[.35,1]]) {
    player.start(from,to);advance(player);
    near(player.state().value,to);near(player.time,2.5);assert.equal(player.playing,false);
    player.play({once:true});near(player.state().value,from);assert.equal(player.playing,true);
  }
});

test('separation pause, backwards scrub and resume preserve exact position', () => {
  const player=new SeparationPlayer();player.start(1,0);player.tick(0);player.tick(500);
  const before=player.state().value;player.pause();player.tick(8000);near(player.state().value,before);
  for(const value of [0,.75,1,.25,0]) {player.seekValue(value);near(player.state().value,value);assert.equal(player.playing,false);}
  player.seekValue(.4);player.play({once:true,restart:false});player.tick(10000);near(player.state().value,.4);
  player.tick(10100);assert.ok(player.state().value<.4);
  player.clear(.4);assert.equal(player.state().available,false);assert.equal(player.playing,false);
});
