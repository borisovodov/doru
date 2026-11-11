import type { AssociationRecord } from '@doru/core';
import { emptyDate, fromDateDraft, toDateDraft, type DateDraft } from './draft';

/**
 * The editable form of an association (a non-family relation between two
 * persons, GEDCOM ASSO). The period bounds edit through the shared date
 * draft; everything else is a plain field.
 */
export interface AssociationDraft {
  id: string;
  personId: string;
  otherPersonId: string; // '' = nobody picked yet
  role: string;
  relationship: string;
  phrase: string;
  primary: boolean;
  specificType: string;
  confidence: string;
  periodStart: DateDraft;
  periodEnd: DateDraft;
}

export function emptyAssociationDraft(personId: string): AssociationDraft {
  return {
    id: crypto.randomUUID(),
    personId,
    otherPersonId: '',
    role: '',
    relationship: '',
    phrase: '',
    primary: false,
    specificType: '',
    confidence: '',
    periodStart: emptyDate(),
    periodEnd: emptyDate(),
  };
}

export function associationToDraft(association: AssociationRecord): AssociationDraft {
  return {
    id: association.id,
    personId: association.personId,
    otherPersonId: association.otherPersonId,
    role: association.role ?? '',
    relationship: association.relationship ?? '',
    phrase: association.phrase ?? '',
    primary: association.primary === true,
    specificType: association.specificType ?? '',
    confidence: association.confidence ?? '',
    periodStart: toDateDraft(association.periodStart),
    periodEnd: toDateDraft(association.periodEnd),
  };
}

export function associationDraftToRecord(draft: AssociationDraft): AssociationRecord {
  return {
    id: draft.id,
    personId: draft.personId,
    otherPersonId: draft.otherPersonId,
    role: draft.role.trim() || undefined,
    relationship: draft.relationship.trim() || undefined,
    phrase: draft.phrase.trim() || undefined,
    primary: draft.primary || undefined,
    specificType: draft.specificType.trim() || undefined,
    confidence: draft.confidence.trim() || undefined,
    periodStart: fromDateDraft(draft.periodStart),
    periodEnd: fromDateDraft(draft.periodEnd),
  };
}

/** True when the draft has no other person picked (nothing to store). */
export function associationDraftEmpty(draft: AssociationDraft): boolean {
  return draft.otherPersonId === '';
}
