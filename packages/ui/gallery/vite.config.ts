import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { themePlugin } from './theme-plugin.ts';

export default defineConfig({
  root: import.meta.dirname,
  plugins: [react(), themePlugin()],
  server: {
    port: 6006,
    fs: {
      allow: [resolve(import.meta.dirname, '../../..')],
    },
  },
});
