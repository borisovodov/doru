import type { DatabaseSync } from 'node:sqlite';
import type { AssociationRecord, OrdinanceRecord } from '../model/types';
import type { DateRepo } from './dateRepo';

/** Relations between persons: associations, aliases and LDS ordinances. */
export class RelationRepo {
  constructor(
    private readonly db: DatabaseSync,
    private readonly dates: DateRepo,
  ) {}

  // associations ---------------------------------------------------------------

  insertAssociation(association: AssociationRecord): void {
    this.db
      .prepare(
        `INSERT INTO association (id, person_id, other_person_id, role, relationship, phrase,
           primary_flag, specific_type, confidence, period_start_id, period_end_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(...associationParams(association, this.dates));
  }

  updateAssociation(association: AssociationRecord): void {
    this.db
      .prepare(
        `UPDATE association SET person_id = ?, other_person_id = ?, role = ?, relationship = ?, phrase = ?,
           primary_flag = ?, specific_type = ?, confidence = ?, period_start_id = ?, period_end_id = ?
         WHERE id = ?`,
      )
      .run(...associationParams(association, this.dates), association.id);
  }

  deleteAssociation(id: string): boolean {
    const row = this.db
      .prepare('SELECT period_start_id, period_end_id FROM association WHERE id = ?')
      .get(id) as { period_start_id: string | null; period_end_id: string | null } | undefined;
    const result = this.db.prepare('DELETE FROM association WHERE id = ?').run(id);
    if (row) {
      for (const dateId of [row.period_start_id, row.period_end_id]) {
        if (dateId !== null) {
          this.dates.delete(dateId);
        }
      }
    }
    return result.changes > 0;
  }

  getAssociation(id: string): AssociationRecord | undefined {
    const row = this.db
      .prepare(
        `SELECT id, person_id, other_person_id, role, relationship, phrase,
           primary_flag, specific_type, confidence, period_start_id, period_end_id
         FROM association WHERE id = ?`,
      )
      .get(id) as AssociationRow | undefined;
    return row ? this.hydrate(row) : undefined;
  }

  listAssociations(): AssociationRecord[] {
    const rows = this.db
      .prepare(
        `SELECT id, person_id, other_person_id, role, relationship, phrase,
           primary_flag, specific_type, confidence, period_start_id, period_end_id
         FROM association ORDER BY id`,
      )
      .all() as unknown as AssociationRow[];
    return rows.map((row) => this.hydrate(row));
  }

  listAssociationsFor(personId: string): AssociationRecord[] {
    const rows = this.db
      .prepare(
        `SELECT id, person_id, other_person_id, role, relationship, phrase,
           primary_flag, specific_type, confidence, period_start_id, period_end_id
         FROM association WHERE person_id = ? OR other_person_id = ? ORDER BY id`,
      )
      .all(personId, personId) as unknown as AssociationRow[];
    return rows.map((row) => this.hydrate(row));
  }

  private hydrate(row: AssociationRow): AssociationRecord {
    const datesById = this.dates.getMany(
      [row.period_start_id, row.period_end_id].filter((id): id is string => id !== null),
    );
    return {
      id: row.id,
      personId: row.person_id,
      otherPersonId: row.other_person_id,
      role: row.role ?? undefined,
      relationship: row.relationship ?? undefined,
      phrase: row.phrase ?? undefined,
      primary: row.primary_flag === 1 ? true : undefined,
      specificType: row.specific_type ?? undefined,
      confidence: row.confidence ?? undefined,
      periodStart: row.period_start_id !== null ? datesById.get(row.period_start_id) : undefined,
      periodEnd: row.period_end_id !== null ? datesById.get(row.period_end_id) : undefined,
    };
  }

  // aliases ---------------------------------------------------------------------

  insertAlias(id: string, personId: string, aliasId: string): void {
    this.db
      .prepare('INSERT INTO person_alias (id, person_id, alias_id) VALUES (?, ?, ?)')
      .run(id, personId, aliasId);
  }

  deleteAlias(id: string): boolean {
    return this.db.prepare('DELETE FROM person_alias WHERE id = ?').run(id).changes > 0;
  }

  listAliasesFor(personId: string): Array<{ id: string; aliasId: string }> {
    const rows = this.db
      .prepare('SELECT id, alias_id FROM person_alias WHERE person_id = ? ORDER BY id')
      .all(personId) as unknown as { id: string; alias_id: string }[];
    return rows.map((row) => ({ id: row.id, aliasId: row.alias_id }));
  }

  // ordinances ------------------------------------------------------------------

  insertOrdinance(ordinance: OrdinanceRecord): void {
    this.db
      .prepare(
        `INSERT INTO ordinance (id, kind, target_type, target_id, date_id, temple, place_id, status, status_date_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(...ordinanceParams(ordinance, this.dates));
  }

  updateOrdinance(ordinance: OrdinanceRecord): void {
    this.db
      .prepare(
        `UPDATE ordinance SET kind = ?, target_type = ?, target_id = ?, date_id = ?, temple = ?,
           place_id = ?, status = ?, status_date_id = ? WHERE id = ?`,
      )
      .run(...ordinanceParams(ordinance, this.dates), ordinance.id);
  }

  deleteOrdinance(id: string): boolean {
    const row = this.db
      .prepare('SELECT date_id, status_date_id FROM ordinance WHERE id = ?')
      .get(id) as { date_id: string | null; status_date_id: string | null } | undefined;
    const result = this.db.prepare('DELETE FROM ordinance WHERE id = ?').run(id);
    if (row) {
      for (const dateId of [row.date_id, row.status_date_id]) {
        if (dateId !== null) {
          this.dates.delete(dateId);
        }
      }
    }
    return result.changes > 0;
  }

  listOrdinances(): OrdinanceRecord[] {
    const rows = this.db
      .prepare(
        `SELECT id, kind, target_type, target_id, date_id, temple, place_id, status, status_date_id
         FROM ordinance ORDER BY id`,
      )
      .all() as unknown as OrdinanceRow[];
    return rows.map((row) => this.hydrateOrdinance(row));
  }

  listOrdinancesFor(targetType: string, targetId: string): OrdinanceRecord[] {
    const rows = this.db
      .prepare(
        `SELECT id, kind, target_type, target_id, date_id, temple, place_id, status, status_date_id
         FROM ordinance WHERE target_type = ? AND target_id = ? ORDER BY id`,
      )
      .all(targetType, targetId) as unknown as OrdinanceRow[];
    return rows.map((row) => this.hydrateOrdinance(row));
  }

  deleteOrdinancesFor(targetType: string, targetId: string): void {
    const rows = this.db
      .prepare('SELECT id, date_id, status_date_id FROM ordinance WHERE target_type = ? AND target_id = ?')
      .all(targetType, targetId) as unknown as { id: string; date_id: string | null; status_date_id: string | null }[];
    this.db.prepare('DELETE FROM ordinance WHERE target_type = ? AND target_id = ?').run(targetType, targetId);
    for (const row of rows) {
      for (const dateId of [row.date_id, row.status_date_id]) {
        if (dateId !== null) {
          this.dates.delete(dateId);
        }
      }
    }
  }

  private hydrateOrdinance(row: OrdinanceRow): OrdinanceRecord {
    const datesById = this.dates.getMany(
      [row.date_id, row.status_date_id].filter((id): id is string => id !== null),
    );
    return {
      id: row.id,
      kind: row.kind,
      targetType: row.target_type,
      targetId: row.target_id,
      date: row.date_id !== null ? datesById.get(row.date_id) : undefined,
      temple: row.temple ?? undefined,
      placeId: row.place_id ?? undefined,
      status: row.status ?? undefined,
      statusDate: row.status_date_id !== null ? datesById.get(row.status_date_id) : undefined,
    };
  }
}

interface AssociationRow {
  id: string;
  person_id: string;
  other_person_id: string;
  role: string | null;
  relationship: string | null;
  phrase: string | null;
  primary_flag: number;
  specific_type: string | null;
  confidence: string | null;
  period_start_id: string | null;
  period_end_id: string | null;
}

interface OrdinanceRow {
  id: string;
  kind: string;
  target_type: string;
  target_id: string;
  date_id: string | null;
  temple: string | null;
  place_id: string | null;
  status: string | null;
  status_date_id: string | null;
}

function associationParams(association: AssociationRecord, dates: DateRepo): Array<string | number | null> {
  return [
    association.id,
    association.personId,
    association.otherPersonId,
    association.role ?? null,
    association.relationship ?? null,
    association.phrase ?? null,
    association.primary ? 1 : 0,
    association.specificType ?? null,
    association.confidence ?? null,
    association.periodStart ? dates.upsert(association.periodStart) : null,
    association.periodEnd ? dates.upsert(association.periodEnd) : null,
  ];
}

function ordinanceParams(ordinance: OrdinanceRecord, dates: DateRepo): Array<string | number | null> {
  return [
    ordinance.id,
    ordinance.kind,
    ordinance.targetType,
    ordinance.targetId,
    ordinance.date ? dates.upsert(ordinance.date) : null,
    ordinance.temple ?? null,
    ordinance.placeId ?? null,
    ordinance.status ?? null,
    ordinance.statusDate ? dates.upsert(ordinance.statusDate) : null,
  ];
}
