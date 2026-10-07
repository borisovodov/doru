import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SqliteTreeRepository } from '../src/db/repository';
import { TreeStore } from '../src/db/store';

export interface RepoFixture {
  repo: SqliteTreeRepository;
  store: TreeStore;
  dir: string;
}

export function makeRepo(): RepoFixture {
  const dir = mkdtempSync(join(tmpdir(), 'doru-db-'));
  const store = TreeStore.open(join(dir, 'tree.doru'));
  return { repo: new SqliteTreeRepository(store.db), store, dir };
}

export function cleanupRepo(fixture: RepoFixture): void {
  fixture.store.close();
  rmSync(fixture.dir, { recursive: true, force: true });
}
