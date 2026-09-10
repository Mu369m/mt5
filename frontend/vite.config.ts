/**
 * @file frontend/vite.config.ts
 * @description Vite configuration file for institutional react client.
 * Registers Tailwind v4 compiler, React plugin, and sets up dev server port/proxy rules.
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@workspace/shared/constants': resolve(__dirname, '../shared/constants.ts'),
      '@workspace/shared': resolve(__dirname, '../shared/index.ts'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:5000',
        ws: true,
      },
    },
  },
});
