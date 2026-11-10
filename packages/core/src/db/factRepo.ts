import type { DatabaseSync } from 'node:sqlite';
import type { DateValue, FactAge, FactParticipant, FactRecord, FactTypeRecord } from '../model/types';
import { signedYear } from '../model/types';
import type { DateRepo } from './dateRepo';

interface FactRow {
  id: string;
  person_id: string | null;
  family_id: string | null;
  tag: string;
  type: string | null;
  value: string | null;
  negation: number;
  date_id: string | null;
  sort_date_id: string | null;
  place_id: string | null;
  place_text: string | null;
  address_id: string | null;
  agency: string | null;
  religious_affiliation: string | null;
  cause: string | null;
  sentence: string | null;
  quality: string | null;
  rowid: number;
}

const FACT_COLUMNS = `id, person_id, family_id, tag, type, value, negation,
  date_id, sort_date_id, place_id, place_text, address_id, agency,
  religious_affiliation, cause, sentence, quality, rowid`;

/**
 * Facts (events and attributes) with exactly one owner — a person or a
 * family. Dates are value rows in the `date` table owned by the fact: they
 * are inserted/updated here and deleted together with the fact. Ages,
 * participants and flags are sub-rows of the fact aggregate.
 */
export class FactRepo {
  constructor(
    private readonly db: DatabaseSync,
    private readonly dates: DateRepo,
  ) {}

  insertFact(fact: FactRecord): void {
    this.db
      .prepare(
        `INSERT INTO fact (id, person_id, family_id, tag, type, value, negation,
           date_id, sort_date_id, place_id, place_text, address_id, agency,
           religious_affiliation, cause, sentence, quality)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(fact.id, ...factValueParams(fact, this.dates));
    this.replaceSubRows(fact);
  }

  updateFact(fact: FactRecord): void {
    const old = this.db.prepare('SELECT date_id, sort_date_id FROM fact WHERE id = ?').get(fact.id) as
      | { date_id: string | null; sort_date_id: string | null }
      | undefined;
    this.db
      .prepare(
        `UPDATE fact SET person_id = ?, family_id = ?, tag = ?, type = ?, value = ?, negation = ?,
           date_id = ?, sort_date_id = ?, place_id = ?, place_text = ?, address_id = ?,
           agency = ?, religious_affiliation = ?, cause = ?, sentence = ?, quality = ?
         WHERE id = ?`,
      )
      .run(...factValueParams(fact, this.dates), fact.id);
    this.replaceSubRows(fact);
    if (old) {
      const kept = new Set([fact.date?.id, fact.sortDate?.id].filter((id): id is string => id !== undefined));
      for (const stale of [old.date_id, old.sort_date_id]) {
        if (stale !== null && !kept.has(stale)) {
          this.dates.delete(stale);
        }
      }
    }
  }

  deleteFact(id: string): boolean {
    const row = this.db.prepare('SELECT date_id, sort_date_id FROM fact WHERE id = ?').get(id) as
      | { date_id: string | null; sort_date_id: string | null }
      | undefined;
    const result = this.db.prepare('DELETE FROM fact WHERE id = ?').run(id);
    if (row) {
      for (const dateId of [row.date_id, row.sort_date_id]) {
        if (dateId !== null) {
          this.dates.delete(dateId);
        }
      }
    }
    return result.changes > 0;
  }

  listFactsForPerson(personId: string): FactRecord[] {
    return this.queryFacts('person_id', personId);
  }

  listFactsForFamily(familyId: string): FactRecord[] {
    return this.queryFacts('family_id', familyId);
  }

  /** Facts that happened at the given place. */
  listFactsForPlace(placeId: string): FactRecord[] {
    const rows = this.db
      .prepare(`SELECT ${FACT_COLUMNS} FROM fact WHERE place_id = ?`)
      .all(placeId) as unknown as FactRow[];
    return this.hydrate(rows);
  }

  /** Deletes an owner's facts together with their date rows (before the owner itself goes). */
  deleteFactsForPerson(personId: string): void {
    this.deleteFactsForOwner('person_id', personId);
  }

  /** Deletes a family's facts together with their date rows. */
  deleteFactsForFamily(familyId: string): void {
    this.deleteFactsForOwner('family_id', familyId);
  }

  private deleteFactsForOwner(column: 'person_id' | 'family_id', id: string): void {
    const rows = this.db
      .prepare(`SELECT date_id, sort_date_id FROM fact WHERE ${column} = ?`)
      .all(id) as unknown as { date_id: string | null; sort_date_id: string | null }[];
    this.db.prepare(`DELETE FROM fact WHERE ${column} = ?`).run(id);
    for (const row of rows) {
      for (const dateId of [row.date_id, row.sort_date_id]) {
        if (dateId !== null) {
          this.dates.delete(dateId);
        }
      }
    }
  }

  /** Facts of many persons in one query, grouped by person id. */
  listFactsForPersons(personIds: string[]): Map<string, FactRecord[]> {
    const byPerson = new Map<string, FactRecord[]>();
    if (personIds.length === 0) {
      return byPerson;
    }
    const placeholders = personIds.map(() => '?').join(', ');
    const rows = this.db
      .prepare(`SELECT ${FACT_COLUMNS} FROM fact WHERE person_id IN (${placeholders})`)
      .all(...personIds) as unknown as FactRow[];
    const facts = this.hydrate(rows);
    for (const fact of facts) {
      if (fact.personId !== undefined) {
        const list = byPerson.get(fact.personId) ?? [];
        list.push(fact);
        byPerson.set(fact.personId, list);
      }
    }
    return byPerson;
  }

  /** Every fact in the tree, ordered by date. */
  listAllFacts(): FactRecord[] {
    const rows = this.db.prepare(`SELECT ${FACT_COLUMNS} FROM fact`).all() as unknown as FactRow[];
    return this.hydrate(rows);
  }

  private queryFacts(column: 'person_id' | 'family_id', id: string): FactRecord[] {
    const rows = this.db
      .prepare(`SELECT ${FACT_COLUMNS} FROM fact WHERE ${column} = ?`)
      .all(id) as unknown as FactRow[];
    return this.hydrate(rows);
  }

  /** Attaches each fact's dates and sub-rows and orders by sort year (unknown dates last, rowid as tiebreak). */
  private hydrate(rows: FactRow[]): FactRecord[] {
    const dateIds = rows
      .flatMap((row) => [row.date_id, row.sort_date_id])
      .filter((id): id is string => id !== null);
    const datesById = this.dates.getMany(dateIds);
    const factIds = rows.map((row) => row.id);
    const agesByFact = this.agesForFacts(factIds);
    const participantsByFact = this.participantsForFacts(factIds);
    const flagsByFact = this.flagsForFacts(factIds);
    return rows
      .map((row) => ({
        fact: rowToFact(row, datesById, agesByFact, participantsByFact, flagsByFact),
        rowid: row.rowid,
      }))
      .sort((a, b) => {
        const yearA = sortYear(a.fact.date) ?? sortYear(a.fact.sortDate) ?? Number.POSITIVE_INFINITY;
        const yearB = sortYear(b.fact.date) ?? sortYear(b.fact.sortDate) ?? Number.POSITIVE_INFINITY;
        return yearA - yearB || a.rowid - b.rowid;
      })
      .map(({ fact }) => fact);
  }

  private replaceSubRows(fact: FactRecord): void {
    this.db.prepare('DELETE FROM fact_age WHERE fact_id = ?').run(fact.id);
    this.db.prepare('DELETE FROM fact_participant WHERE fact_id = ?').run(fact.id);
    this.db.prepare('DELETE FROM fact_flag WHERE fact_id = ?').run(fact.id);
    const insertAge = this.db.prepare(
      `INSERT INTO fact_age (id, fact_id, person_id, role, bound, years, months, weeks, days, phrase)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const age of fact.ages ?? []) {
      insertAge.run(
        age.id,
        fact.id,
        age.personId ?? null,
        age.role ?? null,
        age.bound ?? null,
        age.years ?? null,
        age.months ?? null,
        age.weeks ?? null,
        age.days ?? null,
        age.phrase ?? null,
      );
    }
    const insertParticipant = this.db.prepare(
      'INSERT INTO fact_participant (id, fact_id, person_id, value, role, position) VALUES (?, ?, ?, ?, ?, ?)',
    );
    (fact.participants ?? []).forEach((participant, position) => {
      insertParticipant.run(
        participant.id,
        fact.id,
        participant.personId ?? null,
        participant.value ?? null,
        participant.role ?? null,
        position,
      );
    });
    const insertFlag = this.db.prepare('INSERT INTO fact_flag (fact_id, flag) VALUES (?, ?)');
    for (const flag of fact.flags ?? []) {
      insertFlag.run(fact.id, flag);
    }
  }

  private agesForFacts(factIds: string[]): Map<string, FactAge[]> {
    const byFact = new Map<string, FactAge[]>();
    if (factIds.length === 0) {
      return byFact;
    }
    const placeholders = factIds.map(() => '?').join(', ');
    const rows = this.db
      .prepare(
        `SELECT id, fact_id, person_id, role, bound, years, months, weeks, days, phrase
         FROM fact_age WHERE fact_id IN (${placeholders}) ORDER BY rowid`,
      )
      .all(...factIds) as unknown as {
      id: string;
      fact_id: string;
      person_id: string | null;
      role: string | null;
      bound: string | null;
      years: number | null;
      months: number | null;
      weeks: number | null;
      days: number | null;
      phrase: string | null;
    }[];
    for (const row of rows) {
      const ages = byFact.get(row.fact_id) ?? [];
      ages.push({
        id: row.id,
        personId: row.person_id ?? undefined,
        role: row.role ?? undefined,
        bound: row.bound ?? undefined,
        years: row.years ?? undefined,
        months: row.months ?? undefined,
        weeks: row.weeks ?? undefined,
        days: row.days ?? undefined,
        phrase: row.phrase ?? undefined,
      });
      byFact.set(row.fact_id, ages);
    }
    return byFact;
  }

  private participantsForFacts(factIds: string[]): Map<string, FactParticipant[]> {
    const byFact = new Map<string, FactParticipant[]>();
    if (factIds.length === 0) {
      return byFact;
    }
    const placeholders = factIds.map(() => '?').join(', ');
    const rows = this.db
      .prepare(
        `SELECT id, fact_id, person_id, value, role FROM fact_participant
         WHERE fact_id IN (${placeholders}) ORDER BY position`,
      )
      .all(...factIds) as unknown as {
      id: string;
      fact_id: string;
      person_id: string | null;
      value: string | null;
      role: string | null;
    }[];
    for (const row of rows) {
      const participants = byFact.get(row.fact_id) ?? [];
      participants.push({
        id: row.id,
        personId: row.person_id ?? undefined,
        value: row.value ?? undefined,
        role: row.role ?? undefined,
        position: participants.length,
      });
      byFact.set(row.fact_id, participants);
    }
    return byFact;
  }

  private flagsForFacts(factIds: string[]): Map<string, string[]> {
    const byFact = new Map<string, string[]>();
    if (factIds.length === 0) {
      return byFact;
    }
    const placeholders = factIds.map(() => '?').join(', ');
    const rows = this.db
      .prepare(`SELECT fact_id, flag FROM fact_flag WHERE fact_id IN (${placeholders}) ORDER BY flag`)
      .all(...factIds) as unknown as { fact_id: string; flag: string }[];
    for (const row of rows) {
      const flags = byFact.get(row.fact_id) ?? [];
      flags.push(row.flag);
      byFact.set(row.fact_id, flags);
    }
    return byFact;
  }

  // --- fact types -----------------------------------------------------------

  insertFactType(type: FactTypeRecord): void {
    this.db
      .prepare(
        'INSERT INTO fact_type (id, code, kind, title, abbreviation, sentence, confidential) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        type.id,
        type.code ?? null,
        type.kind ?? null,
        type.title ?? null,
        type.abbreviation ?? null,
        type.sentence ?? null,
        type.confidential ? 1 : 0,
      );
  }

  updateFactType(type: FactTypeRecord): void {
    this.db
      .prepare(
        'UPDATE fact_type SET code = ?, kind = ?, title = ?, abbreviation = ?, sentence = ?, confidential = ? WHERE id = ?',
      )
      .run(
        type.code ?? null,
        type.kind ?? null,
        type.title ?? null,
        type.abbreviation ?? null,
        type.sentence ?? null,
        type.confidential ? 1 : 0,
        type.id,
      );
  }

  deleteFactType(id: string): boolean {
    return this.db.prepare('DELETE FROM fact_type WHERE id = ?').run(id).changes > 0;
  }

  listFactTypes(): FactTypeRecord[] {
    const rows = this.db
      .prepare('SELECT id, code, kind, title, abbreviation, sentence, confidential FROM fact_type ORDER BY code')
      .all() as unknown as {
      id: string;
      code: string | null;
      kind: string | null;
      title: string | null;
      abbreviation: string | null;
      sentence: string | null;
      confidential: number;
    }[];
    return rows.map((row) => ({
      id: row.id,
      code: row.code ?? undefined,
      kind: row.kind ?? undefined,
      title: row.title ?? undefined,
      abbreviation: row.abbreviation ?? undefined,
      sentence: row.sentence ?? undefined,
      confidential: row.confidential === 1 ? true : undefined,
    }));
  }
}

function factValueParams(fact: FactRecord, dates: DateRepo): Array<string | number | null> {
  return [
    fact.personId ?? null,
    fact.familyId ?? null,
    fact.tag,
    fact.type ?? null,
    fact.value ?? null,
    fact.negation ? 1 : 0,
    fact.date ? dates.upsert(fact.date) : null,
    fact.sortDate ? dates.upsert(fact.sortDate) : null,
    fact.placeId ?? null,
    fact.place ?? null,
    fact.addressId ?? null,
    fact.agency ?? null,
    fact.religiousAffiliation ?? null,
    fact.cause ?? null,
    fact.sentence ?? null,
    fact.quality ?? null,
  ];
}

/** The year the fact sorts by: the date's sort year, falling back to the sort date's. */
function sortYear(date: DateValue | undefined): number | null {
  return signedYear(date?.component) ?? signedYear(date?.end) ?? null;
}

function rowToFact(
  row: FactRow,
  datesById: Map<string, DateValue>,
  agesByFact: Map<string, FactAge[]>,
  participantsByFact: Map<string, FactParticipant[]>,
  flagsByFact: Map<string, string[]>,
): FactRecord {
  const ages = agesByFact.get(row.id);
  const participants = participantsByFact.get(row.id);
  const flags = flagsByFact.get(row.id);
  return {
    id: row.id,
    personId: row.person_id ?? undefined,
    familyId: row.family_id ?? undefined,
    tag: row.tag,
    type: row.type ?? undefined,
    value: row.value ?? undefined,
    negation: row.negation === 1 ? true : undefined,
    date: row.date_id !== null ? datesById.get(row.date_id) : undefined,
    sortDate: row.sort_date_id !== null ? datesById.get(row.sort_date_id) : undefined,
    placeId: row.place_id ?? undefined,
    place: row.place_text ?? undefined,
    addressId: row.address_id ?? undefined,
    agency: row.agency ?? undefined,
    religiousAffiliation: row.religious_affiliation ?? undefined,
    cause: row.cause ?? undefined,
    sentence: row.sentence ?? undefined,
    quality: row.quality ?? undefined,
    ages: ages !== undefined && ages.length > 0 ? ages : undefined,
    participants: participants !== undefined && participants.length > 0 ? participants : undefined,
    flags: flags !== undefined && flags.length > 0 ? flags : undefined,
  };
}
