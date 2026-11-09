import type { DatabaseSync } from 'node:sqlite';
import type { FamilyChildLink, FamilyPartnerLink, FamilyRecord } from '../model/types';
import type { DateRepo } from './dateRepo';
import type { TransactionScope } from './transaction';

interface FamilyRow {
  id: string;
  xref: string | null;
}

interface PartnerRow {
  id: string;
  person_id: string;
  position: number;
  preferred: number;
  date_id: string | null;
}

interface ChildRow {
  id: string;
  child_id: string;
  position: number;
  pedigree: string | null;
  pedigree_phrase: string | null;
  status: string | null;
  father_relation: string | null;
  mother_relation: string | null;
}

/**
 * Families and their partner/child link rows. Links are addressable rows
 * with their own ids; the flat `partners`/`children` arrays on the model are
 * projections of them. Updates sync links by person id: a surviving link
 * keeps its id and the fields the caller did not touch, so link ids are
 * stable across edits.
 */
export class FamilyRepo {
  constructor(
    private readonly db: DatabaseSync,
    private readonly transactions: TransactionScope,
    private readonly dates: DateRepo,
  ) {}

  insertFamily(family: FamilyRecord): void {
    this.transactions.run(() => {
      this.db.prepare('INSERT INTO family (id, xref) VALUES (?, ?)').run(family.id, family.xref ?? null);
      this.replaceLinks(family, new Map());
    });
  }

  updateFamily(family: FamilyRecord): void {
    this.transactions.run(() => {
      this.db.prepare('UPDATE family SET xref = ? WHERE id = ?').run(family.xref ?? null, family.id);
      const existingPartners = this.listPartnerRows(family.id);
      const existingChildren = this.listChildRows(family.id);
      this.replaceLinks(
        family,
        new Map(existingPartners.map((row) => [row.person_id, row])),
        new Map(existingChildren.map((row) => [row.child_id, row])),
      );
    });
  }

  getFamily(id: string): FamilyRecord | undefined {
    const row = this.db.prepare('SELECT id, xref FROM family WHERE id = ?').get(id) as FamilyRow | undefined;
    return row ? this.hydrate(row) : undefined;
  }

  deleteFamily(id: string): boolean {
    return this.transactions.run(() => {
      for (const row of this.listPartnerRows(id)) {
        if (row.date_id !== null) {
          this.dates.delete(row.date_id);
        }
      }
      return this.db.prepare('DELETE FROM family WHERE id = ?').run(id).changes > 0;
    });
  }

  listFamilies(): FamilyRecord[] {
    const rows = this.db.prepare('SELECT id, xref FROM family ORDER BY id').all() as unknown as FamilyRow[];
    return rows.map((row) => this.hydrate(row));
  }

  /** Every family the person belongs to, as a partner or a child. */
  listFamiliesForPerson(personId: string): FamilyRecord[] {
    const rows = this.db
      .prepare(
        `SELECT id, xref FROM family f
         WHERE EXISTS (SELECT 1 FROM family_partner p WHERE p.family_id = f.id AND p.person_id = ?)
            OR EXISTS (SELECT 1 FROM family_child c WHERE c.family_id = f.id AND c.child_id = ?)
         ORDER BY f.id`,
      )
      .all(personId, personId) as unknown as FamilyRow[];
    return rows.map((row) => this.hydrate(row));
  }

  /**
   * Removes the person from every family link row (cleaning up the link
   * dates), before the person itself is deleted.
   */
  removePersonFromFamilies(personId: string): void {
    for (const family of this.listFamiliesForPerson(personId)) {
      this.updateFamily({
        ...family,
        partners: family.partners.filter((id) => id !== personId),
        children: family.children.filter((id) => id !== personId),
        partnerLinks: family.partnerLinks?.filter((link) => link.personId !== personId),
        childLinks: family.childLinks?.filter((link) => link.childId !== personId),
      });
    }
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
      'INSERT INTO family_partner (id, family_id, person_id, position, preferred, date_id) VALUES (?, ?, ?, ?, ?, ?)',
    );
    const personExists = this.db.prepare('SELECT 1 FROM person WHERE id = ?');
    partnerLinks.forEach((link, position) => {
      if (personExists.get(link.personId) === undefined) {
        return;
      }
      const previous = existingPartners.get(link.personId);
      const linkId = previous?.id ?? link.id;
      const dateId = link.date ? this.dates.upsert(link.date) : (previous?.date_id ?? null);
      if (dateId !== null) {
        newDateIds.add(dateId);
      }
      const preferred = link.preferred ?? (previous ? previous.preferred === 1 : false);
      insertPartner.run(linkId, family.id, link.personId, position, preferred ? 1 : 0, dateId);
    });

    this.db.prepare('DELETE FROM family_child WHERE family_id = ?').run(family.id);
    const insertChild = this.db.prepare(
      `INSERT INTO family_child (id, family_id, child_id, position, pedigree, pedigree_phrase, status, father_relation, mother_relation)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        link.pedigree ?? previous?.pedigree ?? null,
        link.pedigreePhrase ?? previous?.pedigree_phrase ?? null,
        link.status ?? previous?.status ?? null,
        link.fatherRelation ?? previous?.father_relation ?? null,
        link.motherRelation ?? previous?.mother_relation ?? null,
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
    const datesById = this.dates.getMany(dateIds);
    return {
      id: row.id,
      xref: row.xref ?? undefined,
      partners: partners.map((link) => link.person_id),
      children: children.map((link) => link.child_id),
      partnerLinks: partners.map((link) => ({
        id: link.id,
        personId: link.person_id,
        preferred: link.preferred === 1 ? true : undefined,
        date: link.date_id !== null ? datesById.get(link.date_id) : undefined,
      })),
      childLinks: children.map((link) => ({
        id: link.id,
        childId: link.child_id,
        pedigree: link.pedigree ?? undefined,
        pedigreePhrase: link.pedigree_phrase ?? undefined,
        status: link.status ?? undefined,
        fatherRelation: link.father_relation ?? undefined,
        motherRelation: link.mother_relation ?? undefined,
      })),
    };
  }

  private listPartnerRows(familyId: string): PartnerRow[] {
    return this.db
      .prepare('SELECT id, person_id, position, preferred, date_id FROM family_partner WHERE family_id = ?')
      .all(familyId) as unknown as PartnerRow[];
  }

  private listChildRows(familyId: string): ChildRow[] {
    return this.db
      .prepare(
        `SELECT id, child_id, position, pedigree, pedigree_phrase, status, father_relation, mother_relation
         FROM family_child WHERE family_id = ?`,
      )
      .all(familyId) as unknown as ChildRow[];
  }
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
