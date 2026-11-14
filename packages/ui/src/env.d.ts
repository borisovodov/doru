// Ambient declarations for CSS bundled by Vite.
declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}
declare module '*.css';

declare module 'virtual:doru-gallery-themes' {
  const themes: import('../gallery/themes').ThemeDefinition[];
  export default themes;
}
