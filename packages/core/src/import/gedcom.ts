import type {
  Calendar,
  DateFields,
  DateValue as GedcomDateValue,
  GedcomMonth,
  PersonalName,
} from '@doru/gedcom';
import type {
  DateStructure,
  EventDetail,
  FamilyRecord as GedcomFamilyRecord,
  GedcomDataset,
  GedcomRecord,
  IndividualRecord as GedcomIndividualRecord,
  NoteStructure,
  PersonalNameStructure,
  SourceCitation,
  SourceRecord as GedcomSourceRecord,
} from '@doru/gedcom';
import { isFamilyRecord, isIndividualRecord } from '@doru/gedcom';
import type { TreeRepository } from '../db/repository';
import type {
  CitationRecord,
  DateComponent,
  DateValue,
  FactRecord,
  FamilyRecord,
  NoteRecord,
  PersonName,
  PersonRecord,
  Sex,
  SourceRecord,
} from '../model/types';

/**
 * GEDCOM dataset → tree mapping. The GEDCOM object model is the subject
 * source; the tree model is Dóru's own. This module is the single place
 * where the two meet, so every projection decision (calendars, name pieces,
 * citations, …) lives here and nowhere else.
 *
 * Deliberately not imported, for now:
 * - media: GEDCOM file references point at the exporting machine's files;
 *   until Dóru resolves/copies them they have no usable path;
 * - repository records (REPO): the tree has no repository entity yet;
 * - LDS ordinances, associations, aliases, identifiers, change dates:
 *   the tree has no slots for them yet.
 */

export interface GedcomImportResult {
  importedPersons: number;
  importedFamilies: number;
  totalPersons: number;
}

/**
 * Writes every person, family, source, citation and note of the dataset
 * into the repository, in one transaction. Record ids are fresh UUIDs; the
 * GEDCOM cross-reference lands in `xref` for later round-trip export.
 */
export function importGedcomDataset(dataset: GedcomDataset, repo: TreeRepository): GedcomImportResult {
  const notesByXref = new Map<string, string>();
  for (const record of dataset.records) {
    if ((record.tag === 'NOTE' || record.tag === 'SNOTE') && record.xref !== undefined) {
      notesByXref.set(record.xref, record.payload);
    }
  }

  let importedPersons = 0;
  let importedFamilies = 0;
  repo.transaction(() => {
    const sourceIds = importSources(dataset.records, repo);
    const personIds = new Map<string, string>();
    for (const record of dataset.records) {
      if (isIndividualRecord(record)) {
        importPerson(record, repo, personIds, sourceIds, notesByXref);
        importedPersons += 1;
      }
    }
    for (const record of dataset.records) {
      if (isFamilyRecord(record)) {
        importFamily(record, repo, personIds, sourceIds, notesByXref);
        importedFamilies += 1;
      }
    }
  });
  return { importedPersons, importedFamilies, totalPersons: repo.countPersons() };
}

// ---------------------------------------------------------------------------
// Persons
// ---------------------------------------------------------------------------

function importPerson(
  record: GedcomIndividualRecord,
  repo: TreeRepository,
  personIds: Map<string, string>,
  sourceIds: Map<string, string>,
  notesByXref: Map<string, string>,
): void {
  const id = crypto.randomUUID();
  if (record.xref !== undefined) {
    personIds.set(record.xref, id);
  }
  const mappedNames = (record.names ?? []).map((structure) => ({ structure, name: mapName(structure) }));
  const facts: FactRecord[] = [];
  const attachments: Array<{ factId: string; detail: EventDetail | undefined }> = [];
  for (const structure of [...(record.events ?? []), ...(record.attributes ?? [])]) {
    const fact = mapIndividualFact(structure, id);
    facts.push(fact);
    attachments.push({ factId: fact.id, detail: structure.detail });
  }
  const person: PersonRecord = {
    id,
    xref: record.xref,
    sex: mapSex(record.sex),
    names: mappedNames.map((entry) => entry.name),
    facts,
  };
  repo.insertPerson(person);
  for (const { structure, name } of mappedNames) {
    importCitations(structure.citations, 'name', name.id, repo, sourceIds);
  }
  for (const { factId, detail } of attachments) {
    importCitations(detail?.citations, 'fact', factId, repo, sourceIds);
    importNotes(detail?.notes, 'fact', factId, repo, notesByXref);
  }
  importCitations(record.citations, 'person', id, repo, sourceIds);
  importNotes(record.notes, 'person', id, repo, notesByXref);
}

function mapIndividualFact(
  structure: { tag: string; type?: string; payload?: 'Y' | string | number; detail?: EventDetail },
  personId: string,
): FactRecord {
  return {
    id: crypto.randomUUID(),
    personId,
    tag: structure.tag,
    type: structure.type,
    value: structure.payload === undefined || structure.payload === 'Y' ? undefined : String(structure.payload),
    date: mapDate(structure.detail?.date),
    place: mapPlace(structure.detail?.place),
  };
}

function mapName(structure: PersonalNameStructure): PersonName {
  const payload = structure.payload;
  const pieces = structure.pieces;
  const full = joinName(payload, pieces);
  return {
    id: crypto.randomUUID(),
    full: full || undefined,
    given: payload.given || pieces?.givenNames?.[0],
    surname: payload.surname || pieces?.surnames?.[0],
    surnamePrefix: pieces?.surnamePrefixes?.[0],
    nickname: pieces?.nicknames?.[0],
    prefix: pieces?.namePrefixes?.[0],
    suffix: payload.suffix || pieces?.nameSuffixes?.[0],
    type: structure.type ? structure.type.payload.toLowerCase() : undefined,
  };
}

function joinName(payload: PersonalName, pieces: PersonalNameStructure['pieces']): string {
  const given = payload.given || pieces?.givenNames?.join(' ') || '';
  const surname = payload.surname || pieces?.surnames?.join(' ') || '';
  const suffix = payload.suffix || pieces?.nameSuffixes?.join(' ') || '';
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
      // 'N' (not recorded) and extension values have no tree slot yet.
      return 'U';
  }
}

// ---------------------------------------------------------------------------
// Families
// ---------------------------------------------------------------------------

function importFamily(
  record: GedcomFamilyRecord,
  repo: TreeRepository,
  personIds: Map<string, string>,
  sourceIds: Map<string, string>,
  notesByXref: Map<string, string>,
): void {
  const id = crypto.randomUUID();
  const partners: string[] = [];
  for (const link of [record.husband, record.wife]) {
    if (!link) {
      continue;
    }
    const personId = personIds.get(link.partner);
    if (personId !== undefined) {
      partners.push(personId);
    }
  }
  const children: string[] = [];
  for (const link of record.children ?? []) {
    const personId = personIds.get(link.child);
    if (personId !== undefined) {
      children.push(personId);
    }
  }
  const family: FamilyRecord = { id, xref: record.xref, partners, children };
  repo.insertFamily(family);
  const structures = [...(record.events ?? []), ...(record.attributes ?? [])];
  for (const structure of structures) {
    const detail = structure.detail?.detail;
    const fact: FactRecord = {
      id: crypto.randomUUID(),
      familyId: id,
      tag: structure.tag,
      type: structure.type,
      value:
        structure.payload === undefined || structure.payload === 'Y'
          ? undefined
          : String(structure.payload),
      date: mapDate(detail?.date),
      place: mapPlace(detail?.place),
    };
    repo.insertFact(fact);
    importCitations(detail?.citations, 'fact', fact.id, repo, sourceIds);
    importNotes(detail?.notes, 'fact', fact.id, repo, notesByXref);
  }
  importCitations(record.citations, 'family', id, repo, sourceIds);
  importNotes(record.notes, 'family', id, repo, notesByXref);
}

// ---------------------------------------------------------------------------
// Sources, citations, notes
// ---------------------------------------------------------------------------

function importSources(records: GedcomRecord[], repo: TreeRepository): Map<string, string> {
  const sourceIds = new Map<string, string>();
  for (const record of records) {
    if (record.tag !== 'SOUR') {
      continue;
    }
    const source = record as GedcomSourceRecord;
    const id = crypto.randomUUID();
    if (source.xref !== undefined) {
      sourceIds.set(source.xref, id);
    }
    repo.insertSource(mapSource(source, id));
  }
  return sourceIds;
}

function mapSource(record: GedcomSourceRecord, id: string): SourceRecord {
  return {
    id,
    xref: record.xref,
    title: record.title || record.abbreviation || record.author || `Source ${record.xref ?? ''}`.trim(),
    abbreviation: record.abbreviation,
    author: record.author,
    publication: record.publication,
  };
}

function importCitations(
  citations: SourceCitation[] | undefined,
  targetType: string,
  targetId: string,
  repo: TreeRepository,
  sourceIds: Map<string, string>,
): void {
  for (const citation of citations ?? []) {
    const sourceId = sourceIds.get(citation.source);
    if (sourceId === undefined) {
      // A void pointer or an unknown xref: nothing to cite in the tree.
      continue;
    }
    const record: CitationRecord = {
      id: crypto.randomUUID(),
      sourceId,
      targetType,
      targetId,
      page: citation.page?.payload,
      quality: citation.quality,
    };
    repo.insertCitation(record);
  }
}

function importNotes(
  structures: NoteStructure[] | undefined,
  targetType: string,
  targetId: string,
  repo: TreeRepository,
  notesByXref: Map<string, string>,
): void {
  for (const structure of structures ?? []) {
    const text = noteText(structure, notesByXref);
    if (text === undefined) {
      continue;
    }
    const note: NoteRecord = { id: crypto.randomUUID(), text, targetType, targetId };
    repo.insertNote(note);
  }
}

function noteText(structure: NoteStructure, notesByXref: Map<string, string>): string | undefined {
  if ('payload' in structure) {
    return structure.payload;
  }
  if ('note' in structure) {
    return notesByXref.get(structure.note);
  }
  return undefined;
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
  return phrase ? { ...date, text: phrase } : date;
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
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
  JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
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

function mapPlace(place: { payload: string[] } | undefined): string | undefined {
  if (!place || place.payload.length === 0) {
    return undefined;
  }
  return place.payload.join(', ');
}
