import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { resolve } from 'node:path';

// Two entry points, one static build:
//   /          -> index.html      (marketing site)
//   /app/      -> app/index.html  (single-page app, hash-routed so any static host works)
export default defineConfig({
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
