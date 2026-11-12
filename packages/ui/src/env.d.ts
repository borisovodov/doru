// Ambient declarations for CSS bundled by Vite.
declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}
declare module '*.css';

declare module 'virtual:doru-themes' {
  import type { ThemeDefinition } from './storybook/themes';
  const themes: ThemeDefinition[];
  export default themes;
}
