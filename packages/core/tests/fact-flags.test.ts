import { describe, expect, it } from 'vitest';
import { parse, serializeGedcom551, serializeGedcom70, type GedcomDataset } from '@doru/gedcom';
import { buildGedcomDataset } from '../src/export/gedcom';
import { importGedcomDataset } from '../src/import/gedcom';
import { cleanupRepo, makeRepo } from './helpers';

function parseDataset(text: string): GedcomDataset {
  const result = parse(new TextEncoder().encode(text));
  if (!result.ok || result.value.kind !== 'dataset') {
    throw new Error('fixture failed to parse');
  }
  return result.value.dataset;
}

const GEDCOM = [
  '0 HEAD',
  '1 GEDC',
  '2 VERS 7.0',
  '0 @I1@ INDI',
  '1 NAME Ivan /Petrov/',
  '1 BIRT',
  '2 _PRI',
  '2 _FLGS',
  '3 __PRIVATE Private',
  '3 __PREFERRED Preferred',
  '1 DEAT',
  '2 _PRI',
  '1 RESI',
  '2 _FLGS',
  '3 __PREFERRED Preferred',
  '1 OCCU Teacher',
  '2 _PRI N',
  '0 TRLR',
].join('\n');

describe('fact flags and the AGES! primary marker', () => {
  it('imports _FLGS as lowercase flags and keeps _PRI separate', () => {
    const fixture = makeRepo();
    try {
      importGedcomDataset(parseDataset(GEDCOM), fixture.repo);
      const facts = fixture.repo.listAllPersons()[0]!.facts;
      const birth = facts.find((fact) => fact.tag === 'BIRT')!;
      expect(new Set(birth.flags)).toEqual(new Set(['private', 'preferred']));
      expect(birth.primary).toBe(true);

      const death = facts.find((fact) => fact.tag === 'DEAT')!;
      expect(death.flags).toBeUndefined();
      expect(death.primary).toBe(true);

      const residence = facts.find((fact) => fact.tag === 'RESI')!;
      expect(residence.flags).toEqual(['preferred']);
      expect(residence.primary).toBeUndefined();

      const occupation = facts.find((fact) => fact.tag === 'OCCU')!;
      expect(occupation.flags).toBeUndefined();
      expect(occupation.primary).toBeUndefined();
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('persists flags and primary through fact insert, update and delete', () => {
    const fixture = makeRepo();
    try {
      fixture.repo.insertPerson({
        id: 'P1',
        names: [{ id: 'N1', given: 'Ivan' }],
        sex: 'M',
        facts: [{ id: 'F1', personId: 'P1', tag: 'BIRT', flags: ['private'], primary: true }],
      });

      const inserted = fixture.repo.listFactsForPerson('P1')[0]!;
      expect(inserted.flags).toEqual(['private']);
      expect(inserted.primary).toBe(true);

      fixture.repo.updateFact({ ...inserted, flags: ['tentative'], primary: false });
      const updated = fixture.repo.listFactsForPerson('P1')[0]!;
      expect(updated.flags).toEqual(['tentative']);
      expect(updated.primary).toBeUndefined();

      fixture.repo.deleteFact(updated.id);
      expect(fixture.repo.listFactsForPerson('P1')).toEqual([]);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('round-trips flags and primary through GEDCOM 7.0 and 5.5.1', () => {
    const fixture = makeRepo();
    try {
      fixture.repo.insertPerson({
        id: 'P1',
        names: [{ id: 'N1', given: 'Ivan', surname: 'Petrov' }],
        sex: 'M',
        facts: [
          {
            id: 'F1',
            personId: 'P1',
            tag: 'BIRT',
            flags: ['private', 'preferred'],
            primary: true,
          },
        ],
      });

      for (const serialize of [serializeGedcom70, serializeGedcom551]) {
        const dataset = buildGedcomDataset(fixture.repo);
        const serialized = serialize(dataset);
        expect(serialized.ok).toBe(true);
        if (!serialized.ok) {
          continue;
        }
        expect(serialized.value).toContain('_PRI');
        expect(serialized.value).toContain('_FLGS');
        expect(serialized.value).toContain('__PRIVATE Private');
        expect(serialized.value).toContain('__PREFERRED Preferred');

        const target = makeRepo();
        try {
          importGedcomDataset(parseDataset(serialized.value), target.repo);
          const fact = target.repo.listAllPersons()[0]!.facts[0]!;
          expect(new Set(fact.flags)).toEqual(new Set(['private', 'preferred']));
          expect(fact.primary).toBe(true);
        } finally {
          cleanupRepo(target);
        }
      }
    } finally {
      cleanupRepo(fixture);
    }
  });
});
