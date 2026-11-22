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

  it('keeps the primary qualifier and retains the secondary text', () => {
    const before = { quality: 'before' as const, component: { year: 1900 } };
    expect(mergeDateBounds(before, { quality: 'unknown', text: 'before the war' })).toEqual({
      ...before,
      text: 'before the war',
    });
  });

  it('does not move an end-bound phrase to the start on split', () => {
    const merged = mergeDateBounds(exact(1900), {
      quality: 'exact',
      component: { year: 1910 },
      text: 'end recorded in the register',
    });
    expect(merged?.text).toBeUndefined();
    expect(splitDateBounds(merged)).toEqual({
      start: { quality: 'exact', component: { year: 1900 } },
      end: { quality: 'exact', component: { year: 1910 } },
    });
  });

  it('keeps a start-only range open-ended on split', () => {
    expect(
      splitDateBounds({
        quality: 'range',
        component: { year: 1900 },
        text: 'from the register',
      }),
    ).toEqual({
      start: { quality: 'range', component: { year: 1900 }, text: 'from the register' },
    });
  });

  it('keeps the time of the only dated endpoint', () => {
    expect(
      mergeDateBounds(
        { quality: 'unknown', text: 'start phrase' },
        { quality: 'exact', component: { year: 1930 }, time: { hour: 12, minute: 30 } },
      ),
    ).toEqual({
      quality: 'range',
      end: { year: 1930 },
      text: 'start phrase',
      time: { hour: 12, minute: 30 },
    });
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
  it('exports the primary date when the secondary bound has no year', () => {
    const fixture = makeRepo();
    try {
      const gedcom = [
        '0 HEAD',
        '1 GEDC',
        '2 VERS 7.0',
        '0 @I1@ INDI',
        '1 NAME Ivan /Petrov/',
        '1 BIRT',
        '2 DATE 1900',
        '2 _DATE2 2 JAN',
        '0 TRLR',
      ].join('\n');
      const parsed = parse(new TextEncoder().encode(gedcom));
      expect(parsed.ok).toBe(true);
      if (!parsed.ok || parsed.value.kind !== 'dataset') {
        return;
      }
      importGedcomDataset(parsed.value.dataset, fixture.repo);
      const person = fixture.repo.listAllPersons().find((entry) => entry.names.some((name) => name.given === 'Ivan'));
      expect(person?.facts[0]?.date).toMatchObject({
        quality: 'range',
        component: { year: 1900 },
        end: { month: 1, day: 2 },
      });

      const serialized = serializeGedcom70(buildGedcomDataset(fixture.repo));
      expect(serialized.ok).toBe(true);
      if (!serialized.ok) {
        return;
      }
      expect(serialized.value).toMatch(/2 DATE (1900|FROM 1900)/);
      expect(serialized.value).not.toContain('_DATE2');
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('keeps a start-only association period open-ended on export', () => {
    const fixture = makeRepo();
    try {
      fixture.repo.insertPerson({ id: 'P1', names: [], sex: 'U', facts: [] });
      fixture.repo.insertPerson({ id: 'P2', names: [], sex: 'U', facts: [] });
      fixture.repo.insertAssociation({
        id: 'A1',
        personId: 'P1',
        otherPersonId: 'P2',
        role: 'witness',
        relationship: 'friend',
        period: { quality: 'range', component: { year: 1900 } },
      });

      const serialized = serializeGedcom70(buildGedcomDataset(fixture.repo));
      expect(serialized.ok).toBe(true);
      if (!serialized.ok) {
        return;
      }
      expect(serialized.value).toContain('3 _START FROM 1900');
      expect(serialized.value).not.toContain('3 _END');
    } finally {
      cleanupRepo(fixture);
    }
  });

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
