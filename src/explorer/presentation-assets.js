import records from 'virtual:annora-presentation-assets';
const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};

/** Optional matching derivative media. Geometry and playback remain model-owned. */
export const PRESENTATION_ASSETS = freeze(records);

export function getPresentationAssets(modelId, tourId) {
  return PRESENTATION_ASSETS.find(record => record.modelId === modelId && (tourId === undefined || record.tourId === tourId)) || null;
}

/** Relative to the main Explorer document; hosts may resolve against its URL. */
export function presentationMediaPath(modelId) {
  return getPresentationAssets(modelId) ? `./presentation-media/?model=${encodeURIComponent(modelId)}` : null;
}
