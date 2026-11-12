/**
 * Vite-style `?raw` imports used by the corpus tests: the bundler hands
 * the file contents to the test as a string.
 */
declare module '*?raw' {
  const content: string;
  export default content;
}
