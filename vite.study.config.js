import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
const root = fileURLToPath(new URL('.', import.meta.url));
export default defineConfig({
  root: fileURLToPath(new URL('./linework-study', import.meta.url)),
  base: './', publicDir: false,
  plugins: [{ name: 'study-licenses', transformIndexHtml: { order: 'pre', handler(html, context) {
    return context.server ? html.replaceAll('../src/linework-study/', `/@fs/${root}src/linework-study/`) : html;
  } }, async generateBundle() {
    const files = [['Annora Explorer', 'LICENSE'], ['Three.js', 'node_modules/three/LICENSE'], ['Hexapod hardware and display adaptation', 'content/models/hexapod/LICENSE.txt']];
    const notices = await Promise.all(files.map(async ([label, file]) => label + '\n\n' + await readFile(new URL(file, import.meta.url), 'utf8')));
    this.emitFile({ type:'asset',fileName:'LICENSES.txt',source:notices.join('\n\n---\n\n') });
    this.emitFile({ type:'asset',fileName:'.nojekyll',source:'' });
  }}],
  build: { outDir: '../work/linework-study-dist', emptyOutDir: true, assetsInlineLimit: 0, chunkSizeWarningLimit: 750 },
  server: { host:'127.0.0.1',port:8190,strictPort:true,fs:{allow:[root]} },
});
