import { describe, expect, it } from 'vitest';
import { access, appendFile, copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { DORU_APPLICATION_ID, SCHEMA_VERSION } from '../src/db/schema';
import { TreeStore } from '../src/db/store';
import type { IFileSystem } from '../src/fs';
import { DEFAULT_SETTINGS, DEFAULT_THEME_CSS } from '../src/project/layout';
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
  it('creates the full template for a new project', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'doru-new-'));
    try {
      const opener = new ProjectOpener(fsImpl, { open: (p) => TreeStore.open(p) });
      const { summary, store } = await opener.open(folder);

      expect(summary.created.sort()).toEqual([
        'export/',
        'history.jsonl',
        'media/',
        'settings.json',
        'theme.css',
        'tree.doru',
      ]);
      expect(summary.healed).toEqual([]);
      expect(summary.schemaVersion).toBe(SCHEMA_VERSION);

      const settings = await readFile(join(folder, 'settings.json'), 'utf8');
      const theme = await readFile(join(folder, 'theme.css'), 'utf8');
      expect(settings).toBe(DEFAULT_SETTINGS);
      expect(theme).toBe(DEFAULT_THEME_CSS);
      expect(await readdir(join(folder, 'media'))).toEqual([]);
      expect(await readdir(join(folder, 'export'))).toEqual([]);

      const db = new DatabaseSync(summary.treePath);
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

  it('silently heals a partial project without touching existing files', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'doru-heal-'));
    try {
      await writeFile(join(folder, 'settings.json'), '{"locale": "ru"}\n', 'utf8');

      const opener = new ProjectOpener(fsImpl, { open: (p) => TreeStore.open(p) });
      const { summary, store } = await opener.open(folder);

      expect(summary.created).toEqual([]);
      expect(summary.healed.sort()).toEqual(['export/', 'history.jsonl', 'media/', 'theme.css', 'tree.doru']);
      expect(await readFile(join(folder, 'settings.json'), 'utf8')).toBe('{"locale": "ru"}\n');
      store.close();
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  });

  it('is idempotent on reopen', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'doru-reopen-'));
    try {
      const opener = new ProjectOpener(fsImpl, { open: (p) => TreeStore.open(p) });
      const first = await opener.open(folder);
      first.store.close();
      const second = await opener.open(folder);
      expect(second.summary.created).toEqual([]);
      expect(second.summary.healed).toEqual([]);
      second.store.close();
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  });

  it('respects an existing tree file with a custom name', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'doru-custom-'));
    try {
      const customPath = join(folder, 'family.doru');
      TreeStore.open(customPath).close();

      const opener = new ProjectOpener(fsImpl, { open: (p) => TreeStore.open(p) });
      const { summary, store } = await opener.open(folder);

      expect(summary.treePath).toBe(customPath);
      expect(summary.healed).not.toContain('family.doru');
      store.close();
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  });
});
