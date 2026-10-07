import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OpQueue, SqliteTreeRepository, TreeStore } from '@doru/core';

export interface AiFixture {
  repo: SqliteTreeRepository;
  queue: OpQueue;
  store: TreeStore;
  dir: string;
}

export function makeAiFixture(): AiFixture {
  const dir = mkdtempSync(join(tmpdir(), 'doru-ai-'));
  const store = TreeStore.open(join(dir, 'tree.doru'));
  return { repo: new SqliteTreeRepository(store.db), queue: new OpQueue(), store, dir };
}

export function cleanupAiFixture(fixture: AiFixture): void {
  fixture.store.close();
  rmSync(fixture.dir, { recursive: true, force: true });
}
