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
export type NamePartKind = 'full' | 'prefix' | 'given' | 'nickname' | 'surnamePrefix' | 'surname' | 'suffix';

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
/**
 * Every addressable name id of a person: the top-level names and all nested
 * variants. Attachments target the individual `person_name` rows, so the
 * whole tree has to be walked before names are replaced or deleted.
 */
export function collectNameIds(names: PersonName[]): string[] {
  const ids: string[] = [];
  const visit = (name: PersonName): void => {
    ids.push(name.id);
    for (const variant of name.variants ?? []) {
      visit(variant);
    }
  };
  for (const name of names) {
    visit(name);
  }
  return ids;
}

/** Every name part id, including parts of nested variants. */
export function collectNamePartIds(names: PersonName[]): string[] {
  const ids: string[] = [];
  const visit = (name: PersonName): void => {
    for (const part of name.parts ?? []) {
      ids.push(part.id);
    }
    for (const variant of name.variants ?? []) {
      visit(variant);
    }
  };
  for (const name of names) {
    visit(name);
  }
  return ids;
}

export interface PersonName {
  id: string;
  /** Translation/phonetic/romanized variant of another name; undefined for a top-level name. */
  kind?: 'translation' | 'phonetic' | 'romanized' | undefined;
  language?: string | undefined;
  /** The name's kind: 'birth', 'maiden', 'married', 'aka', … */
  type?: string | undefined;
  /** The transliteration method of a phonetic/romanized variant (FONE/ROMN TYPE). */
  variantType?: string | undefined;
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
  /** Vendor name fields kept verbatim (GEDCOM-L/FamilySearch/MyHeritage). */
  callName?: string | undefined;
  middleName?: string | undefined;
  patronymic?: string | undefined;
  marriedName?: string | undefined;
  aka?: string | undefined;
  hebrewName?: string | undefined;
  title?: string | undefined;
  shortName?: string | undefined;
  nameAsRecorded?: string | undefined;
  givenNameUsed?: string | undefined;
  parts?: NamePart[] | undefined;
  variants?: PersonName[] | undefined;
}

/**
 * The Family Historian fact flags (`_FLGS`). Stored in lowercase in the
 * `fact_flag` table and edited as checkboxes; the GEDCOM wire form is the
 * uppercase `FactFlag` of `@doru/gedcom`. The AGES! `_PRI` marker is a
 * separate concept and lives in `FactRecord.primary`.
 */
export const FACT_FLAGS = ['private', 'preferred', 'tentative', 'rejected'] as const;

export type FactFlag = (typeof FACT_FLAGS)[number];

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
  /** The end date of a period (vendor `_DATE2`). */
  endDate?: DateValue | undefined;
  /** Sort date (GEDCOM SDATE): orders the fact when the display date cannot. */
  sortDate?: DateValue | undefined;
  /** The place entity this fact happened at; the raw string stays in `place`. */
  placeId?: string | undefined;
  /** The place as typed/displayed. */
  place?: string | undefined;
  /** Additional places of the event (vendor `_PLAC`). */
  additionalPlaceIds?: string[] | undefined;
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
  /** The Family Historian `_FLGS` flags. */
  flags?: FactFlag[] | undefined;
  /** The fact is the primary one of its kind (AGES! `_PRI`). */
  primary?: boolean | undefined;
  /** Families referenced by the event (GEDCOM event-level FAMC). */
  familyLinks?: FactFamilyLink[] | undefined;
  /** The place prefix (vendor `_PPFX`). */
  placePrefix?: string | undefined;
  /** The vendor event number (vendor `_EVN`). */
  eventNumber?: string | undefined;
  birthLength?: string | undefined;
  birthWeight?: string | undefined;
  cemetery?: string | undefined;
  /** The event carries a full recorded name (vendor `_FNA`). */
  fna?: boolean | undefined;
  descriptionAware?: boolean | undefined;
  /** Event coordinates (vendor `_COR`). */
  map?: { latitude: number; longitude: number } | undefined;
}

/** The family an event belongs to (GEDCOM event-level FAMC). */
export interface FactFamilyLink {
  id: string;
  familyId: string;
  /** The parent(s) who adopted the subject (ADOP only): HUSB | WIFE | BOTH. */
  adoptedBy?: 'HUSB' | 'WIFE' | 'BOTH' | undefined;
  phrase?: string | undefined;
  position: number;
}

/** An age at a fact: the subject's (no person/role) or a partner's (HUSB/WIFE). */
export interface FactAge {
  id: string;
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
export interface PersonRecord {
  id: string;
  /** Identifier assigned by a GEDCOM import; provenance only. */
  xref?: string | undefined;
  sex: Sex;
  /** The parser's ISDEAD vital flag: alive | dead; undefined = unknown. */
  deathStatus?: 'alive' | 'dead' | undefined;
  /** The person's own address (GEDCOM INDI.ADDR), shared with other records. */
  addressId?: string | undefined;
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
  /** The role phrase on the partner slot (GEDCOM HUSB/WIFE PHRASE). */
  phrase?: string | undefined;
  /** The partner's name as written on the link (vendor `_NAM`). */
  name?: string | undefined;
  /** Civil status of the union (vendor `_ZVST`). */
  civilStatus?: string | undefined;
  /** Marriage number (vendor `_NR`). */
  marriageNumber?: string | undefined;
}

/** One child slot of a family, with its addressable id and link details. */
export interface FamilyChildLink {
  id: string;
  childId: string;
  pedigree?: string | undefined;
  pedigreePhrase?: string | undefined;
  status?: string | undefined;
  statusPhrase?: string | undefined;
  fatherRelation?: string | undefined;
  motherRelation?: string | undefined;
  preferred?: boolean | undefined;
  /** Birth multiplicity as written on the link (vendor `_STAT`). */
  multiplicity?: string | undefined;
}

/** A dated marriage-status entry of a family (GEDCOM-L `_STAT`). */
export interface FamilyMarriageStatus {
  id: string;
  status: string;
  date?: DateValue | undefined;
  placeId?: string | undefined;
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
  preferred?: boolean | undefined;
  sameSex?: boolean | undefined;
  /** Union kind (vendor UTYP). */
  unionKind?: string | undefined;
  /** Union status (vendor `_UST`). */
  unionStatus?: string | undefined;
  /** Marriage beginning/ending status (vendor `_MSTAT`/`_MEND`). */
  marriageBeginStatus?: string | undefined;
  marriageEndStatus?: string | undefined;
  marriageStatuses?: FamilyMarriageStatus[] | undefined;
  /**
   * Free-text family witnesses (vendor `_WITN`/`_GODT`). These are names,
   * not person pointers, and deliberately have no stable row identity in
   * the model: they are not attachment targets. Use `association` for
   * witnesses that need notes, sources or tasks.
   */
  witnesses?: string[] | undefined;
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
  /** The period the name was in force (GEDCOM-L NAME.DATE). */
  date?: DateValue | undefined;
  /** An addition to the name (GEDCOM-L NAMC). */
  addition?: string | undefined;
  /** A short form of the name (GEDCOM-L ABBR). */
  abbreviation?: string | undefined;
  abbreviationType?: string | undefined;
}

export interface PlaceRecord {
  id: string;
  xref?: string | undefined;
  latitude?: number | undefined;
  longitude?: number | undefined;
  verified?: boolean | undefined;
  /** The jurisdiction-type list (GEDCOM PLAC.FORM). */
  form?: string[] | undefined;
  abbreviation?: string | undefined;
  preposition?: string | undefined;
  govId?: string | undefined;
  maidenhead?: string | undefined;
  placeType?: string | undefined;
  names: PlaceName[];
  hierarchy?: Array<{ id: string; parentId: string; type?: string; date?: DateValue }> | undefined;
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
  /** Record-level reliability assessment (QUAY). */
  certainty?: string | undefined;
  /** The short subsequent-citation form (vendor `_SUBQ`). */
  subsequentCitationFormat?: string | undefined;
  /** The bibliography entry (vendor `_BIBL`). */
  bibliography?: string | undefined;
  /** Notes on the source's DATA block. */
  dataNote?: string | undefined;
  /** The bibliographic work (7.0 TITL record) this source cites. */
  titleId?: string | undefined;
  texts?: SourceText[] | undefined;
  dataEvents?: Array<{ id: string; tag: string; value?: string; date?: DateValue; placeId?: string }> | undefined;
  repositories?:
    | Array<{ id: string; repositoryId: string; callNumbers?: Array<{ id: string; value: string; medium?: string }> }>
    | undefined;
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
  /** The citation's own name (vendor NAME). */
  name?: string | undefined;
  /** The source-quality assessment (vendor `_QUAL`). */
  qualityAssessment?: string | undefined;
  /** A cross-reference to another citation (vendor `_CREF`). */
  reference?: string | undefined;
  /** The citation reference number (REFN). */
  referenceNumber?: string | undefined;
  abbreviation?: string | undefined;
  footnote?: string | undefined;
  verified?: boolean | undefined;
  assessment?: string | undefined;
  foundBy?: string | undefined;
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
  /** FORM.MEDI: the historical medium (photograph, negative, digital, …). */
  medium?: string | undefined;
  /** _CTYP: person, group, place, tombstone, document, heirloom, … */
  contentType?: string | undefined;
  /** _TEXT: the file's transcription text. */
  text?: string | undefined;
  /** TRAN: the same content in another digital format. */
  translations?: MediaFileTranslation[] | undefined;
}

export interface MediaFileTranslation {
  id: string;
  path: string;
  position: number;
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
  /** Historical media date (`_DATE`), not the file's EXIF timestamp. */
  date?: DateValue | undefined;
  /** Historical place (`PLAC`), as typed and optionally linked to a place row. */
  place?: string | undefined;
  placeId?: string | undefined;
  /** _TYPE: Photo, Sound, Video, Document, … */
  objectType?: string | undefined;
  /** _DSCR: the media object's description. */
  description?: string | undefined;
  /** _KEYS: keywords of the media object. */
  keywords?: string | undefined;
  targetType?: string | undefined;
  targetId?: string | undefined;
  files?: MediaFile[] | undefined;
  links?: MediaLinkRecord[] | undefined;
}

/** Media extensions the UI renders as images. */
export const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'tiff'] as const;

export function isImagePath(path: string | undefined): boolean {
  if (!path) {
    return false;
  }
  const dot = path.lastIndexOf('.');
  return dot !== -1 && (IMAGE_EXTENSIONS as readonly string[]).includes(path.slice(dot + 1).toLowerCase());
}

/** True when a stored path points inside the project's media folder. */
export function isProjectMediaPath(path: string): boolean {
  const normalized = path.replaceAll('\\', '/');
  return normalized.startsWith('media/') && !normalized.split('/').includes('..');
}

/**
 * True when a media record has at least one project-relative image file.
 * External paths and non-image files are intentionally hidden from the UI.
 */
export function isVisibleMedia(media: Pick<MediaRecord, 'path' | 'files'>): boolean {
  const paths = media.files?.map((file) => file.path) ?? (media.path !== undefined ? [media.path] : []);
  return paths.some((path) => isProjectMediaPath(path) && isImagePath(path));
}

// ---------------------------------------------------------------------------
// Repositories, submitters, addresses, header
// ---------------------------------------------------------------------------

/** One address line. The id makes the row a stable attachment target. */
export interface AddressLine {
  id: string;
  value: string;
}

export interface AddressRecord {
  id: string;
  lines: AddressLine[];
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
  /** The issuing authority of a REFN/EXID identifier (GEDCOM TYPE). */
  type?: string | undefined;
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

/** A submitter link: contributor or an ANCI/DESI research interest. */
export interface RecordSubmitterLink {
  id: string;
  submitterId: string;
  targetType: string;
  targetId: string;
  /** Missing on legacy/caller snapshots means an ordinary contributor. */
  kind?: 'contributor' | 'ancestor_interest' | 'descendant_interest' | undefined;
}

/** Attachments of a target nested inside a larger snapshot (e.g. a media link). */
export interface NestedAttachmentSnapshot {
  targetType: string;
  targetId: string;
  attachments: AttachmentsSnapshot;
}

/** Everything attached to one target, for op snapshots and cascades. */
export interface AttachmentsSnapshot {
  noteLinks: Array<{ note: NoteRecord; link: NoteLinkRecord }>;
  /** Attachments of notes that lose their last link with this target. */
  noteAttachments: NestedAttachmentSnapshot[];
  citations: CitationRecord[];
  /** Attachments of citations that would be deleted with this target. */
  citationAttachments: NestedAttachmentSnapshot[];
  mediaLinks: Array<{ media: MediaRecord; link: MediaLinkRecord }>;
  /** Attachments of media records that would be deleted with this target. */
  mediaAttachments: NestedAttachmentSnapshot[];
  /** Attachments of the files of those media records. */
  mediaFileAttachments: NestedAttachmentSnapshot[];
  /** Attachments of the media links above, restored with them. */
  mediaLinkAttachments: NestedAttachmentSnapshot[];
  identifiers: IdentifierRecord[];
  contacts: ContactRecord[];
  restrictions: RestrictionRecord[];
  changes: ChangeRecord[];
  tagLinks: Array<{ tagId: string; link: TagLinkRecord }>;
  todos: TodoRecord[];
  /** Attachments of todos that would be deleted with this target. */
  todoAttachments: NestedAttachmentSnapshot[];
  recordSubmitters: RecordSubmitterLink[];
}

export function emptyAttachments(): AttachmentsSnapshot {
  return {
    noteLinks: [],
    noteAttachments: [],
    citations: [],
    citationAttachments: [],
    mediaLinks: [],
    mediaAttachments: [],
    mediaFileAttachments: [],
    mediaLinkAttachments: [],
    identifiers: [],
    contacts: [],
    restrictions: [],
    changes: [],
    tagLinks: [],
    todos: [],
    todoAttachments: [],
    recordSubmitters: [],
  };
}

// ---------------------------------------------------------------------------
// Relations and the research layer
// ---------------------------------------------------------------------------

/** A GEDCOM ASSO: a person association or a family↔person association. */
export interface AssociationRecord {
  id: string;
  /** The owning person (INDI.ASSO); exactly one of personId/familyId is set. */
  personId?: string | undefined;
  /** The owning family (FAM.ASSO); exactly one of personId/familyId is set. */
  familyId?: string | undefined;
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
 * Free-text `family_witness` rows are deliberately absent: they are names
 * without stable identity and are not attachment targets.
 */
export const TARGET_TYPES = [
  'person',
  'person_sex',
  'family',
  'family_partner',
  'family_child',
  'family_marriage_status',
  'fact',
  'name',
  'name_part',
  'source',
  'citation',
  'note',
  'media',
  'media_file',
  'media_link',
  'place',
  'place_name',
  'place_hierarchy',
  'repository',
  'submitter',
  'address',
  'address_line',
  'association',
  'todo',
  'title',
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
