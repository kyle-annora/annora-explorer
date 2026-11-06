/** Shared inquiry presentation contract. Commercial rules remain in project-domain. */
import { inquiryRequiresQuantity } from './inquiry-rules.js';
const definitions = [
  ['application', 'Application', 'Describe the task, installation or process.', ''],
  ['quantity', 'Quantity', '', 'units'],
  ['targetWeeks', 'Requested timing', 'A request, not a confirmed delivery date.', 'weeks'],
  ['stroke', 'Required stroke', 'Your required travel, in millimeters.', 'mm'],
  ['load', 'Required load', 'Include the unit and operating conditions.', ''],
  ['notes', 'Notes or questions', '', ''],
  ['name', 'Name', '', ''],
  ['company', 'Company', '', ''],
  ['email', 'Email', '', ''],
];
export const INQUIRY_FIELD_IDS = Object.freeze(definitions.map(([id]) => id));
export const DEFAULT_INQUIRY_PROFILE = Object.freeze({
  id: 'kinetic-inquiry', version: 'kinetic-inquiry-v1',
  fields: Object.freeze(definitions.map(([id, label, hint, unit]) => Object.freeze({
    id, label, hint, unit, enabled: true, required: ['application', 'quantity'].includes(id),
  }))),
});

export function normalizeInquiryProfile(profile) {
  if (!profile || typeof profile.id !== 'string' || !profile.id.trim() || typeof profile.version !== 'string' || !profile.version.trim()
      || !Array.isArray(profile.fields) || profile.fields.length !== INQUIRY_FIELD_IDS.length) throw new TypeError('The saved inquiry profile is invalid.');
  if (new Set(profile.fields.map(field => field.id)).size !== INQUIRY_FIELD_IDS.length) throw new TypeError('Each inquiry field needs a unique identity.');
  const fields = profile.fields.map(field => {
    const original = DEFAULT_INQUIRY_PROFILE.fields.find(item => item.id === field.id);
    if (!original || typeof field.label !== 'string' || !field.label.trim() || field.label.length > 100
        || typeof field.hint !== 'string' || field.hint.length > 400 || field.unit !== original.unit
        || typeof field.enabled !== 'boolean' || field.required !== original.required
        || original.required && !field.enabled) throw new TypeError('The saved inquiry field configuration is invalid.');
    return { id: field.id, label: field.label.trim(), hint: field.hint.trim(), enabled: field.enabled, required: field.required, unit: field.unit };
  });
  return { id: profile.id.trim(), version: profile.version.trim(), fields };
}

export const inquiryFields = (context, values) => (context?.inquiryProfile?.fields || DEFAULT_INQUIRY_PROFILE.fields)
  .map(field => field.id === 'quantity' ? { ...field, required: inquiryRequiresQuantity(values) } : field);
export const inquiryField = (context, id, values) => inquiryFields(context, values).find(field => field.id === id) || DEFAULT_INQUIRY_PROFILE.fields.find(field => field.id === id);
