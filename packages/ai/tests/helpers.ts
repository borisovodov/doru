import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OpQueue, SqliteTreeRepository, TreeService, TreeStore } from '@doru/core';

export interface AiFixture {
  repo: SqliteTreeRepository;
  queue: OpQueue;
  service: TreeService;
  store: TreeStore;
  dir: string;
}

export function makeAiFixture(): AiFixture {
  const dir = mkdtempSync(join(tmpdir(), 'doru-ai-'));
  const store = TreeStore.open(join(dir, 'tree.doru'));
  const repo = new SqliteTreeRepository(store.db);
  const queue = new OpQueue();
  return { repo, queue, service: new TreeService(repo, queue), store, dir };
}

export function cleanupAiFixture(fixture: AiFixture): void {
  fixture.store.close();
  rmSync(fixture.dir, { recursive: true, force: true });
}
