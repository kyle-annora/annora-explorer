import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_INQUIRY_PROFILE, inquiryField } from '../../src/product-room/inquiry-profile.js';
import { contextForRelease, loadRoomRelease, createPreviewProjectRepository } from '../../src/product-room/release-content.js';
import { createDemoProjectRepository, PROJECT_STORAGE_KEY, parseProjectStore } from '../../src/product-room/project-repository.js';
import { reviewInquiry } from '../../src/product-room/project-domain.js';
import { sampleInquiryValues } from '../../src/product-room/project-fixtures.js';

const copy = value => structuredClone(value);
const original = {
  id:'ROOM-1', version:1, productId:'kinetic-01', modelRevision:'model-1', source:'demo', createdAt:'2026-11-01T12:00:00.000Z',
  content:{id:'kinetic-01',modelId:'kinetic-01',roomRevision:'ROOM-1',title:'Original product',shortTitle:'Original',eyebrow:'Sample',tagline:'Original tagline',description:'Original description',summary:'Original summary',demoNotice:'Sample',source:{label:'Original model',author:'Example',license:'MIT',url:'https://example.com',note:'Example'},highlights:[],questions:[],specGroups:[{id:'geometry',title:'Geometry',facts:[{label:'Stroke',value:'70 mm',source:'Prepared model'}]}],documents:[{id:'brief',title:'Assembly brief',revision:'A',assetId:'brief-asset'}]},
  inquiryProfile:copy(DEFAULT_INQUIRY_PROFILE), presentation:{defaultRenderStyle:'engineering'},
};
function setup() {
  const data = new Map(); let serial = 0;
  const storage = {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};
  const repository = createDemoProjectRepository({storage,locks:null,makeId:prefix=>`${prefix}-${++serial}`,now:()=> '2026-11-01T12:00:00.000Z'});
  return {data,storage,repository};
}
async function save(repository, context) {
  const draft = await repository.getDraft(context); draft.values = sampleInquiryValues();
  return repository.saveDraft(draft);
}

test('product and form releases isolate new inquiries while preserving an older draft and quotation', async () => {
  const {repository,storage} = setup();
  const contextA = contextForRelease(original,{document:{id:'brief',title:'Assembly brief',revision:'A'}});
  const olderDraft = await save(repository,contextA);
  const newer = copy(original); newer.id='ROOM-2'; newer.version=2; newer.content.title='Revised product'; newer.content.documents[0].revision='B';
  newer.inquiryProfile.version='profile-2'; newer.inquiryProfile.fields.find(field=>field.id==='load').label='Operating load';
  newer.inquiryProfile.fields.find(field=>field.id==='name').enabled=false;
  const contextB = contextForRelease(newer);
  const newDraft = await repository.getDraft(contextB);
  assert.notEqual(newDraft.id,olderDraft.id); assert.equal(newDraft.revision,0);
  assert.deepEqual(await repository.getDraft(contextA),olderDraft);
  assert.equal(inquiryField(olderDraft.context,'load').label,'Required load');
  assert.equal(inquiryField(newDraft.context,'load').label,'Operating load');
  assert.equal(inquiryField(newDraft.context,'name').enabled,false);
  let project = await repository.submitInquiry(reviewInquiry(olderDraft));
  project = await repository.createSampleQuote(project.id);
  const snapshot = JSON.stringify(project);
  await save(repository,contextB);
  assert.equal(JSON.stringify(await repository.getProject(project.id)),snapshot);
  assert.equal(project.context.document.revision,'A');
  assert.equal(project.context.roomSnapshot.content.documents[0].revision,'A');
  assert.equal(project.context.productTitle,'Original product');
  assert.doesNotThrow(()=>parseProjectStore(storage.getItem(PROJECT_STORAGE_KEY)));
});

test('legacy customer records stay byte-for-byte unchanged and are not assigned the current product release', async () => {
  const {repository,storage} = setup();
  const legacy = {productId:'kinetic-01',productTitle:'Earlier product',modelId:'kinetic-01',modelRevision:'model-1'};
  const oldDraft = await save(repository,legacy);
  const raw = storage.getItem(PROJECT_STORAGE_KEY);
  assert.deepEqual(await repository.getDraft(legacy),oldDraft);
  assert.equal((await repository.listDrafts())[0].context.roomReleaseId,undefined);
  assert.equal((await repository.getDraft(contextForRelease(original))).revision,0);
  assert.equal(storage.getItem(PROJECT_STORAGE_KEY),raw);
});

test('versioned contexts reject a changed model, missing snapshot or mismatched inquiry profile', async () => {
  const {repository}=setup();
  const good=contextForRelease(original);
  await assert.rejects(repository.getDraft({...good,modelRevision:'other'}),{code:'VALIDATION'});
  await assert.rejects(repository.getDraft({...good,roomSnapshot:undefined}),{code:'VALIDATION'});
  await assert.rejects(repository.getDraft({...good,inquiryProfileVersion:'other'}),{code:'VALIDATION'});
  const changed=copy(good); changed.inquiryProfile.fields.find(field=>field.id==='quantity').enabled=false;
  await assert.rejects(repository.getDraft(changed),{code:'VALIDATION'});
});

test('a preview uses disposable customer storage and cannot read or alter ordinary projects', async () => {
  const {repository,storage}=setup();
  await save(repository,contextForRelease(original));
  const raw=storage.getItem(PROJECT_STORAGE_KEY),preview=createPreviewProjectRepository();
  assert.deepEqual(await preview.listDrafts(),[]); assert.deepEqual(await preview.listProjects(),[]);
  const draft=await save(preview,contextForRelease({...original,id:'PREVIEW-1',source:'preview'}));
  const project=await preview.submitInquiry(reviewInquiry(draft));
  await preview.createSampleQuote(project.id);
  assert.equal((await preview.listProjects()).length,1);
  assert.equal(storage.getItem(PROJECT_STORAGE_KEY),raw);
  assert.deepEqual(await createPreviewProjectRepository().listProjects(),[]);
});

test('an exact preview link never falls back to the published Room', async () => {
  let publishedReads=0;
  const repository={getPublished:async()=>{publishedReads++;return original;},getPreview:async()=>null,getRelease:async()=>null};
  await assert.rejects(loadRoomRelease(repository,new URLSearchParams('studioPreview=missing')),{code:'RELEASE_NOT_FOUND'});
  await assert.rejects(loadRoomRelease(repository,new URLSearchParams('release=missing')),{code:'RELEASE_NOT_FOUND'});
  await assert.rejects(loadRoomRelease(repository,new URLSearchParams('studioPreview=x&release=y')),{code:'RELEASE_NOT_FOUND'});
  assert.equal(publishedReads,0);
  const resolved=await loadRoomRelease(repository,new URLSearchParams());
  assert.equal(resolved.release.id,'ROOM-1'); assert.equal(resolved.preview,false); assert.equal(publishedReads,1);
});


test('historical product snapshots reject malformed display collections without consulting current assets', async () => {
  const {repository}=setup();
  for (const mutate of [
    value=>delete value.roomSnapshot.content.specGroups[0].facts,
    value=>value.roomSnapshot.content.highlights.push({label:'Missing value'}),
    value=>value.roomSnapshot.content.source=null,
    value=>value.roomSnapshot.content.documents[0].title={},
    value=>value.roomSnapshot.content.partContent=[{nodeId:'rod',title:'Rod',description:'Rod',documentIds:['missing']}],
    value=>value.roomSnapshot.inquiryProfile=null,
  ]) {
    const value=contextForRelease(original);mutate(value);
    await assert.rejects(repository.getDraft(value),{code:'VALIDATION'});
  }
  const unknown=copy(original);unknown.modelRevision='old-unavailable-model';unknown.content.documents[0].assetId='old-asset';
  assert.equal((await repository.getDraft(contextForRelease(unknown))).context.modelRevision,'old-unavailable-model');
  await assert.rejects(repository.getDraft(contextForRelease(original,{document:{id:'brief',title:'Assembly brief',revision:'B'}})),{code:'VALIDATION'});
});
