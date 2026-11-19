import type { DatabaseSync } from 'node:sqlite';
import type { FamilyChildLink, FamilyPartnerLink, FamilyRecord } from '../model/types';
import type { DateRepo } from './dateRepo';
import type { TransactionScope } from './transaction';

interface FamilyRow {
  id: string;
  xref: string | null;
  preferred: number;
  same_sex: number;
  union_kind: string | null;
  union_status: string | null;
  marriage_begin_status: string | null;
  marriage_end_status: string | null;
}

interface PartnerRow {
  id: string;
  person_id: string;
  position: number;
  preferred: number;
  date_id: string | null;
  phrase: string | null;
  name: string | null;
  civil_status: string | null;
  marriage_number: string | null;
}

interface ChildRow {
  id: string;
  child_id: string;
  position: number;
  pedigree: string | null;
  pedigree_phrase: string | null;
  status: string | null;
  status_phrase: string | null;
  father_relation: string | null;
  mother_relation: string | null;
  preferred: number;
  multiplicity: string | null;
}

/**
 * Families and their partner/child link rows. Links are addressable rows
 * with their own ids; the flat `partners`/`children` arrays on the model are
 * projections of them. Updates sync links by person id: a surviving link
 * keeps its id, and the link object is authoritative for its fields — an
 * absent optional field clears the stored value. The editors always send
 * the full link, so clearing a pedigree, status or date persists.
 */
export class FamilyRepo {
  constructor(
    private readonly db: DatabaseSync,
    private readonly transactions: TransactionScope,
    private readonly dates: DateRepo,
  ) {}

  insertFamily(family: FamilyRecord): void {
    this.transactions.run(() => {
      this.db
        .prepare(`INSERT INTO family (id, xref, preferred, same_sex, union_kind, union_status,
        marriage_begin_status, marriage_end_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(...familyParams(family));
      this.replaceLinks(family, new Map());
      this.replaceDetails(family);
    });
  }

  updateFamily(family: FamilyRecord): void {
    this.transactions.run(() => {
      this.db
        .prepare(`UPDATE family SET xref = ?, preferred = ?, same_sex = ?, union_kind = ?,
        union_status = ?, marriage_begin_status = ?, marriage_end_status = ? WHERE id = ?`)
        .run(...familyParams(family).slice(1), family.id);
      const existingPartners = this.listPartnerRows(family.id);
      const existingChildren = this.listChildRows(family.id);
      this.replaceLinks(
        family,
        new Map(existingPartners.map((row) => [row.person_id, row])),
        new Map(existingChildren.map((row) => [row.child_id, row])),
      );
      this.replaceDetails(family);
    });
  }

  getFamily(id: string): FamilyRecord | undefined {
    const row = this.db
      .prepare(`SELECT id, xref, preferred, same_sex, union_kind, union_status,
        marriage_begin_status, marriage_end_status FROM family WHERE id = ?`)
      .get(id) as FamilyRow | undefined;
    return row ? this.hydrate(row) : undefined;
  }

  /** Reconnects a surviving marriage-status row to its place. */
  setMarriageStatusPlaceId(statusId: string, placeId: string | undefined): void {
    this.db
      .prepare('UPDATE family_marriage_status SET place_id = ? WHERE id = ? AND place_id IS NULL')
      .run(placeId ?? null, statusId);
  }

  deleteFamily(id: string): boolean {
    return this.transactions.run(() => {
      const dateIds = new Set<string>();
      for (const row of this.listPartnerRows(id)) {
        if (row.date_id !== null) {
          dateIds.add(row.date_id);
        }
      }
      for (const status of this.listMarriageStatuses(id)) {
        if (status.date_id !== null) {
          dateIds.add(status.date_id);
        }
      }
      const removed = this.db.prepare('DELETE FROM family WHERE id = ?').run(id).changes > 0;
      for (const dateId of dateIds) {
        this.dates.delete(dateId);
      }
      return removed;
    });
  }

  listFamilies(): FamilyRecord[] {
    const rows = this.db
      .prepare(`SELECT id, xref, preferred, same_sex, union_kind, union_status,
        marriage_begin_status, marriage_end_status FROM family ORDER BY id`)
      .all() as unknown as FamilyRow[];
    return rows.map((row) => this.hydrate(row));
  }

  /** Every family the person belongs to, as a partner or a child. */
  listFamiliesForPerson(personId: string): FamilyRecord[] {
    const rows = this.db
      .prepare(
        `SELECT f.id, f.xref, f.preferred, f.same_sex, f.union_kind, f.union_status,
           f.marriage_begin_status, f.marriage_end_status FROM family f
         WHERE EXISTS (SELECT 1 FROM family_partner p WHERE p.family_id = f.id AND p.person_id = ?)
            OR EXISTS (SELECT 1 FROM family_child c WHERE c.family_id = f.id AND c.child_id = ?)
         ORDER BY f.id`,
      )
      .all(personId, personId) as unknown as FamilyRow[];
    return rows.map((row) => this.hydrate(row));
  }

  countFamilies(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS n FROM family').get() as { n: number };
    return row.n;
  }

  /** Writes link rows: surviving links merge with the old rows, new ones are inserted, removed ones deleted. */
  private replaceLinks(
    family: FamilyRecord,
    existingPartners: Map<string, PartnerRow>,
    existingChildren?: Map<string, ChildRow>,
  ): void {
    const oldDateIds = new Set<string>();
    for (const row of existingPartners.values()) {
      if (row.date_id !== null) {
        oldDateIds.add(row.date_id);
      }
    }
    const newDateIds = new Set<string>();

    const partnerLinks = family.partnerLinks ?? derivedPartnerLinks(family);
    const children = existingChildren ?? new Map<string, ChildRow>();
    const childLinks = family.childLinks ?? derivedChildLinks(family);

    this.db.prepare('DELETE FROM family_partner WHERE family_id = ?').run(family.id);
    const insertPartner = this.db.prepare(
      `INSERT INTO family_partner (id, family_id, person_id, position, preferred, date_id,
        phrase, name, civil_status, marriage_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const personExists = this.db.prepare('SELECT 1 FROM person WHERE id = ?');
    partnerLinks.forEach((link, position) => {
      if (personExists.get(link.personId) === undefined) {
        return;
      }
      const previous = existingPartners.get(link.personId);
      const linkId = previous?.id ?? link.id;
      const dateId = link.date ? this.dates.upsert(link.date) : null;
      if (dateId !== null) {
        newDateIds.add(dateId);
      }
      const preferred = link.preferred === true;
      insertPartner.run(
        linkId,
        family.id,
        link.personId,
        position,
        preferred ? 1 : 0,
        dateId,
        link.phrase ?? null,
        link.name ?? null,
        link.civilStatus ?? null,
        link.marriageNumber ?? null,
      );
    });

    this.db.prepare('DELETE FROM family_child WHERE family_id = ?').run(family.id);
    const insertChild = this.db.prepare(
      `INSERT INTO family_child (id, family_id, child_id, position, pedigree, pedigree_phrase, status,
        status_phrase, father_relation, mother_relation, preferred, multiplicity)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    childLinks.forEach((link, position) => {
      if (personExists.get(link.childId) === undefined) {
        return;
      }
      const previous = children.get(link.childId);
      insertChild.run(
        previous?.id ?? link.id,
        family.id,
        link.childId,
        position,
        link.pedigree ?? null,
        link.pedigreePhrase ?? null,
        link.status ?? null,
        link.statusPhrase ?? null,
        link.fatherRelation ?? null,
        link.motherRelation ?? null,
        link.preferred === true ? 1 : 0,
        link.multiplicity ?? null,
      );
    });

    for (const stale of oldDateIds) {
      if (!newDateIds.has(stale)) {
        this.dates.delete(stale);
      }
    }
  }

  private hydrate(row: FamilyRow): FamilyRecord {
    const partners = this.listPartnerRows(row.id).sort((a, b) => a.position - b.position);
    const children = this.listChildRows(row.id).sort((a, b) => a.position - b.position);
    const dateIds = partners.map((link) => link.date_id).filter((id): id is string => id !== null);
    const statuses = this.listMarriageStatuses(row.id);
    const statusDates = statuses.map((status) => status.date_id).filter((id): id is string => id !== null);
    const datesById = this.dates.getMany([...dateIds, ...statusDates]);
    return {
      id: row.id,
      xref: row.xref ?? undefined,
      preferred: row.preferred === 1 ? true : undefined,
      sameSex: row.same_sex === 1 ? true : undefined,
      unionKind: row.union_kind ?? undefined,
      unionStatus: row.union_status ?? undefined,
      marriageBeginStatus: row.marriage_begin_status ?? undefined,
      marriageEndStatus: row.marriage_end_status ?? undefined,
      partners: partners.map((link) => link.person_id),
      children: children.filter((link) => link.status !== 'disproven').map((link) => link.child_id),
      partnerLinks: partners.map((link) => ({
        id: link.id,
        personId: link.person_id,
        preferred: link.preferred === 1 ? true : undefined,
        date: link.date_id !== null ? datesById.get(link.date_id) : undefined,
        phrase: link.phrase ?? undefined,
        name: link.name ?? undefined,
        civilStatus: link.civil_status ?? undefined,
        marriageNumber: link.marriage_number ?? undefined,
      })),
      childLinks: children.map((link) => ({
        id: link.id,
        childId: link.child_id,
        pedigree: link.pedigree ?? undefined,
        pedigreePhrase: link.pedigree_phrase ?? undefined,
        status: link.status ?? undefined,
        statusPhrase: link.status_phrase ?? undefined,
        fatherRelation: link.father_relation ?? undefined,
        motherRelation: link.mother_relation ?? undefined,
        preferred: link.preferred === 1 ? true : undefined,
        multiplicity: link.multiplicity ?? undefined,
      })),
      ...(statuses.length > 0
        ? {
            marriageStatuses: statuses.map((status) => ({
              id: status.id,
              status: status.status,
              date: status.date_id !== null ? datesById.get(status.date_id) : undefined,
              placeId: status.place_id ?? undefined,
            })),
          }
        : {}),
      ...(this.listWitnesses(row.id).length > 0 ? { witnesses: this.listWitnesses(row.id) } : {}),
    };
  }

  private listPartnerRows(familyId: string): PartnerRow[] {
    return this.db
      .prepare(
        `SELECT id, person_id, position, preferred, date_id, phrase, name, civil_status, marriage_number
         FROM family_partner WHERE family_id = ?`,
      )
      .all(familyId) as unknown as PartnerRow[];
  }

  private listChildRows(familyId: string): ChildRow[] {
    return this.db
      .prepare(
        `SELECT id, child_id, position, pedigree, pedigree_phrase, status, status_phrase,
           father_relation, mother_relation, preferred, multiplicity
         FROM family_child WHERE family_id = ?`,
      )
      .all(familyId) as unknown as ChildRow[];
  }

  private listMarriageStatuses(familyId: string): Array<{
    id: string;
    status: string;
    date_id: string | null;
    place_id: string | null;
  }> {
    return this.db
      .prepare('SELECT id, status, date_id, place_id FROM family_marriage_status WHERE family_id = ? ORDER BY position')
      .all(familyId) as unknown as Array<{
      id: string;
      status: string;
      date_id: string | null;
      place_id: string | null;
    }>;
  }

  private listWitnesses(familyId: string): string[] {
    return (
      this.db
        .prepare('SELECT value FROM family_witness WHERE family_id = ? ORDER BY position')
        .all(familyId) as unknown as { value: string }[]
    ).map((row) => row.value);
  }

  private replaceDetails(family: FamilyRecord): void {
    const oldDates = this.listMarriageStatuses(family.id)
      .map((status) => status.date_id)
      .filter((id): id is string => id !== null);
    this.db.prepare('DELETE FROM family_marriage_status WHERE family_id = ?').run(family.id);
    this.db.prepare('DELETE FROM family_witness WHERE family_id = ?').run(family.id);
    const insertStatus = this.db.prepare(
      `INSERT INTO family_marriage_status (id, family_id, status, date_id, place_id, position)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    const newDates = new Set<string>();
    (family.marriageStatuses ?? []).forEach((status, position) => {
      const dateId = status.date ? this.dates.upsert(status.date) : null;
      if (dateId !== null) {
        newDates.add(dateId);
      }
      insertStatus.run(status.id, family.id, status.status, dateId, status.placeId ?? null, position);
    });
    for (const dateId of oldDates) {
      if (!newDates.has(dateId)) {
        this.dates.delete(dateId);
      }
    }
    const insertWitness = this.db.prepare(
      'INSERT INTO family_witness (id, family_id, value, position) VALUES (?, ?, ?, ?)',
    );
    (family.witnesses ?? []).forEach((witness, position) => {
      insertWitness.run(crypto.randomUUID(), family.id, witness, position);
    });
  }
}

function familyParams(family: FamilyRecord): Array<string | number | null> {
  return [
    family.id,
    family.xref ?? null,
    family.preferred === true ? 1 : 0,
    family.sameSex === true ? 1 : 0,
    family.unionKind ?? null,
    family.unionStatus ?? null,
    family.marriageBeginStatus ?? null,
    family.marriageEndStatus ?? null,
  ];
}

function derivedPartnerLinks(family: FamilyRecord): FamilyPartnerLink[] {
  return family.partners.map((personId) => ({
    id: crypto.randomUUID(),
    personId,
  }));
}

function derivedChildLinks(family: FamilyRecord): FamilyChildLink[] {
  return family.children.map((childId) => ({ id: crypto.randomUUID(), childId }));
}
