import { MODEL_CATALOG } from '../generated/catalog.js';
import { DRAWING_CATALOG } from '../drawings/catalog.js';
import { descriptorFromPackage } from './package-descriptor.js';

const registrations = import.meta.glob('../../content/rooms/*/product.json',{eager:true,import:'default'});
const releases = import.meta.glob('../../content/rooms/*/release.json',{eager:true,import:'default'});
const metadata = import.meta.glob('../../content/models/*/metadata.json',{eager:true,import:'default'});
const images = import.meta.glob('../../content/drawings/*/*.svg',{eager:true,query:'?url',import:'default'});

// A reviewed data package adds a room. No model-specific host or renderer edit.
export const registeredProductPackages = Object.values(registrations).flatMap(registration => {
  const model = MODEL_CATALOG[registration.id];
  if (!model) return [];
  const entry = DRAWING_CATALOG.find(item => item.id === registration.id);
  if (!entry) throw new Error(`The registered drawing for ${registration.id} is unavailable.`);
  const release = releases[`../../content/rooms/${registration.id}/release.json`];
  if (!release) throw new Error(`The reviewed product release for ${registration.id} is unavailable.`);
  return [descriptorFromPackage({registration,model,metadata:metadata[`../../content/models/${model.packageId || registration.id}/metadata.json`],
    drawingPackage:entry.package,assetURLs:entry.assets,posterURL:images[`../../${registration.drawingDirectory}/${registration.posterFile}`],release,
    overviewViews:entry.overviewViews,presentationSnapshot:entry.overviewPresentation})];
});
