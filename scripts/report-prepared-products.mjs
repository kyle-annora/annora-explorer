import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const arguments_ = process.argv.slice(2);
if (arguments_.length && (arguments_.length !== 2 || arguments_[0] !== '--out' || !arguments_[1])) {
  process.stderr.write('Usage: node scripts/report-prepared-products.mjs [--out <report.json>]\n');
  process.exitCode = 2;
} else {
  // Evaluate the same trusted build catalog as the application. No browser,
  // renderer, remote assets, local projects or customer records are opened.
  const server = await createServer({ root, server: { middlewareMode: true }, appType: 'custom' });
  try {
    const { preparedProducts } = await server.ssrLoadModule('/src/product-room/prepared-catalog.js');
    const { validateRelease } = await server.ssrLoadModule('/src/studio/domain.js');
    const { contextForRelease } = await server.ssrLoadModule('/src/product-room/release-content.js');
    const { createInquiryDraft } = await server.ssrLoadModule('/src/product-room/project-domain.js');
    const products = preparedProducts.list().map(product => {
      const { actions, ...readiness } = product.readiness;
      const inquiryHandoffs = product.technicalReferences.map(reference => {
        try {
          const draft = createInquiryDraft(contextForRelease(product.bundledRelease, reference.technical.context), 'readiness-check');
          return { referenceId: reference.id, valid: true, roomReleaseId: draft.context.roomReleaseId, drawingRevision: draft.context.drawing.revision, regionId: draft.context.drawing.regionId };
        } catch (error) { return { referenceId: reference.id, valid: false, message: error.message }; }
      });
      return { ...readiness, actions: actions.map(action => ({ id: action.id, duration: action.duration, subjectIds: [action.selectedId, ...(action.highlightIds || [])] })),
        releaseId: product.bundledRelease.id,
        releaseIssues: validateRelease(product.bundledRelease, { product }),
        inquiryHandoffs,
        technicalReferences: product.technicalReferences.map(reference => ({ id: reference.id, nodeId: reference.nodeId,
          drawingId: reference.technical.context.drawing.id, sourceRevision: reference.technical.context.drawing.revision,
          assetRevision: reference.technical.context.drawing.assetRevision, mappingRevision: reference.technical.context.drawing.mappingRevision,
          sheetId: reference.technical.context.drawing.sheetId, regionId: reference.technical.context.drawing.regionId,
          page: reference.technical.pdfPage, rotation: reference.technical.rotation, viewId: reference.technical.viewId,
          overviewRevision: reference.technical.context.drawing.presentationRevision || null })),
      };
    });
    const valid = products.every(product => ![...product.issues, ...product.releaseIssues].some(issue => issue.severity === 'error') && product.inquiryHandoffs.every(handoff => handoff.valid));
    const report = { schemaVersion: 1, kind: 'annora-prepared-product-readiness', valid, products,
      coverage: 'Prepared configuration and source-reference checks only. Browser behavior, delivery and hardware performance require separate evidence.' };
    const encoded = JSON.stringify(report, null, 2) + '\n';
    if (arguments_.length) { const path = resolve(process.cwd(), arguments_[1]); await mkdir(dirname(path), { recursive: true }); await writeFile(path, encoded); process.stdout.write(`${valid ? 'Ready' : 'Needs attention'}: ${products.length} prepared products. Report: ${path}\n`); }
    else process.stdout.write(encoded);
    if (!valid) process.exitCode = 1;
  } finally { await server.close(); }
}
