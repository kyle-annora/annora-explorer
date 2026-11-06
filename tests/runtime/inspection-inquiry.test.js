import test from 'node:test';
import assert from 'node:assert/strict';
import { requestContext } from '../../src/product-room/request-state.js';
import { createInquiryDraft, normalizeInquiryDraft, reviewInquiry, quoteScopeLabel, reviewRevision, reviewNextStep } from '../../src/product-room/project-domain.js';
import { createDemoProjectRepository, PROJECT_STORAGE_KEY } from '../../src/product-room/project-repository.js';
import { reviewQuote, reviewReply, reviewCustomerReply } from '../../src/product-room/seller-domain.js';
import { sampleInquiryValues } from '../../src/product-room/project-fixtures.js';

const model = { id: 'kinetic-01', revision: 'kinetic-r1' };
const inspection = {
  version: '1', model,
  view: { viewVersion: '0.1', model, coordinateFrame: 'normalized-assembly-v1', selectedId: 'rod', scopeId: 'root', isolated: true,
    mode: 'explore', renderStyle: 'engineering', displayOptions: { appearance: 'light', grid: false, ambientOcclusion: true, featureEdges: true, hiddenEdges: false, lineWeight: 'standard' }, separation: 0, operation: null,
    camera: { position: [2,3,8], target: [0,0,0], up: [0,1,0], projection: {kind:'perspective',verticalFovDegrees:42,zoom:1,offsetX:0,offsetY:0}, viewport: {width:1200,height:800} } },
  preview: { dataUrl: 'data:image/png;base64,iVBORw0KGgo=', width:480, height:320 }
};
const context = { productId:model.id, productTitle:'Crank-slider mechanism', modelId:model.id, modelRevision:model.revision, part:{id:'rod',title:'Connecting rod'}, inspection };
function setup() {
  const data = new Map(), storage = {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};
  let serial = 0;
  return { storage, repo:createDemoProjectRepository({storage,locks:null,makeId:prefix=>`${prefix}-${++serial}`,now:()=> '2026-11-05T12:00:00.000Z'}) };
}

test('saved inspection is cloned and must match the exact inquiry model revision', () => {
  const normalized = requestContext(context);
  assert.deepEqual(normalized.inspection, inspection);
  normalized.inspection.view.camera.position[0] = 99;
  assert.equal(inspection.view.camera.position[0], 2);
  assert.throws(() => requestContext({...context,modelRevision:'kinetic-r2'}), {code:'INCOMPATIBLE_VIEW'});
  assert.throws(() => requestContext({...context,inspection:{...inspection,preview:{...inspection.preview,dataUrl:'https://example.com/image.png'}}}), {code:'INVALID_ARGUMENT'});
});

test('quote scope is explicit, component scope requires a part, and legacy fields stay absent', () => {
  const draft = createInquiryDraft(context, 'draft');
  assert.equal(draft.values.quoteScope, 'discuss');
  assert.equal(quoteScopeLabel(draft.values, draft.context), 'Help define scope');
  const old = {...draft,revision:1,values:sampleInquiryValues()};
  assert.equal(Object.hasOwn(normalizeInquiryDraft(old).values, 'quoteScope'), false);
  assert.equal(Object.hasOwn(reviewInquiry(old).draft.values, 'quoteScope'), false);
  assert.equal(quoteScopeLabel(old.values, old.context), 'Not specified');
  assert.doesNotThrow(() => reviewInquiry({...old,values:{...old.values,quoteScope:''}}));
  assert.throws(() => reviewInquiry({...old,values:{...old.values,quoteScope:'selection'}}), error => Boolean(error.fields.quoteScope));
  const missingPart = {...context}; delete missingPart.part;
  assert.throws(() => reviewInquiry({...old,context:missingPart,values:{...old.values,quoteScope:'part'}}), error => Boolean(error.fields.quoteScope));
  assert.equal(reviewInquiry({...old,values:{...old.values,quoteScope:'product'}}).draft.values.quoteScope, 'product');
});

test('inspection and chosen scope survive draft review, seller issue and later quotation versions', async () => {
  const {repo,storage} = setup();
  let draft = await repo.getDraft(context);
  draft.values = {...sampleInquiryValues(),quoteScope:'part'};
  draft = await repo.saveDraft(draft);
  assert.deepEqual((await repo.getDraft(context)).context.inspection, inspection);
  let project = await repo.submitInquiry(reviewInquiry(draft));
  const originalInquiry = structuredClone(project.inquiry);
  let quoteDraft = await repo.getQuoteDraft(project.id);
  assert.deepEqual(quoteDraft.context.inspection, inspection);
  const changedView = structuredClone(quoteDraft); changedView.context.inspection.view.camera.position[0] = 20;
  await assert.rejects(repo.saveQuoteDraft(changedView), {code:'VALIDATION'});
  quoteDraft = await repo.saveQuoteDraft(quoteDraft);
  project = await repo.issueQuote(reviewQuote(project, quoteDraft));
  const first = structuredClone(project.quotes[0]);
  assert.deepEqual(first.context.inspection, inspection);
  quoteDraft = await repo.getQuoteDraft(project.id);
  quoteDraft.values.scope = 'Updated proposed scope for review';
  quoteDraft = await repo.saveQuoteDraft(quoteDraft);
  project = await repo.issueQuote(reviewQuote(project, quoteDraft));
  assert.deepEqual(project.inquiry, originalInquiry);
  assert.deepEqual(project.quotes[0], first);
  assert.deepEqual(project.quotes[1].context.inspection, inspection);
  assert.equal(project.inquiry.values.quoteScope, 'part');
  project = await repo.sendReply(reviewReply(project, {kind:'clarification',body:'Please confirm the mounting space.'}));
  project = await repo.sendCustomerReply(reviewCustomerReply(project, {replyTo:project.messages.at(-1).id,body:'Allow 100 mm for review.'}));
  project = await repo.confirmNextStep(reviewNextStep(project, project.quotes.at(-1).id, {intent:'engineering-review',message:'Review this component and its mounting.'}));
  for (const record of [...project.messages, ...project.nextSteps]) assert.deepEqual(record.context.inspection, inspection);
  const raw = JSON.parse(storage.getItem(PROJECT_STORAGE_KEY));
  raw.projects[0].quotes[0].context.inspection.view.camera.position[0] = 40;
  storage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(raw));
  await assert.rejects(repo.getProject(project.id), {code:'STORAGE_CORRUPT'});
});

test('sample quote revisions retain the same inspection without manufacturing requirements', async () => {
  const {repo} = setup();
  const draft = await repo.saveDraft({...await repo.getDraft(context), values:{...sampleInquiryValues(),quoteScope:'discuss'}});
  let project = await repo.submitInquiry(reviewInquiry(draft));
  project = await repo.createSampleQuote(project.id);
  project = await repo.requestRevision(reviewRevision(project, project.quotes[0].id, {quantity:'30',targetWeeks:'4',notes:'Review mounting'}));
  project = await repo.simulateReply(project.id, project.changes[0].id);
  assert.equal(project.quotes.length, 2);
  for (const record of [...project.quotes,...project.changes,...project.replies]) assert.deepEqual(record.context.inspection, inspection);
  assert.deepEqual(project.inquiry.requirements, []);
});
