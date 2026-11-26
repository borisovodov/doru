import type { DatabaseSync } from 'node:sqlite';
import { foldCase, type Sex } from '../model/types';
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
 * NameRepo, facts in FactRepo; the repository facade composes the full
 * aggregate.
 */
export interface PersonRow {
  id: string;
  sex: Sex;
  deathStatus?: 'alive' | 'dead' | undefined;
  addressId?: string | undefined;
  createdAt?: number | undefined;
  updatedAt?: number | undefined;
}

interface PersonDbRow {
  id: string;
  sex: string | null;
  death_status: string | null;
  address_id: string | null;
  created_at: number | null;
  updated_at: number | null;
}

export class PersonRepo {
  constructor(
    private readonly db: DatabaseSync,
    private readonly transactions: TransactionScope,
  ) {}

  insertPerson(person: PersonRow): void {
    this.transactions.run(() => {
      this.db
        .prepare(
          'INSERT INTO person (id, sex, death_status, address_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .run(
          person.id,
          person.sex,
          person.deathStatus ?? null,
          person.addressId ?? null,
          person.createdAt ?? null,
          person.updatedAt ?? null,
        );
    });
  }

  updatePerson(person: PersonRow): void {
    this.transactions.run(() => {
      this.db
        .prepare(
          `UPDATE person SET sex = ?, death_status = ?, address_id = ?,
             created_at = ?, updated_at = ? WHERE id = ?`,
        )
        .run(
          person.sex,
          person.deathStatus ?? null,
          person.addressId ?? null,
          person.createdAt ?? null,
          person.updatedAt ?? null,
          person.id,
        );
    });
  }

  setAddressId(id: string, addressId: string | undefined): void {
    this.db.prepare('UPDATE person SET address_id = ? WHERE id = ? AND address_id IS NULL').run(addressId ?? null, id);
  }

  /** Bumps the aggregate edit instant without rewriting names or facts. */
  setUpdatedAt(id: string, updatedAt: number | undefined): void {
    this.db.prepare('UPDATE person SET updated_at = ? WHERE id = ?').run(updatedAt ?? null, id);
  }

  getPerson(id: string): PersonRow | undefined {
    const row = this.db
      .prepare('SELECT id, sex, death_status, address_id, created_at, updated_at FROM person WHERE id = ?')
      .get(id) as PersonDbRow | undefined;
    return row ? toPerson(row) : undefined;
  }

  deletePerson(id: string): boolean {
    return this.transactions.run(() => this.db.prepare('DELETE FROM person WHERE id = ?').run(id).changes > 0);
  }

  /**
   * Persons matching the query, ordered by id. Search is a temporary
   * in-memory substring scan over the stored name parts: there is no search
   * index yet, and SQLite's lower() folds ASCII only, so the comparison runs
   * in JavaScript to keep every script case-insensitive.
   */
  listPersons(query: PersonQuery = {}): PersonRow[] {
    const limit = query.limit ?? 100;
    const offset = query.offset ?? 0;
    const search = query.search?.trim();
    const terms = search ? search.split(/\s+/).filter((term) => term !== '') : [];
    if (terms.length > 0) {
      const haystacks = this.nameSearchText(query.sex);
      const matched = this.listPersonRows(query.sex).filter((row) => {
        const haystack = haystacks.get(row.id);
        return haystack !== undefined && terms.every((term) => haystack.includes(foldCase(term)));
      });
      return matched.slice(offset, offset + limit).map(toPerson);
    }
    const params: Array<string | number> = [];
    let sql = 'SELECT p.id, p.sex, p.death_status, p.address_id, p.created_at, p.updated_at FROM person p';
    if (query.sex) {
      sql += ' WHERE p.sex = ?';
      params.push(query.sex);
    }
    sql += ' ORDER BY p.id LIMIT ? OFFSET ?';
    const rows = this.db.prepare(sql).all(...params, limit, offset) as unknown as PersonDbRow[];
    return rows.map(toPerson);
  }

  /** Every person row in id order, optionally limited to one sex. */
  private listPersonRows(sex: Sex | undefined): PersonDbRow[] {
    const sql =
      'SELECT p.id, p.sex, p.death_status, p.address_id, p.created_at, p.updated_at FROM person p' +
      (sex ? ' WHERE p.sex = ?' : '') +
      ' ORDER BY p.id';
    const rows = this.db.prepare(sql).all(...(sex ? [sex] : [])) as unknown as PersonDbRow[];
    return rows;
  }

  /**
   * Lowercased concatenation of every name-part value per person, across all
   * names and variants. Persons without names stay absent from the map.
   */
  private nameSearchText(sex: Sex | undefined): Map<string, string> {
    const rows = this.db
      .prepare(
        `SELECT pn.person_id AS person_id, np.value AS value
           FROM person_name pn
           JOIN name_part np ON np.name_id = pn.id
           JOIN person p ON p.id = pn.person_id
           ${sex ? 'WHERE p.sex = ?' : ''}
          ORDER BY pn.person_id, pn.position, np.position`,
      )
      .all(...(sex ? [sex] : [])) as unknown as Array<{ person_id: string; value: string }>;
    const valuesByPerson = new Map<string, string[]>();
    for (const row of rows) {
      const values = valuesByPerson.get(row.person_id) ?? [];
      values.push(row.value);
      valuesByPerson.set(row.person_id, values);
    }
    const textByPerson = new Map<string, string>();
    for (const [personId, values] of valuesByPerson) {
      textByPerson.set(personId, foldCase(values.join(' ')));
    }
    return textByPerson;
  }

  listAllPersons(): PersonRow[] {
    const rows = this.db
      .prepare('SELECT id, sex, death_status, address_id, created_at, updated_at FROM person ORDER BY id')
      .all() as unknown as PersonDbRow[];
    return rows.map(toPerson);
  }

  /** Person ids that reference an address, for targeted delete/undo snapshots. */
  listPersonIdsForAddress(addressId: string): string[] {
    const rows = this.db
      .prepare('SELECT id FROM person WHERE address_id = ? ORDER BY id')
      .all(addressId) as unknown as { id: string }[];
    return rows.map((row) => row.id);
  }

  countPersons(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS n FROM person').get() as { n: number };
    return row.n;
  }
}

function toPerson(row: PersonDbRow): PersonRow {
  return {
    id: row.id,
    sex: (row.sex ?? 'U') as Sex,
    deathStatus: row.death_status === 'alive' || row.death_status === 'dead' ? row.death_status : undefined,
    addressId: row.address_id ?? undefined,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}
