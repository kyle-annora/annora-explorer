import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { loadProject } from './scripts/lib/project-config.mjs';
import { presentationAssetsPlugin } from './scripts/lib/presentation-assets.mjs';

const root = fileURLToPath(new URL('./', import.meta.url));

export default defineConfig({
  base: './',
  publicDir: false,
  esbuild: { jsx: 'automatic' },
  plugins: [presentationAssetsPlugin(root), {
    name: 'redistribution-notices',
    async generateBundle() {
      const { models } = await loadProject(root);
      const sections = [
        ['Annora Explorer', new URL('./LICENSE', import.meta.url)],
        ['Three.js', new URL('./node_modules/three/LICENSE', import.meta.url)],
        ['PDF.js', new URL('./node_modules/pdfjs-dist/LICENSE', import.meta.url)],
        ...['cmaps/LICENSE','iccs/LICENSE','standard_fonts/LICENSE_LIBERATION','standard_fonts/LICENSE_FOXIT','wasm/LICENSE_JBIG2','wasm/LICENSE_QCMS','wasm/LICENSE_PDFJS_JBIG2','wasm/LICENSE_OPENJPEG','wasm/LICENSE_PDFJS_OPENJPEG','wasm/LICENSE_PDFJS_QCMS'].map(file => [file,new URL(`./node_modules/pdfjs-dist/${file}`,import.meta.url)]),
        ...['react', 'react-dom', 'scheduler', '@base-ui/react', '@base-ui/utils',
          '@floating-ui/react-dom', '@floating-ui/dom', '@floating-ui/core', '@floating-ui/utils',
          '@babel/runtime', 'use-sync-external-store', 'reselect'].map(name =>
          [name, new URL(`./node_modules/${name}/LICENSE`, import.meta.url)]),
        ...models.map(model => [model.manifest.provenance.attribution, model.assets.license]),
      ];
      const notices = await Promise.all(sections.map(async ([name, file]) => `${name}\n${'='.repeat(name.length)}\n\n${await readFile(file, 'utf8')}`));
      this.emitFile({ type: 'asset', fileName: 'LICENSES.txt', source: notices.join('\n\n') });
    },
  }],
  build: {
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 750,
    rollupOptions: {
      input: {
        explorer: fileURLToPath(new URL('./index.html', import.meta.url)),
        embed: fileURLToPath(new URL('./examples/embed/index.html', import.meta.url)),
        room: fileURLToPath(new URL('./product-room/index.html', import.meta.url)),
        studio: fileURLToPath(new URL('./studio/index.html', import.meta.url)),
        drawingPreview: fileURLToPath(new URL('./drawing-preview/index.html', import.meta.url)),
        designPreview: fileURLToPath(new URL('./design-preview/index.html', import.meta.url)),
        walkthrough: fileURLToPath(new URL('./walkthrough/index.html', import.meta.url)),
        presentationMedia: fileURLToPath(new URL('./presentation-media/index.html', import.meta.url)),
      },
      output: { manualChunks: id => id.includes('/node_modules/three/') ? 'three' : undefined },
    },
  },
  server: { host: '127.0.0.1', port: 8095, strictPort: true },
});
