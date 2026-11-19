import type { DatabaseSync } from 'node:sqlite';
import type { AssociationRecord } from '../model/types';
import type { DateRepo } from './dateRepo';

/** Relations between persons: associations and aliases. */
export class RelationRepo {
  constructor(
    private readonly db: DatabaseSync,
    private readonly dates: DateRepo,
  ) {}

  // associations ---------------------------------------------------------------

  insertAssociation(association: AssociationRecord): void {
    this.db
      .prepare(
        `INSERT INTO association (id, person_id, family_id, other_person_id, role, relationship, phrase,
           primary_flag, specific_type, confidence, period_start_id, period_end_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(...associationParams(association, this.dates));
  }

  updateAssociation(association: AssociationRecord): void {
    if (this.db.prepare('SELECT 1 FROM association WHERE id = ?').get(association.id) === undefined) {
      throw new Error(`association ${association.id} no longer exists`);
    }
    const before = this.db
      .prepare('SELECT period_start_id, period_end_id FROM association WHERE id = ?')
      .get(association.id) as { period_start_id: string | null; period_end_id: string | null } | undefined;
    this.db
      .prepare(
        `UPDATE association SET person_id = ?, family_id = ?, other_person_id = ?, role = ?, relationship = ?, phrase = ?,
           primary_flag = ?, specific_type = ?, confidence = ?, period_start_id = ?, period_end_id = ?
         WHERE id = ?`,
      )
      .run(...associationParams(association, this.dates).slice(1), association.id);
    const after = this.db
      .prepare('SELECT period_start_id, period_end_id FROM association WHERE id = ?')
      .get(association.id) as { period_start_id: string | null; period_end_id: string | null } | undefined;
    const kept = new Set([after?.period_start_id, after?.period_end_id].filter((id): id is string => id != null));
    for (const dateId of [before?.period_start_id, before?.period_end_id]) {
      if (dateId !== null && dateId !== undefined && !kept.has(dateId)) {
        this.dates.delete(dateId);
      }
    }
  }

  deleteAssociation(id: string): boolean {
    const row = this.db.prepare('SELECT period_start_id, period_end_id FROM association WHERE id = ?').get(id) as
      | { period_start_id: string | null; period_end_id: string | null }
      | undefined;
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

  listAssociations(): AssociationRecord[] {
    const rows = this.db
      .prepare(
        `SELECT id, person_id, family_id, other_person_id, role, relationship, phrase,
           primary_flag, specific_type, confidence, period_start_id, period_end_id
         FROM association ORDER BY id`,
      )
      .all() as unknown as AssociationRow[];
    return rows.map((row) => this.hydrate(row));
  }

  listAssociationsFor(personId: string): AssociationRecord[] {
    const rows = this.db
      .prepare(
        `SELECT id, person_id, family_id, other_person_id, role, relationship, phrase,
           primary_flag, specific_type, confidence, period_start_id, period_end_id
         FROM association WHERE person_id = ? OR other_person_id = ? ORDER BY id`,
      )
      .all(personId, personId) as unknown as AssociationRow[];
    return rows.map((row) => this.hydrate(row));
  }

  listAssociationsForFamily(familyId: string): AssociationRecord[] {
    const rows = this.db
      .prepare(
        `SELECT id, person_id, family_id, other_person_id, role, relationship, phrase,
           primary_flag, specific_type, confidence, period_start_id, period_end_id
         FROM association WHERE family_id = ? ORDER BY id`,
      )
      .all(familyId) as unknown as AssociationRow[];
    return rows.map((row) => this.hydrate(row));
  }

  /** Deletes every association of a person with its period date rows. */
  deleteAssociationsForPerson(personId: string): void {
    const rows = this.db
      .prepare('SELECT id, period_start_id, period_end_id FROM association WHERE person_id = ? OR other_person_id = ?')
      .all(personId, personId) as unknown as {
      id: string;
      period_start_id: string | null;
      period_end_id: string | null;
    }[];
    this.db.prepare('DELETE FROM association WHERE person_id = ? OR other_person_id = ?').run(personId, personId);
    for (const row of rows) {
      for (const dateId of [row.period_start_id, row.period_end_id]) {
        if (dateId !== null) {
          this.dates.delete(dateId);
        }
      }
    }
  }

  private hydrate(row: AssociationRow): AssociationRecord {
    const datesById = this.dates.getMany(
      [row.period_start_id, row.period_end_id].filter((id): id is string => id !== null),
    );
    return {
      id: row.id,
      personId: row.person_id ?? undefined,
      familyId: row.family_id ?? undefined,
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
    this.db.prepare('INSERT INTO person_alias (id, person_id, alias_id) VALUES (?, ?, ?)').run(id, personId, aliasId);
  }

  deleteAlias(id: string): boolean {
    return this.db.prepare('DELETE FROM person_alias WHERE id = ?').run(id).changes > 0;
  }

  listAliasesFor(personId: string): Array<{ id: string; aliasId: string }> {
    const rows = this.db
      .prepare(
        `SELECT id, person_id, alias_id FROM person_alias
         WHERE person_id = ? OR alias_id = ?
         ORDER BY id`,
      )
      .all(personId, personId) as unknown as { id: string; person_id: string; alias_id: string }[];
    return rows.map((row) => ({
      id: row.id,
      // The link is symmetric for display: return the other person.
      aliasId: row.person_id === personId ? row.alias_id : row.person_id,
    }));
  }

  /** Exact direction of every alias link involving a person, for snapshots. */
  listAliasRowsFor(personId: string): Array<{ id: string; personId: string; aliasId: string }> {
    const rows = this.db
      .prepare(
        `SELECT id, person_id, alias_id FROM person_alias
         WHERE person_id = ? OR alias_id = ?
         ORDER BY id`,
      )
      .all(personId, personId) as unknown as { id: string; person_id: string; alias_id: string }[];
    return rows.map((row) => ({ id: row.id, personId: row.person_id, aliasId: row.alias_id }));
  }

  /** Deletes every alias link involving a person. */
  deleteAliasesForPerson(personId: string): void {
    this.db.prepare('DELETE FROM person_alias WHERE person_id = ? OR alias_id = ?').run(personId, personId);
  }
}

interface AssociationRow {
  id: string;
  person_id: string | null;
  family_id: string | null;
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

function associationParams(association: AssociationRecord, dates: DateRepo): Array<string | number | null> {
  return [
    association.id,
    association.personId ?? null,
    association.familyId ?? null,
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
