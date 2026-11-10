import type { DatabaseSync } from 'node:sqlite';
import type { PlaceName, PlaceRecord } from '../model/types';
import type { DateRepo } from './dateRepo';

interface PlaceRow {
  id: string;
  xref: string | null;
  latitude: number | null;
  longitude: number | null;
  verified: number;
}

interface PlaceNameRow {
  id: string;
  place_id: string;
  kind: string;
  language: string | null;
  type: string | null;
  position: number;
  value: string;
}

/**
 * The single writer of the place tables and the place-name FTS index.
 * A place is a row plus its names (one jurisdiction per row, smallest
 * first), hierarchy links and postal codes.
 */
export class PlaceRepo {
  private readonly insertName: ReturnType<DatabaseSync['prepare']>;
  private readonly insertFts: ReturnType<DatabaseSync['prepare']>;

  constructor(
    private readonly db: DatabaseSync,
    private readonly dates: DateRepo,
  ) {
    this.insertName = this.db.prepare(
      `INSERT INTO place_name (id, place_id, kind, language, type, position, value)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    this.insertFts = this.db.prepare('INSERT INTO place_name_fts (place_id, name) VALUES (?, ?)');
  }

  insertPlace(place: PlaceRecord): void {
    this.db
      .prepare('INSERT INTO place (id, xref, latitude, longitude, verified) VALUES (?, ?, ?, ?, ?)')
      .run(
        place.id,
        place.xref ?? null,
        place.latitude ?? null,
        place.longitude ?? null,
        place.verified ? 1 : 0,
      );
    this.replaceDetails(place);
  }

  /** Replaces the place's names, hierarchy and postal codes wholesale. */
  updatePlace(place: PlaceRecord): void {
    this.db
      .prepare('UPDATE place SET xref = ?, latitude = ?, longitude = ?, verified = ? WHERE id = ?')
      .run(place.xref ?? null, place.latitude ?? null, place.longitude ?? null, place.verified ? 1 : 0, place.id);
    this.replaceDetails(place);
  }

  getPlace(id: string): PlaceRecord | undefined {
    const row = this.db.prepare('SELECT id, xref, latitude, longitude, verified FROM place WHERE id = ?').get(id) as
      | PlaceRow
      | undefined;
    return row ? this.hydrate(row) : undefined;
  }

  /** Every place, ordered by the joined name. */
  listPlaces(): PlaceRecord[] {
    const rows = this.db.prepare('SELECT id, xref, latitude, longitude, verified FROM place ORDER BY id').all() as unknown as PlaceRow[];
    return rows.map((row) => this.hydrate(row));
  }

  /**
   * Places whose names contain the search terms. Same FTS strategy as the
   * person search: trigram MATCH for terms of 3+ characters, a scan of the
   * lowercased FTS content for shorter ones.
   */
  searchPlaces(query: string, limit = 50): PlaceRecord[] {
    const search = query.trim();
    if (search === '') {
      return this.listPlaces().slice(0, limit);
    }
    const terms = search.split(/\s+/).filter((term) => term !== '');
    const conditions: string[] = [];
    const params: string[] = [];
    if (terms.every((term) => [...term].length >= 3)) {
      const matchQuery = terms.map((term) => `"${term.toLowerCase().replaceAll('"', '""')}"`).join(' AND ');
      conditions.push('p.id IN (SELECT place_id FROM place_name_fts WHERE place_name_fts MATCH ?)');
      params.push(matchQuery);
    } else {
      conditions.push(
        'p.id IN (SELECT place_id FROM place_name_fts fts WHERE instr(fts.name, ?) > 0)',
      );
      params.push(search.toLowerCase());
    }
    const rows = this.db
      .prepare(
        `SELECT p.id, p.xref, p.latitude, p.longitude, p.verified FROM place p
         WHERE ${conditions.join(' AND ')} ORDER BY p.id LIMIT ?`,
      )
      .all(...params, limit) as unknown as PlaceRow[];
    return rows.map((row) => this.hydrate(row));
  }

  deletePlace(id: string): boolean {
    // fact.place_id is ON DELETE SET NULL — facts detach automatically and
    // keep their raw place_text. The op that deletes a place restores the
    // link on undo.
    this.db.prepare('DELETE FROM place_name_fts WHERE place_id = ?').run(id);
    return this.db.prepare('DELETE FROM place WHERE id = ?').run(id).changes > 0;
  }

  private replaceDetails(place: PlaceRecord): void {
    this.db.prepare('DELETE FROM place_name_fts WHERE place_id = ?').run(place.id);
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
      );
      const searchable = name.value.trim().toLowerCase();
      if (searchable !== '') {
        this.insertFts.run(place.id, searchable);
      }
    });
    const insertHierarchy = this.db.prepare(
      'INSERT INTO place_hierarchy (id, parent_id, child_id, type) VALUES (?, ?, ?, ?)',
    );
    for (const parent of place.hierarchy ?? []) {
      insertHierarchy.run(crypto.randomUUID(), parent.parentId, place.id, parent.type ?? null);
    }
    const insertPostal = this.db.prepare(
      'INSERT INTO place_postal_code (id, place_id, code, date_id) VALUES (?, ?, ?, ?)',
    );
    for (const postal of place.postalCodes ?? []) {
      const dateId = postal.date ? this.dates.upsert(postal.date) : null;
      insertPostal.run(postal.id, place.id, postal.code, dateId);
    }
  }

  private hydrate(row: PlaceRow): PlaceRecord {
    const names = this.db
      .prepare(
        `SELECT id, place_id, kind, language, type, position, value
         FROM place_name WHERE place_id = ? ORDER BY position`,
      )
      .all(row.id) as unknown as PlaceNameRow[];
    const hierarchy = (
      this.db
        .prepare('SELECT parent_id, type FROM place_hierarchy WHERE child_id = ? ORDER BY type')
        .all(row.id) as unknown as { parent_id: string; type: string | null }[]
    ).map((entry) => ({
      parentId: entry.parent_id,
      ...(entry.type !== null ? { type: entry.type } : {}),
    }));
    const postalRows = this.db
      .prepare('SELECT id, code, date_id FROM place_postal_code WHERE place_id = ?')
      .all(row.id) as unknown as { id: string; code: string; date_id: string | null }[];
    const dateIds = postalRows.map((row) => row.date_id).filter((id): id is string => id !== null);
    const datesById = this.dates.getMany(dateIds);
    return {
      id: row.id,
      xref: row.xref ?? undefined,
      latitude: row.latitude ?? undefined,
      longitude: row.longitude ?? undefined,
      verified: row.verified === 1 ? true : undefined,
      names: names.map((name) => ({
        id: name.id,
        kind: (name.kind ?? undefined) as PlaceName['kind'],
        language: name.language ?? undefined,
        type: name.type ?? undefined,
        position: name.position,
        value: name.value,
      })),
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
