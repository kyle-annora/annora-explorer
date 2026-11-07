import test from 'node:test';
import assert from 'node:assert/strict';
import { sellerProjectStatus } from '../../src/product-room/project-state.js';

const question = (id, kind, blocking = true) => ({id, blocking, events:[{kind}]});
const project = questions => ({questions,quotes:[],messages:[],changes:[],nextSteps:[]});

test('independent question ownership prioritizes scope blockers without losing another pending question', () => {
  const record=project([question('rod','clarification'),question('guide','opened')]);
  assert.deepEqual(sellerProjectStatus(record), {label:'2 scope questions open',next:'Reply to each question and review its resolution',owner:'Seller',filter:'attention',questionId:'guide'});
  record.questions[1]=question('guide','resolved');
  assert.equal(sellerProjectStatus(record).owner,'Customer');
  assert.equal(sellerProjectStatus(record).questionId,'rod');
  assert.equal(sellerProjectStatus(record).label,'1 scope question open');
});

test('an answer still needs reviewed resolution; informational discussion stays visible', () => {
  const record=project([question('rod','answer'),question('guide','opened',false)]);
  assert.equal(sellerProjectStatus(record).label,'1 scope question open');
  record.questions[0]=question('rod','resolved');
  assert.equal(sellerProjectStatus(record).label,'1 question open');
  assert.equal(sellerProjectStatus(record).questionId,'guide');
});

test('resolved evidence needs a new quotation review only until its exact snapshot is issued', () => {
  const record=project([question('rod','resolved')]);
  assert.equal(sellerProjectStatus(record).label,'Questions resolved');
  record.quotes=[{id:'quote-v1',version:1,questionScope:{questions:structuredClone(record.questions)}}];
  assert.equal(sellerProjectStatus(record).label,'Quotation ready');
  record.questions[0].events.push({kind:'reopened'});
  assert.equal(sellerProjectStatus(record).label,'1 scope question open');
  assert.equal(record.quotes[0].questionScope.questions[0].events.length,1);
});
