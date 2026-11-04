import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const root = fileURLToPath(new URL('./', import.meta.url));
const licenseFiles = [
  ['Annora Explorer', 'LICENSE'],
  ['Three.js', 'node_modules/three/LICENSE'],
  ['Hexapod hardware and display adaptation', 'content/models/hexapod/LICENSE.txt'],
];
async function credits() {
  const entries = await Promise.all(licenseFiles.map(async ([title, file]) =>
    title + '\n\n' + await readFile(new URL(file, import.meta.url), 'utf8')));
  return entries.join('\n\n---\n\n');
}
export default defineConfig({
  root: fileURLToPath(new URL('./orbit-preview/', import.meta.url)),
  base: './',
  publicDir: false,
  plugins: [{
    name: 'orbital-study-credits',
    configureServer(server) {
      server.middlewares.use('/LICENSES.txt', async (_req, res, next) => {
        try { res.setHeader('Content-Type', 'text/plain; charset=utf-8'); res.end(await credits()); }
        catch (error) { next(error); }
      });
    },
    async generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'LICENSES.txt', source: await credits() });
      this.emitFile({ type: 'asset', fileName: '.nojekyll', source: '' });
    },
  }],
  build: {
    outDir: '../work/site/annora-hexapod-orbit', emptyOutDir: true, assetsInlineLimit: 0,
    rollupOptions: { output: { manualChunks: { graphics: ['three', 'three/addons/loaders/GLTFLoader.js', 'three/addons/controls/OrbitControls.js'] } } },
    chunkSizeWarningLimit: 750,
  },
  server: { host: '127.0.0.1', port: 8244, strictPort: true, fs: { allow: [root] } },
});
