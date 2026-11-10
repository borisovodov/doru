import type { DatabaseSync } from 'node:sqlite';
import type { Sex } from '../model/types';
import type { TransactionScope } from './transaction';

export interface PersonQuery {
  search?: string | undefined;
  /** Only persons with this sex ('M', 'F' or 'U'). */
  sex?: Sex | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

/**
 * The identity row of a person: the person table only. Names live in
 * NameRepo (with the FTS index), facts in FactRepo; the repository facade
 * composes the full aggregate.
 */
export interface PersonRow {
  id: string;
  xref?: string | undefined;
  sex: Sex;
}

interface PersonDbRow {
  id: string;
  xref: string | null;
  sex: string | null;
}

export class PersonRepo {
  constructor(
    private readonly db: DatabaseSync,
    private readonly transactions: TransactionScope,
  ) {}

  insertPerson(person: PersonRow): void {
    this.transactions.run(() => {
      this.db
        .prepare('INSERT INTO person (id, xref, sex) VALUES (?, ?, ?)')
        .run(person.id, person.xref ?? null, person.sex);
    });
  }

  updatePerson(person: PersonRow): void {
    this.transactions.run(() => {
      this.db.prepare('UPDATE person SET xref = ?, sex = ? WHERE id = ?').run(person.xref ?? null, person.sex, person.id);
    });
  }

  getPerson(id: string): PersonRow | undefined {
    const row = this.db.prepare('SELECT id, xref, sex FROM person WHERE id = ?').get(id) as PersonDbRow | undefined;
    return row ? toPerson(row) : undefined;
  }

  deletePerson(id: string): boolean {
    return this.transactions.run(() => this.db.prepare('DELETE FROM person WHERE id = ?').run(id).changes > 0);
  }

  /**
   * Persons matching the query, ordered by id. The name search runs against
   * the FTS index owned by NameRepo (this repo only reads it): terms of 3+
   * characters go through the trigram MATCH, shorter terms fall back to a
   * scan of the lowercased FTS content so every query keeps working.
   */
  listPersons(query: PersonQuery = {}): PersonRow[] {
    const limit = query.limit ?? 100;
    const offset = query.offset ?? 0;
    const search = query.search?.trim();
    const conditions: string[] = [];
    const params: Array<string | number> = [];
    if (search) {
      const terms = search.split(/\s+/).filter((term) => term !== '');
      if (terms.length > 0) {
        if (terms.every((term) => [...term].length >= 3)) {
          const matchQuery = terms.map((term) => `"${term.toLowerCase().replaceAll('"', '""')}"`).join(' AND ');
          conditions.push(
            'p.id IN (SELECT person_id FROM person_name_fts WHERE person_name_fts MATCH ?)',
          );
          params.push(matchQuery);
        } else {
          conditions.push(
            'p.id IN (SELECT person_id FROM person_name_fts fts WHERE instr(fts.name, ?) > 0)',
          );
          params.push(search.toLowerCase());
        }
      }
    }
    if (query.sex) {
      conditions.push('p.sex = ?');
      params.push(query.sex);
    }
    let sql = 'SELECT p.id, p.xref, p.sex FROM person p';
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY p.id LIMIT ? OFFSET ?';
    const rows = this.db.prepare(sql).all(...params, limit, offset) as unknown as PersonDbRow[];
    return rows.map(toPerson);
  }

  listAllPersons(): PersonRow[] {
    const rows = this.db.prepare('SELECT id, xref, sex FROM person ORDER BY id').all() as unknown as PersonDbRow[];
    return rows.map(toPerson);
  }

  countPersons(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS n FROM person').get() as { n: number };
    return row.n;
  }
}

function toPerson(row: PersonDbRow): PersonRow {
  return { id: row.id, xref: row.xref ?? undefined, sex: (row.sex ?? 'U') as Sex };
}
