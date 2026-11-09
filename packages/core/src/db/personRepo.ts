import type { DatabaseSync } from 'node:sqlite';
import type { PersonName, Sex } from '../model/types';
import type { TransactionScope } from './transaction';

export interface PersonQuery {
  search?: string | undefined;
  /** Only persons with this sex ('M', 'F' or 'U'). */
  sex?: Sex | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

/**
 * The identity part of the person aggregate: the row plus its names. The
 * person's facts live in the fact table and are joined by the repository
 * facade when a complete `PersonRecord` is needed.
 */
export interface PersonBase {
  id: string;
  xref?: string | undefined;
  sex: Sex;
  names: PersonName[];
}

interface PersonRow {
  id: string;
  xref: string | null;
  sex: string | null;
}

interface NameRow {
  person_id: string;
  id: string;
  full: string | null;
  given: string | null;
  surname: string | null;
  surname_prefix: string | null;
  nickname: string | null;
  prefix: string | null;
  suffix: string | null;
  type: string | null;
}

export class PersonRepo {
  constructor(
    private readonly db: DatabaseSync,
    private readonly transactions: TransactionScope,
  ) {}

  insertPerson(person: PersonBase): void {
    this.transactions.run(() => {
      this.db
        .prepare('INSERT INTO person (id, xref, sex) VALUES (?, ?, ?)')
        .run(person.id, person.xref ?? null, person.sex);
      this.replaceNames(person);
    });
  }

  updatePerson(person: PersonBase): void {
    this.transactions.run(() => {
      this.db
        .prepare('UPDATE person SET xref = ?, sex = ? WHERE id = ?')
        .run(person.xref ?? null, person.sex, person.id);
      this.replaceNames(person);
    });
  }

  getPerson(id: string): PersonBase | undefined {
    const row = this.db.prepare('SELECT id, xref, sex FROM person WHERE id = ?').get(id) as
      | PersonRow
      | undefined;
    if (!row) {
      return undefined;
    }
    return { id: row.id, xref: row.xref ?? undefined, sex: (row.sex ?? 'U') as Sex, names: this.listNamesForMany([row.id]).get(row.id) ?? [] };
  }

  deletePerson(id: string): boolean {
    return this.transactions.run(() => {
      // The FTS index is not linked by a foreign key: drop the person's
      // search rows before the person row cascades their names away.
      this.db.prepare('DELETE FROM person_name_fts WHERE person_id = ?').run(id);
      const result = this.db.prepare('DELETE FROM person WHERE id = ?').run(id);
      return result.changes > 0;
    });
  }

  listPersons(query: PersonQuery = {}): PersonBase[] {
    const limit = query.limit ?? 100;
    const offset = query.offset ?? 0;
    const search = query.search?.trim();
    const conditions: string[] = [];
    const params: Array<string | number> = [];
    let sql = 'SELECT DISTINCT p.id, p.xref, p.sex FROM person p';
    if (search) {
      const terms = search.split(/\s+/).filter((term) => term !== '');
      if (terms.length > 0) {
        if (terms.every((term) => [...term].length >= 3)) {
          // The trigram index handles substrings of 3+ characters: each
          // whitespace-separated term must appear in the lowercased name.
          const matchQuery = terms.map((term) => `"${term.toLowerCase().replaceAll('"', '""')}"`).join(' AND ');
          conditions.push(
            'p.id IN (SELECT person_id FROM person_name_fts WHERE person_name_fts MATCH ?)',
          );
          params.push(matchQuery);
        } else {
          // The trigram tokenizer cannot match terms shorter than three
          // characters; fall back to a scan of the lowercased FTS content
          // (SQLite's own lower() folds ASCII only, so the stored lowercase
          // column is what makes short queries case-insensitive too).
          sql += ' JOIN person_name_fts fts ON fts.person_id = p.id';
          conditions.push('instr(fts.name, ?) > 0');
          params.push(search.toLowerCase());
        }
      }
    }
    if (query.sex) {
      conditions.push('p.sex = ?');
      params.push(query.sex);
    }
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY p.id LIMIT ? OFFSET ?';
    const rows = this.db.prepare(sql).all(...params, limit, offset) as unknown as PersonRow[];
    const namesByPerson = this.listNamesForMany(rows.map((row) => row.id));
    return rows.map((row) => this.hydrate(row, namesByPerson));
  }

  listAllPersons(): PersonBase[] {
    const rows = this.db.prepare('SELECT id, xref, sex FROM person ORDER BY id').all() as unknown as PersonRow[];
    const namesByPerson = this.listNamesForMany(rows.map((row) => row.id));
    return rows.map((row) => this.hydrate(row, namesByPerson));
  }

  countPersons(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS n FROM person').get() as { n: number };
    return row.n;
  }

  private hydrate(row: PersonRow, namesByPerson: Map<string, PersonName[]>): PersonBase {
    return {
      id: row.id,
      xref: row.xref ?? undefined,
      sex: (row.sex ?? 'U') as Sex,
      names: namesByPerson.get(row.id) ?? [],
    };
  }

  /** Loads the names of many persons in one query, grouped by person id. */
  private listNamesForMany(personIds: string[]): Map<string, PersonName[]> {
    const byPerson = new Map<string, PersonName[]>();
    if (personIds.length === 0) {
      return byPerson;
    }
    const placeholders = personIds.map(() => '?').join(', ');
    const rows = this.db
      .prepare(
        `SELECT person_id, id, full, given, surname, surname_prefix, nickname, prefix, suffix, type
         FROM person_name WHERE person_id IN (${placeholders}) ORDER BY position`,
      )
      .all(...personIds) as unknown as NameRow[];
    for (const row of rows) {
      const names = byPerson.get(row.person_id) ?? [];
      names.push({
        id: row.id,
        full: row.full ?? undefined,
        given: row.given ?? undefined,
        surname: row.surname ?? undefined,
        surnamePrefix: row.surname_prefix ?? undefined,
        nickname: row.nickname ?? undefined,
        prefix: row.prefix ?? undefined,
        suffix: row.suffix ?? undefined,
        type: row.type ?? undefined,
      });
      byPerson.set(row.person_id, names);
    }
    return byPerson;
  }

  private replaceNames(person: PersonBase): void {
    this.db.prepare('DELETE FROM person_name WHERE person_id = ?').run(person.id);
    this.db.prepare('DELETE FROM person_name_fts WHERE person_id = ?').run(person.id);
    const insert = this.db.prepare(
      'INSERT INTO person_name (id, person_id, full, given, surname, surname_prefix, nickname, prefix, suffix, type, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    );
    const insertFts = this.db.prepare('INSERT INTO person_name_fts (person_id, name) VALUES (?, ?)');
    person.names.forEach((name, index) => {
      insert.run(
        name.id,
        person.id,
        name.full ?? null,
        name.given ?? null,
        name.surname ?? null,
        name.surnamePrefix ?? null,
        name.nickname ?? null,
        name.prefix ?? null,
        name.suffix ?? null,
        name.type ?? null,
        index,
      );
      // The FTS index stores the lowercased join of the searchable parts so
      // matching is case-insensitive in every script (SQLite's lower() only
      // folds ASCII).
      const searchable = [name.full, name.given, name.surname]
        .filter((part): part is string => (part ?? '').trim() !== '')
        .join(' ')
        .toLowerCase();
      if (searchable !== '') {
        insertFts.run(person.id, searchable);
      }
    });
  }
}
