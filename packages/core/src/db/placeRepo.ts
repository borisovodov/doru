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
  maidenhead: string | null;
  place_type: string | null;
  created_at: number | null;
  updated_at: number | null;
}

interface PlaceNameRow {
  id: string;
  place_id: string;
  kind: string;
  language: string | null;
  type: string | null;
  position: number;
  value: string;
  addition: string | null;
  abbreviation: string | null;
  abbreviation_type: string | null;
  date_id: string | null;
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
         addition, abbreviation, abbreviation_type, date_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
  }

  insertPlace(place: PlaceRecord): void {
    this.transactions.run(() => {
      this.db
        .prepare(`INSERT INTO place (id, xref, latitude, longitude, verified, form, abbreviation,
          preposition, maidenhead, place_type, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(
          place.id,
          place.xref ?? null,
          place.latitude ?? null,
          place.longitude ?? null,
          place.verified ? 1 : 0,
          place.form !== undefined ? place.form.join(', ') : null,
          place.abbreviation ?? null,
          place.preposition ?? null,
          place.maidenhead ?? null,
          place.placeType ?? null,
          place.createdAt ?? null,
          place.updatedAt ?? null,
        );
      this.replaceDetails(place);
    });
  }

  /** Replaces the place's names, hierarchy and postal codes wholesale. */
  updatePlace(place: PlaceRecord): void {
    this.transactions.run(() => {
      if (this.db.prepare('SELECT 1 FROM place WHERE id = ?').get(place.id) === undefined) {
        throw new Error(`place ${place.id} no longer exists`);
      }
      this.db
        .prepare(`UPDATE place SET xref = ?, latitude = ?, longitude = ?, verified = ?, form = ?,
          abbreviation = ?, preposition = ?, maidenhead = ?, place_type = ?,
          created_at = ?, updated_at = ? WHERE id = ?`)
        .run(
          place.xref ?? null,
          place.latitude ?? null,
          place.longitude ?? null,
          place.verified ? 1 : 0,
          place.form !== undefined ? place.form.join(', ') : null,
          place.abbreviation ?? null,
          place.preposition ?? null,
          place.maidenhead ?? null,
          place.placeType ?? null,
          place.createdAt ?? null,
          place.updatedAt ?? null,
          place.id,
        );
      this.replaceDetails(place);
    });
  }

  getPlace(id: string): PlaceRecord | undefined {
    const row = this.db
      .prepare(`SELECT id, xref, latitude, longitude, verified, form, abbreviation, preposition,
        maidenhead, place_type, created_at, updated_at FROM place WHERE id = ?`)
      .get(id) as PlaceRow | undefined;
    return row ? this.hydrate(row) : undefined;
  }

  /** Every place, ordered by the joined name. */
  /** Hierarchy rows whose parent is the given place. */
  listHierarchyLinksByParent(parentId: string): Array<{ id: string; childId: string }> {
    const rows = this.db
      .prepare('SELECT id, child_id FROM place_hierarchy WHERE parent_id = ? ORDER BY child_id, id')
      .all(parentId) as unknown as { id: string; child_id: string }[];
    return rows.map((row) => ({ id: row.id, childId: row.child_id }));
  }

  listPlaces(): PlaceRecord[] {
    const rows = this.db
      .prepare(`SELECT id, xref, latitude, longitude, verified, form, abbreviation, preposition,
        maidenhead, place_type, created_at, updated_at FROM place ORDER BY id`)
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
      const dateId = link.date !== undefined ? this.dates.create(link.date) : null;
      this.db
        .prepare('INSERT INTO place_hierarchy (id, parent_id, child_id, type, date_id) VALUES (?, ?, ?, ?, ?)')
        .run(link.id, link.parentId, childId, link.type ?? null, dateId);
    });
  }

  deletePlace(id: string): boolean {
    // fact.place_id is ON DELETE SET NULL — facts detach automatically and
    // keep their raw place_text. The op that deletes a place restores the
    // link on undo. The place's names, hierarchy rows on either side and
    // postal codes cascade; their dates are collected and deleted here.
    return this.transactions.run(() => {
      const nameDates = this.db
        .prepare('SELECT date_id FROM place_name WHERE place_id = ?')
        .all(id) as unknown as Array<{ date_id: string | null }>;
      const hierarchyDates = this.db
        .prepare('SELECT date_id FROM place_hierarchy WHERE parent_id = ? OR child_id = ?')
        .all(id, id) as unknown as Array<{ date_id: string | null }>;
      const postalDates = this.db
        .prepare('SELECT date_id FROM place_postal_code WHERE place_id = ?')
        .all(id) as unknown as Array<{ date_id: string | null }>;
      const changed = this.db.prepare('DELETE FROM place WHERE id = ?').run(id).changes > 0;
      if (changed) {
        this.dates.deleteMany([
          ...nameDates.map((row) => row.date_id),
          ...hierarchyDates.map((row) => row.date_id),
          ...postalDates.map((row) => row.date_id),
        ]);
      }
      return changed;
    });
  }

  private replaceDetails(place: PlaceRecord): void {
    const nameRows = this.db
      .prepare('SELECT id, date_id FROM place_name WHERE place_id = ?')
      .all(place.id) as unknown as Array<{ id: string; date_id: string | null }>;
    const hierarchyRows = this.db
      .prepare('SELECT id, date_id FROM place_hierarchy WHERE child_id = ?')
      .all(place.id) as unknown as Array<{ id: string; date_id: string | null }>;
    const postalRows = this.db
      .prepare('SELECT id, date_id FROM place_postal_code WHERE place_id = ?')
      .all(place.id) as unknown as Array<{ id: string; date_id: string | null }>;
    const reservedDates = new Map([
      ...dateReservations(nameRows, 'place_name'),
      ...dateReservations(hierarchyRows, 'place_hierarchy'),
      ...dateReservations(postalRows, 'place_postal_code'),
    ]);
    this.db.prepare('DELETE FROM place_name WHERE place_id = ?').run(place.id);
    this.db.prepare('DELETE FROM place_hierarchy WHERE child_id = ?').run(place.id);
    this.db.prepare('DELETE FROM place_postal_code WHERE place_id = ?').run(place.id);
    this.dates.deleteMany([
      ...nameRows.map((row) => row.date_id),
      ...hierarchyRows.map((row) => row.date_id),
      ...postalRows.map((row) => row.date_id),
    ]);

    place.names.forEach((name, position) => {
      const dateId =
        name.date !== undefined
          ? this.dates.create(name.date, { ownerKey: `place_name:${name.id}`, reserved: reservedDates })
          : null;
      this.insertName.run(
        name.id,
        place.id,
        name.kind ?? 'official',
        name.language ?? null,
        name.type ?? null,
        position,
        name.value,
        name.addition ?? null,
        name.abbreviation ?? null,
        name.abbreviationType ?? null,
        dateId,
      );
    });
    const insertHierarchy = this.db.prepare(
      'INSERT INTO place_hierarchy (id, parent_id, child_id, type, date_id) VALUES (?, ?, ?, ?, ?)',
    );
    for (const parent of place.hierarchy ?? []) {
      const dateId =
        parent.date !== undefined
          ? this.dates.create(parent.date, { ownerKey: `place_hierarchy:${parent.id}`, reserved: reservedDates })
          : null;
      insertHierarchy.run(parent.id, parent.parentId, place.id, parent.type ?? null, dateId);
    }
    const insertPostal = this.db.prepare(
      'INSERT INTO place_postal_code (id, place_id, code, date_id) VALUES (?, ?, ?, ?)',
    );
    for (const postal of place.postalCodes ?? []) {
      const dateId =
        postal.date !== undefined
          ? this.dates.create(postal.date, { ownerKey: `place_postal_code:${postal.id}`, reserved: reservedDates })
          : null;
      insertPostal.run(postal.id, place.id, postal.code, dateId);
    }
  }

  private hydrate(row: PlaceRow): PlaceRecord {
    const names = this.db
      .prepare(
        `SELECT id, place_id, kind, language, type, position, value, addition,
           abbreviation, abbreviation_type, date_id
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
    const dates = this.dates.getMany([
      ...names.map((name) => name.date_id),
      ...hierarchyRows.map((entry) => entry.date_id),
      ...postalRows.map((entry) => entry.date_id),
    ]);
    const hierarchy = hierarchyRows.map((entry) => {
      const date = entry.date_id !== null ? dates.get(entry.date_id) : undefined;
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
      ...(row.maidenhead !== null ? { maidenhead: row.maidenhead } : {}),
      ...(row.place_type !== null ? { placeType: row.place_type } : {}),
      createdAt: row.created_at ?? undefined,
      updatedAt: row.updated_at ?? undefined,
      names: names.map((name) => {
        const date = name.date_id !== null ? dates.get(name.date_id) : undefined;
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
              const date = postal.date_id !== null ? dates.get(postal.date_id) : undefined;
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

function dateReservations(rows: Array<{ id: string; date_id: string | null }>, ownerType: string): Map<string, string> {
  const reservations = new Map<string, string>();
  for (const row of rows) {
    if (row.date_id !== null) {
      reservations.set(row.date_id, `${ownerType}:${row.id}`);
    }
  }
  return reservations;
}
