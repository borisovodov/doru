import type { DatabaseSync } from 'node:sqlite';
import type { FamilyRecord } from '../model/types';
import type { TransactionScope } from './transaction';

interface FamilyRow {
  id: string;
  xref: string | null;
}

export class FamilyRepo {
  constructor(
    private readonly db: DatabaseSync,
    private readonly transactions: TransactionScope,
  ) {}

  insertFamily(family: FamilyRecord): void {
    this.transactions.run(() => {
      this.db.prepare('INSERT INTO family (id, xref) VALUES (?, ?)').run(family.id, family.xref ?? null);
      this.replaceLinks(family);
    });
  }

  updateFamily(family: FamilyRecord): void {
    this.transactions.run(() => {
      this.db.prepare('UPDATE family SET xref = ? WHERE id = ?').run(family.xref ?? null, family.id);
      this.db.prepare('DELETE FROM family_partner WHERE family_id = ?').run(family.id);
      this.db.prepare('DELETE FROM family_child WHERE family_id = ?').run(family.id);
      this.replaceLinks(family);
    });
  }

  getFamily(id: string): FamilyRecord | undefined {
    const row = this.db.prepare('SELECT id, xref FROM family WHERE id = ?').get(id) as FamilyRow | undefined;
    if (!row) {
      return undefined;
    }
    return this.hydrate(row);
  }

  deleteFamily(id: string): boolean {
    const result = this.db.prepare('DELETE FROM family WHERE id = ?').run(id);
    return result.changes > 0;
  }

  listFamilies(): FamilyRecord[] {
    const rows = this.db.prepare('SELECT id, xref FROM family ORDER BY id').all() as unknown as FamilyRow[];
    return rows.map((row) => this.hydrate(row));
  }

  /** Every family the person belongs to, as a partner or a child. */
  listFamiliesForPerson(personId: string): FamilyRecord[] {
    const rows = this.db
      .prepare(
        `SELECT id, xref FROM family f
         WHERE EXISTS (SELECT 1 FROM family_partner p WHERE p.family_id = f.id AND p.person_id = ?)
            OR EXISTS (SELECT 1 FROM family_child c WHERE c.family_id = f.id AND c.child_id = ?)
         ORDER BY f.id`,
      )
      .all(personId, personId) as unknown as FamilyRow[];
    return rows.map((row) => this.hydrate(row));
  }

  countFamilies(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS n FROM family').get() as { n: number };
    return row.n;
  }

  private replaceLinks(family: FamilyRecord): void {
    const personExists = this.db.prepare('SELECT 1 FROM person WHERE id = ?');
    const insertPartner = this.db.prepare('INSERT INTO family_partner (family_id, person_id, position) VALUES (?, ?, ?)');
    family.partners.forEach((personId, position) => {
      if (personExists.get(personId) !== undefined) {
        insertPartner.run(family.id, personId, position);
      }
    });
    const insertChild = this.db.prepare('INSERT INTO family_child (family_id, child_id, position) VALUES (?, ?, ?)');
    family.children.forEach((childId, position) => {
      if (personExists.get(childId) !== undefined) {
        insertChild.run(family.id, childId, position);
      }
    });
  }

  private hydrate(row: FamilyRow): FamilyRecord {
    const partners = this.db
      .prepare('SELECT person_id FROM family_partner WHERE family_id = ? ORDER BY position')
      .all(row.id) as unknown as { person_id: string }[];
    const children = this.db
      .prepare('SELECT child_id FROM family_child WHERE family_id = ? ORDER BY position')
      .all(row.id) as unknown as { child_id: string }[];
    return {
      id: row.id,
      xref: row.xref ?? undefined,
      partners: partners.map((entry) => entry.person_id),
      children: children.map((entry) => entry.child_id),
    };
  }
}
