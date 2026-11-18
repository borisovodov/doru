import type { DatabaseSync } from 'node:sqlite';
import type { TransactionScope } from './transaction';
import {
  FACT_FLAGS,
  signedYear,
  type DateValue,
  type FactAge,
  type FactFamilyLink,
  type FactFlag,
  type FactParticipant,
  type FactRecord,
} from '../model/types';
import type { DateRepo } from './dateRepo';

const FACT_FLAG_SET = new Set<string>(FACT_FLAGS);

interface FactRow {
  id: string;
  person_id: string | null;
  family_id: string | null;
  tag: string;
  type: string | null;
  value: string | null;
  negation: number;
  primary_flag: number;
  date_id: string | null;
  end_date_id: string | null;
  sort_date_id: string | null;
  place_id: string | null;
  place_text: string | null;
  address_id: string | null;
  agency: string | null;
  religious_affiliation: string | null;
  cause: string | null;
  sentence: string | null;
  quality: string | null;
  place_prefix: string | null;
  event_number: string | null;
  birth_length: string | null;
  birth_weight: string | null;
  cemetery: string | null;
  fna: string | null;
  description_aware: number;
  map_latitude: number | null;
  map_longitude: number | null;
  rowid: number;
}

const FACT_COLUMNS = `id, person_id, family_id, tag, type, value, negation, primary_flag,
  date_id, end_date_id, sort_date_id, place_id, place_text, address_id, agency,
  religious_affiliation, cause, sentence, quality, place_prefix, event_number,
  birth_length, birth_weight, cemetery, fna, description_aware, map_latitude,
  map_longitude, rowid`;

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
    private readonly transactions: TransactionScope,
  ) {}

  insertFact(fact: FactRecord): void {
    this.transactions.run(() => this.insertFactRows(fact));
  }

  private insertFactRows(fact: FactRecord): void {
    this.db
      .prepare(
        `INSERT INTO fact (id, person_id, family_id, tag, type, value, negation, primary_flag,
           date_id, end_date_id, sort_date_id, place_id, place_text, address_id, agency,
           religious_affiliation, cause, sentence, quality, place_prefix, event_number,
           birth_length, birth_weight, cemetery, fna, description_aware, map_latitude,
           map_longitude)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(fact.id, ...factValueParams(fact, this.dates));
    this.replaceSubRows(fact);
  }

  updateFact(fact: FactRecord): void {
    this.transactions.run(() => this.updateFactRows(fact));
  }

  private updateFactRows(fact: FactRecord): void {
    const old = this.db.prepare('SELECT date_id, end_date_id, sort_date_id FROM fact WHERE id = ?').get(fact.id) as
      | { date_id: string | null; end_date_id: string | null; sort_date_id: string | null }
      | undefined;
    this.db
      .prepare(
        `UPDATE fact SET person_id = ?, family_id = ?, tag = ?, type = ?, value = ?, negation = ?,
           primary_flag = ?, date_id = ?, end_date_id = ?, sort_date_id = ?, place_id = ?, place_text = ?, address_id = ?,
           agency = ?, religious_affiliation = ?, cause = ?, sentence = ?, quality = ?,
           place_prefix = ?, event_number = ?, birth_length = ?, birth_weight = ?, cemetery = ?,
           fna = ?, description_aware = ?, map_latitude = ?, map_longitude = ?
         WHERE id = ?`,
      )
      .run(...factValueParams(fact, this.dates), fact.id);
    this.replaceSubRows(fact);
    if (old) {
      const kept = new Set(
        [fact.date?.id, fact.endDate?.id, fact.sortDate?.id].filter((id): id is string => id !== undefined),
      );
      for (const stale of [old.date_id, old.end_date_id, old.sort_date_id]) {
        if (stale !== null && !kept.has(stale)) {
          this.dates.delete(stale);
        }
      }
    }
  }

  setFactAddressId(factId: string, addressId: string | undefined): void {
    this.db
      .prepare('UPDATE fact SET address_id = ? WHERE id = ? AND address_id IS NULL')
      .run(addressId ?? null, factId);
  }

  getFact(id: string): FactRecord | undefined {
    const row = this.db.prepare(`SELECT ${FACT_COLUMNS} FROM fact WHERE id = ?`).get(id) as FactRow | undefined;
    return row === undefined ? undefined : this.hydrate([row])[0];
  }

  deleteFact(id: string): boolean {
    const row = this.db.prepare('SELECT date_id, end_date_id, sort_date_id FROM fact WHERE id = ?').get(id) as
      | { date_id: string | null; end_date_id: string | null; sort_date_id: string | null }
      | undefined;
    const result = this.db.prepare('DELETE FROM fact WHERE id = ?').run(id);
    if (row) {
      for (const dateId of [row.date_id, row.end_date_id, row.sort_date_id]) {
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

  /** Facts that link to a family through fact_family, without scanning the tree. */
  listFactsLinkedToFamily(familyId: string): FactRecord[] {
    const rows = this.db
      .prepare('SELECT fact_id FROM fact_family WHERE family_id = ? ORDER BY position, id')
      .all(familyId) as unknown as { fact_id: string }[];
    return rows.map((row) => this.getFact(row.fact_id)).filter((fact): fact is FactRecord => fact !== undefined);
  }

  /** Reconnects a fact to its place without rewriting other fields. */
  setFactPlaceId(factId: string, placeId: string | undefined): void {
    this.db.prepare('UPDATE fact SET place_id = ? WHERE id = ? AND place_id IS NULL').run(placeId ?? null, factId);
  }

  /** Re-adds one additional place row to a surviving fact. */
  insertFactPlace(factId: string, placeId: string, position: number): void {
    this.transactions.run(() => {
      // Keep the original order when the delete renumbered the surviving rows.
      this.db
        .prepare('UPDATE fact_place SET position = position + 1 WHERE fact_id = ? AND position >= ?')
        .run(factId, position);
      this.db
        .prepare('INSERT INTO fact_place (id, fact_id, place_id, position) VALUES (?, ?, ?, ?)')
        .run(crypto.randomUUID(), factId, placeId, position);
    });
  }

  /** Fact ids that reference an address, for targeted delete/undo snapshots. */
  listFactIdsForAddress(addressId: string): string[] {
    const rows = this.db.prepare('SELECT id FROM fact WHERE address_id = ? ORDER BY id').all(addressId) as unknown as {
      id: string;
    }[];
    return rows.map((row) => row.id);
  }

  /** Facts that happened at the given place. */
  listFactsForPlace(placeId: string): FactRecord[] {
    const rows = this.db
      .prepare(`SELECT ${FACT_COLUMNS} FROM fact WHERE place_id = ?`)
      .all(placeId) as unknown as FactRow[];
    return this.hydrate(rows);
  }

  /** Facts that list the place among their additional places. */
  listFactsWithAdditionalPlace(placeId: string): FactRecord[] {
    const rows = this.db
      .prepare(`SELECT ${FACT_COLUMNS} FROM fact WHERE id IN (SELECT fact_id FROM fact_place WHERE place_id = ?)`)
      .all(placeId) as unknown as FactRow[];
    return this.hydrate(rows);
  }

  /** Participants that point at a person, with the fact they belong to. */
  listParticipantsForPerson(personId: string): Array<{ factId: string; participant: FactParticipant }> {
    const rows = this.db
      .prepare(
        `SELECT fact_id, id, person_id, value, role, position FROM fact_participant
         WHERE person_id = ? ORDER BY fact_id, position`,
      )
      .all(personId) as unknown as {
      fact_id: string;
      id: string;
      person_id: string | null;
      value: string | null;
      role: string | null;
      position: number;
    }[];
    return rows.map((row) => ({
      factId: row.fact_id,
      participant: {
        id: row.id,
        personId: row.person_id ?? undefined,
        value: row.value ?? undefined,
        role: row.role ?? undefined,
        position: row.position,
      },
    }));
  }

  insertParticipant(factId: string, participant: FactParticipant): void {
    this.db
      .prepare('INSERT INTO fact_participant (id, fact_id, person_id, value, role, position) VALUES (?, ?, ?, ?, ?, ?)')
      .run(
        participant.id,
        factId,
        participant.personId ?? null,
        participant.value ?? null,
        participant.role ?? null,
        participant.position,
      );
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
      .prepare(`SELECT date_id, end_date_id, sort_date_id FROM fact WHERE ${column} = ?`)
      .all(id) as unknown as {
      date_id: string | null;
      end_date_id: string | null;
      sort_date_id: string | null;
    }[];
    this.db.prepare(`DELETE FROM fact WHERE ${column} = ?`).run(id);
    for (const row of rows) {
      for (const dateId of [row.date_id, row.end_date_id, row.sort_date_id]) {
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
      .flatMap((row) => [row.date_id, row.end_date_id, row.sort_date_id])
      .filter((id): id is string => id !== null);
    const datesById = this.dates.getMany(dateIds);
    const factIds = rows.map((row) => row.id);
    const agesByFact = this.agesForFacts(factIds);
    const participantsByFact = this.participantsForFacts(factIds);
    const flagsByFact = this.flagsForFacts(factIds);
    const placesByFact = this.additionalPlacesForFacts(factIds);
    const familyLinksByFact = this.familyLinksForFacts(factIds);
    return rows
      .map((row) => ({
        fact: rowToFact(row, datesById, agesByFact, participantsByFact, flagsByFact, placesByFact, familyLinksByFact),
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
    this.db.prepare('DELETE FROM fact_place WHERE fact_id = ?').run(fact.id);
    this.db.prepare('DELETE FROM fact_family WHERE fact_id = ?').run(fact.id);
    const insertPlace = this.db.prepare('INSERT INTO fact_place (id, fact_id, place_id, position) VALUES (?, ?, ?, ?)');
    (fact.additionalPlaceIds ?? []).forEach((placeId, position) => {
      insertPlace.run(crypto.randomUUID(), fact.id, placeId, position);
    });
    const insertAge = this.db.prepare(
      `INSERT INTO fact_age (id, fact_id, role, bound, years, months, weeks, days, phrase)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const age of fact.ages ?? []) {
      insertAge.run(
        age.id,
        fact.id,
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
    const insertFamily = this.db.prepare(
      `INSERT INTO fact_family (id, fact_id, family_id, adopted_by, phrase, position)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    for (const link of fact.familyLinks ?? []) {
      insertFamily.run(link.id, fact.id, link.familyId, link.adoptedBy ?? null, link.phrase ?? null, link.position);
    }
  }

  /** Adds one event-family link after the families themselves are imported. */
  insertFactFamilyLink(factId: string, link: FactFamilyLink): void {
    this.db
      .prepare(
        `INSERT INTO fact_family (id, fact_id, family_id, adopted_by, phrase, position)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(link.id, factId, link.familyId, link.adoptedBy ?? null, link.phrase ?? null, link.position);
  }

  private additionalPlacesForFacts(factIds: string[]): Map<string, string[]> {
    const byFact = new Map<string, string[]>();
    if (factIds.length === 0) {
      return byFact;
    }
    const placeholders = factIds.map(() => '?').join(', ');
    const rows = this.db
      .prepare(`SELECT fact_id, place_id FROM fact_place WHERE fact_id IN (${placeholders}) ORDER BY position`)
      .all(...factIds) as unknown as { fact_id: string; place_id: string }[];
    for (const row of rows) {
      const list = byFact.get(row.fact_id) ?? [];
      list.push(row.place_id);
      byFact.set(row.fact_id, list);
    }
    return byFact;
  }

  private agesForFacts(factIds: string[]): Map<string, FactAge[]> {
    const byFact = new Map<string, FactAge[]>();
    if (factIds.length === 0) {
      return byFact;
    }
    const placeholders = factIds.map(() => '?').join(', ');
    const rows = this.db
      .prepare(
        `SELECT id, fact_id, role, bound, years, months, weeks, days, phrase
         FROM fact_age WHERE fact_id IN (${placeholders}) ORDER BY rowid`,
      )
      .all(...factIds) as unknown as {
      id: string;
      fact_id: string;
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

  private familyLinksForFacts(factIds: string[]): Map<string, FactFamilyLink[]> {
    const byFact = new Map<string, FactFamilyLink[]>();
    if (factIds.length === 0) {
      return byFact;
    }
    const placeholders = factIds.map(() => '?').join(', ');
    const rows = this.db
      .prepare(
        `SELECT id, fact_id, family_id, adopted_by, phrase, position FROM fact_family
         WHERE fact_id IN (${placeholders}) ORDER BY position`,
      )
      .all(...factIds) as unknown as {
      id: string;
      fact_id: string;
      family_id: string;
      adopted_by: string | null;
      phrase: string | null;
      position: number;
    }[];
    for (const row of rows) {
      const links = byFact.get(row.fact_id) ?? [];
      links.push({
        id: row.id,
        familyId: row.family_id,
        adoptedBy:
          row.adopted_by === 'HUSB' || row.adopted_by === 'WIFE' || row.adopted_by === 'BOTH'
            ? row.adopted_by
            : undefined,
        phrase: row.phrase ?? undefined,
        position: row.position,
      });
      byFact.set(row.fact_id, links);
    }
    return byFact;
  }

  private flagsForFacts(factIds: string[]): Map<string, FactFlag[]> {
    const byFact = new Map<string, FactFlag[]>();
    if (factIds.length === 0) {
      return byFact;
    }
    const placeholders = factIds.map(() => '?').join(', ');
    const rows = this.db
      .prepare(`SELECT fact_id, flag FROM fact_flag WHERE fact_id IN (${placeholders}) ORDER BY flag`)
      .all(...factIds) as unknown as { fact_id: string; flag: string }[];
    for (const row of rows) {
      if (!FACT_FLAG_SET.has(row.flag)) {
        continue;
      }
      const flags = byFact.get(row.fact_id) ?? [];
      flags.push(row.flag as FactFlag);
      byFact.set(row.fact_id, flags);
    }
    return byFact;
  }

  // --- fact types -----------------------------------------------------------
}

function factValueParams(fact: FactRecord, dates: DateRepo): Array<string | number | null> {
  return [
    fact.personId ?? null,
    fact.familyId ?? null,
    fact.tag,
    fact.type ?? null,
    fact.value ?? null,
    fact.negation ? 1 : 0,
    fact.primary ? 1 : 0,
    fact.date ? dates.upsert(fact.date) : null,
    fact.endDate ? dates.upsert(fact.endDate) : null,
    fact.sortDate ? dates.upsert(fact.sortDate) : null,
    fact.placeId ?? null,
    fact.place ?? null,
    fact.addressId ?? null,
    fact.agency ?? null,
    fact.religiousAffiliation ?? null,
    fact.cause ?? null,
    fact.sentence ?? null,
    fact.quality ?? null,
    fact.placePrefix ?? null,
    fact.eventNumber ?? null,
    fact.birthLength ?? null,
    fact.birthWeight ?? null,
    fact.cemetery ?? null,
    fact.fna === true ? 'Y' : null,
    fact.descriptionAware ? 1 : 0,
    fact.map?.latitude ?? null,
    fact.map?.longitude ?? null,
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
  flagsByFact: Map<string, FactFlag[]>,
  placesByFact: Map<string, string[]>,
  familyLinksByFact: Map<string, FactFamilyLink[]>,
): FactRecord {
  const ages = agesByFact.get(row.id);
  const participants = participantsByFact.get(row.id);
  const flags = flagsByFact.get(row.id);
  const additionalPlaceIds = placesByFact.get(row.id);
  const familyLinks = familyLinksByFact.get(row.id);
  return {
    id: row.id,
    personId: row.person_id ?? undefined,
    familyId: row.family_id ?? undefined,
    tag: row.tag,
    type: row.type ?? undefined,
    value: row.value ?? undefined,
    negation: row.negation === 1 ? true : undefined,
    primary: row.primary_flag === 1 ? true : undefined,
    date: row.date_id !== null ? datesById.get(row.date_id) : undefined,
    endDate: row.end_date_id !== null ? datesById.get(row.end_date_id) : undefined,
    sortDate: row.sort_date_id !== null ? datesById.get(row.sort_date_id) : undefined,
    ...(additionalPlaceIds !== undefined ? { additionalPlaceIds } : {}),
    placePrefix: row.place_prefix ?? undefined,
    eventNumber: row.event_number ?? undefined,
    birthLength: row.birth_length ?? undefined,
    birthWeight: row.birth_weight ?? undefined,
    cemetery: row.cemetery ?? undefined,
    fna: row.fna !== null ? true : undefined,
    descriptionAware: row.description_aware === 1 ? true : undefined,
    map:
      row.map_latitude !== null && row.map_longitude !== null
        ? { latitude: row.map_latitude, longitude: row.map_longitude }
        : undefined,
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
    familyLinks: familyLinks !== undefined && familyLinks.length > 0 ? familyLinks : undefined,
  };
}
