import { describe, expect, it } from 'vitest';
import type { FamilyRecord } from '@doru/core';
import { emptyDate } from '../src/person/draft';
import {
  emptyFamilyDraft,
  familyDraftMatches,
  familyDraftToRecord,
  familyToDraft,
} from '../src/family/familyDraft';

const family = (overrides: Partial<FamilyRecord> = {}): FamilyRecord => ({
  id: 'F1',
  partners: ['P1', 'P2'],
  children: ['P3'],
  ...overrides,
});

describe('emptyFamilyDraft', () => {
  it('builds an empty draft with a fresh id', () => {
    const draft = emptyFamilyDraft();
    expect(draft.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(draft).toMatchObject({ partnerLinks: [], childLinks: [] });
  });
});

describe('familyToDraft / familyDraftToRecord', () => {
  it('round-trips every link field', () => {
    const stored: FamilyRecord = {
      id: 'F1',
      xref: '@F1@',
      partners: ['P1', 'P2'],
      children: ['P3', 'P4'],
      partnerLinks: [
        { id: 'PL1', personId: 'P1', preferred: true, date: { quality: 'exact', component: { year: 1948 } } },
        { id: 'PL2', personId: 'P2' },
      ],
      childLinks: [
        {
          id: 'CL1',
          childId: 'P3',
          pedigree: 'birth',
          status: 'proven',
          fatherRelation: 'guardian',
          motherRelation: 'birth',
        },
        { id: 'CL2', childId: 'P4', pedigreePhrase: 'adopted later' },
      ],
    };
    const draft = familyToDraft(stored);
    expect(draft.partnerLinks[0]).toMatchObject({
      id: 'PL1',
      personId: 'P1',
      preferred: true,
      date: { ...emptyDate(), year: '1948' },
    });
    expect(draft.childLinks[1]).toMatchObject({ id: 'CL2', childId: 'P4', pedigreePhrase: 'adopted later' });
    expect(familyDraftToRecord(draft)).toEqual(stored);
  });

  it('derives link drafts from the bare partner/child lists', () => {
    const draft = familyToDraft(family());
    expect(draft.partnerLinks.map((link) => link.personId)).toEqual(['P1', 'P2']);
    expect(draft.childLinks.map((link) => link.childId)).toEqual(['P3']);
    const record = familyDraftToRecord(draft);
    expect(record.partners).toEqual(['P1', 'P2']);
    expect(record.children).toEqual(['P3']);
  });

  it('drops slots without a person and empty link fields', () => {
    const draft = familyToDraft(family());
    draft.partnerLinks.push({ id: 'PLX', personId: '', preferred: false, date: emptyDate() });
    draft.childLinks[0]!.pedigree = '   ';
    const record = familyDraftToRecord(draft);
    expect(record.partnerLinks).toHaveLength(2);
    expect(record.childLinks![0]!.pedigree).toBeUndefined();
  });
});

describe('familyDraftMatches', () => {
  it('matches a draft built from the family', () => {
    const stored = family({
      partnerLinks: [{ id: 'PL1', personId: 'P1', preferred: true }],
    });
    expect(familyDraftMatches(familyToDraft(stored), stored)).toBe(true);
  });

  it('detects link and membership changes', () => {
    const stored = family();
    const base = familyToDraft(stored);
    expect(familyDraftMatches({ ...base, childLinks: [] }, stored)).toBe(false);
    expect(
      familyDraftMatches(
        { ...base, partnerLinks: [{ id: 'PL1', personId: 'P1', preferred: true, date: emptyDate() }] },
        stored,
      ),
    ).toBe(false);
  });
});
