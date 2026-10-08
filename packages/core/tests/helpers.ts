import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SqliteTreeRepository } from '../src/db/repository';
import { TreeStore } from '../src/db/store';
import type { IFileSystem } from '../src/fs';

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

export class MemoryFileSystem implements IFileSystem {
  private readonly files = new Map<string, string>();
  private readonly dirs = new Set<string>();

  async exists(path: string): Promise<boolean> {
    return this.files.has(path) || this.dirs.has(path);
  }

  async mkdir(path: string): Promise<void> {
    this.dirs.add(path);
  }

  async readdir(path: string): Promise<string[]> {
    const prefix = path.endsWith('/') ? path : `${path}/`;
    return [...this.files.keys(), ...this.dirs]
      .filter((entry) => entry.startsWith(prefix) && entry !== path)
      .map((entry) => entry.slice(prefix.length).split('/')[0] ?? '');
  }

  async readFile(path: string): Promise<string> {
    const content = this.files.get(path);
    if (content === undefined) {
      throw new Error(`ENOENT: ${path}`);
    }
    return content;
  }

  async writeFile(path: string, content: string): Promise<void> {
    this.files.set(path, content);
  }

  async appendFile(path: string, content: string): Promise<void> {
    this.files.set(path, (this.files.get(path) ?? '') + content);
  }

  async copyFile(source: string, destination: string): Promise<void> {
    const content = this.files.get(source);
    if (content === undefined) {
      throw new Error(`ENOENT: ${source}`);
    }
    this.files.set(destination, content);
  }

  async readBinary(path: string): Promise<Uint8Array> {
    return new TextEncoder().encode(await this.readFile(path));
  }

  async writeBinary(path: string, content: Uint8Array): Promise<void> {
    this.files.set(path, new TextDecoder().decode(content));
  }
}
