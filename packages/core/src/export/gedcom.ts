import type {
  Calendar,
  ChangeDate,
  CreationDate,
  DateExact,
  DateExactStructure,
  DateFields,
  DateStructure,
  DateValue as GedcomDateValue,
  Epoch,
  EventDetail,
  AgeValue,
  ChildFamilyLink,
  FamilyAttributeStructure,
  FamilyChildLink,
  FamilyEventStructure,
  FamilyPartnerLink,
  FamilyRecord as GedcomFamilyRecord,
  GedcomDataset,
  GedcomMonth,
  GedcomRecord,
  IdentifierStructure,
  IndividualAttributeStructure,
  IndividualEventStructure,
  IndividualRecord,
  LdsIndividualOrdinance,
  ListEnum,
  NameTranslation,
  NameTypeStructure,
  NonEventStructure,
  NoteStructure,
  PersonalNamePieces,
  PersonalNameStructure,
  PhoneticNameVariation,
  PlaceStructure,
  QualityEnum,
  RestrictionEnum,
  SourceCitation,
  SourceRecord as GedcomSourceRecord,
  SpouseFamilyLink,
  PedigreeEnum,
} from '@doru/gedcom';
import type { TreeRepository } from '../db/repository';
import type {
  AssociationRecord,
  DateComponent,
  DateValue,
  FactRecord,
  FamilyRecord,
  NoteRecord,
  OrdinanceRecord,
  PersonName,
  PersonRecord,
  PlaceRecord,
  SourceRecord,
  TagRecord,
  TodoRecord,
} from '../model/types';

/**
 * Tree → GEDCOM dataset mapping, the mirror of `import/gedcom.ts`. The
 * exporter is a projection like the serializers it feeds: what the GEDCOM
 * model cannot express is dropped or mapped to the closest equivalent,
 * documented inline. The exported header always declares GEDCOM 7.0; the
 * serializers decide the wire form from there.
 */

const INDIVIDUAL_EVENT_TAGS = new Set([
  'ADOP', 'BAPM', 'BARM', 'BASM', 'BIRT', 'BLES', 'BURI', 'CENS', 'CHR', 'CHRA',
  'CONF', 'CREM', 'DEAT', 'EMIG', 'FCOM', 'GRAD', 'IMMI', 'NATU', 'ORDN', 'PROB',
  'RETI', 'WILL',
]);

const FAMILY_EVENT_TAGS = new Set(['ANUL', 'DIV', 'DIVF', 'ENGA', 'MARB', 'MARC', 'MARL', 'MARR', 'MARS']);

const INDIVIDUAL_ATTRIBUTE_TAGS = new Set([
  'CAST', 'DSCR', 'EDUC', 'IDNO', 'NATI', 'NCHI', 'NMR', 'OCCU', 'PROP', 'RELI',
  'RESI', 'SSN', 'TITL',
]);

const FAMILY_ATTRIBUTE_TAGS = new Set(['NCHI', 'RESI']);

const NAME_TYPE_CODES: Record<string, string> = {
  aka: 'AKA',
  birth: 'BIRTH',
  immigrant: 'IMMIGRANT',
  maiden: 'MAIDEN',
  married: 'MARRIED',
  professional: 'PROFESSIONAL',
  other: 'OTHER',
};

const MONTH_CODES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** Builds the GEDCOM dataset for the whole tree, assigning fresh xrefs to records without one. */
export function buildGedcomDataset(repo: TreeRepository): GedcomDataset {
  const xrefs = new Xrefs();
  const persons = repo.listAllPersons();
  const families = repo.listFamilies();
  const sources = repo.listSources();
  const repositories = repo.listRepositories();
  const submitters = repo.listSubmitters();
  const titles = repo.listTitles();
  const notes = repo.listNotes().filter((note): note is NoteRecord & { xref: string } => note.xref !== undefined);
  const censuses = repo.listCensuses();
  const todos = repo.listTodos().filter((todo) => todo.targetType === undefined && todo.targetId === undefined);
  const factTypes = repo.listFactTypes();
  const tags = repo.listTags();

  for (const person of persons) {
    xrefs.assign('I', person.id, person.xref);
  }
  for (const family of families) {
    xrefs.assign('F', family.id, family.xref);
  }
  for (const source of sources) {
    xrefs.assign('S', source.id, source.xref);
  }
  for (const repository of repositories) {
    xrefs.assign('R', repository.id, repository.xref);
  }
  for (const submitter of submitters) {
    xrefs.assign('U', submitter.id, submitter.xref);
  }
  for (const title of titles) {
    xrefs.assign('T', title.id, title.xref);
  }
  for (const note of notes) {
    xrefs.assign('N', note.id, note.xref);
  }
  for (const tag of tags) {
    xrefs.assign('TAG', tag.id, undefined);
  }

  const records: GedcomRecord[] = [
    ...submitters.map((submitter) => buildSubmitter(submitter, repo, xrefs)),
    ...repositories.map((repository) => buildRepository(repository, repo, xrefs)),
    ...titles.map((title) => buildTitle(title, repo, xrefs)),
    ...sources.map((source) => buildSource(source, repo, xrefs)),
    ...notes.map((note) => buildSharedNote(note)),
    ...persons.map((person) => buildPerson(person, repo, xrefs)),
    ...families.map((family) => buildFamily(family, repo, xrefs)),
    ...censuses
      .map((census) => buildCensus(census, repo, xrefs))
      .filter((record): record is GedcomRecord => record !== undefined),
    ...todos.map((todo) => buildTodoRecord(todo)),
    ...factTypes.map((type) => buildFactType(type)),
    ...tags.map((tag) => buildTagRecord(tag)),
    ...buildAssociations(repo, xrefs),
    ...buildOrdinances(repo, xrefs),
  ];
  // The schema keeps no header table: the export synthesizes a fresh
  // GEDCOM header naming this app as the source.
  return {
    header: {
      tag: 'HEAD',
      gedcom: { version: '7.0' },
      source: { payload: 'DORU' },
      ...(submitters.length > 0 ? { submitter: xrefs.of(submitters[0]!.id) } : {}),
    },
    records,
    trailer: { tag: 'TRLR' },
  };
}

// ---------------------------------------------------------------------------
// Persons
// ---------------------------------------------------------------------------

function buildPerson(person: PersonRecord, repo: TreeRepository, xrefs: Xrefs): IndividualRecord {
  const events: IndividualEventStructure[] = [];
  const attributes: IndividualAttributeStructure[] = [];
  const nonEvents: NonEventStructure[] = [];
  for (const fact of person.facts) {
    if (fact.negation === true) {
      nonEvents.push({
        tag: 'NO',
        payload: fact.tag as NonEventStructure['payload'],
        ...(fact.date !== undefined ? { date: buildDatePeriod(fact.date) } : {}),
        ...(withCitationList(repo, 'fact', fact.id, xrefs).citations.length > 0 ? withCitationList(repo, 'fact', fact.id, xrefs) : {}),
        ...withNoteList(repo, 'fact', fact.id, xrefs),
      });
      continue;
    }
    const mapped = buildPersonFact(fact, repo, xrefs);
    if (mapped.kind === 'event') {
      events.push(mapped.structure);
    } else {
      attributes.push(mapped.structure);
    }
  }
  const identifiers = withIdentifiers(repo, 'person', person.id);
  const contacts = withContacts(repo, 'person', person.id);
  const restriction = repo.listRestrictionsFor('person', person.id).map((entry) => entry.level.toUpperCase()) as ListEnum<RestrictionEnum>;
  const changes = withChanges(repo, 'person', person.id);
  return {
    tag: 'INDI',
    xref: xrefs.of(person.id),
    sex: person.sex,
    names: person.names.map((name) => buildName(name, repo, xrefs)),
    ...(events.length > 0 ? { events } : {}),
    ...(attributes.length > 0 ? { attributes } : {}),
    ...(nonEvents.length > 0 ? { nonEvents } : {}),
    ...(identifiers.length > 0 ? { identifiers } : {}),
    ...(restriction.length > 0 ? { restriction } : {}),
    ...changes,
    ...contacts,
    ...withCitationList(repo, 'person', person.id, xrefs),
    ...withNoteList(repo, 'person', person.id, xrefs),
    ...withSubmitterLinks(repo, 'person', person.id, xrefs),
    ...withTagLinks(repo, 'person', person.id, xrefs),
    ...withTodoStructures(repo, 'person', person.id),
    ...withAssociations(repo, person.id, xrefs),
    ...withAliases(repo, person.id, xrefs),
    ...withPersonOrdinances(repo, person.id, xrefs),
    ...withChildFamilies(repo, person.id, xrefs),
    ...withSpouseFamilies(repo, person.id, xrefs),
  };
}

type MappedPersonFact =
  | { kind: 'event'; structure: IndividualEventStructure }
  | { kind: 'attribute'; structure: IndividualAttributeStructure };

type MappedFamilyFact =
  | { kind: 'event'; structure: FamilyEventStructure }
  | { kind: 'attribute'; structure: FamilyAttributeStructure };

/**
 * A fact becomes the typed event/attribute of its tag; unknown tags (vendor
 * extensions, custom kinds) become a generic EVEN whose TYPE carries the
 * original tag — a documented lossy projection.
 */
function buildPersonFact(fact: FactRecord, repo: TreeRepository, xrefs: Xrefs): MappedPersonFact {
  const detail = buildDetail(fact, repo, xrefs);
  if (fact.tag === 'EVEN' || (!INDIVIDUAL_EVENT_TAGS.has(fact.tag) && !INDIVIDUAL_ATTRIBUTE_TAGS.has(fact.tag))) {
    return {
      kind: 'event',
      structure: {
        tag: 'EVEN',
        payload: fact.value ?? '',
        type: fact.type ?? fact.tag,
        ...(detail !== undefined ? { detail } : {}),
      } as IndividualEventStructure,
    };
  }
  if (fact.tag === 'FACT' || INDIVIDUAL_ATTRIBUTE_TAGS.has(fact.tag)) {
    return {
      kind: 'attribute',
      structure: {
        tag: fact.tag as IndividualAttributeStructure['tag'],
        payload: fact.value ?? '',
        ...(fact.type !== undefined ? { type: fact.type } : {}),
        ...(detail !== undefined ? { detail } : {}),
      } as IndividualAttributeStructure,
    };
  }
  return {
    kind: 'event',
    structure: {
      tag: fact.tag as IndividualEventStructure['tag'],
      ...(fact.value !== undefined ? { payload: fact.value } : {}),
      ...(fact.type !== undefined ? { type: fact.type } : {}),
      ...(detail !== undefined ? { detail } : {}),
    } as IndividualEventStructure,
  };
}

function buildName(name: PersonName, repo: TreeRepository, xrefs: Xrefs): PersonalNameStructure {
  const pieces = piecesFromName(name);
  const variantStructures = name.variants ?? [];
  return {
    tag: 'NAME',
    payload: {
      ...(name.given !== undefined ? { given: name.given } : {}),
      ...(name.surname !== undefined ? { surname: name.surname } : {}),
      ...(name.suffix !== undefined ? { suffix: name.suffix } : {}),
    },
    ...(name.type !== undefined ? { type: mapNameType(name.type) } : {}),
    pieces,
    ...(name.primary === true ? { primary: true } : {}),
    ...(variantStructures.filter((variant) => variant.kind === 'translation').length > 0
      ? { translations: variantStructures.filter((variant) => variant.kind === 'translation').map(buildNameTranslation) }
      : {}),
    ...(variantStructures.filter((variant) => variant.kind === 'phonetic').length > 0
      ? { phonetic: variantStructures.filter((variant) => variant.kind === 'phonetic').map(buildNameVariation) }
      : {}),
    ...(variantStructures.filter((variant) => variant.kind === 'romanized').length > 0
      ? { romanized: variantStructures.filter((variant) => variant.kind === 'romanized').map(buildNameVariation) }
      : {}),
    ...withCitationList(repo, 'name', name.id, xrefs),
    ...withNoteList(repo, 'name', name.id, xrefs),
  };
}

function piecesFromName(name: PersonName): PersonalNamePieces {
  const values = (kind: string): string[] =>
    (name.parts ?? []).filter((part) => part.kind === kind).map((part) => part.value);
  const pieces = {
    ...(values('prefix').length > 0 ? { namePrefixes: values('prefix') } : {}),
    ...(values('given').length > 0 ? { givenNames: values('given') } : {}),
    ...(values('nickname').length > 0 ? { nicknames: values('nickname') } : {}),
    ...(values('surnamePrefix').length > 0 ? { surnamePrefixes: values('surnamePrefix') } : {}),
    ...(values('surname').length > 0 ? { surnames: values('surname') } : {}),
    ...(values('suffix').length > 0 ? { nameSuffixes: values('suffix') } : {}),
  };
  return pieces;
}

function buildNameTranslation(variant: PersonName): NameTranslation {
  const pieces = piecesFromName(variant);
  return {
    payload: {
      ...(variant.given !== undefined ? { given: variant.given } : {}),
      ...(variant.surname !== undefined ? { surname: variant.surname } : {}),
    },
    ...(variant.language !== undefined ? { language: variant.language } : {}),
    ...(Object.keys(pieces).length > 0 ? { pieces } : {}),
  } as NameTranslation;
}

function buildNameVariation(variant: PersonName): PhoneticNameVariation {
  const pieces = piecesFromName(variant);
  return {
    payload: {
      ...(variant.given !== undefined ? { given: variant.given } : {}),
      ...(variant.surname !== undefined ? { surname: variant.surname } : {}),
    },
    ...(variant.type !== undefined ? { type: variant.type } : {}),
    ...(Object.keys(pieces).length > 0 ? { pieces } : {}),
  } as PhoneticNameVariation;
}

function mapNameType(type: string): NameTypeStructure {
  const code = NAME_TYPE_CODES[type.toLowerCase()];
  if (code !== undefined) {
    return { payload: code } as NameTypeStructure;
  }
  return { payload: 'OTHER', phrase: type };
}

// ---------------------------------------------------------------------------
// Families
// ---------------------------------------------------------------------------

function buildFamily(family: FamilyRecord, repo: TreeRepository, xrefs: Xrefs): GedcomFamilyRecord {
  const partnerLinks = family.partnerLinks ?? [];
  const [first, second] = partnerLinks;
  // The GEDCOM model has exactly two partner slots (HUSB/WIFE in both
  // versions); families with more partners export the first two.
  const husband: FamilyPartnerLink | undefined =
    first !== undefined
      ? ({ partner: xrefs.of(first.personId), ...(first.preferred === true ? { preferred: true } : {}) } as FamilyPartnerLink)
      : undefined;
  const wife: FamilyPartnerLink | undefined =
    second !== undefined
      ? ({ partner: xrefs.of(second.personId), ...(second.preferred === true ? { preferred: true } : {}) } as FamilyPartnerLink)
      : undefined;
  const childLinks = family.childLinks ?? [];
  const children = childLinks.map((link) => ({
    child: xrefs.of(link.childId),
    ...(link.fatherRelation !== undefined ? { fatherRelation: link.fatherRelation } : {}),
    ...(link.motherRelation !== undefined ? { motherRelation: link.motherRelation } : {}),
  }) as FamilyChildLink);
  const events: FamilyEventStructure[] = [];
  const attributes: FamilyAttributeStructure[] = [];
  const nonEvents: NonEventStructure[] = [];
  for (const fact of repo.listFactsForFamily(family.id)) {
    if (fact.negation === true) {
      nonEvents.push({
        tag: 'NO',
        payload: fact.tag as NonEventStructure['payload'],
        ...(fact.date !== undefined ? { date: buildDatePeriod(fact.date) } : {}),
      });
      continue;
    }
    const mapped = buildFamilyFact(fact, repo, xrefs);
    if (mapped.kind === 'event') {
      events.push(mapped.structure);
    } else {
      attributes.push(mapped.structure);
    }
  }
  const identifiers = withIdentifiers(repo, 'family', family.id);
  const restriction = repo.listRestrictionsFor('family', family.id).map((entry) => entry.level.toUpperCase()) as ListEnum<RestrictionEnum>;
  const ordinances = repo.listOrdinancesFor('family', family.id);
  return {
    tag: 'FAM',
    xref: xrefs.of(family.id),
    ...(husband !== undefined ? { husband } : {}),
    ...(wife !== undefined ? { wife } : {}),
    ...(children.length > 0 ? { children } : {}),
    ...(events.length > 0 ? { events } : {}),
    ...(attributes.length > 0 ? { attributes } : {}),
    ...(nonEvents.length > 0 ? { nonEvents } : {}),
    ...(identifiers.length > 0 ? { identifiers } : {}),
    ...(restriction.length > 0 ? { restriction } : {}),
    ...withChanges(repo, 'family', family.id),
    ...withCitationList(repo, 'family', family.id, xrefs),
    ...withNoteList(repo, 'family', family.id, xrefs),
    ...withSubmitterLinks(repo, 'family', family.id, xrefs),
    ...withTagLinks(repo, 'family', family.id, xrefs),
    ...withTodoStructures(repo, 'family', family.id),
    ...(ordinances.filter((ordinance) => ordinance.kind === 'SLGS').length > 0
      ? { spouseSealings: ordinances.filter((ordinance) => ordinance.kind === 'SLGS').map((ordinance) => buildSpouseSealing(ordinance, repo, xrefs)) }
      : {}),
    ...(ordinances.filter((ordinance) => ordinance.kind === 'SLGC').length > 0
      ? { childSealings: ordinances.filter((ordinance) => ordinance.kind === 'SLGC').map((ordinance) => buildChildSealing(ordinance, repo, xrefs)) }
      : {}),
  };
}

function buildFamilyFact(fact: FactRecord, repo: TreeRepository, xrefs: Xrefs): MappedFamilyFact {
  const detail = buildDetail(fact, repo, xrefs);
  const husbandAge = fact.ages?.find((age) => age.role === 'HUSB');
  const wifeAge = fact.ages?.find((age) => age.role === 'WIFE');
  // FamilyEventDetail nests the shared EventDetail and the per-partner ages.
  const familyDetail =
    detail !== undefined || husbandAge !== undefined || wifeAge !== undefined
      ? {
          detail: {
            ...(detail !== undefined ? detail : {}),
            ...(husbandAge !== undefined ? { husband: { age: buildAge(husbandAge) } } : {}),
            ...(wifeAge !== undefined ? { wife: { age: buildAge(wifeAge) } } : {}),
          },
        }
      : {};
  if (fact.tag === 'EVEN' || (!FAMILY_EVENT_TAGS.has(fact.tag) && !FAMILY_ATTRIBUTE_TAGS.has(fact.tag))) {
    return {
      kind: 'event',
      structure: {
        tag: 'EVEN',
        payload: fact.value ?? '',
        type: fact.type ?? fact.tag,
        ...familyDetail,
      } as FamilyEventStructure,
    };
  }
  if (fact.tag === 'FACT' || FAMILY_ATTRIBUTE_TAGS.has(fact.tag)) {
    return {
      kind: 'attribute',
      structure: {
        tag: fact.tag as FamilyAttributeStructure['tag'],
        payload: fact.value ?? '',
        ...(fact.type !== undefined ? { type: fact.type } : {}),
        ...familyDetail,
      } as FamilyAttributeStructure,
    };
  }
  return {
    kind: 'event',
    structure: {
      tag: fact.tag as FamilyEventStructure['tag'],
      ...(fact.value !== undefined ? { payload: fact.value } : {}),
      ...(fact.type !== undefined ? { type: fact.type } : {}),
      ...familyDetail,
    } as FamilyEventStructure,
  };
}

// ---------------------------------------------------------------------------
// Registries and records
// ---------------------------------------------------------------------------

function buildRepository(repository: import('../model/types').RepositoryRecord, repo: TreeRepository, xrefs: Xrefs): GedcomRecord {
  const address = repository.addressId !== undefined ? repo.getAddress(repository.addressId) : undefined;
  const record = {
    tag: 'REPO',
    xref: xrefs.of(repository.id),
    name: repository.name,
    ...(address !== undefined ? { address: buildAddress(address) } : {}),
    ...withIdentifiers(repo, 'repository', repository.id).length > 0
      ? { identifiers: withIdentifiers(repo, 'repository', repository.id) }
      : {},
    ...withNoteList(repo, 'repository', repository.id, xrefs),
  } as GedcomRecord;
  return record;
}

function buildSubmitter(submitter: import('../model/types').SubmitterRecord, repo: TreeRepository, xrefs: Xrefs): GedcomRecord {
  const address = submitter.addressId !== undefined ? repo.getAddress(submitter.addressId) : undefined;
  return {
    tag: 'SUBM',
    xref: xrefs.of(submitter.id),
    name: submitter.name,
    ...(address !== undefined ? { address: buildAddress(address) } : {}),
    ...(submitter.languages !== undefined && submitter.languages.length > 0 ? { languages: submitter.languages } : {}),
    ...withNoteList(repo, 'submitter', submitter.id, xrefs),
  } as GedcomRecord;
}

function buildTitle(title: import('../model/types').TitleRecord, repo: TreeRepository, xrefs: Xrefs): GedcomRecord {
  return {
    tag: 'TITL',
    xref: xrefs.of(title.id),
    ...(title.name !== undefined ? { payload: title.name } : {}),
    ...(title.author !== undefined ? { author: title.author } : {}),
    ...(title.publisher !== undefined ? { publisher: title.publisher } : {}),
    ...(title.series !== undefined ? { series: title.series } : {}),
    ...(title.abbreviation !== undefined ? { abbreviation: title.abbreviation } : {}),
    ...(title.repositoryId !== undefined ? { repository: xrefs.of(title.repositoryId) } : {}),
    ...(title.callNumber !== undefined ? { callNumber: title.callNumber } : {}),
    ...(title.sequence !== undefined ? { sequenceNumber: String(title.sequence) } : {}),
    ...withNoteList(repo, 'title', title.id, xrefs),
  } as GedcomRecord;
}

function buildSharedNote(note: NoteRecord): GedcomRecord {
  return {
    tag: 'SNOTE',
    xref: note.xref,
    payload: note.text,
    ...(note.mime !== undefined ? { mediaType: note.mime } : {}),
    ...(note.language !== undefined ? { language: note.language } : {}),
    ...(note.translations !== undefined && note.translations.length > 0
      ? { translations: note.translations.map((translation) => ({ tag: 'TRAN', payload: translation.text, ...(translation.mime !== undefined ? { mediaType: translation.mime } : {}), ...(translation.language !== undefined ? { language: translation.language } : {}) })) }
      : {}),
  } as GedcomRecord;
}

function buildCensus(census: import('../model/types').CensusRecord, repo: TreeRepository, xrefs: Xrefs): GedcomRecord | undefined {
  // The census record requires a date and a place; export only complete ones.
  if (census.date === undefined) {
    return undefined;
  }
  const place = census.placeId !== undefined ? repo.getPlace(census.placeId) : undefined;
  return {
    tag: '_CENR',
    ...(census.schedule !== undefined ? { schedule: census.schedule } : {}),
    date: buildDate(census.date)!,
    place: place !== undefined ? placeNameOf(place) : '',
    ...(census.entries.length > 0
      ? {
          entries: census.entries.map((entry) => ({
            tag: 'INDI',
            individual: xrefs.of(entry.personId),
            ...(entry.sex !== undefined ? { sex: entry.sex } : {}),
            ...(entry.ageValue !== undefined ? { age: { payload: ageValuePayload(entry.ageValue) } } : {}),
            ...(entry.maritalStatus !== undefined ? { maritalStatus: entry.maritalStatus } : {}),
            ...(entry.occupation !== undefined ? { occupation: { tag: 'OCCU', payload: entry.occupation } } : {}),
            ...(entry.birthDate !== undefined ? { birth: { tag: 'BIRT', detail: { ...(entry.birthPlace !== undefined ? { place: { tag: 'PLAC', payload: [entry.birthPlace] } } : {}) } } } : {}),
          })),
        }
      : {}),
  } as GedcomRecord;
}

function ageValuePayload(value: string): AgeValue {
  const parsed = Number(value);
  if (Number.isFinite(parsed)) {
    return { years: parsed };
  }
  return { description: value as AgeValue['description'] } as AgeValue;
}

function buildTodoRecord(todo: TodoRecord): GedcomRecord {
  return {
    tag: '_TODO',
    payload: todo.text,
    ...(todo.category !== undefined ? { category: todo.category } : {}),
    ...(todo.locality !== undefined ? { locality: todo.locality } : {}),
    ...(todo.priority !== undefined ? { priority: todo.priority } : {}),
    ...(todo.status !== undefined ? { status: todo.status } : {}),
  } as GedcomRecord;
}

function buildFactType(type: import('../model/types').FactTypeRecord): GedcomRecord {
  return {
    tag: '_EVENT_DEFN',
    ...(type.code !== undefined ? { eventType: type.code } : {}),
    ...(type.kind !== undefined ? { kind: type.kind } : {}),
    ...(type.title !== undefined ? { title: type.title } : {}),
    ...(type.abbreviation !== undefined ? { abbreviation: type.abbreviation } : {}),
    ...(type.sentence !== undefined ? { sentence: type.sentence } : {}),
    ...(type.confidential === true ? { confidentialFlag: true } : {}),
  } as GedcomRecord;
}

function buildTagRecord(tag: TagRecord): GedcomRecord {
  return { tag: '_TAG', name: tag.name } as GedcomRecord;
}


// ---------------------------------------------------------------------------
// Relations exported as records
// ---------------------------------------------------------------------------

function buildAssociations(repo: TreeRepository, xrefs: Xrefs): GedcomRecord[] {
  // Associations live under INDI; nothing to export at the top level.
  void repo;
  void xrefs;
  return [];
}

function buildOrdinances(repo: TreeRepository, xrefs: Xrefs): GedcomRecord[] {
  // Ordinances live under INDI/FAM; nothing to export at the top level.
  void repo;
  void xrefs;
  return [];
}

// ---------------------------------------------------------------------------
// Person-level relation helpers
// ---------------------------------------------------------------------------

function withAssociations(repo: TreeRepository, personId: string, xrefs: Xrefs): { associations?: import('@doru/gedcom').AssociationStructure[] } {
  const associations = repo
    .listAssociationsFor(personId)
    .filter((association) => association.personId === personId)
    .map((association) => buildAssociation(association, repo, xrefs));
  return associations.length > 0 ? { associations } : {};
}

function buildAssociation(
  association: AssociationRecord,
  repo: TreeRepository,
  xrefs: Xrefs,
): import('@doru/gedcom').AssociationStructure {
  return {
    tag: 'ASSO',
    individual: xrefs.of(association.otherPersonId),
    ...(association.role !== undefined ? { role: { payload: association.role.toUpperCase() as import('@doru/gedcom').RoleEnum } } : {}),
    ...(association.relationship !== undefined ? { relationship: association.relationship } : {}),
    ...(association.phrase !== undefined ? { phrase: association.phrase } : {}),
    ...(association.primary === true ? { primary: true } : {}),
    ...(association.specificType !== undefined ? { specificType: association.specificType } : {}),
    ...(association.confidence !== undefined ? { confidence: association.confidence } : {}),
    ...(association.periodStart !== undefined || association.periodEnd !== undefined
      ? {
          period: {
            tag: '_PERIOD',
            ...(association.periodStart !== undefined ? { start: buildDate(association.periodStart) } : {}),
            ...(association.periodEnd !== undefined ? { end: buildDate(association.periodEnd) } : {}),
          },
        }
      : {}),
    ...withCitationList(repo, 'association', association.id, xrefs),
    ...withNoteList(repo, 'association', association.id, xrefs),
  } as import('@doru/gedcom').AssociationStructure;
}

function withAliases(repo: TreeRepository, personId: string, xrefs: Xrefs): { aliases?: Array<{ tag: 'ALIA'; individual: string }> } {
  const aliases = repo
    .listAliasesFor(personId)
    .map((alias) => ({ tag: 'ALIA' as const, individual: xrefs.of(alias.aliasId) }));
  return aliases.length > 0 ? { aliases } : {};
}

function withPersonOrdinances(repo: TreeRepository, personId: string, xrefs: Xrefs): { ordinances?: LdsIndividualOrdinance[] } {
  const ordinances = repo
    .listOrdinancesFor('person', personId)
    .filter((ordinance) => ordinance.kind !== 'SLGC' && ordinance.kind !== 'SLGS')
    .map((ordinance) => buildIndividualOrdinance(ordinance, repo, xrefs));
  return ordinances.length > 0 ? { ordinances } : {};
}

function buildIndividualOrdinance(
  ordinance: OrdinanceRecord,
  repo: TreeRepository,
  xrefs: Xrefs,
): LdsIndividualOrdinance {
  return {
    tag: ordinance.kind as LdsIndividualOrdinance['tag'],
    ...(buildOrdinanceDetail(ordinance, repo, xrefs) !== undefined
      ? { detail: buildOrdinanceDetail(ordinance, repo, xrefs) }
      : {}),
  } as LdsIndividualOrdinance;
}

function buildSpouseSealing(ordinance: OrdinanceRecord, repo: TreeRepository, xrefs: Xrefs): import('@doru/gedcom').SpouseSealingOrdinance {
  const detail = buildOrdinanceDetail(ordinance, repo, xrefs);
  return { tag: 'SLGS', ...(detail !== undefined ? { detail } : {}) } as import('@doru/gedcom').SpouseSealingOrdinance;
}

function buildChildSealing(ordinance: OrdinanceRecord, repo: TreeRepository, xrefs: Xrefs): import('@doru/gedcom').ChildSealingOrdinance {
  const detail = buildOrdinanceDetail(ordinance, repo, xrefs);
  return { tag: 'SLGC', ...(detail !== undefined ? { detail } : {}) } as import('@doru/gedcom').ChildSealingOrdinance;
}

function buildOrdinanceDetail(
  ordinance: OrdinanceRecord,
  repo: TreeRepository,
  xrefs: Xrefs,
): import('@doru/gedcom').LdsOrdinanceDetail | undefined {
  const date = buildDate(ordinance.date);
  const place = ordinance.placeId !== undefined ? buildPlace(repo, ordinance.placeId) : undefined;
  const statusDate = ordinance.statusDate !== undefined ? buildDateExactStructure(ordinance.statusDate) : undefined;
  if (date === undefined && ordinance.temple === undefined && place === undefined && ordinance.status === undefined) {
    return undefined;
  }
  return {
    ...(date !== undefined ? { date } : {}),
    ...(ordinance.temple !== undefined ? { temple: ordinance.temple } : {}),
    ...(place !== undefined ? { place } : {}),
    ...(ordinance.status !== undefined
      ? { status: { payload: ordinance.status.toUpperCase() as import('@doru/gedcom').OrdinanceStatusEnum, ...(statusDate !== undefined ? { date: statusDate } : {}) } }
      : {}),
    ...withCitationList(repo, 'ordinance', ordinance.id, xrefs),
    ...withNoteList(repo, 'ordinance', ordinance.id, xrefs),
  };
}

function withChildFamilies(repo: TreeRepository, personId: string, xrefs: Xrefs): { childFamilies?: ChildFamilyLink[] } {
  const links: ChildFamilyLink[] = [];
  for (const family of repo.listFamiliesForPerson(personId)) {
    const link = family.childLinks?.find((entry) => entry.childId === personId);
    if (link === undefined) {
      continue;
    }
    links.push({
      family: xrefs.of(family.id),
      ...(link.pedigree !== undefined
        ? { pedigree: { payload: link.pedigree.toUpperCase() as PedigreeEnum, ...(link.pedigreePhrase !== undefined ? { phrase: link.pedigreePhrase } : {}) } }
        : {}),
      ...(link.status !== undefined ? { status: { payload: link.status.toUpperCase() as import('@doru/gedcom').FamilyChildStatusEnum } } : {}),
      ...(link.fatherRelation !== undefined ? { fatherRelation: link.fatherRelation } : {}),
      ...(link.motherRelation !== undefined ? { motherRelation: link.motherRelation } : {}),
    } as ChildFamilyLink);
  }
  return links.length > 0 ? { childFamilies: links } : {};
}

function withSpouseFamilies(repo: TreeRepository, personId: string, xrefs: Xrefs): { spouseFamilies?: SpouseFamilyLink[] } {
  const links: SpouseFamilyLink[] = [];
  for (const family of repo.listFamiliesForPerson(personId)) {
    const link = family.partnerLinks?.find((entry) => entry.personId === personId);
    if (link === undefined) {
      continue;
    }
    links.push({
      family: xrefs.of(family.id),
      ...(link.date !== undefined ? { date: buildDate(link.date) } : {}),
    } as SpouseFamilyLink);
  }
  return links.length > 0 ? { spouseFamilies: links } : {};
}

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

function withIdentifiers(
  repo: TreeRepository,
  targetType: string,
  targetId: string,
): import('@doru/gedcom').IdentifierStructure[] {
  return repo
    .listIdentifiersFor(targetType, targetId)
    .filter((identifier) => identifier.namespace === 'uid' || identifier.namespace === 'exid' || identifier.namespace === 'refn')
    .map(
      (identifier) =>
        ({ tag: identifier.namespace.toUpperCase(), payload: identifier.value }) as IdentifierStructure,
    );
}

function withContacts(
  repo: TreeRepository,
  targetType: string,
  targetId: string,
): { email?: string[]; phone?: string[]; fax?: string[]; url?: string } {
  const contacts = repo.listContactsFor(targetType, targetId);
  const ofKind = (kind: string): string[] => contacts.filter((contact) => contact.kind === kind).map((contact) => contact.value);
  return {
    ...(ofKind('email').length > 0 ? { email: ofKind('email') } : {}),
    ...(ofKind('phone').length > 0 ? { phone: ofKind('phone') } : {}),
    ...(ofKind('fax').length > 0 ? { fax: ofKind('fax') } : {}),
    ...(ofKind('url').length > 0 ? { url: ofKind('url')[0] } : {}),
  };
}

function withChanges(repo: TreeRepository, targetType: string, targetId: string): { changeDate?: ChangeDate; creationDate?: CreationDate } {
  const changes = repo.listChangesFor(targetType, targetId);
  const created = changes.find((change) => change.kind === 'created');
  const changed = changes.find((change) => change.kind === 'changed');
  return {
    ...(changed?.date !== undefined ? { changeDate: { tag: 'CHAN', date: buildDateExactStructure(changed.date), ...(changed.user !== undefined ? { user: changed.user } : {}) } } : {}),
    ...(created?.date !== undefined ? { creationDate: { tag: 'CREA', date: buildDateExactStructure(created.date) } } : {}),
  };
}

function withCitationList(repo: TreeRepository, targetType: string, targetId: string, xrefs: Xrefs): { citations: SourceCitation[] } {
  const citations: SourceCitation[] = repo.listCitationRecordsFor(targetType, targetId).map((row) => buildCitation(row, repo, xrefs));
  return { citations };
}

function buildCitation(
  row: import('../model/types').CitationRecord,
  repo: TreeRepository,
  xrefs: Xrefs,
): SourceCitation {
  return {
    tag: 'SOUR',
    source: xrefs.of(row.sourceId),
    ...(row.description !== undefined ? { description: row.description } : {}),
    ...(row.page !== undefined ? { page: { tag: 'PAGE', payload: row.page } } : {}),
    ...(row.quality !== undefined ? { quality: row.quality as QualityEnum } : {}),
    ...(row.confidence !== undefined ? { confidence: row.confidence } : {}),
    ...(row.event !== undefined || row.role !== undefined || row.phrase !== undefined
      ? {
          event: {
            ...(row.event !== undefined ? { payload: row.event as import('@doru/gedcom').EventAttributeEnum } : {}),
            ...(row.role !== undefined ? { role: { payload: row.role.toUpperCase() as import('@doru/gedcom').RoleEnum } } : {}),
            ...(row.phrase !== undefined ? { phrase: row.phrase } : {}),
          },
        }
      : {}),
    ...(row.date !== undefined || (row.texts !== undefined && row.texts.length > 0) || row.www !== undefined
      ? {
          data: {
            ...(row.date !== undefined ? { date: buildDate(row.date) } : {}),
            ...(row.texts !== undefined && row.texts.length > 0
              ? { texts: row.texts.map((text) => ({ tag: 'TEXT' as const, payload: text.text, ...(text.mime !== undefined ? { mediaType: text.mime } : {}), ...(text.language !== undefined ? { language: text.language } : {}) })) }
              : {}),
            ...(row.www !== undefined ? { www: row.www } : {}),
          },
        }
      : {}),
    ...(row.templateFields !== undefined && row.templateFields.length > 0
      ? { template: { tag: '_TMPLT', fields: row.templateFields.map((field) => ({ tag: 'FIELD' as const, name: field.name, ...(field.value !== undefined ? { value: field.value } : {}) })) } }
      : {}),
    ...withNoteList(repo, 'citation', row.id, xrefs),
  } as SourceCitation;
}

function withNoteList(repo: TreeRepository, targetType: string, targetId: string, xrefs: Xrefs): { notes: NoteStructure[] } {
  const notes: NoteStructure[] = repo
    .listNotesFor(targetType, targetId)
    .map((note) =>
      note.xref !== undefined
        ? ({ tag: 'SNOTE', note: xrefs.of(note.id) } as NoteStructure)
        : ({
            tag: 'NOTE',
            payload: note.text,
            ...(note.mime !== undefined ? { mediaType: note.mime } : {}),
            ...(note.language !== undefined ? { language: note.language } : {}),
            ...(note.translations !== undefined && note.translations.length > 0
              ? { translations: note.translations.map((translation) => ({ tag: 'TRAN' as const, payload: translation.text, ...(translation.mime !== undefined ? { mediaType: translation.mime } : {}), ...(translation.language !== undefined ? { language: translation.language } : {}) })) }
              : {}),
            ...withCitationList(repo, 'note', note.id, xrefs),
          } as NoteStructure),
    );
  return { notes };
}

function withSubmitterLinks(repo: TreeRepository, targetType: string, targetId: string, xrefs: Xrefs): { submitters?: string[] } {
  const submitters = repo
    .listSubmittersFor(targetType, targetId)
    .map((submitterId) => xrefs.of(submitterId));
  return submitters.length > 0 ? { submitters } : {};
}

function withTagLinks(repo: TreeRepository, targetType: string, targetId: string, xrefs: Xrefs): { tagLinks?: Array<{ tag: '_TAG'; target: string; date?: DateStructure }> } {
  const links = repo
    .listTagLinksFor(targetType, targetId)
    .map(
      (entry) =>
        ({
          tag: '_TAG',
          target: xrefs.of(entry.tagId),
          ...(entry.link.date !== undefined ? { date: buildDate(entry.link.date) } : {}),
        }) as import('@doru/gedcom').TagLink,
    );
  return links.length > 0 ? { tagLinks: links } : {};
}

function withTodoStructures(repo: TreeRepository, targetType: string, targetId: string): { todos?: Array<import('@doru/gedcom').TodoStructure> } {
  const todos = repo
    .listTodosFor(targetType, targetId)
    .map((todo) => ({
      tag: '_TODO' as const,
      payload: todo.text,
      ...(todo.category !== undefined ? { category: todo.category } : {}),
      ...(todo.locality !== undefined ? { locality: todo.locality } : {}),
      ...(todo.priority !== undefined ? { priority: todo.priority } : {}),
      ...(todo.status !== undefined ? { status: todo.status } : {}),
      ...(todo.scheduledDate !== undefined ? { date: buildDate(todo.scheduledDate) } : {}),
      ...(todo.reminderDate !== undefined ? { reminderDate: buildDate(todo.reminderDate) } : {}),
      ...(todo.closedDate !== undefined ? { closedDate: buildDate(todo.closedDate) } : {}),
    } as import('@doru/gedcom').TodoStructure));
  return todos.length > 0 ? { todos } : {};
}

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

function buildSource(source: SourceRecord, repo: TreeRepository, xrefs: Xrefs): GedcomSourceRecord {
  const data = {
    ...(source.agency !== undefined ? { agency: source.agency } : {}),
    ...(source.dataEvents !== undefined && source.dataEvents.length > 0
      ? {
          events: source.dataEvents.map((event) => ({
            tag: 'EVEN' as const,
            payload: [event.tag as import('@doru/gedcom').EventAttributeEnum],
            ...(event.value !== undefined ? { userDefined: [event.value] } : {}),
            ...(event.date !== undefined ? { date: buildDatePeriod(event.date) } : {}),
            ...(event.placeId !== undefined ? { place: buildPlace(repo, event.placeId) } : {}),
          })),
        }
      : {}),
  };
  return {
    tag: 'SOUR',
    xref: xrefs.of(source.id),
    ...(source.title !== undefined ? { title: source.title } : {}),
    ...(source.abbreviation !== undefined ? { abbreviation: source.abbreviation } : {}),
    ...(source.author !== undefined ? { author: source.author } : {}),
    ...(source.publication !== undefined ? { publication: source.publication } : {}),
    ...(source.medium !== undefined ? { medium: source.medium } : {}),
    ...(source.url !== undefined ? { url: source.url } : {}),
    ...(source.accessDate !== undefined ? { accessDate: source.accessDate } : {}),
    ...(source.confidence !== undefined ? { confidence: source.confidence } : {}),
    ...(source.pubDate !== undefined || source.pubPlace !== undefined
      ? {
          publicationDetails: {
            ...(source.pubDate !== undefined ? { date: buildDateExactStructure(source.pubDate) } : {}),
            ...(source.pubPlace !== undefined ? { place: source.pubPlace } : {}),
          },
        }
      : {}),
    ...(source.texts !== undefined && source.texts.length > 0
      ? {
          text: {
            payload: source.texts[0]!.text,
            ...(source.texts[0]!.mime !== undefined ? { mediaType: source.texts[0]!.mime } : {}),
            ...(source.texts[0]!.language !== undefined ? { language: source.texts[0]!.language } : {}),
          },
        }
      : {}),
    ...(Object.keys(data).length > 0 ? { data } : {}),
    ...(source.repositories !== undefined && source.repositories.length > 0
      ? {
          repositoryCitations: source.repositories.map((entry) => ({
            tag: 'REPO' as const,
            repository: xrefs.of(entry.repositoryId),
            ...(entry.callNumbers !== undefined && entry.callNumbers.length > 0
              ? {
                  callNumbers: entry.callNumbers.map((callNumber) => ({
                    tag: 'CALN' as const,
                    payload: callNumber.value,
                    ...(callNumber.medium !== undefined ? { medium: { payload: callNumber.medium.toUpperCase() as import('@doru/gedcom').MediaEnum } } : {}),
                  })),
                }
              : {}),
          })),
        }
      : {}),
    ...(source.templateFields !== undefined && source.templateFields.length > 0
      ? { template: { tag: '_TMPLT', fields: source.templateFields.map((field) => ({ tag: 'FIELD' as const, name: field.name, ...(field.value !== undefined ? { value: field.value } : {}) })) } }
      : {}),
    ...(source.titleId !== undefined ? { titlRef: xrefs.of(source.titleId) } : {}),
    ...withIdentifiers(repo, 'source', source.id).length > 0
      ? { identifiers: withIdentifiers(repo, 'source', source.id) }
      : {},
    ...withNoteList(repo, 'source', source.id, xrefs),
    ...withChanges(repo, 'source', source.id),
  } as GedcomSourceRecord;
}

// ---------------------------------------------------------------------------
// Dates and places
// ---------------------------------------------------------------------------

function buildDetail(fact: FactRecord, repo: TreeRepository, xrefs: Xrefs): EventDetail | undefined {
  const date = buildDate(fact.date);
  const place: PlaceStructure | undefined =
    fact.placeId !== undefined
      ? buildPlace(repo, fact.placeId)
      : fact.place !== undefined
        ? ({ tag: 'PLAC', payload: [fact.place] } as PlaceStructure)
        : undefined;
  const address = fact.addressId !== undefined ? buildAddress(repo.getAddress(fact.addressId)!) : undefined;
  const ages = fact.ages?.filter((age) => age.role === undefined);
  const witnessAssociations = (fact.participants ?? [])
    .filter((participant) => participant.personId !== undefined)
    .map((participant) => ({
      tag: 'ASSO' as const,
      individual: xrefs.of(participant.personId!),
      ...(participant.role !== undefined ? { role: { payload: participant.role.toUpperCase() as import('@doru/gedcom').RoleEnum } } : {}),
    }));
  const witnesses = (fact.participants ?? []).filter((participant) => participant.personId === undefined && participant.value !== undefined);
  const citations = withCitationList(repo, 'fact', fact.id, xrefs).citations;
  const notes = withNoteList(repo, 'fact', fact.id, xrefs).notes;
  const flags = fact.flags;
  if (
    date === undefined &&
    place === undefined &&
    address === undefined &&
    (ages ?? []).length === 0 &&
    witnesses.length === 0 &&
    witnessAssociations.length === 0 &&
    citations.length === 0 &&
    notes.length === 0 &&
    fact.sortDate === undefined &&
    fact.agency === undefined &&
    fact.religiousAffiliation === undefined &&
    fact.cause === undefined &&
    fact.sentence === undefined &&
    fact.quality === undefined &&
    flags === undefined
  ) {
    return undefined;
  }
  return {
    ...(date !== undefined ? { date } : {}),
    ...(fact.sortDate !== undefined ? { sortDate: buildSortDate(fact.sortDate) } : {}),
    ...(place !== undefined ? { place } : {}),
    ...(address !== undefined ? { address } : {}),
    ...(ages !== undefined && ages.length > 0 ? { age: buildAge(ages[0]!) } : {}),
    ...(fact.agency !== undefined ? { agency: fact.agency } : {}),
    ...(fact.religiousAffiliation !== undefined ? { religiousAffiliation: fact.religiousAffiliation } : {}),
    ...(fact.cause !== undefined ? { cause: fact.cause } : {}),
    ...(fact.sentence !== undefined ? { sentence: fact.sentence } : {}),
    ...(fact.quality !== undefined ? { quality: fact.quality as QualityEnum } : {}),
    ...(flags !== undefined ? { factFlags: flags as EventDetail['factFlags'] } : {}),
    ...(witnesses.length > 0 ? { witnesses: witnesses.map((participant) => participant.value!) } : {}),
    ...(witnessAssociations.length > 0 ? { associations: witnessAssociations } : {}),
    ...(citations.length > 0 ? { citations } : {}),
    ...(notes.length > 0 ? { notes } : {}),
  } as EventDetail;
}

function buildAge(age: {
  bound?: string | undefined;
  years?: number | undefined;
  months?: number | undefined;
  weeks?: number | undefined;
  days?: number | undefined;
  phrase?: string | undefined;
}): import('@doru/gedcom').AgeStructure {
  return {
    ...(age.years !== undefined || age.months !== undefined || age.weeks !== undefined || age.days !== undefined || age.bound !== undefined
      ? {
          payload: {
            ...(age.bound !== undefined ? { bound: age.bound as '<' | '>' } : {}),
            ...(age.years !== undefined ? { years: age.years } : {}),
            ...(age.months !== undefined ? { months: age.months } : {}),
            ...(age.weeks !== undefined ? { weeks: age.weeks } : {}),
            ...(age.days !== undefined ? { days: age.days } : {}),
          },
        }
      : {}),
    ...(age.phrase !== undefined ? { phrase: age.phrase } : {}),
  };
}

function buildAddress(address: import('../model/types').AddressRecord): import('@doru/gedcom').AddressStructure {
  return {
    ...(address.lines.length > 0 ? { payload: address.lines[0] } : {}),
    ...(address.city !== undefined ? { city: address.city } : {}),
    ...(address.state !== undefined ? { state: address.state } : {}),
    ...(address.postalCode !== undefined ? { postalCode: address.postalCode } : {}),
    ...(address.country !== undefined ? { country: address.country } : {}),
  };
}

function buildPlace(repo: TreeRepository, placeId: string): PlaceStructure {
  const place = repo.getPlace(placeId);
  return {
    tag: 'PLAC',
    payload: place !== undefined ? officialPlaceNames(place) : [''],
    ...(place?.latitude !== undefined && place.longitude !== undefined
      ? { map: { latitude: { direction: place.latitude >= 0 ? 'N' : 'S', degrees: Math.abs(place.latitude) }, longitude: { direction: place.longitude >= 0 ? 'E' : 'W', degrees: Math.abs(place.longitude) } } }
      : {}),
  };
}

function officialPlaceNames(place: PlaceRecord): string[] {
  return place.names
    .filter((name) => name.kind === undefined || name.kind === 'official')
    .sort((a, b) => a.position - b.position)
    .map((name) => name.value);
}

function placeNameOf(place: PlaceRecord): string {
  return officialPlaceNames(place).join(', ');
}

function buildDate(date: DateValue | undefined): DateStructure | undefined {
  if (!date) {
    return undefined;
  }
  const value = buildDateValue(date);
  if (value === undefined && date.text === undefined) {
    return undefined;
  }
  return {
    ...(value !== undefined ? { value } : {}),
    ...(date.text !== undefined ? { phrase: date.text } : {}),
    ...(date.time !== undefined ? { time: date.time as import('@doru/gedcom').TimeValue } : {}),
  } as DateStructure | undefined;
}

function buildSortDate(date: DateValue): import('@doru/gedcom').SortDateStructure {
  const value = buildDateValue(date);
  return {
    ...(value !== undefined ? { value } : {}),
    ...(date.text !== undefined ? { phrase: date.text } : {}),
  };
}

function buildDatePeriod(date: DateValue): import('@doru/gedcom').DatePeriodStructure {
  const value = buildDateValue(date);
  if (value !== undefined && value.kind !== 'period') {
    // The period structure only holds FROM/TO bounds.
    return { ...(date.text !== undefined ? { phrase: date.text } : {}) } as import('@doru/gedcom').DatePeriodStructure;
  }
  return {
    ...(value !== undefined ? { value } : {}),
    ...(date.text !== undefined ? { phrase: date.text } : {}),
  };
}

function buildDateExactStructure(date: DateValue): DateExactStructure {
  const component = date.component;
  const exact: DateExact = {
    ...(component?.year !== undefined ? { year: component.year } : {}),
    ...(typeof component?.month === 'number' ? { month: MONTH_CODES[component.month - 1] as import('@doru/gedcom').GregorianMonth } : {}),
    ...(component?.day !== undefined ? { day: component.day } : {}),
    ...(component?.epoch !== undefined ? { epoch: component.epoch as Epoch } : {}),
  };
  return {
    value: exact,
    ...(date.time !== undefined ? { time: date.time as import('@doru/gedcom').TimeValue } : {}),
  } as DateExactStructure;
}

function buildDateValue(date: DateValue): GedcomDateValue | undefined {
  const component = date.component !== undefined ? buildDateFields(date.component) : undefined;
  switch (date.quality) {
    case 'exact':
      return component !== undefined ? { kind: 'date', ...component } : undefined;
    case 'about':
      return component !== undefined
        ? { kind: 'approx', modifier: date.modifier ?? 'ABT', date: component }
        : undefined;
    case 'before':
      return component !== undefined ? { kind: 'bound', modifier: 'BEF', date: component } : undefined;
    case 'after':
      return component !== undefined ? { kind: 'bound', modifier: 'AFT', date: component } : undefined;
    case 'range': {
      const end = date.end !== undefined ? buildDateFields(date.end) : undefined;
      if (component !== undefined && end !== undefined) {
        return { kind: 'range', start: component, end };
      }
      if (component !== undefined) {
        return { kind: 'period', from: component };
      }
      if (end !== undefined) {
        return { kind: 'period', to: end };
      }
      return { kind: 'unknown' };
    }
    case 'unknown':
      return { kind: 'unknown' };
  }
}

function buildDateFields(component: DateComponent): DateFields {
  const month = mapMonth(component.month);
  return {
    ...(component.calendar !== undefined ? { calendar: mapCalendar(component.calendar) } : {}),
    ...(component.year !== undefined ? { year: component.year } : {}),
    ...(month !== undefined ? { month } : {}),
    ...(component.day !== undefined ? { day: component.day } : {}),
    ...(component.epoch !== undefined ? { epoch: component.epoch as Epoch } : {}),
  };
}

/** The tree's canonical calendar names back to the GEDCOM codes. */
function mapCalendar(calendar: string): Calendar {
  switch (calendar) {
    case 'julian':
      return 'JULIAN';
    case 'french_republican':
      return 'FRENCH_R';
    case 'hebrew':
      return 'HEBREW';
    default:
      return calendar as Calendar;
  }
}

/** Numeric months (1–12, Gregorian/Julian) back to the GEDCOM month codes. */
function mapMonth(month: number | string | undefined): GedcomMonth | undefined {
  if (month === undefined) {
    return undefined;
  }
  if (typeof month === 'number') {
    return MONTH_CODES[month - 1] as GedcomMonth;
  }
  return month as GedcomMonth;
}

// ---------------------------------------------------------------------------
// Xref allocation
// ---------------------------------------------------------------------------

/**
 * Assigns export xrefs: records keep the xref a GEDCOM import gave them;
 * records without one get the next free `@I<digits>@`-style identifier.
 */
class Xrefs {
  private readonly byId = new Map<string, string>();
  private readonly used = new Set<string>();
  private readonly counters = new Map<string, number>();

  assign(prefix: string, id: string, existing: string | undefined): string {
    if (existing !== undefined && existing !== '') {
      this.byId.set(id, existing);
      this.used.add(existing);
      return existing;
    }
    let counter = (this.counters.get(prefix) ?? 0) + 1;
    this.counters.set(prefix, counter);
    while (this.used.has(`@${prefix}${counter}@`)) {
      counter += 1;
      this.counters.set(prefix, counter);
    }
    const xref = `@${prefix}${counter}@`;
    this.used.add(xref);
    this.byId.set(id, xref);
    return xref;
  }

  of(id: string): string {
    const xref = this.byId.get(id);
    if (xref === undefined) {
      throw new Error(`no export xref for record ${id}`);
    }
    return xref;
  }
}
