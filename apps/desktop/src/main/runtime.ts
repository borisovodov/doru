import {
  OpQueue,
  ProjectOpener,
  SqliteTreeRepository,
  TreeStore,
  type ProjectSummary,
} from '@doru/core';
import { releaseBookmarkAccess } from './bookmarks';
import { NodeFileSystem } from './filesystem';
import { log } from './log';
import { acpClients, acpSessionOwner, activeBookmarks, isUntitledKey, runtimes, type ProjectRuntime } from './state';
import { markSelfWrite, StampedOpQueue, stopTreeWatcher } from './tree-watcher';
import { disposeUntitled } from './untitled';

const fs = new NodeFileSystem();

const opener = new ProjectOpener(fs, { open: (path) => TreeStore.open(path) }, log);

export async function ensureRuntime(
  projectPath: string,
): Promise<{ summary: ProjectSummary; runtime: ProjectRuntime }> {
  const existing = runtimes.get(projectPath);
  if (existing) {
    return {
      summary: {
        path: projectPath,
        schemaVersion: existing.store.userVersion(),
        created: false,
      },
      runtime: existing,
    };
  }
  if (isUntitledKey(projectPath)) {
    // Untitled projects are created by the import flow itself; a key with
    // no runtime means the window is talking to a project that no longer
    // exists (closed or saved under a real path).
    throw new Error(`Untitled project is not open: ${projectPath}`);
  }
  const { summary, store } = await opener.open(projectPath);
  const repo = new SqliteTreeRepository(store.db);
  const queue = new StampedOpQueue(() => markSelfWrite(summary.path));
  const runtime: ProjectRuntime = { store, repo, queue };
  runtimes.set(summary.path, runtime);
  return { summary, runtime };
}

/**
 * The real path of the store backing a project key. For untitled projects
 * the key is not a file path, so media and other path-relative code must go
 * through this helper.
 */
export function runtimeFilePath(projectKey: string): string {
  return runtimes.get(projectKey)?.store.path ?? projectKey;
}

/**
 * Opens (or reopens) the store of a not-yet-saved project at its temporary
 * path: used by the import flow and by a failed save attempt that closed the
 * runtime first.
 */
export function openUntitledStore(projectKey: string, tempPath: string): void {
  if (runtimes.has(projectKey)) {
    return;
  }
  const store = TreeStore.open(tempPath);
  runtimes.set(projectKey, {
    store,
    repo: new SqliteTreeRepository(store.db),
    queue: new OpQueue(),
  });
}

export function closeProjectRuntime(
  projectPath: string,
  options: { removeUntitledFiles?: boolean } = {},
): void {
  const runtime = runtimes.get(projectPath);
  if (runtime) {
    runtime.store.close();
    runtimes.delete(projectPath);
  }
  stopTreeWatcher(projectPath);
  const acp = acpClients.get(projectPath);
  if (acp) {
    void acp.close();
    acpClients.delete(projectPath);
  }
  acpSessionOwner.delete(projectPath);
  releaseBookmarkAccess(activeBookmarks.get(projectPath));
  activeBookmarks.delete(projectPath);
  if (isUntitledKey(projectPath) && options.removeUntitledFiles !== false) {
    // The save flow removes the files itself after moving them.
    void disposeUntitled(projectPath);
  }
}

export function closeAllRuntimes(): void {
  for (const runtime of runtimes.values()) {
    runtime.store.close();
  }
  runtimes.clear();
  for (const stop of activeBookmarks.values()) {
    releaseBookmarkAccess(stop);
  }
  activeBookmarks.clear();
}
