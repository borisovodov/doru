import type { DatabaseSync } from 'node:sqlite';
import type { AssociationRecord } from '../model/types';
import type { DateRepo } from './dateRepo';
import type { TransactionScope } from './transaction';

/** Relations between persons: associations and aliases. */
export class RelationRepo {
  constructor(
    private readonly db: DatabaseSync,
    private readonly dates: DateRepo,
    private readonly transactions: TransactionScope,
  ) {}

  // associations ---------------------------------------------------------------

  insertAssociation(association: AssociationRecord): void {
    this.transactions.run(() => {
      const periodStartDateId =
        association.periodStart !== undefined ? this.dates.create(association.periodStart) : null;
      const periodEndDateId = association.periodEnd !== undefined ? this.dates.create(association.periodEnd) : null;
      this.db
        .prepare(
          `INSERT INTO association (id, person_id, family_id, other_person_id, role, relationship, phrase,
             primary_flag, specific_type, confidence, period_start_date_id, period_end_date_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(...associationParams(association), periodStartDateId, periodEndDateId);
    });
  }

  updateAssociation(association: AssociationRecord): void {
    this.transactions.run(() => {
      const current = this.db
        .prepare('SELECT period_start_date_id, period_end_date_id FROM association WHERE id = ?')
        .get(association.id) as AssociationDateIds | undefined;
      if (current === undefined) {
        throw new Error(`association ${association.id} no longer exists`);
      }
      const prepared = this.dates.prepareSlots(
        [current.period_start_date_id, current.period_end_date_id],
        [association.periodStart, association.periodEnd],
      );
      this.db
        .prepare(
          `UPDATE association SET person_id = ?, family_id = ?, other_person_id = ?, role = ?, relationship = ?, phrase = ?,
             primary_flag = ?, specific_type = ?, confidence = ?,
             period_start_date_id = ?, period_end_date_id = ?
           WHERE id = ?`,
        )
        .run(...associationParams(association).slice(1), ...prepared.ids, association.id);
      this.dates.deleteMany(prepared.obsolete);
    });
  }

  deleteAssociation(id: string): boolean {
    return this.transactions.run(() => {
      const current = this.db
        .prepare('SELECT period_start_date_id, period_end_date_id FROM association WHERE id = ?')
        .get(id) as AssociationDateIds | undefined;
      const changed = this.db.prepare('DELETE FROM association WHERE id = ?').run(id).changes > 0;
      if (changed) {
        this.dates.deleteMany(associationDateIds(current));
      }
      return changed;
    });
  }

  listAssociations(): AssociationRecord[] {
    const rows = this.db.prepare(`${associationSelect} ORDER BY id`).all() as unknown as AssociationRow[];
    return this.hydrateMany(rows);
  }

  listAssociationsFor(personId: string): AssociationRecord[] {
    const rows = this.db
      .prepare(`${associationSelect} WHERE person_id = ? OR other_person_id = ? ORDER BY id`)
      .all(personId, personId) as unknown as AssociationRow[];
    return this.hydrateMany(rows);
  }

  listAssociationsForFamily(familyId: string): AssociationRecord[] {
    const rows = this.db
      .prepare(`${associationSelect} WHERE family_id = ? ORDER BY id`)
      .all(familyId) as unknown as AssociationRow[];
    return this.hydrateMany(rows);
  }

  /** Deletes every association of a person and the dates they owned. */
  deleteAssociationsForPerson(personId: string): void {
    this.deleteAssociationsWhere('person_id = ? OR other_person_id = ?', [personId, personId]);
  }

  /** Deletes every association of a family and the dates they owned. */
  deleteAssociationsForFamily(familyId: string): void {
    this.deleteAssociationsWhere('family_id = ?', [familyId]);
  }

  private deleteAssociationsWhere(where: string, params: string[]): void {
    this.transactions.run(() => {
      const rows = this.db
        .prepare(
          `SELECT period_start_date_id, period_end_date_id FROM association
           WHERE ${where}`,
        )
        .all(...params) as unknown as AssociationDateIds[];
      const changed = this.db.prepare(`DELETE FROM association WHERE ${where}`).run(...params).changes;
      if (changed > 0) {
        this.dates.deleteMany(rows.flatMap(associationDateIds));
      }
    });
  }

  private hydrateMany(rows: AssociationRow[]): AssociationRecord[] {
    const dates = this.dates.getMany(rows.flatMap((row) => [row.period_start_date_id, row.period_end_date_id]));
    return rows.map((row) => ({
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
      periodStart: row.period_start_date_id !== null ? dates.get(row.period_start_date_id) : undefined,
      periodEnd: row.period_end_date_id !== null ? dates.get(row.period_end_date_id) : undefined,
    }));
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
  period_start_date_id: string | null;
  period_end_date_id: string | null;
}

type AssociationDateIds = Pick<AssociationRow, 'period_start_date_id' | 'period_end_date_id'>;

const associationSelect = `SELECT id, person_id, family_id, other_person_id, role, relationship, phrase,
  primary_flag, specific_type, confidence, period_start_date_id, period_end_date_id
  FROM association`;

function associationDateIds(ids: AssociationDateIds | undefined): Array<string | null> {
  if (ids === undefined) {
    return [];
  }
  return [ids.period_start_date_id, ids.period_end_date_id];
}

function associationParams(association: AssociationRecord): Array<string | number | null> {
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
  ];
}
