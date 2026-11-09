import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { SCHEMA_VERSION } from '../src/db/schema';
import { TreeStore } from '../src/db/store';

describe('TreeStore', () => {
  it('refuses files written by an older schema version', () => {
    const dir = mkdtempSync(join(tmpdir(), 'doru-store-'));
    try {
      const path = join(dir, 'old.doru');
      const db = new DatabaseSync(path);
      db.exec(`PRAGMA user_version = ${SCHEMA_VERSION - 1}`);
      db.close();

      expect(() => TreeStore.open(path)).toThrow(/schema version/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('refuses files written by a newer schema version', () => {
    const dir = mkdtempSync(join(tmpdir(), 'doru-store-'));
    try {
      const path = join(dir, 'newer.doru');
      const db = new DatabaseSync(path);
      db.exec(`PRAGMA user_version = ${SCHEMA_VERSION + 1}`);
      db.close();

      expect(() => TreeStore.open(path)).toThrow(/schema version/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('creates a fresh file at the current version and reopens it', () => {
    const dir = mkdtempSync(join(tmpdir(), 'doru-store-'));
    try {
      const path = join(dir, 'new.doru');
      const store = TreeStore.open(path);
      expect(store.userVersion()).toBe(SCHEMA_VERSION);
      store.close();

      // Reopening a file of the current version must keep working.
      const reopened = TreeStore.open(path);
      expect(reopened.userVersion()).toBe(SCHEMA_VERSION);
      reopened.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
