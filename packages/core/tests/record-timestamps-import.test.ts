import { describe, expect, it } from 'vitest';
import { parse } from '@doru/gedcom';
import { importGedcomDataset } from '../src/import/gedcom';
import { cleanupRepo, makeRepo } from './helpers';

const GEDCOM = [
  '0 HEAD',
  '1 GEDC',
  '2 VERS 7.0',
  '1 SOUR TEST',
  '0 @I1@ INDI',
  '1 NAME John /Doe/',
  '1 SEX M',
  '1 CREA',
  '2 DATE 1 JAN 2000',
  '3 TIME 10:00:00',
  '1 CHAN',
  '2 DATE 2 FEB 2010',
  '3 TIME 11:30:00',
  '1 BIRT',
  '2 DATE 3 MAR 1980',
  '2 CHAN',
  '3 DATE 5 APR 2020',
  '1 ADDR',
  '2 CITY Moscow',
  '1 SNOTE @N1@',
  '1 NOTE Inline note',
  '0 @I2@ INDI',
  '1 NAME Vendor /Vendor/',
  '1 _CREAT 2 APR 1911',
  '1 _UPD 13 SEP 2019 14:21:05',
  '0 @I3@ INDI',
  '1 NAME Partial /Partial/',
  '1 CHAN',
  '2 DATE 2019',
  '0 @F1@ FAM',
  '1 HUSB @I1@',
  '1 MARR',
  '2 CHAN',
  '3 DATE 7 JUL 2022',
  '1 CHAN',
  '2 DATE 1 JAN 2020',
  '0 @S1@ SOUR',
  '1 TITL Structured source',
  '1 CREA',
  '2 DATE 1 JAN 2001',
  '1 CHAN',
  '2 DATE 1 JAN 2011',
  '1 _UPD 4 JUN 2024 08:12:27 GMT -0500',
  '0 @S2@ SOUR',
  '1 TITL Compact source',
  '1 _UPD 20010101',
  '0 @O1@ OBJE',
  '1 FILE photo.jpg',
  '2 FORM jpeg',
  '1 _CREA 5 MAR 2020',
  '1 CHAN',
  '2 DATE 6 JUN 2021',
  '0 @R1@ REPO',
  '1 NAME Archive',
  '1 CREA',
  '2 DATE 1 JAN 2002',
  '1 CHAN',
  '2 DATE 1 JAN 2012',
  '0 @R2@ REPO',
  '1 NAME Legacy archive',
  '1 _CREAT 2 MAR 2003',
  '1 _UPD 3 APR 2013',
  '0 @U1@ SUBM',
  '1 NAME Submitter',
  '1 CREA',
  '2 DATE 1 JAN 2003',
  '1 CHAN',
  '2 DATE 1 JAN 2013',
  '0 @N1@ SNOTE Shared note',
  '1 CREA',
  '2 DATE 1 JAN 2004',
  '1 CHAN',
  '2 DATE 1 JAN 2014',
  '0 @PL1@ _PLAC Moscow',
  '1 CHAN',
  '2 DATE 1 JAN 2015',
  '0 @PL2@ _PLAC Kazan',
  '1 CREA',
  '2 DATE 1 JAN 2018',
  '0 @T1@ TITL Parish books',
  '1 CHAN',
  '2 DATE 1 JAN 2016',
  '0 _TODO Task with change',
  '1 _TCDT 2010-01-01',
  '1 CHAN',
  '2 DATE 2 FEB 2020',
  '0 TRLR',
].join('\n');

function local(year: number, month: number, day: number, hour = 0, minute = 0, second = 0): number {
  const value = new Date(0);
  value.setFullYear(year, month - 1, day);
  value.setHours(hour, minute, second, 0);
  return value.getTime();
}

function utc(year: number, month: number, day: number, hour = 0, minute = 0, second = 0): number {
  return Date.UTC(year, month - 1, day, hour, minute, second, 0);
}

describe('GEDCOM import timestamps', () => {
  it('maps CREA, CHAN and the known vendor spellings, with incomplete dates falling back', () => {
    const parsed = parse(new TextEncoder().encode(GEDCOM));
    if (!parsed.ok || parsed.value.kind !== 'dataset') {
      throw new Error('fixture failed to parse');
    }
    const fixture = makeRepo();
    try {
      importGedcomDataset(parsed.value.dataset, fixture.repo);

      const persons = fixture.repo.listPersons();
      const first = persons.find((entry) => entry.names.some((name) => name.surname === 'Doe'))!;
      const vendor = persons.find((entry) => entry.names.some((name) => name.surname === 'Vendor'))!;
      const partial = persons.find((entry) => entry.names.some((name) => name.surname === 'Partial'))!;

      expect(first.createdAt).toBe(local(2000, 1, 1, 10, 0, 0));
      // The record CHAN (2010) loses to the BIRT fact CHAN (2020).
      expect(first.updatedAt).toBe(local(2020, 4, 5));

      expect(vendor.createdAt).toBe(local(1911, 4, 2));
      expect(vendor.updatedAt).toBe(local(2019, 9, 13, 14, 21, 5));

      const address = fixture.repo.listAddresses()[0]!;
      expect(partial.createdAt).toBe(address.createdAt);
      expect(partial.updatedAt).toBe(address.updatedAt);

      const family = fixture.repo.listFamilies()[0]!;
      expect(family).toMatchObject({
        createdAt: local(2020, 1, 1),
        updatedAt: local(2022, 7, 7),
      });

      const sources = fixture.repo.listSources();
      const structured = sources.find((entry) => entry.title === 'Structured source')!;
      const compact = sources.find((entry) => entry.title === 'Compact source')!;
      expect(structured.createdAt).toBe(local(2001, 1, 1));
      expect(structured.updatedAt).toBe(utc(2024, 6, 4, 13, 12, 27));
      expect(compact.createdAt).toBe(local(2001, 1, 1));
      expect(compact.updatedAt).toBe(local(2001, 1, 1));

      expect(fixture.repo.listAllMedia()[0]).toMatchObject({
        createdAt: local(2020, 3, 5),
        updatedAt: local(2021, 6, 6),
      });
      const repositories = fixture.repo.listRepositories();
      const archive = repositories.find((entry) => entry.name === 'Archive')!;
      const legacy = repositories.find((entry) => entry.name === 'Legacy archive')!;
      expect(archive).toMatchObject({
        createdAt: local(2002, 1, 1),
        updatedAt: local(2012, 1, 1),
      });
      expect(legacy).toMatchObject({
        createdAt: local(2003, 3, 2),
        updatedAt: local(2013, 4, 3),
      });
      expect(fixture.repo.listSubmitters()[0]).toMatchObject({
        createdAt: local(2003, 1, 1),
        updatedAt: local(2013, 1, 1),
      });
      const notes = fixture.repo.listNotes();
      expect(notes.find((entry) => entry.text === 'Shared note')).toMatchObject({
        targetType: 'person',
        createdAt: local(2004, 1, 1),
        updatedAt: local(2014, 1, 1),
      });
      expect(notes.find((entry) => entry.text === 'Inline note')).toMatchObject({
        targetType: 'person',
        createdAt: expect.any(Number),
        updatedAt: expect.any(Number),
      });
      const place = fixture.repo.listPlaces().find((entry) => entry.names.some((name) => name.value === 'Moscow'))!;
      expect(place).toMatchObject({ createdAt: local(2015, 1, 1), updatedAt: local(2015, 1, 1) });
      const kazan = fixture.repo.listPlaces().find((entry) => entry.names.some((name) => name.value === 'Kazan'))!;
      expect(kazan).toMatchObject({ createdAt: local(2018, 1, 1), updatedAt: local(2018, 1, 1) });
      expect(fixture.repo.listTitles()[0]).toMatchObject({
        createdAt: local(2016, 1, 1),
        updatedAt: local(2016, 1, 1),
      });
      const task = fixture.repo.listTasks().find((entry) => entry.text === 'Task with change')!;
      expect(task).toMatchObject({
        createdAt: local(2010, 1, 1),
        updatedAt: local(2020, 2, 2),
      });
    } finally {
      cleanupRepo(fixture);
    }
  });
});
