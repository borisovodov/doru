import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

/**
 * The main bundle inlines the workspace packages (they are excluded from
 * externalization), and their sources live outside the project tree, so
 * the dev watcher does not see edits there: a change in @doru/core or
 * @doru/gedcom would leave the running main process stale. Watch the
 * workspace sources explicitly (both the real path and the node_modules
 * symlink form; the symlink resolution differs between builds).
 */
const MAIN_WATCH_INCLUDE = [
  'src/main/**',
  '../../packages/*/src/**',
  'node_modules/@doru/*/src/**',
];

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: ['@doru/core', '@doru/platform', '@doru/ai', '@doru/gedcom'] })],
    build: {
      watch: {
        include: MAIN_WATCH_INCLUDE,
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    plugins: [react()],
  },
});
