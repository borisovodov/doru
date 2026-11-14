import type { FamilyChildLink, FamilyPartnerLink, FamilyRecord } from '@doru/core';
import { emptyDate, fromDateDraft, toDateDraft, type DateDraft } from '../person/draft';

/** The pedigree kinds of a child link (GEDCOM PEDI). */
export const PEDIGREE_TYPES = ['birth', 'adopted', 'foster', 'sealing', 'other'] as const;

/** The status values of a child link (GEDCOM STAT). */
export const CHILD_STATUS_TYPES = ['challenged', 'disproven', 'proven'] as const;

/** An editable partner slot of a family. */
export interface PartnerLinkDraft {
  id: string;
  personId: string;
  preferred: boolean;
  date: DateDraft;
}

/** An editable child slot of a family. */
export interface ChildLinkDraft {
  id: string;
  childId: string;
  pedigree: string; // '' = unspecified
  pedigreePhrase: string;
  status: string; // '' = unspecified
  fatherRelation: string;
  motherRelation: string;
}

/**
 * The editable form of a family: its partner and child slots with the
 * link details. `xref` is provenance passed through.
 */
export interface FamilyDraft {
  id: string;
  xref?: string | undefined;
  partnerLinks: PartnerLinkDraft[];
  childLinks: ChildLinkDraft[];
}

export function emptyPartnerLinkDraft(personId = ''): PartnerLinkDraft {
  return { id: crypto.randomUUID(), personId, preferred: false, date: emptyDate() };
}

export function emptyChildLinkDraft(childId = ''): ChildLinkDraft {
  return {
    id: crypto.randomUUID(),
    childId,
    pedigree: '',
    pedigreePhrase: '',
    status: '',
    fatherRelation: '',
    motherRelation: '',
  };
}

export function emptyFamilyDraft(): FamilyDraft {
  return { id: crypto.randomUUID(), partnerLinks: [], childLinks: [] };
}

export function familyToDraft(family: FamilyRecord): FamilyDraft {
  // Derived slots (families stored without link rows) get deterministic
  // ids so draft comparisons against such families stay stable.
  const partnerLinks =
    family.partnerLinks ??
    family.partners.map((personId) => ({
      ...emptyPartnerLinkDraft(personId),
      id: `${family.id}#partner#${personId}`,
      date: undefined,
    }));
  const childLinks =
    family.childLinks ??
    family.children.map((childId) => ({ ...emptyChildLinkDraft(childId), id: `${family.id}#child#${childId}` }));
  return {
    id: family.id,
    xref: family.xref,
    partnerLinks: partnerLinks.map((link) => ({
      id: link.id,
      personId: link.personId,
      preferred: link.preferred === true,
      date: toDateDraft(link.date),
    })),
    childLinks: childLinks.map((link) => ({
      id: link.id,
      childId: link.childId,
      pedigree: link.pedigree ?? '',
      pedigreePhrase: link.pedigreePhrase ?? '',
      status: link.status ?? '',
      fatherRelation: link.fatherRelation ?? '',
      motherRelation: link.motherRelation ?? '',
    })),
  };
}

/** Builds the family record for a save; empty slots (no person) are dropped. */
export function familyDraftToRecord(draft: FamilyDraft): FamilyRecord {
  const partnerLinks: FamilyPartnerLink[] = draft.partnerLinks
    .filter((link) => link.personId !== '')
    .map((link) => {
      const date = fromDateDraft(link.date);
      return {
        id: link.id,
        personId: link.personId,
        preferred: link.preferred || undefined,
        ...(date !== undefined ? { date } : {}),
      };
    });
  const childLinks: FamilyChildLink[] = draft.childLinks
    .filter((link) => link.childId !== '')
    .map((link) => ({
      id: link.id,
      childId: link.childId,
      pedigree: link.pedigree.trim() || undefined,
      pedigreePhrase: link.pedigreePhrase.trim() || undefined,
      status: link.status.trim() || undefined,
      fatherRelation: link.fatherRelation.trim() || undefined,
      motherRelation: link.motherRelation.trim() || undefined,
    }));
  return {
    id: draft.id,
    xref: draft.xref,
    partners: partnerLinks.map((link) => link.personId),
    children: childLinks.map((link) => link.childId),
    partnerLinks,
    childLinks,
  };
}

/** True when the draft still equals the stored family (no external rewrite). */
export function familyDraftMatches(draft: FamilyDraft, family: FamilyRecord): boolean {
  const other = familyToDraft(family);
  return (
    draft.id === other.id &&
    draft.xref === other.xref &&
    draft.partnerLinks.length === other.partnerLinks.length &&
    draft.partnerLinks.every((link, index) => {
      const entry = other.partnerLinks[index];
      return (
        entry !== undefined &&
        link.id === entry.id &&
        link.personId === entry.personId &&
        link.preferred === entry.preferred &&
        dateDraftsMatch(link.date, entry.date)
      );
    }) &&
    draft.childLinks.length === other.childLinks.length &&
    draft.childLinks.every((link, index) => {
      const entry = other.childLinks[index];
      return (
        entry !== undefined &&
        link.id === entry.id &&
        link.childId === entry.childId &&
        link.pedigree === entry.pedigree &&
        link.pedigreePhrase === entry.pedigreePhrase &&
        link.status === entry.status &&
        link.fatherRelation === entry.fatherRelation &&
        link.motherRelation === entry.motherRelation
      );
    })
  );
}

function dateDraftsMatch(a: DateDraft, b: DateDraft): boolean {
  return (
    a.year === b.year &&
    a.month === b.month &&
    a.day === b.day &&
    a.endYear === b.endYear &&
    a.endMonth === b.endMonth &&
    a.endDay === b.endDay &&
    a.text === b.text &&
    a.quality === b.quality &&
    a.place === b.place &&
    a.modifier === b.modifier &&
    a.calendar === b.calendar &&
    a.epoch === b.epoch &&
    a.endCalendar === b.endCalendar &&
    a.endEpoch === b.endEpoch &&
    a.timeHour === b.timeHour &&
    a.timeMinute === b.timeMinute &&
    a.timeSecond === b.timeSecond &&
    a.timeFraction === b.timeFraction &&
    a.timeUtc === b.timeUtc
  );
}
