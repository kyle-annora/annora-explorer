import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { inquiryBuildBoundary } from './scripts/lib/inquiry-build.mjs';
const root = fileURLToPath(new URL('./', import.meta.url));
export default defineConfig({
  publicDir: false, esbuild: { jsx: 'automatic' },
  plugins: [inquiryBuildBoundary(root)],
  build: {
    outDir: 'dist-integration/package', emptyOutDir: true, cssCodeSplit: false,
    lib: { entry: { kit: 'src/integration-kit/entry.js', 'demo-repository': 'src/integration-kit/demo-repository.js', walkthrough: 'src/integration-kit/walkthrough.js' }, formats: ['es'], fileName: (_format, name) => `${name}.js`, cssFileName: 'style' },
    rollupOptions: { external: id => /^(react|react-dom)(\/|$)/.test(id) },
  },
});
