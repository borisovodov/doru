import {
  OpQueue,
  ProjectOpener,
  SqliteTreeRepository,
  TreeStore,
  type ProjectSummary,
} from '@doru/core';
import { NodeFileSystem } from './filesystem';
import { log } from './log';
import { acpClients, runtimes, type ProjectRuntime } from './state';

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
  const { summary, store } = await opener.open(projectPath);
  const repo = new SqliteTreeRepository(store.db);
  const queue = new OpQueue();
  const runtime: ProjectRuntime = { store, repo, queue };
  runtimes.set(summary.path, runtime);
  return { summary, runtime };
}

export function closeProjectRuntime(projectPath: string): void {
  const runtime = runtimes.get(projectPath);
  if (runtime) {
    runtime.store.close();
    runtimes.delete(projectPath);
  }
  const acp = acpClients.get(projectPath);
  if (acp) {
    void acp.close();
    acpClients.delete(projectPath);
  }
}

export function closeAllRuntimes(): void {
  for (const runtime of runtimes.values()) {
    runtime.store.close();
  }
  runtimes.clear();
}
