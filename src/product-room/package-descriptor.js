import { preparedProductParts, preparedProductReadiness } from './prepared-products.js';
import { DEFAULT_INQUIRY_PROFILE } from './inquiry-profile.js';
import { createDrawingContext } from '../drawing-preview/context.js';
import { createTechnicalStoryReference } from './technical-story.js';
import { profileVersion } from '../studio/value.js';

const copy = value => JSON.parse(JSON.stringify(value));
const safeId = value => typeof value === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(value)
  && !['constructor','prototype','__proto__'].includes(value);
const requireValue = (condition, message) => { if (!condition) throw new TypeError(message); };

/** Portable registration describes prepared assets, never renderer behavior. */
export function validateProductRegistration(input) {
  requireValue(input?.schemaVersion === 1 && safeId(input.id), 'Use a version 1 product registration with a safe product ID.');
  requireValue(input.modelManifest === `content/models/${input.id}/manifest.json`, 'The model manifest must belong to this prepared product.');
  requireValue(input.drawingDirectory === `content/drawings/${input.id}`, 'The drawing directory must belong to this prepared product.');
  requireValue(['mm','cm','m','in'].includes(input.units?.source) && input.units?.display === 'm' && typeof input.units?.evidence === 'string' && input.units.evidence.trim(), 'Document the source units and conversion to display meters.');
  requireValue(typeof input.posterFile === 'string' && /^[a-zA-Z0-9._-]+\.svg$/.test(input.posterFile) && !input.posterFile.includes('..'), 'Use a prepared SVG image inside the drawing directory.');
  requireValue(typeof input.title === 'string' && input.title.trim() && input.title.length <= 180 && typeof input.shortTitle === 'string' && input.shortTitle.trim() && input.shortTitle.length <= 60, 'Supply a title and short product name.');
  requireValue(Number.isFinite(Date.parse(input.createdAt)), 'Record when this source recipe was prepared.');
  requireValue(input.commercialMode === 'sample' || input.commercialMode === 'none', 'Choose sample commerce or no commercial workflow.');
  return copy(input);
}

export function technicalReferencesForPackage(pkg, model, parts, presentationSnapshot = null) {
  if (!pkg) return [];
  return pkg.sheets.flatMap(sheet => sheet.regions.filter(region => region.mappingStatus === 'confirmed').flatMap(region => {
    const context = createDrawingContext({drawing:pkg,sheetId:sheet.id,regionId:region.id,modelRevision:model.revision,
      model:{...model,parts},presentationSnapshot});
    const views = presentationSnapshot?.sheets.find(item => item.sheetId === sheet.id)?.views.filter(view => view.targets.some(target => target.regionId === region.id && target.confirmed)) || [];
    return (views.length ? views : [null]).map(view => ({id:`${sheet.id}:${region.id}:${view?.id || 'source'}`,
      title:`${view?.title || sheet.title} · ${region.label}`,nodeId:region.partId,
      technical:createTechnicalStoryReference({context,pdfPage:sheet.pdfPage || 1,rotation:sheet.rotation || 0,viewId:view?.id || null})}));
  }));
}

/** The same factory serves intake preview, exported packages and deployed rooms. */
export function descriptorFromPackage({registration,model,metadata,drawingPackage,assetURLs={},posterURL,release,
  overviewViews=[],presentationSnapshot=null}) {
  const recipe = validateProductRegistration(registration);
  requireValue(model?.id === recipe.id && model.revision && metadata?.root?.id === (model.rootId || model.id), 'The configured model and source recipe must identify the same prepared product.');
  requireValue(drawingPackage?.modelId === model.id && drawingPackage.modelRevision === model.revision, 'The source drawing must match the exact prepared model revision.');
  const parts = preparedProductParts(metadata), source = copy(metadata.source), pkg = copy(drawingPackage);
  const assets = pkg.assets.map(asset => ({id:asset.id,title:asset.title || asset.file,
    revision:pkg.revision,type:asset.kind.toUpperCase(),sha256:asset.sha256,fileName:asset.file.split('/').at(-1),url:assetURLs[asset.id]}));
  const technicalReferences = technicalReferencesForPackage(pkg,model,parts,presentationSnapshot);
  const fields = DEFAULT_INQUIRY_PROFILE.fields.map(field => ({...field,enabled:!['stroke','load'].includes(field.id),
    ...(field.id === 'application' ? {label:'Question or application',hint:'Describe your application. The selected model and drawing stay attached.'} : {})}));
  const inquiryProfile = {id:`${recipe.id}-inquiry`,version:profileVersion(fields),fields};
  const primarySheet = pkg.sheets[0], primaryAsset = assets.find(asset => asset.id === primarySheet.assetId);
  const primaryPart = metadata.parts[0], posterAssetId = `${recipe.id}-poster`;
  const document = {id:pkg.id,title:pkg.title,description:pkg.statusNote || 'Prepared source reference. Manufacturing approval is not supplied.',
    assetId:primaryAsset.id,assetRevision:primaryAsset.revision,revision:pkg.revision,date:recipe.createdAt,sample:true};
  const id = `ROOM-${recipe.id}-prepared-v1`;
  const seed = {id,version:1,productId:recipe.id,modelRevision:model.revision,source:'bundled',createdAt:recipe.createdAt,
    inquiryProfile,presentation:{defaultRenderStyle:'engineering'},content:{
      id:recipe.id,modelId:recipe.id,title:recipe.title,shortTitle:recipe.shortTitle,eyebrow:'Prepared product reference',
      tagline:recipe.tagline || 'Inspect the product. Discuss the exact detail.',
      summary:recipe.summary || 'A paired model and source drawing for a precise conversation.',
      description:recipe.description || source.description || 'Inspect the prepared model alongside its original technical drawing.',
      demoNotice:'Fictional inquiry saved in this browser. Nothing is sent to a manufacturer.',roomRevision:id,posterAssetId,
      source:{label:recipe.sourceLabel || 'Paired model and source drawing',author:source.author,license:source.license,
        url:source.url || pkg.sourceURL,note:[source.note,pkg.statusNote].filter(Boolean).join(' ')},
      highlights:[{label:'Drawing',value:'Reference only'},{label:'Motion',value:model.operationClipId ? 'Prepared source clip' : 'Not supplied'}],
      specGroups:[{id:'source-reference',title:'Source reference',facts:[{id:'source-units',label:'Source units',value:recipe.units.source,source:recipe.units.evidence,status:'verified'},
        {id:'source-drawing',label:'Drawing status',value:pkg.statusLabel || 'Reference only',source:pkg.sourceURL,status:'illustrative'}]}],
      questions:primaryPart ? [{id:'inspect',title:'Which detail needs review?',description:'Inspect the model and its paired drawing before preparing a request.',actionLabel:'Inspect the product',target:{kind:'part',nodeId:primaryPart.id}}] : [],
      documents:[document],partContent:metadata.parts.map(part => ({nodeId:part.id,title:part.title,description:part.description || '',documentIds:[pkg.id]})),
    }};
  const descriptor = {id:recipe.id,model,parts,drawingPartIds:metadata.parts.map(part => part.id),assets,source,units:recipe.units,modelManifest:recipe.modelManifest,drawingDirectory:recipe.drawingDirectory,
    registration:recipe,posterAssetId,posterTitle:recipe.title,posterURL,poster:posterURL,
    bundledRelease:release || seed,originalRelease:release || seed,inquiryProfile:(release || seed).inquiryProfile,
    commercial:{mode:recipe.commercialMode,drawingWorkflow:true},drawingPackages:[pkg],overviewViews,technicalReferences};
  const readiness = preparedProductReadiness(descriptor);
  return {...descriptor,readiness,capabilities:readiness.capabilities,actions:readiness.actions};
}

/** Turn confirmed intake mappings into a new room; never copy stale story refs. */
export function releaseFromOnboarding(preview, descriptor, {id,createdAt}) {
  const content = copy(preview.content), profile = copy(preview.inquiryProfile);
  profile.version = profileVersion(profile.fields); content.roomRevision = id;
  const references = descriptor.technicalReferences;
  const story = references.length ? {version:1,title:'Inspect the product details',steps:references.slice(0,8).map((reference,index) => ({
    id:`detail-${index+1}`,kind:'technical',nodeId:reference.nodeId,title:reference.technical.context.drawing.regionLabel,
    caption:'Review this source detail, then add your requirements. The exact drawing version stays with your request.',technical:copy(reference.technical),
  }))} : undefined;
  return {id,version:1,productId:descriptor.id,modelRevision:descriptor.model.revision,source:'bundled',createdAt,
    content,inquiryProfile:profile,presentation:{defaultRenderStyle:preview.presentation.defaultRenderStyle,...(story ? {story} : {})}};
}
