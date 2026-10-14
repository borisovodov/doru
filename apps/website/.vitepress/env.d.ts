// Ambient declarations for assets and single-file components bundled by Vite.
declare module '*.css' {}

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}
