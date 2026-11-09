import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SqliteTreeRepository } from '../src/db/repository';
import { TreeStore } from '../src/db/store';
import type { IFileSystem } from '../src/fs';
import type { FamilyRecord, PersonRecord } from '../src/model/types';

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

/**
 * The flat contract of a hydrated person: the piece fields and the facts
 * without their generated detail rows (date ids, name parts, link rows).
 * Tests compare against this to keep the renderer-facing shape stable while
 * the storage underneath is normalized.
 */
export function flatPerson(person: PersonRecord): PersonRecord {
  return {
    ...person,
    names: person.names.map((name) => ({
      id: name.id,
      full: name.full,
      given: name.given,
      surname: name.surname,
      surnamePrefix: name.surnamePrefix,
      nickname: name.nickname,
      prefix: name.prefix,
      suffix: name.suffix,
      type: name.type,
    })),
    facts: person.facts.map((fact) => ({
      id: fact.id,
      personId: fact.personId,
      familyId: fact.familyId,
      tag: fact.tag,
      type: fact.type,
      value: fact.value,
      date: fact.date ? { ...fact.date, id: undefined } : undefined,
      place: fact.place,
    })),
  };
}

/** The flat contract of a hydrated family: partner/child ids without link rows. */
export function flatFamily(family: FamilyRecord): FamilyRecord {
  return { id: family.id, xref: family.xref, partners: family.partners, children: family.children };
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

  async remove(path: string): Promise<void> {
    this.files.delete(path);
  }

  async readBinary(path: string): Promise<Uint8Array> {
    return new TextEncoder().encode(await this.readFile(path));
  }

  async writeBinary(path: string, content: Uint8Array): Promise<void> {
    this.files.set(path, new TextDecoder().decode(content));
  }
}
