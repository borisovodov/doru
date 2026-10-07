import type { DatabaseSync } from 'node:sqlite';
import type { DateValue, FamilyRecord, NamePart, PersonRecord, Sex } from '../model/types';

interface PersonRow {
  id: string;
  names: string;
  sex: Sex | null;
  birth_json: string | null;
  death_json: string | null;
}

interface FamilyRow {
  id: string;
}

export interface PersonQuery {
  search?: string;
  limit?: number;
  offset?: number;
}

export interface TreeRepository {
  insertPerson(person: PersonRecord): void;
  updatePerson(person: PersonRecord): void;
  getPerson(id: string): PersonRecord | undefined;
  deletePerson(id: string): boolean;
  listPersons(query?: PersonQuery): PersonRecord[];
  listAllPersons(): PersonRecord[];
  countPersons(): number;
  countFamilies(): number;
  insertFamily(family: FamilyRecord): void;
  updateFamily(family: FamilyRecord): void;
  getFamily(id: string): FamilyRecord | undefined;
  deleteFamily(id: string): boolean;
  listFamilies(): FamilyRecord[];
  transaction<T>(fn: () => T): T;
}

export class SqliteTreeRepository implements TreeRepository {
  private readonly db: DatabaseSync;
  private transactionDepth = 0;

  constructor(db: DatabaseSync) {
    this.db = db;
  }

  insertPerson(person: PersonRecord): void {
    const now = new Date().toISOString();
    this.db
      .prepare(
        'INSERT INTO person (id, names, sex, birth_json, death_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        person.id,
        JSON.stringify(person.names),
        person.sex,
        dateToJson(person.birth),
        dateToJson(person.death),
        now,
        now,
      );
  }

  updatePerson(person: PersonRecord): void {
    this.db
      .prepare(
        'UPDATE person SET names = ?, sex = ?, birth_json = ?, death_json = ?, updated_at = ? WHERE id = ?',
      )
      .run(
        JSON.stringify(person.names),
        person.sex,
        dateToJson(person.birth),
        dateToJson(person.death),
        new Date().toISOString(),
        person.id,
      );
  }

  getPerson(id: string): PersonRecord | undefined {
    const row = this.db.prepare('SELECT id, names, sex, birth_json, death_json FROM person WHERE id = ?').get(id) as
      | PersonRow
      | undefined;
    return row ? rowToPerson(row) : undefined;
  }

  deletePerson(id: string): boolean {
    const result = this.db.prepare('DELETE FROM person WHERE id = ?').run(id);
    return result.changes > 0;
  }

  listPersons(query: PersonQuery = {}): PersonRecord[] {
    const conditions: string[] = [];
    const params: string[] = [];
    if (query.search !== undefined && query.search !== '') {
      conditions.push('instr(lower(names), lower(?)) > 0');
      params.push(query.search);
    }
    const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
    const limit = query.limit ?? 100;
    const offset = query.offset ?? 0;
    const sql = `SELECT id, names, sex, birth_json, death_json FROM person${where} ORDER BY id LIMIT ? OFFSET ?`;
    const rows = this.db.prepare(sql).all(...params, limit, offset) as unknown as PersonRow[];
    return rows.map(rowToPerson);
  }

  listAllPersons(): PersonRecord[] {
    const rows = this.db
      .prepare('SELECT id, names, sex, birth_json, death_json FROM person ORDER BY id')
      .all() as unknown as PersonRow[];
    return rows.map(rowToPerson);
  }

  countPersons(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS n FROM person').get() as { n: number };
    return row.n;
  }

  countFamilies(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS n FROM family').get() as { n: number };
    return row.n;
  }

  insertFamily(family: FamilyRecord): void {
    this.transaction(() => {
      const now = new Date().toISOString();
      this.db
        .prepare('INSERT INTO family (id, created_at, updated_at) VALUES (?, ?, ?)')
        .run(family.id, now, now);
      this.replaceLinks(family);
    });
  }

  updateFamily(family: FamilyRecord): void {
    this.transaction(() => {
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

  transaction<T>(fn: () => T): T {
    if (this.transactionDepth > 0) {
      return fn();
    }
    this.db.exec('BEGIN IMMEDIATE');
    this.transactionDepth = 1;
    try {
      const result = fn();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    } finally {
      this.transactionDepth = 0;
    }
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

function dateToJson(date: DateValue | undefined): string | null {
  return date ? JSON.stringify(date) : null;
}

function rowToPerson(row: PersonRow): PersonRecord {
  return {
    id: row.id,
    names: JSON.parse(row.names) as NamePart[],
    sex: row.sex ?? 'U',
    birth: row.birth_json ? (JSON.parse(row.birth_json) as DateValue) : undefined,
    death: row.death_json ? (JSON.parse(row.death_json) as DateValue) : undefined,
  };
}
