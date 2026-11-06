import test from 'node:test';
import assert from 'node:assert/strict';
import { attachInquiryRelease } from '../../src/product-room/explorer-inquiry-context.js';
import { BUNDLED_RELEASE } from '../../src/studio/seed.js';
import { contextForRelease } from '../../src/product-room/release-content.js';

test('new embedded inquiry pins the published product and form versions', async () => {
  const context = { productId:BUNDLED_RELEASE.productId, productTitle:BUNDLED_RELEASE.content.title,
    modelId:BUNDLED_RELEASE.content.modelId, modelRevision:BUNDLED_RELEASE.modelRevision,
    part:{id:'rod',title:'Connecting rod'} };
  const resolved = await attachInquiryRelease(context,{repository:{getPublished:async()=>structuredClone(BUNDLED_RELEASE)}});
  assert.equal(resolved.roomReleaseId,BUNDLED_RELEASE.id);
  assert.equal(resolved.inquiryProfileVersion,BUNDLED_RELEASE.inquiryProfile.version);
  assert.deepEqual(resolved.part,context.part);
  await assert.rejects(attachInquiryRelease({...context,modelRevision:'other'},{repository:{getPublished:async()=>BUNDLED_RELEASE}}),/does not match/);
});

test('resumed inquiry keeps its release without consulting a newly published product', async () => {
  const context = contextForRelease(BUNDLED_RELEASE);
  const resolved = await attachInquiryRelease(context,{repository:{getPublished:async()=>{throw new Error('Must not read a new release');}}});
  assert.deepEqual(resolved,context);
});
