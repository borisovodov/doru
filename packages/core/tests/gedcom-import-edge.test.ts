import { describe, expect, it } from 'vitest';
import { parse, serializeGedcom70 } from '@doru/gedcom';
import { buildGedcomDataset } from '../src/export/gedcom';
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
  '1 _SKYPEID ivan.skype',
  '1 _JABBERID ivan@jabber.example',
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
  '1 SUBM @U1@',
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
  '0 @S1@ SOUR',
  '1 TITL The Book',
  '0 @N1@ SNOTE Shared note',
  '1 MIME text/plain',
  '1 LANG en',
  '1 TRAN translated',
  '2 MIME text/plain',
  '2 LANG ru',
  '0 @TD1@ _TODO Order the record',
  '1 _CAT records',
  '1 _LOCL archive',
  '1 _TPTY high',
  '1 _TSTS open',
  '1 _UID task-uid',
  '1 _CDATE 2026',
  '0 @O1@ _OCUR',
  '1 TYPE death',
  '1 DATE 1990',
  '1 PLAC Moscow, Russia',
  '1 _PART @I1@',
  '2 ROLE witness',
  '1 _PART @MISSING@',
  '0 @O2@ _OCUR',
  '0 @OB1@ OBJE',
  '0 @AL1@ _ALIA',
  '0 @PL1@ _PLAC Moscow, Russia',
  '0 @GR1@ _GRP',
  '0 @PB1@ _PUBLISH',
  '0 @MT1@ _MTTAG',
  '0 @MC1@ _MTCAT',
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
  '1 _TODO a family task',
  '2 PRTY high',
  '2 STAT open',
  '2 DATE 2026',
  '0 @T1@ _TAG',
  '1 NAME favorites',
  '0 TRLR',
].join('\n');

describe('importGedcomDataset edge coverage', () => {
  it('maps contacts, changes, links and vendor records', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      const result = importGedcomDataset(parseDataset(), repo);
      expect(result.droppedStructures).toBeGreaterThan(0);

      const persons = repo.listAllPersons();
      const ivan = persons.find((person) => person.names[0]?.given === 'Ivan')!;
      expect(ivan).toBeDefined();

      // INDI-level and fact-address contacts.
      const contactKinds = repo
        .listContactsFor('person', ivan.id)
        .map((contact) => contact.kind)
        .sort();
      expect(contactKinds).toEqual(['email', 'phone', 'phone', 'www']);

      const birth = ivan.facts.find((fact) => fact.tag === 'BIRT')!;
      const factKinds = repo
        .listContactsFor('fact', birth.id)
        .map((contact) => contact.kind)
        .sort();
      expect(factKinds).toEqual(['email', 'fax', 'phone', 'www']);
      if (birth.addressId !== undefined) {
        expect(repo.listContactsFor('address', birth.addressId)).toEqual([]);
      }

      // Submitter links.
      expect(repo.listSubmittersFor('person', ivan.id)).toHaveLength(1);

      // The negated fact keeps its citations and notes.
      const negation = ivan.facts.find((fact) => fact.tag === 'MARR')!;
      expect(negation.negation).toBe(true);

      // Name phonetic/romanized variants survive.
      expect(ivan.names[0]?.variants?.map((variant) => variant.kind)).toEqual(['phonetic', 'romanized']);

      // Associations (the @VOID@ one is skipped) and aliases.
      expect(repo.listAssociationsFor(ivan.id)).toHaveLength(1);
      expect(repo.listAliasesFor(ivan.id)).toHaveLength(1);

      // Submitter notes: RIN is ignored, only notes survive.
      const submitter = repo.listSubmitters()[0]!;
      expect(repo.listNotesFor('submitter', submitter.id)).toHaveLength(1);
      expect(
        repo
          .listContactsFor('submitter', submitter.id)
          .map((contact) => contact.kind)
          .sort(),
      ).toEqual(['jabber', 'skype']);

      // Free-standing task with fields. The parser keeps `_UID`, but the tree
      // drops it.
      const tasks = repo.listTasks();
      expect(tasks).toHaveLength(1);
      expect(tasks[0]).toMatchObject({
        text: 'Order the record',
        priority: 'high',
        status: 'open',
      });
      expect(tasks[0]).not.toHaveProperty('category');

      // The occurrence became one fact per participant.
      const facts = repo.listAllFacts();
      expect(facts.filter((fact) => fact.type === 'death')).toHaveLength(1);
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
      const ivan = persons.find((person) => person.names[0]?.given === 'Ivan')!;

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
      const birthPlace = repo.listPlaces().find((place) => place.names.some((name) => name.value === 'Moscow'))!;
      expect(birthPlace.names.map((name) => name.kind)).toEqual(
        expect.arrayContaining(['official', 'translation', 'phonetic', 'romanized']),
      );

      // @doru/gedcom parses NOTE.LANG/MIME/TRAN and the SNOTE xref, but the tree keeps text only.
      const note = repo.listNotesFor('person', ivan.id)[0]!;
      expect(note).not.toHaveProperty('language');
      expect(note).not.toHaveProperty('translations');
      expect(note).not.toHaveProperty('mime');
      expect(note).not.toHaveProperty('xref');

      // The attached task imported.
      const family = repo.listFamilies()[0]!;
      expect(repo.listTasksFor('family', family.id)).toHaveLength(1);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('ignores organisational tag records and never exports them', () => {
    const gedcom = [
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '0 @I1@ INDI',
      '1 NAME Ivan /Petrov/',
      '1 _TAG @T1@',
      '0 @T1@ _TAG',
      '1 NAME favorites',
      '1 _COLOR #00FF00',
      '0 TRLR',
    ].join('\n');
    const parsed = parse(new TextEncoder().encode(gedcom));
    if (!parsed.ok || parsed.value.kind !== 'dataset') {
      throw new Error('fixture failed to parse');
    }
    const fixture = makeRepo();
    try {
      const summary = importGedcomDataset(parsed.value.dataset, fixture.repo);
      expect(summary.droppedStructures).toBe(1);
      expect(fixture.repo.listAllPersons()).toHaveLength(1);

      const exported = buildGedcomDataset(fixture.repo);
      expect(exported.records.some((record) => record.tag === '_TAG')).toBe(false);
      const serialized = serializeGedcom70(exported);
      expect(serialized.ok).toBe(true);
      if (serialized.ok) {
        expect(serialized.value).not.toMatch(/^\d+ _TAG\b/m);
      }
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('drops the evidence, research, census and event-definition records', () => {
    const gedcom = [
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '0 @I1@ INDI',
      '1 NAME Ivan /Petrov/',
      '0 @E1@ _EVID',
      '1 _TYPE birth certificate',
      '0 @D1@ _RDOC',
      '1 TITL Notes',
      '1 TEXT body',
      '0 @A1@ _RACT',
      '1 _TYPE visit',
      '0 @C1@ _CENR',
      '1 DATE 1901',
      '1 PLAC Moscow',
      '1 INDI @I1@',
      '2 AGE 17y',
      '0 @V1@ _EVENT_DEFN MILT',
      '1 TITL military service',
      '0 TRLR',
    ].join('\n');
    const result = parse(new TextEncoder().encode(gedcom));
    if (!result.ok || result.value.kind !== 'dataset') {
      throw new Error('fixture failed to parse');
    }
    const fixture = makeRepo();
    try {
      const summary = importGedcomDataset(result.value.dataset, fixture.repo);
      // The five records are counted as deliberately dropped.
      expect(summary.droppedStructures).toBe(5);
      expect(fixture.repo.listAllPersons()).toHaveLength(1);
    } finally {
      cleanupRepo(fixture);
    }
  });
});
