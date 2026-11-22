import type { DatabaseSync } from 'node:sqlite';
import type { DateComponent, DateValue } from '../model/types';

interface DateRow {
  id: string;
  quality: string;
  modifier: string | null;
  calendar: string | null;
  year: number | null;
  month: string | null;
  day: number | null;
  epoch: string | null;
  end_calendar: string | null;
  end_year: number | null;
  end_month: string | null;
  end_day: number | null;
  end_epoch: string | null;
  text: string | null;
  time_hour: number | null;
  time_minute: number | null;
  time_second: number | null;
  time_fraction: string | null;
  utc: number;
}

/** The date ids written for one row and the ids that row stopped using. */
export interface PreparedDates {
  /** `null` for an empty slot, otherwise the date row id. */
  ids: Array<string | null>;
  /** Dates that were owned only by the row and must be deleted after it is updated. */
  obsolete: string[];
}

/** Date id → the owner key that must keep it when a row is rewritten. */
export type DateReservations = ReadonlyMap<string, string>;

/** A reservation the writer may use when filling one empty date slot. */
export interface DateSlotReservation {
  ownerKey: string;
  reserved: DateReservations;
}

/** A stable owner key; prefixed by table so ids from different tables cannot collide. */
export function dateOwnerKey(table: string, id: string, slot?: string): string {
  return slot === undefined ? `${table}:${id}` : `${table}:${id}:${slot}`;
}

/**
 * The `date` table is a value store: it has no owner columns. Owner rows
 * reference their dates through forward foreign keys (`ON DELETE RESTRICT`),
 * and repositories delete the date rows explicitly after the owner row is
 * gone. `prepareSlots` centralizes the update sequence — write the surviving
 * dates, keep the ids of occupied slots, and report the old ids to release.
 */
export class DateRepo {
  constructor(private readonly db: DatabaseSync) {}

  /**
   * Writes the desired dates for one row. `currentIds` and `dates` describe
   * the same slots in the same order. Existing slots keep their ids; empty
   * slots get `null`; new dates use their captured id when it is free and not
   * reserved for another owner, and a fresh UUID otherwise. The caller
   * updates the owner row with `ids` and then deletes `obsolete`.
   */
  prepareSlots(
    currentIds: ReadonlyArray<string | null | undefined>,
    dates: ReadonlyArray<DateValue | undefined>,
    reservations?: ReadonlyArray<DateSlotReservation | undefined>,
  ): PreparedDates {
    if (currentIds.length !== dates.length) {
      throw new Error('date slots and current ids must have the same length');
    }
    if (reservations !== undefined && reservations.length !== dates.length) {
      throw new Error('date slots and reservations must have the same length');
    }
    const kept = new Set<string>();
    const ids = dates.map((date, index) => {
      const current = currentIds[index] ?? undefined;
      if (date === undefined) {
        return null;
      }
      if (current !== undefined) {
        this.write(current, date);
        kept.add(current);
        return current;
      }
      const id = this.create(date, reservations?.[index]);
      kept.add(id);
      return id;
    });
    const obsolete: string[] = [];
    for (const id of currentIds) {
      if (id !== null && id !== undefined && !kept.has(id)) {
        obsolete.push(id);
      }
    }
    return { ids, obsolete };
  }

  /** Inserts a fresh date, preferring the captured id when it is still free. */
  create(date: DateValue, reservation?: DateSlotReservation): string {
    const id = this.freeId(date.id, reservation);
    this.write(id, date);
    return id;
  }

  get(id: string): DateValue | undefined {
    const row = this.db.prepare(selectSql).get(id) as DateRow | undefined;
    return row ? rowToDate(row) : undefined;
  }

  /** Dates by id in one query, chunked below SQLite's bound-parameter limit. */
  getMany(ids: ReadonlyArray<string | null | undefined>): Map<string, DateValue> {
    const dates = new Map<string, DateValue>();
    const unique = [...new Set(ids.filter((id): id is string => id !== null && id !== undefined))];
    for (let start = 0; start < unique.length; start += 500) {
      const chunk = unique.slice(start, start + 500);
      const placeholders = chunk.map(() => '?').join(', ');
      const rows = this.db
        .prepare(`SELECT ${DATE_COLUMNS} FROM date WHERE id IN (${placeholders})`)
        .all(...chunk) as unknown as DateRow[];
      for (const row of rows) {
        dates.set(row.id, rowToDate(row));
      }
    }
    return dates;
  }

  /** Deletes one date; `ON DELETE RESTRICT` rejects a still-referenced row. */
  delete(id: string): boolean {
    return this.db.prepare('DELETE FROM date WHERE id = ?').run(id).changes > 0;
  }

  /** Deletes the dates of a removed row; a still-referenced id aborts the transaction. */
  deleteMany(ids: ReadonlyArray<string | null | undefined>): void {
    const unique = [...new Set(ids.filter((id): id is string => id !== null && id !== undefined))];
    for (let start = 0; start < unique.length; start += 500) {
      const chunk = unique.slice(start, start + 500);
      const placeholders = chunk.map(() => '?').join(', ');
      this.db.prepare(`DELETE FROM date WHERE id IN (${placeholders})`).run(...chunk);
    }
  }

  /** A restored date keeps its captured id when it is free and not reserved for another owner. */
  private freeId(preferred: string | undefined, reservation?: DateSlotReservation): string {
    if (preferred !== undefined) {
      const reservedOwner = reservation?.reserved.get(preferred);
      if (
        (reservation === undefined || reservedOwner === undefined || reservedOwner === reservation.ownerKey) &&
        this.db.prepare('SELECT 1 FROM date WHERE id = ?').get(preferred) === undefined
      ) {
        return preferred;
      }
    }
    return crypto.randomUUID();
  }

  private write(id: string, date: DateValue): void {
    this.db.prepare(upsertSql).run(id, ...dateParams(date));
  }
}

const DATE_COLUMNS = `id, quality, modifier, calendar, year, month, day, epoch,
  end_calendar, end_year, end_month, end_day, end_epoch, text,
  time_hour, time_minute, time_second, time_fraction, utc`;

const selectSql = `SELECT ${DATE_COLUMNS} FROM date WHERE id = ?`;

const upsertSql = `INSERT INTO date (id, quality, modifier, calendar, year, month, day, epoch,
  end_calendar, end_year, end_month, end_day, end_epoch, text,
  time_hour, time_minute, time_second, time_fraction, utc)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT (id) DO UPDATE SET
    quality = excluded.quality, modifier = excluded.modifier,
    calendar = excluded.calendar, year = excluded.year, month = excluded.month,
    day = excluded.day, epoch = excluded.epoch,
    end_calendar = excluded.end_calendar, end_year = excluded.end_year,
    end_month = excluded.end_month, end_day = excluded.end_day,
    end_epoch = excluded.end_epoch, text = excluded.text,
    time_hour = excluded.time_hour, time_minute = excluded.time_minute,
    time_second = excluded.time_second, time_fraction = excluded.time_fraction,
    utc = excluded.utc`;

function dateParams(date: DateValue): Array<string | number | null> {
  const component = date.component;
  const end = date.end;
  const time = date.time;
  return [
    date.quality,
    date.modifier ?? null,
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
    date.text ?? null,
    time?.hour ?? null,
    time?.minute ?? null,
    time?.second ?? null,
    time?.fraction ?? null,
    time?.utc ? 1 : 0,
  ];
}

/** Months store as text: the number 1–12 for Gregorian/Julian, the code otherwise. */
function monthParam(component: DateComponent | undefined): string | null {
  if (component?.month === undefined) {
    return null;
  }
  return String(component.month);
}

function rowToDate(row: DateRow): DateValue {
  const time =
    row.time_hour !== null || row.time_minute !== null
      ? {
          hour: row.time_hour ?? 0,
          minute: row.time_minute ?? 0,
          second: row.time_second ?? undefined,
          fraction: row.time_fraction ?? undefined,
          utc: row.utc === 1,
        }
      : undefined;
  return {
    id: row.id,
    quality: row.quality as DateValue['quality'],
    modifier: (row.modifier ?? undefined) as DateValue['modifier'],
    component: rowToComponent(row, false),
    end: rowToComponent(row, true),
    text: row.text ?? undefined,
    time,
  };
}

function rowToComponent(row: DateRow, end: boolean): DateComponent | undefined {
  const calendar = end ? row.end_calendar : row.calendar;
  const year = end ? row.end_year : row.year;
  const month = end ? row.end_month : row.month;
  const day = end ? row.end_day : row.day;
  const epoch = end ? row.end_epoch : row.epoch;
  if (calendar === null && year === null && month === null && day === null && epoch === null) {
    return undefined;
  }
  const component: DateComponent = {};
  if (calendar !== null) {
    component.calendar = calendar;
  }
  if (year !== null) {
    component.year = year;
  }
  if (month !== null) {
    component.month = /^\d+$/.test(month) ? Number(month) : month;
  }
  if (day !== null) {
    component.day = day;
  }
  if (epoch !== null) {
    component.epoch = epoch as DateComponent['epoch'];
  }
  return component;
}
