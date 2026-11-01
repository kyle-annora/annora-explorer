import { DrawingStudioError, copyDrawingValue } from './drawing-domain.js';

export const DRAWING_ASSET_DB = 'annora.studio.drawing-assets.v1';
export const MAX_DRAWING_PDF_BYTES = 32 * 1024 * 1024;
const HASH = /^[a-f0-9]{64}$/;
const keyFor = hash => `sha256:${hash}`;
const fail = (code, message) => new DrawingStudioError(code, message);
const aborted = signal => { if (signal?.aborted) throw fail('IMPORT_CANCELLED', 'Drawing import was cancelled. No source version was created.'); };
const storageError = error => error instanceof DrawingStudioError ? error : fail(error?.name === 'QuotaExceededError' ? 'ASSET_QUOTA' : 'ASSET_STORAGE_UNAVAILABLE', error?.name === 'QuotaExceededError' ? 'There is not enough browser storage for this PDF. Keep the original file and free space before retrying.' : 'The original PDF could not be stored in this browser. Allow site storage and try again.');

export async function drawingBlobHash(blob, { crypto = globalThis.crypto, signal } = {}) {
  aborted(signal);
  if (!blob?.arrayBuffer || !crypto?.subtle?.digest) throw fail('ASSET_HASH_UNAVAILABLE', 'This browser cannot verify the PDF file. Use a browser with secure storage and SHA-256 support.');
  const bytes = await blob.arrayBuffer(); aborted(signal);
  const result = await crypto.subtle.digest('SHA-256', bytes); aborted(signal);
  return [...new Uint8Array(result)].map(value => value.toString(16).padStart(2, '0')).join('');
}

/** Minimal asynchronous persistence boundary. Each hash is inserted once, never overwritten. */
export function createIndexedDrawingAssetBackend({ indexedDB = globalThis.indexedDB, databaseName = DRAWING_ASSET_DB } = {}) {
  let opening = null, database = null;
  const open = () => {
    if (database) return Promise.resolve(database);
    if (opening) return opening;
    opening = new Promise((resolve, reject) => {
      if (!indexedDB?.open) { reject(fail('ASSET_STORAGE_UNAVAILABLE', 'This browser does not provide durable file storage. Allow site storage before importing a PDF.')); return; }
      const request = indexedDB.open(databaseName, 1); let settled = false;
      const error = value => { if (!settled) { settled = true; reject(storageError(value)); } };
      request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('assets')) request.result.createObjectStore('assets', { keyPath: 'key' }); };
      request.onerror = () => error(request.error);
      request.onblocked = () => error(fail('ASSET_STORAGE_BLOCKED', 'Another tab is holding an older drawing file store. Close that tab and retry the import.'));
      request.onsuccess = () => {
        if (settled) { request.result.close(); return; }
        settled = true; database = request.result;
        database.onversionchange = () => { database?.close(); database = null; opening = null; };
        resolve(database);
      };
    }).catch(error => { opening = null; throw error; });
    return opening;
  };
  async function transaction(mode, operation) {
    const db = await open();
    return new Promise((resolve, reject) => {
      let result, request;
      try {
        const tx = db.transaction('assets', mode), store = tx.objectStore('assets');
        request = operation(store);
        request.onsuccess = () => { result = request.result; };
        tx.oncomplete = () => resolve(result);
        tx.onabort = () => reject(request.error || tx.error || fail('ASSET_STORAGE_UNAVAILABLE', 'The PDF file transaction was interrupted. Try again.'));
        tx.onerror = () => {}; // onabort reports the transaction result once.
      } catch (error) { reject(error); }
    });
  }
  return Object.freeze({ get: key => transaction('readonly', store => store.get(key)), add: record => transaction('readwrite', store => store.add(record)),
    close() { database?.close(); database = null; opening = null; } });
}

/** Immutable Blob storage. Metadata may be in localStorage; the original bytes never are. */
export function createDrawingAssetStore({ backend, indexedDB, databaseName, crypto = globalThis.crypto, maxBytes = MAX_DRAWING_PDF_BYTES,
  now = () => new Date().toISOString() } = {}) {
  const persistence = backend || createIndexedDrawingAssetBackend({ indexedDB, databaseName });
  async function read(key, expectedSha256) {
    if (typeof key !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(key)) throw fail('ASSET_ID_INVALID', 'The PDF file reference is invalid.');
    let record; try { record = await persistence.get(key); } catch (error) { throw storageError(error); }
    if (!record) throw fail('ASSET_MISSING', 'This original PDF is no longer available in this browser. Restore the exact file or open the project in the browser where it was imported.');
    if (!record.blob?.arrayBuffer || record.sha256 !== key.slice(7) || expectedSha256 && expectedSha256 !== record.sha256 || record.blob.size !== record.byteLength
      || record.byteLength < 1 || record.byteLength > maxBytes || await drawingBlobHash(record.blob, { crypto }) !== record.sha256)
      throw fail('ASSET_CORRUPT', 'The saved PDF does not match its recorded SHA-256. The drawing version has not been replaced. Restore the exact original file.');
    return record;
  }
  return Object.freeze({
    mode: 'browser', maxBytes,
    async put(blob, { fileName = 'drawing.pdf', sha256, signal } = {}) {
      aborted(signal);
      if (!blob?.arrayBuffer || !Number.isSafeInteger(blob.size) || blob.size < 1) throw fail('EMPTY_PDF', 'Choose a nonempty PDF file.');
      if (blob.size > maxBytes) throw fail('PDF_TOO_LARGE', `Choose a PDF no larger than ${Math.round(maxBytes / 1024 / 1024)} MB.`);
      const hash = await drawingBlobHash(blob, { crypto, signal });
      if (sha256 && (!HASH.test(sha256) || sha256 !== hash)) throw fail('ASSET_HASH_MISMATCH', 'This file does not match the requested source version. The earlier PDF is unchanged.');
      const key = keyFor(hash), name = String(fileName).split(/[\\/]/).at(-1).slice(0, 180) || 'drawing.pdf';
      let existing; try { existing = await persistence.get(key); } catch (error) { throw storageError(error); }
      if (existing) { await read(key, hash); return { key, sha256: hash, byteLength: blob.size, fileName: existing.fileName, created: false }; }
      aborted(signal);
      const record = { key, sha256: hash, byteLength: blob.size, fileName: name, type: 'application/pdf', blob: blob.slice(0, blob.size, 'application/pdf'), createdAt: now() };
      try { await persistence.add(record); }
      catch (error) {
        if (error?.name !== 'ConstraintError') throw storageError(error);
        await read(key, hash); return { key, sha256: hash, byteLength: blob.size, fileName: name, created: false };
      }
      return { key, sha256: hash, byteLength: blob.size, fileName: name, created: true };
    },
    async get(key, { sha256 } = {}) { const record = await read(key, sha256); return { key, sha256: record.sha256, byteLength: record.byteLength, fileName: record.fileName, type: record.type, blob: record.blob }; },
    async has(key, { sha256 } = {}) { try { await read(key, sha256); return true; } catch (error) { if (error.code === 'ASSET_MISSING') return false; throw error; } },
    close() { persistence.close?.(); },
  });
}

let sharedStore;
export const defaultDrawingAssetStore = () => sharedStore ||= createDrawingAssetStore();

/** Resolve only for an active reader. Persist the original snapshot, never this leased clone. */
export async function resolveDrawingAssets(packageSnapshot, { assetStore = defaultDrawingAssetStore(), resolveBundledAsset,
  URL: urls = globalThis.URL, signal } = {}) {
  const pkg = copyDrawingValue(packageSnapshot), assets = {}, leased = [];
  let disposed = false;
  const dispose = () => { if (!disposed) { disposed = true; leased.forEach(url => urls.revokeObjectURL(url)); } };
  try {
    for (const asset of pkg.assets) {
      aborted(signal);
      if (asset.localBlobKey) {
        if (asset.localBlobKey !== keyFor(asset.sha256)) throw fail('ASSET_ID_INVALID', 'The local PDF reference and SHA-256 do not match.');
        const saved = await assetStore.get(asset.localBlobKey, { sha256: asset.sha256 }); aborted(signal);
        const url = urls.createObjectURL(saved.blob); leased.push(url); asset.url = url;
      } else {
        const resolved = resolveBundledAsset ? await resolveBundledAsset(asset, packageSnapshot) : asset.url;
        if (typeof resolved === 'string' && /^(blob:|data:|javascript:)/i.test(resolved)) throw fail('SOURCE_UNAVAILABLE', 'A temporary URL cannot identify an archived source file.');
        if (!resolved) throw fail('SOURCE_UNAVAILABLE', `The exact source file is unavailable: ${asset.file}. Its current replacement will not be used.`);
        asset.url = typeof resolved === 'string' ? resolved : resolved.href;
      }
      assets[asset.id] = asset.url;
    }
    return { package: pkg, assets, dispose };
  } catch (error) { dispose(); throw error; }
}
