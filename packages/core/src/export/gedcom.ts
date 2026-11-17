import type {
  Calendar,
  ChangeDate,
  CreationDate,
  DateExact,
  DateExactStructure,
  DateFields,
  DateStructure,
  DateValue as GedcomDateValue,
  EventDetail,
  FactFlag as GedcomFactFlag,
  ChildFamilyLink,
  FamilyAttributeStructure,
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
  ListEnum,
  MultimediaLink,
  MultimediaRecord,
  NameTranslation,
  NameTypeStructure,
  NonEventStructure,
  NoteStructure,
  PersonalNamePieces,
  PersonalNameStructure,
  PhoneticNameVariation,
  PlaceRecord as GedcomPlaceRecord,
  PlaceNameStructure,
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
  FactFlag,
  FactRecord,
  FamilyRecord,
  MediaLinkRecord,
  MediaRecord,
  NoteRecord,
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

/** The lowercase core fact flags mapped to the GEDCOM `_FLGS` vocabulary. */
const CORE_TO_GEDCOM_FACT_FLAG: Readonly<Record<FactFlag, GedcomFactFlag>> = {
  private: 'PRIVATE',
  preferred: 'PREFERRED',
  tentative: 'TENTATIVE',
  rejected: 'REJECTED',
};

const INDIVIDUAL_EVENT_TAGS = new Set([
  'ADOP',
  'BAPM',
  'BARM',
  'BASM',
  'BIRT',
  'BLES',
  'BURI',
  'CENS',
  'CHR',
  'CHRA',
  'CONF',
  'CREM',
  'DEAT',
  'EMIG',
  'FCOM',
  'GRAD',
  'IMMI',
  'NATU',
  'ORDN',
  'PROB',
  'RETI',
  'WILL',
]);

const FAMILY_EVENT_TAGS = new Set(['ANUL', 'CENS', 'DIV', 'DIVF', 'ENGA', 'MARB', 'MARC', 'MARL', 'MARR', 'MARS']);

const INDIVIDUAL_ATTRIBUTE_TAGS = new Set([
  'CAST',
  'DSCR',
  'EDUC',
  'IDNO',
  'NATI',
  'NCHI',
  'NMR',
  'OCCU',
  'PROP',
  'RELI',
  'RESI',
  'SSN',
  'TITL',
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
  const places = repo.listPlaces();
  const media = repo.listAllMedia().filter((entry) => (entry.files ?? []).length > 0);
  const firstSubmitter = submitters[0];
  const notes = repo.listNotes().filter((note) => note.xref !== undefined || (note.links?.length ?? 0) > 1);
  const todos = repo.listTodos().filter((todo) => todo.targetType === undefined && todo.targetId === undefined);
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
  for (const place of places) {
    xrefs.assign('P', place.id, place.xref);
  }
  for (const entry of media) {
    xrefs.assign('O', entry.id, entry.xref);
  }

  const records: GedcomRecord[] = [
    ...places.map((place) => buildPlaceRecord(place, repo, xrefs)),
    ...media.map((entry) => buildMediaRecord(entry, repo, xrefs)),
    ...submitters.map((submitter) => buildSubmitter(submitter, repo, xrefs)),
    ...repositories.map((repository) => buildRepository(repository, repo, xrefs)),
    ...titles.map((title) => buildTitle(title, repo, xrefs)),
    ...sources.map((source) => buildSource(source, repo, xrefs)),
    ...notes.map((note) => buildSharedNote(note, repo, xrefs)),
    ...persons.map((person) => buildPerson(person, repo, xrefs)),
    ...families.map((family) => buildFamily(family, repo, xrefs)),
    ...todos.map((todo) => buildTodoRecord(todo, repo, xrefs)),
    ...tags.map((tag) => buildTagRecord(tag, xrefs)),
    ...buildAssociations(),
  ];
  // The schema keeps no header table: the export synthesizes a fresh
  // GEDCOM header naming this app as the source.
  return {
    header: {
      tag: 'HEAD',
      gedcom: { version: '7.0' },
      source: { payload: 'DORU' },
      ...(firstSubmitter !== undefined ? { submitter: xrefs.of(firstSubmitter.id) } : {}),
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
        ...(withCitationList(repo, 'fact', fact.id, xrefs).citations.length > 0
          ? withCitationList(repo, 'fact', fact.id, xrefs)
          : {}),
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
  const personIdentifiers = repo.listIdentifiersFor('person', person.id);
  const sosaNumber = personIdentifiers.find((identifier) => identifier.namespace === 'sosa')?.value;
  const sosaDAboville = personIdentifiers.find((identifier) => identifier.namespace === 'daboville')?.value;
  const contacts = withContacts(repo, 'person', person.id);
  const addressRecord = person.addressId !== undefined ? repo.getAddress(person.addressId) : undefined;
  const restriction = repo
    .listRestrictionsFor('person', person.id)
    .map((entry) => entry.level.toUpperCase()) as ListEnum<RestrictionEnum>;
  const changes = withChanges(repo, 'person', person.id);
  const submitterLinks = repo.listRecordSubmittersFor('person', person.id);
  const ancestorInterests = submitterLinks
    .filter((link) => link.kind === 'ancestor_interest')
    .map((link) => xrefs.of(link.submitterId));
  const descendantInterests = submitterLinks
    .filter((link) => link.kind === 'descendant_interest')
    .map((link) => xrefs.of(link.submitterId));
  const sexCitations = withCitationList(repo, 'person_sex', person.id, xrefs).citations;
  return {
    tag: 'INDI',
    xref: xrefs.of(person.id),
    sex: person.sex,
    ...(person.deathStatus === 'dead' ? { deceased: true } : person.deathStatus === 'alive' ? { deceased: false } : {}),
    names: person.names.map((name) => buildName(name, repo, xrefs)),
    ...(events.length > 0 ? { events } : {}),
    ...(attributes.length > 0 ? { attributes } : {}),
    ...(nonEvents.length > 0 ? { nonEvents } : {}),
    ...(identifiers.length > 0 ? { identifiers } : {}),
    ...(sosaNumber !== undefined ? { sosaNumber } : {}),
    ...(sosaDAboville !== undefined ? { sosaDAboville } : {}),
    ...(restriction.length > 0 ? { restriction } : {}),
    ...changes,
    ...contacts,
    ...(addressRecord !== undefined ? { address: buildAddress(addressRecord, repo, xrefs) } : {}),
    ...withCitationList(repo, 'person', person.id, xrefs),
    ...(sexCitations.length > 0 ? { sexCitations } : {}),
    ...withNoteList(repo, 'person', person.id, xrefs),
    ...withMediaLinks(repo, 'person', person.id, xrefs),
    ...withSubmitterLinks(repo, 'person', person.id, xrefs),
    ...(ancestorInterests.length > 0 ? { ancestorInterests } : {}),
    ...(descendantInterests.length > 0 ? { descendantInterests } : {}),
    ...withTagLinks(repo, 'person', person.id, xrefs),
    ...withTodoStructures(repo, 'person', person.id, xrefs),
    ...withAssociations(repo, person.id, xrefs),
    ...withAliases(repo, person.id, xrefs),
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
function eventFamilyFields(
  fact: FactRecord,
  xrefs: Xrefs,
): {
  adoptionFamily?: {
    tag: 'FAMC';
    family: string;
    adoption?: { tag: 'ADOP'; payload: string; phrase?: string };
  };
  familyChild?: string;
} {
  const link = fact.familyLinks?.[0];
  if (link === undefined) {
    return {};
  }
  if (fact.tag === 'ADOP') {
    return {
      adoptionFamily: {
        tag: 'FAMC',
        family: xrefs.of(link.familyId),
        ...(link.adoptedBy !== undefined
          ? {
              adoption: {
                tag: 'ADOP' as const,
                payload: link.adoptedBy,
                ...(link.phrase !== undefined ? { phrase: link.phrase } : {}),
              },
            }
          : {}),
      },
    };
  }
  if (fact.tag === 'BIRT' || fact.tag === 'CHR') {
    return { familyChild: xrefs.of(link.familyId) };
  }
  return {};
}

function buildPersonFact(fact: FactRecord, repo: TreeRepository, xrefs: Xrefs): MappedPersonFact {
  const detail = buildDetail(fact, repo, xrefs);
  const familyFields = eventFamilyFields(fact, xrefs);
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
      ...familyFields,
      ...(detail !== undefined ? { detail } : {}),
    } as IndividualEventStructure,
  };
}

function buildName(name: PersonName, repo: TreeRepository, xrefs: Xrefs): PersonalNameStructure {
  const pieces = piecesFromName(name);
  const variantStructures = name.variants ?? [];
  const extensions = [
    ...(name.full !== undefined ? [{ tag: '_FULL', payload: name.full, children: [] }] : []),
    ...(name.language !== undefined ? [{ tag: '_LANG', payload: name.language, children: [] }] : []),
  ];
  const nameDate = name.date !== undefined ? buildDate(name.date) : undefined;
  return {
    tag: 'NAME',
    payload: {
      ...(name.given !== undefined ? { given: name.given } : {}),
      ...(name.surname !== undefined ? { surname: name.surname } : {}),
      ...(name.suffix !== undefined ? { suffix: name.suffix } : {}),
    },
    ...(name.type !== undefined ? { type: mapNameType(name.type) } : {}),
    ...(name.callName !== undefined ? { callName: name.callName } : {}),
    ...(name.middleName !== undefined ? { middleName: name.middleName } : {}),
    ...(name.patronymic !== undefined ? { patronymic: name.patronymic } : {}),
    ...(name.marriedName !== undefined ? { marriedName: name.marriedName } : {}),
    ...(name.aka !== undefined ? { alsoKnownAs: name.aka.split(',').map((value) => value.trim()) } : {}),
    ...(name.hebrewName !== undefined ? { hebrewName: name.hebrewName } : {}),
    ...(name.title !== undefined ? { title: name.title } : {}),
    ...(name.shortName !== undefined ? { shortName: name.shortName } : {}),
    ...(name.nameAsRecorded !== undefined ? { nameAsRecorded: name.nameAsRecorded } : {}),
    ...(name.givenNameUsed !== undefined ? { givenNameUsed: name.givenNameUsed } : {}),
    pieces,
    ...(nameDate !== undefined ? { date: nameDate } : {}),
    ...(name.primary === true ? { primary: true } : {}),
    ...(extensions.length > 0 ? { extensions } : {}),
    ...(variantStructures.filter((variant) => variant.kind === 'translation').length > 0
      ? {
          translations: variantStructures.filter((variant) => variant.kind === 'translation').map(buildNameTranslation),
        }
      : {}),
    ...(variantStructures.filter((variant) => variant.kind === 'phonetic').length > 0
      ? { phonetic: variantStructures.filter((variant) => variant.kind === 'phonetic').map(buildNameVariation) }
      : {}),
    ...(variantStructures.filter((variant) => variant.kind === 'romanized').length > 0
      ? { romanized: variantStructures.filter((variant) => variant.kind === 'romanized').map(buildNameVariation) }
      : {}),
    ...withCitationList(repo, 'name', name.id, xrefs),
    ...withNoteList(repo, 'name', name.id, xrefs),
    ...withMediaLinks(repo, 'name', name.id, xrefs),
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
  };
}

function buildNameVariation(variant: PersonName): PhoneticNameVariation {
  const pieces = piecesFromName(variant);
  return {
    payload: {
      ...(variant.given !== undefined ? { given: variant.given } : {}),
      ...(variant.surname !== undefined ? { surname: variant.surname } : {}),
    },
    ...(variant.variantType !== undefined ? { type: variant.variantType } : {}),
    ...(Object.keys(pieces).length > 0 ? { pieces } : {}),
  };
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
      ? {
          partner: xrefs.of(first.personId),
          ...(first.preferred === true ? { preferred: true } : {}),
          ...(first.phrase !== undefined ? { phrase: first.phrase } : {}),
          ...(first.name !== undefined ? { name: { tag: 'NAME' as const, payload: { given: first.name } } } : {}),
          ...(first.civilStatus !== undefined ? { civilStatus: first.civilStatus } : {}),
          ...(first.marriageNumber !== undefined && /^\d+$/.test(first.marriageNumber)
            ? { marriageNumber: Number(first.marriageNumber) }
            : {}),
        }
      : undefined;
  const wife: FamilyPartnerLink | undefined =
    second !== undefined
      ? {
          partner: xrefs.of(second.personId),
          ...(second.preferred === true ? { preferred: true } : {}),
          ...(second.phrase !== undefined ? { phrase: second.phrase } : {}),
          ...(second.name !== undefined ? { name: { tag: 'NAME' as const, payload: { given: second.name } } } : {}),
          ...(second.civilStatus !== undefined ? { civilStatus: second.civilStatus } : {}),
          ...(second.marriageNumber !== undefined && /^\d+$/.test(second.marriageNumber)
            ? { marriageNumber: Number(second.marriageNumber) }
            : {}),
        }
      : undefined;
  const childLinks = family.childLinks ?? [];
  const children = childLinks.map((link) => ({
    child: xrefs.of(link.childId),
    ...(link.fatherRelation !== undefined ? { fatherRelation: link.fatherRelation } : {}),
    ...(link.motherRelation !== undefined ? { motherRelation: link.motherRelation } : {}),
    ...(link.preferred === true ? { preferred: true } : {}),
    ...(link.multiplicity !== undefined ? { multiplicity: link.multiplicity } : {}),
  }));
  const events: FamilyEventStructure[] = [];
  const attributes: FamilyAttributeStructure[] = [];
  const nonEvents: NonEventStructure[] = [];
  for (const fact of repo.listFactsForFamily(family.id)) {
    if (fact.negation === true) {
      nonEvents.push({
        tag: 'NO',
        payload: fact.tag as NonEventStructure['payload'],
        ...(fact.date !== undefined ? { date: buildDatePeriod(fact.date) } : {}),
        ...(withCitationList(repo, 'fact', fact.id, xrefs).citations.length > 0
          ? withCitationList(repo, 'fact', fact.id, xrefs)
          : {}),
        ...withNoteList(repo, 'fact', fact.id, xrefs),
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
  const restriction = repo
    .listRestrictionsFor('family', family.id)
    .map((entry) => entry.level.toUpperCase()) as ListEnum<RestrictionEnum>;
  return {
    tag: 'FAM',
    xref: xrefs.of(family.id),
    ...(family.preferred === true ? { preferred: true } : {}),
    ...(family.sameSex === true ? { sameSexUnion: true } : {}),
    ...(family.unionKind !== undefined ? { unionKind: family.unionKind as import('@doru/gedcom').UsmUnionKind } : {}),
    ...(family.unionStatus !== undefined ? { unionStatus: family.unionStatus } : {}),
    ...(family.marriageBeginStatus !== undefined ? { marriageBeginningStatus: family.marriageBeginStatus } : {}),
    ...(family.marriageEndStatus !== undefined ? { marriageEndingStatus: family.marriageEndStatus } : {}),
    ...(family.witnesses !== undefined && family.witnesses.length > 0 ? { witnesses: family.witnesses } : {}),
    ...(family.marriageStatuses !== undefined && family.marriageStatuses.length > 0
      ? {
          marriageStatuses: family.marriageStatuses.map((status) => ({
            tag: '_STAT' as const,
            payload: status.status,
            ...(status.date !== undefined ? { date: buildDate(status.date) } : {}),
            ...(status.placeId !== undefined ? { place: buildPlace(repo, status.placeId, xrefs) } : {}),
            ...withNoteList(repo, 'family_marriage_status', status.id, xrefs),
            ...withCitationList(repo, 'family_marriage_status', status.id, xrefs),
          })) as import('@doru/gedcom').MarriageStatusStructure[],
        }
      : {}),
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
    ...withMediaLinks(repo, 'family', family.id, xrefs),
    ...withSubmitterLinks(repo, 'family', family.id, xrefs),
    ...withTagLinks(repo, 'family', family.id, xrefs),
    ...withTodoStructures(repo, 'family', family.id, xrefs),
    ...withFamilyAssociations(repo, family.id, xrefs),
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

function buildRepository(
  repository: import('../model/types').RepositoryRecord,
  repo: TreeRepository,
  xrefs: Xrefs,
): GedcomRecord {
  const address = repository.addressId !== undefined ? repo.getAddress(repository.addressId) : undefined;
  const record = {
    tag: 'REPO',
    xref: xrefs.of(repository.id),
    name: repository.name,
    ...(address !== undefined ? { address: buildAddress(address, repo, xrefs) } : {}),
    ...(withIdentifiers(repo, 'repository', repository.id).length > 0
      ? { identifiers: withIdentifiers(repo, 'repository', repository.id) }
      : {}),
    ...withContacts(repo, 'repository', repository.id),
    ...withChanges(repo, 'repository', repository.id),
    ...withNoteList(repo, 'repository', repository.id, xrefs),
    ...withSubmitterLinks(repo, 'repository', repository.id, xrefs),
    ...withTagLinks(repo, 'repository', repository.id, xrefs),
  } as GedcomRecord;
  return record;
}

function buildSubmitter(
  submitter: import('../model/types').SubmitterRecord,
  repo: TreeRepository,
  xrefs: Xrefs,
): GedcomRecord {
  const address = submitter.addressId !== undefined ? repo.getAddress(submitter.addressId) : undefined;
  return {
    tag: 'SUBM',
    xref: xrefs.of(submitter.id),
    name: submitter.name,
    ...(address !== undefined ? { address: buildAddress(address, repo, xrefs) } : {}),
    ...(submitter.languages !== undefined && submitter.languages.length > 0 ? { languages: submitter.languages } : {}),
    ...(withIdentifiers(repo, 'submitter', submitter.id).length > 0
      ? { identifiers: withIdentifiers(repo, 'submitter', submitter.id) }
      : {}),
    ...withContacts(repo, 'submitter', submitter.id),
    ...withChanges(repo, 'submitter', submitter.id),
    ...withNoteList(repo, 'submitter', submitter.id, xrefs),
    ...withSubmitterLinks(repo, 'submitter', submitter.id, xrefs),
  };
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
    ...withChanges(repo, 'title', title.id),
    ...withNoteList(repo, 'title', title.id, xrefs),
  };
}

function buildSharedNote(note: NoteRecord, repo: TreeRepository, xrefs: Xrefs): GedcomRecord {
  return {
    tag: 'SNOTE',
    xref: xrefs.of(note.id),
    payload: note.text,
    ...(note.mime !== undefined ? { mediaType: note.mime } : {}),
    ...(note.language !== undefined ? { language: note.language } : {}),
    ...(note.translations !== undefined && note.translations.length > 0
      ? {
          translations: note.translations.map((translation) => ({
            tag: 'TRAN',
            payload: translation.text,
            ...(translation.mime !== undefined ? { mediaType: translation.mime } : {}),
            ...(translation.language !== undefined ? { language: translation.language } : {}),
          })),
        }
      : {}),
    ...(withIdentifiers(repo, 'note', note.id).length > 0
      ? { identifiers: withIdentifiers(repo, 'note', note.id) }
      : {}),
    ...withChanges(repo, 'note', note.id),
    ...withCitationList(repo, 'note', note.id, xrefs),
    ...withSubmitterLinks(repo, 'note', note.id, xrefs),
    ...withTagLinks(repo, 'note', note.id, xrefs),
  };
}

function buildTodoRecord(todo: TodoRecord, repo: TreeRepository, xrefs: Xrefs): GedcomRecord {
  const uids = repo
    .listIdentifiersFor('todo', todo.id)
    .filter((identifier) => identifier.namespace === 'uid')
    .map((identifier) => identifier.value);
  const createdDate = formatTodoDate(todo.createdDate);
  return {
    tag: '_TODO',
    payload: todo.text,
    ...(todo.category !== undefined ? { category: todo.category } : {}),
    ...(todo.locality !== undefined ? { locality: todo.locality } : {}),
    ...(todo.priority !== undefined ? { priority: todo.priority } : {}),
    ...(todo.status !== undefined ? { status: todo.status } : {}),
    ...(createdDate !== undefined ? { createdDate } : {}),
    ...(todo.repositoryId !== undefined ? { repository: xrefs.of(todo.repositoryId) } : {}),
    ...(uids.length > 0 ? { uids } : {}),
    ...withNoteList(repo, 'todo', todo.id, xrefs),
    ...withChanges(repo, 'todo', todo.id),
  };
}

/** The vendor `_TCDT` slot is free text: keep a simple ISO-ish date. */
function formatTodoDate(date: DateValue | undefined): string | undefined {
  if (date === undefined) {
    return undefined;
  }
  if (date.text !== undefined) {
    return date.text;
  }
  const component = date.component;
  if (component?.year === undefined) {
    return undefined;
  }
  if (component.month === undefined) {
    return String(component.year);
  }
  const month = String(component.month).padStart(2, '0');
  if (component.day === undefined) {
    return `${component.year}-${month}`;
  }
  return `${component.year}-${month}-${String(component.day).padStart(2, '0')}`;
}

function buildTagRecord(tag: TagRecord, xrefs: Xrefs): GedcomRecord {
  return { tag: '_TAG', xref: xrefs.of(tag.id), name: tag.name };
}

// ---------------------------------------------------------------------------
// Relations exported as records
// ---------------------------------------------------------------------------

function buildAssociations(): GedcomRecord[] {
  // Associations live under INDI; nothing to export at the top level.
  return [];
}

function withAssociations(
  repo: TreeRepository,
  personId: string,
  xrefs: Xrefs,
): { associations?: import('@doru/gedcom').AssociationStructure[] } {
  const associations = repo
    .listAssociationsFor(personId)
    .filter((association) => association.personId === personId)
    .map((association) => buildAssociation(association, repo, xrefs));
  return associations.length > 0 ? { associations } : {};
}

function withFamilyAssociations(
  repo: TreeRepository,
  familyId: string,
  xrefs: Xrefs,
): { associations?: import('@doru/gedcom').AssociationStructure[] } {
  const associations = repo
    .listAssociationsForFamily(familyId)
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
    ...(association.role !== undefined
      ? { role: { payload: association.role.toUpperCase() as import('@doru/gedcom').RoleEnum } }
      : {}),
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
    ...(repo.listRestrictionsFor('association', association.id).some((entry) => entry.level === 'privacy')
      ? { private: true }
      : {}),
    ...withCitationList(repo, 'association', association.id, xrefs),
    ...withNoteList(repo, 'association', association.id, xrefs),
  } as import('@doru/gedcom').AssociationStructure;
}

function withAliases(
  repo: TreeRepository,
  personId: string,
  xrefs: Xrefs,
): { aliases?: Array<{ tag: 'ALIA'; individual: string }> } {
  const aliases = repo
    .listAliasesFor(personId)
    .map((alias) => ({ tag: 'ALIA' as const, individual: xrefs.of(alias.aliasId) }));
  return aliases.length > 0 ? { aliases } : {};
}

function withChildFamilies(
  repo: TreeRepository,
  personId: string,
  xrefs: Xrefs,
): { childFamilies?: ChildFamilyLink[] } {
  const links: ChildFamilyLink[] = [];
  for (const family of repo.listFamiliesForPerson(personId)) {
    const link = family.childLinks?.find((entry) => entry.childId === personId);
    if (link === undefined) {
      continue;
    }
    links.push({
      family: xrefs.of(family.id),
      ...(link.pedigree !== undefined
        ? {
            pedigree: {
              payload: link.pedigree.toUpperCase() as PedigreeEnum,
              ...(link.pedigreePhrase !== undefined ? { phrase: link.pedigreePhrase } : {}),
            },
          }
        : {}),
      ...(link.status !== undefined
        ? {
            status: {
              payload: link.status.toUpperCase() as import('@doru/gedcom').FamilyChildStatusEnum,
              ...(link.statusPhrase !== undefined ? { phrase: link.statusPhrase } : {}),
            },
          }
        : {}),
      ...(link.fatherRelation !== undefined ? { fatherRelation: link.fatherRelation } : {}),
      ...(link.motherRelation !== undefined ? { motherRelation: link.motherRelation } : {}),
      ...withNoteList(repo, 'family_child', link.id, xrefs),
    });
  }
  return links.length > 0 ? { childFamilies: links } : {};
}

function withSpouseFamilies(
  repo: TreeRepository,
  personId: string,
  xrefs: Xrefs,
): { spouseFamilies?: SpouseFamilyLink[] } {
  const links: SpouseFamilyLink[] = [];
  for (const family of repo.listFamiliesForPerson(personId)) {
    const link = family.partnerLinks?.find((entry) => entry.personId === personId);
    if (link === undefined) {
      continue;
    }
    links.push({
      family: xrefs.of(family.id),
      ...(link.date !== undefined ? { date: buildDate(link.date) } : {}),
      ...withNoteList(repo, 'family_partner', link.id, xrefs),
    } as SpouseFamilyLink);
  }
  return links.length > 0 ? { spouseFamilies: links } : {};
}

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------

const MIME_BY_EXTENSION: Record<string, string> = {
  gif: 'image/gif',
  heic: 'image/heic',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  pdf: 'application/pdf',
  png: 'image/png',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  webp: 'image/webp',
};

function mediaMime(path: string): string {
  const dot = path.lastIndexOf('.');
  const extension = dot === -1 ? '' : path.slice(dot + 1).toLowerCase();
  return MIME_BY_EXTENSION[extension] ?? 'application/octet-stream';
}

/** The stored place text, or the place row's official name when only an id is set. */
function mediaPlaceText(media: MediaRecord, repo: TreeRepository): string | undefined {
  if (media.place !== undefined) {
    return media.place;
  }
  const place = media.placeId !== undefined ? repo.getPlace(media.placeId) : undefined;
  const names = place !== undefined ? officialPlaceNames(place) : [];
  return names.length > 0 ? names.join(', ') : undefined;
}

function buildMediaRecord(media: MediaRecord, repo: TreeRepository, xrefs: Xrefs): MultimediaRecord {
  const restriction = repo
    .listRestrictionsFor('media', media.id)
    .map((entry) => entry.level.toUpperCase()) as ListEnum<RestrictionEnum>;
  const date = buildDate(media.date);
  const place = mediaPlaceText(media, repo);
  return {
    tag: 'OBJE',
    xref: xrefs.of(media.id),
    ...(media.title !== undefined ? { title: media.title } : {}),
    ...(date !== undefined ? { date } : {}),
    ...(place !== undefined && place !== '' ? { place } : {}),
    ...(media.objectType !== undefined ? { objectType: media.objectType } : {}),
    ...(media.description !== undefined ? { description: media.description } : {}),
    ...(media.keywords !== undefined ? { keywords: media.keywords } : {}),
    files: (media.files ?? []).map((file) => ({
      payload: file.path,
      form: {
        payload: mediaMime(file.path),
        ...(file.medium !== undefined ? { medium: { payload: file.medium as import('@doru/gedcom').MediaEnum } } : {}),
      },
      ...(file.title !== undefined ? { title: file.title } : {}),
      ...(file.contentType !== undefined ? { contentType: file.contentType } : {}),
      ...(file.text !== undefined ? { text: file.text } : {}),
      ...(file.translations !== undefined && file.translations.length > 0
        ? {
            translations: file.translations.map((translation) => ({
              payload: translation.path,
              form: { payload: mediaMime(translation.path) },
            })),
          }
        : {}),
    })),
    ...(withIdentifiers(repo, 'media', media.id).length > 0
      ? { identifiers: withIdentifiers(repo, 'media', media.id) }
      : {}),
    ...(restriction.length > 0 ? { restriction } : {}),
    ...withChanges(repo, 'media', media.id),
    ...withCitationList(repo, 'media', media.id, xrefs),
    ...withNoteList(repo, 'media', media.id, xrefs),
    ...withSubmitterLinks(repo, 'media', media.id, xrefs),
    ...withTagLinks(repo, 'media', media.id, xrefs),
  };
}

function buildMediaLink(link: MediaLinkRecord, xrefs: Xrefs): MultimediaLink {
  return {
    tag: 'OBJE',
    object: xrefs.of(link.mediaId),
    ...(link.crop !== undefined
      ? {
          crop: {
            ...(link.crop.top !== undefined ? { top: link.crop.top } : {}),
            ...(link.crop.left !== undefined ? { left: link.crop.left } : {}),
            ...(link.crop.height !== undefined ? { height: link.crop.height } : {}),
            ...(link.crop.width !== undefined ? { width: link.crop.width } : {}),
          },
        }
      : {}),
    ...(link.title !== undefined ? { title: link.title } : {}),
    ...(link.sequence !== undefined ? { sequence: link.sequence } : {}),
    ...(link.primary === true ? { primary: true } : {}),
    ...(link.scrapbook === true ? { scrapbook: true } : {}),
    ...(link.slideshow === true ? { slideshow: true } : {}),
    ...(link.thumbnail === true ? { thumbnail: true } : {}),
    ...(link.exclude === true ? { excludeFromDiagrams: true } : {}),
    ...(link.caption === true ? { caption: true } : {}),
  };
}

function withMediaLinks(
  repo: TreeRepository,
  targetType: string,
  targetId: string,
  xrefs: Xrefs,
): { media?: MultimediaLink[] } {
  const links = repo.listAttachmentsFor(targetType, targetId).mediaLinks.map((entry) => {
    const { citations } = withCitationList(repo, 'media_link', entry.link.id, xrefs);
    return {
      ...buildMediaLink(entry.link, xrefs),
      ...(citations.length > 0 ? { citations } : {}),
    };
  });
  return links.length > 0 ? { media: links } : {};
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
    .filter(
      (identifier) =>
        identifier.namespace === 'uid' || identifier.namespace === 'exid' || identifier.namespace === 'refn',
    )
    .map(
      (identifier) =>
        ({
          tag: identifier.namespace.toUpperCase(),
          payload: identifier.value,
          ...(identifier.namespace !== 'uid' && identifier.type !== undefined ? { type: identifier.type } : {}),
        }) as IdentifierStructure,
    );
}

function withContacts(
  repo: TreeRepository,
  targetType: string,
  targetId: string,
): { email?: string[]; phone?: string[]; fax?: string[]; url?: string; www?: string[] } {
  const contacts = repo.listContactsFor(targetType, targetId);
  const ofKind = (kind: string): string[] =>
    contacts.filter((contact) => contact.kind === kind).map((contact) => contact.value);
  return {
    ...(ofKind('email').length > 0 ? { email: ofKind('email') } : {}),
    ...(ofKind('phone').length > 0 ? { phone: ofKind('phone') } : {}),
    ...(ofKind('fax').length > 0 ? { fax: ofKind('fax') } : {}),
    ...(ofKind('url').length > 0 ? { url: ofKind('url')[0] } : {}),
    ...(ofKind('www').length > 0 ? { www: ofKind('www') } : {}),
  };
}

function withChanges(
  repo: TreeRepository,
  targetType: string,
  targetId: string,
): { changeDate?: ChangeDate; creationDate?: CreationDate } {
  const changes = repo.listChangesFor(targetType, targetId);
  const created = changes.find((change) => change.kind === 'created');
  const changed = changes.find((change) => change.kind === 'changed');
  return {
    ...(changed?.date !== undefined
      ? {
          changeDate: {
            tag: 'CHAN',
            date: buildDateExactStructure(changed.date),
            ...(changed.user !== undefined ? { user: changed.user } : {}),
          },
        }
      : {}),
    ...(created?.date !== undefined
      ? { creationDate: { tag: 'CREA', date: buildDateExactStructure(created.date) } }
      : {}),
  };
}

function withCitationList(
  repo: TreeRepository,
  targetType: string,
  targetId: string,
  xrefs: Xrefs,
): { citations: SourceCitation[] } {
  const citations: SourceCitation[] = repo
    .listCitationRecordsFor(targetType, targetId)
    .map((row) => buildCitation(row, repo, xrefs));
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
    ...(row.name !== undefined ? { name: row.name } : {}),
    ...(row.qualityAssessment !== undefined
      ? { qualityAssessment: { tag: '_QUAL' as const, source: row.qualityAssessment } }
      : {}),
    ...(row.reference !== undefined ? { reference: row.reference } : {}),
    ...(row.referenceNumber !== undefined ? { referenceNumber: row.referenceNumber } : {}),
    ...(row.abbreviation !== undefined ? { abbreviation: row.abbreviation } : {}),
    ...(row.footnote !== undefined ? { footnote: row.footnote } : {}),
    ...(row.verified === true ? { verified: true } : {}),
    ...(row.assessment !== undefined ? { assessment: row.assessment } : {}),
    ...(row.foundBy !== undefined ? { foundBy: row.foundBy } : {}),
    ...(row.www !== undefined ? { www: row.www } : {}),
    ...(row.event !== undefined || row.role !== undefined || row.phrase !== undefined
      ? {
          event: {
            ...(row.event !== undefined ? { payload: row.event as import('@doru/gedcom').EventAttributeEnum } : {}),
            ...(row.role !== undefined
              ? { role: { payload: row.role.toUpperCase() as import('@doru/gedcom').RoleEnum } }
              : {}),
            ...(row.phrase !== undefined ? { phrase: row.phrase } : {}),
          },
        }
      : {}),
    ...(row.date !== undefined || (row.texts !== undefined && row.texts.length > 0) || row.www !== undefined
      ? {
          data: {
            ...(row.date !== undefined ? { date: buildDate(row.date) } : {}),
            ...(row.texts !== undefined && row.texts.length > 0
              ? {
                  texts: row.texts.map((text) => ({
                    tag: 'TEXT' as const,
                    payload: text.text,
                    ...(text.mime !== undefined ? { mediaType: text.mime } : {}),
                    ...(text.language !== undefined ? { language: text.language } : {}),
                  })),
                }
              : {}),
            ...(row.www !== undefined ? { www: row.www } : {}),
          },
        }
      : {}),
    ...(row.templateFields !== undefined && row.templateFields.length > 0
      ? {
          template: {
            tag: '_TMPLT',
            fields: row.templateFields.map((field) => ({
              tag: 'FIELD' as const,
              name: field.name,
              ...(field.value !== undefined ? { value: field.value } : {}),
            })),
          },
        }
      : {}),
    ...withNoteList(repo, 'citation', row.id, xrefs),
    ...withMediaLinks(repo, 'citation', row.id, xrefs),
  } as unknown as SourceCitation;
}

function withNoteList(
  repo: TreeRepository,
  targetType: string,
  targetId: string,
  xrefs: Xrefs,
): { notes: NoteStructure[] } {
  const notes: NoteStructure[] = repo.listNotesFor(targetType, targetId).map((note) =>
    xrefs.has(note.id)
      ? { tag: 'SNOTE', note: xrefs.of(note.id) }
      : {
          tag: 'NOTE',
          payload: note.text,
          ...(note.mime !== undefined ? { mediaType: note.mime } : {}),
          ...(note.language !== undefined ? { language: note.language } : {}),
          ...(note.translations !== undefined && note.translations.length > 0
            ? {
                translations: note.translations.map((translation) => ({
                  tag: 'TRAN' as const,
                  payload: translation.text,
                  ...(translation.mime !== undefined ? { mediaType: translation.mime } : {}),
                  ...(translation.language !== undefined ? { language: translation.language } : {}),
                })),
              }
            : {}),
          ...withCitationList(repo, 'note', note.id, xrefs),
        },
  );
  return { notes };
}

function withSubmitterLinks(
  repo: TreeRepository,
  targetType: string,
  targetId: string,
  xrefs: Xrefs,
): { submitters?: string[] } {
  const submitters = repo.listSubmittersFor(targetType, targetId).map((submitterId) => xrefs.of(submitterId));
  return submitters.length > 0 ? { submitters } : {};
}

function withTagLinks(
  repo: TreeRepository,
  targetType: string,
  targetId: string,
  xrefs: Xrefs,
): { tagLinks?: Array<{ tag: '_TAG'; target: string; date?: DateStructure }> } {
  const links = repo.listTagLinksFor(targetType, targetId).map(
    (entry) =>
      ({
        tag: '_TAG',
        target: xrefs.of(entry.tagId),
        ...(entry.link.date !== undefined ? { date: buildDate(entry.link.date) } : {}),
      }) as import('@doru/gedcom').TagLink,
  );
  return links.length > 0 ? { tagLinks: links } : {};
}

function withTodoStructures(
  repo: TreeRepository,
  targetType: string,
  targetId: string,
  xrefs: Xrefs,
): { todos?: Array<import('@doru/gedcom').TodoStructure> } {
  const todos = repo.listTodosFor(targetType, targetId).map((todo) => {
    const createdDate = formatTodoDate(todo.createdDate);
    return {
      tag: '_TODO' as const,
      payload: todo.text,
      ...(todo.category !== undefined ? { category: todo.category } : {}),
      ...(todo.locality !== undefined ? { locality: todo.locality } : {}),
      ...(todo.priority !== undefined ? { priority: todo.priority } : {}),
      ...(todo.status !== undefined ? { status: todo.status } : {}),
      ...(todo.scheduledDate !== undefined ? { date: buildDate(todo.scheduledDate) } : {}),
      ...(createdDate !== undefined ? { createdDate } : {}),
      ...(todo.reminderDate !== undefined ? { reminderDate: buildDate(todo.reminderDate) } : {}),
      ...(todo.closedDate !== undefined ? { closedDate: buildDate(todo.closedDate) } : {}),
      ...(todo.repositoryId !== undefined ? { repository: xrefs.of(todo.repositoryId) } : {}),
    } as import('@doru/gedcom').TodoStructure;
  });
  return todos.length > 0 ? { todos } : {};
}

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

function buildSource(source: SourceRecord, repo: TreeRepository, xrefs: Xrefs): GedcomSourceRecord {
  const texts = source.texts ?? [];
  const data = {
    ...(source.agency !== undefined ? { agency: source.agency } : {}),
    ...(source.dataNote !== undefined ? { notes: [{ tag: 'NOTE' as const, payload: source.dataNote }] } : {}),
    ...(source.dataEvents !== undefined && source.dataEvents.length > 0
      ? {
          events: source.dataEvents.map((event) => ({
            tag: 'EVEN' as const,
            payload: [event.tag as import('@doru/gedcom').EventAttributeEnum],
            ...(event.value !== undefined ? { userDefined: [event.value] } : {}),
            ...(event.date !== undefined ? { date: buildDatePeriod(event.date) } : {}),
            ...(event.placeId !== undefined ? { place: buildPlace(repo, event.placeId, xrefs) } : {}),
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
    ...(source.certainty !== undefined ? { certainty: source.certainty as import('@doru/gedcom').QualityEnum } : {}),
    ...(source.subsequentCitationFormat !== undefined
      ? { subsequentCitationFormat: source.subsequentCitationFormat }
      : {}),
    ...(source.bibliography !== undefined ? { bibliography: source.bibliography } : {}),
    ...(source.pubDate !== undefined || source.pubPlace !== undefined
      ? {
          publicationDetails: {
            ...(source.pubDate !== undefined ? { date: buildDateExactStructure(source.pubDate) } : {}),
            ...(source.pubPlace !== undefined ? { place: source.pubPlace } : {}),
          },
        }
      : {}),
    ...(texts.length > 0
      ? {
          texts: texts.map((text) => ({
            payload: text.text,
            ...(text.mime !== undefined ? { mediaType: text.mime } : {}),
            ...(text.language !== undefined ? { language: text.language } : {}),
          })),
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
                    ...(callNumber.medium !== undefined
                      ? { medium: { payload: callNumber.medium.toUpperCase() as import('@doru/gedcom').MediaEnum } }
                      : {}),
                  })),
                }
              : {}),
          })),
        }
      : {}),
    ...(source.templateFields !== undefined && source.templateFields.length > 0
      ? {
          template: {
            tag: '_TMPLT',
            fields: source.templateFields.map((field) => ({
              tag: 'FIELD' as const,
              name: field.name,
              ...(field.value !== undefined ? { value: field.value } : {}),
            })),
          },
        }
      : {}),
    ...(source.titleId !== undefined ? { titlRef: xrefs.of(source.titleId) } : {}),
    ...(withIdentifiers(repo, 'source', source.id).length > 0
      ? { identifiers: withIdentifiers(repo, 'source', source.id) }
      : {}),
    ...withNoteList(repo, 'source', source.id, xrefs),
    ...withMediaLinks(repo, 'source', source.id, xrefs),
    ...withChanges(repo, 'source', source.id),
    ...withSubmitterLinks(repo, 'source', source.id, xrefs),
    ...withTagLinks(repo, 'source', source.id, xrefs),
  };
}

// ---------------------------------------------------------------------------
// Dates and places
// ---------------------------------------------------------------------------

function buildDetail(fact: FactRecord, repo: TreeRepository, xrefs: Xrefs): EventDetail | undefined {
  const date = buildDate(fact.date);
  const endDate = fact.endDate !== undefined ? buildDate(fact.endDate) : undefined;
  const additionalPlaces =
    fact.additionalPlaceIds !== undefined && fact.additionalPlaceIds.length > 0
      ? fact.additionalPlaceIds.map((placeId) => buildPlace(repo, placeId, xrefs))
      : undefined;
  const place: PlaceStructure | undefined =
    fact.placeId !== undefined
      ? buildPlace(repo, fact.placeId, xrefs)
      : fact.place !== undefined
        ? { tag: 'PLAC', payload: [fact.place] }
        : undefined;
  const addressRecord = fact.addressId !== undefined ? repo.getAddress(fact.addressId) : undefined;
  const address = addressRecord !== undefined ? buildAddress(addressRecord, repo, xrefs) : undefined;
  const ages = fact.ages?.filter((age) => age.role === undefined);
  const witnessAssociations = (fact.participants ?? []).flatMap((participant) => {
    if (participant.personId === undefined) {
      return [];
    }
    return [
      {
        tag: 'ASSO' as const,
        individual: xrefs.of(participant.personId),
        ...(participant.role !== undefined
          ? { role: { payload: participant.role.toUpperCase() as import('@doru/gedcom').RoleEnum } }
          : {}),
      },
    ];
  });
  const freeTextParticipants = (fact.participants ?? []).filter(
    (participant) => participant.personId === undefined && participant.value !== undefined,
  );
  const witnesses = freeTextParticipants
    .filter((participant) => participant.role?.toUpperCase() !== 'GODP')
    .map((participant) => participant.value as string);
  const godparents = freeTextParticipants
    .filter((participant) => participant.role?.toUpperCase() === 'GODP')
    .map((participant) => participant.value as string);
  const citations = withCitationList(repo, 'fact', fact.id, xrefs).citations;
  const notes = withNoteList(repo, 'fact', fact.id, xrefs).notes;
  const media = withMediaLinks(repo, 'fact', fact.id, xrefs).media;
  const restriction = repo
    .listRestrictionsFor('fact', fact.id)
    .map((entry) => entry.level.toUpperCase()) as ListEnum<RestrictionEnum>;
  const uniqueIds = repo
    .listIdentifiersFor('fact', fact.id)
    .filter((identifier) => identifier.namespace === 'uid')
    .map((identifier) => identifier.value);
  const contacts = withContacts(repo, 'fact', fact.id);
  const changes = withChanges(repo, 'fact', fact.id);
  const flags =
    fact.flags !== undefined && fact.flags.length > 0
      ? fact.flags.map((flag) => CORE_TO_GEDCOM_FACT_FLAG[flag])
      : undefined;
  const primary = fact.primary === true;
  if (
    date === undefined &&
    endDate === undefined &&
    place === undefined &&
    additionalPlaces === undefined &&
    address === undefined &&
    fact.placePrefix === undefined &&
    fact.eventNumber === undefined &&
    fact.birthLength === undefined &&
    fact.birthWeight === undefined &&
    fact.cemetery === undefined &&
    fact.fna === undefined &&
    fact.descriptionAware === undefined &&
    fact.map === undefined &&
    (ages ?? []).length === 0 &&
    witnesses.length === 0 &&
    godparents.length === 0 &&
    witnessAssociations.length === 0 &&
    citations.length === 0 &&
    notes.length === 0 &&
    media === undefined &&
    restriction.length === 0 &&
    uniqueIds.length === 0 &&
    contacts.email === undefined &&
    contacts.phone === undefined &&
    contacts.fax === undefined &&
    contacts.www === undefined &&
    changes.changeDate === undefined &&
    changes.creationDate === undefined &&
    fact.sortDate === undefined &&
    fact.agency === undefined &&
    fact.religiousAffiliation === undefined &&
    fact.cause === undefined &&
    fact.sentence === undefined &&
    fact.quality === undefined &&
    flags === undefined &&
    !primary
  ) {
    return undefined;
  }
  const firstAge = ages?.[0];
  return {
    ...(date !== undefined ? { date } : {}),
    ...(endDate !== undefined ? { endDate } : {}),
    ...(fact.sortDate !== undefined ? { sortDate: buildSortDate(fact.sortDate) } : {}),
    ...(place !== undefined ? { place } : {}),
    ...(additionalPlaces !== undefined ? { additionalPlaces } : {}),
    ...(address !== undefined ? { address } : {}),
    ...(firstAge !== undefined ? { age: buildAge(firstAge) } : {}),
    ...(fact.agency !== undefined ? { agency: fact.agency } : {}),
    ...(fact.religiousAffiliation !== undefined ? { religiousAffiliation: fact.religiousAffiliation } : {}),
    ...(fact.cause !== undefined ? { cause: fact.cause } : {}),
    ...(fact.sentence !== undefined ? { sentence: fact.sentence } : {}),
    ...(fact.quality !== undefined ? { quality: fact.quality as QualityEnum } : {}),
    ...(fact.placePrefix !== undefined ? { placePrefix: fact.placePrefix } : {}),
    ...(fact.eventNumber !== undefined ? { eventNumber: fact.eventNumber } : {}),
    ...(fact.birthLength !== undefined ? { birthLength: fact.birthLength } : {}),
    ...(fact.birthWeight !== undefined ? { birthWeight: fact.birthWeight } : {}),
    ...(fact.cemetery !== undefined ? { cemetery: fact.cemetery } : {}),
    ...(fact.fna === true ? { fna: true } : {}),
    ...(fact.descriptionAware === true ? { descriptionAware: true } : {}),
    ...(fact.map !== undefined
      ? {
          map: {
            latitude: {
              direction: fact.map.latitude >= 0 ? 'N' : 'S',
              degrees: Math.abs(fact.map.latitude),
            },
            longitude: {
              direction: fact.map.longitude >= 0 ? 'E' : 'W',
              degrees: Math.abs(fact.map.longitude),
            },
          },
        }
      : {}),
    ...(flags !== undefined ? { factFlags: flags } : {}),
    ...(primary ? { primary: true } : {}),
    ...(witnesses.length > 0 ? { witnesses } : {}),
    ...(godparents.length > 0 ? { godparents } : {}),
    ...(witnessAssociations.length > 0 ? { associations: witnessAssociations } : {}),
    ...(citations.length > 0 ? { citations } : {}),
    ...(notes.length > 0 ? { notes } : {}),
    ...(media !== undefined ? { media } : {}),
    ...(restriction.length > 0 ? { restriction } : {}),
    ...(uniqueIds.length > 0 ? { uniqueIds } : {}),
    ...contacts,
    ...changes,
  };
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
    ...(age.years !== undefined ||
    age.months !== undefined ||
    age.weeks !== undefined ||
    age.days !== undefined ||
    age.bound !== undefined
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

function buildAddress(
  address: import('../model/types').AddressRecord,
  repo: TreeRepository,
  xrefs: Xrefs,
): import('@doru/gedcom').AddressStructure {
  const privateAddress = repo.listRestrictionsFor('address', address.id).some((entry) => entry.level === 'privacy');
  return {
    ...(address.lines.length > 0 ? { payload: address.lines.map((line) => line.value).join('\n') } : {}),
    ...(address.city !== undefined ? { city: address.city } : {}),
    ...(address.state !== undefined ? { state: address.state } : {}),
    ...(address.postalCode !== undefined ? { postalCode: address.postalCode } : {}),
    ...(address.country !== undefined ? { country: address.country } : {}),
    ...(privateAddress ? { private: true } : {}),
    ...withNoteList(repo, 'address', address.id, xrefs),
    ...withContacts(repo, 'address', address.id),
  };
}

function buildPlace(repo: TreeRepository, placeId: string, xrefs: Xrefs): PlaceStructure {
  const place = repo.getPlace(placeId);
  const translations = (place?.names ?? [])
    .filter((name) => name.kind === 'translation')
    .map((name) => ({
      payload: [name.value],
      ...(name.language !== undefined ? { language: name.language } : {}),
    }));
  const phonetic = (place?.names ?? [])
    .filter((name) => name.kind === 'phonetic')
    .map((name) => ({
      payload: [name.value],
      ...(name.type !== undefined ? { type: name.type } : {}),
    }));
  const romanized = (place?.names ?? [])
    .filter((name) => name.kind === 'romanized')
    .map((name) => ({
      payload: [name.value],
      ...(name.type !== undefined ? { type: name.type } : {}),
    }));
  const officialName = place?.names.find((name) => name.kind === undefined || name.kind === 'official');
  return {
    tag: 'PLAC',
    payload: place !== undefined ? officialPlaceNames(place) : [''],
    ...(place !== undefined && place.names.some((name) => name.kind === 'translation') ? { translations } : {}),
    ...(place !== undefined && place.names.some((name) => name.kind === 'phonetic') ? { phonetic } : {}),
    ...(place !== undefined && place.names.some((name) => name.kind === 'romanized') ? { romanized } : {}),
    ...(place?.latitude !== undefined && place.longitude !== undefined
      ? {
          map: {
            latitude: { direction: place.latitude >= 0 ? 'N' : 'S', degrees: Math.abs(place.latitude) },
            longitude: { direction: place.longitude >= 0 ? 'E' : 'W', degrees: Math.abs(place.longitude) },
          },
        }
      : {}),
    ...(place?.verified === true ? { verified: true } : {}),
    ...(place !== undefined && place.form !== undefined && place.form.length > 0 ? { form: place.form } : {}),
    ...(officialName?.language !== undefined ? { language: officialName.language } : {}),
    ...(place !== undefined ? { location: xrefs.of(place.id) } : {}),
  };
}

function buildPlaceRecord(place: PlaceRecord, repo: TreeRepository, xrefs: Xrefs): GedcomPlaceRecord {
  const identifiers = withIdentifiers(repo, 'place', place.id);
  const changes = withChanges(repo, 'place', place.id);
  const names = [...place.names]
    .sort((a, b) => a.position - b.position)
    .map((name) => ({
      name: name.value,
      ...(name.language !== undefined ? { language: name.language } : {}),
      ...(name.date !== undefined ? { date: buildDate(name.date) } : {}),
      ...(name.addition !== undefined ? { addition: name.addition } : {}),
      ...(name.abbreviation !== undefined
        ? {
            abbreviations: [
              {
                abbreviation: name.abbreviation,
                ...(name.abbreviationType !== undefined ? { type: name.abbreviationType } : {}),
              },
            ],
          }
        : {}),
      ...(name.kind !== undefined && name.kind !== 'official'
        ? {
            extensions: [
              { tag: '_KIND', payload: name.kind, children: [] },
              ...(name.type !== undefined ? [{ tag: '_TYPE', payload: name.type, children: [] }] : []),
            ],
          }
        : {}),
    })) as PlaceNameStructure[];
  const parents = (place.hierarchy ?? []).map((link) => ({
    tag: '_LOC' as const,
    parent: xrefs.of(link.parentId),
    ...(link.type !== undefined ? { type: link.type.toUpperCase() as 'POLI' | 'RELI' | 'GEOG' | 'CULT' } : {}),
    ...(link.date !== undefined ? { date: buildDate(link.date) } : {}),
  })) as NonNullable<GedcomPlaceRecord['parents']>;
  const postalCodes = (place.postalCodes ?? []).map((postal) => {
    const date = postal.date !== undefined ? buildDate(postal.date) : undefined;
    return {
      code: postal.code,
      ...(date !== undefined ? { date } : {}),
    };
  }) as NonNullable<GedcomPlaceRecord['postalCodes']>;
  return {
    tag: '_PLAC',
    xref: xrefs.of(place.id),
    payload: officialPlaceNames(place).join(', '),
    ...(names.length > 0 ? { names } : {}),
    ...(place.form !== undefined ? { form: place.form.join(', ') } : {}),
    ...(place.abbreviation !== undefined ? { abbreviation: place.abbreviation } : {}),
    ...(place.preposition !== undefined ? { preposition: place.preposition } : {}),
    ...(place.govId !== undefined ? { govId: place.govId } : {}),
    ...(place.maidenhead !== undefined ? { maidenhead: place.maidenhead } : {}),
    ...(place.placeType !== undefined ? { types: [{ type: place.placeType }] } : {}),
    ...(place.latitude !== undefined && place.longitude !== undefined
      ? {
          map: {
            latitude: { direction: place.latitude >= 0 ? 'N' : 'S', degrees: Math.abs(place.latitude) },
            longitude: { direction: place.longitude >= 0 ? 'E' : 'W', degrees: Math.abs(place.longitude) },
          },
        }
      : {}),
    ...(parents.length > 0 ? { parents } : {}),
    ...(postalCodes.length > 0 ? { postalCodes } : {}),
    ...(identifiers.length > 0 ? { identifiers } : {}),
    ...(changes.changeDate !== undefined ? { changeDate: changes.changeDate } : {}),
    ...(place.verified === true ? { extensions: [{ tag: '_VERI', payload: 'Y', children: [] }] } : {}),
    ...withCitationList(repo, 'place', place.id, xrefs),
    ...withNoteList(repo, 'place', place.id, xrefs),
    ...withMediaLinks(repo, 'place', place.id, xrefs),
  };
}

function officialPlaceNames(place: PlaceRecord): string[] {
  return place.names
    .filter((name) => name.kind === undefined || name.kind === 'official')
    .sort((a, b) => a.position - b.position)
    .map((name) => name.value);
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
  };
}

function buildSortDate(date: DateValue): import('@doru/gedcom').SortDateStructure {
  const value = buildDateValue(date);
  return {
    ...(value !== undefined ? { value } : {}),
    ...(date.time !== undefined ? { time: date.time as import('@doru/gedcom').TimeValue } : {}),
    ...(date.text !== undefined ? { phrase: date.text } : {}),
  };
}

function buildDatePeriod(date: DateValue): import('@doru/gedcom').DatePeriodStructure {
  const value = buildDateValue(date);
  if (value !== undefined && value.kind !== 'period') {
    // The period structure only holds FROM/TO bounds.
    return { ...(date.text !== undefined ? { phrase: date.text } : {}) };
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
    ...(typeof component?.month === 'number'
      ? { month: MONTH_CODES[component.month - 1] as import('@doru/gedcom').GregorianMonth }
      : {}),
    ...(component?.day !== undefined ? { day: component.day } : {}),
    ...(component?.epoch !== undefined ? { epoch: component.epoch } : {}),
  };
  return {
    value: exact,
    ...(date.time !== undefined ? { time: date.time as import('@doru/gedcom').TimeValue } : {}),
  };
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
    ...(component.epoch !== undefined ? { epoch: component.epoch } : {}),
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

  has(id: string): boolean {
    return this.byId.has(id);
  }

  of(id: string): string {
    const xref = this.byId.get(id);
    if (xref === undefined) {
      throw new Error(`no export xref for record ${id}`);
    }
    return xref;
  }
}
