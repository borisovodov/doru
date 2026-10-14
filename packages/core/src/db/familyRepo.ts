import type { DatabaseSync } from 'node:sqlite';
import type { FamilyRecord } from '../model/types';
import type { TransactionScope } from './transaction';

interface FamilyRow {
  id: string;
}

export class FamilyRepo {
  constructor(
    private readonly db: DatabaseSync,
    private readonly transactions: TransactionScope,
  ) {}

  insertFamily(family: FamilyRecord): void {
    this.transactions.run(() => {
      const now = new Date().toISOString();
      this.db
        .prepare('INSERT INTO family (id, created_at, updated_at) VALUES (?, ?, ?)')
        .run(family.id, now, now);
      this.replaceLinks(family);
    });
  }

  updateFamily(family: FamilyRecord): void {
    this.transactions.run(() => {
      this.db.prepare('UPDATE family SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), family.id);
      this.db.prepare('DELETE FROM family_parent WHERE family_id = ?').run(family.id);
      this.db.prepare('DELETE FROM family_child WHERE family_id = ?').run(family.id);
      this.replaceLinks(family);
    });
  }

  getFamily(id: string): FamilyRecord | undefined {
    const row = this.db.prepare('SELECT id FROM family WHERE id = ?').get(id) as FamilyRow | undefined;
    if (!row) {
      return undefined;
    }
    return this.hydrateFamily(row.id);
  }

  deleteFamily(id: string): boolean {
    const result = this.db.prepare('DELETE FROM family WHERE id = ?').run(id);
    return result.changes > 0;
  }

  listFamilies(): FamilyRecord[] {
    const rows = this.db.prepare('SELECT id FROM family ORDER BY id').all() as unknown as FamilyRow[];
    return rows.map((row) => this.hydrateFamily(row.id));
  }

  countFamilies(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS n FROM family').get() as { n: number };
    return row.n;
  }

  private replaceLinks(family: FamilyRecord): void {
    const personExists = this.db.prepare('SELECT 1 FROM person WHERE id = ?');
    const insertParent = this.db.prepare('INSERT INTO family_parent (family_id, parent_id) VALUES (?, ?)');
    for (const parentId of family.parents) {
      if (personExists.get(parentId) !== undefined) {
        insertParent.run(family.id, parentId);
      }
    }
    const insertChild = this.db.prepare('INSERT INTO family_child (family_id, child_id) VALUES (?, ?)');
    for (const childId of family.children) {
      if (personExists.get(childId) !== undefined) {
        insertChild.run(family.id, childId);
      }
    }
  }

  private hydrateFamily(id: string): FamilyRecord {
    const parents = this.db.prepare('SELECT parent_id FROM family_parent WHERE family_id = ?').all(id) as unknown as {
      parent_id: string;
    }[];
    const children = this.db.prepare('SELECT child_id FROM family_child WHERE family_id = ?').all(id) as unknown as {
      child_id: string;
    }[];
    return {
      id,
      parents: parents.map((row) => row.parent_id),
      children: children.map((row) => row.child_id),
    };
  }
}
