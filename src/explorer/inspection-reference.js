import { displayOptions } from './display-profiles.js';

export const INSPECTION_VERSION = '1';
export const INSPECTION_MAX_BYTES = 131072;
export const INSPECTION_PREVIEW_MAX_LENGTH = 120000;
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const finite = value => typeof value === 'number' && Number.isFinite(value);
const bounded = (value, max = 256) => typeof value === 'string' && value.length > 0 && value.length <= max;
const fraction = value => finite(value) && value >= 0 && value <= 1;
const fail = (message, code = 'INVALID_ARGUMENT') => { throw Object.assign(new TypeError(message), { code }); };
const check = (condition, message, code) => { if (!condition) fail(message, code); };
const keys = (value, allowed) => check(plain(value) && Object.keys(value).every(key => allowed.includes(key)), 'Unexpected inspection fields.');

function safeJSON(value, depth = 0) {
  if (depth > 12) return false;
  if (value === null || typeof value === 'boolean') return true;
  if (typeof value === 'string') return value.length <= INSPECTION_PREVIEW_MAX_LENGTH;
  if (typeof value === 'number') return finite(value);
  if (!Array.isArray(value) && !plain(value)) return false;
  if (Array.isArray(value) && value.length > 64) return false;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).length > 65) return false;
  return Reflect.ownKeys(descriptors).every(key => typeof key === 'string' && !['__proto__', 'prototype', 'constructor'].includes(key) && 'value' in descriptors[key] && safeJSON(descriptors[key].value, depth + 1));
}

export function normalizeInspectionCamera(camera) {
  keys(camera, ['position', 'target', 'up', 'projection', 'viewport', 'layoutKey']);
  for (const key of ['position', 'target', 'up']) check(Array.isArray(camera[key]) && camera[key].length === 3 && camera[key].every(value => finite(value) && Math.abs(value) <= 1e6), 'Invalid inspection camera vectors.');
  const direction = camera.position.map((value, index) => value - camera.target[index]), up = camera.up;
  const cross = [direction[1] * up[2] - direction[2] * up[1], direction[2] * up[0] - direction[0] * up[2], direction[0] * up[1] - direction[1] * up[0]];
  check(Math.hypot(...direction) >= .01 && Math.hypot(...up) >= 1e-6 && Math.hypot(...cross) / Math.hypot(...direction) / Math.hypot(...up) > 1e-6, 'The inspection camera needs a stable viewing plane.');
  const p = camera.projection, v = camera.viewport;
  keys(p, ['kind', 'verticalFovDegrees', 'zoom', 'offsetX', 'offsetY']);
  check(p.kind === 'perspective' && finite(p.verticalFovDegrees) && p.verticalFovDegrees >= 1 && p.verticalFovDegrees <= 170 && finite(p.zoom) && p.zoom >= .001 && p.zoom <= 1000 && [p.offsetX, p.offsetY].every(value => finite(value) && Math.abs(value) <= 1e6), 'Invalid inspection projection.');
  keys(v, ['width', 'height']);
  check([v.width, v.height].every(value => finite(value) && value > 0 && value <= 1e6), 'Invalid inspection viewport.');
  check(camera.layoutKey === undefined || bounded(camera.layoutKey, 1024), 'Invalid inspection layout.');
  return JSON.parse(JSON.stringify(camera));
}

function presentation(value) {
  check(bounded(value.selectedId) && bounded(value.scopeId), 'An inspection needs a selected part and scope.');
  check(typeof value.isolated === 'boolean' && ['explore', 'explode', 'operate'].includes(value.mode) && ['engineering', 'linework', 'flat'].includes(value.renderStyle) && fraction(value.separation), 'Invalid inspection presentation.');
  check(value.mode !== 'explore' || value.separation === 0, 'An Explore inspection must be assembled.');
  if (value.mode === 'operate') {
    keys(value.operation, ['clipId', 'progress', 'status']);
    check(value.separation === 0 && bounded(value.operation.clipId) && fraction(value.operation.progress) && value.operation.status === 'paused', 'Invalid paused operation.');
  } else check(value.operation === null, 'Only an operating inspection may contain source playback.');
  keys(value.displayOptions, ['appearance', 'grid', 'ambientOcclusion', 'featureEdges', 'hiddenEdges', 'lineWeight']);
  try { value.displayOptions = displayOptions(value.displayOptions); } catch (error) { fail(error.message); }
  value.camera = normalizeInspectionCamera(value.camera);
}

/** Bounded, renderer-independent JSON for local inquiry storage and the host API. */
export function normalizeInspectionReference(input, { model } = {}) {
  check(safeJSON(input) && JSON.stringify(input).length <= INSPECTION_MAX_BYTES, 'Inspection must be bounded plain JSON.');
  const value = JSON.parse(JSON.stringify(input));
  keys(value, ['version', 'model', 'view', 'tour', 'preview']);
  check(value.version === INSPECTION_VERSION, 'Unsupported inspection version.', 'INCOMPATIBLE_VIEW');
  keys(value.model, ['id', 'revision']);
  check(bounded(value.model.id) && bounded(value.model.revision), 'An inspection needs a model revision.');
  if (model) check(value.model.id === model.id && value.model.revision === model.revision, 'This inspection belongs to another model revision.', 'INCOMPATIBLE_VIEW');
  check(Boolean(value.view) !== Boolean(value.tour), 'An inspection needs exactly one view or paused tour.');
  const fields = ['selectedId', 'scopeId', 'isolated', 'mode', 'renderStyle', 'displayOptions', 'separation', 'operation', 'camera'];
  if (value.view) {
    keys(value.view, ['viewVersion', 'model', 'coordinateFrame', ...fields]);
    check(value.view.viewVersion === '0.1' && value.view.coordinateFrame === 'normalized-assembly-v1' && value.view.model?.id === value.model.id && value.view.model?.revision === value.model.revision, 'The inspection view has an incompatible model or coordinate convention.', 'INCOMPATIBLE_VIEW');
    keys(value.view.model, ['id', 'revision']);
    presentation(value.view);
  } else {
    keys(value.tour, ['tourId', 'chapterId', 'time', 'sourceOwned', 'highlightIds', ...fields]);
    check(bounded(value.tour.tourId) && bounded(value.tour.chapterId) && finite(value.tour.time) && value.tour.time >= 0 && value.tour.time <= 86400, 'Invalid paused tour position.');
    check(typeof value.tour.sourceOwned === 'boolean' && Array.isArray(value.tour.highlightIds) && value.tour.highlightIds.length <= 64 && value.tour.highlightIds.every(id => bounded(id)), 'Invalid tour emphasis.');
    presentation(value.tour);
  }
  if (value.preview !== undefined) {
    keys(value.preview, ['dataUrl', 'width', 'height']);
    check(typeof value.preview.dataUrl === 'string' && value.preview.dataUrl.length <= INSPECTION_PREVIEW_MAX_LENGTH && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value.preview.dataUrl), 'Invalid inspection preview image.');
    check([value.preview.width, value.preview.height].every(side => Number.isInteger(side) && side > 0 && side <= 640), 'Invalid inspection preview size.');
  }
  return value;
}

export const normalizeInspection = normalizeInspectionReference;
