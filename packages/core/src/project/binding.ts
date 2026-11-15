/**
 * The renderer-facing identity of the project bound to a window: a real
 * `.doru` path, or an `untitled:` id for a project that was created from a
 * GEDCOM import and has not been saved to a `.doru` file yet.
 */
export interface ProjectBinding {
  /** Internal key: a `.doru` path or an `untitled:` id. */
  path: string;
  /** Whether the project has not been saved to a `.doru` file yet. */
  untitled: boolean;
  /** Display name for the window title (the file name, with extension). */
  name: string;
}
