import type { RepoFixture } from './helpers';

/**
 * A kitchen-sink tree: every entity kind with as many optional fields as
 * possible. Exporting and re-importing it exercises the GEDCOM builders and
 * the importer across the full model, not just the happy paths.
 */
export function buildKitchenSinkTree(fixture: RepoFixture): void {
  const repo = fixture.repo;

  // Places and addresses.
  repo.insertPlace({
    id: 'PL1',
    latitude: 55.7558,
    longitude: -37.6173,
    names: [
      { id: 'PN1', kind: 'official', position: 0, value: 'Moscow' },
      { id: 'PN2', kind: 'official', position: 1, value: 'Russia' },
      { id: 'PN3', kind: 'translation', language: 'en', position: 0, value: 'Moscow' },
    ],
  });
  repo.insertAddress({ id: 'AD1', lines: ['12 Archive Lane'], city: 'Moscow', state: 'Moscow Oblast', postalCode: '101000', country: 'Russia' });

  repo.insertPerson({ id: 'P2', xref: '@I8@', sex: 'F', names: [{ id: 'N4', given: 'Maria', surname: 'Ivanova' }], facts: [] });
  repo.insertPerson({ id: 'P3', sex: 'U', names: [], facts: [] });

  // Persons with rich names and facts.
  repo.insertPerson({
    id: 'P1',
    xref: '@I7@',
    sex: 'M',
    names: [
      {
        id: 'N1',
        type: 'birth',
        primary: true,
        given: 'Ivan',
        surname: 'Petrov',
        surnamePrefix: 'von',
        nickname: 'Vanya',
        prefix: 'Dr.',
        suffix: 'Jr.',
        parts: [
          { id: 'NP1', kind: 'prefix', value: 'Dr.', position: 0 },
          { id: 'NP2', kind: 'given', value: 'Ivan', position: 1 },
          { id: 'NP3', kind: 'surnamePrefix', value: 'von', position: 2 },
          { id: 'NP4', kind: 'surname', value: 'Petrov', position: 3 },
          { id: 'NP5', kind: 'suffix', value: 'Jr.', position: 4 },
        ],
        variants: [
          { id: 'NV1', kind: 'translation', language: 'ru', given: 'Иван', surname: 'Петров' },
          { id: 'NV2', kind: 'phonetic', language: 'en', given: 'Eevan' },
          { id: 'NV3', kind: 'romanized', language: 'en', given: 'Ivan', surname: 'Petrov' },
        ],
      },
      { id: 'N2', type: 'aka', given: 'Johnny' },
      { id: 'N3', type: 'custom-name-type', given: 'Zed' },
    ],
    facts: [
      {
        id: 'B1',
        personId: 'P1',
        tag: 'BIRT',
        date: { quality: 'exact', component: { year: 1923, month: 3, day: 12 }, time: { hour: 6, minute: 30 } },
        placeId: 'PL1',
        place: 'Moscow, Russia',
        addressId: 'AD1',
        agency: 'registry',
        religiousAffiliation: 'orthodox',
        cause: 'none',
        sentence: '{individual} was born',
        quality: '3',
        sortDate: { quality: 'exact', component: { year: 1923 } },
        ages: [{ id: 'AG1', years: 0 }],
        participants: [
          { id: 'PT1', personId: 'P2', role: 'witness', position: 0 },
          { id: 'PT2', value: 'a neighbour', position: 1 },
        ],
        flags: ['private', 'preferred'],
      },
      { id: 'O1', personId: 'P1', tag: 'OCCU', value: 'Engineer', type: 'main' },
      { id: 'X1', personId: 'P1', tag: '_MILT', value: '2nd regiment' },
      { id: 'E1', personId: 'P1', tag: 'EVEN', type: 'award', value: 'Order of Lenin' },
      { id: 'A1', personId: 'P1', tag: 'FACT', type: 'height', value: '180 cm' },
      { id: 'N1F', personId: 'P1', tag: 'MARR', negation: true, date: { quality: 'exact', component: { year: 1950 } } },
      { id: 'R1', personId: 'P1', tag: 'RESI', date: { quality: 'range', component: { year: 1900 }, end: { year: 1905 } } },
      { id: 'T1', personId: 'P1', tag: 'BURI', date: { quality: 'unknown', text: 'after the war' } },
      { id: 'J1', personId: 'P1', tag: 'CHR', date: { quality: 'about', modifier: 'CAL', component: { calendar: 'julian', year: 1826, month: 1, day: 3 } } },
      { id: 'B2', personId: 'P1', tag: 'DEAT', date: { quality: 'before', component: { year: 1990 } } },
    ],
  });

  // Family with links and facts.
  repo.insertFamily({
    id: 'F1',
    xref: '@F5@',
    partners: ['P1', 'P2'],
    children: ['P3'],
    partnerLinks: [
      { id: 'FP1', personId: 'P1', preferred: true, date: { quality: 'exact', component: { year: 1944 } } },
      { id: 'FP2', personId: 'P2' },
    ],
    childLinks: [
      { id: 'FC1', childId: 'P3', pedigree: 'adopted', pedigreePhrase: 'by decree', status: 'proven', fatherRelation: 'adoptive', motherRelation: 'birth' },
    ],
  });
  repo.insertFact({
    id: 'M1',
    familyId: 'F1',
    tag: 'MARR',
    date: { quality: 'exact', component: { year: 1945 } },
    place: 'Moscow',
    ages: [
      { id: 'MA1', role: 'HUSB', years: 22 },
      { id: 'MA2', role: 'WIFE', bound: '<', years: 20, phrase: 'about twenty' },
    ],
  });
  repo.insertFact({ id: 'FAM1', familyId: 'F1', tag: 'FACT', type: 'story', value: 'Met at the factory' });
  repo.insertFact({ id: 'FAM2', familyId: 'F1', tag: 'DIV', negation: true });

  // Sources, repositories, submitters, titles.
  repo.insertRepository({ id: 'RP1', xref: '@R1@', name: 'State Archive', addressId: 'AD1' });
  repo.insertSubmitter({ id: 'SU1', xref: '@U1@', name: 'Ivan Petrov', addressId: 'AD1', languages: ['ru', 'en'] });
  repo.insertTitle({
    id: 'TL1',
    xref: '@T1@',
    name: 'The Parish Registers',
    author: 'A. Author',
    publisher: 'Press House',
    series: 'Records',
    abbreviation: 'TPR',
    repositoryId: 'RP1',
    callNumber: 'VII-12',
    sequence: 3,
  });
  repo.insertSource({
    id: 'S1',
    xref: '@S9@',
    title: 'Parish register',
    abbreviation: 'PR',
    author: 'Church',
    publication: 'Diocese',
    medium: 'book',
    url: 'https://archive.example/reg',
    accessDate: '2025-01-01',
    confidence: 'high',
    pubDate: { quality: 'exact', component: { year: 1920 } },
    pubPlace: 'Moscow',
    agency: 'state',
    titleId: 'TL1',
    texts: [{ id: 'ST1', text: 'A note about the source', mime: 'text/plain', language: 'en' }],
    dataEvents: [{ id: 'SE1', tag: 'RECO', value: 'recorded', date: { quality: 'exact', component: { year: 1920 } }, placeId: 'PL1' }],
    repositories: [{ id: 'SR1', repositoryId: 'RP1', callNumbers: [{ id: 'SC1', value: 'VII-12', medium: 'book' }] }],
    templateFields: [
      { id: 'SF1', name: 'volume', value: '3' },
      { id: 'SF2', name: 'folio' },
    ],
  });

  // Citations with every detail.
  repo.insertCitation({
    id: 'C1',
    sourceId: 'S1',
    targetType: 'person',
    targetId: 'P1',
    description: 'entry 12',
    page: 'p. 5',
    quality: '3',
    confidence: 'high',
    event: 'BIRT',
    role: 'witness',
    phrase: 'as recorded',
    date: { quality: 'exact', component: { year: 1923 } },
    www: 'https://archive.example/page',
    texts: [{ id: 'CT1', text: 'citation text', mime: 'text/plain', language: 'en' }],
    templateFields: [{ id: 'CF1', name: 'entry', value: '12' }],
  });

  // Notes: inline and shared with translations.
  repo.insertNote({ id: 'NN1', text: 'inline note', mime: 'text/plain', language: 'en', targetType: 'person', targetId: 'P1' });
  repo.insertNote({
    id: 'NN2',
    xref: '@N2@',
    text: 'shared note',
    translations: [{ id: 'NT1', text: 'заметка', language: 'ru' }],
    links: [
      { id: 'NL1', targetType: 'person', targetId: 'P1' },
      { id: 'NL2', targetType: 'person', targetId: 'P2' },
    ],
  });

  // Media.
  repo.insertMedia({ id: 'M1', xref: '@M1@', path: 'media/photo.jpg', title: 'Portrait', targetType: 'person', targetId: 'P1' });

  // Identifiers, contacts, restrictions.
  repo.insertIdentifier({ id: 'I1', targetType: 'person', targetId: 'P1', namespace: 'uid', value: 'abc' });
  repo.insertIdentifier({ id: 'I2', targetType: 'person', targetId: 'P1', namespace: 'exid', value: 'xyz' });
  repo.insertIdentifier({ id: 'I3', targetType: 'person', targetId: 'P1', namespace: 'refn', value: '7' });
  repo.insertIdentifier({ id: 'I4', targetType: 'person', targetId: 'P1', namespace: 'custom', value: 'ignored' });
  repo.insertContact({ id: 'CT1', targetType: 'person', targetId: 'P1', kind: 'email', value: 'ivan@example.org' });
  repo.insertContact({ id: 'CT2', targetType: 'person', targetId: 'P1', kind: 'phone', value: '+7 000' });
  repo.insertContact({ id: 'CT3', targetType: 'person', targetId: 'P1', kind: 'fax', value: '+7 001' });
  repo.insertContact({ id: 'CT4', targetType: 'person', targetId: 'P1', kind: 'url', value: 'https://ivan.example' });
  repo.insertContact({ id: 'CT5', targetType: 'person', targetId: 'P1', kind: 'other', value: 'unused' });
  repo.insertRestriction({ id: 'R1', targetType: 'person', targetId: 'P1', level: 'confidential' });
  repo.insertRestriction({ id: 'R2', targetType: 'family', targetId: 'F1', level: 'locked' });

  // Changes.
  repo.insertChange({ id: 'CH1', targetType: 'person', targetId: 'P1', kind: 'created', date: { quality: 'exact', component: { year: 2026, month: 1, day: 2 } } });
  repo.insertChange({ id: 'CH2', targetType: 'person', targetId: 'P1', kind: 'changed', date: { quality: 'exact', component: { year: 2026, month: 3, day: 4 } }, user: 'ivan' });

  // Tags and tag links.
  repo.insertTag({ id: 'TG1', name: 'favorites' });
  repo.insertTagLink({ id: 'TL1', tagId: 'TG1', targetType: 'person', targetId: 'P1', date: { quality: 'exact', component: { year: 2026 } } });

  // Associations and aliases.
  repo.insertAssociation({
    id: 'AS1',
    personId: 'P1',
    otherPersonId: 'P2',
    role: 'witness',
    relationship: 'friend',
    phrase: 'knew him well',
    primary: true,
    specificType: 'comrade',
    confidence: 'high',
    periodStart: { quality: 'exact', component: { year: 1940 } },
    periodEnd: { quality: 'exact', component: { year: 1950 } },
  });
  repo.insertAssociation({ id: 'AS2', personId: 'P2', otherPersonId: 'P1', role: 'witness' });
  repo.insertAlias('AL1', 'P1', 'P3');

  // Ordinances on persons and the family.
  repo.insertOrdinance({
    id: 'OR1',
    kind: 'BAPL',
    targetType: 'person',
    targetId: 'P1',
    date: { quality: 'exact', component: { year: 1930 } },
    temple: 'Moscow',
    placeId: 'PL1',
    status: 'completed',
    statusDate: { quality: 'exact', component: { year: 1931 } },
  });
  repo.insertOrdinance({ id: 'OR2', kind: 'SLGS', targetType: 'family', targetId: 'F1', status: 'CANCELED' });
  repo.insertOrdinance({ id: 'OR3', kind: 'SLGC', targetType: 'family', targetId: 'F1', date: { quality: 'exact', component: { year: 1946 } } });

  // Todos: free-standing and attached.
  repo.insertTodo({ id: 'TD1', text: 'Order the birth record', category: 'records', locality: 'archive', priority: 'high', status: 'open', scheduledDate: { quality: 'exact', component: { year: 2026 } }, reminderDate: { quality: 'exact', component: { year: 2026, month: 2 } }, closedDate: { quality: 'exact', component: { year: 2026, month: 3 } } });
  repo.insertTodo({ id: 'TD2', text: 'Visit the cemetery', targetType: 'person', targetId: 'P1' });

  // Fact types.
  repo.insertFactType({ id: 'FT1', code: 'MILT', kind: 'event', title: 'military service', abbreviation: 'mil', sentence: '{individual} served', confidential: true });

  // Submitter links on a person.
  repo.insertRecordSubmitter('RS1', 'SU1', 'person', 'P1');
}
