import type { DatabaseSync } from 'node:sqlite';
import type { NamePart, PersonName } from '../model/types';
import type { DateRepo } from './dateRepo';

interface NameRow {
  id: string;
  person_id: string;
  variant_of_id: string | null;
  kind: string | null;
  language: string | null;
  type: string | null;
  primary_flag: number;
  date_id: string | null;
  position: number;
}

interface PartRow {
  id: string;
  name_id: string;
  part_kind: string;
  value: string;
}

/**
 * The single writer of person_name, name_part and the person-name FTS index.
 * Names are stored as rows plus part rows; the flat pieces on the model
 * (given, surname, …) are projections of the first part of each kind.
 */
export class NameRepo {
  private readonly insertName: ReturnType<DatabaseSync['prepare']>;
  private readonly insertPart: ReturnType<DatabaseSync['prepare']>;
  private readonly insertFts: ReturnType<DatabaseSync['prepare']>;

  constructor(
    private readonly db: DatabaseSync,
    private readonly dates: DateRepo,
  ) {
    this.insertName = this.db.prepare(
      `INSERT INTO person_name (id, person_id, variant_of_id, kind, language, type, primary_flag, date_id, position)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    this.insertPart = this.db.prepare(
      'INSERT INTO name_part (id, name_id, part_kind, value, position) VALUES (?, ?, ?, ?, ?)',
    );
    this.insertFts = this.db.prepare('INSERT INTO person_name_fts (person_id, name) VALUES (?, ?)');
  }

  /**
   * Replaces every name of a person, wholesale: names, their parts, their
   * variants and the FTS rows are rewritten; date rows no longer referenced
   * are deleted. Callers may pass flat name pieces (`given`, `surname`, …) —
   * they become parts — or explicit `parts`.
   */
  replaceNamesForPerson(personId: string, names: PersonName[]): void {
    const oldDateIds = new Set(this.dateIdsOfPerson(personId));
    this.db.prepare('DELETE FROM person_name_fts WHERE person_id = ?').run(personId);
    this.db.prepare('DELETE FROM person_name WHERE person_id = ?').run(personId);

    const newDateIds = new Set<string>();
    names.forEach((name, position) => {
      this.writeName(personId, name, null, position, newDateIds);
    });
    for (const stale of oldDateIds) {
      if (!newDateIds.has(stale)) {
        this.dates.delete(stale);
      }
    }
  }

  /** Removes the person's FTS rows before the person row itself is deleted. */
  deleteFtsForPerson(personId: string): void {
    this.db.prepare('DELETE FROM person_name_fts WHERE person_id = ?').run(personId);
  }

  /** Every name of one person: top-level names with their parts and variants. */
  listNamesForPerson(personId: string): PersonName[] {
    return this.listNamesForMany([personId]).get(personId) ?? [];
  }

  /** Names of many persons in one query, grouped by person id. */
  listNamesForMany(personIds: string[]): Map<string, PersonName[]> {
    const byPerson = new Map<string, PersonName[]>();
    if (personIds.length === 0) {
      return byPerson;
    }
    const placeholders = personIds.map(() => '?').join(', ');
    const rows = this.db
      .prepare(
        `SELECT id, person_id, variant_of_id, kind, language, type, primary_flag, date_id, position
         FROM person_name WHERE person_id IN (${placeholders}) ORDER BY position`,
      )
      .all(...personIds) as unknown as NameRow[];
    if (rows.length === 0) {
      return byPerson;
    }
    const nameIds = rows.map((row) => row.id);
    const partsByName = this.partsForNames(nameIds);
    const dateIds = rows.map((row) => row.date_id).filter((id): id is string => id !== null);
    const datesById = this.dates.getMany(dateIds);

    const childrenByParent = new Map<string, NameRow[]>();
    const topLevel: NameRow[] = [];
    for (const row of rows) {
      if (row.variant_of_id !== null) {
        const siblings = childrenByParent.get(row.variant_of_id) ?? [];
        siblings.push(row);
        childrenByParent.set(row.variant_of_id, siblings);
      } else {
        topLevel.push(row);
      }
    }
    for (const row of topLevel) {
      const names = byPerson.get(row.person_id) ?? [];
      names.push(this.hydrate(row, partsByName, datesById, childrenByParent));
      byPerson.set(row.person_id, names);
    }
    return byPerson;
  }

  private writeName(
    personId: string,
    name: PersonName,
    variantOfId: string | null,
    position: number,
    dateIds: Set<string>,
  ): void {
    const dateId = name.date ? this.dates.upsert(name.date) : null;
    if (dateId !== null) {
      dateIds.add(dateId);
    }
    this.insertName.run(
      name.id,
      personId,
      variantOfId,
      name.kind ?? null,
      name.language ?? null,
      name.type ?? null,
      name.primary ? 1 : 0,
      dateId,
      position,
    );
    const parts = [...(name.parts ?? partsFromFlat(name))];
    if (name.full !== undefined && name.full.trim() !== '' && !parts.some((part) => part.kind === 'full')) {
      // The verbatim display form is authoritative: keep it alongside the
      // pieces even when the caller supplied explicit parts.
      parts.push({ id: crypto.randomUUID(), kind: 'full', value: name.full.trim(), position: parts.length });
    }
    parts.forEach((part, index) => {
      this.insertPart.run(part.id, name.id, part.kind, part.value, index);
    });
    const searchable = parts
      .map((part) => part.value)
      .filter((value) => value.trim() !== '')
      .join(' ')
      .toLowerCase();
    if (searchable !== '') {
      this.insertFts.run(personId, searchable);
    }
    (name.variants ?? []).forEach((variant, variantPosition) => {
      this.writeName(personId, variant, name.id, variantPosition, dateIds);
    });
  }

  private hydrate(
    row: NameRow,
    partsByName: Map<string, NamePart[]>,
    datesById: Map<string, import('../model/types').DateValue>,
    childrenByParent: Map<string, NameRow[]>,
  ): PersonName {
    const parts = partsByName.get(row.id) ?? [];
    const variants = (childrenByParent.get(row.id) ?? [])
      .sort((a, b) => a.position - b.position)
      .map((child) => this.hydrate(child, partsByName, datesById, childrenByParent));
    const flat = flatFromParts(parts);
    return {
      id: row.id,
      kind: (row.kind ?? undefined) as PersonName['kind'],
      language: row.language ?? undefined,
      type: row.type ?? undefined,
      primary: row.primary_flag === 1 ? true : undefined,
      date: row.date_id !== null ? datesById.get(row.date_id) : undefined,
      ...flat,
      parts: parts.length > 0 ? parts : undefined,
      variants: variants.length > 0 ? variants : undefined,
    };
  }

  private partsForNames(nameIds: string[]): Map<string, NamePart[]> {
    const byName = new Map<string, NamePart[]>();
    if (nameIds.length === 0) {
      return byName;
    }
    const placeholders = nameIds.map(() => '?').join(', ');
    const rows = this.db
      .prepare(
        `SELECT id, name_id, part_kind, value FROM name_part WHERE name_id IN (${placeholders}) ORDER BY position`,
      )
      .all(...nameIds) as unknown as PartRow[];
    for (const row of rows) {
      const parts = byName.get(row.name_id) ?? [];
      parts.push({
        id: row.id,
        kind: row.part_kind as NamePart['kind'],
        value: row.value,
        position: parts.length,
      });
      byName.set(row.name_id, parts);
    }
    return byName;
  }

  private dateIdsOfPerson(personId: string): string[] {
    const rows = this.db
      .prepare('SELECT date_id FROM person_name WHERE person_id = ? AND date_id IS NOT NULL')
      .all(personId) as unknown as { date_id: string }[];
    return rows.map((row) => row.date_id);
  }
}

/** The flat display pieces of a name, derived from its parts. */
export function flatFromParts(
  parts: NamePart[],
): Pick<PersonName, 'full' | 'given' | 'surname' | 'surnamePrefix' | 'nickname' | 'prefix' | 'suffix'> {
  const first = (kind: NamePart['kind']): string | undefined => parts.find((part) => part.kind === kind)?.value;
  return {
    full: first('full'),
    given: first('given'),
    surname: first('surname'),
    surnamePrefix: first('surnamePrefix'),
    nickname: first('nickname'),
    prefix: first('prefix'),
    suffix: first('suffix'),
  };
}

/**
 * Turns the flat name pieces into part rows: one part per piece, in display
 * order, plus a 'full' part carrying the verbatim display form whenever it
 * is set. The 'full' part is kept even when it equals the pieces joined —
 * the stored form is authoritative for round-trips.
 */
export function partsFromFlat(name: PersonName): NamePart[] {
  const pieces: Array<[NamePart['kind'], string | undefined]> = [
    ['prefix', name.prefix],
    ['given', name.given],
    ['nickname', name.nickname],
    ['surnamePrefix', name.surnamePrefix],
    ['surname', name.surname],
    ['suffix', name.suffix],
  ];
  const parts: NamePart[] = [];
  pieces.forEach(([kind, value]) => {
    if (value !== undefined && value !== '') {
      parts.push({ id: crypto.randomUUID(), kind, value, position: parts.length });
    }
  });
  if (name.full !== undefined && name.full.trim() !== '') {
    parts.push({ id: crypto.randomUUID(), kind: 'full', value: name.full.trim(), position: parts.length });
  }
  return parts;
}
