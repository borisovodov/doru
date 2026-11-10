import { describe, expect, it } from 'vitest';
import { parse } from '@doru/gedcom';
import { importGedcomDataset } from '../src/import/gedcom';
import { cleanupRepo, makeRepo } from './helpers';

const GEDCOM = [
  '0 HEAD',
  '1 GEDC',
  '2 VERS 7.0',
  '1 SUBM @U1@',
  '0 @U1@ SUBM',
  '1 NAME Ivan',
  '1 RIN 42',
  '1 NOTE a submitter note',
  '0 @I1@ INDI',
  '1 NAME Ivan /Petrov/',
  '2 GIVN Ivan',
  '2 SURN Petrov',
  '2 FONE Eevan',
  '2 ROMN Ivan Petrov',
  '1 SEX M',
  '1 RIN 12',
  '1 _SOSA 42',
  '1 _SOSADABOVILLE 42-1',
  '1 EMAIL ivan@example.org',
  '1 PHON 12345',
  '1 _PHON 67890',
  '1 FAX 111',
  '1 WWW https://ivan.example',
  '1 RESN confidential',
  '1 CHAN',
  '2 DATE 1 JAN 2026',
  '1 CREA',
  '2 DATE 2 JAN 2026',
  '1 _EVREF @E1@',
  '2 _CONF high',
  '1 _EVREF @MISSING@',
  '1 SUBM @U1@',
  '1 _TAG @T1@',
  '1 _TAG @MISSINGTAG@',
  '1 BIRT',
  '2 DATE 12 MAR 1923',
  '2 PLAC Moscow, Russia',
  '2 ADDR 12 Archive Lane',
  '3 CITY Moscow',
  '3 EMAIL a@b.c',
  '3 PHON 9',
  '3 FAX 8',
  '3 WWW https://x.example',
  '2 SOUR @S1@',
  '2 NOTE a fact note',
  '1 NO MARR',
  '2 SOUR @S1@',
  '2 NOTE a negation note',
  '1 ASSO @I2@',
  '2 ROLE WITNESS',
  '1 ASSO @VOID@',
  '1 ALIA @I2@',
  '1 BAPL',
  '2 DATE 1930',
  '2 STAT COMPLETED',
  '1 SLGC',
  '2 FAMC @F1@',
  '2 STAT BIC',
  '0 @I2@ INDI',
  '1 NAME Maria /Sidorova/',
  '1 RESN locked',
  '0 @I3@ INDI',
  '1 NAME Petr /Petrov/',
  '0 @F1@ FAM',
  '1 HUSB @I1@',
  '1 WIFE @I2@',
  '1 CHIL @I3@',
  '2 _PEDI adopted',
  '2 STAT proven',
  '1 SLGS',
  '2 STAT CANCELED',
  '1 SLGC',
  '2 DATE 1946',
  '0 @S1@ SOUR',
  '1 TITL The Book',
  '0 @N1@ SNOTE Shared note',
  '1 MIME text/plain',
  '1 LANG en',
  '1 TRAN translated',
  '2 MIME text/plain',
  '2 LANG ru',
  '0 @T1@ _TAG',
  '1 NAME favorites',
  '0 @T2@ _TAG',
  '0 @TD1@ _TODO Order the record',
  '1 _CAT records',
  '1 _LOCL archive',
  '1 _TPTY high',
  '1 _TSTS open',
  '1 _UID todo-uid',
  '1 _CDATE 2026',
  '0 @E1@ _EVID',
  '1 _TYPE birth certificate',
  '1 SOUR @S1@',
  '1 NOTE evidence note',
  '1 UID ev-uid',
  '0 @O1@ _OCUR',
  '1 TYPE death',
  '1 DATE 1990',
  '1 PLAC Moscow, Russia',
  '1 _PART @I1@',
  '2 ROLE witness',
  '1 _PART @MISSING@',
  '0 @O2@ _OCUR',
  '0 @C1@ _CENR',
  '1 DATE 1901',
  '1 PLAC Moscow, Russia',
  '1 INDI @I1@',
  '2 SEX M',
  '2 AGE 17y',
  '2 _MSTAT single',
  '2 OCCU smith',
  '2 BIRT',
  '3 DATE 1884',
  '3 PLAC Moscow',
  '1 INDI @MISSING@',
  '0 @OB1@ OBJE',
  '0 @AL1@ _ALIA',
  '0 @PL1@ _PLAC Moscow, Russia',
  '0 @GR1@ _GRP',
  '0 @PB1@ _PUBLISH',
  '0 @MT1@ _MTTAG',
  '0 @MC1@ _MTCAT',
  '0 @EV1@ _EVENT_DEFN MILT',
  '1 TITL military service',
  '1 TYPE I',
  '1 ABBR mil',
  '1 SENT {individual} served',
  '1 _CONF_FLAG Y',
  '0 TRLR',
].join('\n');

function parseDataset() {
  const result = parse(new TextEncoder().encode(GEDCOM));
  if (!result.ok || result.value.kind !== 'dataset') {
    throw new Error(`fixture failed to parse: ${result.ok ? 'not a dataset' : result.error.message}`);
  }
  return result.value.dataset;
}

const EDGE_GEDCOM = [
  '0 HEAD',
  '1 GEDC',
  '2 VERS 7.0',
  '1 SUBM @U1@',
  '0 @U1@ SUBM',
  '0 SNOTE a shared note without an xref',
  '0 @I1@ INDI',
  '1 NAME Ivan /Petrov/',
  '1 NOTE a note with a translation',
  '2 TRAN переведено',
  '3 MIME text/plain',
  '3 LANG ru',
  '1 EMAIL',
  '1 BIRT',
  '2 DATE FRENCH_R 3 VEND 1',
  '2 PLAC Moscow, Russia',
  '3 TRAN Москва',
  '4 LANG ru',
  '3 FONE moskva',
  '4 TYPE phonetic',
  '3 ROMN moskva',
  '4 TYPE romanized',
  '1 DEAT',
  '2 DATE HEBREW 1 TSH 5785',
  '2 PLAC',
  '0 @I2@ INDI',
  '1 NAME Maria /Sidorova/',
  '1 BIRT',
  '2 DATE 12 MAR 1923',
  '2 PLAC Moscow, Russia',
  '0 @F1@ FAM',
  '1 HUSB @I1@',
  '1 WIFE @I2@',
  '1 _TAG @T1@',
  '1 _TODO a family task',
  '2 PRTY high',
  '2 STAT open',
  '2 DATE 2026',
  '0 @T1@ _TAG',
  '1 NAME favorites',
  '0 @C1@ _CENR',
  '1 DATE 1901',
  '1 PLAC Moscow, Russia',
  '1 INDI @I1@',
  '2 BIRT',
  '3 DATE 1884',
  '3 PLAC Moscow',
  '1 INDI @I2@',
  '2 BIRT',
  '3 DATE 1885',
  '3 PLAC Moscow',
  '0 TRLR',
].join('\n');

describe('importGedcomDataset edge coverage', () => {
  it('maps identifiers, contacts, changes, links and vendor records', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      const result = importGedcomDataset(parseDataset(), repo);
      expect(result.droppedStructures).toBeGreaterThan(0);

      const persons = repo.listAllPersons();
      const byXref = new Map(persons.map((person) => [person.xref, person]));
      const ivan = byXref.get('@I1@')!;
      expect(ivan).toBeDefined();

      // RIN / _SOSA / _SOSA_DABOVILLE become identifiers.
      const identifierNamespaces = repo
        .listIdentifiersFor('person', ivan.id)
        .map((identifier) => identifier.namespace)
        .sort();
      expect(identifierNamespaces).toEqual(['daboville', 'rin', 'sosa']);

      // INDI-level and fact-address contacts.
      const contactKinds = repo.listContactsFor('person', ivan.id).map((contact) => contact.kind).sort();
      expect(contactKinds).toEqual(['email', 'phone', 'phone', 'url']);

      const birth = ivan.facts.find((fact) => fact.tag === 'BIRT')!;
      const factKinds = repo.listContactsFor('fact', birth.id).map((contact) => contact.kind).sort();
      expect(factKinds).toEqual(['email', 'fax', 'phone', 'www']);

      // Restrictions, changes, submitter links, evidence links, tag links.
      expect(repo.listRestrictionsFor('person', ivan.id).map((entry) => entry.level)).toEqual(['confidential']);
      expect(repo.listChangesFor('person', ivan.id)).toHaveLength(2);
      expect(repo.listSubmittersFor('person', ivan.id)).toHaveLength(1);
      expect(repo.listEvidenceLinksFor('person', ivan.id)).toHaveLength(1);
      expect(repo.listTagLinksFor('person', ivan.id)).toHaveLength(1);

      // The negated fact keeps its citations and notes.
      const negation = ivan.facts.find((fact) => fact.tag === 'MARR')!;
      expect(negation.negation).toBe(true);

      // Name phonetic/romanized variants survive.
      expect(ivan.names[0]?.variants?.map((variant) => variant.kind)).toEqual(['phonetic', 'romanized']);

      // Associations (the @VOID@ one is skipped), aliases and ordinances.
      expect(repo.listAssociationsFor(ivan.id)).toHaveLength(1);
      expect(repo.listAliasesFor(ivan.id)).toHaveLength(1);
      const ordinances = repo.listOrdinancesFor('person', ivan.id).map((ordinance) => ordinance.kind);
      expect(ordinances).toContain('BAPL');

      // The family keeps its sealings; the SLGC with a FAMC targets the child link.
      const families = repo.listFamilies();
      const family = families[0]!;
      const familyOrdinances = repo.listOrdinancesFor('family', family.id).map((ordinance) => ordinance.kind).sort();
      expect(familyOrdinances).toEqual(['SLGC', 'SLGS']);

      // Submitter identifiers and notes.
      const submitter = repo.listSubmitters()[0]!;
      expect(repo.listIdentifiersFor('submitter', submitter.id).map((identifier) => identifier.namespace)).toEqual(['rin']);
      expect(repo.listNotesFor('submitter', submitter.id)).toHaveLength(1);

      // Tag without a name is skipped; the tag link to a missing tag is skipped.
      expect(repo.listTags()).toHaveLength(1);

      // Evidence with citations, notes and uids.
      const evidence = repo.listEvidence()[0]!;
      expect(evidence).toBeDefined();
      expect(repo.listIdentifiersFor('evidence', evidence.id).map((identifier) => identifier.value)).toEqual(['ev-uid']);

      // Free-standing todo with fields and uid.
      const todos = repo.listTodos();
      expect(todos).toHaveLength(1);
      expect(todos[0]).toMatchObject({ text: 'Order the record', category: 'records', locality: 'archive', priority: 'high', status: 'open' });
      expect(repo.listIdentifiersFor('todo', todos[0]!.id).map((identifier) => identifier.value)).toEqual(['todo-uid']);

      // The occurrence became one fact per participant.
      const facts = repo.listAllFacts();
      expect(facts.filter((fact) => fact.type === 'death')).toHaveLength(1);

      // The census imported only the entry with a known person.
      const census = repo.listCensuses()[0]!;
      expect(census.entries).toHaveLength(1);
      expect(census.entries[0]).toMatchObject({ ageValue: '17', maritalStatus: 'single', occupation: 'smith' });

      // The fact type record imported.
      expect(repo.listFactTypes()[0]).toMatchObject({ code: 'MILT', title: 'military service' });
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('maps calendars, place variants, family attachments and shared text places', () => {
    const result = parse(new TextEncoder().encode(EDGE_GEDCOM));
    if (!result.ok || result.value.kind !== 'dataset') {
      throw new Error(`edge fixture failed to parse: ${result.ok ? 'not a dataset' : result.error.message}`);
    }
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      importGedcomDataset(result.value.dataset, repo);

      const persons = repo.listAllPersons();
      const byXref = new Map(persons.map((person) => [person.xref, person]));
      const ivan = byXref.get('@I1@')!;

      // French Republican and Hebrew calendar dates, with the VEND month
      // kept as a string code.
      const birth = ivan.facts.find((fact) => fact.tag === 'BIRT')!;
      expect(birth.date).toMatchObject({
        quality: 'exact',
        component: { calendar: 'french_republican', year: 1, month: 'VEND', day: 3 },
      });
      const death = ivan.facts.find((fact) => fact.tag === 'DEAT')!;
      expect(death.date).toMatchObject({
        quality: 'exact',
        component: { calendar: 'hebrew', year: 5785, month: 'TSH', day: 1 },
      });

      // The place carries its variants; the bare second PLAC dropped.
      const birthPlace = repo.listPlaces().find((place) =>
        place.names.some((name) => name.value === 'Moscow'),
      )!;
      expect(birthPlace.names.map((name) => name.kind)).toEqual(
        expect.arrayContaining(['official', 'translation', 'phonetic', 'romanized']),
      );

      // The note kept its translation.
      const note = repo.listNotesFor('person', ivan.id)[0]!;
      expect(note.translations?.[0]).toMatchObject({ text: 'переведено', language: 'ru' });

      // The family tag link and attached todo imported.
      const family = repo.listFamilies()[0]!;
      expect(repo.listTagLinksFor('family', family.id)).toHaveLength(1);
      expect(repo.listTodosFor('family', family.id)).toHaveLength(1);

      // The shared text place "Moscow" is one row reused by both census entries.
      const census = repo.listCensuses()[0]!;
      expect(census.entries).toHaveLength(2);
      expect(census.entries[0]?.birthPlace).toBe('Moscow');
      expect(census.entries[1]?.birthPlace).toBe('Moscow');
    } finally {
      cleanupRepo(fixture);
    }
  });
});
