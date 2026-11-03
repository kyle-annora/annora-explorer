/** A presentation link may only start the model it explicitly requested. */
export function presentationEntry(params, model) {
  if (params.get('presentation') !== '1' || params.getAll('presentation').length !== 1 || params.getAll('model').length > 1) return null;
  const requested = params.get('model');
  if (params.has('model') && requested !== model.id) return null;
  const tourId = model.tour?.id;
  return tourId && model.allowedCapabilities.tours.includes(tourId) ? { tourId } : null;
}
