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
         addition, abbreviation, abbreviation_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      this.db
        .prepare('INSERT INTO place_hierarchy (id, parent_id, child_id, type) VALUES (?, ?, ?, ?)')
        .run(link.id, link.parentId, childId, link.type ?? null);
      this.dates.upsertForOwner('place_hierarchy', link.id, 'date', link.date);
    });
  }

  deletePlace(id: string): boolean {
    // fact.place_id is ON DELETE SET NULL — facts detach automatically and
    // keep their raw place_text. The op that deletes a place restores the
    // link on undo. The place's own names/hierarchy rows and the hierarchy
    // rows where it is the parent cascade; their owner triggers delete the
    // date rows with them.
    return this.db.prepare('DELETE FROM place WHERE id = ?').run(id).changes > 0;
  }

  private replaceDetails(place: PlaceRecord): void {
    this.db.prepare('DELETE FROM place_name WHERE place_id = ?').run(place.id);
    this.db.prepare('DELETE FROM place_hierarchy WHERE child_id = ?').run(place.id);
    this.db.prepare('DELETE FROM place_postal_code WHERE place_id = ?').run(place.id);

    place.names.forEach((name, position) => {
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
      );
      this.dates.upsertForOwner('place_name', name.id, 'date', name.date);
    });
    const insertHierarchy = this.db.prepare(
      'INSERT INTO place_hierarchy (id, parent_id, child_id, type) VALUES (?, ?, ?, ?)',
    );
    for (const parent of place.hierarchy ?? []) {
      insertHierarchy.run(parent.id, parent.parentId, place.id, parent.type ?? null);
      this.dates.upsertForOwner('place_hierarchy', parent.id, 'date', parent.date);
    }
    const insertPostal = this.db.prepare('INSERT INTO place_postal_code (id, place_id, code) VALUES (?, ?, ?)');
    for (const postal of place.postalCodes ?? []) {
      insertPostal.run(postal.id, place.id, postal.code);
      this.dates.upsertForOwner('place_postal_code', postal.id, 'date', postal.date);
    }
  }

  private hydrate(row: PlaceRow): PlaceRecord {
    const names = this.db
      .prepare(
        `SELECT id, place_id, kind, language, type, position, value, addition,
           abbreviation, abbreviation_type
         FROM place_name WHERE place_id = ? ORDER BY position`,
      )
      .all(row.id) as unknown as PlaceNameRow[];
    const hierarchyRows = this.db
      .prepare('SELECT id, parent_id, type FROM place_hierarchy WHERE child_id = ? ORDER BY type')
      .all(row.id) as unknown as {
      id: string;
      parent_id: string;
      type: string | null;
    }[];
    const postalRows = this.db
      .prepare('SELECT id, code FROM place_postal_code WHERE place_id = ?')
      .all(row.id) as unknown as { id: string; code: string }[];
    const nameDates = this.dates.getManyForOwners(
      'place_name',
      names.map((name) => name.id),
    );
    const hierarchyDates = this.dates.getManyForOwners(
      'place_hierarchy',
      hierarchyRows.map((entry) => entry.id),
    );
    const postalDates = this.dates.getManyForOwners(
      'place_postal_code',
      postalRows.map((entry) => entry.id),
    );
    const hierarchy = hierarchyRows.map((entry) => {
      const date = hierarchyDates.get(entry.id)?.get('date');
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
        const date = nameDates.get(name.id)?.get('date');
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
              const date = postalDates.get(postal.id)?.get('date');
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
