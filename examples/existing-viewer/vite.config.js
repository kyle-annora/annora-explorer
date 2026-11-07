import { defineConfig } from 'vite';
export default defineConfig({ base: './', build: { chunkSizeWarningLimit: 750, rollupOptions: { output: { manualChunks: id => id.includes('/node_modules/three/') ? 'viewer' : undefined } } } });
