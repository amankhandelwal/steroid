import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Force the vendored .woff2 faces referenced by src/styles/fonts.css to be
    // emitted as base64 data: URIs rather than as separate asset files. The
    // stylesheet is injected as a raw string into a shadow root on third-party
    // pages, where a relative asset URL would resolve against the host page's
    // origin and 404. Largest font is ~31 KB; 64 KB leaves headroom without
    // silently inlining anything substantial that gets added later.
    assetsInlineLimit: 64 * 1024,
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background.ts'),
        content: resolve(__dirname, 'src/content.tsx'),
      },
      output: {
        // Output the files directly into the dist folder with predictable names
        entryFileNames: `[name].js`,
        // Asset and chunk file names are not as critical, but let's keep them clean
        chunkFileNames: `assets/[name].js`,
        assetFileNames: `assets/[name].[ext]`,
      },
    },
  },
});
