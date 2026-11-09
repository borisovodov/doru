import type { DatabaseSync } from 'node:sqlite';
import type { DateComponent, DateValue, FactRecord } from '../model/types';
import { signedYear } from '../model/types';

interface FactRow {
  id: string;
  person_id: string | null;
  family_id: string | null;
  tag: string;
  type: string | null;
  value: string | null;
  date_quality: string | null;
  date_modifier: string | null;
  date_calendar: string | null;
  date_year: number | null;
  date_month: string | null;
  date_day: number | null;
  date_epoch: string | null;
  date_end_calendar: string | null;
  date_end_year: number | null;
  date_end_month: string | null;
  date_end_day: number | null;
  date_end_epoch: string | null;
  date_text: string | null;
  place: string | null;
}

const FACT_COLUMNS = `id, person_id, family_id, tag, type, value,
  date_quality, date_modifier, date_calendar, date_year, date_month, date_day, date_epoch,
  date_end_calendar, date_end_year, date_end_month, date_end_day, date_end_epoch,
  date_text, place`;

export class FactRepo {
  constructor(private readonly db: DatabaseSync) {}

  insertFact(fact: FactRecord): void {
    this.db
      .prepare(
        `INSERT INTO fact (id, person_id, family_id, tag, type, value,
          date_quality, date_modifier, date_calendar, date_year, date_month, date_day, date_epoch,
          date_end_calendar, date_end_year, date_end_month, date_end_day, date_end_epoch,
          date_text, sort_year, place)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(fact.id, ...factValueParams(fact));
  }

  updateFact(fact: FactRecord): void {
    this.db
      .prepare(
        `UPDATE fact SET person_id = ?, family_id = ?, tag = ?, type = ?, value = ?,
          date_quality = ?, date_modifier = ?, date_calendar = ?, date_year = ?, date_month = ?, date_day = ?, date_epoch = ?,
          date_end_calendar = ?, date_end_year = ?, date_end_month = ?, date_end_day = ?, date_end_epoch = ?,
          date_text = ?, sort_year = ?, place = ?
         WHERE id = ?`,
      )
      .run(...factValueParams(fact), fact.id);
  }

  deleteFact(id: string): boolean {
    const result = this.db.prepare('DELETE FROM fact WHERE id = ?').run(id);
    return result.changes > 0;
  }

  listFactsForPerson(personId: string): FactRecord[] {
    return this.queryFacts('person_id', personId);
  }

  listFactsForFamily(familyId: string): FactRecord[] {
    return this.queryFacts('family_id', familyId);
  }

  /** Facts of many persons in one query, grouped by person id. */
  listFactsForPersons(personIds: string[]): Map<string, FactRecord[]> {
    const byPerson = new Map<string, FactRecord[]>();
    if (personIds.length === 0) {
      return byPerson;
    }
    const placeholders = personIds.map(() => '?').join(', ');
    const rows = this.db
      .prepare(
        `SELECT ${FACT_COLUMNS} FROM fact WHERE person_id IN (${placeholders})
         ORDER BY sort_year IS NULL, sort_year, rowid`,
      )
      .all(...personIds) as unknown as FactRow[];
    for (const row of rows) {
      const facts = byPerson.get(row.person_id!) ?? [];
      facts.push(rowToFact(row));
      byPerson.set(row.person_id!, facts);
    }
    return byPerson;
  }

  /** Every fact in the tree, ordered by date. */
  listAllFacts(): FactRecord[] {
    const rows = this.db
      .prepare(`SELECT ${FACT_COLUMNS} FROM fact ORDER BY sort_year IS NULL, sort_year, rowid`)
      .all() as unknown as FactRow[];
    return rows.map(rowToFact);
  }

  private queryFacts(column: 'person_id' | 'family_id', id: string): FactRecord[] {
    const rows = this.db
      .prepare(`SELECT ${FACT_COLUMNS} FROM fact WHERE ${column} = ? ORDER BY sort_year IS NULL, sort_year, rowid`)
      .all(id) as unknown as FactRow[];
    return rows.map(rowToFact);
  }
}

function factValueParams(fact: FactRecord): Array<string | number | null> {
  const date = fact.date;
  const component = date?.component;
  const end = date?.end;
  return [
    fact.personId ?? null,
    fact.familyId ?? null,
    fact.tag,
    fact.type ?? null,
    fact.value ?? null,
    date?.quality ?? null,
    date?.modifier ?? null,
    component?.calendar ?? null,
    component?.year ?? null,
    monthParam(component),
    component?.day ?? null,
    component?.epoch ?? null,
    end?.calendar ?? null,
    end?.year ?? null,
    monthParam(end),
    end?.day ?? null,
    end?.epoch ?? null,
    date?.text ?? null,
    sortYearOf(date),
    fact.place ?? null,
  ];
}

/** Months store as text: the number 1–12 for Gregorian/Julian, the month code otherwise. */
function monthParam(component: DateComponent | undefined): string | null {
  if (component?.month === undefined) {
    return null;
  }
  return String(component.month);
}

/** The year the fact sorts by: the start year, falling back to the end year of a range. */
function sortYearOf(date: DateValue | undefined): number | null {
  if (!date) {
    return null;
  }
  const year = signedYear(date.component) ?? signedYear(date.end);
  return year ?? null;
}

function rowToFact(row: FactRow): FactRecord {
  return {
    id: row.id,
    personId: row.person_id ?? undefined,
    familyId: row.family_id ?? undefined,
    tag: row.tag,
    type: row.type ?? undefined,
    value: row.value ?? undefined,
    date: rowToDate(row),
    place: row.place ?? undefined,
  };
}

function rowToDate(row: FactRow): DateValue | undefined {
  if (row.date_quality === null) {
    return undefined;
  }
  const component = rowToComponent(row, false);
  const end = rowToComponent(row, true);
  return {
    quality: row.date_quality as DateValue['quality'],
    modifier: (row.date_modifier ?? undefined) as DateValue['modifier'],
    component: component ?? undefined,
    end: end ?? undefined,
    text: row.date_text ?? undefined,
  };
}

function rowToComponent(row: FactRow, end: boolean): DateComponent | undefined {
  const calendar = end ? row.date_end_calendar : row.date_calendar;
  const year = end ? row.date_end_year : row.date_year;
  const month = end ? row.date_end_month : row.date_month;
  const day = end ? row.date_end_day : row.date_day;
  const epoch = end ? row.date_end_epoch : row.date_epoch;
  if (calendar === null && year === null && month === null && day === null && epoch === null) {
    return undefined;
  }
  return {
    calendar: calendar ?? undefined,
    year: year ?? undefined,
    month: rowToMonth(month),
    day: day ?? undefined,
    epoch: (epoch ?? undefined) as 'BCE' | undefined,
  };
}

/** Months store as text: numeric 1–12 for Gregorian/Julian, the code otherwise. */
function rowToMonth(month: string | null): number | string | undefined {
  if (month === null) {
    return undefined;
  }
  return /^\d+$/.test(month) ? Number(month) : month;
}
