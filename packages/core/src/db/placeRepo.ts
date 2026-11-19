import type { DatabaseSync } from 'node:sqlite';
import type { PlaceName, PlaceRecord } from '../model/types';
import type { DateRepo } from './dateRepo';
import type { TransactionScope } from './transaction';

interface PlaceRow {
  id: string;
  xref: string | null;
  latitude: number | null;
  longitude: number | null;
  verified: number;
  form: string | null;
  abbreviation: string | null;
  preposition: string | null;
  gov_id: string | null;
  maidenhead: string | null;
  place_type: string | null;
}

interface PlaceNameRow {
  id: string;
  place_id: string;
  kind: string;
  language: string | null;
  type: string | null;
  position: number;
  value: string;
  date_id: string | null;
  addition: string | null;
  abbreviation: string | null;
  abbreviation_type: string | null;
}

/**
 * The single writer of the place tables. A place is a row plus its names
 * (one jurisdiction per row, smallest first), hierarchy links and postal
 * codes.
 */
export class PlaceRepo {
  private readonly insertName: ReturnType<DatabaseSync['prepare']>;

  constructor(
    private readonly db: DatabaseSync,
    private readonly dates: DateRepo,
    private readonly transactions: TransactionScope,
  ) {
    this.insertName = this.db.prepare(
      `INSERT INTO place_name (id, place_id, kind, language, type, position, value,
         date_id, addition, abbreviation, abbreviation_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
  }

  insertPlace(place: PlaceRecord): void {
    this.db
      .prepare(`INSERT INTO place (id, xref, latitude, longitude, verified, form, abbreviation,
        preposition, gov_id, maidenhead, place_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(
        place.id,
        place.xref ?? null,
        place.latitude ?? null,
        place.longitude ?? null,
        place.verified ? 1 : 0,
        place.form !== undefined ? place.form.join(', ') : null,
        place.abbreviation ?? null,
        place.preposition ?? null,
        place.govId ?? null,
        place.maidenhead ?? null,
        place.placeType ?? null,
      );
    this.replaceDetails(place);
  }

  /** Replaces the place's names, hierarchy and postal codes wholesale. */
  updatePlace(place: PlaceRecord): void {
    if (this.db.prepare('SELECT 1 FROM place WHERE id = ?').get(place.id) === undefined) {
      throw new Error(`place ${place.id} no longer exists`);
    }
    this.db
      .prepare(`UPDATE place SET xref = ?, latitude = ?, longitude = ?, verified = ?, form = ?,
        abbreviation = ?, preposition = ?, gov_id = ?, maidenhead = ?, place_type = ? WHERE id = ?`)
      .run(
        place.xref ?? null,
        place.latitude ?? null,
        place.longitude ?? null,
        place.verified ? 1 : 0,
        place.form !== undefined ? place.form.join(', ') : null,
        place.abbreviation ?? null,
        place.preposition ?? null,
        place.govId ?? null,
        place.maidenhead ?? null,
        place.placeType ?? null,
        place.id,
      );
    this.replaceDetails(place);
  }

  getPlace(id: string): PlaceRecord | undefined {
    const row = this.db
      .prepare(`SELECT id, xref, latitude, longitude, verified, form, abbreviation, preposition,
        gov_id, maidenhead, place_type FROM place WHERE id = ?`)
      .get(id) as PlaceRow | undefined;
    return row ? this.hydrate(row) : undefined;
  }

  /** Every place, ordered by the joined name. */
  listPlaces(): PlaceRecord[] {
    const rows = this.db
      .prepare(`SELECT id, xref, latitude, longitude, verified, form, abbreviation, preposition,
        gov_id, maidenhead, place_type FROM place ORDER BY id`)
      .all() as unknown as PlaceRow[];
    return rows.map((row) => this.hydrate(row));
  }

  /** Re-inserts one hierarchy row after the parent place was deleted. */
  insertHierarchyLink(
    childId: string,
    link: { id: string; parentId: string; type?: string; date?: import('../model/types').DateValue },
  ): void {
    this.transactions.run(() => {
      if (this.db.prepare('SELECT 1 FROM place_hierarchy WHERE id = ?').get(link.id) !== undefined) {
        return;
      }
      const dateId = link.date ? this.dates.upsert(link.date) : null;
      this.db
        .prepare('INSERT INTO place_hierarchy (id, parent_id, child_id, type, date_id) VALUES (?, ?, ?, ?, ?)')
        .run(link.id, link.parentId, childId, link.type ?? null, dateId);
    });
  }

  deletePlace(id: string): boolean {
    // fact.place_id is ON DELETE SET NULL — facts detach automatically and
    // keep their raw place_text. The op that deletes a place restores the
    // link on undo. The place's own names/hierarchy rows and the hierarchy
    // rows where it is the parent cascade; their date rows are owned by the
    // deleted rows, so collect them first.
    const dateRows = this.db
      .prepare(
        `SELECT date_id FROM place_postal_code WHERE place_id = ? AND date_id IS NOT NULL
         UNION
         SELECT date_id FROM place_name WHERE place_id = ? AND date_id IS NOT NULL
         UNION
         SELECT date_id FROM place_hierarchy WHERE child_id = ? AND date_id IS NOT NULL
         UNION
         SELECT date_id FROM place_hierarchy WHERE parent_id = ? AND date_id IS NOT NULL`,
      )
      .all(id, id, id, id) as unknown as { date_id: string }[];
    const removed = this.db.prepare('DELETE FROM place WHERE id = ?').run(id).changes > 0;
    for (const entry of dateRows) {
      this.dates.delete(entry.date_id);
    }
    return removed;
  }

  private replaceDetails(place: PlaceRecord): void {
    const oldDates = new Set(
      [
        ...(this.db
          .prepare('SELECT date_id FROM place_postal_code WHERE place_id = ? AND date_id IS NOT NULL')
          .all(place.id) as unknown as { date_id: string }[]),
        ...(this.db
          .prepare('SELECT date_id FROM place_name WHERE place_id = ? AND date_id IS NOT NULL')
          .all(place.id) as unknown as { date_id: string }[]),
        ...(this.db
          .prepare('SELECT date_id FROM place_hierarchy WHERE child_id = ? AND date_id IS NOT NULL')
          .all(place.id) as unknown as { date_id: string }[]),
      ].map((entry) => entry.date_id),
    );
    this.db.prepare('DELETE FROM place_name WHERE place_id = ?').run(place.id);
    this.db.prepare('DELETE FROM place_hierarchy WHERE child_id = ?').run(place.id);
    this.db.prepare('DELETE FROM place_postal_code WHERE place_id = ?').run(place.id);

    const newDates = new Set<string>();
    place.names.forEach((name, position) => {
      const dateId = name.date ? this.dates.upsert(name.date) : null;
      if (dateId !== null) {
        newDates.add(dateId);
      }
      this.insertName.run(
        name.id,
        place.id,
        name.kind ?? 'official',
        name.language ?? null,
        name.type ?? null,
        position,
        name.value,
        dateId,
        name.addition ?? null,
        name.abbreviation ?? null,
        name.abbreviationType ?? null,
      );
    });
    const insertHierarchy = this.db.prepare(
      'INSERT INTO place_hierarchy (id, parent_id, child_id, type, date_id) VALUES (?, ?, ?, ?, ?)',
    );
    for (const parent of place.hierarchy ?? []) {
      const dateId = parent.date ? this.dates.upsert(parent.date) : null;
      if (dateId !== null) {
        newDates.add(dateId);
      }
      insertHierarchy.run(parent.id, parent.parentId, place.id, parent.type ?? null, dateId);
    }
    const insertPostal = this.db.prepare(
      'INSERT INTO place_postal_code (id, place_id, code, date_id) VALUES (?, ?, ?, ?)',
    );
    for (const postal of place.postalCodes ?? []) {
      const dateId = postal.date ? this.dates.upsert(postal.date) : null;
      insertPostal.run(postal.id, place.id, postal.code, dateId);
      if (dateId !== null) {
        newDates.add(dateId);
      }
    }
    for (const stale of oldDates) {
      if (!newDates.has(stale)) {
        this.dates.delete(stale);
      }
    }
  }

  private hydrate(row: PlaceRow): PlaceRecord {
    const names = this.db
      .prepare(
        `SELECT id, place_id, kind, language, type, position, value, date_id, addition,
           abbreviation, abbreviation_type
         FROM place_name WHERE place_id = ? ORDER BY position`,
      )
      .all(row.id) as unknown as PlaceNameRow[];
    const hierarchyRows = this.db
      .prepare('SELECT id, parent_id, type, date_id FROM place_hierarchy WHERE child_id = ? ORDER BY type')
      .all(row.id) as unknown as {
      id: string;
      parent_id: string;
      type: string | null;
      date_id: string | null;
    }[];
    const postalRows = this.db
      .prepare('SELECT id, code, date_id FROM place_postal_code WHERE place_id = ?')
      .all(row.id) as unknown as { id: string; code: string; date_id: string | null }[];
    const dateIds = [
      ...names.map((name) => name.date_id),
      ...hierarchyRows.map((entry) => entry.date_id),
      ...postalRows.map((entry) => entry.date_id),
    ].filter((id): id is string => id !== null);
    const datesById = this.dates.getMany(dateIds);
    const hierarchy = hierarchyRows.map((entry) => {
      const date = entry.date_id !== null ? datesById.get(entry.date_id) : undefined;
      return {
        id: entry.id,
        parentId: entry.parent_id,
        ...(entry.type !== null ? { type: entry.type } : {}),
        ...(date !== undefined ? { date } : {}),
      };
    });
    return {
      id: row.id,
      xref: row.xref ?? undefined,
      latitude: row.latitude ?? undefined,
      longitude: row.longitude ?? undefined,
      verified: row.verified === 1 ? true : undefined,
      ...(row.form !== null ? { form: row.form.split(',').map((value) => value.trim()) } : {}),
      ...(row.abbreviation !== null ? { abbreviation: row.abbreviation } : {}),
      ...(row.preposition !== null ? { preposition: row.preposition } : {}),
      ...(row.gov_id !== null ? { govId: row.gov_id } : {}),
      ...(row.maidenhead !== null ? { maidenhead: row.maidenhead } : {}),
      ...(row.place_type !== null ? { placeType: row.place_type } : {}),
      names: names.map((name) => {
        const date = name.date_id !== null ? datesById.get(name.date_id) : undefined;
        return {
          id: name.id,
          kind: name.kind as PlaceName['kind'],
          language: name.language ?? undefined,
          type: name.type ?? undefined,
          position: name.position,
          value: name.value,
          ...(date !== undefined ? { date } : {}),
          ...(name.addition !== null ? { addition: name.addition } : {}),
          ...(name.abbreviation !== null ? { abbreviation: name.abbreviation } : {}),
          ...(name.abbreviation_type !== null ? { abbreviationType: name.abbreviation_type } : {}),
        };
      }),
      hierarchy: hierarchy.length > 0 ? hierarchy : undefined,
      postalCodes:
        postalRows.length > 0
          ? postalRows.map((postal) => {
              const date = postal.date_id !== null ? datesById.get(postal.date_id) : undefined;
              return {
                id: postal.id,
                code: postal.code,
                ...(date !== undefined ? { date } : {}),
              };
            })
          : undefined,
    };
  }
}
