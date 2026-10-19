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

export interface PendingPermission {
  resolve: (allowed: boolean) => void;
  timer: NodeJS.Timeout;
}

/** Open project runtimes, keyed by project file path. */
export const runtimes = new Map<string, ProjectRuntime>();

/** In-flight chat permission requests, keyed by request id. */
export const pendingPermissions = new Map<string, PendingPermission>();

/** One window per open project, keyed by project file path. */
export const projectWindows = new Map<string, BrowserWindow>();

/** Window ownership: webContents id → project path (null = welcome window). */
export const windowProject = new Map<number, string | null>();

/** .doru paths opened via protocol/open-file before the app was ready. */
export const pendingExternalPaths: string[] = [];

/** Live ACP agent clients, keyed by project file path. */
export const acpClients = new Map<string, AcpAgentClient>();

/** Recent-projects service; initialized lazily in `whenReady`. */
export const recents: { current: RecentProjects | null } = { current: null };

/** Stop functions for bookmarks whose access is currently held, by project path (macOS). */
export const activeBookmarks = new Map<string, () => void>();
