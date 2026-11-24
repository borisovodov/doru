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

/**
 * Merges two independently stored date bounds into one range value. Used by
 * the GEDCOM import layer: `_DATE2` and the extension `_PERIOD` bounds become
 * ordinary `range` dates in the tree model. When only the end survives, the
 * result is an open-ended range (`TO end`).
 */
export function mergeDateBounds(start?: DateValue, end?: DateValue): DateValue | undefined {
  if (start === undefined) {
    if (end === undefined) {
      return undefined;
    }
    const endComponent = end.component ?? end.end;
    return {
      quality: 'range',
      ...(endComponent !== undefined ? { end: endComponent } : {}),
      ...(end.text !== undefined ? { text: end.text } : {}),
      ...(end.time !== undefined ? { time: end.time } : {}),
    };
  }
  if (end === undefined) {
    return start;
  }
  if (end.component === undefined && end.end === undefined) {
    if (start.quality !== 'range' || start.end === undefined) {
      // A phrase-only secondary date adds no bound; keep the primary qualifier
      // (BEF stays BEF instead of becoming an open-ended FROM range).
      return start.text === undefined && end.text !== undefined ? { ...start, text: end.text } : start;
    }
    return {
      quality: 'range',
      ...(start.component !== undefined ? { component: start.component } : {}),
      end: start.end,
      ...(start.text !== undefined ? { text: start.text } : end.text !== undefined ? { text: end.text } : {}),
      ...(start.time !== undefined ? { time: start.time } : {}),
    };
  }
  const endComponent = end.component ?? end.end;
  // The time belongs to the value that supplies the sortable date: the start
  // when it has a year, otherwise the end. A yearless start cannot position
  // the range, so its time must not drag the end's date to another hour.
  const time =
    start.component?.year !== undefined
      ? start.time
      : endComponent?.year !== undefined
        ? end.time
        : (start.time ?? end.time);
  // A phrase from the end bound cannot be attached to the range: the split
  // would put it on the start bound. Keep it only when the start is a phrase.
  const text = start.text ?? (start.component === undefined ? end.text : undefined);
  return {
    quality: 'range',
    ...(start.component !== undefined ? { component: start.component } : {}),
    end: endComponent,
    ...(text !== undefined ? { text } : {}),
    ...(time !== undefined ? { time } : {}),
  };
}

/**
 * Splits a range value back into its two bounds for consumers that still
 * have two slots (the GEDCOM `_PERIOD` extension). A non-range date becomes
 * the start bound; a range with one bound yields only that bound.
 */
export function splitDateBounds(date?: DateValue): { start?: DateValue; end?: DateValue } {
  if (date === undefined) {
    return {};
  }
  if (date.quality !== 'range') {
    return { start: date };
  }
  // The time belongs to the endpoint that supplies the sortable year: the
  // start when it has one, otherwise the end. A yearless start must not
  // steal the end's time.
  const startCarriesTime =
    date.component !== undefined && (date.component.year !== undefined || date.end?.year === undefined);
  const start =
    date.component !== undefined
      ? {
          // A range without an end is open-ended: keep the FROM qualifier
          // in the start slot so it survives a round trip.
          quality: date.end === undefined ? ('range' as const) : ('exact' as const),
          component: date.component,
          ...(date.text !== undefined ? { text: date.text } : {}),
          ...(startCarriesTime && date.time !== undefined ? { time: date.time } : {}),
        }
      : undefined;
  const end =
    date.end !== undefined
      ? {
          quality: 'exact' as const,
          component: date.end,
          ...(start === undefined && date.text !== undefined ? { text: date.text } : {}),
          ...(!startCarriesTime && date.time !== undefined ? { time: date.time } : {}),
        }
      : undefined;
  if (start === undefined && end === undefined && date.text !== undefined) {
    return { start: { quality: 'unknown', text: date.text } };
  }
  return {
    ...(start !== undefined ? { start } : {}),
    ...(end !== undefined ? { end } : {}),
  };
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
  /** The event date; a period is a `range` value with `component` and `end`. */
  date?: DateValue | undefined;
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

/**
 * Case-folds text for user-facing substring matching. Unicode lowercasing
 * maps word-final Greek sigma to ς, so a query ending in Σ would miss the
 * same letters inside a word; fold it to σ on both sides.
 */
export function foldCase(value: string): string {
  return value.toLowerCase().replaceAll('ς', 'σ');
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
 * …). A task is never a target: a citation is evidence for a genealogical
 * assertion, while a task is a work item that asserts nothing. `page` is the
 * location within the source, `quality` the reliability assessment for this
 * claim.
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

/**
 * A contact detail on a target that GEDCOM can carry one for (see
 * `CONTACT_TARGET_TYPES`). `kind` is deliberately open: every kind is offered
 * on every supported target, and unknown values survive a round trip.
 */
export interface ContactRecord {
  id: string;
  targetType: string;
  targetId: string;
  kind: string;
  value: string;
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
  /** Attachments of linked notes, restored when this snapshot reinserts one. */
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
  /** Task links targeting this record; the tasks themselves survive. */
  taskLinks: TaskTargetLink[];
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
    taskLinks: [],
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
  /** The period of the association; a range value when both bounds are known. */
  period?: DateValue | undefined;
}

/** The canonical task statuses, in UI order. */
export const TASK_STATUSES = ['open', 'waiting', 'in-progress', 'closed'] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

/**
 * Vendor spellings mapped onto the canonical statuses. The key is the
 * lowercased value with spaces, hyphens, and underscores removed, so
 * `InProgress`, `in-progress`, and `in progress` share one entry. The
 * GEDCOM corpus uses `Open`, `Completed`, `INPROGRESS`, and `InProgress`.
 */
const TASK_STATUS_ALIASES: Readonly<Record<string, TaskStatus>> = {
  open: 'open',
  opened: 'open',
  new: 'open',
  notstarted: 'open',
  waiting: 'waiting',
  pending: 'waiting',
  onhold: 'waiting',
  hold: 'waiting',
  deferred: 'waiting',
  blocked: 'waiting',
  inprogress: 'in-progress',
  progress: 'in-progress',
  started: 'in-progress',
  active: 'in-progress',
  wip: 'in-progress',
  working: 'in-progress',
  closed: 'closed',
  completed: 'closed',
  complete: 'closed',
  done: 'closed',
  finished: 'closed',
  resolved: 'closed',
};

/** Map a known vendor spelling to a canonical status; unknown text has no mapping. */
export function canonicalizeTaskStatus(status: string | undefined): TaskStatus | undefined {
  if (status === undefined) {
    return undefined;
  }
  const key = status
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
  return Object.prototype.hasOwnProperty.call(TASK_STATUS_ALIASES, key) ? TASK_STATUS_ALIASES[key] : undefined;
}

/** Unknown, empty, and missing statuses mean open. */
export function normalizeTaskStatus(status: string | undefined): TaskStatus {
  return canonicalizeTaskStatus(status) ?? 'open';
}

/** The canonical task priorities, in UI order. */
export const TASK_PRIORITIES = ['low', 'medium', 'high'] as const;

export type TaskPriority = (typeof TASK_PRIORITIES)[number];

/**
 * Unknown, empty, and missing priorities mean medium. The GEDCOM corpus uses
 * both words (`HIGH`, `High`, `normal`) and the numeric 1–9 scale, where 1 is
 * the highest priority and 9 the lowest.
 */
export function normalizeTaskPriority(priority: string | undefined): TaskPriority {
  const trimmed = priority?.trim();
  if (trimmed === undefined || trimmed === '') {
    return 'medium';
  }
  if (/^\d+$/.test(trimmed)) {
    const value = Number(trimmed);
    if (value === 0) {
      return 'medium';
    }
    if (value <= 3) {
      return 'high';
    }
    if (value <= 6) {
      return 'medium';
    }
    return 'low';
  }
  const key = trimmed.toLowerCase().replace(/[\s_-]+/g, '');
  if (key === 'low' || key === 'minor') {
    return 'low';
  }
  if (key === 'high' || key === 'urgent' || key === 'critical') {
    return 'high';
  }
  return 'medium';
}

/** A polymorphic reference to one tree row. */
export interface TargetRef {
  targetType: string;
  targetId: string;
}

/** A link from a task to one related record. */
export interface TaskTargetLink extends TargetRef {
  id: string;
  taskId: string;
}

/**
 * A task, linked to any number of entities or free-standing.
 *
 * Dóru deliberately has no direct task-to-repository field, task category,
 * task locality, task title, task type, or task-result text: the GEDCOM
 * `TODO` `REPO`, `_CAT`, `_LOCL`, `_TTIL`, `TYPE`, and `DATA` slots are parsed
 * by `@doru/gedcom` but ignored by the import/export boundary. A repository
 * can still be one of the task's targets.
 */
export interface TaskRecord {
  id: string;
  text: string;
  /** The records this task relates to; empty for a free-standing task. */
  targets: TaskTargetLink[];
  /** Canonical priorities; unknown, empty, and missing values mean medium. */
  priority?: string | undefined;
  /** Canonical statuses; unknown, empty, and missing values mean open. */
  status?: string | undefined;
  /** Creation instant, epoch milliseconds. Set once when the task is created. */
  createdAt?: number | undefined;
  /** Scheduled instant, epoch milliseconds. */
  scheduledAt?: number | undefined;
  /** Reminder instant, epoch milliseconds. */
  reminderAt?: number | undefined;
  /** Closing instant, epoch milliseconds; cleared when the task is reopened. */
  closedAt?: number | undefined;
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
  'task',
  'title',
] as const;

export type TargetType = (typeof TARGET_TYPES)[number];

/**
 * The targets that can own contact details. GEDCOM keeps PHON, EMAIL, FAX and
 * WWW inside addresses (5.5.x), on event details and on the REPO and SUBM
 * records (7.0); direct INDI contacts are a vendor extension Dóru keeps on a
 * person. Every other attachment target has no contact slot on import or
 * export, so a contact row there would be dead data.
 */
export const CONTACT_TARGET_TYPES = ['person', 'fact', 'address', 'repository', 'submitter'] as const;

export type ContactTargetType = (typeof CONTACT_TARGET_TYPES)[number];

export function isContactTargetType(type: string): type is ContactTargetType {
  return (CONTACT_TARGET_TYPES as readonly string[]).includes(type);
}

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
