import { MODEL_CATALOG } from '../generated/catalog.js';
import { normalizeDrawingPackage } from '../drawings/package.js';
import { descriptorFromPackage } from '../product-room/package-descriptor.js';

const recipes = import.meta.glob('../../content/onboarding/*/candidate.json', {eager:true,import:'default'});
const sources = import.meta.glob('../../content/drawings/*/intake-source.json', {eager:true,import:'default'});
const metadata = import.meta.glob('../../content/models/*/metadata.json', {eager:true,import:'default'});
const assets = import.meta.glob('../../content/drawings/**/*.{pdf,svg,step,stp}', {eager:true,query:'?url',import:'default'});
export const onboardingDiagnostics = [];
export const ONBOARDING_CANDIDATES = Object.values(recipes).flatMap(recipe => {
  const model = MODEL_CATALOG[recipe.id];
  if (!model) { onboardingDiagnostics.push({productId:recipe.id,message:'Import and register the prepared model before opening its intake.'}); return []; }
  try {
    const directory = `../../${recipe.drawingDirectory}/`, source = sources[directory+'intake-source.json'];
    if (!source) throw new Error('The immutable intake-source.json is missing from the drawing package.');
    const assetURLs = Object.fromEntries(source.assets.map(asset => [asset.id,assets[directory+asset.file]]));
    if (Object.values(assetURLs).some(value => !value) || !assets[directory+recipe.posterFile]) throw new Error('A prepared original source or product image is missing.');
    return [descriptorFromPackage({registration:recipe,model,metadata:metadata[`../../content/models/${model.packageId || recipe.id}/metadata.json`],
      drawingPackage:normalizeDrawingPackage(source,{assetURLs}),assetURLs,posterURL:assets[directory+recipe.posterFile]})];
  } catch (error) { onboardingDiagnostics.push({productId:recipe.id,message:error.message}); return []; }
});
export const onboardingCandidate = id => ONBOARDING_CANDIDATES.find(candidate => candidate.id === id) || null;
