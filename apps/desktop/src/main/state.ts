import type { BrowserWindow } from 'electron';
import type { AcpAgentClient } from '@doru/ai';
import type { ITreeStore, OpQueue, RecentProjects, SqliteTreeRepository } from '@doru/core';

/**
 * Shared mutable state of the main process.
 *
 * Kept in a single module so domain modules (windows, projects, chat, …) can
 * share it without circular imports. Prefer small accessor functions over
 * exposing raw maps when a piece of state needs invariants.
 */

export interface ProjectRuntime {
  store: ITreeStore;
  repo: SqliteTreeRepository;
  queue: OpQueue;
}

/** Keys of projects created from a GEDCOM import that are not saved yet. */
export const UNTITLED_PREFIX = 'untitled:';

export function isUntitledKey(key: string): boolean {
  return key.startsWith(UNTITLED_PREFIX);
}

/** Where the files of a not-yet-saved project live on disk. */
export interface UntitledProjectInfo {
  /** Directory holding the temporary `.doru` file and its media folder. */
  tempDir: string;
  /** The temporary `.doru` file backing the store. */
  tempPath: string;
  /** Display name shown in the window title (the imported file name). */
  name: string;
}

/** Open project runtimes, keyed by project file path or `untitled:` id. */
export const runtimes = new Map<string, ProjectRuntime>();

/** One window per open project, keyed by project file path or `untitled:` id. */
export const projectWindows = new Map<string, BrowserWindow>();

/** Window ownership: webContents id → project key (null = welcome window). */
export const windowProject = new Map<number, string | null>();

/** .doru/.ged/.gdz paths opened via protocol/open-file before the app was ready. */
export const pendingExternalPaths: string[] = [];

/** Live ACP agent clients, keyed by project key. */
export const acpClients = new Map<string, AcpAgentClient>();

/**
 * Which chat session the ACP agent session currently serves, keyed by
 * project key. Opening another chat session resets the agent session and
 * replays the transcript into it.
 */
export const acpSessionOwner = new Map<string, string>();

/** Recent-projects service; initialized lazily in `whenReady`. */
export const recents: { current: RecentProjects | null } = { current: null };

/** Not-yet-saved projects, keyed by their `untitled:` id. */
export const untitledProjects = new Map<string, UntitledProjectInfo>();

/** Stop functions for bookmarks whose access is currently held, by project path (macOS). */
export const activeBookmarks = new Map<string, () => void>();
