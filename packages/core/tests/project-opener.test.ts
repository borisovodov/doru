import { describe, expect, it } from 'vitest';
import { access, appendFile, copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { DORU_APPLICATION_ID, SCHEMA_VERSION } from '../src/db/schema';
import { TreeStore } from '../src/db/store';
import type { IFileSystem } from '../src/fs';
import { ProjectOpener } from '../src/project/opener';

const fsImpl: IFileSystem = {
  async exists(path) {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  },
  mkdir: async (path) => {
    await mkdir(path, { recursive: true });
  },
  readdir,
  readFile: (path) => readFile(path, 'utf8'),
  writeFile,
  appendFile,
  copyFile,
  async readBinary(path) {
    return readFile(path);
  },
  async writeBinary(path, content) {
    await writeFile(path, content);
  },
};

describe('ProjectOpener', () => {
  it('creates a new project file and reports it as created', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'doru-new-'));
    try {
      const filePath = join(folder, 'family.doru');
      const opener = new ProjectOpener(fsImpl, { open: (p) => TreeStore.open(p) });
      const { summary, store } = await opener.open(filePath);

      expect(summary.path).toBe(filePath);
      expect(summary.created).toBe(true);
      expect(summary.schemaVersion).toBe(SCHEMA_VERSION);

      const db = new DatabaseSync(summary.path);
      const applicationId = (db.prepare('PRAGMA application_id').get() as { application_id: number }).application_id;
      const journalMode = (db.prepare('PRAGMA journal_mode').get() as { journal_mode: string }).journal_mode;
      expect(applicationId).toBe(DORU_APPLICATION_ID);
      expect(journalMode).toBe('delete');
      db.close();
      store.close();
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  });

  it('creates missing parent directories for a new project', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'doru-parent-'));
    try {
      const filePath = join(folder, 'nested', 'deeper', 'family.doru');
      const opener = new ProjectOpener(fsImpl, { open: (p) => TreeStore.open(p) });
      const { summary, store } = await opener.open(filePath);

      expect(summary.created).toBe(true);
      expect(summary.path).toBe(filePath);
      store.close();
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  });

  it('is idempotent on reopen', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'doru-reopen-'));
    try {
      const filePath = join(folder, 'family.doru');
      const opener = new ProjectOpener(fsImpl, { open: (p) => TreeStore.open(p) });
      const first = await opener.open(filePath);
      first.store.close();
      const second = await opener.open(filePath);
      expect(second.summary.created).toBe(false);
      expect(second.summary.path).toBe(filePath);
      second.store.close();
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  });
});
