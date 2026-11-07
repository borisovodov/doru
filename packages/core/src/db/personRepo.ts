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
    return { id: row.id, xref: row.xref ?? undefined, sex: (row.sex ?? 'U') as Sex, names: this.listNames(row.id) };
  }

  deletePerson(id: string): boolean {
    const result = this.db.prepare('DELETE FROM person WHERE id = ?').run(id);
    return result.changes > 0;
  }

  listPersons(query: PersonQuery = {}): PersonBase[] {
    const limit = query.limit ?? 100;
    const offset = query.offset ?? 0;
    const search = query.search?.trim();
    const conditions: string[] = [];
    const params: string[] = [];
    let sql = 'SELECT DISTINCT p.id, p.xref, p.sex FROM person p';
    if (search) {
      sql +=
        ' JOIN person_name n ON n.person_id = p.id' +
        ' WHERE (instr(lower(coalesce(n.full, \'\')), lower(?)) > 0' +
        ' OR instr(lower(coalesce(n.given, \'\')), lower(?)) > 0' +
        ' OR instr(lower(coalesce(n.surname, \'\')), lower(?)) > 0)';
      params.push(search, search, search);
    }
    if (query.sex) {
      conditions.push('p.sex = ?');
      params.push(query.sex);
    }
    if (conditions.length > 0) {
      sql += (search ? ' AND ' : ' WHERE ') + conditions.join(' AND ');
    }
    sql += ' ORDER BY p.id LIMIT ? OFFSET ?';
    const rows = this.db.prepare(sql).all(...params, limit, offset) as unknown as PersonRow[];
    return rows.map((row) => this.hydrate(row));
  }

  listAllPersons(): PersonBase[] {
    const rows = this.db.prepare('SELECT id, xref, sex FROM person ORDER BY id').all() as unknown as PersonRow[];
    return rows.map((row) => this.hydrate(row));
  }

  countPersons(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS n FROM person').get() as { n: number };
    return row.n;
  }

  private hydrate(row: PersonRow): PersonBase {
    return {
      id: row.id,
      xref: row.xref ?? undefined,
      sex: (row.sex ?? 'U') as Sex,
      names: this.listNames(row.id),
    };
  }

  private listNames(personId: string): PersonName[] {
    const rows = this.db
      .prepare(
        'SELECT id, full, given, surname, surname_prefix, nickname, prefix, suffix, type FROM person_name WHERE person_id = ? ORDER BY position',
      )
      .all(personId) as unknown as NameRow[];
    return rows.map((row) => ({
      id: row.id,
      full: row.full ?? undefined,
      given: row.given ?? undefined,
      surname: row.surname ?? undefined,
      surnamePrefix: row.surname_prefix ?? undefined,
      nickname: row.nickname ?? undefined,
      prefix: row.prefix ?? undefined,
      suffix: row.suffix ?? undefined,
      type: row.type ?? undefined,
    }));
  }

  private replaceNames(person: PersonBase): void {
    this.db.prepare('DELETE FROM person_name WHERE person_id = ?').run(person.id);
    const insert = this.db.prepare(
      'INSERT INTO person_name (id, person_id, full, given, surname, surname_prefix, nickname, prefix, suffix, type, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    );
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
    });
  }
}
