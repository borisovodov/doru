/**
 * The tree domain model shared by the database layer, the operation layer
 * and the renderer (over IPC). Pure data shapes plus a handful of helpers;
 * no database or UI code lives here.
 */

export type Sex = 'M' | 'F' | 'X' | 'U';

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

/**
 * How precise or qualified a date is. 'range' covers both bounded ranges
 * ("between … and …") and open-ended periods ("from …", "… to …"): the
 * `component` is the start bound and `end` the end bound, either of which
 * may be missing.
 */
export type DateQuality = 'exact' | 'about' | 'before' | 'after' | 'range' | 'unknown';

/**
 * One calendar date with partial precision: any of year/month/day may be
 * unknown. Years are 1-based; `epoch: 'BCE'` marks years before the common
 * era. `calendar` is absent for Gregorian, 'julian', 'french_republican' or
 * 'hebrew' for the other GEDCOM calendars; unknown values (extension
 * calendars) are kept verbatim and treated as opaque.
 */
export interface DateComponent {
  calendar?: string | undefined;
  year?: number | undefined;
  /**
   * The calendar month: a number 1–12 for the Gregorian and Julian
   * calendars, or the calendar's own month code (e.g. 'VEND', 'TSH') for
   * the calendars the UI does not edit numerically yet.
   */
  month?: number | string | undefined;
  day?: number | undefined;
  epoch?: 'BCE' | undefined;
}

/** A time of day, optionally with UTC flag (GEDCOM TIME). */
export interface TimeValue {
  hour: number;
  minute: number;
  second?: number | undefined;
  fraction?: string | undefined;
  utc?: boolean | undefined;
}

export interface DateValue {
  /** The date row id, when the date is addressable (for edits and citations). */
  id?: string | undefined;
  quality: DateQuality;
  /**
   * Refines an 'about' date: how the approximation was reached — ABT
   * (near), CAL (calculated), EST (estimated). Only meaningful when
   * `quality` is 'about'; imported data keeps it, the editor does not
   * expose it yet.
   */
  modifier?: 'ABT' | 'CAL' | 'EST' | undefined;
  /** The primary date; absent when only `text` is known. */
  component?: DateComponent | undefined;
  /** The end bound when `quality` is 'range'. */
  end?: DateComponent | undefined;
  /** Free-text date description, shown when the structured fields cannot express the date. */
  text?: string | undefined;
  /** Time of day, when known. */
  time?: TimeValue | undefined;
}

/** The astronomical (signed) year of a date component: BCE years count down from 0. */
export function signedYear(component: DateComponent | undefined): number | undefined {
  if (component?.year === undefined) {
    return undefined;
  }
  return component.epoch === 'BCE' ? 1 - component.year : component.year;
}

// ---------------------------------------------------------------------------
// Persons, families, facts
// ---------------------------------------------------------------------------

/**
 * One piece of a person's name: a given name, a surname, a prefix, … The
 * pieces are stored as rows; any number of each kind is allowed. `full` is a
 * special kind holding the display form verbatim when it cannot be derived
 * from the pieces.
 */
export type NamePartKind =
  | 'full'
  | 'prefix'
  | 'given'
  | 'nickname'
  | 'surnamePrefix'
  | 'surname'
  | 'suffix';

export interface NamePart {
  id: string;
  kind: NamePartKind;
  value: string;
  position: number;
}

/**
 * One name of a person. A person can carry several names (birth name,
 * married name, alias, …) and each name can carry variants (translations,
 * phonetic and romanized forms) as nested `variants`. `id` keeps the name
 * addressable across edits (citations and notes may target it).
 *
 * The flat fields (`full`, `given`, `surname`, …) are projections of the
 * first part of each kind — kept for the renderer and the agents; the parts
 * themselves live in `parts`. When `parts` is absent on write, the flat
 * fields are turned into parts by the repository.
 */
export interface PersonName {
  id: string;
  /** Translation/phonetic/romanized variant of another name; undefined for a top-level name. */
  kind?: 'translation' | 'phonetic' | 'romanized' | undefined;
  language?: string | undefined;
  /** The name's kind: 'birth', 'maiden', 'married', 'aka', … */
  type?: string | undefined;
  /** The preferred name of the person. */
  primary?: boolean | undefined;
  date?: DateValue | undefined;
  /** The verbatim display form, when a 'full' part is stored; consumers join the pieces otherwise. */
  full?: string | undefined;
  given?: string | undefined;
  surname?: string | undefined;
  /** Non-indexing pre-part of the surname ('van', 'de', 'von', …). */
  surnamePrefix?: string | undefined;
  nickname?: string | undefined;
  prefix?: string | undefined;
  suffix?: string | undefined;
  parts?: NamePart[] | undefined;
  variants?: PersonName[] | undefined;
}

/**
 * A fact about a person or a family: a life event (birth, death, marriage)
 * or an attribute (occupation, residence). The `tag` names the kind
 * ('BIRT', 'DEAT', 'MARR', 'OCCU', …; 'EVEN'/'FACT' carry their subtype in
 * `type`), `value` holds the payload — an attribute value, a free-text
 * description, or the assertion marker on events.
 */
export interface FactRecord {
  id: string;
  /** The owning person; exactly one of `personId` / `familyId` is set. */
  personId?: string | undefined;
  /** The owning family; exactly one of `personId` / `familyId` is set. */
  familyId?: string | undefined;
  tag: string;
  /** Free-text subtype refining the tag (required for generic EVEN/FACT). */
  type?: string | undefined;
  value?: string | undefined;
  /** The fact asserts the event did NOT happen (GEDCOM NO). */
  negation?: boolean | undefined;
  date?: DateValue | undefined;
  /** Sort date (GEDCOM SDATE): orders the fact when the display date cannot. */
  sortDate?: DateValue | undefined;
  /** The place entity this fact happened at; the raw string stays in `place`. */
  placeId?: string | undefined;
  /** The place as typed/displayed. */
  place?: string | undefined;
  addressId?: string | undefined;
  agency?: string | undefined;
  religiousAffiliation?: string | undefined;
  cause?: string | undefined;
  /** Display sentence template (GEDCOM SENT). */
  sentence?: string | undefined;
  quality?: string | undefined;
  /** Ages at the fact (the subject's, or per partner role on family facts). */
  ages?: FactAge[] | undefined;
  /** Witnesses and other participants. */
  participants?: FactParticipant[] | undefined;
  /** Flags: private | preferred | tentative | rejected. */
  flags?: string[] | undefined;
}

/** An age at a fact: the subject's (no person/role) or a partner's (HUSB/WIFE). */
export interface FactAge {
  id: string;
  personId?: string | undefined;
  role?: string | undefined;
  bound?: string | undefined;
  years?: number | undefined;
  months?: number | undefined;
  weeks?: number | undefined;
  days?: number | undefined;
  phrase?: string | undefined;
}

/** A witness or participant of a fact: a linked person or a free-text name. */
export interface FactParticipant {
  id: string;
  personId?: string | undefined;
  value?: string | undefined;
  role?: string | undefined;
  position: number;
}

/** A user-defined fact type (custom event/attribute definitions). */
export interface FactTypeRecord {
  id: string;
  code?: string | undefined;
  kind?: string | undefined;
  title?: string | undefined;
  abbreviation?: string | undefined;
  sentence?: string | undefined;
  confidential?: boolean | undefined;
}

export interface PersonRecord {
  id: string;
  /** Identifier assigned by a GEDCOM import; provenance only. */
  xref?: string | undefined;
  sex: Sex;
  names: PersonName[];
  /** The person's facts (events and attributes), including birth and death. */
  facts: FactRecord[];
}

/** The person's fact with the given tag, if any (e.g. 'BIRT'). */
export function factOf(person: PersonRecord, tag: string): FactRecord | undefined {
  return person.facts.find((fact) => fact.tag === tag);
}

/** The astronomical year of the person's fact with the given tag, if known. */
export function factYear(person: PersonRecord | undefined, tag: string): number | undefined {
  return person ? signedYear(factOf(person, tag)?.date?.component) : undefined;
}

/** One partner slot of a family, with its addressable id and details. */
export interface FamilyPartnerLink {
  id: string;
  personId: string;
  preferred?: boolean | undefined;
  date?: DateValue | undefined;
}

/** One child slot of a family, with its addressable id and link details. */
export interface FamilyChildLink {
  id: string;
  childId: string;
  pedigree?: string | undefined;
  pedigreePhrase?: string | undefined;
  status?: string | undefined;
  fatherRelation?: string | undefined;
  motherRelation?: string | undefined;
}

export interface FamilyRecord {
  id: string;
  /** Identifier assigned by a GEDCOM import; provenance only. */
  xref?: string | undefined;
  /** The partners, ordered (the first is the "leftmost" in the UI) — projection of `partnerLinks`. */
  partners: string[];
  children: string[];
  /** The ordered partner slots; the repository always fills them. */
  partnerLinks?: FamilyPartnerLink[] | undefined;
  childLinks?: FamilyChildLink[] | undefined;
}

// ---------------------------------------------------------------------------
// Places
// ---------------------------------------------------------------------------

/**
 * One jurisdiction level of a place name ('Moscow' in 'Moscow, Russia').
 * A place carries several name rows: the official name (one row per
 * jurisdiction) plus translations/phonetic/romanized rows.
 */
export interface PlaceName {
  id: string;
  kind?: 'official' | 'translation' | 'phonetic' | 'romanized' | undefined;
  language?: string | undefined;
  type?: string | undefined;
  position: number;
  value: string;
}

export interface PlaceRecord {
  id: string;
  xref?: string | undefined;
  latitude?: number | undefined;
  longitude?: number | undefined;
  verified?: boolean | undefined;
  names: PlaceName[];
  hierarchy?: { parentId: string; type?: string }[] | undefined;
  postalCodes?: { id: string; code: string; date?: DateValue }[] | undefined;
}

/** The joined display form of a place: jurisdictions smallest first. */
export function placeName(place: PlaceRecord | undefined): string {
  if (!place) {
    return '';
  }
  return place.names
    .filter((name) => name.kind === undefined || name.kind === 'official')
    .sort((a, b) => a.position - b.position)
    .map((name) => name.value)
    .filter((value) => value !== '')
    .join(', ');
}

// ---------------------------------------------------------------------------
// Sources, citations, notes, media
// ---------------------------------------------------------------------------

export interface SourceText {
  id: string;
  text: string;
  mime?: string | undefined;
  language?: string | undefined;
}

export interface SourceRecord {
  id: string;
  /** Identifier assigned by a GEDCOM import; provenance only. */
  xref?: string | undefined;
  title?: string | undefined;
  abbreviation?: string | undefined;
  author?: string | undefined;
  publication?: string | undefined;
  medium?: string | undefined;
  url?: string | undefined;
  accessDate?: string | undefined;
  confidence?: string | undefined;
  pubDate?: DateValue | undefined;
  pubPlace?: string | undefined;
  agency?: string | undefined;
  /** The bibliographic work (7.0 TITL record) this source cites. */
  titleId?: string | undefined;
  texts?: SourceText[] | undefined;
  dataEvents?: Array<{ id: string; tag: string; value?: string; date?: DateValue; placeId?: string }> | undefined;
  repositories?: Array<{ id: string; repositoryId: string; callNumbers?: Array<{ id: string; value: string; medium?: string }> }> | undefined;
  templateFields?: Array<{ id: string; name: string; value?: string }> | undefined;
}

/**
 * A source attached to some part of the tree (a person, family, fact, name,
 * …). `page` is the location within the source, `quality` the reliability
 * assessment for this claim.
 */
export interface CitationRecord {
  id: string;
  sourceId: string;
  targetType: string;
  targetId: string;
  page?: string | undefined;
  quality?: string | undefined;
  description?: string | undefined;
  confidence?: string | undefined;
  event?: string | undefined;
  role?: string | undefined;
  phrase?: string | undefined;
  date?: DateValue | undefined;
  www?: string | undefined;
  texts?: SourceText[] | undefined;
  templateFields?: Array<{ id: string; name: string; value?: string }> | undefined;
}

export interface NoteLinkRecord {
  id: string;
  targetType: string;
  targetId: string;
}

export interface NoteTranslation {
  id: string;
  text: string;
  mime?: string | undefined;
  language?: string | undefined;
}

/**
 * A note: inline (one link) or shared (several links). `targetType`/
 * `targetId` are projections of the first link, kept for the renderer; the
 * full attachment set lives in `links`.
 */
export interface NoteRecord {
  id: string;
  /** Set when the note is a shared NOTE/SNOTE record. */
  xref?: string | undefined;
  text: string;
  mime?: string | undefined;
  language?: string | undefined;
  targetType?: string | undefined;
  targetId?: string | undefined;
  links?: NoteLinkRecord[] | undefined;
  translations?: NoteTranslation[] | undefined;
}

/** One file of a media record; the bytes live in the media/ folder, never in the DB. */
export interface MediaFile {
  id: string;
  path: string;
  title?: string | undefined;
}

/** A media record attached to some target, with the link's usage details. */
export interface MediaLinkRecord {
  id: string;
  mediaId: string;
  targetType: string;
  targetId: string;
  crop?: { top?: number; left?: number; height?: number; width?: number } | undefined;
  title?: string | undefined;
  sequence?: number | undefined;
  primary?: boolean | undefined;
  scrapbook?: boolean | undefined;
  slideshow?: boolean | undefined;
  thumbnail?: boolean | undefined;
  exclude?: boolean | undefined;
  caption?: boolean | undefined;
}

/**
 * A media record with its files and links. `path`, `targetType`, `targetId`
 * and `title` are projections of the first file/link, kept for the renderer.
 */
export interface MediaRecord {
  id: string;
  /** Identifier assigned by a GEDCOM import; provenance only. */
  xref?: string | undefined;
  /** Project-relative path under the media folder (first file). */
  path?: string | undefined;
  title?: string | undefined;
  targetType?: string | undefined;
  targetId?: string | undefined;
  files?: MediaFile[] | undefined;
  links?: MediaLinkRecord[] | undefined;
}

// ---------------------------------------------------------------------------
// Repositories, submitters, addresses, header
// ---------------------------------------------------------------------------

export interface AddressRecord {
  id: string;
  lines: string[];
  city?: string | undefined;
  state?: string | undefined;
  postalCode?: string | undefined;
  country?: string | undefined;
}

export interface RepositoryRecord {
  id: string;
  xref?: string | undefined;
  name: string;
  addressId?: string | undefined;
}

export interface SubmitterRecord {
  id: string;
  xref?: string | undefined;
  name: string;
  addressId?: string | undefined;
  languages?: string[] | undefined;
}

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

export interface IdentifierRecord {
  id: string;
  targetType: string;
  targetId: string;
  namespace: string;
  value: string;
}

export interface ContactRecord {
  id: string;
  targetType: string;
  targetId: string;
  kind: string;
  value: string;
}

export interface RestrictionRecord {
  id: string;
  targetType: string;
  targetId: string;
  level: string;
}

export interface ChangeRecord {
  id: string;
  targetType: string;
  targetId: string;
  kind: 'created' | 'changed';
  date?: DateValue | undefined;
  user?: string | undefined;
}

/** A named label attached to any target (no color — presentation lives in themes). */
export interface TagRecord {
  id: string;
  name: string;
}

export interface TagLinkRecord {
  id: string;
  tagId: string;
  targetType: string;
  targetId: string;
  date?: DateValue | undefined;
}

/** Everything attached to one target, for op snapshots and cascades. */
export interface AttachmentsSnapshot {
  noteLinks: Array<{ note: NoteRecord; link: NoteLinkRecord }>;
  citations: CitationRecord[];
  mediaLinks: Array<{ media: MediaRecord; link: MediaLinkRecord }>;
  identifiers: IdentifierRecord[];
  contacts: ContactRecord[];
  restrictions: RestrictionRecord[];
  changes: ChangeRecord[];
  tagLinks: Array<{ tagId: string; link: TagLinkRecord }>;
  ordinances: OrdinanceRecord[];
  todos: TodoRecord[];
  evidenceLinks: EvidenceLinkRecord[];
  recordSubmitters: Array<{ id: string; submitterId: string; targetType: string; targetId: string }>;
}

export function emptyAttachments(): AttachmentsSnapshot {
  return {
    noteLinks: [],
    citations: [],
    mediaLinks: [],
    identifiers: [],
    contacts: [],
    restrictions: [],
    changes: [],
    tagLinks: [],
    ordinances: [],
    todos: [],
    evidenceLinks: [],
    recordSubmitters: [],
  };
}

// ---------------------------------------------------------------------------
// Relations and the research layer
// ---------------------------------------------------------------------------

/** A non-family relation between two persons (GEDCOM ASSO). */
export interface AssociationRecord {
  id: string;
  personId: string;
  otherPersonId: string;
  role?: string | undefined;
  relationship?: string | undefined;
  phrase?: string | undefined;
  primary?: boolean | undefined;
  specificType?: string | undefined;
  confidence?: string | undefined;
  periodStart?: DateValue | undefined;
  periodEnd?: DateValue | undefined;
}

/** An LDS ordinance attached to a person, family or family child link. */
export interface OrdinanceRecord {
  id: string;
  kind: string;
  targetType: string;
  targetId: string;
  date?: DateValue | undefined;
  temple?: string | undefined;
  placeId?: string | undefined;
  status?: string | undefined;
  statusDate?: DateValue | undefined;
}

/** A task, attached to some entity or free-standing. */
export interface TodoRecord {
  id: string;
  text: string;
  targetType?: string | undefined;
  targetId?: string | undefined;
  category?: string | undefined;
  locality?: string | undefined;
  priority?: string | undefined;
  status?: string | undefined;
  createdDate?: DateValue | undefined;
  scheduledDate?: DateValue | undefined;
  reminderDate?: DateValue | undefined;
  closedDate?: DateValue | undefined;
  repositoryId?: string | undefined;
}

/** One claim inside an evidence record. */
export interface EvidenceFinding {
  id: string;
  type?: string | undefined;
  value?: string | undefined;
  date?: DateValue | undefined;
  placeId?: string | undefined;
  ageBound?: string | undefined;
  ageYears?: number | undefined;
  ageMonths?: number | undefined;
  ageDays?: number | undefined;
  agePhrase?: string | undefined;
}

/** A claim of an evidence record about some tree entity. */
export interface EvidenceLinkRecord {
  id: string;
  evidenceId: string;
  targetType: string;
  targetId: string;
  confidence?: string | undefined;
  used?: string | undefined;
  quality?: string | undefined;
}

export interface EvidenceRecord {
  id: string;
  type?: string | undefined;
  documentType?: string | undefined;
  analysis?: string | undefined;
  findings: EvidenceFinding[];
  links: EvidenceLinkRecord[];
}

export interface ResearchConclusion {
  id: string;
  personId: string;
  text: string;
}

export interface ResearchDocumentRecord {
  id: string;
  title?: string | undefined;
  text: string;
  author?: string | undefined;
  date?: DateValue | undefined;
  subjectIds?: string[] | undefined;
  conclusions?: ResearchConclusion[] | undefined;
}

export interface ResearchActivityRecord {
  id: string;
  type?: string | undefined;
  purpose?: string | undefined;
  target?: string | undefined;
  venue?: string | undefined;
  result?: string | undefined;
  date?: DateValue | undefined;
  researcher?: string | undefined;
}

export interface CensusEntry {
  id: string;
  personId: string;
  fatherId?: string | undefined;
  motherId?: string | undefined;
  sex?: string | undefined;
  ageValue?: string | undefined;
  maritalStatus?: string | undefined;
  occupation?: string | undefined;
  birthDate?: DateValue | undefined;
  birthPlace?: string | undefined;
}

export interface CensusRecord {
  id: string;
  schedule?: string | undefined;
  date?: DateValue | undefined;
  placeId?: string | undefined;
  entries: CensusEntry[];
}

export interface DuplicateCandidateRecord {
  id: string;
  personId: string;
  otherPersonId: string;
  caption?: string | undefined;
  assessment?: string | undefined;
  status?: string | undefined;
}

/** A bibliographic work (GEDCOM 7.0 TITL record), cited by sources. */
export interface TitleRecord {
  id: string;
  xref?: string | undefined;
  name?: string | undefined;
  author?: string | undefined;
  publisher?: string | undefined;
  series?: string | undefined;
  abbreviation?: string | undefined;
  repositoryId?: string | undefined;
  callNumber?: string | undefined;
  sequence?: number | undefined;
}

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

/**
 * The machine-readable list of attachment target types. The polymorphic
 * attachment tables pair `target_type` with the target row's UUID.
 */
export const TARGET_TYPES = [
  'person',
  'family',
  'family_partner',
  'family_child',
  'fact',
  'name',
  'source',
  'citation',
  'note',
  'media',
  'media_file',
  'place',
  'repository',
  'submitter',
  'association',
  'ordinance',
  'evidence',
  'todo',
  'research_document',
  'research_activity',
  'title',
  'census',
] as const;

export type TargetType = (typeof TARGET_TYPES)[number];

// ---------------------------------------------------------------------------
// Whole-tree helpers
// ---------------------------------------------------------------------------

/**
 * The whole tree as plain maps — the shape the validator and one-shot
 * analyses consume. The repository builds it on demand.
 */
export interface TreeDocument {
  persons: Map<string, PersonRecord>;
  families: Map<string, FamilyRecord>;
}

export function emptyDocument(): TreeDocument {
  return { persons: new Map(), families: new Map() };
}
