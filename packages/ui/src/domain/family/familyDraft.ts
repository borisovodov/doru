import type { FamilyChildLink, FamilyPartnerLink, FamilyRecord } from '@doru/core';
import { dateDraftsEqual, emptyDate, fromDateDraft, toDateDraft, type DateDraft } from '../person/draft';

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
  phrase: string;
  name: string;
  civilStatus: string;
  marriageNumber: string;
}

/** An editable child slot of a family. */
export interface ChildLinkDraft {
  id: string;
  childId: string;
  pedigree: string; // '' = unspecified
  pedigreePhrase: string;
  status: string; // '' = unspecified
  statusPhrase: string;
  fatherRelation: string;
  motherRelation: string;
  preferred: boolean;
  multiplicity: string;
}

/** An editable dated marriage-status entry of a family. */
export interface MarriageStatusDraft {
  id: string;
  status: string;
  date: DateDraft;
  placeId: string;
}

/**
 * The editable form of a family: its partner and child slots with the
 * link details. `xref` is provenance passed through.
 */
export interface FamilyDraft {
  id: string;
  xref?: string | undefined;
  preferred: boolean;
  sameSex: boolean;
  unionKind: string;
  unionStatus: string;
  marriageBeginStatus: string;
  marriageEndStatus: string;
  witnesses: string[];
  marriageStatuses: MarriageStatusDraft[];
  partnerLinks: PartnerLinkDraft[];
  childLinks: ChildLinkDraft[];
}

export function emptyPartnerLinkDraft(personId = ''): PartnerLinkDraft {
  return {
    id: crypto.randomUUID(),
    personId,
    preferred: false,
    date: emptyDate(),
    phrase: '',
    name: '',
    civilStatus: '',
    marriageNumber: '',
  };
}

export function emptyChildLinkDraft(childId = ''): ChildLinkDraft {
  return {
    id: crypto.randomUUID(),
    childId,
    pedigree: '',
    pedigreePhrase: '',
    status: '',
    statusPhrase: '',
    fatherRelation: '',
    motherRelation: '',
    preferred: false,
    multiplicity: '',
  };
}

export function emptyMarriageStatusDraft(): MarriageStatusDraft {
  return { id: crypto.randomUUID(), status: '', date: emptyDate(), placeId: '' };
}

export function emptyFamilyDraft(): FamilyDraft {
  return {
    id: crypto.randomUUID(),
    preferred: false,
    sameSex: false,
    unionKind: '',
    unionStatus: '',
    marriageBeginStatus: '',
    marriageEndStatus: '',
    witnesses: [],
    marriageStatuses: [],
    partnerLinks: [],
    childLinks: [],
  };
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
    preferred: family.preferred === true,
    sameSex: family.sameSex === true,
    unionKind: family.unionKind ?? '',
    unionStatus: family.unionStatus ?? '',
    marriageBeginStatus: family.marriageBeginStatus ?? '',
    marriageEndStatus: family.marriageEndStatus ?? '',
    witnesses: [...(family.witnesses ?? [])],
    marriageStatuses: (family.marriageStatuses ?? []).map((status) => ({
      id: status.id,
      status: status.status,
      date: toDateDraft(status.date),
      placeId: status.placeId ?? '',
    })),
    partnerLinks: partnerLinks.map((link) => ({
      id: link.id,
      personId: link.personId,
      preferred: link.preferred === true,
      date: toDateDraft(link.date),
      phrase: link.phrase ?? '',
      name: link.name ?? '',
      civilStatus: link.civilStatus ?? '',
      marriageNumber: link.marriageNumber ?? '',
    })),
    childLinks: childLinks.map((link) => ({
      id: link.id,
      childId: link.childId,
      pedigree: link.pedigree ?? '',
      pedigreePhrase: link.pedigreePhrase ?? '',
      status: link.status ?? '',
      statusPhrase: link.statusPhrase ?? '',
      fatherRelation: link.fatherRelation ?? '',
      motherRelation: link.motherRelation ?? '',
      preferred: link.preferred === true,
      multiplicity: link.multiplicity ?? '',
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
        ...(link.preferred ? { preferred: true } : {}),
        ...(date !== undefined ? { date } : {}),
        ...(link.phrase.trim() !== '' ? { phrase: link.phrase.trim() } : {}),
        ...(link.name.trim() !== '' ? { name: link.name.trim() } : {}),
        ...(link.civilStatus.trim() !== '' ? { civilStatus: link.civilStatus.trim() } : {}),
        ...(link.marriageNumber.trim() !== '' ? { marriageNumber: link.marriageNumber.trim() } : {}),
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
      statusPhrase: link.statusPhrase.trim() || undefined,
      fatherRelation: link.fatherRelation.trim() || undefined,
      motherRelation: link.motherRelation.trim() || undefined,
      ...(link.preferred ? { preferred: true } : {}),
      ...(link.multiplicity.trim() !== '' ? { multiplicity: link.multiplicity.trim() } : {}),
    }));
  const witnesses = draft.witnesses.map((witness) => witness.trim()).filter((witness) => witness !== '');
  const marriageStatuses = draft.marriageStatuses
    .filter((status) => status.status.trim() !== '')
    .map((status) => {
      const date = fromDateDraft(status.date);
      return {
        id: status.id,
        status: status.status.trim(),
        ...(date !== undefined ? { date } : {}),
        ...(status.placeId !== '' ? { placeId: status.placeId } : {}),
      };
    });
  return {
    id: draft.id,
    xref: draft.xref,
    ...(draft.preferred ? { preferred: true } : {}),
    ...(draft.sameSex ? { sameSex: true } : {}),
    ...(draft.unionKind.trim() !== '' ? { unionKind: draft.unionKind.trim() } : {}),
    ...(draft.unionStatus.trim() !== '' ? { unionStatus: draft.unionStatus.trim() } : {}),
    ...(draft.marriageBeginStatus.trim() !== '' ? { marriageBeginStatus: draft.marriageBeginStatus.trim() } : {}),
    ...(draft.marriageEndStatus.trim() !== '' ? { marriageEndStatus: draft.marriageEndStatus.trim() } : {}),
    ...(witnesses.length > 0 ? { witnesses } : {}),
    ...(marriageStatuses.length > 0 ? { marriageStatuses } : {}),
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
    draft.preferred === other.preferred &&
    draft.sameSex === other.sameSex &&
    draft.unionKind === other.unionKind &&
    draft.unionStatus === other.unionStatus &&
    draft.marriageBeginStatus === other.marriageBeginStatus &&
    draft.marriageEndStatus === other.marriageEndStatus &&
    draft.witnesses.length === other.witnesses.length &&
    draft.witnesses.every((witness, index) => witness === other.witnesses[index]) &&
    draft.marriageStatuses.length === other.marriageStatuses.length &&
    draft.marriageStatuses.every((status, index) => {
      const entry = other.marriageStatuses[index];
      return (
        entry !== undefined &&
        status.id === entry.id &&
        status.status === entry.status &&
        status.placeId === entry.placeId &&
        dateDraftsEqual(status.date, entry.date)
      );
    }) &&
    draft.partnerLinks.length === other.partnerLinks.length &&
    draft.partnerLinks.every((link, index) => {
      const entry = other.partnerLinks[index];
      return (
        entry !== undefined &&
        link.id === entry.id &&
        link.personId === entry.personId &&
        link.preferred === entry.preferred &&
        link.phrase === entry.phrase &&
        link.name === entry.name &&
        link.civilStatus === entry.civilStatus &&
        link.marriageNumber === entry.marriageNumber &&
        dateDraftsEqual(link.date, entry.date)
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
        link.statusPhrase === entry.statusPhrase &&
        link.fatherRelation === entry.fatherRelation &&
        link.motherRelation === entry.motherRelation &&
        link.preferred === entry.preferred &&
        link.multiplicity === entry.multiplicity
      );
    })
  );
}
