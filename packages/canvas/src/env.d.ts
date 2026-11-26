// Ambient declarations for CSS bundled by Vite.
declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}
declare module '*.css';
