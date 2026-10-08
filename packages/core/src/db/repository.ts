import type { DatabaseSync } from 'node:sqlite';
import type { DateValue, FamilyRecord, NamePart, NoteRecord, PersonRecord, Sex, SourceRecord } from '../model/types';

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
  insertSource(source: SourceRecord): void;
  deleteSource(id: string): boolean;
  listSources(): SourceRecord[];
  addSourceCitation(sourceId: string, targetType: string, targetId: string): void;
  insertCitation(citation: { id: string; sourceId: string; targetType: string; targetId: string }): void;
  deleteCitation(id: string): boolean;
  getCitation(id: string): { id: string; sourceId: string; targetType: string; targetId: string } | undefined;
  listCitationsFor(targetType: string, targetId: string): Array<{ id: string; source: SourceRecord }>;
  insertNote(note: NoteRecord): void;
  deleteNote(id: string): boolean;
  listNotes(): NoteRecord[];
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

  insertSource(source: SourceRecord): void {
    this.db
      .prepare('INSERT INTO source (id, title, author, publication) VALUES (?, ?, ?, ?)')
      .run(source.id, source.title, source.author ?? null, source.publication ?? null);
  }

  deleteSource(id: string): boolean {
    const result = this.db.prepare('DELETE FROM source WHERE id = ?').run(id);
    return result.changes > 0;
  }

  listSources(): SourceRecord[] {
    const rows = this.db.prepare('SELECT id, title, author, publication FROM source ORDER BY id').all() as unknown as {
      id: string;
      title: string;
      author: string | null;
      publication: string | null;
    }[];
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      author: row.author ?? undefined,
      publication: row.publication ?? undefined,
    }));
  }

  addSourceCitation(sourceId: string, targetType: string, targetId: string): void {
    this.insertCitation({ id: crypto.randomUUID(), sourceId, targetType, targetId });
  }

  insertCitation(citation: { id: string; sourceId: string; targetType: string; targetId: string }): void {
    this.db
      .prepare('INSERT INTO citation (id, source_id, target_type, target_id) VALUES (?, ?, ?, ?)')
      .run(citation.id, citation.sourceId, citation.targetType, citation.targetId);
  }

  deleteCitation(id: string): boolean {
    const result = this.db.prepare('DELETE FROM citation WHERE id = ?').run(id);
    return result.changes > 0;
  }

  getCitation(id: string): { id: string; sourceId: string; targetType: string; targetId: string } | undefined {
    const row = this.db
      .prepare('SELECT id, source_id, target_type, target_id FROM citation WHERE id = ?')
      .get(id) as { id: string; source_id: string; target_type: string; target_id: string } | undefined;
    if (!row) {
      return undefined;
    }
    return { id: row.id, sourceId: row.source_id, targetType: row.target_type, targetId: row.target_id };
  }

  listCitationsFor(targetType: string, targetId: string): Array<{ id: string; source: SourceRecord }> {
    const rows = this.db
      .prepare('SELECT c.id, s.id AS source_id, s.title, s.author, s.publication FROM citation c JOIN source s ON s.id = c.source_id WHERE c.target_type = ? AND c.target_id = ? ORDER BY c.id')
      .all(targetType, targetId) as unknown as Array<{
      id: string;
      source_id: string;
      title: string;
      author: string | null;
      publication: string | null;
    }>;
    return rows.map((row) => ({
      id: row.id,
      source: {
        id: row.source_id,
        title: row.title,
        author: row.author ?? undefined,
        publication: row.publication ?? undefined,
      },
    }));
  }

  insertNote(note: NoteRecord): void {
    this.db
      .prepare('INSERT INTO note (id, text, target_type, target_id) VALUES (?, ?, ?, ?)')
      .run(note.id, note.text, note.targetType ?? null, note.targetId ?? null);
  }

  deleteNote(id: string): boolean {
    const result = this.db.prepare('DELETE FROM note WHERE id = ?').run(id);
    return result.changes > 0;
  }

  listNotes(): NoteRecord[] {
    const rows = this.db.prepare('SELECT id, text, target_type, target_id FROM note ORDER BY id').all() as unknown as {
      id: string;
      text: string;
      target_type: string | null;
      target_id: string | null;
    }[];
    return rows.map((row) => ({
      id: row.id,
      text: row.text,
      targetType: row.target_type ?? undefined,
      targetId: row.target_id ?? undefined,
    }));
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
