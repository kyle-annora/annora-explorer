import { inquiryField } from './inquiry-profile.js';
import { sampleInquiryValues } from './project-fixtures.js';

/** Fictional presenter assistance fills blanks; it never confirms entered requirements. */
export function prepareSampleInquiry(draft) {
  const values = { ...draft.values }, requirements = [...draft.requirements];
  const wasEmpty = !Object.entries(values).some(([key, value]) => !['intent', 'quoteScope'].includes(key) && String(value).trim());
  for (const [key, value] of Object.entries(sampleInquiryValues(draft.context))) {
    if (inquiryField(draft.context, key, values)?.enabled && !String(values[key] || '').trim()) values[key] = value;
  }
  if (wasEmpty && values.stroke && !requirements.some(item => item.id === 'stroke-confirmed')) requirements.push({
    id: 'stroke-confirmed', label: 'Required carriage stroke', value: values.stroke, unit: 'mm', source: 'customer', confirmed: true,
    ...(draft.context.part ? { part: draft.context.part } : {}),
  });
  return { ...draft, values, requirements };
}
