/** Pinned inquiry semantics, independent of the editable presentation profile. */
export const INQUIRY_RULES_VERSION = 'inquiry-intent-v1';
export const INQUIRY_INTENTS = Object.freeze([
  Object.freeze({ value: 'quotation', label: 'Request a quotation' }),
  Object.freeze({ value: 'application-review', label: 'Application review and consultation' }),
]);
export const inquiryRequiresQuantity = values => values?.intent !== 'application-review';
export const validInquiryQuantity = value => typeof value === 'string' && /^\d+$/.test(value) && +value >= 1 && +value <= 100000;
export const inquiryIntentLabel = values => INQUIRY_INTENTS.find(item => item.value === values?.intent)?.label || 'Not specified';
export const inquiryQuantityLabel = values => values?.quantity ? `${values.quantity} units` : 'Quantity unknown';
