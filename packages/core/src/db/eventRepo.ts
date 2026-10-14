import type { DatabaseSync } from 'node:sqlite';
import type { DateValue, EventRecord } from '../model/types';

export class EventRepo {
  constructor(private readonly db: DatabaseSync) {}

  insertEvent(event: EventRecord): void {
    let placeId: string | null = null;
    if (event.place) {
      const existing = this.db.prepare('SELECT id FROM place WHERE name = ?').get(event.place) as
        | { id: string }
        | undefined;
      if (existing) {
        placeId = existing.id;
      } else {
        placeId = crypto.randomUUID();
        this.db.prepare('INSERT INTO place (id, name) VALUES (?, ?)').run(placeId, event.place);
      }
    }
    this.db
      .prepare(
        'INSERT INTO event (id, type, date_json, place_id, description, person_id, family_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        event.id,
        event.type,
        event.date ? JSON.stringify(event.date) : null,
        placeId,
        event.description ?? null,
        event.personId ?? null,
        event.familyId ?? null,
      );
  }

  deleteEvent(id: string): boolean {
    const result = this.db.prepare('DELETE FROM event WHERE id = ?').run(id);
    return result.changes > 0;
  }

  listEventsForPerson(personId: string): EventRecord[] {
    return this.queryEvents('person_id', personId);
  }

  listEventsForFamily(familyId: string): EventRecord[] {
    return this.queryEvents('family_id', familyId);
  }

  private queryEvents(column: string, id: string): EventRecord[] {
    const rows = this.db
      .prepare(
        `SELECT e.id, e.type, e.date_json, p.name AS place, e.description, e.person_id, e.family_id
         FROM event e LEFT JOIN place p ON p.id = e.place_id WHERE e.${column} = ? ORDER BY e.id`,
      )
      .all(id) as unknown as Array<{
      id: string;
      type: string;
      date_json: string | null;
      place: string | null;
      description: string | null;
      person_id: string | null;
      family_id: string | null;
    }>;
    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      date: row.date_json ? (JSON.parse(row.date_json) as DateValue) : undefined,
      place: row.place ?? undefined,
      description: row.description ?? undefined,
      personId: row.person_id ?? undefined,
      familyId: row.family_id ?? undefined,
    }));
  }
}
