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
  variant_type: string | null;
  primary_flag: number;
  position: number;
  call_name: string | null;
  middle_name: string | null;
  patronymic: string | null;
  married_name: string | null;
  aka: string | null;
  hebrew_name: string | null;
  title: string | null;
  short_name: string | null;
  name_as_recorded: string | null;
  given_name_used: string | null;
}

interface PartRow {
  id: string;
  name_id: string;
  part_kind: string;
  value: string;
}

/**
 * The single writer of person_name and name_part. Names are stored as rows
 * plus part rows; the flat pieces on the model (given, surname, …) are
 * projections of the first part of each kind.
 */
export class NameRepo {
  private readonly insertName: ReturnType<DatabaseSync['prepare']>;
  private readonly insertPart: ReturnType<DatabaseSync['prepare']>;

  constructor(
    private readonly db: DatabaseSync,
    private readonly dates: DateRepo,
  ) {
    this.insertName = this.db.prepare(
      `INSERT INTO person_name (id, person_id, variant_of_id, kind, language, type, variant_type,
         primary_flag, position, call_name, middle_name, patronymic, married_name, aka,
         hebrew_name, title, short_name, name_as_recorded, given_name_used)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    this.insertPart = this.db.prepare(
      'INSERT INTO name_part (id, name_id, part_kind, value, position) VALUES (?, ?, ?, ?, ?)',
    );
  }

  /**
   * Replaces every name of a person, wholesale: names, their parts and their
   * variants are rewritten; date rows no longer referenced are deleted.
   * Callers may pass flat name pieces (`given`, `surname`, …) — they become
   * parts — or explicit `parts`.
   */
  replaceNamesForPerson(personId: string, names: PersonName[]): Set<string> {
    const existingNames = new Map<string, PersonName>();
    const remember = (name: PersonName): void => {
      existingNames.set(name.id, name);
      for (const variant of name.variants ?? []) {
        remember(variant);
      }
    };
    for (const name of this.listNamesForPerson(personId)) {
      remember(name);
    }
    const reserved = this.dates.reservationsFor('person_name', [...existingNames.keys()]);
    this.db.prepare('DELETE FROM person_name WHERE person_id = ?').run(personId);

    const partIds = new Set<string>();
    const reservedPartIds = new Set<string>();
    const reserve = (name: PersonName): void => {
      for (const part of name.parts ?? []) {
        reservedPartIds.add(part.id);
      }
      for (const variant of name.variants ?? []) {
        reserve(variant);
      }
    };
    names.forEach(reserve);
    names.forEach((name, position) => {
      this.writeName(personId, name, null, position, existingNames, partIds, reservedPartIds, reserved);
    });
    return partIds;
  }

  /** Deletes every name of a person; owner triggers delete their dates. */
  deleteNamesForPerson(personId: string): void {
    this.db.prepare('DELETE FROM person_name WHERE person_id = ?').run(personId);
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
        `SELECT id, person_id, variant_of_id, kind, language, type, variant_type, primary_flag, position,
           call_name, middle_name, patronymic, married_name, aka, hebrew_name, title, short_name,
           name_as_recorded, given_name_used
         FROM person_name WHERE person_id IN (${placeholders}) ORDER BY position`,
      )
      .all(...personIds) as unknown as NameRow[];
    if (rows.length === 0) {
      return byPerson;
    }
    const nameIds = rows.map((row) => row.id);
    const partsByName = this.partsForNames(nameIds);
    const datesByOwner = this.dates.getManyForOwners('person_name', nameIds);

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
      names.push(this.hydrate(row, partsByName, datesByOwner, childrenByParent));
      byPerson.set(row.person_id, names);
    }
    return byPerson;
  }

  private writeName(
    personId: string,
    name: PersonName,
    variantOfId: string | null,
    position: number,
    existingNames: Map<string, PersonName>,
    partIds: Set<string>,
    reservedPartIds: Set<string>,
    reservedDates: ReadonlyMap<string, string>,
  ): void {
    this.insertName.run(
      name.id,
      personId,
      variantOfId,
      name.kind ?? null,
      name.language ?? null,
      name.type ?? null,
      name.variantType ?? null,
      name.primary ? 1 : 0,
      position,
      name.callName ?? null,
      name.middleName ?? null,
      name.patronymic ?? null,
      name.marriedName ?? null,
      name.aka ?? null,
      name.hebrewName ?? null,
      name.title ?? null,
      name.shortName ?? null,
      name.nameAsRecorded ?? null,
      name.givenNameUsed ?? null,
    );
    this.dates.upsertForOwner('person_name', name.id, 'period', name.date, reservedDates);
    const existingParts = existingNames.get(name.id)?.parts;
    const parts = [...(name.parts ?? partsFromFlat(name, existingParts, reservedPartIds))];
    if (name.full !== undefined && name.full.trim() !== '' && !parts.some((part) => part.kind === 'full')) {
      // The verbatim display form is authoritative: keep it alongside the
      // pieces even when the caller supplied explicit parts.
      const existingFull = existingParts?.find(
        (part) => part.kind === 'full' && !parts.some((entry) => entry.id === part.id) && !reservedPartIds.has(part.id),
      );
      const fullId = existingFull?.id ?? freshPartId(reservedPartIds);
      parts.push({
        id: fullId,
        kind: 'full',
        value: name.full.trim(),
        position: parts.length,
      });
    }
    parts.forEach((part, index) => {
      partIds.add(part.id);
      this.insertPart.run(part.id, name.id, part.kind, part.value, index);
    });
    (name.variants ?? []).forEach((variant, variantPosition) => {
      this.writeName(
        personId,
        variant,
        name.id,
        variantPosition,
        existingNames,
        partIds,
        reservedPartIds,
        reservedDates,
      );
    });
  }

  private hydrate(
    row: NameRow,
    partsByName: Map<string, NamePart[]>,
    datesByOwner: Map<string, Map<string, import('../model/types').DateValue>>,
    childrenByParent: Map<string, NameRow[]>,
  ): PersonName {
    const parts = partsByName.get(row.id) ?? [];
    const variants = (childrenByParent.get(row.id) ?? [])
      .sort((a, b) => a.position - b.position)
      .map((child) => this.hydrate(child, partsByName, datesByOwner, childrenByParent));
    const flat = flatFromParts(parts);
    return {
      id: row.id,
      kind: (row.kind ?? undefined) as PersonName['kind'],
      language: row.language ?? undefined,
      type: row.type ?? undefined,
      variantType: row.variant_type ?? undefined,
      primary: row.primary_flag === 1 ? true : undefined,
      date: datesByOwner.get(row.id)?.get('period'),
      ...flat,
      callName: row.call_name ?? undefined,
      middleName: row.middle_name ?? undefined,
      patronymic: row.patronymic ?? undefined,
      marriedName: row.married_name ?? undefined,
      aka: row.aka ?? undefined,
      hebrewName: row.hebrew_name ?? undefined,
      title: row.title ?? undefined,
      shortName: row.short_name ?? undefined,
      nameAsRecorded: row.name_as_recorded ?? undefined,
      givenNameUsed: row.given_name_used ?? undefined,
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

function freshPartId(reservedIds?: Set<string>): string {
  let id = crypto.randomUUID();
  while (reservedIds?.has(id) === true) {
    id = crypto.randomUUID();
  }
  return id;
}

/**
 * Turns the flat name pieces into part rows: one part per piece, in display
 * order, plus a 'full' part carrying the verbatim display form whenever it
 * is set. The 'full' part is kept even when it equals the pieces joined —
 * the stored form is authoritative for round-trips.
 */
export function partsFromFlat(name: PersonName, existingParts?: NamePart[], reservedIds?: Set<string>): NamePart[] {
  const pieces: Array<[NamePart['kind'], string | undefined]> = [
    ['prefix', name.prefix],
    ['given', name.given],
    ['nickname', name.nickname],
    ['surnamePrefix', name.surnamePrefix],
    ['surname', name.surname],
    ['suffix', name.suffix],
  ];
  const parts: NamePart[] = [];
  const usedIds = new Set<string>();
  const partId = (kind: NamePart['kind']): string => {
    // The flat field was always supplied by the first unused part of that
    // kind, so an edit keeps that part's id even when the value now matches a
    // later part. Explicit `parts` callers pick a different part themselves.
    const candidates = (existingParts ?? []).filter(
      (part) => part.kind === kind && !usedIds.has(part.id) && !reservedIds?.has(part.id),
    );
    const existing = candidates[0];
    const id = existing?.id ?? freshPartId(reservedIds);
    usedIds.add(id);
    return id;
  };
  pieces.forEach(([kind, value]) => {
    if (value !== undefined && value !== '') {
      const position = parts.length;
      parts.push({ id: partId(kind), kind, value, position });
    }
  });
  if (name.full !== undefined && name.full.trim() !== '') {
    const position = parts.length;
    parts.push({ id: partId('full'), kind: 'full', value: name.full.trim(), position });
  }
  return parts;
}
