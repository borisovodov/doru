import { describe, expect, it } from 'vitest';
import type { AssociationRecord } from '@doru/core';
import { emptyDate } from '../src/domain/person/draft';
import {
  associationDraftEmpty,
  associationDraftToRecord,
  associationToDraft,
  emptyAssociationDraft,
} from '../src/domain/person/associationDraft';

describe('emptyAssociationDraft', () => {
  it('builds an empty draft bound to the person', () => {
    const draft = emptyAssociationDraft('P1');
    expect(draft.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(draft).toMatchObject({
      personId: 'P1',
      otherPersonId: '',
      role: '',
      relationship: '',
      phrase: '',
      primary: false,
      specificType: '',
      confidence: '',
      periodStart: emptyDate(),
      periodEnd: emptyDate(),
    });
  });
});

describe('associationToDraft / associationDraftToRecord', () => {
  const source: AssociationRecord = {
    id: 'A1',
    personId: 'P1',
    otherPersonId: 'P2',
    role: 'godparent',
    relationship: 'friend',
    phrase: 'met in the war',
    primary: true,
    specificType: 'WWII',
    confidence: 'high',
    periodStart: { quality: 'exact', component: { year: 1942 } },
    periodEnd: { quality: 'about', component: { year: 1946 } },
  };

  it('round-trips every field', () => {
    const draft = associationToDraft(source);
    expect(draft).toMatchObject({
      id: 'A1',
      personId: 'P1',
      otherPersonId: 'P2',
      role: 'godparent',
      relationship: 'friend',
      phrase: 'met in the war',
      primary: true,
      specificType: 'WWII',
      confidence: 'high',
      periodStart: { ...emptyDate(), year: '1942' },
      periodEnd: { ...emptyDate(), year: '1946', quality: 'about' },
    });
    expect(associationDraftToRecord(draft)).toEqual(source);
  });

  it('drops empty optional fields', () => {
    const draft = emptyAssociationDraft('P1');
    const record = associationDraftToRecord({ ...draft, otherPersonId: 'P2' });
    expect(record).toEqual({
      id: draft.id,
      personId: 'P1',
      otherPersonId: 'P2',
      role: undefined,
      relationship: undefined,
      phrase: undefined,
      primary: undefined,
      specificType: undefined,
      confidence: undefined,
      periodStart: undefined,
      periodEnd: undefined,
    });
  });
});

describe('associationDraftEmpty', () => {
  it('is empty until another person is picked', () => {
    expect(associationDraftEmpty(emptyAssociationDraft('P1'))).toBe(true);
    expect(associationDraftEmpty({ ...emptyAssociationDraft('P1'), otherPersonId: 'P2' })).toBe(false);
  });
});
