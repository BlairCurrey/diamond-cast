import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { resolve } from 'node:path';

// Two entry points, one static build:
//   /          -> index.html      (marketing site)
//   /app/      -> app/index.html  (single-page app, hash-routed so any static host works)
// BASE_PATH serves it from a subpath, e.g. BASE_PATH=/diamond-cast/ for a GitHub
// Pages project site. Links between the two pages are relative, so only asset URLs care.
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [preact()],
  build: {
    rollupOptions: {
      input: {
        site: resolve(__dirname, 'index.html'),
        app: resolve(__dirname, 'app/index.html'),
      },
    },
  },
});
