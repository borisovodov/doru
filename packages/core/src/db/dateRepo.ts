import type { DatabaseSync } from 'node:sqlite';
import type { DateComponent, DateValue } from '../model/types';

/** Tables whose rows can own date rows. */
export type DateOwnerType =
  | 'person_name'
  | 'family_partner'
  | 'family_marriage_status'
  | 'fact'
  | 'place_name'
  | 'place_hierarchy'
  | 'place_postal_code'
  | 'source'
  | 'source_data_event'
  | 'citation'
  | 'media'
  | 'change_log'
  | 'tag_link'
  | 'task'
  | 'association';

/** The date slot of an owner row. */
export type DateRole =
  | 'period'
  | 'date'
  | 'event'
  | 'end'
  | 'sort'
  | 'publication'
  | 'created'
  | 'scheduled'
  | 'reminder'
  | 'closed'
  | 'period_start'
  | 'period_end';

interface DateRow {
  id: string;
  owner_type: string;
  owner_id: string;
  role: string;
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

/**
 * The single writer of the `date` table. Every date row belongs to exactly
 * one owner row and one role (`owner_type`, `owner_id`, `role`); the owner's
 * lifecycle governs the date. Schema triggers delete the date rows when the
 * owner row is deleted, including through foreign-key cascades.
 */
export class DateRepo {
  constructor(private readonly db: DatabaseSync) {}

  /** Replaces every date of one owner, keeping the ids of roles that survive. */
  replaceForOwner(
    ownerType: DateOwnerType,
    ownerId: string,
    dates: Partial<Record<DateRole, DateValue | undefined>>,
    reserved?: ReadonlyMap<string, string>,
  ): void {
    const existing = this.db
      .prepare('SELECT role, id FROM date WHERE owner_type = ? AND owner_id = ?')
      .all(ownerType, ownerId) as unknown as Array<{ role: string; id: string }>;
    const idByRole = new Map(existing.map((row) => [row.role, row.id]));
    const kept = new Set<string>();
    for (const [role, date] of Object.entries(dates)) {
      if (date === undefined) {
        continue;
      }
      kept.add(role);
      const id =
        idByRole.get(role) ?? this.freeId(date.id, dateOwnerKey(ownerType, ownerId, role as DateRole), reserved);
      this.write(id, ownerType, ownerId, role as DateRole, date);
    }
    for (const [role, id] of idByRole) {
      if (!kept.has(role)) {
        this.delete(id);
      }
    }
  }

  /** Writes one date of an owner, replacing the existing role; undefined clears it. */
  upsertForOwner(
    ownerType: DateOwnerType,
    ownerId: string,
    role: DateRole,
    date: DateValue | undefined,
    reserved?: ReadonlyMap<string, string>,
  ): string | undefined {
    const existing = this.db
      .prepare('SELECT id FROM date WHERE owner_type = ? AND owner_id = ? AND role = ?')
      .get(ownerType, ownerId, role) as { id: string } | undefined;
    if (date === undefined) {
      if (existing !== undefined) {
        this.delete(existing.id);
      }
      return undefined;
    }
    const id = existing?.id ?? this.freeId(date.id, dateOwnerKey(ownerType, ownerId, role), reserved);
    this.write(id, ownerType, ownerId, role, date);
    return id;
  }

  /**
   * Date ids claimed by surviving owner rows, keyed by id and owner role.
   * Repositories running a delete-and-reinsert pass this to `upsertForOwner`
   * so an existing owner keeps its date id and a copied date gets a new one.
   */
  reservationsFor(ownerType: DateOwnerType, ownerIds: string[]): Map<string, string> {
    const reservations = new Map<string, string>();
    if (ownerIds.length === 0) {
      return reservations;
    }
    // Stay below SQLite's bound-parameter limit for large listings.
    const chunkSize = 500;
    for (let start = 0; start < ownerIds.length; start += chunkSize) {
      const chunk = ownerIds.slice(start, start + chunkSize);
      const placeholders = chunk.map(() => '?').join(', ');
      const rows = this.db
        .prepare(`SELECT id, owner_id, role FROM date WHERE owner_type = ? AND owner_id IN (${placeholders})`)
        .all(ownerType, ...chunk) as unknown as Array<{ id: string; owner_id: string; role: string }>;
      for (const row of rows) {
        reservations.set(row.id, dateOwnerKey(ownerType, row.owner_id, row.role as DateRole));
      }
    }
    return reservations;
  }

  get(id: string): DateValue | undefined {
    const row = this.db.prepare(selectSql).get(id) as DateRow | undefined;
    return row ? rowToDate(row) : undefined;
  }

  getForOwner(ownerType: DateOwnerType, ownerId: string, role: DateRole): DateValue | undefined {
    const row = this.db
      .prepare(`SELECT ${DATE_COLUMNS} FROM date WHERE owner_type = ? AND owner_id = ? AND role = ?`)
      .get(ownerType, ownerId, role) as DateRow | undefined;
    return row ? rowToDate(row) : undefined;
  }

  /** Every date of one owner, keyed by role. */
  getAllForOwner(ownerType: DateOwnerType, ownerId: string): Map<string, DateValue> {
    const rows = this.db
      .prepare(`SELECT ${DATE_COLUMNS} FROM date WHERE owner_type = ? AND owner_id = ?`)
      .all(ownerType, ownerId) as unknown as DateRow[];
    return new Map(rows.map((row) => [row.role, rowToDate(row)]));
  }

  /** Dates of many owners of one type, keyed by owner id and then by role. */
  getManyForOwners(ownerType: DateOwnerType, ownerIds: string[]): Map<string, Map<string, DateValue>> {
    const byOwner = new Map<string, Map<string, DateValue>>();
    if (ownerIds.length === 0) {
      return byOwner;
    }
    // Stay below SQLite's bound-parameter limit for large listings.
    const chunkSize = 500;
    for (let start = 0; start < ownerIds.length; start += chunkSize) {
      const chunk = ownerIds.slice(start, start + chunkSize);
      const placeholders = chunk.map(() => '?').join(', ');
      const rows = this.db
        .prepare(`SELECT ${DATE_COLUMNS} FROM date WHERE owner_type = ? AND owner_id IN (${placeholders})`)
        .all(ownerType, ...chunk) as unknown as DateRow[];
      for (const row of rows) {
        const dates = byOwner.get(row.owner_id) ?? new Map<string, DateValue>();
        dates.set(row.role, rowToDate(row));
        byOwner.set(row.owner_id, dates);
      }
    }
    return byOwner;
  }

  /** Deletes every date of one owner, or one specific role of it. */
  deleteForOwner(ownerType: DateOwnerType, ownerId: string, role?: DateRole): void {
    if (role === undefined) {
      this.db.prepare('DELETE FROM date WHERE owner_type = ? AND owner_id = ?').run(ownerType, ownerId);
    } else {
      this.db
        .prepare('DELETE FROM date WHERE owner_type = ? AND owner_id = ? AND role = ?')
        .run(ownerType, ownerId, role);
    }
  }

  private delete(id: string): boolean {
    return this.db.prepare('DELETE FROM date WHERE id = ?').run(id).changes > 0;
  }

  /** A restored date keeps its captured id when that id is still free. */
  private freeId(preferred: string | undefined, ownerKey: string, reserved?: ReadonlyMap<string, string>): string {
    if (preferred !== undefined) {
      const reservedOwner = reserved?.get(preferred);
      if (
        (reservedOwner === undefined || reservedOwner === ownerKey) &&
        this.db.prepare('SELECT 1 FROM date WHERE id = ?').get(preferred) === undefined
      ) {
        return preferred;
      }
    }
    return crypto.randomUUID();
  }

  private write(id: string, ownerType: DateOwnerType, ownerId: string, role: DateRole, date: DateValue): void {
    this.db.prepare(upsertSql).run(...dateParams(id, ownerType, ownerId, role, date));
  }
}

const DATE_COLUMNS = `id, owner_type, owner_id, role, quality, modifier, calendar, year, month, day, epoch,
  end_calendar, end_year, end_month, end_day, end_epoch, text,
  time_hour, time_minute, time_second, time_fraction, utc`;

const selectSql = `SELECT ${DATE_COLUMNS} FROM date WHERE id = ?`;

const upsertSql = `INSERT INTO date (id, owner_type, owner_id, role, quality, modifier, calendar, year, month, day, epoch,
  end_calendar, end_year, end_month, end_day, end_epoch, text,
  time_hour, time_minute, time_second, time_fraction, utc)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT (id) DO UPDATE SET
    owner_type = excluded.owner_type, owner_id = excluded.owner_id, role = excluded.role,
    quality = excluded.quality, modifier = excluded.modifier,
    calendar = excluded.calendar, year = excluded.year, month = excluded.month,
    day = excluded.day, epoch = excluded.epoch,
    end_calendar = excluded.end_calendar, end_year = excluded.end_year,
    end_month = excluded.end_month, end_day = excluded.end_day,
    end_epoch = excluded.end_epoch, text = excluded.text,
    time_hour = excluded.time_hour, time_minute = excluded.time_minute,
    time_second = excluded.time_second, time_fraction = excluded.time_fraction,
    utc = excluded.utc`;

function dateOwnerKey(ownerType: DateOwnerType, ownerId: string, role: DateRole): string {
  return `${ownerType}\u0000${ownerId}\u0000${role}`;
}

function dateParams(
  id: string,
  ownerType: DateOwnerType,
  ownerId: string,
  role: DateRole,
  date: DateValue,
): Array<string | number | null> {
  const component = date.component;
  const end = date.end;
  const time = date.time;
  return [
    id,
    ownerType,
    ownerId,
    role,
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
