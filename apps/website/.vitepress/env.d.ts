// Ambient declarations for assets and single-file components bundled by Vite.
declare module '*.css' {}

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  // Standard Vite SFC module declaration: the component shape is provided by
  // the .vue file itself, so the generic defaults are intentionally broad.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-explicit-any
  const component: DefineComponent<{}, {}, any>;
  export default component;
}
