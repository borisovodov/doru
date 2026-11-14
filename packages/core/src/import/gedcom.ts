import type { Calendar, DateFields, DateValue as GedcomDateValue, GedcomMonth, PersonalName } from '@doru/gedcom';
import type {
  AddressStructure,
  AgeStructure,
  ChangeDate,
  CreationDate,
  DateExactStructure,
  DatePeriodStructure,
  DateStructure,
  EventDetail,
  FamilyRecord as GedcomFamilyRecord,
  GedcomDataset,
  GedcomRecord,
  IdentifierStructure,
  IndividualRecord as GedcomIndividualRecord,
  NoteReference,
  NoteStructure,
  PersonalNamePieces,
  PersonalNameStructure,
  PlaceStructure,
  SourceCitation,
  SortDateStructure,
} from '@doru/gedcom';
import { isFamilyRecord, isIndividualRecord } from '@doru/gedcom';
import type {
  OccurrenceRecord as GedcomOccurrenceRecord,
  TagLink as GedcomTagLink,
  TagRecord as GedcomTagRecord,
  TodoRecord as GedcomTodoRecord,
  TodoStructure,
} from '@doru/gedcom';
import type { TreeRepository } from '../db/repository';
import type {
  AssociationRecord,
  CitationRecord,
  ContactRecord,
  DateComponent,
  DateValue,
  FactRecord,
  FamilyChildLink,
  FamilyPartnerLink,
  NamePart,
  PersonName,
  RestrictionRecord,
  Sex,
  TodoRecord,
} from '../model/types';

/**
 * GEDCOM dataset → tree mapping. The GEDCOM object model is the subject
 * source; the tree model is Dóru's own. This module is the single place
 * where the two meet, so every projection decision (calendars, name pieces,
 * citations, …) lives here and nowhere else.
 *
 * Deliberately not imported:
 * - media (OBJE): the import policy is an open question — issue #172. File
 *   paths point at the exporting machine; nothing is imported until the
 *   policy lands. The media tables stay empty on import.
 * - the evidence/research records (`_EVID`, `_RDOC`, `_RACT`), the
 *   MagiKey census record (`_CENR`), the Legacy custom event definitions
 *   (`_EVENT_DEFN`) and the LDS ordinance structures (BAPL/CONL/ENDL/
 *   INIL/SLGC/SLGS): the parser keeps them, but the tree has no such
 *   layers — they are counted as dropped. Census data from real files
 *   arrives as CENS facts on persons.
 * - vendor-only structures (§3.2 of the schema plan): GenoPro entity
 *   records, MyHeritage tree tags, published sites, groups, USM types,
 *   vendor IDs (FamilySearch/MyHeritage/Ancestry), raw extension records,
 *   `_ALIA` duplicate-candidate records (they carry a single person pointer
 *   and have no second-person slot in our model).
 * Whole dropped record types are counted into `droppedStructures`.
 */

export interface GedcomImportResult {
  importedPersons: number;
  importedFamilies: number;
  importedSources: number;
  importedPlaces: number;
  totalPersons: number;
  /** Whole records that were deliberately not imported (vendor-only). */
  droppedStructures: number;
}

interface ImportContext {
  repo: TreeRepository;
  personIds: Map<string, string>;
  familyIds: Map<string, string>;
  sourceIds: Map<string, string>;
  repositoryIds: Map<string, string>;
  submitterIds: Map<string, string>;
  titleIds: Map<string, string>;
  noteIds: Map<string, string>;
  tagIds: Map<string, string>;
  /** Dedupe of places by their joined name within this import. */
  placeIds: Map<string, string>;
  /** Person xref → the dates carried by their FAMS links, keyed by family xref. */
  spouseLinkDates: Map<string, Map<string, DateStructure | undefined>>;
  /** Person xref → family xref → the FAMC link details (pedigree, status, relations). */
  childLinkDetails: Map<
    string,
    Map<
      string,
      {
        pedigree?: string | undefined;
        pedigreePhrase?: string | undefined;
        status?: string | undefined;
        fatherRelation?: string | undefined;
        motherRelation?: string | undefined;
      }
    >
  >;
  dropped: number;
}

/**
 * Writes the dataset into the repository in one transaction. Record ids are
 * fresh UUIDs; the GEDCOM cross-reference lands in `xref` for round-trip
 * export provenance.
 */
export function importGedcomDataset(dataset: GedcomDataset, repo: TreeRepository): GedcomImportResult {
  const ctx: ImportContext = {
    repo,
    personIds: new Map(),
    familyIds: new Map(),
    sourceIds: new Map(),
    repositoryIds: new Map(),
    submitterIds: new Map(),
    titleIds: new Map(),
    noteIds: new Map(),
    tagIds: new Map(),
    placeIds: new Map(),
    spouseLinkDates: new Map(),
    childLinkDetails: new Map(),
    dropped: 0,
  };

  let importedPersons = 0;
  let importedFamilies = 0;
  let importedSources = 0;
  repo.transaction(() => {
    importSharedNotes(dataset.records, ctx);
    importTitles(dataset.records, ctx);
    importRepositories(dataset.records, ctx);
    importSubmitters(dataset.records, ctx);
    importTags(dataset.records, ctx);
    importedSources = importSources(dataset.records, ctx);
    for (const record of dataset.records) {
      if (isIndividualRecord(record)) {
        importPerson(record, ctx);
        importedPersons += 1;
      }
    }
    for (const record of dataset.records) {
      if (isFamilyRecord(record)) {
        importFamily(record, ctx);
        importedFamilies += 1;
      }
    }
    importPersonRelations(dataset.records, ctx);
    importResearchRecords(dataset.records, ctx);
  });
  return {
    importedPersons,
    importedFamilies,
    importedSources,
    importedPlaces: ctx.placeIds.size,
    totalPersons: repo.countPersons(),
    droppedStructures: ctx.dropped,
  };
}

// ---------------------------------------------------------------------------
// Registries
// ---------------------------------------------------------------------------

// The GEDCOM header/submission metadata is not stored: the schema has no
// header table, and the exporter synthesizes a fresh header on export.

function importRepositories(records: GedcomRecord[], ctx: ImportContext): void {
  for (const record of records) {
    if (record.tag !== 'REPO') {
      continue;
    }
    const repository = record as {
      xref?: string;
      name: string;
      address?: AddressStructure;
      identifiers?: IdentifierStructure[];
      notes?: NoteStructure[];
    };
    const id = crypto.randomUUID();
    if (repository.xref !== undefined) {
      ctx.repositoryIds.set(repository.xref, id);
    }
    let addressId: string | undefined;
    if (repository.address) {
      addressId = importAddress(repository.address, ctx);
    }
    ctx.repo.insertRepository({ id, xref: repository.xref, name: repository.name, addressId });
    importIdentifiers(repository.identifiers, 'repository', id, ctx);
    importNotes(repository.notes, 'repository', id, ctx);
  }
}

function importSubmitters(records: GedcomRecord[], ctx: ImportContext): void {
  for (const record of records) {
    if (record.tag !== 'SUBM') {
      continue;
    }
    const submitter = record as {
      xref?: string;
      name: string;
      address?: AddressStructure;
      languages?: string[];
      automatedRecordId?: string;
      identifiers?: IdentifierStructure[];
      notes?: NoteStructure[];
    };
    const id = crypto.randomUUID();
    if (submitter.xref !== undefined) {
      ctx.submitterIds.set(submitter.xref, id);
    }
    let addressId: string | undefined;
    if (submitter.address) {
      addressId = importAddress(submitter.address, ctx);
    }
    ctx.repo.insertSubmitter({
      id,
      xref: submitter.xref,
      name: submitter.name,
      addressId,
      languages: submitter.languages,
    });
    if (submitter.automatedRecordId !== undefined) {
      ctx.repo.insertIdentifier({
        id: crypto.randomUUID(),
        targetType: 'submitter',
        targetId: id,
        namespace: 'rin',
        value: submitter.automatedRecordId,
      });
    }
    importIdentifiers(submitter.identifiers, 'submitter', id, ctx);
    importNotes(submitter.notes, 'submitter', id, ctx);
  }
}

function importTitles(records: GedcomRecord[], ctx: ImportContext): void {
  for (const record of records) {
    if (record.tag !== 'TITL') {
      continue;
    }
    const title = record;
    const id = crypto.randomUUID();
    if (title.xref !== undefined) {
      ctx.titleIds.set(title.xref, id);
    }
    const author = typeof title.author === 'string' ? title.author : undefined;
    ctx.repo.insertTitle({
      id,
      xref: title.xref,
      name: title.payload,
      author,
      publisher: title.publisher,
      series: title.series,
      abbreviation: title.abbreviation,
      repositoryId: title.repository ? ctx.repositoryIds.get(title.repository) : undefined,
      callNumber: title.callNumber,
      sequence: numericSequence(title.sequenceNumber),
    });
  }
}

function numericSequence(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function importTags(records: GedcomRecord[], ctx: ImportContext): void {
  for (const record of records) {
    if (record.tag !== '_TAG') {
      continue;
    }
    const tag = record as GedcomTagRecord;
    const id = crypto.randomUUID();
    if (tag.xref !== undefined) {
      ctx.tagIds.set(tag.xref, id);
    }
    if (tag.name !== undefined) {
      ctx.repo.insertTag({ id, name: tag.name });
    }
  }
}

function importAddress(address: AddressStructure, ctx: ImportContext): string {
  const id = crypto.randomUUID();
  ctx.repo.insertAddress({
    id,
    lines: address.payload ? [address.payload] : [],
    city: address.city,
    state: address.state,
    postalCode: address.postalCode,
    country: address.country,
  });
  importContacts(
    'address',
    id,
    [
      ...(address.email ?? []).map((value) => ({ kind: 'email', value })),
      ...(address.phone ?? []).map((value) => ({ kind: 'phone', value })),
      ...(address.fax ?? []).map((value) => ({ kind: 'fax', value })),
      ...(address.www ?? []).map((value) => ({ kind: 'www', value })),
    ],
    ctx,
  );
  return id;
}

// ---------------------------------------------------------------------------
// Shared notes
// ---------------------------------------------------------------------------

function importSharedNotes(records: GedcomRecord[], ctx: ImportContext): void {
  for (const record of records) {
    if (record.tag !== 'NOTE' && record.tag !== 'SNOTE') {
      continue;
    }
    const note = record as {
      xref?: string;
      payload: string;
      mediaType?: string;
      language?: string;
      translations?: Array<{ payload: string; mediaType?: string; language?: string }>;
      citations?: import('@doru/gedcom').SourceCitation[];
    };
    if (note.xref === undefined) {
      continue;
    }
    const id = crypto.randomUUID();
    ctx.noteIds.set(note.xref, id);
    ctx.repo.insertNote({
      id,
      xref: note.xref,
      text: note.payload,
      mime: note.mediaType,
      language: note.language,
      translations: note.translations?.map((translation) => ({
        id: crypto.randomUUID(),
        text: translation.payload,
        mime: translation.mediaType,
        language: translation.language,
      })),
    });
    importCitations(note.citations, 'note', id, ctx);
  }
}

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

function importSources(records: GedcomRecord[], ctx: ImportContext): number {
  let imported = 0;
  for (const record of records) {
    if (record.tag !== 'SOUR') {
      continue;
    }
    const source = record;
    const id = crypto.randomUUID();
    if (source.xref !== undefined) {
      ctx.sourceIds.set(source.xref, id);
    }
    const texts = source.text
      ? [
          {
            id: crypto.randomUUID(),
            text: source.text.payload,
            mime: source.text.mediaType,
            language: source.text.language,
          },
        ]
      : undefined;
    const dataEvents = (source.data?.events ?? []).map((event) => {
      const date = mapDatePeriod(event.date);
      const placeId = event.place ? importPlace(event.place, ctx) : undefined;
      return {
        id: crypto.randomUUID(),
        tag: event.payload[0] ?? '',
        ...(event.userDefined?.[0] !== undefined ? { value: event.userDefined[0] } : {}),
        ...(date !== undefined ? { date } : {}),
        ...(placeId !== undefined ? { placeId } : {}),
      };
    });
    const repositories = (source.repositoryCitations ?? []).flatMap((citation) => {
      const repositoryId = ctx.repositoryIds.get(citation.repository);
      if (repositoryId === undefined) {
        return [];
      }
      return [
        {
          id: crypto.randomUUID(),
          repositoryId,
          callNumbers: (citation.callNumbers ?? []).map((callNumber) => ({
            id: crypto.randomUUID(),
            value: callNumber.payload,
            ...(callNumber.medium?.payload !== undefined ? { medium: callNumber.medium.payload } : {}),
          })),
        },
      ];
    });
    ctx.repo.insertSource({
      id,
      xref: source.xref,
      title: source.title ?? source.abbreviation ?? source.author ?? `Source ${source.xref ?? ''}`.trim(),
      abbreviation: source.abbreviation,
      author: source.author,
      publication: source.publication,
      medium: source.medium,
      url: source.url,
      accessDate: source.accessDate,
      confidence: source.confidence,
      pubDate: source.publicationDetails?.date
        ? mapDateExact({ value: source.publicationDetails.date.value })
        : undefined,
      pubPlace: source.publicationDetails?.place,
      agency: source.data?.agency,
      titleId: source.titlRef ? ctx.titleIds.get(source.titlRef) : undefined,
      texts,
      dataEvents,
      repositories,
      templateFields: (source.template?.fields ?? []).map((field) => ({
        id: crypto.randomUUID(),
        name: field.name,
        ...(field.value !== undefined ? { value: field.value } : {}),
      })),
    });
    importNotes(source.notes, 'source', id, ctx);
    importIdentifiers(source.identifiers, 'source', id, ctx);
    imported += 1;
  }
  return imported;
}

// ---------------------------------------------------------------------------
// Persons
// ---------------------------------------------------------------------------

function importPerson(record: GedcomIndividualRecord, ctx: ImportContext): void {
  const id = crypto.randomUUID();
  if (record.xref !== undefined) {
    ctx.personIds.set(record.xref, id);
  }
  // FAMS dates are carried on the person side in GEDCOM; families look them
  // up when building their partner links.
  const famsDates = new Map<string, DateStructure | undefined>();
  for (const link of record.spouseFamilies ?? []) {
    famsDates.set(link.family, link.date);
  }
  if (record.xref !== undefined) {
    ctx.spouseLinkDates.set(record.xref, famsDates);
  }
  const famcDetails = new Map<
    string,
    {
      pedigree?: string | undefined;
      pedigreePhrase?: string | undefined;
      status?: string | undefined;
      fatherRelation?: string | undefined;
      motherRelation?: string | undefined;
    }
  >();
  for (const link of record.childFamilies ?? []) {
    famcDetails.set(link.family, {
      pedigree: link.pedigree?.payload.toLowerCase(),
      pedigreePhrase: link.pedigree?.phrase,
      status: link.status?.payload.toLowerCase(),
      fatherRelation: link.fatherRelation,
      motherRelation: link.motherRelation,
    });
  }
  if (record.xref !== undefined) {
    ctx.childLinkDetails.set(record.xref, famcDetails);
  }

  const structures = (record.names ?? []).map((structure) => ({ structure, name: mapName(structure) }));
  const names = structures.map((entry) => entry.name);
  const factStructures = [...(record.events ?? []), ...(record.attributes ?? [])];
  const facts = factStructures.map((structure) =>
    mapFact(
      {
        id: crypto.randomUUID(),
        personId: id,
        tag: structure.tag,
        type: structure.type,
        payload: structure.payload,
      },
      structure.detail,
      structure.detail?.age,
      ctx,
    ),
  );
  for (const nonEvent of record.nonEvents ?? []) {
    facts.push({
      id: crypto.randomUUID(),
      personId: id,
      tag: nonEvent.payload,
      negation: true,
      date: mapDatePeriod(nonEvent.date),
    });
  }
  ctx.repo.insertPerson({
    id,
    xref: record.xref,
    sex: mapSex(record.sex),
    names,
    facts,
  });

  for (const { structure, name } of structures) {
    importCitations(structure.citations, 'name', name.id, ctx);
    importNotes(structure.notes, 'name', name.id, ctx);
  }
  factStructures.forEach((structure, index) => {
    const fact = facts[index];
    if (fact === undefined) {
      return;
    }
    importCitations(structure.detail?.citations, 'fact', fact.id, ctx);
    importNotes(structure.detail?.notes, 'fact', fact.id, ctx);
    importAddressContacts(structure.detail, fact.id, ctx);
  });
  record.nonEvents?.forEach((nonEvent, index) => {
    const fact = facts[factStructures.length + index];
    if (fact !== undefined) {
      importCitations(nonEvent.citations, 'fact', fact.id, ctx);
      importNotes(nonEvent.notes, 'fact', fact.id, ctx);
    }
  });
  importCitations(record.citations, 'person', id, ctx);
  importNotes(record.notes, 'person', id, ctx);
  importIdentifiers(record.identifiers, 'person', id, ctx);
  if (record.automatedRecordId !== undefined) {
    ctx.repo.insertIdentifier({
      id: crypto.randomUUID(),
      targetType: 'person',
      targetId: id,
      namespace: 'rin',
      value: record.automatedRecordId,
    });
  }
  if (record.sosaNumber !== undefined) {
    ctx.repo.insertIdentifier({
      id: crypto.randomUUID(),
      targetType: 'person',
      targetId: id,
      namespace: 'sosa',
      value: record.sosaNumber,
    });
  }
  if (record.sosaDAboville !== undefined) {
    ctx.repo.insertIdentifier({
      id: crypto.randomUUID(),
      targetType: 'person',
      targetId: id,
      namespace: 'daboville',
      value: record.sosaDAboville,
    });
  }
  importContacts(
    'person',
    id,
    [
      ...(record.email ?? []).map((value) => ({ kind: 'email', value })),
      ...(record.phone ?? []).map((value) => ({ kind: 'phone', value })),
      ...(record.fax ?? []).map((value) => ({ kind: 'fax', value })),
      ...(record.url ? [{ kind: 'url', value: record.url }] : []),
    ],
    ctx,
  );
  importRestrictions(record.restriction, 'person', id, ctx);
  importChanges(record.changeDate, record.creationDate, 'person', id, ctx);
  importSubmitterLinks(record.submitters, 'person', id, ctx);
  for (const tagLink of record.tagLinks ?? []) {
    importTagLink(tagLink, 'person', id, ctx);
  }
  for (const todo of record.todos ?? []) {
    importTodoStructure(todo, 'person', id, ctx);
  }
  // Associations and aliases need the other persons — deferred
  // to importPersonRelations, resolved after every person and family exists.
}

function mapFact(
  base: {
    id: string;
    personId?: string | undefined;
    familyId?: string | undefined;
    tag: string;
    type?: string | undefined;
    payload?: string | number | undefined;
  },
  detail: EventDetail | undefined,
  age: AgeStructure | undefined,
  ctx: ImportContext,
): FactRecord {
  return {
    id: base.id,
    personId: base.personId,
    familyId: base.familyId,
    tag: base.tag,
    type: base.type,
    value: base.payload === undefined || base.payload === 'Y' ? undefined : String(base.payload),
    date: mapDate(detail?.date),
    sortDate: mapSortDate(detail?.sortDate),
    placeId: detail?.place ? importPlace(detail.place, ctx) : undefined,
    place: mapPlaceText(detail?.place),
    addressId: detail?.address ? importAddress(detail.address, ctx) : undefined,
    agency: detail?.agency,
    religiousAffiliation: detail?.religiousAffiliation,
    cause: detail?.cause,
    sentence: detail?.sentence,
    quality: detail?.quality,
    ages: mapAges(age),
    participants: mapParticipants(detail, ctx),
    flags: detail?.factFlags,
  };
}

function mapAges(age: AgeStructure | undefined): FactRecord['ages'] {
  if (age === undefined) {
    return undefined;
  }
  return [mapAge(age, undefined)];
}

function mapAge(age: AgeStructure, role: string | undefined): NonNullable<FactRecord['ages']>[number] {
  return {
    id: crypto.randomUUID(),
    role,
    bound: age.payload?.bound,
    years: age.payload?.years,
    months: age.payload?.months,
    weeks: age.payload?.weeks,
    days: age.payload?.days,
    phrase: age.phrase ?? age.payload?.description,
  };
}

function mapParticipants(detail: EventDetail | undefined, ctx: ImportContext): FactRecord['participants'] {
  const participants: NonNullable<FactRecord['participants']> = [];
  for (const witness of detail?.witnesses ?? []) {
    participants.push({ id: crypto.randomUUID(), value: witness, role: 'WITN', position: participants.length });
  }
  for (const association of detail?.associations ?? []) {
    const personId = association.individual === '@VOID@' ? undefined : ctx.personIds.get(association.individual);
    participants.push({
      id: crypto.randomUUID(),
      personId,
      value: personId === undefined ? association.phrase : undefined,
      role: association.role?.payload ?? association.relationship,
      position: participants.length,
    });
  }
  return participants.length > 0 ? participants : undefined;
}

function importAddressContacts(detail: EventDetail | undefined, targetId: string, ctx: ImportContext): void {
  if (detail?.address === undefined) {
    return;
  }
  importContacts(
    'fact',
    targetId,
    [
      ...(detail.address.email ?? []).map((value) => ({ kind: 'email', value })),
      ...(detail.address.phone ?? []).map((value) => ({ kind: 'phone', value })),
      ...(detail.address.fax ?? []).map((value) => ({ kind: 'fax', value })),
      ...(detail.address.www ?? []).map((value) => ({ kind: 'www', value })),
    ],
    ctx,
  );
}

function mapName(structure: PersonalNameStructure): PersonName {
  const payload = structure.payload;
  const pieces = structure.pieces;
  const parts = nameParts(payload, pieces);
  const full = joinName(payload, pieces);
  const type = structure.type
    ? structure.type.payload.toLowerCase() === 'other' && structure.type.phrase !== undefined
      ? structure.type.phrase
      : structure.type.payload.toLowerCase()
    : undefined;
  const name: PersonName = {
    id: crypto.randomUUID(),
    type,
    primary: structure.primary,
    full: full || undefined,
    parts: parts.length > 0 ? parts : undefined,
  };
  const variants = [
    ...(structure.translations ?? []).map((translation) =>
      mapNameVariant(translation.payload, translation.pieces, 'translation', translation.language),
    ),
    ...(structure.phonetic ?? []).map((variation) =>
      mapNameVariant(variation.payload, variation.pieces, 'phonetic', undefined),
    ),
    ...(structure.romanized ?? []).map((variation) =>
      mapNameVariant(variation.payload, variation.pieces, 'romanized', undefined),
    ),
  ];
  if (variants.length > 0) {
    name.variants = variants;
  }
  return name;
}

function mapNameVariant(
  payload: PersonalName,
  pieces: PersonalNamePieces | undefined,
  kind: 'translation' | 'phonetic' | 'romanized',
  language: string | undefined,
): PersonName {
  const parts = nameParts(payload, pieces);
  return {
    id: crypto.randomUUID(),
    kind,
    language,
    full: joinName(payload, pieces) || undefined,
    parts: parts.length > 0 ? parts : undefined,
  };
}

function nameParts(payload: PersonalName, pieces: PersonalNamePieces | undefined): NamePart[] {
  const parts: NamePart[] = [];
  const push = (kind: NamePart['kind'], values: string[]): void => {
    for (const value of values) {
      if (value.trim() !== '') {
        parts.push({ id: crypto.randomUUID(), kind, value, position: parts.length });
      }
    }
  };
  push('prefix', pieces?.namePrefixes ?? []);
  push('given', pieces?.givenNames ?? (payload.given ? [payload.given] : []));
  push('nickname', pieces?.nicknames ?? []);
  push('surnamePrefix', pieces?.surnamePrefixes ?? []);
  push('surname', pieces?.surnames ?? (payload.surname ? [payload.surname] : []));
  push('suffix', pieces?.nameSuffixes ?? (payload.suffix ? [payload.suffix] : []));
  return parts;
}

function joinName(payload: PersonalName, pieces: PersonalNamePieces | undefined): string {
  const given = pieces?.givenNames?.join(' ') || payload.given || '';
  const surname = pieces?.surnames?.join(' ') || payload.surname || '';
  const suffix = pieces?.nameSuffixes?.join(' ') || payload.suffix || '';
  return [given, surname, suffix].filter((part) => part !== '').join(' ');
}

function mapSex(sex: GedcomIndividualRecord['sex']): Sex {
  switch (sex) {
    case 'M':
    case 'F':
    case 'X':
    case 'U':
      return sex;
    default:
      // 'N' (not recorded) and extension values have no tree slot.
      return 'U';
  }
}

// ---------------------------------------------------------------------------
// Families
// ---------------------------------------------------------------------------

function importFamily(record: GedcomFamilyRecord, ctx: ImportContext): void {
  const id = crypto.randomUUID();
  if (record.xref !== undefined) {
    ctx.familyIds.set(record.xref, id);
  }
  const partnerLinks: FamilyPartnerLink[] = [];
  for (const link of [record.husband, record.wife]) {
    if (!link) {
      continue;
    }
    const personId = ctx.personIds.get(link.partner);
    if (personId === undefined) {
      continue;
    }
    const date = ctx.spouseLinkDates.get(link.partner)?.get(record.xref ?? '');
    partnerLinks.push({
      id: crypto.randomUUID(),
      personId,
      preferred: link.preferred,
      date: date ? mapDate(date) : undefined,
    });
  }
  const childLinks: FamilyChildLink[] = [];
  for (const link of record.children ?? []) {
    const personId = ctx.personIds.get(link.child);
    if (personId === undefined) {
      continue;
    }
    const pedigree = link.pedigrees?.[0]?.pedigree;
    const details = ctx.childLinkDetails.get(link.child)?.get(record.xref ?? '');
    childLinks.push({
      id: crypto.randomUUID(),
      childId: personId,
      pedigree: pedigree?.payload.toLowerCase() ?? details?.pedigree,
      pedigreePhrase: pedigree?.phrase ?? details?.pedigreePhrase,
      status: details?.status,
      fatherRelation: link.fatherRelation ?? details?.fatherRelation,
      motherRelation: link.motherRelation ?? details?.motherRelation,
    });
  }
  ctx.repo.insertFamily({
    id,
    xref: record.xref,
    partners: partnerLinks.map((link) => link.personId),
    children: childLinks.map((link) => link.childId),
    partnerLinks,
    childLinks,
  });
  const childrenByXref = new Map<string, NoteStructure[] | undefined>();
  for (const link of record.children ?? []) {
    childrenByXref.set(link.child, link.notes);
  }
  for (const link of childLinks) {
    const notes = [...childrenByXref.entries()].find(
      ([childXref]) => ctx.personIds.get(childXref) === link.childId,
    )?.[1];
    importNotes(notes, 'family_child', link.id, ctx);
  }

  const factStructures = [...(record.events ?? []), ...(record.attributes ?? [])];
  const facts: FactRecord[] = [];
  for (const structure of factStructures) {
    const detail = structure.detail?.detail;
    const fact = mapFact(
      {
        id: crypto.randomUUID(),
        familyId: id,
        tag: structure.tag,
        type: structure.type,
        payload: structure.payload,
      },
      detail,
      undefined,
      ctx,
    );
    const husbandAge = structure.detail?.husband?.age;
    const wifeAge = structure.detail?.wife?.age;
    if (husbandAge !== undefined || wifeAge !== undefined) {
      const ages: NonNullable<FactRecord['ages']> = [];
      if (husbandAge !== undefined) {
        ages.push(mapAge(husbandAge, 'HUSB'));
      }
      if (wifeAge !== undefined) {
        ages.push(mapAge(wifeAge, 'WIFE'));
      }
      fact.ages = ages;
    }
    facts.push(fact);
  }
  for (const nonEvent of record.nonEvents ?? []) {
    facts.push({
      id: crypto.randomUUID(),
      familyId: id,
      tag: nonEvent.payload,
      negation: true,
      date: mapDatePeriod(nonEvent.date),
    });
  }
  facts.forEach((fact, index) => {
    ctx.repo.insertFact(fact);
    const structure = factStructures[index];
    const detail = structure?.detail?.detail;
    importCitations(detail?.citations, 'fact', fact.id, ctx);
    importNotes(detail?.notes, 'fact', fact.id, ctx);
  });
  record.nonEvents?.forEach((nonEvent, index) => {
    const fact = facts[factStructures.length + index];
    if (fact !== undefined) {
      importCitations(nonEvent.citations, 'fact', fact.id, ctx);
      importNotes(nonEvent.notes, 'fact', fact.id, ctx);
    }
  });

  importCitations(record.citations, 'family', id, ctx);
  importNotes(record.notes, 'family', id, ctx);
  importIdentifiers(record.identifiers, 'family', id, ctx);
  importRestrictions(record.restriction, 'family', id, ctx);
  importChanges(record.changeDate, undefined, 'family', id, ctx);
  importSubmitterLinks(record.submitters, 'family', id, ctx);
  for (const tagLink of record.tagLinks ?? []) {
    importTagLink(tagLink, 'family', id, ctx);
  }
  for (const todo of record.todos ?? []) {
    importTodoStructure(todo, 'family', id, ctx);
  }
}

// ---------------------------------------------------------------------------
// Person relations (resolved after every person and family exists)
// ---------------------------------------------------------------------------

function importPersonRelations(records: GedcomRecord[], ctx: ImportContext): void {
  for (const record of records) {
    if (!isIndividualRecord(record)) {
      continue;
    }
    const personId = ctx.personIds.get(record.xref ?? '');
    if (personId === undefined) {
      continue;
    }
    for (const association of record.associations ?? []) {
      const otherId = association.individual === '@VOID@' ? undefined : ctx.personIds.get(association.individual);
      if (otherId === undefined) {
        continue;
      }
      const mapped: AssociationRecord = {
        id: crypto.randomUUID(),
        personId,
        otherPersonId: otherId,
        role: association.role?.payload,
        // 5.5.1 RELA lands in the 7.0 parser as a free-form ROLE phrase.
        relationship: association.relationship ?? association.role?.phrase,
        phrase: association.phrase,
        primary: association.primary,
        specificType: association.specificType,
        confidence: association.confidence,
        periodStart: mapDate(association.period?.start),
        periodEnd: mapDate(association.period?.end),
      };
      ctx.repo.insertAssociation(mapped);
      importCitations(association.citations, 'association', mapped.id, ctx);
      importNotes(association.notes, 'association', mapped.id, ctx);
    }
    for (const alias of record.aliases ?? []) {
      const aliasId = ctx.personIds.get(alias.individual);
      if (aliasId !== undefined) {
        ctx.repo.insertAlias(crypto.randomUUID(), personId, aliasId);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Research records
// ---------------------------------------------------------------------------

function importResearchRecords(records: GedcomRecord[], ctx: ImportContext): void {
  for (const record of records) {
    switch (record.tag) {
      case '_EVID':
      case '_RDOC':
      case '_RACT':
      case '_CENR':
        // The evidence/research records (the glamberson gedcom-evidence
        // extension) and the MagiKey census record stay in the
        // @doru/gedcom model but are deliberately not carried into the
        // tree. Census data imported from real files arrives as CENS
        // facts on persons.
        ctx.dropped += 1;
        break;
      case '_TODO':
        importTodoRecord(record as GedcomTodoRecord, ctx);
        break;
      case '_EVENT_DEFN':
        // The Legacy custom event definitions stay in the @doru/gedcom
        // model; the tree has no fact-type registry.
        ctx.dropped += 1;
        break;
      case '_OCUR':
        importOccurrence(record as GedcomOccurrenceRecord, ctx);
        break;
      case 'OBJE':
        // Media import policy is open (issue #172); nothing is imported.
        ctx.dropped += 1;
        break;
      case '_ALIA':
        // The duplicate-candidate record carries a single person pointer and
        // has no second-person slot in our model.
        ctx.dropped += 1;
        break;
      case '_PLAC':
      case '_GRP':
      case '_PUBLISH':
      case '_MTTAG':
      case '_MTCAT':
      case 'Occupation':
      case 'Education':
      case 'Contact':
      case 'Marriage':
      case 'Twin':
        // Vendor-only records (GenoPro entities, MyHeritage tree tags, …).
        ctx.dropped += 1;
        break;
      default:
        break;
    }
  }
}

function importTodoRecord(record: GedcomTodoRecord, ctx: ImportContext): void {
  const id = crypto.randomUUID();
  ctx.repo.insertTodo({
    id,
    text: record.payload || record.title || '',
    category: record.category,
    locality: record.locality,
    priority: record.priority,
    status: record.status,
  });
  for (const uid of record.uids ?? []) {
    ctx.repo.insertIdentifier({
      id: crypto.randomUUID(),
      targetType: 'todo',
      targetId: id,
      namespace: 'uid',
      value: uid,
    });
  }
}

function importTodoStructure(todo: TodoStructure, targetType: string, targetId: string, ctx: ImportContext): void {
  const mapped: TodoRecord = {
    id: crypto.randomUUID(),
    text: todo.payload ?? todo.description ?? '',
    targetType,
    targetId,
    category: todo.category,
    locality: todo.locality,
    priority: todo.priority,
    status: todo.status,
    scheduledDate: mapDate(todo.date),
    reminderDate: mapDate(todo.reminderDate),
    closedDate: mapDate(todo.closedDate),
  };
  ctx.repo.insertTodo(mapped);
  importNotes(todo.notes, 'todo', mapped.id, ctx);
}

function importOccurrence(record: GedcomOccurrenceRecord, ctx: ImportContext): void {
  const participants = (record.participants ?? []).map((participant) => ({
    personId: ctx.personIds.get(participant.individual),
    role: participant.role,
  }));
  if (participants.length === 0) {
    ctx.dropped += 1;
    return;
  }
  for (const participant of participants) {
    if (participant.personId === undefined) {
      continue;
    }
    const fact: FactRecord = {
      id: crypto.randomUUID(),
      personId: participant.personId,
      tag: 'EVEN',
      type: record.type,
      date: mapDate(record.date),
      placeId: record.place ? importPlace(record.place, ctx) : undefined,
      place: mapPlaceText(record.place),
      agency: record.agency,
      religiousAffiliation: record.religion,
      cause: record.cause,
      participants: participants.map((entry, position) => ({
        id: crypto.randomUUID(),
        personId: entry.personId,
        role: entry.role,
        position,
      })),
    };
    ctx.repo.insertFact(fact);
  }
}

// ---------------------------------------------------------------------------
// Shared mapping helpers
// ---------------------------------------------------------------------------

function importCitation(citation: SourceCitation, targetType: string, targetId: string, ctx: ImportContext): void {
  const sourceId = ctx.sourceIds.get(citation.source);
  if (sourceId === undefined) {
    // A void pointer or an unknown xref: nothing to cite in the tree.
    return;
  }
  const mapped: CitationRecord = {
    id: crypto.randomUUID(),
    sourceId,
    targetType,
    targetId,
    description: citation.description,
    page: citation.page?.payload,
    quality: citation.quality,
    confidence: citation.confidence,
    event: citation.event?.payload,
    role: citation.event?.role?.payload,
    phrase: citation.event?.phrase,
    date: mapDate(citation.data?.date),
    www: citation.data?.www,
    texts: (citation.data?.texts ?? []).map((text) => ({
      id: crypto.randomUUID(),
      text: text.payload,
      mime: text.mediaType,
      language: text.language,
    })),
    templateFields: (citation.template?.fields ?? []).map((field) => ({
      id: crypto.randomUUID(),
      name: field.name,
      ...(field.value !== undefined ? { value: field.value } : {}),
    })),
  };
  ctx.repo.insertCitation(mapped);
  importNotes(citation.notes, 'citation', mapped.id, ctx);
}

function importCitations(
  citations: SourceCitation[] | undefined,
  targetType: string,
  targetId: string,
  ctx: ImportContext,
): void {
  for (const citation of citations ?? []) {
    importCitation(citation, targetType, targetId, ctx);
  }
}

function importNotes(
  structures: NoteStructure[] | undefined,
  targetType: string,
  targetId: string,
  ctx: ImportContext,
): void {
  for (const structure of structures ?? []) {
    if ('note' in structure) {
      // A reference to a shared NOTE/SNOTE record.
      const noteId = ctx.noteIds.get(structure.note);
      if (noteId === undefined) {
        continue;
      }
      ctx.repo.addNoteLink(noteId, { id: crypto.randomUUID(), targetType, targetId });
      importCitations((structure as NoteReference).citations, 'note', noteId, ctx);
      continue;
    }
    const note = structure;
    const id = crypto.randomUUID();
    ctx.repo.insertNote({
      id,
      text: note.payload,
      mime: note.mediaType,
      language: note.language,
      links: [{ id: crypto.randomUUID(), targetType, targetId }],
      translations: note.translations?.map((translation) => ({
        id: crypto.randomUUID(),
        text: translation.payload,
        mime: translation.mediaType,
        language: translation.language,
      })),
    });
    importCitations(note.citations, 'note', id, ctx);
  }
}

function importIdentifiers(
  structures: IdentifierStructure[] | undefined,
  targetType: string,
  targetId: string,
  ctx: ImportContext,
): void {
  for (const structure of structures ?? []) {
    const namespace = structure.tag === 'UID' ? 'uid' : structure.tag === 'EXID' ? 'exid' : 'refn';
    ctx.repo.insertIdentifier({
      id: crypto.randomUUID(),
      targetType,
      targetId,
      namespace,
      value: structure.payload,
    });
  }
}

function importContacts(
  targetType: string,
  targetId: string,
  contacts: Array<{ kind: string; value: string }>,
  ctx: ImportContext,
): void {
  for (const contact of contacts) {
    if (contact.value.trim() === '') {
      continue;
    }
    const mapped: ContactRecord = {
      id: crypto.randomUUID(),
      targetType,
      targetId,
      kind: contact.kind,
      value: contact.value,
    };
    ctx.repo.insertContact(mapped);
  }
}

function importRestrictions(
  restriction: string[] | undefined,
  targetType: string,
  targetId: string,
  ctx: ImportContext,
): void {
  for (const level of restriction ?? []) {
    const mapped: RestrictionRecord = {
      id: crypto.randomUUID(),
      targetType,
      targetId,
      level: level.toLowerCase(),
    };
    ctx.repo.insertRestriction(mapped);
  }
}

function importChanges(
  changeDate: ChangeDate | undefined,
  creationDate: CreationDate | undefined,
  targetType: string,
  targetId: string,
  ctx: ImportContext,
): void {
  if (creationDate !== undefined) {
    ctx.repo.insertChange({
      id: crypto.randomUUID(),
      targetType,
      targetId,
      kind: 'created',
      date: mapDateExact(creationDate.date),
    });
  }
  if (changeDate !== undefined) {
    ctx.repo.insertChange({
      id: crypto.randomUUID(),
      targetType,
      targetId,
      kind: 'changed',
      date: mapDateExact(changeDate.date),
      user: changeDate.user,
    });
  }
}

function importSubmitterLinks(
  submitters: string[] | undefined,
  targetType: string,
  targetId: string,
  ctx: ImportContext,
): void {
  for (const submitter of submitters ?? []) {
    const submitterId = ctx.submitterIds.get(submitter);
    if (submitterId !== undefined) {
      ctx.repo.insertRecordSubmitter(crypto.randomUUID(), submitterId, targetType, targetId);
    }
  }
}

function importTagLink(tagLink: GedcomTagLink, targetType: string, targetId: string, ctx: ImportContext): void {
  const tagId = ctx.tagIds.get(tagLink.target);
  if (tagId === undefined) {
    return;
  }
  ctx.repo.insertTagLink({
    id: crypto.randomUUID(),
    tagId,
    targetType,
    targetId,
    date: mapDate(tagLink.date),
  });
}

// ---------------------------------------------------------------------------
// Dates and places
// ---------------------------------------------------------------------------

function mapDate(structure: DateStructure | undefined): DateValue | undefined {
  const value = structure?.value;
  const phrase = structure?.phrase;
  if (value === undefined) {
    return phrase ? { quality: 'unknown', text: phrase } : undefined;
  }
  const date = mapDateValue(value);
  const withTime = structure?.time ? { ...date, time: mapTime(structure.time) } : date;
  return phrase ? { ...withTime, text: phrase } : withTime;
}

function mapSortDate(structure: SortDateStructure | undefined): DateValue | undefined {
  const value = structure?.value;
  const phrase = structure?.phrase;
  if (value === undefined) {
    return phrase ? { quality: 'unknown', text: phrase } : undefined;
  }
  const date = mapDateValue(value);
  const withTime = structure?.time ? { ...date, time: mapTime(structure.time) } : date;
  return phrase ? { ...withTime, text: phrase } : withTime;
}

function mapDatePeriod(structure: DatePeriodStructure | undefined): DateValue | undefined {
  const value = structure?.value;
  if (value === undefined) {
    return structure?.phrase ? { quality: 'unknown', text: structure.phrase } : undefined;
  }
  return {
    quality: 'range',
    component: value.from ? mapDateFields(value.from) : undefined,
    end: value.to ? mapDateFields(value.to) : undefined,
  };
}

function mapDateExact(structure: DateExactStructure | undefined): DateValue | undefined {
  if (structure === undefined) {
    return undefined;
  }
  const fields: DateFields = {
    ...(structure.value.year !== undefined ? { year: structure.value.year } : {}),
    ...(structure.value.month !== undefined ? { month: structure.value.month } : {}),
    ...(structure.value.day !== undefined ? { day: structure.value.day } : {}),
    ...(structure.value.epoch !== undefined ? { epoch: structure.value.epoch } : {}),
  };
  const date: DateValue = { quality: 'exact', component: mapDateFields(fields) };
  return structure.time ? { ...date, time: mapTime(structure.time) } : date;
}

function mapTime(time: {
  hour: number;
  minute: number;
  second?: number;
  fraction?: string;
  utc?: true;
}): DateValue['time'] {
  return { hour: time.hour, minute: time.minute, second: time.second, fraction: time.fraction, utc: time.utc };
}

function mapDateValue(value: GedcomDateValue): DateValue {
  switch (value.kind) {
    case 'date':
      return { quality: 'exact', component: mapDateFields(value) };
    case 'range':
      return { quality: 'range', component: mapDateFields(value.start), end: mapDateFields(value.end) };
    case 'bound':
      return { quality: value.modifier === 'BEF' ? 'before' : 'after', component: mapDateFields(value.date) };
    case 'approx':
      return { quality: 'about', modifier: value.modifier, component: mapDateFields(value.date) };
    case 'period':
      return {
        quality: 'range',
        component: value.from ? mapDateFields(value.from) : undefined,
        end: value.to ? mapDateFields(value.to) : undefined,
      };
    case 'unknown':
      return { quality: 'unknown' };
  }
}

function mapDateFields(fields: DateFields): DateComponent | undefined {
  const component: DateComponent = {
    calendar: fields.calendar ? mapCalendar(fields.calendar) : undefined,
    year: fields.year,
    month: mapMonth(fields.month, fields.calendar),
    day: fields.day,
    epoch: fields.epoch === 'BCE' ? 'BCE' : undefined,
  };
  return component.calendar !== undefined ||
    component.year !== undefined ||
    component.month !== undefined ||
    component.day !== undefined ||
    component.epoch !== undefined
    ? component
    : undefined;
}

/** The tree's canonical calendar names; extension calendars stay verbatim. */
function mapCalendar(calendar: Calendar): string | undefined {
  switch (calendar) {
    case 'GREGORIAN':
      return undefined;
    case 'JULIAN':
      return 'julian';
    case 'FRENCH_R':
      return 'french_republican';
    case 'HEBREW':
      return 'hebrew';
    default:
      return calendar;
  }
}

const GREGORIAN_MONTH_NUMBERS: Record<string, number> = {
  JAN: 1,
  FEB: 2,
  MAR: 3,
  APR: 4,
  MAY: 5,
  JUN: 6,
  JUL: 7,
  AUG: 8,
  SEP: 9,
  OCT: 10,
  NOV: 11,
  DEC: 12,
};

/**
 * Gregorian/Julian months become the numbers the editor understands; the
 * other calendars keep their native month codes until the UI learns them.
 */
function mapMonth(month: GedcomMonth | undefined, calendar: Calendar | undefined): number | string | undefined {
  if (month === undefined) {
    return undefined;
  }
  if (calendar === undefined || calendar === 'GREGORIAN' || calendar === 'JULIAN') {
    return GREGORIAN_MONTH_NUMBERS[month] ?? month;
  }
  return month;
}

function mapPlaceText(place: PlaceStructure | undefined): string | undefined {
  if (!place || place.payload.length === 0) {
    return undefined;
  }
  return place.payload.join(', ');
}

/**
 * Creates (or reuses, by joined name) the place row for a GEDCOM place
 * structure, carrying the jurisdiction names, coordinates and variants.
 */
function importPlace(place: PlaceStructure, ctx: ImportContext): string | undefined {
  const joined = mapPlaceText(place);
  if (joined === undefined) {
    return undefined;
  }
  const existing = ctx.placeIds.get(joined);
  if (existing !== undefined) {
    return existing;
  }
  const id = crypto.randomUUID();
  const names = place.payload.map((value, position) => ({
    id: crypto.randomUUID(),
    kind: 'official' as const,
    position,
    value,
  }));
  const variants = [
    ...(place.translations ?? []).map((translation) => ({
      id: crypto.randomUUID(),
      kind: 'translation' as const,
      language: translation.language,
      position: 0,
      value: translation.payload.join(', '),
    })),
    ...(place.phonetic ?? []).map((variation) => ({
      id: crypto.randomUUID(),
      kind: 'phonetic' as const,
      type: variation.type,
      position: 0,
      value: variation.payload.join(', '),
    })),
    ...(place.romanized ?? []).map((variation) => ({
      id: crypto.randomUUID(),
      kind: 'romanized' as const,
      type: variation.type,
      position: 0,
      value: variation.payload.join(', '),
    })),
  ];
  ctx.repo.insertPlace({
    id,
    latitude: place.map?.latitude ? place.map.latitude.degrees : undefined,
    longitude: place.map?.longitude ? place.map.longitude.degrees : undefined,
    names: [...names, ...variants],
  });
  importCitations(place.citations, 'place', id, ctx);
  importNotes(place.notes, 'place', id, ctx);
  ctx.placeIds.set(joined, id);
  return id;
}
