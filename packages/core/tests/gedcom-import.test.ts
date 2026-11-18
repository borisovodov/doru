import { describe, expect, it } from 'vitest';
import { parse } from '@doru/gedcom';
import { importGedcomDataset } from '../src/import/gedcom';
import { OpQueue } from '../src/ops/op';
import { TreeService } from '../src/service/tree';
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

const MEDIA = [
  '0 HEAD',
  '1 GEDC',
  '2 VERS 7.0',
  '0 @O1@ OBJE',
  '1 FILE photos/a.jpg',
  '1 TITL Portrait',
  '0 @I1@ INDI',
  '1 NAME Ivan /Petrov/',
  '1 OBJE @O1@',
  '2 CROP',
  '3 TOP 10',
  '0 TRLR',
].join('\n');

function parseDataset(text = GEDCOM) {
  const result = parse(new TextEncoder().encode(text));
  if (!result.ok || result.value.kind !== 'dataset') {
    throw new Error(`fixture failed to parse: ${JSON.stringify(result)}`);
  }
  return result.value.dataset;
}

describe('importGedcomDataset dropped counters', () => {
  it('does not count HEAD, SCHMA or raw extension records as dropped tree records', () => {
    const fixture = makeRepo();
    try {
      const text = [
        '0 HEAD',
        '1 GEDC',
        '2 VERS 7.0',
        '1 SCHMA',
        '2 TAG _RAW https://example.org/raw',
        '0 _RAW value',
        '0 TRLR',
      ].join('\n');
      const result = importGedcomDataset(parseDataset(text), fixture.repo);
      expect(result.droppedStructures).toBe(0);
    } finally {
      cleanupRepo(fixture);
    }
  });
});

describe('importGedcomDataset validation', () => {
  it('rolls the whole import back when the file contains a parent cycle', () => {
    const fixture = makeRepo();
    try {
      const cyclic = [
        '0 HEAD',
        '1 GEDC',
        '2 VERS 7.0',
        '0 @I1@ INDI',
        '1 NAME A /One/',
        '1 FAMS @F1@',
        '1 FAMC @F2@',
        '0 @I2@ INDI',
        '1 NAME B /Two/',
        '1 FAMS @F2@',
        '1 FAMC @F1@',
        '0 @F1@ FAM',
        '1 HUSB @I1@',
        '1 CHIL @I2@',
        '0 @F2@ FAM',
        '1 HUSB @I2@',
        '1 CHIL @I1@',
        '0 TRLR',
      ].join('\n');
      expect(() => importGedcomDataset(parseDataset(cyclic), fixture.repo)).toThrow(/parent cycle/);
      expect(fixture.repo.countPersons()).toBe(0);
      expect(fixture.repo.listFamilies()).toEqual([]);
    } finally {
      cleanupRepo(fixture);
    }
  });
});

const MEDIA_WITHOUT_FILE = [
  '0 HEAD',
  '1 GEDC',
  '2 VERS 5.5.1',
  '1 CHAR UTF-8',
  '0 @O1@ OBJE',
  '1 FORM jpg',
  '1 BLOB raw-bytes',
  '0 @I1@ INDI',
  '1 NAME Ivan /Petrov/',
  '1 OBJE @O1@',
  '0 TRLR',
].join('\n');

describe('importGedcomDataset media', () => {
  it('skips OBJE records without a non-empty FILE instead of failing the import', () => {
    const fixture = makeRepo();
    try {
      const result = importGedcomDataset(parseDataset(MEDIA_WITHOUT_FILE), fixture.repo);
      expect(result.importedMedia).toBe(0);
      expect(fixture.repo.listAllMedia()).toEqual([]);

      const person = fixture.repo.listAllPersons()[0]!;
      expect(person.names[0]?.given).toBe('Ivan');
      expect(fixture.repo.listAttachmentsFor('person', person.id).mediaLinks).toEqual([]);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('imports OBJE records and links with the prepared project paths', () => {
    const fixture = makeRepo();
    try {
      const dataset = parseDataset(MEDIA);
      const result = importGedcomDataset(dataset, fixture.repo, new Map([['photos/a.jpg', 'media/prepared.jpg']]));
      expect(result.importedMedia).toBe(1);
      const media = fixture.repo.listAllMedia();
      expect(media).toHaveLength(1);
      expect(media[0]).toMatchObject({ title: 'Portrait', xref: '@O1@' });
      expect(media[0]?.files?.[0]?.path).toBe('media/prepared.jpg');

      const person = fixture.repo.listAllPersons()[0]!;
      const links = fixture.repo.listAttachmentsFor('person', person.id).mediaLinks;
      expect(links).toHaveLength(1);
      expect(links[0]?.link.crop).toEqual({ top: 10 });
    } finally {
      cleanupRepo(fixture);
    }
  });
});

describe('importGedcomDataset', () => {
  it('maps persons, names, facts, dates, families, sources, citations and notes', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      const result = importGedcomDataset(parseDataset(), repo);
      expect(result).toEqual({
        importedPersons: 3,
        importedFamilies: 1,
        importedSources: 1,
        importedPlaces: 2,
        importedMedia: 0,
        totalPersons: 3,
        droppedStructures: 0,
      });

      const persons = repo.listAllPersons();
      expect(persons).toHaveLength(3);
      const byXref = new Map(persons.map((person) => [person.xref, person]));

      const ivan = byXref.get('@I1@');
      expect(ivan?.sex).toBe('M');
      expect(ivan?.names).toEqual([expect.objectContaining({ given: 'Ivan', surname: 'Petrov', full: 'Ivan Petrov' })]);
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
      expect(sources).toEqual([expect.objectContaining({ xref: '@S1@', title: 'Parish register', author: 'Church' })]);

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

  it('imports citations on shared notes before families reference them', () => {
    const gedcom = [
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '0 @N1@ SNOTE Shared note text',
      '1 SOUR @S1@',
      '0 @S1@ SOUR',
      '1 TITL Parish register',
      '0 @I1@ INDI',
      '1 NAME Ivan /Petrov/',
      '1 FAMC @F1@',
      '2 NOTE @N1@',
      '0 @F1@ FAM',
      '1 CHIL @I1@',
      '0 TRLR',
    ].join('\n');
    const result = parse(new TextEncoder().encode(gedcom));
    if (!result.ok || result.value.kind !== 'dataset') {
      throw new Error('fixture failed to parse');
    }
    const fixture = makeRepo();
    try {
      importGedcomDataset(result.value.dataset, fixture.repo);
      const note = fixture.repo.listNotes().find((entry) => entry.text === 'Shared note text')!;
      const source = fixture.repo.listSources().find((entry) => entry.title === 'Parish register')!;
      expect(fixture.repo.listCitationRecordsFor('note', note.id).map((citation) => citation.sourceId)).toEqual([
        source.id,
      ]);
      const family = fixture.repo.listFamilies()[0]!;
      const childLink = family.childLinks?.[0];
      expect(childLink).toBeDefined();
      expect(
        fixture.repo.listAttachmentsFor('family_child', childLink!.id).noteLinks.map((link) => link.note.id),
      ).toEqual([note.id]);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('keeps place-card and repository-note citations that point at a later source', () => {
    const gedcom = [
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '0 @PL1@ _PLAC Moscow',
      '1 SOUR @S1@',
      '0 @R1@ REPO',
      '1 NAME State Archive',
      '1 NOTE Archive note',
      '2 SOUR @S1@',
      '0 @S1@ SOUR',
      '1 TITL Parish register',
      '0 TRLR',
    ].join('\n');
    const result = parse(new TextEncoder().encode(gedcom));
    if (!result.ok || result.value.kind !== 'dataset') {
      throw new Error('fixture failed to parse');
    }
    const fixture = makeRepo();
    try {
      importGedcomDataset(result.value.dataset, fixture.repo);
      const source = fixture.repo.listSources()[0]!;
      const place = fixture.repo.listPlaces()[0]!;
      expect(fixture.repo.listCitationRecordsFor('place', place.id).map((entry) => entry.sourceId)).toEqual([
        source.id,
      ]);
      const repository = fixture.repo.listRepositories()[0]!;
      const note = fixture.repo.listNotesFor('repository', repository.id)[0]!;
      expect(fixture.repo.listCitationRecordsFor('note', note.id).map((entry) => entry.sourceId)).toEqual([source.id]);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('keeps person-side FAMC details without a reciprocal CHIL row', () => {
    const gedcom = [
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '0 @I1@ INDI',
      '1 NAME Child /Petrov/',
      '1 FAMC @F1@',
      '2 PEDI ADOPTED',
      '2 STAT CHALLENGED',
      '2 NOTE One-sided link note',
      '0 @I2@ INDI',
      '1 NAME Parent /Petrov/',
      '0 @F1@ FAM',
      '1 HUSB @I2@',
      '0 TRLR',
    ].join('\n');
    const result = parse(new TextEncoder().encode(gedcom));
    if (!result.ok || result.value.kind !== 'dataset') {
      throw new Error('fixture failed to parse');
    }
    const fixture = makeRepo();
    try {
      importGedcomDataset(result.value.dataset, fixture.repo);
      const family = fixture.repo.listFamilies()[0]!;
      const child = fixture.repo.listAllPersons().find((person) => person.names[0]?.given === 'Child')!;
      const link = family.childLinks?.[0];
      expect(family.children).toEqual([child.id]);
      expect(link).toMatchObject({ childId: child.id, pedigree: 'adopted', status: 'challenged' });
      expect(fixture.repo.listNotesFor('family_child', link!.id).map((note) => note.text)).toEqual([
        'One-sided link note',
      ]);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('validates todo dates against the month and leap year', () => {
    const gedcom = [
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '0 _TODO Invalid date',
      '1 _TCDT 2026-02-31',
      '0 _TODO Leap date',
      '1 _TCDT 2024-02-29',
      '0 TRLR',
    ].join('\n');
    const result = parse(new TextEncoder().encode(gedcom));
    if (!result.ok || result.value.kind !== 'dataset') {
      throw new Error('fixture failed to parse');
    }
    const fixture = makeRepo();
    try {
      importGedcomDataset(result.value.dataset, fixture.repo);
      const invalid = fixture.repo.listTodos().find((todo) => todo.text === 'Invalid date')!;
      const leap = fixture.repo.listTodos().find((todo) => todo.text === 'Leap date')!;
      expect(invalid.createdDate).toMatchObject({ quality: 'unknown', text: '2026-02-31' });
      expect(leap.createdDate).toMatchObject({
        quality: 'exact',
        component: { year: 2024, month: 2, day: 29 },
      });
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('does not treat a disproven FAMC link as ancestry', () => {
    const gedcom = [
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '0 @I1@ INDI',
      '1 NAME P1 /Example/',
      '1 FAMS @F1@',
      '1 FAMC @F2@',
      '2 STAT DISPROVEN',
      '2 NOTE Disproven link',
      '0 @I2@ INDI',
      '1 NAME P2 /Example/',
      '1 FAMS @F2@',
      '1 FAMC @F1@',
      '0 @F1@ FAM',
      '1 HUSB @I1@',
      '1 CHIL @I2@',
      '0 @F2@ FAM',
      '1 HUSB @I2@',
      '0 TRLR',
    ].join('\n');
    const result = parse(new TextEncoder().encode(gedcom));
    if (!result.ok || result.value.kind !== 'dataset') {
      throw new Error('fixture failed to parse');
    }
    const fixture = makeRepo();
    try {
      importGedcomDataset(result.value.dataset, fixture.repo);
      const p1 = fixture.repo.listAllPersons().find((person) => person.names[0]?.given === 'P1')!;
      const family = fixture.repo.listFamilies().find((entry) => entry.partners.includes(p1.id))!;
      expect(family.partners).toContain(p1.id);
      const second = fixture.repo.listFamilies().find((entry) => entry.children.includes(p1.id))!;
      const link = second.childLinks?.find((entry) => entry.childId === p1.id);
      expect(link?.status).toBe('disproven');
      expect(fixture.repo.listNotesFor('family_child', link!.id).map((note) => note.text)).toEqual(['Disproven link']);

      const service = new TreeService(fixture.repo, new OpQueue());
      const parentFamily = fixture.repo.listFamilies().find((entry) => entry.partners.includes(p1.id))!;
      expect(() => service.updateFamily(parentFamily, { ...parentFamily, preferred: true })).not.toThrow();
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('does not create a submitter for a nameless SUBM record', () => {
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
