import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { inquiryBuildBoundary } from './scripts/lib/inquiry-build.mjs';

const root=fileURLToPath(new URL('./',import.meta.url));
export default defineConfig({
  root, publicDir:false, esbuild:{jsx:'automatic'}, plugins:[inquiryBuildBoundary(root)],
  build:{outDir:'dist-inquiry',emptyOutDir:true,cssCodeSplit:false,
    lib:{entry:fileURLToPath(new URL('./src/inquiry/entry.js',import.meta.url)),formats:['es'],fileName:()=> 'inquiry.js',cssFileName:'inquiry'},
    rollupOptions:{external:id=>/^(react|react-dom)(\/|$)/.test(id)},
  },
});
