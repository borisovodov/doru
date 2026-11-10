import type { DatabaseSync } from 'node:sqlite';
import type { DateComponent, DateValue } from '../model/types';
import { signedYear } from '../model/types';

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
  sort_year: number | null;
}

/**
 * The single writer of the `date` table. Dates are value rows owned by one
 * consumer (a fact, a name, a link, …): the consumer inserts/updates them
 * here and deletes them together with its own row.
 */
export class DateRepo {
  constructor(private readonly db: DatabaseSync) {}

  /** Inserts a fresh date row and returns its id. */
  insert(date: DateValue): string {
    const id = crypto.randomUUID();
    this.db.prepare(insertSql).run(...dateParams(id, date));
    return id;
  }

  /**
   * Writes the date: updates the existing row when `date.id` is set,
   * otherwise inserts a fresh one. Returns the row id.
   */
  upsert(date: DateValue): string {
    const id = date.id ?? crypto.randomUUID();
    this.db
      .prepare(
        `INSERT INTO date (id, quality, modifier, calendar, year, month, day, epoch,
           end_calendar, end_year, end_month, end_day, end_epoch, text,
           time_hour, time_minute, time_second, time_fraction, utc, sort_year)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET
           quality = excluded.quality, modifier = excluded.modifier,
           calendar = excluded.calendar, year = excluded.year, month = excluded.month,
           day = excluded.day, epoch = excluded.epoch,
           end_calendar = excluded.end_calendar, end_year = excluded.end_year,
           end_month = excluded.end_month, end_day = excluded.end_day,
           end_epoch = excluded.end_epoch, text = excluded.text,
           time_hour = excluded.time_hour, time_minute = excluded.time_minute,
           time_second = excluded.time_second, time_fraction = excluded.time_fraction,
           utc = excluded.utc, sort_year = excluded.sort_year`,
      )
      .run(...dateParams(id, date));
    return id;
  }

  get(id: string): DateValue | undefined {
    const row = this.db.prepare(selectSql).get(id) as DateRow | undefined;
    return row ? rowToDate(row) : undefined;
  }

  getMany(ids: string[]): Map<string, DateValue> {
    const byId = new Map<string, DateValue>();
    if (ids.length === 0) {
      return byId;
    }
    const placeholders = ids.map(() => '?').join(', ');
    const rows = this.db
      .prepare(`SELECT ${DATE_COLUMNS} FROM date WHERE id IN (${placeholders})`)
      .all(...ids) as unknown as DateRow[];
    for (const row of rows) {
      byId.set(row.id, rowToDate(row));
    }
    return byId;
  }

  delete(id: string): boolean {
    return this.db.prepare('DELETE FROM date WHERE id = ?').run(id).changes > 0;
  }
}

const DATE_COLUMNS = `id, quality, modifier, calendar, year, month, day, epoch,
  end_calendar, end_year, end_month, end_day, end_epoch, text,
  time_hour, time_minute, time_second, time_fraction, utc, sort_year`;

const selectSql = `SELECT ${DATE_COLUMNS} FROM date WHERE id = ?`;

const insertSql = `INSERT INTO date (id, quality, modifier, calendar, year, month, day, epoch,
  end_calendar, end_year, end_month, end_day, end_epoch, text,
  time_hour, time_minute, time_second, time_fraction, utc, sort_year)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

function dateParams(id: string, date: DateValue): Array<string | number | null> {
  const component = date.component;
  const end = date.end;
  const time = date.time;
  return [
    id,
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
    sortYearOf(date),
  ];
}

/** Months store as text: the number 1–12 for Gregorian/Julian, the code otherwise. */
function monthParam(component: DateComponent | undefined): string | null {
  if (component?.month === undefined) {
    return null;
  }
  return String(component.month);
}

/** The year the date sorts by: the start year, falling back to the end year of a range. */
function sortYearOf(date: DateValue): number | null {
  return signedYear(date.component) ?? signedYear(date.end) ?? null;
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
  return {
    calendar: calendar ?? undefined,
    year: year ?? undefined,
    month: month !== null ? rowToMonth(month) : undefined,
    day: day ?? undefined,
    epoch: (epoch ?? undefined) as 'BCE' | undefined,
  };
}

/** Months store as text: numeric 1–12 for Gregorian/Julian, the code otherwise. */
function rowToMonth(month: string): number | string {
  return /^\d+$/.test(month) ? Number(month) : month;
}
