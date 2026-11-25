import { ADOPTION_PHRASE_TAG } from '../gedcomPhraseMarker';
import type {
  Calendar,
  DateFields,
  DateValue as GedcomDateValue,
  ExtensionStructure,
  GedcomMonth,
  PersonalName,
} from '@doru/gedcom';
import type {
  AddressStructure,
  AgeStructure,
  DateExactStructure,
  DatePeriodStructure,
  DateStructure,
  EventDetail,
  FactFlag as GedcomFactFlag,
  FamilyRecord as GedcomFamilyRecord,
  GedcomDataset,
  GedcomRecord,
  IdentifierStructure,
  IndividualRecord as GedcomIndividualRecord,
  NoteStructure,
  PersonalNamePieces,
  PersonalNameStructure,
  PlaceStructure,
  SourceCitation,
  SortDateStructure,
} from '@doru/gedcom';
import { isFamilyRecord, isIndividualRecord, isPlaceRecord } from '@doru/gedcom';
import type {
  OccurrenceRecord as GedcomOccurrenceRecord,
  TodoRecord as GedcomTodoRecord,
  TodoStructure,
} from '@doru/gedcom';
import type { TreeRepository } from '../db/repository';
import { mergeDateBounds, normalizeTaskPriority, normalizeTaskStatus } from '../model/types';
import { detectParentCycles } from '../validate/validator';
import type {
  AssociationRecord,
  CitationRecord,
  ContactRecord,
  DateComponent,
  DateValue,
  FactFlag,
  FactRecord,
  FamilyChildLink,
  FamilyPartnerLink,
  NamePart,
  PersonName,
  PlaceName,
  PlaceRecord,
  Sex,
  TaskRecord,
} from '../model/types';

/**
 * GEDCOM dataset → tree mapping. The GEDCOM object model is the subject
 * source; the tree model is Dóru's own. This module is the single place
 * where the two meet, so every projection decision (calendars, name pieces,
 * citations, …) lives here and nowhere else.
 *
 * Deliberately not imported:
 * - media bytes are not read here: the host prepares project-relative paths
 *   (GEDZIP bytes, resolvable FILE paths) and passes them as `mediaPaths`;
 *   unresolved paths stay external references.
 * - the evidence/research records (`_EVID`, `_RDOC`, `_RACT`), the
 *   MagiKey census record (`_CENR`), the Legacy custom event definitions
 *   (`_EVENT_DEFN`), the organisational tag records (`_TAG`) and the LDS
 *   ordinance structures (BAPL/CONL/ENDL/INIL/SLGC/SLGS): the parser keeps
 *   them, but the tree has no such layers — they are counted as dropped.
 *   Census data from real files arrives as CENS facts on persons.
 * - vendor-only structures (§3.2 of the schema plan): GenoPro entity
 *   records, MyHeritage tree tags, published sites, groups, USM types,
 *   vendor IDs (FamilySearch/MyHeritage/Ancestry), raw extension records,
 *   `_ALIA` duplicate-candidate records (they carry a single person pointer
 *   and have no second-person slot in our model).
 * - the 5.5.1-only `RFN`/`AFN` person identifiers: neither has a 7.0
 *   spelling, and the tree has no matching identifier namespace.
 * - source citations on notes (`NOTE.SOUR`/`SNOTE.SOUR`): a note is not an
 *   attachment target in the tree.
 * Whole dropped vendor record types are counted into `droppedStructures`;
 * HEAD/SUBN, SCHMA and raw extension/unknown structures are wire metadata
 * and are not counted.
 */

export interface GedcomImportResult {
  importedPersons: number;
  importedFamilies: number;
  importedSources: number;
  importedPlaces: number;
  importedMedia: number;
  totalPersons: number;
  /**
   * Whole vendor record families that were deliberately not imported.
   * HEAD/SUBN, SCHMA and raw extension/unknown structures are wire metadata
   * and are not counted.
   */
  droppedStructures: number;
}

interface ImportContext {
  repo: TreeRepository;
  personIds: Map<string, string>;
  familyIds: Map<string, string>;
  sourceIds: Map<string, string>;
  /** True once every SOUR xref has been registered. */
  sourceIdsReady: boolean;
  /** Every citation imported before the SOUR pass, with its target. */
  pendingCitations: Array<{ citation: SourceCitation; targetType: string; targetId: string }>;
  repositoryIds: Map<string, string>;
  submitterIds: Map<string, string>;
  titleIds: Map<string, string>;
  noteIds: Map<string, string>;
  /** Dedupe of places by their joined name within this import. */
  placeIds: Map<string, string>;
  /** Place names that resolve to more than one distinct row. */
  ambiguousPlaceNames: Set<string>;
  /** Place-card xref → place id. */
  placeCardIds: Map<string, string>;
  /** Place id → parent links resolved after all cards are imported. */
  placeParents: Map<string, Array<{ parentXref: string; type?: string | undefined; date?: DateValue | undefined }>>;
  /** Media record xref → media id. */
  mediaIds: Map<string, string>;
  /** Media id → historical place text, resolved after place records exist. */
  mediaPlaceText: Map<string, string>;
  /** Original GEDCOM FILE path → project-relative path prepared by the host. */
  mediaPaths: ReadonlyMap<string, string>;
  /** Person xref → the dates carried by their FAMS links, keyed by family xref. */
  spouseLinkDates: Map<string, Map<string, DateStructure | undefined>>;
  /** Person xref → the notes carried by their FAMS links, keyed by family xref. */
  spouseLinkNotes: Map<string, Map<string, NoteStructure[] | undefined>>;
  /** Event-family links held until the family xrefs have ids. */
  pendingFactFamilies: Array<{
    factId: string;
    familyXref: string;
    adoptedBy?: 'HUSB' | 'WIFE' | 'BOTH' | undefined;
    phrase?: string | undefined;
    position: number;
  }>;
  /** Families imported with only a WIFE slot (the exporter moves them to HUSB). */
  singleWifeFamilies: Set<string>;
  /** `personXref\0familyXref` pairs already linked through a CHIL row. */
  linkedChildPairs: Set<string>;
  /** Person xref → family xref → the FAMC link details (pedigree, status, relations). */
  childLinkDetails: Map<
    string,
    Map<
      string,
      {
        pedigree?: string | undefined;
        pedigreePhrase?: string | undefined;
        status?: string | undefined;
        statusPhrase?: string | undefined;
        fatherRelation?: string | undefined;
        motherRelation?: string | undefined;
        notes?: NoteStructure[] | undefined;
      }
    >
  >;
  dropped: number;
}

/**
 * Writes the dataset into the repository in one transaction. Record ids are
 * fresh UUIDs; the GEDCOM cross-reference lands in `xref` for export
 * provenance.
 */
export function importGedcomDataset(
  dataset: GedcomDataset,
  repo: TreeRepository,
  mediaPaths: ReadonlyMap<string, string> = new Map(),
): GedcomImportResult {
  const ctx: ImportContext = {
    repo,
    personIds: new Map(),
    familyIds: new Map(),
    sourceIds: new Map(),
    sourceIdsReady: false,
    pendingCitations: [],
    repositoryIds: new Map(),
    submitterIds: new Map(),
    titleIds: new Map(),
    noteIds: new Map(),
    placeIds: new Map(),
    ambiguousPlaceNames: new Set(),
    placeCardIds: new Map(),
    placeParents: new Map(),
    mediaIds: new Map(),
    mediaPlaceText: new Map(),
    mediaPaths,
    spouseLinkDates: new Map(),
    spouseLinkNotes: new Map(),
    pendingFactFamilies: [],
    singleWifeFamilies: new Set(),
    linkedChildPairs: new Set(),
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
    importMediaRecords(dataset.records, ctx);
    importPlaceRecords(dataset.records, ctx);
    importedSources = importSources(dataset.records, ctx);
    ctx.sourceIdsReady = true;
    flushPendingCitations(ctx);
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
    linkFactFamilies(ctx);
    importPersonRelations(dataset.records, ctx);
    linkPlaceHierarchy(ctx);
    importResearchRecords(dataset.records, ctx);
    linkMediaPlaces(ctx);
    const cycles = detectParentCycles(repo.toTreeDocument());
    if (cycles.length > 0) {
      throw new Error(`GEDCOM import contains a parent cycle: ${cycles[0]?.message ?? 'unknown cycle'}`);
    }
  });
  return {
    importedPersons,
    importedFamilies,
    importedSources,
    importedPlaces: ctx.placeIds.size,
    importedMedia: ctx.mediaIds.size,
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
    const repository = record as unknown as {
      xref?: string;
      name: string;
      address?: AddressStructure;
      identifiers?: IdentifierStructure[];
      notes?: NoteStructure[];
      phone?: string[];
      email?: string[];
      fax?: string[];
      www?: string[];
      submitters?: string[];
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
    importContacts(
      'repository',
      id,
      [
        ...(repository.email ?? []).map((value) => ({ kind: 'email', value })),
        ...(repository.phone ?? []).map((value) => ({ kind: 'phone', value })),
        ...(repository.fax ?? []).map((value) => ({ kind: 'fax', value })),
        ...(repository.www ?? []).map((value) => ({ kind: 'www', value })),
      ],
      ctx,
    );
    importSubmitterLinks(repository.submitters, 'repository', id, ctx);
  }
}

function importSubmitters(records: GedcomRecord[], ctx: ImportContext): void {
  for (const record of records) {
    if (record.tag !== 'SUBM') {
      continue;
    }
    const submitter = record as unknown as {
      xref?: string;
      name: string;
      address?: AddressStructure;
      languages?: string[];
      automatedRecordId?: string;
      identifiers?: IdentifierStructure[];
      notes?: NoteStructure[];
      phone?: string[];
      email?: string[];
      fax?: string[];
      www?: string[];
      submitters?: string[];
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
    importIdentifiers(submitter.identifiers, 'submitter', id, ctx);
    importNotes(submitter.notes, 'submitter', id, ctx);
    importContacts(
      'submitter',
      id,
      [
        ...(submitter.email ?? []).map((value) => ({ kind: 'email', value })),
        ...(submitter.phone ?? []).map((value) => ({ kind: 'phone', value })),
        ...(submitter.fax ?? []).map((value) => ({ kind: 'fax', value })),
        ...(submitter.www ?? []).map((value) => ({ kind: 'www', value })),
      ],
      ctx,
    );
    importSubmitterLinks(submitter.submitters, 'submitter', id, ctx);
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

function importAddress(address: AddressStructure, ctx: ImportContext): string {
  const id = crypto.randomUUID();
  const values = address.payload
    ? address.payload.split('\n')
    : [address.line1, address.line2, address.line3].filter((line): line is string => line !== undefined);
  ctx.repo.insertAddress({
    id,
    lines: values.map((value) => ({ id: crypto.randomUUID(), value })),
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
  importNotes(address.notes, 'address', id, ctx);
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
    const note = record as unknown as {
      xref?: string;
      payload: string;
    };
    if (note.xref === undefined) {
      continue;
    }
    const id = crypto.randomUUID();
    ctx.noteIds.set(note.xref, id);
    const now = Date.now();
    ctx.repo.insertNote({
      id,
      text: note.payload,
      createdAt: now,
      updatedAt: now,
    });
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
    const texts =
      source.texts !== undefined && source.texts.length > 0
        ? source.texts.map((text) => ({
            id: crypto.randomUUID(),
            text: text.payload,
            mime: text.mediaType,
            language: text.language,
          }))
        : undefined;
    const dataEvents = (source.data?.events ?? []).flatMap((event) => {
      const date = mapDatePeriod(event.date);
      const placeId = event.place ? importPlace(event.place, ctx) : undefined;
      const tags = event.payload.length > 0 ? event.payload : [''];
      return tags.map((tag, index) => ({
        id: crypto.randomUUID(),
        tag,
        ...(event.userDefined?.[index] !== undefined
          ? { value: event.userDefined[index] }
          : event.userDefined?.[0] !== undefined
            ? { value: event.userDefined[0] }
            : {}),
        ...(date !== undefined ? { date } : {}),
        ...(placeId !== undefined ? { placeId } : {}),
      }));
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
      title: source.title,
      abbreviation: source.abbreviation,
      author: source.author,
      publication: source.publication,
      medium: source.medium,
      url: source.url,
      accessDate: source.accessDate,
      confidence: source.confidence,
      pubDate: source.publicationDetails?.date ? mapDateExact(source.publicationDetails.date) : undefined,
      pubPlace: source.publicationDetails?.place,
      agency: source.data?.agency,
      certainty: source.certainty,
      subsequentCitationFormat: source.subsequentCitationFormat,
      bibliography: source.bibliography,
      dataNote:
        source.data?.notes?.[0] !== undefined && 'payload' in source.data.notes[0]
          ? source.data.notes[0].payload
          : undefined,
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
    importMediaLinks(source.media, 'source', id, ctx);
    importSubmitterLinks(source.submitters, 'source', id, ctx);
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
  const famsNotes = new Map<string, NoteStructure[] | undefined>();
  for (const link of record.spouseFamilies ?? []) {
    const known = famsDates.get(link.family);
    if (!famsDates.has(link.family) || (known === undefined && link.date !== undefined)) {
      famsDates.set(link.family, link.date);
    }
    if (link.notes !== undefined && link.notes.length > 0) {
      famsNotes.set(link.family, [...(famsNotes.get(link.family) ?? []), ...link.notes]);
    }
  }
  if (record.xref !== undefined) {
    ctx.spouseLinkDates.set(record.xref, famsDates);
    ctx.spouseLinkNotes.set(record.xref, famsNotes);
  }
  const famcDetails = new Map<
    string,
    {
      pedigree?: string | undefined;
      pedigreePhrase?: string | undefined;
      status?: string | undefined;
      statusPhrase?: string | undefined;
      fatherRelation?: string | undefined;
      motherRelation?: string | undefined;
      notes?: NoteStructure[] | undefined;
    }
  >();
  for (const link of record.childFamilies ?? []) {
    const previous = famcDetails.get(link.family);
    const pedigree = link.pedigree?.payload.toLowerCase();
    const status = link.status?.payload.toLowerCase();
    famcDetails.set(link.family, {
      pedigree: pedigree ?? previous?.pedigree,
      pedigreePhrase: pedigree !== undefined ? link.pedigree?.phrase : previous?.pedigreePhrase,
      status: status ?? previous?.status,
      statusPhrase: status !== undefined ? link.status?.phrase : previous?.statusPhrase,
      fatherRelation: link.fatherRelation ?? previous?.fatherRelation,
      motherRelation: link.motherRelation ?? previous?.motherRelation,
      notes: [...(previous?.notes ?? []), ...(link.notes ?? [])],
    });
  }
  if (record.xref !== undefined) {
    ctx.childLinkDetails.set(record.xref, famcDetails);
  }

  const structures = (record.names ?? []).map((structure) => ({ structure, name: mapName(structure, ctx) }));
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
      structure as EventFamilyRef,
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
    ...(record.deceased === true
      ? { deathStatus: 'dead' as const }
      : record.deceased === false
        ? { deathStatus: 'alive' as const }
        : {}),
    ...(record.address !== undefined ? { addressId: importAddress(record.address, ctx) } : {}),
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
    if (structure.tag === 'WILL') {
      // WILL.TEXT is normalized into ordinary notes on the fact; export
      // writes them back as NOTE (see docs/decisions.md).
      importNotes(
        (structure.texts ?? []).map((text) => ({ tag: 'NOTE' as const, payload: text })),
        'fact',
        fact.id,
        ctx,
      );
    }
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
  importCitations(record.sexCitations, 'person', id, ctx);
  importNotes(record.notes, 'person', id, ctx);
  // RFN/AFN are 5.5.1-only person identifiers (removed in 7.0). They have
  // no matching identifier namespace and no 7.0 export form, so they are
  // deliberately not imported. See docs/decisions.md.
  importIdentifiers(record.identifiers, 'person', id, ctx);
  importMediaLinks(record.media, 'person', id, ctx);
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
  importSubmitterLinks(record.submitters, 'person', id, ctx);
  importSubmitterLinks(record.ancestorInterests, 'person', id, ctx, 'ancestor_interest');
  importSubmitterLinks(record.descendantInterests, 'person', id, ctx, 'descendant_interest');
  for (const structure of record.todos ?? []) {
    importGedcomTodoStructure(structure, 'person', id, ctx);
  }
  // Associations and aliases need the other persons — deferred
  // to importPersonRelations, resolved after every person and family exists.
}

interface EventFamilyRef {
  tag?: string | undefined;
  adoptionFamily?:
    | {
        family: string;
        adoption?: { payload: string; phrase?: string | undefined } | undefined;
      }
    | undefined;
  familyChild?: string | undefined;
  extensions?: ExtensionStructure[] | undefined;
}

function queueFactFamily(
  structure: EventFamilyRef | undefined,
  factId: string,
  ctx: ImportContext,
  detail?: EventDetail,
): void {
  if (structure?.adoptionFamily !== undefined) {
    const marker =
      structure.extensions?.find((entry) => entry.tag === ADOPTION_PHRASE_TAG) ??
      detail?.extensions?.find((entry) => entry.tag === ADOPTION_PHRASE_TAG);
    ctx.pendingFactFamilies.push({
      factId,
      familyXref: structure.adoptionFamily.family,
      adoptedBy: structure.adoptionFamily.adoption?.payload as 'HUSB' | 'WIFE' | 'BOTH' | undefined,
      phrase: structure.adoptionFamily.adoption?.phrase ?? marker?.payload,
      position: 0,
    });
    return;
  }
  if ((structure?.tag === 'BIRT' || structure?.tag === 'CHR') && structure.familyChild !== undefined) {
    ctx.pendingFactFamilies.push({ factId, familyXref: structure.familyChild, position: 0 });
  }
}

function linkFactFamilies(ctx: ImportContext): void {
  for (const pending of ctx.pendingFactFamilies) {
    const familyId = ctx.familyIds.get(pending.familyXref);
    if (familyId === undefined) {
      continue;
    }
    const movedToHusband =
      ctx.singleWifeFamilies.has(pending.familyXref) && (pending.adoptedBy === 'WIFE' || pending.adoptedBy === 'BOTH');
    ctx.repo.insertFactEventFamilyLink(pending.factId, {
      id: crypto.randomUUID(),
      familyId,
      adoptedBy: movedToHusband ? 'HUSB' : pending.adoptedBy,
      phrase: pending.phrase,
      position: pending.position,
    });
  }
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
  structure?: EventFamilyRef,
): FactRecord {
  queueFactFamily(structure, base.id, ctx, detail);
  importMediaLinks(detail?.media, 'fact', base.id, ctx);
  importIdentifiers(
    detail?.uniqueIds?.map((payload) => ({ tag: 'UID', payload })),
    'fact',
    base.id,
    ctx,
  );
  importContacts(
    'fact',
    base.id,
    [
      ...(detail?.email ?? []).map((value) => ({ kind: 'email', value })),
      ...(detail?.phone ?? []).map((value) => ({ kind: 'phone', value })),
      ...(detail?.fax ?? []).map((value) => ({ kind: 'fax', value })),
      ...(detail?.www ?? []).map((value) => ({ kind: 'www', value })),
    ],
    ctx,
  );
  return {
    id: base.id,
    personId: base.personId,
    familyId: base.familyId,
    tag: base.tag,
    type: base.type,
    value: base.payload === undefined || base.payload === 'Y' ? undefined : String(base.payload),
    date: mergeDateBounds(mapDate(detail?.date), mapDate(detail?.endDate)),
    sortDate: mapSortDate(detail?.sortDate),
    placeId: detail?.place ? importPlace(detail.place, ctx) : undefined,
    place: mapPlaceText(detail?.place),
    ...(detail?.additionalPlaces !== undefined
      ? {
          additionalPlaceIds: detail.additionalPlaces.flatMap((additional) => {
            const placeId = importPlace(additional, ctx);
            return placeId !== undefined ? [placeId] : [];
          }),
        }
      : {}),
    addressId: detail?.address ? importAddress(detail.address, ctx) : undefined,
    placePrefix: detail?.placePrefix,
    eventNumber: detail?.eventNumber,
    birthLength: detail?.birthLength,
    birthWeight: detail?.birthWeight,
    cemetery: detail?.cemetery,
    fna: detail?.fna === true ? true : undefined,
    descriptionAware: detail?.descriptionAware,
    map:
      detail?.map !== undefined
        ? {
            latitude: mapCoordinate(detail.map.latitude, 'S') ?? 0,
            longitude: mapCoordinate(detail.map.longitude, 'W') ?? 0,
          }
        : undefined,
    agency: detail?.agency,
    religiousAffiliation: detail?.religiousAffiliation,
    cause: detail?.cause,
    sentence: detail?.sentence,
    quality: detail?.quality,
    ages: mapAges(age),
    participants: mapParticipants(detail, ctx),
    flags: factFlags(detail),
    primary: detail?.primary === true ? true : undefined,
  };
}

/** The GEDCOM wire flags mapped to the lowercase core vocabulary. */
const GEDCOM_TO_CORE_FACT_FLAG: Readonly<Record<GedcomFactFlag, FactFlag>> = {
  PRIVATE: 'private',
  PREFERRED: 'preferred',
  TENTATIVE: 'tentative',
  REJECTED: 'rejected',
};

/** The Family Historian `_FLGS` flags; `_PRI` is mapped to `primary` separately. */
function factFlags(detail: EventDetail | undefined): FactFlag[] | undefined {
  const flags = detail?.factFlags;
  if (flags === undefined || flags.length === 0) {
    return undefined;
  }
  return [...new Set(flags.map((flag) => GEDCOM_TO_CORE_FACT_FLAG[flag]))];
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
  for (const godparent of detail?.godparents ?? []) {
    participants.push({ id: crypto.randomUUID(), value: godparent, role: 'GODP', position: participants.length });
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

function extensionText(extensions: ExtensionStructure[] | undefined, tag: string): string | undefined {
  return extensions?.find((extension) => extension.tag === tag)?.payload;
}

function mapName(structure: PersonalNameStructure, ctx: ImportContext): PersonName {
  const payload = structure.payload;
  const pieces = structure.pieces;
  const parts = nameParts(payload, pieces);
  const full = extensionText(structure.extensions, '_FULL') ?? joinName(payload, pieces);
  const language = extensionText(structure.extensions, '_LANG');
  const type = structure.type
    ? structure.type.payload.toLowerCase() === 'other' && structure.type.phrase !== undefined
      ? structure.type.phrase
      : structure.type.payload.toLowerCase()
    : undefined;
  const name: PersonName = {
    id: crypto.randomUUID(),
    type,
    primary: structure.primary,
    ...(language !== undefined ? { language } : {}),
    full: full || undefined,
    ...(structure.callName !== undefined ? { callName: structure.callName } : {}),
    ...(structure.middleName !== undefined ? { middleName: structure.middleName } : {}),
    ...(structure.patronymic !== undefined ? { patronymic: structure.patronymic } : {}),
    ...(structure.marriedName !== undefined ? { marriedName: structure.marriedName } : {}),
    ...(structure.alsoKnownAs !== undefined && structure.alsoKnownAs.length > 0
      ? { aka: structure.alsoKnownAs.join(', ') }
      : {}),
    ...(structure.hebrewName !== undefined ? { hebrewName: structure.hebrewName } : {}),
    ...(structure.title !== undefined ? { title: structure.title } : {}),
    ...(structure.shortName !== undefined ? { shortName: structure.shortName } : {}),
    ...(structure.nameAsRecorded !== undefined ? { nameAsRecorded: structure.nameAsRecorded } : {}),
    ...(structure.givenNameUsed !== undefined ? { givenNameUsed: structure.givenNameUsed } : {}),
    parts: parts.length > 0 ? parts : undefined,
    ...(structure.date !== undefined ? { date: mapDate(structure.date) } : {}),
  };
  const variants = [
    ...(structure.translations ?? []).map((translation) =>
      mapNameVariant(translation.payload, translation.pieces, 'translation', translation.language),
    ),
    ...(structure.phonetic ?? []).map((variation) =>
      mapNameVariant(variation.payload, variation.pieces, 'phonetic', undefined, variation.type),
    ),
    ...(structure.romanized ?? []).map((variation) =>
      mapNameVariant(variation.payload, variation.pieces, 'romanized', undefined, variation.type),
    ),
  ];
  if (variants.length > 0) {
    name.variants = variants;
  }
  importMediaLinks(structure.media, 'name', name.id, ctx);
  return name;
}

function mapNameVariant(
  payload: PersonalName,
  pieces: PersonalNamePieces | undefined,
  kind: 'translation' | 'phonetic' | 'romanized',
  language: string | undefined,
  variantType?: string,
): PersonName {
  const parts = nameParts(payload, pieces);
  return {
    id: crypto.randomUUID(),
    kind,
    language,
    ...(variantType !== undefined ? { variantType } : {}),
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
    const notes = ctx.spouseLinkNotes.get(link.partner)?.get(record.xref ?? '');
    const partnerLink: FamilyPartnerLink = {
      id: crypto.randomUUID(),
      personId,
      preferred: link.preferred,
      date: date ? mapDate(date) : undefined,
      phrase: link.phrase,
      name: link.name
        ? [link.name.payload.given, link.name.payload.surname].filter((part) => part !== undefined).join(' ')
        : undefined,
      civilStatus: link.civilStatus,
      marriageNumber: link.marriageNumber !== undefined ? String(link.marriageNumber) : undefined,
    };
    partnerLinks.push(partnerLink);
    importNotes(notes, 'family_partner', partnerLink.id, ctx);
  }
  const husbandResolved = record.husband !== undefined && ctx.personIds.get(record.husband.partner) !== undefined;
  const wifeResolved = record.wife !== undefined && ctx.personIds.get(record.wife.partner) !== undefined;
  if (record.xref !== undefined && !husbandResolved && wifeResolved) {
    ctx.singleWifeFamilies.add(record.xref);
  }
  const childLinks: FamilyChildLink[] = [];
  const childLinkByPerson = new Map<string, FamilyChildLink>();
  for (const link of record.children ?? []) {
    const personId = ctx.personIds.get(link.child);
    if (personId === undefined) {
      continue;
    }
    if (record.xref !== undefined) {
      ctx.linkedChildPairs.add(`${link.child}\u0000${record.xref}`);
    }
    if (childLinkByPerson.has(personId)) {
      // The schema keeps one link per child; repeated CHIL rows add their
      // notes to that link (handled below) rather than a second link.
      continue;
    }
    const pedigree = link.pedigrees?.[0]?.pedigree;
    const details = ctx.childLinkDetails.get(link.child)?.get(record.xref ?? '');
    const childLink: FamilyChildLink = {
      id: crypto.randomUUID(),
      childId: personId,
      pedigree: pedigree?.payload.toLowerCase() ?? details?.pedigree,
      pedigreePhrase: pedigree?.phrase ?? details?.pedigreePhrase,
      status: details?.status,
      statusPhrase: details?.statusPhrase,
      fatherRelation: link.fatherRelation ?? details?.fatherRelation,
      motherRelation: link.motherRelation ?? details?.motherRelation,
      preferred: link.preferred,
      multiplicity: link.multiplicity,
    };
    childLinks.push(childLink);
    childLinkByPerson.set(personId, childLink);
  }
  const marriageStatuses = (record.marriageStatuses ?? []).map((status) => ({
    mapped: {
      id: crypto.randomUUID(),
      status: status.payload,
      date: mapDate(status.date),
      placeId: status.place ? importPlace(status.place, ctx) : undefined,
    },
    source: status,
  }));
  ctx.repo.insertFamily({
    id,
    xref: record.xref,
    preferred: record.preferred,
    sameSex: record.sameSexUnion,
    unionKind: record.unionKind,
    unionStatus: record.unionStatus,
    marriageBeginStatus: record.marriageBeginningStatus,
    marriageEndStatus: record.marriageEndingStatus,
    witnesses: record.witnesses,
    marriageStatuses: marriageStatuses.map((entry) => entry.mapped),
    partners: partnerLinks.map((link) => link.personId),
    children: childLinks.map((link) => link.childId),
    partnerLinks,
    childLinks,
  });
  for (const entry of marriageStatuses) {
    importNotes(entry.source.notes, 'family_marriage_status', entry.mapped.id, ctx);
    importCitations(entry.source.citations, 'family_marriage_status', entry.mapped.id, ctx);
  }
  const childRowsByPerson = new Map<string, Array<{ xref: string; notes: NoteStructure[] | undefined }>>();
  for (const child of record.children ?? []) {
    const personId = ctx.personIds.get(child.child);
    if (personId !== undefined) {
      const rows = childRowsByPerson.get(personId) ?? [];
      rows.push({ xref: child.child, notes: child.notes });
      childRowsByPerson.set(personId, rows);
    }
  }
  for (const link of childLinks) {
    const rows = childRowsByPerson.get(link.childId) ?? [];
    // Person-side FAMC notes belong to the child, not to each repeated CHIL
    // row: collect them once, then append each row's own notes.
    const firstRow = rows[0];
    const personNotes =
      firstRow !== undefined ? (ctx.childLinkDetails.get(firstRow.xref)?.get(record.xref ?? '')?.notes ?? []) : [];
    const rowNotes = rows.flatMap((row) => row.notes ?? []);
    const mergedNotes = [...personNotes, ...rowNotes];
    importNotes(mergedNotes.length > 0 ? mergedNotes : undefined, 'family_child', link.id, ctx);
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
      structure,
    );
    const husbandAge = structure.detail?.husband?.age;
    const wifeAge = structure.detail?.wife?.age;
    if (husbandAge !== undefined || wifeAge !== undefined) {
      const ages: NonNullable<FactRecord['ages']> = [];
      // The exporter normalizes a wife-only family to the HUSB slot, so the
      // wife's age must follow that slot too.
      const wifeOnly = !husbandResolved && wifeResolved;
      if (husbandAge !== undefined) {
        // An unmatched husband slot has no person to attach to.
        ages.push(mapAge(husbandAge, wifeOnly ? undefined : 'HUSB'));
      }
      if (wifeAge !== undefined) {
        ages.push(mapAge(wifeAge, wifeOnly ? 'HUSB' : 'WIFE'));
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
  importMediaLinks(record.media, 'family', id, ctx);
  importSubmitterLinks(record.submitters, 'family', id, ctx);
  for (const structure of record.todos ?? []) {
    importGedcomTodoStructure(structure, 'family', id, ctx);
  }
  for (const association of record.associations ?? []) {
    const otherPersonId = ctx.personIds.get(association.individual);
    if (otherPersonId === undefined) {
      continue;
    }
    const associationId = crypto.randomUUID();
    ctx.repo.insertAssociation({
      id: associationId,
      familyId: id,
      otherPersonId,
      role: association.role?.payload,
      relationship: association.relationship,
      phrase: association.phrase,
      primary: association.primary,
      specificType: association.specificType,
      confidence: association.confidence,
      period: mergeDateBounds(mapDate(association.period?.start), mapDate(association.period?.end)),
    });
    importCitations(association.citations, 'association', associationId, ctx);
    importNotes(association.notes, 'association', associationId, ctx);
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
    // A person-side FAMC without a reciprocal CHIL still describes a child
    // link. Keep its pedigree/status/relations/notes instead of dropping it.
    for (const [familyXref, details] of ctx.childLinkDetails.get(record.xref ?? '') ?? []) {
      if (ctx.linkedChildPairs.has(`${record.xref ?? ''}\u0000${familyXref}`)) {
        continue;
      }
      const familyId = ctx.familyIds.get(familyXref);
      if (familyId === undefined) {
        continue;
      }
      const family = ctx.repo.getFamily(familyId);
      if (
        family === undefined ||
        family.partners.includes(personId) ||
        family.children.includes(personId) ||
        (family.childLinks ?? []).some((link) => link.childId === personId)
      ) {
        continue;
      }
      const link: FamilyChildLink = {
        id: crypto.randomUUID(),
        childId: personId,
        pedigree: details.pedigree,
        pedigreePhrase: details.pedigreePhrase,
        status: details.status,
        statusPhrase: details.statusPhrase,
        fatherRelation: details.fatherRelation,
        motherRelation: details.motherRelation,
      };
      ctx.repo.updateFamily({
        ...family,
        children: [...family.children, personId],
        childLinks: [...(family.childLinks ?? []), link],
      });
      importNotes(details.notes, 'family_child', link.id, ctx);
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
        period: mergeDateBounds(mapDate(association.period?.start), mapDate(association.period?.end)),
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
      case '_TAG':
        // The evidence/research records (the glamberson gedcom-evidence
        // extension), the MagiKey census record and the organisational tag
        // records stay in the @doru/gedcom model but are deliberately not
        // carried into the tree. Census data imported from real files
        // arrives as CENS facts on persons.
        ctx.dropped += 1;
        break;
      case '_TODO':
        importGedcomTodoRecord(record as GedcomTodoRecord, ctx);
        break;
      case '_EVENT_DEFN':
        // The Legacy custom event definitions stay in the @doru/gedcom
        // model; the tree has no fact-type registry.
        ctx.dropped += 1;
        break;
      case '_OCUR':
        importOccurrence(record as GedcomOccurrenceRecord, ctx);
        break;
      case '_ALIA':
        // The duplicate-candidate record carries a single person pointer and
        // has no second-person slot in our model.
        ctx.dropped += 1;
        break;
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

function importGedcomTodoRecord(record: GedcomTodoRecord, ctx: ImportContext): void {
  // _TODO.REPO is deliberately ignored: a task has no direct repository
  // field, and a repository can be selected as the task's target instead.
  // _TODO._CAT (category), _TODO._LOCL (locality), and _TODO._TTIL (title) are
  // deliberately ignored too. Status and priority are normalized immediately;
  // unknown values become open and medium rather than lingering in the
  // database.
  const id = crypto.randomUUID();
  const status = normalizeTaskStatus(record.status);
  ctx.repo.insertTask({
    id,
    text: record.payload || '',
    targets: [],
    priority: normalizeTaskPriority(record.priority),
    status,
    createdAt: parseTaskTextDate(record.createdDate),
    updatedAt: Date.now(),
    scheduledAt: parseTaskTextDate(record.scheduledDate),
    reminderAt: parseTaskTextDate(record.reminderDate),
    closedAt: status === 'closed' ? parseTaskTextDate(record.closedDate) : undefined,
  });
  for (const uid of record.uids ?? []) {
    ctx.repo.insertIdentifier({
      id: crypto.randomUUID(),
      targetType: 'task',
      targetId: id,
      namespace: 'uid',
      value: uid,
    });
  }
}

/**
 * Task dates are operational instants, not genealogical dates. The record
 * form carries My Family Tree's encoded strings (`V05T00S0001DDMMYYYY…` and
 * `V02C0000S01DDMMYYYY…`); date-only values become local midnight. Anything
 * that is not a complete exact date is dropped.
 */
function parseTaskTextDate(text: string | undefined): number | undefined {
  if (text === undefined || text.trim() === '') {
    return undefined;
  }
  return parseEncodedTaskDate(text.trim()) ?? parseIsoTaskDate(text.trim());
}

function parseEncodedTaskDate(text: string): number | undefined {
  // My Family Tree writes one of these vendor prefixes followed by DDMMYYYY.
  const match = /^(?:V05T00S0001|V02C0000S01)(\d{2})(\d{2})(\d{4})/.exec(text);
  if (match === null) {
    return undefined;
  }
  return localTimestamp(Number(match[3]), Number(match[2]), Number(match[1]), 0, 0);
}

function parseIsoTaskDate(text: string): number | undefined {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}:?\d{2})?)?$/.exec(text);
  if (match === null) {
    return undefined;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = match[4] !== undefined ? Number(match[4]) : 0;
  const minute = match[5] !== undefined ? Number(match[5]) : 0;
  const second = match[6] !== undefined ? Number(match[6]) : 0;
  const millisecond = fractionToMilliseconds(match[7]);
  const zone = match[8];
  if (zone === undefined) {
    return localTimestamp(year, month, day, hour, minute, second, false, millisecond);
  }
  const timestamp = Date.parse(text);
  if (Number.isNaN(timestamp)) {
    return undefined;
  }
  const offsetMinutes =
    zone === 'Z' ? 0 : (zone.startsWith('-') ? -1 : 1) * (Number(zone.slice(1, 3)) * 60 + Number(zone.slice(-2)));
  const wall = new Date(timestamp + offsetMinutes * 60_000);
  if (
    wall.getUTCFullYear() !== year ||
    wall.getUTCMonth() !== month - 1 ||
    wall.getUTCDate() !== day ||
    wall.getUTCHours() !== hour ||
    wall.getUTCMinutes() !== minute ||
    wall.getUTCSeconds() !== second
  ) {
    return undefined;
  }
  return isExportableTaskInstant(timestamp) ? timestamp : undefined;
}

/**
 * `toISOString()` writes an expanded year (`+010000`) outside 0000-9999,
 * which the anchored task-date parser cannot read back.
 */
function isExportableTaskInstant(timestamp: number): boolean {
  const year = new Date(timestamp).getUTCFullYear();
  return year >= 0 && year <= 9999;
}

function taskDateValueToTimestamp(date: DateValue | undefined, interpreted = false): number | undefined {
  if (interpreted || date === undefined || date.quality !== 'exact') {
    return undefined;
  }
  const component = date.component;
  if (
    component === undefined ||
    component.year === undefined ||
    typeof component.month !== 'number' ||
    component.day === undefined
  ) {
    return undefined;
  }
  if (component.calendar !== undefined || component.epoch === 'BCE') {
    return undefined;
  }
  return localTimestamp(
    component.year,
    component.month,
    component.day,
    date.time?.hour ?? 0,
    date.time?.minute ?? 0,
    date.time?.second ?? 0,
    date.time?.utc === true,
    fractionToMilliseconds(date.time?.fraction),
  );
}

function fractionToMilliseconds(fraction: string | undefined): number {
  return fraction === undefined || fraction === '' ? 0 : Number(fraction.slice(0, 3).padEnd(3, '0'));
}

function localTimestamp(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second = 0,
  utc = false,
  millisecond = 0,
): number | undefined {
  // The Date constructor maps years 0-99 to 1900-1999; setFullYear keeps the
  // actual year. The component checks below still reject impossible dates.
  const value = new Date(0);
  if (utc) {
    value.setUTCFullYear(year, month - 1, day);
    value.setUTCHours(hour, minute, second, millisecond);
  } else {
    value.setFullYear(year, month - 1, day);
    value.setHours(hour, minute, second, millisecond);
  }
  if (Number.isNaN(value.getTime())) {
    return undefined;
  }
  const actualYear = utc ? value.getUTCFullYear() : value.getFullYear();
  const actualMonth = utc ? value.getUTCMonth() : value.getMonth();
  const actualDay = utc ? value.getUTCDate() : value.getDate();
  const actualHour = utc ? value.getUTCHours() : value.getHours();
  const actualMinute = utc ? value.getUTCMinutes() : value.getMinutes();
  const actualSecond = utc ? value.getUTCSeconds() : value.getSeconds();
  const actualMillisecond = utc ? value.getUTCMilliseconds() : value.getMilliseconds();
  if (
    actualYear !== year ||
    actualMonth !== month - 1 ||
    actualDay !== day ||
    actualHour !== hour ||
    actualMinute !== minute ||
    actualSecond !== second ||
    actualMillisecond !== millisecond
  ) {
    return undefined;
  }
  const timestamp = value.getTime();
  return isExportableTaskInstant(timestamp) ? timestamp : undefined;
}

function importGedcomTodoStructure(
  structure: TodoStructure,
  targetType: string,
  targetId: string,
  ctx: ImportContext,
): void {
  // _TODO.REPO, _TODO._CAT, _TODO._LOCL, _TODO.TYPE, and _TODO.DATA are
  // deliberately ignored: see importGedcomTodoRecord. Dóru has no task-type
  // taxonomy or separate task-result field.
  const status = normalizeTaskStatus(structure.status);
  const id = crypto.randomUUID();
  const mapped: TaskRecord = {
    id,
    text: structure.payload ?? structure.description ?? '',
    targets: [{ id: crypto.randomUUID(), taskId: id, targetType, targetId }],
    priority: normalizeTaskPriority(structure.priority),
    status,
    createdAt: parseTaskTextDate(structure.createdDate),
    updatedAt: Date.now(),
    scheduledAt: taskDateValueToTimestamp(mapDate(structure.date), structure.date?.interpreted),
    reminderAt: taskDateValueToTimestamp(mapDate(structure.reminderDate), structure.reminderDate?.interpreted),
    closedAt:
      status === 'closed'
        ? taskDateValueToTimestamp(mapDate(structure.closedDate), structure.closedDate?.interpreted)
        : undefined,
  };
  ctx.repo.insertTask(mapped);
  importNotes(structure.notes, 'task', mapped.id, ctx);
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
  if (!ctx.sourceIdsReady) {
    // Sources are registered after places, notes and media records; defer the
    // whole citation (including its nested notes/media) to the flush pass.
    ctx.pendingCitations.push({ citation, targetType, targetId });
    return;
  }
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
    www: citation.www ?? citation.data?.www,
    name: citation.name,
    qualityAssessment:
      citation.qualityAssessment !== undefined
        ? [
            citation.qualityAssessment.source,
            citation.qualityAssessment.information,
            citation.qualityAssessment.evidence,
          ]
            .filter((part) => part !== undefined && part !== '')
            .join(' / ') || undefined
        : undefined,
    reference: citation.reference,
    referenceNumber: citation.referenceNumber,
    abbreviation: citation.abbreviation,
    footnote: citation.footnote,
    verified: citation.verified,
    assessment: citation.assessment,
    foundBy: citation.foundBy,
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
  importMediaLinks(citation.media, 'citation', mapped.id, ctx);
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
      continue;
    }
    const note = structure;
    const id = crypto.randomUUID();
    const now = Date.now();
    ctx.repo.insertNote({
      id,
      text: note.payload,
      createdAt: now,
      updatedAt: now,
      links: [{ id: crypto.randomUUID(), targetType, targetId }],
    });
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
      ...('type' in structure ? { type: structure.type } : {}),
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

function importSubmitterLinks(
  submitters: string[] | undefined,
  targetType: string,
  targetId: string,
  ctx: ImportContext,
  kind: 'contributor' | 'ancestor_interest' | 'descendant_interest' = 'contributor',
): void {
  for (const submitter of submitters ?? []) {
    const submitterId = ctx.submitterIds.get(submitter);
    if (submitterId !== undefined) {
      ctx.repo.insertRecordSubmitter(crypto.randomUUID(), submitterId, targetType, targetId, kind);
    }
  }
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

/** Postal codes with their optional dated validity rows. */
function mapPostalCodes(
  codes: Array<{ code: string; date?: DateStructure | undefined }>,
): NonNullable<PlaceRecord['postalCodes']> {
  return codes.map((postal) => {
    const date = postal.date !== undefined ? mapDate(postal.date) : undefined;
    return {
      id: crypto.randomUUID(),
      code: postal.code,
      ...(date !== undefined ? { date } : {}),
    };
  });
}

/** Signed coordinate from a GEDCOM MAP direction (S/W are negative). */
function mapCoordinate(
  value: { direction: string; degrees: number } | undefined,
  negativeDirection: string,
): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  return value.direction === negativeDirection ? -value.degrees : value.degrees;
}

/** Imports the global OBJE records before any link references them. */
function importMediaRecords(records: GedcomRecord[], ctx: ImportContext): void {
  for (const record of records) {
    if (record.tag !== 'OBJE') {
      continue;
    }
    const files = record.files
      .filter((file) => file.payload !== '')
      .map((file) => ({
        id: crypto.randomUUID(),
        path: ctx.mediaPaths.get(file.payload) ?? file.payload,
        ...(file.title !== undefined ? { title: file.title } : {}),
        ...(file.form?.medium !== undefined ? { medium: file.form.medium.payload } : {}),
        ...(file.contentType !== undefined ? { contentType: file.contentType } : {}),
        ...(file.text !== undefined ? { text: file.text } : {}),
        ...(file.translations !== undefined && file.translations.length > 0
          ? {
              translations: file.translations.map((translation, position) => ({
                id: crypto.randomUUID(),
                path: ctx.mediaPaths.get(translation.payload) ?? translation.payload,
                position,
              })),
            }
          : {}),
      }));
    if (files.length === 0) {
      // A record with only FORM/BLOB (or an empty FILE) has no path to
      // store; registering its xref would make later OBJE links point at a
      // media row that does not exist and fail the import on the FK.
      continue;
    }
    const id = crypto.randomUUID();
    ctx.repo.insertMedia({
      id,
      ...(record.xref !== undefined ? { xref: record.xref } : {}),
      ...(record.title !== undefined ? { title: record.title } : {}),
      ...(record.date !== undefined ? { date: mapDate(record.date) } : {}),
      ...(record.place !== undefined ? { place: record.place } : {}),
      ...(record.objectType !== undefined ? { objectType: record.objectType } : {}),
      ...(record.description !== undefined ? { description: record.description } : {}),
      ...(record.keywords !== undefined ? { keywords: record.keywords } : {}),
      files,
    });
    if (record.place !== undefined) {
      ctx.mediaPlaceText.set(id, record.place);
    }
    importCitations(record.citations, 'media', id, ctx);
    if (record.xref !== undefined) {
      ctx.mediaIds.set(record.xref, id);
    }
    importNotes(record.notes, 'media', id, ctx);
    importIdentifiers(record.identifiers, 'media', id, ctx);
    importSubmitterLinks(record.submitters, 'media', id, ctx);
  }
}

/** Imports every citation queued before the SOUR records had ids. */
function flushPendingCitations(ctx: ImportContext): void {
  const pending = ctx.pendingCitations;
  ctx.pendingCitations = [];
  for (const entry of pending) {
    importCitation(entry.citation, entry.targetType, entry.targetId, ctx);
  }
}

/** Resolves historical media places after the place records are registered. */
function linkMediaPlaces(ctx: ImportContext): void {
  for (const [mediaId, placeText] of ctx.mediaPlaceText) {
    if (ctx.ambiguousPlaceNames.has(placeText)) {
      continue;
    }
    const placeId = ctx.placeIds.get(placeText);
    if (placeId !== undefined) {
      ctx.repo.setMediaPlaceId(mediaId, placeId);
    }
  }
}

/** Imports OBJE links under a structure into the media_link table. */
function importMediaLinks(
  links:
    | Array<{
        object: string;
        crop?: { top?: number; left?: number; height?: number; width?: number } | undefined;
        title?: string | undefined;
        sequence?: number | undefined;
        primary?: boolean | undefined;
        scrapbook?: boolean | undefined;
        slideshow?: boolean | undefined;
        thumbnail?: boolean | undefined;
        excludeFromDiagrams?: boolean | undefined;
        caption?: boolean | undefined;
        citations?: SourceCitation[] | undefined;
      }>
    | undefined,
  targetType: string,
  targetId: string,
  ctx: ImportContext,
): void {
  for (const link of links ?? []) {
    const mediaId = ctx.mediaIds.get(link.object);
    if (mediaId === undefined) {
      continue;
    }
    const linkId = crypto.randomUUID();
    ctx.repo.addMediaLink(mediaId, {
      id: linkId,
      mediaId,
      targetType,
      targetId,
      ...(link.crop !== undefined ? { crop: link.crop } : {}),
      ...(link.title !== undefined ? { title: link.title } : {}),
      ...(link.sequence !== undefined ? { sequence: link.sequence } : {}),
      ...(link.primary !== undefined ? { primary: link.primary } : {}),
      ...(link.scrapbook !== undefined ? { scrapbook: link.scrapbook } : {}),
      ...(link.slideshow !== undefined ? { slideshow: link.slideshow } : {}),
      ...(link.thumbnail !== undefined ? { thumbnail: link.thumbnail } : {}),
      ...(link.excludeFromDiagrams !== undefined ? { exclude: link.excludeFromDiagrams } : {}),
      ...(link.caption !== undefined ? { caption: link.caption } : {}),
    });
    importCitations(link.citations, 'media_link', linkId, ctx);
  }
}

/** Imports the shared place cards (`_LOC`/`_PLAC`) before anything references them. */
function importPlaceRecords(records: GedcomRecord[], ctx: ImportContext): void {
  for (const record of records) {
    if (!isPlaceRecord(record)) {
      continue;
    }
    const id = crypto.randomUUID();
    if (record.xref !== undefined) {
      ctx.placeCardIds.set(record.xref, id);
    }
    const names = (record.names ?? []).map((entry, position) => {
      const abbreviation = entry.abbreviations?.[0];
      return {
        id: crypto.randomUUID(),
        kind: (extensionText(entry.extensions, '_KIND') ?? 'official') as PlaceName['kind'],
        ...(entry.language !== undefined ? { language: entry.language } : {}),
        ...(extensionText(entry.extensions, '_TYPE') !== undefined
          ? { type: extensionText(entry.extensions, '_TYPE') as string }
          : {}),
        position,
        value: entry.name,
        ...(entry.date !== undefined ? { date: mapDate(entry.date) } : {}),
        ...(entry.addition !== undefined ? { addition: entry.addition } : {}),
        ...(abbreviation !== undefined
          ? {
              abbreviation: abbreviation.abbreviation,
              ...(abbreviation.type !== undefined ? { abbreviationType: abbreviation.type } : {}),
            }
          : {}),
      };
    });
    if (names.length === 0 && record.payload !== '') {
      names.push({ id: crypto.randomUUID(), kind: 'official', position: 0, value: record.payload });
    }
    const official = names
      .filter((name) => name.kind === 'official')
      .sort((a, b) => a.position - b.position)
      .map((name) => name.value);
    const joined = official.length > 0 ? official.join(', ') : record.payload;
    const rememberPlace = (name: string): void => {
      const existing = ctx.placeIds.get(name);
      if (existing !== undefined && existing !== id) {
        ctx.ambiguousPlaceNames.add(name);
      } else {
        ctx.placeIds.set(name, id);
      }
    };
    if (joined !== '') {
      rememberPlace(joined);
    }
    if (record.xref !== undefined && record.payload !== '') {
      rememberPlace(record.payload);
    }
    const verified = record.extensions?.some(
      (extension) => extension.tag === '_VERI' && (extension.payload === 'Y' || extension.payload === '1'),
    );
    const latitude = mapCoordinate(record.map?.latitude, 'S');
    const longitude = mapCoordinate(record.map?.longitude, 'W');
    ctx.repo.insertPlace({
      id,
      ...(record.xref !== undefined ? { xref: record.xref } : {}),
      ...(latitude !== undefined ? { latitude } : {}),
      ...(longitude !== undefined ? { longitude } : {}),
      ...(verified === true ? { verified: true } : {}),
      ...(record.form !== undefined ? { form: record.form.split(',') } : {}),
      ...(record.abbreviation !== undefined ? { abbreviation: record.abbreviation } : {}),
      ...(record.preposition !== undefined ? { preposition: record.preposition } : {}),
      ...(record.govId !== undefined ? { govId: record.govId } : {}),
      ...(record.maidenhead !== undefined ? { maidenhead: record.maidenhead } : {}),
      ...(record.types !== undefined && record.types.length > 0 ? { placeType: record.types[0]?.type } : {}),
      names,
      ...(record.postalCodes !== undefined && record.postalCodes.length > 0
        ? { postalCodes: mapPostalCodes(record.postalCodes) }
        : {}),
    });
    importCitations(record.citations, 'place', id, ctx);
    importNotes(record.notes, 'place', id, ctx);
    importMediaLinks(record.media, 'place', id, ctx);
    importIdentifiers(record.identifiers, 'place', id, ctx);
    if (record.parents !== undefined && record.parents.length > 0) {
      ctx.placeParents.set(
        id,
        record.parents.map((parent) => ({
          parentXref: parent.parent,
          ...(parent.type !== undefined ? { type: parent.type.toLowerCase() } : {}),
          ...(parent.date !== undefined ? { date: mapDate(parent.date) } : {}),
        })),
      );
    }
  }
}

/** Resolves card parent links after every card has an id. */
function linkPlaceHierarchy(ctx: ImportContext): void {
  for (const [childId, parents] of ctx.placeParents) {
    const place = ctx.repo.getPlace(childId);
    if (place === undefined) {
      continue;
    }
    const hierarchy = parents.flatMap((parent) => {
      const parentId = ctx.placeCardIds.get(parent.parentXref);
      return parentId !== undefined
        ? [
            {
              id: crypto.randomUUID(),
              parentId,
              ...(parent.type !== undefined ? { type: parent.type } : {}),
              ...(parent.date !== undefined ? { date: parent.date } : {}),
            },
          ]
        : [];
    });
    if (hierarchy.length > 0) {
      ctx.repo.updatePlace({ ...place, hierarchy });
    }
  }
}

/**
 * Creates (or reuses, by joined name) the place row for a GEDCOM place
 * structure, carrying the jurisdiction names, coordinates and variants.
 */
function importPlace(place: PlaceStructure, ctx: ImportContext): string | undefined {
  const cardId = place.location !== undefined ? ctx.placeCardIds.get(place.location) : undefined;
  if (cardId !== undefined) {
    return cardId;
  }
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
    ...(place.language !== undefined ? { language: place.language } : {}),
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
  const latitude = mapCoordinate(place.map?.latitude, 'S');
  const longitude = mapCoordinate(place.map?.longitude, 'W');
  ctx.repo.insertPlace({
    id,
    ...(latitude !== undefined ? { latitude } : {}),
    ...(longitude !== undefined ? { longitude } : {}),
    ...(place.verified === true ? { verified: true } : {}),
    ...(place.form !== undefined && place.form.length > 0 ? { form: place.form } : {}),
    names: [...names, ...variants],
    ...(place.postalCodes !== undefined && place.postalCodes.length > 0
      ? { postalCodes: mapPostalCodes(place.postalCodes) }
      : {}),
  });
  importCitations(place.citations, 'place', id, ctx);
  importNotes(place.notes, 'place', id, ctx);
  importIdentifiers(place.externalIds, 'place', id, ctx);
  const existingPlace = ctx.placeIds.get(joined);
  if (existingPlace !== undefined && existingPlace !== id) {
    ctx.ambiguousPlaceNames.add(joined);
  } else {
    ctx.placeIds.set(joined, id);
  }
  return id;
}
