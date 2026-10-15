// Ambient declarations for the e2e specs: reuse the renderer's `window.doru`
// typing so the preload API surface stays declared in exactly one place.
/// <reference path="../apps/desktop/src/renderer/src/doru.d.ts" />

// The specs pull in renderer source (via the preload typing); declare the
// Vite-handled side-effect imports for this program.
declare module '*.css' {}
