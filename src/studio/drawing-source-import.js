import { DrawingStudioError } from './drawing-domain.js';
import { defaultDrawingAssetStore, drawingBlobHash, MAX_DRAWING_PDF_BYTES } from './drawing-asset-store.js';

export const MAX_DRAWING_PDF_PAGES = 50;
const fail = (code, message) => new DrawingStudioError(code, message);
const checkAbort = signal => { if (signal?.aborted) throw fail('IMPORT_CANCELLED', 'Drawing import was cancelled. No source version was created.'); };
const defaultRuntime = () => import('../drawings/pdf-runtime.js');

/** Inspection does not rasterize pages. Only dimensions and immutable PDF bytes are prepared. */
export async function inspectDrawingPDF(file, { loadPDF = defaultRuntime, URL: urls = globalThis.URL, signal,
  maxBytes = MAX_DRAWING_PDF_BYTES, maxPages = MAX_DRAWING_PDF_PAGES, timeoutMs = 45000, crypto = globalThis.crypto } = {}) {
  checkAbort(signal);
  if (file instanceof ArrayBuffer || ArrayBuffer.isView(file)) file = new Blob([file], { type: 'application/pdf' });
  if (!file?.arrayBuffer || !Number.isSafeInteger(file.size) || file.size < 5) throw fail('EMPTY_PDF', 'Choose a nonempty PDF file.');
  if (file.size > maxBytes) throw fail('PDF_TOO_LARGE', `Choose a PDF no larger than ${Math.round(maxBytes / 1024 / 1024)} MB.`);
  const signature = new TextDecoder('latin1').decode(await file.slice(0, 1024).arrayBuffer());
  if (!signature.includes('%PDF-')) throw fail('INVALID_PDF', 'This file does not contain a PDF document. Choose the original PDF, not an image or renamed file.');
  const sha256 = await drawingBlobHash(file, { crypto, signal });
  let url = null, task = null, document = null, timer, rejectStopped, ended = false;
  const stopped = new Promise((_, reject) => { rejectStopped = reject; });
  const abort = () => { void task?.destroy?.(); rejectStopped(fail('IMPORT_CANCELLED', 'Drawing import was cancelled. No source version was created.')); };
  signal?.addEventListener('abort', abort, { once: true });
  timer = setTimeout(() => { void task?.destroy?.(); rejectStopped(fail('PDF_TIMEOUT', 'This PDF took too long to inspect. Try a smaller exported drawing or reload the page.')); }, timeoutMs);
  const work = async () => {
    const runtime = await loadPDF(); checkAbort(signal); if (ended) throw fail('IMPORT_CANCELLED', 'Drawing inspection has ended.');
    url = urls.createObjectURL(file); task = runtime.loadPDFDocument(url);
    task.onPassword = () => { void task.destroy?.(); rejectStopped(fail('PASSWORD_PDF', 'Password-protected PDFs cannot be used in this preview. Import an unlocked engineering drawing.')); };
    document = await task.promise; checkAbort(signal); if (ended) throw fail('IMPORT_CANCELLED', 'Drawing inspection has ended.');
    if (!Number.isInteger(document.numPages) || document.numPages < 1 || document.numPages > maxPages) throw fail('PDF_PAGE_LIMIT', `Choose a drawing with no more than ${maxPages} pages.`);
    const pages = [];
    for (let index = 1; index <= document.numPages; index++) {
      checkAbort(signal); if (ended) throw fail('IMPORT_CANCELLED', 'Drawing inspection has ended.'); const page = await document.getPage(index);
      try {
        const viewport = page.getViewport({ scale: 1, rotation: 0 }), width = viewport.width, height = viewport.height;
        if (![width, height].every(value => Number.isFinite(value) && value > 0 && value <= 14400)) throw fail('PDF_PAGE_SIZE', `Page ${index} has unsupported dimensions. Export it at a conventional drawing-sheet size.`);
        pages.push({ pageNumber: index, width, height, coordinateFrame: 'page-top-left', rotation: 0 });
      } finally { page.cleanup?.(); }
    }
    return { file, fileName: typeof file.name === 'string' ? file.name.split(/[\\/]/).at(-1).slice(0, 180) : 'drawing.pdf', sha256, byteLength: file.size, pages };
  };
  try { return await Promise.race([work(), stopped]); }
  catch (error) {
    if (error instanceof DrawingStudioError) throw error;
    if (error?.name === 'PasswordException') throw fail('PASSWORD_PDF', 'Password-protected PDFs cannot be used in this preview. Import an unlocked drawing.');
    throw fail('INVALID_PDF', 'The original PDF could not be read. It may be damaged or use an unsupported encoding. No source version was created.');
  } finally {
    ended = true; clearTimeout(timer); signal?.removeEventListener('abort', abort);
    try { await task?.destroy?.(); } catch { /* Inspection must release its worker even when loading failed. */ }
    if (url) urls.revokeObjectURL(url);
  }
}

/** Import saves the original Blob before registering a new, explicitly unreviewed source draft. */
export async function importDrawingPDF({ productId, file, revisionLabel, repository, assetStore = repository?.assetStore || defaultDrawingAssetStore(),
  baseDraftId, signal, ...inspectionOptions } = {}) {
  if (!repository?.createSourceDraft) throw fail('INVALID_REPOSITORY', 'A drawing workspace repository is required.');
  const label = String(revisionLabel || '').trim();
  if (!label || label.length > 120) throw fail('REVISION_LABEL_REQUIRED', 'Name this source version using 1–120 characters. This label does not imply engineering approval.');
  const inspected = await inspectDrawingPDF(file, { ...inspectionOptions, signal, maxBytes: Math.min(inspectionOptions.maxBytes || MAX_DRAWING_PDF_BYTES, assetStore.maxBytes || MAX_DRAWING_PDF_BYTES) });
  checkAbort(signal);
  const saved = await assetStore.put(inspected.file, { fileName: inspected.fileName, sha256: inspected.sha256, signal });
  checkAbort(signal);
  return repository.createSourceDraft(productId, { fileName: inspected.fileName, pages: inspected.pages,
    asset: { id: `pdf-${saved.sha256}`, kind: 'pdf', file: `imports/${saved.sha256}.pdf`, sha256: saved.sha256, byteLength: saved.byteLength, localBlobKey: saved.key } },
  { revisionLabel: label, baseDraftId });
}
