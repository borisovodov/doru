import { parse } from '@doru/gedcom';
import { describe, expect, it } from 'vitest';
import { buildGedcomDataset } from '../src/export/gedcom';
import { importGedcomDataset } from '../src/import/gedcom';
import { cleanupRepo, makeRepo } from './helpers';

/** A rich dataset exercising the full core projection. */
const RICH_GEDCOM = [
  '0 HEAD',
  '1 GEDC',
  '2 VERS 7.0',
  '1 SOUR DoruTest',
  '2 VERS 1.0',
  '1 SUBM @S1@',
  '1 LANG ru',
  '0 @S1@ SUBM',
  '1 NAME Test Submitter',
  '0 @R1@ REPO',
  '1 NAME State Archive',
  '1 ADDR 12 Main St',
  '2 CONT Cityville',
  '0 @N1@ SNOTE shared note text',
  '1 MIME text/plain',
  '0 @T1@ TITL Parish books of Tver',
  '1 AUTH A. Author',
  '1 PUBL Archive Press',
  '0 @S2@ SOUR',
  '1 TITL Parish register 1897',
  '1 ABBR PR-1897',
  '1 AUTH Church',
  '1 PUBL Tver',
  '1 REPO @R1@',
  '2 CALN F-123',
  '3 MEDI book',
  '1 DATA',
  '2 AGNC the church',
  '2 EVEN CENS',
  '3 DATE 1897',
  '1 TEXT transcript text',
  '2 MIME text/plain',
  '0 @I1@ INDI',
  '1 NAME Ivan /Petrov/',
  '2 GIVN Ivan',
  '2 SURN Petrov',
  '2 NICK Vanya',
  '1 SEX M',
  '1 REFN 42',
  '1 RIN r-1',
  '1 _EMAIL ivan@example.org',
  '1 RESN confidential',
  '1 BIRT',
  '2 DATE 2 MAR 1892',
  '3 TIME 04:30:00',
  '2 PLAC Moscow, Russia',
  '3 MAP',
  '4 LATI N55.7558',
  '4 LONG E37.6173',
  '2 AGE 0',
  '2 SOUR @S2@',
  '3 PAGE p. 12',
  '3 QUAY 2',
  '3 EVEN BIRT',
  '4 ROLE WITN',
  '2 NOTE born in winter',
  '2 _WITN Witness Name',
  '1 DEAT',
  '2 DATE AFT 1950',
  '1 OCCU Engineer',
  '1 FAMS @F1@',
  '2 DATE 1915',
  '1 NO MARR',
  '1 CHAN',
  '2 DATE 3 MAR 2020',
  '1 UID 11111111-1111-1111-1111-111111111111',
  '1 SNOTE @N1@',
  '1 ASSO @I2@',
  '2 RELA godfather',
  '1 NOTE inline note about Ivan',
  '1 _TODO check the archive',
  '2 _CAT research',
  '0 @I2@ INDI',
  '1 NAME Maria /Petrova/',
  '1 SEX F',
  '0 @I3@ INDI',
  '1 NAME Child /Petrov/',
  '1 SEX M',
  '1 FAMC @F1@',
  '2 PEDI adopted',
  '0 @F1@ FAM',
  '1 HUSB @I1@',
  '1 WIFE @I2@',
  '1 CHIL @I3@',
  '2 _FREL adopted',
  '1 MARR',
  '2 DATE 1915',
  '2 PLAC Tomsk',
  '2 HUSB',
  '3 AGE 23',
  '2 WIFE',
  '3 AGE 21',
  '1 NOTE family note',
  '0 TRLR',
].join('\n');

function parseRich() {
  const result = parse(new TextEncoder().encode(RICH_GEDCOM));
  if (!result.ok || result.value.kind !== 'dataset') {
    throw new Error('fixture failed to parse');
  }
  return result.value.dataset;
}

describe('importGedcomDataset (phase 4)', () => {
  it('projects the full core into the tree', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      const result = importGedcomDataset(parseRich(), repo);
      expect(result.importedPersons).toBe(3);
      expect(result.importedFamilies).toBe(1);
      expect(result.importedSources).toBe(1);
      expect(result.droppedStructures).toBe(0);

      // Header and registries.
      expect(repo.getHeader().gedcomVersion).toBe('7.0');
      expect(repo.getHeader().language).toBe('ru');
      expect(repo.listSubmitters()).toEqual([expect.objectContaining({ name: 'Test Submitter' })]);
      expect(repo.listRepositories()).toEqual([expect.objectContaining({ name: 'State Archive' })]);
      expect(repo.listTitles()).toEqual([expect.objectContaining({ name: 'Parish books of Tver' })]);

      // Source with the full model.
      const source = repo.listSources()[0]!;
      expect(source.title).toBe('Parish register 1897');
      expect(source.texts).toEqual([expect.objectContaining({ text: 'transcript text', mime: 'text/plain' })]);
      // DATA.EVEN.DATE is a period in GEDCOM: a from-only period becomes a range.
      expect(source.dataEvents).toEqual([
        expect.objectContaining({
          tag: 'CENS',
          date: expect.objectContaining({ quality: 'range', component: expect.objectContaining({ year: 1897 }) }),
        }),
      ]);
      expect(source.repositories?.[0]?.callNumbers).toEqual([
        expect.objectContaining({ value: 'F-123', medium: 'BOOK' }),
      ]);
      expect(source.agency).toBe('the church');

      // Persons, names with parts and projections.
      const persons = repo.listAllPersons();
      const ivan = persons.find((person) => person.xref === '@I1@')!;
      const name = ivan.names[0]!;
      expect(name.given).toBe('Ivan');
      expect(name.surname).toBe('Petrov');
      expect(name.nickname).toBe('Vanya');
      expect(name.full).toBe('Ivan Petrov');
      expect(name.parts?.map((part) => part.kind)).toEqual(['given', 'nickname', 'surname', 'full']);

      // Identifiers and contacts.
      expect(repo.listIdentifiersFor('person', ivan.id).map((entry) => entry.namespace).sort()).toEqual(['refn', 'rin', 'uid']);
      expect(repo.listContactsFor('person', ivan.id)).toEqual([
        expect.objectContaining({ kind: 'email', value: 'ivan@example.org' }),
      ]);
      expect(repo.listRestrictionsFor('person', ivan.id)).toEqual([
        expect.objectContaining({ level: 'confidential' }),
      ]);

      // Birth fact with the full detail set.
      const birth = repo.listFactsForPerson(ivan.id).find((fact) => fact.tag === 'BIRT')!;
      expect(birth.date?.component).toEqual(expect.objectContaining({ year: 1892, month: 3, day: 2 }));
      expect(birth.date?.time).toEqual(expect.objectContaining({ hour: 4, minute: 30 }));
      expect(birth.place).toBe('Moscow, Russia');
      expect(birth.placeId).toBeDefined();
      const place = repo.getPlace(birth.placeId!)!;
      expect(place.names.map((entry) => entry.value)).toEqual(['Moscow', 'Russia']);
      expect(place.latitude).toBeCloseTo(55.7558);
      expect(place.longitude).toBeCloseTo(37.6173);
      expect(birth.ages).toEqual([expect.objectContaining({ years: 0 })]);
      expect(birth.participants).toEqual([expect.objectContaining({ value: 'Witness Name', role: 'WITN' })]);

      // Death with a bound date; negation for the non-event.
      expect(repo.listFactsForPerson(ivan.id).find((fact) => fact.tag === 'DEAT')?.date?.quality).toBe('after');
      expect(repo.listFactsForPerson(ivan.id).find((fact) => fact.tag === 'MARR')?.negation).toBe(true);

      // Citations with the full detail set.
      const citations = repo.listCitationsFor('fact', birth.id);
      expect(citations).toHaveLength(1);
      expect(citations[0]?.source.title).toBe('Parish register 1897');
      const records = repo.listCitationRecordsFor('fact', birth.id);
      expect(records[0]).toEqual(
        expect.objectContaining({ page: 'p. 12', quality: '2', event: 'BIRT', role: 'WITN' }),
      );

      // Notes: inline + shared.
      const notes = repo.listNotesFor('person', ivan.id).map((note) => note.text);
      expect(notes).toContain('inline note about Ivan');
      expect(notes).toContain('shared note text');
      // The shared note keeps its record identity.
      expect(repo.listNotes().find((note) => note.text === 'shared note text')?.xref).toBe('@N1@');

      // Change rows.
      expect(repo.listChangesFor('person', ivan.id).map((change) => change.kind)).toEqual(['changed']);

      // Associations and todos.
      const maria = persons.find((person) => person.xref === '@I2@')!;
      expect(repo.listAssociationsFor(ivan.id)).toEqual([
        expect.objectContaining({ otherPersonId: maria.id, relationship: 'godfather' }),
      ]);
      expect(repo.listTodosFor('person', ivan.id)).toEqual([
        expect.objectContaining({ text: 'check the archive', category: 'research' }),
      ]);

      // Family with link details and a marriage fact with partner ages.
      const family = repo.listFamilies()[0]!;
      expect(family.partners).toEqual([ivan.id, maria.id]);
      const child = persons.find((person) => person.xref === '@I3@')!;
      expect(family.children).toEqual([child.id]);
      expect(family.childLinks?.[0]).toEqual(
        expect.objectContaining({ childId: child.id, pedigree: 'adopted', fatherRelation: 'adopted' }),
      );
      expect(family.partnerLinks?.[0]?.date).toEqual(expect.objectContaining({ quality: 'exact' }));
      const marriage = repo.listFactsForFamily(family.id).find((fact) => fact.tag === 'MARR')!;
      expect(marriage.ages?.map((age) => [age.role, age.years])).toEqual([['HUSB', 23], ['WIFE', 21]]);
      expect(marriage.place).toBe('Tomsk');
      expect(repo.listNotesFor('family', family.id).map((note) => note.text)).toEqual(['family note']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('counts deliberately dropped vendor records', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      const gedcom = [
        '0 HEAD',
        '1 GEDC',
        '2 VERS 7.0',
        '1 SOUR TEST',
        '0 @O1@ OBJE',
        '1 FILE C:\\photos\\a.jpg',
        '0 @A1@ _ALIA',
        '1 _INDI @I1@',
        '0 @I1@ INDI',
        '1 NAME A /B/',
        '0 TRLR',
      ].join('\n');
      const result = parse(new TextEncoder().encode(gedcom));
      if (!result.ok || result.value.kind !== 'dataset') {
        throw new Error('fixture failed to parse');
      }
      const imported = importGedcomDataset(result.value.dataset, repo);
      expect(imported.importedPersons).toBe(1);
      expect(imported.droppedStructures).toBe(2);
      expect(repo.listAllMedia()).toEqual([]);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('round-trips through export: import, export, re-import', async () => {
    const { serializeGedcom70 } = await import('@doru/gedcom');
    const first = makeRepo();
    const second = makeRepo();
    try {
      importGedcomDataset(parseRich(), first.repo);
      const dataset = buildGedcomDataset(first.repo);
      const serialized = serializeGedcom70(dataset);
      expect(serialized.ok).toBe(true);
      if (!serialized.ok) {
        return;
      }
      const reparsed = parse(new TextEncoder().encode(serialized.value));
      if (!reparsed.ok || reparsed.value.kind !== 'dataset') {
        throw new Error('reparse failed');
      }
      importGedcomDataset(reparsed.value.dataset, second.repo);

      // The same persons, names and facts come back.
      const persons = second.repo.listAllPersons();
      expect(persons).toHaveLength(3);
      const ivan = persons.find((person) => person.xref === '@I1@')!;
      expect(ivan.names[0]?.given).toBe('Ivan');
      expect(ivan.names[0]?.surname).toBe('Petrov');
      const birth = second.repo.listFactsForPerson(ivan.id).find((fact) => fact.tag === 'BIRT')!;
      expect(birth.date?.component).toEqual(expect.objectContaining({ year: 1892, month: 3, day: 2 }));
      expect(birth.place).toBe('Moscow, Russia');
      expect(birth.participants).toEqual([expect.objectContaining({ value: 'Witness Name', role: 'WITN' })]);

      // Shared notes keep their xref and link again.
      expect(second.repo.listNotesFor('person', ivan.id).map((note) => note.text)).toContain('shared note text');

      // Sources, citations and the family survive.
      expect(second.repo.listSources()[0]?.title).toBe('Parish register 1897');
      const family = second.repo.listFamilies()[0]!;
      expect(family.partners).toHaveLength(2);
      expect(family.children).toHaveLength(1);
      expect(family.childLinks?.[0]?.pedigree).toBe('adopted');
      const marriage = second.repo.listFactsForFamily(family.id).find((fact) => fact.tag === 'MARR')!;
      expect(marriage.ages?.map((age) => [age.role, age.years])).toEqual([['HUSB', 23], ['WIFE', 21]]);
    } finally {
      cleanupRepo(first);
      cleanupRepo(second);
    }
  });
});
