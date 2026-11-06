import { DEFAULT_INQUIRY_PROFILE, normalizeInquiryProfile } from '../product-room/inquiry-profile.js';
import { STUDIO_PRODUCT_ID, STUDIO_MODEL, STUDIO_PARTS, STUDIO_ASSETS } from './seed.js';
import { copyStudioValue, canonicalStudioValue, sameStudioValue, profileVersion } from './value.js';

export { copyStudioValue, sameStudioValue };
export class StudioError extends Error {
  constructor(code, message, issues = []) { super(message); this.name = 'StudioError'; this.code = code; this.issues = issues; }
}
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' ? value.trim() : '';
const date = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const integer = value => Number.isSafeInteger(value) && value >= 0;
const partIds = new Set(STUDIO_PARTS.map(part => part.id));
const assetIds = new Set(STUDIO_ASSETS.map(asset => asset.id));
const chapters = new Set(STUDIO_MODEL?.tour?.chapters?.map(chapter => chapter.id) || []);
const sections = { content: 'product', inquiryProfile: 'inquiry', presentation: 'presentation', modelRevision: 'parts' };
function sectionOf(path) {
  if (/^content\.(documents|partContent)/.test(path)) return 'parts';
  if (/^content\.questions/.test(path)) return 'presentation';
  return sections[path.split('.')[0]] || 'release';
}
function issue(issues, path, message, severity = 'error') { issues.push({ path, message, section: sectionOf(path), severity }); }
function string(issues, value, path, max = 200, required = true) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) issue(issues, path, required ? `Enter text within ${max} characters.` : `Keep text within ${max} characters.`);
}
function list(issues, value, path, max = 100) {
  if (!Array.isArray(value) || value.length > max || !value.every(object)) { issue(issues, path, `Use a list with at most ${max} entries.`); return []; }
  return value;
}
function unique(issues, entries, key, path) {
  if (new Set(entries.map(entry => entry[key])).size !== entries.length) issue(issues, path, 'Each entry needs a unique identity.');
}

/** Saving incomplete copy is allowed. Publishing requires the complete validation below. */
export function normalizeStudioDraft(input) {
  if (!object(input) || !text(input.id) || input.id.length > 160 || !integer(input.revision)
      || input.productId !== STUDIO_PRODUCT_ID || !text(input.modelRevision)
      || !object(input.content) || !object(input.inquiryProfile) || !Array.isArray(input.inquiryProfile.fields)
      || !object(input.presentation)) throw new StudioError('VALIDATION', 'This product draft has an invalid identity or structure.');
  let content, fields;
  try {
    if (JSON.stringify(input).length > 500000) throw new Error();
    content = copyStudioValue(input.content);
    // Files are resolved through the prepared asset catalog, never an arbitrary stored URL.
    if (Array.isArray(content.documents)) content.documents = content.documents.map(({ url, ...doc }) => ({ ...doc,
      assetRevision: STUDIO_ASSETS.find(asset => asset.id === doc.assetId)?.revision || doc.assetRevision || '',
    }));
    fields = copyStudioValue(input.inquiryProfile.fields);
  } catch { throw new StudioError('VALIDATION', 'Keep this product draft within the supported content size.'); }
  return {
    id: text(input.id), revision: input.revision, productId: input.productId, modelRevision: input.modelRevision,
    content, inquiryProfile: { id: 'kinetic-inquiry', version: profileVersion(fields), fields },
    presentation: { defaultRenderStyle: input.presentation.defaultRenderStyle },
    updatedAt: input.updatedAt || null,
  };
}

export function validateStudioDraft(input) {
  const issues = [];
  if (!object(input)) return [{ path: 'draft', section: 'release', message: 'The product draft is missing.', severity: 'error' }];
  if (input.productId !== STUDIO_PRODUCT_ID) issue(issues, 'productId', 'This Studio demonstration supports the crank-slider product.');
  if (!STUDIO_MODEL || input.modelRevision !== STUDIO_MODEL.revision) issue(issues, 'modelRevision', 'The prepared model revision has changed. Review and rebind references before publishing.');
  const content = input.content;
  if (!object(content)) { issue(issues, 'content', 'Product content is missing.'); return issues; }
  if (content.id !== STUDIO_PRODUCT_ID || content.modelId !== STUDIO_PRODUCT_ID) issue(issues, 'content.id', 'The product must use its prepared crank-slider model.');
  for (const key of ['title', 'shortTitle', 'eyebrow', 'tagline', 'summary']) string(issues, content[key], `content.${key}`, key === 'shortTitle' ? 60 : 180);
  for (const key of ['description', 'demoNotice']) string(issues, content[key], `content.${key}`, 2000);
  if (content.posterAssetId !== 'kinetic-poster') issue(issues, 'content.posterAssetId', 'Choose the prepared crank-slider poster.');
  if (!object(content.source)) issue(issues, 'content.source', 'Keep the model source and attribution with this product.');
  else {
    for (const key of ['label', 'author', 'license', 'note']) string(issues, content.source[key], `content.source.${key}`, key === 'note' ? 2000 : 300);
    try { if (!['https:', 'http:'].includes(new URL(content.source.url).protocol)) throw new Error(); }
    catch { issue(issues, 'content.source.url', 'Use an absolute HTTP or HTTPS source link.'); }
  }
  for (const [index, item] of list(issues, content.highlights, 'content.highlights', 8).entries()) {
    string(issues, item.label, `content.highlights.${index}.label`, 100);
    string(issues, item.value, `content.highlights.${index}.value`, 100);
  }
  const questions = list(issues, content.questions, 'content.questions', 12);
  unique(issues, questions, 'id', 'content.questions');
  for (const [index, question] of questions.entries()) {
    const path = `content.questions.${index}`;
    for (const key of ['id', 'title', 'description', 'actionLabel']) string(issues, question[key], `${path}.${key}`, key === 'description' ? 1000 : 180);
    const target = question.target;
    if (!object(target) || !['part', 'chapter'].includes(target.kind)) issue(issues, `${path}.target`, 'Choose an existing part or tour chapter.');
    else if (target.kind === 'part' && !partIds.has(target.nodeId)) issue(issues, `${path}.target`, 'This part is not in the prepared model revision.');
    else if (target.kind === 'chapter' && (target.tourId !== STUDIO_MODEL?.tour?.id || !chapters.has(target.chapterId))) issue(issues, `${path}.target`, 'This chapter is not available in the prepared tour.');
  }
  const groups = list(issues, content.specGroups, 'content.specGroups', 12);
  unique(issues, groups, 'id', 'content.specGroups');
  const factIds = new Set(groups.flatMap(group => Array.isArray(group.facts) ? group.facts.filter(object).map(fact => fact.id) : []));
  for (const [index, highlight] of (Array.isArray(content.highlights) ? content.highlights : []).entries()) {
    if (highlight?.factId && !factIds.has(highlight.factId)) issue(issues, `content.highlights.${index}.factId`, 'The overview highlight needs an existing product fact.');
  }
  for (const [groupIndex, group] of groups.entries()) {
    const path = `content.specGroups.${groupIndex}`;
    string(issues, group.id, `${path}.id`, 120); string(issues, group.title, `${path}.title`, 150);
    for (const [index, fact] of list(issues, group.facts, `${path}.facts`, 30).entries()) {
      const factPath = `${path}.facts.${index}`;
      for (const key of ['label', 'value', 'source']) string(issues, fact[key], `${factPath}.${key}`, key === 'source' ? 600 : 200);
      if (fact.note !== undefined) string(issues, fact.note, `${factPath}.note`, 1000, false);
      if (fact.nodeId && !partIds.has(fact.nodeId)) issue(issues, `${factPath}.nodeId`, 'This fact refers to a part that is not in this model revision.');
      if (!['verified', 'illustrative', 'unverified'].includes(fact.status)) issue(issues, `${factPath}.status`, 'Choose whether the fact is verified, illustrative or awaiting review.');
      if (fact.status === 'unverified') {
        if (!/^(to discuss|not specified|unknown|pending review)$/i.test(text(fact.value))) issue(issues, `${factPath}.status`, 'Review this technical claim or mark its value as To discuss before release.');
        else issue(issues, `${factPath}.status`, `${fact.label || 'This fact'} remains open for discussion.`, 'warning');
      }
    }
  }
  const documents = list(issues, content.documents, 'content.documents', 30);
  unique(issues, documents, 'id', 'content.documents');
  const documentIds = new Set(documents.map(doc => doc.id));
  for (const [index, doc] of documents.entries()) {
    const path = `content.documents.${index}`;
    for (const key of ['id', 'title', 'revision']) string(issues, doc[key], `${path}.${key}`, 180);
    string(issues, doc.description, `${path}.description`, 1000, false);
    if (!assetIds.has(doc.assetId)) issue(issues, `${path}.assetId`, 'Choose a file from the prepared document library.');
    else if (doc.assetRevision !== STUDIO_ASSETS.find(asset => asset.id === doc.assetId).revision) issue(issues, `${path}.assetRevision`, 'The prepared file revision changed. Review this document association again.');
    if ('url' in doc) issue(issues, `${path}.url`, 'Stored documents must reference a managed asset, not a URL.');
    if (!date(doc.date)) issue(issues, `${path}.date`, 'Enter a valid document revision date.');
    if (doc.nodeId && !partIds.has(doc.nodeId)) issue(issues, `${path}.nodeId`, 'This document refers to a part that is not in this model revision.');
    if (doc.sample !== true) issue(issues, `${path}.sample`, 'Prepared demonstration files must remain marked as sample documents.');
  }
  const parts = list(issues, content.partContent, 'content.partContent', 150);
  unique(issues, parts, 'nodeId', 'content.partContent');
  for (const [index, part] of parts.entries()) {
    const path = `content.partContent.${index}`;
    if (!partIds.has(part.nodeId)) issue(issues, `${path}.nodeId`, 'This linked part is not in the prepared model revision.');
    string(issues, part.title, `${path}.title`, 150); string(issues, part.description, `${path}.description`, 1500, false);
    if (!Array.isArray(part.documentIds) || new Set(part.documentIds).size !== part.documentIds.length || part.documentIds.some(id => !documentIds.has(id))) issue(issues, `${path}.documentIds`, 'Every linked document must exist in this product document list.');
  }
  try { normalizeInquiryProfile(input.inquiryProfile); }
  catch { issue(issues, 'inquiryProfile', 'Check inquiry labels, help text and field settings. Keep application and quantity enabled with their default requirement rules. Quantity is optional for application review.'); }
  if (input.inquiryProfile?.id !== DEFAULT_INQUIRY_PROFILE.id) issue(issues, 'inquiryProfile.id', 'Use the prepared mechanism inquiry profile.');
  if (!object(input.presentation) || !['engineering', 'linework', 'flat'].includes(input.presentation.defaultRenderStyle)) issue(issues, 'presentation.defaultRenderStyle', 'Choose an available display mode.');
  return issues;
}

export function validateRelease(release) {
  if (!object(release)) return [{ path: 'release', section: 'release', message: 'A release record is required.', severity: 'error' }];
  const issues = validateStudioDraft(release);
  if (!text(release.id) || release.id.length > 160) issue(issues, 'id', 'A release needs a stable identity.');
  if (!integer(release.version) || (release.source !== 'preview' && release.version < 1)) issue(issues, 'version', 'A release needs a valid version.');
  if (!date(release.createdAt)) issue(issues, 'createdAt', 'A release needs a recorded creation date.');
  if (!['bundled', 'demo', 'preview'].includes(release.source)) issue(issues, 'source', 'A release must identify whether it is bundled, demo or preview content.');
  if (Array.isArray(release.inquiryProfile?.fields) && release.inquiryProfile.version !== profileVersion(release.inquiryProfile.fields)) issue(issues, 'inquiryProfile.version', 'The inquiry profile version does not match its field configuration.');
  return issues;
}

export function validateReleasePackage(value) {
  if (!object(value)) return [{ path: 'package', section: 'release', message: 'A release package is required.', severity: 'error' }];
  const issues = validateRelease(value.release);
  if (value.kind !== 'annora-room-release' || value.schemaVersion !== 1) issue(issues, 'package', 'This is not a supported Annora Room release package.');
  if (value.release?.source === 'preview') issue(issues, 'release.source', 'Review and confirm a release before exporting it for deployment.');
  if (!Array.isArray(value.assetManifest)) issue(issues, 'assetManifest', 'The prepared document manifest is missing.');
  else {
    const referenced = new Set(Array.isArray(value.release?.content?.documents) ? value.release.content.documents.map(doc => doc?.assetId) : []);
    for (const id of referenced) {
      const expected = STUDIO_ASSETS.find(asset => asset.id === id), supplied = value.assetManifest.find(asset => asset?.id === id);
      if (!expected || !supplied || expected.fileName !== supplied.fileName || expected.type !== supplied.type) issue(issues, 'assetManifest', `The prepared file for ${id} is missing or incompatible.`);
    }
  }
  return issues;
}

/** Compare customer-facing meaning; the review token still binds the complete payload. */
export function studioChanges(before, after) {
  const rows = [], left = object(before?.content) ? before.content : {}, right = object(after?.content) ? after.content : {};
  const entries = value => Array.isArray(value) ? value.filter(object) : [];
  const show = value => value === undefined || value === null || value === '' ? '—' : typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value);
  const summary = values => values.filter(value => typeof value === 'string' && value.trim()).join(' · ') || '—';
  const add = (label, a, b, format = show) => {
    if (!sameStudioValue(a, b)) rows.push({ label, before: format(a), after: format(b), changed: true });
  };
  const partName = (id, content) => !id ? 'Whole product' : entries(content.partContent).find(part => part.nodeId === id)?.title || STUDIO_PARTS.find(part => part.id === id)?.title || 'Unavailable part';
  const docName = doc => summary([doc?.title || 'Untitled document', doc?.revision]);
  const docNames = (ids, content) => Array.isArray(ids) && ids.length
    ? ids.map(id => docName(entries(content.documents).find(doc => doc.id === id))).join('; ') : 'No documents linked';
  const assetName = doc => summary([STUDIO_ASSETS.find(asset => asset.id === doc?.assetId)?.title || 'Unavailable reference file', doc?.assetRevision]);
  const targetName = (target, content) => target?.kind === 'part' ? partName(target.nodeId, content)
    : target?.kind === 'chapter' ? `Tour: ${STUDIO_MODEL?.tour?.chapters?.find(chapter => chapter.id === target.chapterId)?.title || 'Unavailable chapter'}` : 'No 3D destination';
  const statusName = status => ({ verified: 'Verified product fact', illustrative: 'Illustrative model value', unverified: 'Awaiting review' }[status] || show(status));
  const styleName = style => ({ engineering: 'Engineering', linework: 'Linework', flat: 'Linework + Ember' }[style] || show(style));
  function collection(a, b, { key = 'id', kind, describe, compare, orderLabel }) {
    const first = entries(a), second = entries(b);
    const identity = (item, index) => text(item[key]) || `incomplete-${index}`;
    const old = new Map(first.map((item, index) => [identity(item, index), item]));
    const next = new Map(second.map((item, index) => [identity(item, index), item]));
    for (const [id, item] of old) if (!next.has(id)) rows.push({ label: `${kind} removed`, before: describe(item, left), after: '—', changed: true });
    for (const [id, item] of next) {
      if (!old.has(id)) rows.push({ label: `${kind} added`, before: '—', after: describe(item, right), changed: true });
      else compare(old.get(id), item);
    }
    if (orderLabel) {
      const oldOrder = [...old.keys()].filter(id => next.has(id)), nextOrder = [...next.keys()].filter(id => old.has(id));
      if (!sameStudioValue(oldOrder, nextOrder)) rows.push({ label: orderLabel,
        before: oldOrder.map(id => describe(old.get(id), left)).join(' → '),
        after: nextOrder.map(id => describe(next.get(id), right)).join(' → '), changed: true });
    }
  }
  for (const [key, label] of Object.entries({ title: 'Product name', shortTitle: 'Short name', eyebrow: 'Product category', tagline: 'Opening headline', description: 'Product introduction', summary: 'Explanation heading', demoNotice: 'Product scope notice' })) add(label, left[key], right[key]);
  add('Product image', left.posterAssetId, right.posterAssetId, value => value === 'kinetic-poster' ? 'Crank-slider engineering view' : value ? 'Unrecognized image' : 'No image');
  for (const [key, label] of Object.entries({ label: 'Source name', author: 'Source author', license: 'Source license', url: 'Source link', note: 'Source explanation' })) add(label, left.source?.[key], right.source?.[key]);
  // Highlights have fixed positions in the current schema, rather than entity IDs.
  const firstHighlights = entries(left.highlights), nextHighlights = entries(right.highlights);
  for (let index = 0; index < Math.max(firstHighlights.length, nextHighlights.length); index++) {
    const a = firstHighlights[index], b = nextHighlights[index];
    add(`${b?.label || a?.label || 'Product highlight'} · Highlight`, a, b, value => value ? summary([value.label, value.value]) : '—');
  }
  collection(left.partContent, right.partContent, {
    key: 'nodeId', kind: 'Part information', describe: (part, content) => summary([part.title || partName(part.nodeId, content), part.description]), orderLabel: 'Component information order',
    compare(a, b) {
      const name = b.title || a.title || partName(b.nodeId, right);
      add(`${name} · Customer-facing name`, a.title, b.title);
      add(`${name} · Explanation`, a.description, b.description);
      if (!sameStudioValue(a.documentIds, b.documentIds)) rows.push({ label: `${name} · Related documents`, before: docNames(a.documentIds, left), after: docNames(b.documentIds, right), changed: true });
    },
  });
  collection(left.documents, right.documents, {
    kind: 'Document', describe: (doc, content) => summary([docName(doc), partName(doc.nodeId, content)]), orderLabel: 'Document order',
    compare(a, b) {
      const name = b.title || a.title || 'Document';
      for (const [key, label] of Object.entries({ title: 'Title', description: 'Description', revision: 'Revision', date: 'Revision date' })) add(`${name} · ${label}`, a[key], b[key]);
      if (!sameStudioValue(a.nodeId || null, b.nodeId || null)) rows.push({ label: `${name} · Applies to`, before: partName(a.nodeId, left), after: partName(b.nodeId, right), changed: true });
      if (!sameStudioValue([a.assetId, a.assetRevision, a.fileName, a.type], [b.assetId, b.assetRevision, b.fileName, b.type])) rows.push({ label: `${name} · Reference file`, before: assetName(a), after: assetName(b), changed: true });
      add(`${name} · Sample document`, a.sample, b.sample);
    },
  });
  collection(left.specGroups, right.specGroups, {
    kind: 'Specification group', describe: group => group.title || 'Untitled specification group', orderLabel: 'Specification group order',
    compare(a, b) {
      const groupName = b.title || a.title || 'Specifications';
      add(`${groupName} · Group name`, a.title, b.title);
      collection(a.facts, b.facts, {
        kind: 'Technical fact', describe: fact => summary([fact.label, fact.value, statusName(fact.status)]), orderLabel: `${groupName} · Fact order`,
        compare(first, next) {
          const name = next.label || first.label || groupName;
          for (const [key, label] of Object.entries({ label: 'Fact label', value: 'Value', unit: 'Unit', source: 'Source', note: 'Qualification' })) add(`${name} · ${label}`, first[key], next[key]);
          add(`${name} · Evidence status`, first.status, next.status, statusName);
          if (!sameStudioValue(first.nodeId || null, next.nodeId || null)) rows.push({ label: `${name} · Applies to`, before: partName(first.nodeId, left), after: partName(next.nodeId, right), changed: true });
        },
      });
    },
  });
  collection(left.questions, right.questions, {
    kind: 'Customer question', describe: question => question.title || 'Untitled customer question', orderLabel: 'Customer question order',
    compare(a, b) {
      const name = b.title || a.title || 'Customer question';
      for (const [key, label] of Object.entries({ title: 'Question', description: 'Explanation', actionLabel: 'Link label' })) add(`${name} · ${label}`, a[key], b[key]);
      if (!sameStudioValue(a.target, b.target)) rows.push({ label: `${name} · Opens in 3D`, before: targetName(a.target, left), after: targetName(b.target, right), changed: true });
    },
  });
  collection(before?.inquiryProfile?.fields, after?.inquiryProfile?.fields, {
    kind: 'Inquiry field', describe: field => field.label || 'Untitled inquiry field', orderLabel: 'Inquiry field order',
    compare(a, b) {
      const name = b.label || a.label || 'Inquiry field';
      add(`${name} · Field label`, a.label, b.label);
      add(`${name} · Helpful guidance`, a.hint, b.hint);
      add(`${name} · Visibility`, a.enabled, b.enabled, enabled => enabled ? 'Shown in new inquiries' : 'Hidden from new inquiries');
      add(`${name} · Required`, a.required, b.required);
      add(`${name} · Unit`, a.unit, b.unit);
    },
  });
  add('Default rendering', before?.presentation?.defaultRenderStyle, after?.presentation?.defaultRenderStyle, styleName);
  if (before?.modelRevision !== after?.modelRevision) rows.push({ label: 'Prepared model version', before: 'Previous model reference', after: 'Changed model reference — review required', changed: true });
  return rows;
}

export function createReleaseReview(draft, published) {
  const normalized = normalizeStudioDraft(draft), issues = validateStudioDraft(normalized);
  if (normalized.revision < 1) throw new StudioError('STALE_REVIEW', 'Save this draft before reviewing its release.');
  if (issues.some(item => item.severity === 'error')) throw new StudioError('VALIDATION', 'Resolve the highlighted product issues before release.', issues);
  const packet = { kind: 'studio-release', draft: normalized, baseReleaseId: published.id, issues, changes: studioChanges(published, normalized) };
  return { ...packet, token: canonicalStudioValue(packet) };
}

export function assertReleaseReview(review) {
  if (!object(review) || review.kind !== 'studio-release' || typeof review.token !== 'string') throw new StudioError('STALE_REVIEW', 'Review this product version before confirming release.');
  const { token, ...packet } = review;
  if (token !== canonicalStudioValue(packet)) throw new StudioError('STALE_REVIEW', 'The reviewed content changed. Review it again before release.');
  return copyStudioValue(packet);
}
