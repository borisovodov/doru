import type { DatabaseSync } from 'node:sqlite';
import type { DateValue, NamePart, PersonRecord, Sex } from '../model/types';

export interface PersonQuery {
  search?: string;
  limit?: number;
  offset?: number;
}

interface PersonRow {
  id: string;
  names: string;
  sex: Sex | null;
  birth_json: string | null;
  death_json: string | null;
}

export class PersonRepo {
  constructor(private readonly db: DatabaseSync) {}

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
    const limit = query.limit ?? 100;
    const offset = query.offset ?? 0;
    const search = query.search?.trim();
    if (search) {
      const rows = this.searchByFts(search, limit, offset);
      if (rows !== null) {
        return rows.map(rowToPerson);
      }
    }
    const conditions: string[] = [];
    const params: string[] = [];
    if (search) {
      conditions.push('instr(lower(names), lower(?)) > 0');
      params.push(search);
    }
    const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
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

  private searchByFts(search: string, limit: number, offset: number): PersonRow[] | null {
    try {
      const match = search
        .split(/\s+/)
        .filter((token) => token.length > 0)
        .map((token) => `"${token.replace(/"/g, '""')}"*`)
        .join(' AND ');
      if (!match) {
        return null;
      }
      const rows = this.db
        .prepare(
          `SELECT p.id, p.names, p.sex, p.birth_json, p.death_json
           FROM person_fts f JOIN person p ON p.rowid = f.rowid
           WHERE person_fts MATCH ? ORDER BY rank LIMIT ? OFFSET ?`,
        )
        .all(match, limit, offset) as unknown as PersonRow[];
      return rows;
    } catch {
      return null;
    }
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
