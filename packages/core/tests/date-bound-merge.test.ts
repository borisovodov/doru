import { describe, expect, it } from 'vitest';
import { parse, serializeGedcom70 } from '@doru/gedcom';
import { mergeDateBounds, splitDateBounds, type DateValue } from '../src/model/types';
import { buildGedcomDataset } from '../src/export/gedcom';
import { importGedcomDataset } from '../src/import/gedcom';
import { cleanupRepo, makeRepo } from './helpers';

const exact = (year: number): DateValue => ({ quality: 'exact', component: { year } });

describe('mergeDateBounds / splitDateBounds', () => {
  it('folds two bounds into one range', () => {
    expect(mergeDateBounds(exact(1900), exact(1910))).toEqual({
      quality: 'range',
      component: { year: 1900 },
      end: { year: 1910 },
    });
  });

  it('keeps an open-ended bound', () => {
    expect(mergeDateBounds(undefined, exact(1910))).toEqual({
      quality: 'range',
      end: { year: 1910 },
    });
    expect(mergeDateBounds(exact(1900), undefined)).toEqual(exact(1900));
  });

  it('keeps the primary qualifier when the second bound has no component', () => {
    const before = { quality: 'before' as const, component: { year: 1900 } };
    expect(mergeDateBounds(before, { quality: 'unknown', text: 'before the war' })).toEqual(before);
  });

  it('splits a range back into two exact bounds', () => {
    expect(
      splitDateBounds({
        quality: 'range',
        component: { year: 1900, month: 5 },
        end: { year: 1910, month: 6, day: 7 },
      }),
    ).toEqual({
      start: { quality: 'exact', component: { year: 1900, month: 5 } },
      end: { quality: 'exact', component: { year: 1910, month: 6, day: 7 } },
    });
  });

  it('keeps a non-range value as the start bound', () => {
    expect(splitDateBounds({ quality: 'about', component: { year: 1900 } })).toEqual({
      start: { quality: 'about', component: { year: 1900 } },
    });
  });

  it('keeps the phrase on an open-ended range end', () => {
    expect(
      splitDateBounds({
        quality: 'range',
        end: { year: 1900 },
        text: 'to 1900',
        time: { hour: 12, minute: 30 },
      }),
    ).toEqual({
      end: {
        quality: 'exact',
        component: { year: 1900 },
        text: 'to 1900',
        time: { hour: 12, minute: 30 },
      },
    });
  });
});

const GEDCOM = [
  '0 HEAD',
  '1 GEDC',
  '2 VERS 7.0',
  '1 SOUR TEST',
  '0 @I1@ INDI',
  '1 NAME Ivan /Petrov/',
  '1 BIRT',
  '2 DATE 1900',
  '2 _DATE2 1910',
  '1 ASSO @I2@',
  '2 ROLE GODP',
  '2 _PERIOD',
  '3 _START 1920',
  '3 _END 1930',
  '0 @I2@ INDI',
  '1 NAME Maria /Sidorova/',
  '0 TRLR',
].join('\n');

describe('GEDCOM date-slot folding', () => {
  it('imports _DATE2 and _PERIOD as ranges and exports single dates', () => {
    const fixture = makeRepo();
    try {
      const parsed = parse(new TextEncoder().encode(GEDCOM));
      expect(parsed.ok).toBe(true);
      if (!parsed.ok || parsed.value.kind !== 'dataset') {
        return;
      }
      importGedcomDataset(parsed.value.dataset, fixture.repo);
      const person = fixture.repo.listAllPersons().find((entry) => entry.names.some((name) => name.given === 'Ivan'));
      expect(person?.facts[0]?.date).toMatchObject({
        quality: 'range',
        component: { year: 1900 },
        end: { year: 1910 },
      });
      expect(fixture.repo.listAssociations().find((entry) => entry.personId === person?.id)?.period).toMatchObject({
        quality: 'range',
        component: { year: 1920 },
        end: { year: 1930 },
      });

      const serialized = serializeGedcom70(buildGedcomDataset(fixture.repo));
      expect(serialized.ok).toBe(true);
      if (!serialized.ok) {
        return;
      }
      expect(serialized.value).not.toContain('_DATE2');
      expect(serialized.value).toMatch(/2 DATE (BET 1900 AND 1910|FROM 1900 TO 1910)/);
      expect(serialized.value).toContain('3 _START 1920');
      expect(serialized.value).toContain('3 _END 1930');
    } finally {
      cleanupRepo(fixture);
    }
  });
});
