import type {
  Calendar,
  DateFields,
  DateStructure,
  DateValue as GedcomDateValue,
  Epoch,
  EventDetail,
  FamilyAttributeStructure,
  FamilyChildLink,
  FamilyEventStructure,
  FamilyPartnerLink,
  FamilyRecord as GedcomFamilyRecord,
  GedcomDataset,
  GedcomMonth,
  GedcomRecord,
  IndividualAttributeStructure,
  IndividualEventStructure,
  IndividualRecord,
  NameTypeStructure,
  NoteStructure,
  PersonalNameStructure,
  PlaceStructure,
  QualityEnum,
  SourceCitation,
  SourceRecord as GedcomSourceRecord,
} from '@doru/gedcom';
import type { TreeRepository } from '../db/repository';
import type {
  DateComponent,
  DateValue,
  FactRecord,
  FamilyRecord,
  PersonName,
  PersonRecord,
  SourceRecord,
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
  for (const person of persons) {
    xrefs.assign('I', person.id, person.xref);
  }
  for (const family of families) {
    xrefs.assign('F', family.id, family.xref);
  }
  for (const source of sources) {
    xrefs.assign('S', source.id, source.xref);
  }
  const records: GedcomRecord[] = [
    ...persons.map((person) => buildPerson(person, repo, xrefs)),
    ...families.map((family) => buildFamily(family, repo, xrefs)),
    ...sources.map((source) => buildSource(source, repo, xrefs)),
  ];
  return {
    header: {
      tag: 'HEAD',
      gedcom: { version: '7.0' },
      source: { payload: 'DORU' },
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
  for (const fact of person.facts) {
    const mapped = buildPersonFact(fact, repo, xrefs);
    if (mapped.kind === 'event') {
      events.push(mapped.structure);
    } else {
      attributes.push(mapped.structure);
    }
  }
  return {
    tag: 'INDI',
    xref: xrefs.of(person.id),
    sex: person.sex,
    names: person.names.map((name) => buildName(name, repo, xrefs)),
    ...(events.length > 0 ? { events } : {}),
    ...(attributes.length > 0 ? { attributes } : {}),
    ...withCitations(repo, 'person', person.id, xrefs),
    ...withNotes(repo, 'person', person.id),
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
function buildPersonFact(
  fact: FactRecord,
  repo: TreeRepository,
  xrefs: Xrefs,
): MappedPersonFact {
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
  const pieces = {
    ...(name.prefix !== undefined ? { namePrefixes: [name.prefix] } : {}),
    ...(name.given !== undefined ? { givenNames: [name.given] } : {}),
    ...(name.nickname !== undefined ? { nicknames: [name.nickname] } : {}),
    ...(name.surnamePrefix !== undefined ? { surnamePrefixes: [name.surnamePrefix] } : {}),
    ...(name.surname !== undefined ? { surnames: [name.surname] } : {}),
    ...(name.suffix !== undefined ? { nameSuffixes: [name.suffix] } : {}),
  };
  return {
    tag: 'NAME',
    payload: {
      ...(name.given !== undefined ? { given: name.given } : {}),
      ...(name.surname !== undefined ? { surname: name.surname } : {}),
      ...(name.suffix !== undefined ? { suffix: name.suffix } : {}),
    },
    ...(name.type !== undefined ? { type: mapNameType(name.type) } : {}),
    pieces,
    ...withCitations(repo, 'name', name.id, xrefs),
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
  const [first, second] = family.partners;
  // The GEDCOM model has exactly two partner slots (HUSB/WIFE in both
  // versions); families with more partners export the first two.
  const husband: FamilyPartnerLink | undefined =
    first !== undefined ? ({ partner: xrefs.of(first) } as FamilyPartnerLink) : undefined;
  const wife: FamilyPartnerLink | undefined =
    second !== undefined ? ({ partner: xrefs.of(second) } as FamilyPartnerLink) : undefined;
  const children = family.children.map((childId) => ({ child: xrefs.of(childId) }) as FamilyChildLink);
  const events: FamilyEventStructure[] = [];
  const attributes: FamilyAttributeStructure[] = [];
  for (const fact of repo.listFactsForFamily(family.id)) {
    const mapped = buildFamilyFact(fact, repo, xrefs);
    if (mapped.kind === 'event') {
      events.push(mapped.structure);
    } else {
      attributes.push(mapped.structure);
    }
  }
  return {
    tag: 'FAM',
    xref: xrefs.of(family.id),
    ...(husband !== undefined ? { husband } : {}),
    ...(wife !== undefined ? { wife } : {}),
    ...(children.length > 0 ? { children } : {}),
    ...(events.length > 0 ? { events } : {}),
    ...(attributes.length > 0 ? { attributes } : {}),
    ...withCitations(repo, 'family', family.id, xrefs),
    ...withNotes(repo, 'family', family.id),
  };
}

function buildFamilyFact(
  fact: FactRecord,
  repo: TreeRepository,
  xrefs: Xrefs,
): MappedFamilyFact {
  const detail = buildDetail(fact, repo, xrefs);
  const familyDetail = detail !== undefined ? { detail } : {};
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
// Sources, citations, notes
// ---------------------------------------------------------------------------

function buildSource(source: SourceRecord, repo: TreeRepository, xrefs: Xrefs): GedcomSourceRecord {
  return {
    tag: 'SOUR',
    xref: xrefs.of(source.id),
    ...(source.title !== undefined ? { title: source.title } : {}),
    ...(source.abbreviation !== undefined ? { abbreviation: source.abbreviation } : {}),
    ...(source.author !== undefined ? { author: source.author } : {}),
    ...(source.publication !== undefined ? { publication: source.publication } : {}),
    ...withNotes(repo, 'source', source.id),
  };
}

function withCitations(
  repo: TreeRepository,
  targetType: string,
  targetId: string,
  xrefs: Xrefs,
): { citations: SourceCitation[] } {
  const citations: SourceCitation[] = repo.listCitationRecordsFor(targetType, targetId).map((row) => ({
    tag: 'SOUR',
    source: xrefs.of(row.sourceId),
    ...(row.page !== undefined ? { page: { tag: 'PAGE', payload: row.page } } : {}),
    ...(row.quality !== undefined ? { quality: row.quality as QualityEnum } : {}),
  }));
  return { citations };
}

function withNotes(repo: TreeRepository, targetType: string, targetId: string): { notes: NoteStructure[] } {
  const notes: NoteStructure[] = repo
    .listNotesFor(targetType, targetId)
    .map((row) => ({ tag: 'NOTE', payload: row.text }));
  return { notes };
}

// ---------------------------------------------------------------------------
// Dates and places
// ---------------------------------------------------------------------------

function buildDetail(fact: FactRecord, repo: TreeRepository, xrefs: Xrefs): EventDetail | undefined {
  const date = buildDate(fact.date);
  const place: PlaceStructure | undefined =
    fact.place !== undefined ? ({ tag: 'PLAC', payload: [fact.place] } as PlaceStructure) : undefined;
  const citations: SourceCitation[] = repo.listCitationRecordsFor('fact', fact.id).map((row) => ({
    tag: 'SOUR',
    source: xrefs.of(row.sourceId),
    ...(row.page !== undefined ? { page: { tag: 'PAGE', payload: row.page } } : {}),
    ...(row.quality !== undefined ? { quality: row.quality as QualityEnum } : {}),
  }));
  const notes = repo
    .listNotesFor('fact', fact.id)
    .map((row) => ({ tag: 'NOTE', payload: row.text }) as NoteStructure);
  if (date === undefined && place === undefined && citations.length === 0 && notes.length === 0) {
    return undefined;
  }
  return {
    ...(date !== undefined ? { date } : {}),
    ...(place !== undefined ? { place } : {}),
    ...(citations.length > 0 ? { citations } : {}),
    ...(notes.length > 0 ? { notes } : {}),
  };
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
