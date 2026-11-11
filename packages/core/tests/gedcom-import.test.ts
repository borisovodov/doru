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
  '1 NAME Ivan /Petrov/',
  '2 GIVN Ivan',
  '2 SURN Petrov',
  '1 SEX M',
  '1 BIRT',
  '2 DATE 12 MAR 1923',
  '2 PLAC Moscow, Russia',
  '2 SOUR @S1@',
  '3 PAGE p. 5',
  '1 DEAT',
  '2 DATE AFT 1990',
  '1 OCCU Engineer',
  '1 NOTE inline note about Ivan',
  '1 SNOTE @N1@',
  '1 FAMC @F1@',
  '1 FAMS @F1@',
  '0 @I2@ INDI',
  '1 NAME Maria /Sidorova/',
  '2 SPFX de',
  '1 SEX F',
  '1 BIRT',
  '2 DATE @#DJULIAN@ 3 JAN 1826',
  '1 FAMS @F1@',
  '0 @I3@ INDI',
  '1 NAME Petr /Petrov/',
  '1 SEX M',
  '1 FAMC @F1@',
  '0 @F1@ FAM',
  '1 HUSB @I1@',
  '1 WIFE @I2@',
  '1 CHIL @I3@',
  '1 MARR',
  '2 DATE BET 1945 AND 1947',
  '2 PLAC Tomsk',
  '2 SOUR @S1@',
  '0 @S1@ SOUR',
  '1 TITL Parish register',
  '1 AUTH Church',
  '0 @N1@ SNOTE Shared note text',
  '1 MIME text/plain',
  '0 TRLR',
].join('\n');

function parseDataset() {
  const result = parse(new TextEncoder().encode(GEDCOM));
  if (!result.ok || result.value.kind !== 'dataset') {
    throw new Error(`fixture failed to parse: ${JSON.stringify(result)}`);
  }
  return result.value.dataset;
}

describe('importGedcomDataset', () => {
  it('maps persons, names, facts, dates, families, sources, citations and notes', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      const result = importGedcomDataset(parseDataset(), repo);
      expect(result).toEqual({ importedPersons: 3, importedFamilies: 1, importedSources: 1, importedPlaces: 2, totalPersons: 3, droppedStructures: 0 });

      const persons = repo.listAllPersons();
      expect(persons).toHaveLength(3);
      const byXref = new Map(persons.map((person) => [person.xref, person]));

      const ivan = byXref.get('@I1@');
      expect(ivan?.sex).toBe('M');
      expect(ivan?.names).toEqual([
        expect.objectContaining({ given: 'Ivan', surname: 'Petrov', full: 'Ivan Petrov' }),
      ]);
      const birth = ivan?.facts.find((fact) => fact.tag === 'BIRT');
      expect(birth?.date).toEqual({
        id: expect.any(String),
        quality: 'exact',
        component: { year: 1923, month: 3, day: 12 },
      });
      expect(birth?.place).toBe('Moscow, Russia');
      const death = ivan?.facts.find((fact) => fact.tag === 'DEAT');
      expect(death?.date).toEqual({ id: expect.any(String), quality: 'after', component: { year: 1990 } });
      const occupation = ivan?.facts.find((fact) => fact.tag === 'OCCU');
      expect(occupation?.value).toBe('Engineer');

      const maria = byXref.get('@I2@');
      expect(maria?.names[0]).toEqual(
        expect.objectContaining({ given: 'Maria', surname: 'Sidorova', surnamePrefix: 'de' }),
      );
      expect(maria?.facts.find((fact) => fact.tag === 'BIRT')?.date).toEqual({
        id: expect.any(String),
        quality: 'exact',
        component: { calendar: 'julian', year: 1826, month: 1, day: 3 },
      });

      const families = repo.listFamilies();
      expect(families).toHaveLength(1);
      const family = families[0];
      expect(family?.xref).toBe('@F1@');
      expect(family?.partners).toEqual([ivan?.id, maria?.id]);
      expect(family?.children).toEqual([byXref.get('@I3@')?.id]);
      const marriage = repo.listFactsForFamily(family?.id ?? '').find((fact) => fact.tag === 'MARR');
      expect(marriage?.date).toEqual({
        id: expect.any(String),
        quality: 'range',
        component: { year: 1945 },
        end: { year: 1947 },
      });
      expect(marriage?.place).toBe('Tomsk');

      const sources = repo.listSources();
      expect(sources).toEqual([
        expect.objectContaining({ xref: '@S1@', title: 'Parish register', author: 'Church' }),
      ]);

      const birthCitations = repo.listCitationsFor('fact', birth?.id ?? '');
      expect(birthCitations).toHaveLength(1);
      expect(birthCitations[0]?.source.title).toBe('Parish register');

      const notes = repo.listNotesFor('person', ivan?.id ?? '');
      const texts = notes.map((note) => note.text);
      expect(texts).toContain('inline note about Ivan');
      expect(texts).toContain('Shared note text');
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('maps approximate and period dates and text-only dates', () => {
    const gedcom = [
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '1 SOUR TEST',
      '0 @I1@ INDI',
      '1 NAME A /B/',
      '1 BIRT',
      '2 DATE ABT 1900',
      '1 DEAT',
      '2 DATE FROM 1945 TO 1946',
      '1 RESI',
      '2 DATE (during the war)',
      '0 TRLR',
    ].join('\n');
    const result = parse(new TextEncoder().encode(gedcom));
    if (!result.ok || result.value.kind !== 'dataset') {
      throw new Error('fixture failed to parse');
    }
    const fixture = makeRepo();
    try {
      importGedcomDataset(result.value.dataset, fixture.repo);
      const person = fixture.repo.listAllPersons()[0];
      expect(person?.facts.find((fact) => fact.tag === 'BIRT')?.date).toEqual({
        id: expect.any(String),
        quality: 'about',
        modifier: 'ABT',
        component: { year: 1900 },
      });
      expect(person?.facts.find((fact) => fact.tag === 'DEAT')?.date).toEqual({
        id: expect.any(String),
        quality: 'range',
        component: { year: 1945 },
        end: { year: 1946 },
      });
      expect(person?.facts.find((fact) => fact.tag === 'RESI')?.date).toEqual({
        id: expect.any(String),
        quality: 'unknown',
        text: 'during the war',
      });
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('skips submitters without a name', () => {
    const gedcom = [
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '1 SUBM @U1@',
      '0 @U1@ SUBM',
      '0 @U2@ SUBM',
      '1 NAME Test Submitter',
      '0 TRLR',
    ].join('\n');
    const result = parse(new TextEncoder().encode(gedcom));
    if (!result.ok || result.value.kind !== 'dataset') {
      throw new Error('fixture failed to parse');
    }
    const fixture = makeRepo();
    try {
      importGedcomDataset(result.value.dataset, fixture.repo);
      expect(fixture.repo.listSubmitters()).toEqual([expect.objectContaining({ name: 'Test Submitter' })]);
    } finally {
      cleanupRepo(fixture);
    }
  });
});
